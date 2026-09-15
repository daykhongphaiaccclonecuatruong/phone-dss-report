import os
import re
import pandas as pd
import numpy as np
from scoring import (
    calculate_all_scores,
    calculate_used_condition_score,
    clamp,
    scale
)


def get_data_dir():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "data")


def load_data():
    """
    Nạp dữ liệu từ thư mục data/ (chuẩn thị trường Việt Nam).
    """
    data_dir = get_data_dir()

    devices = pd.read_csv(os.path.join(data_dir, "01_devices.csv"))
    specs = pd.read_csv(os.path.join(data_dir, "02_device_specs.csv"))
    variants = pd.read_csv(os.path.join(data_dir, "03_device_variants.csv"))
    benchmarks = pd.read_csv(os.path.join(data_dir, "04_device_benchmarks.csv"))

    # Merge bảng Devices + Specs + Benchmarks
    df = devices.merge(specs, on="device_id", how="inner")
    df = df.merge(benchmarks, on="device_id", how="inner")

    # Merge với bảng Variants (1 máy có nhiều cấu hình RAM/ROM)
    df = df.merge(variants, on="device_id", how="inner")

    # Tính toán điểm khía cạnh phần cứng
    score_df = df.apply(
        lambda row: pd.Series(calculate_all_scores(row)),
        axis=1
    )
    df = pd.concat([df, score_df], axis=1)
    return df


def load_retailer_prices():
    """Nạp bảng giá chi tiết của từng cửa hàng."""
    data_dir = get_data_dir()
    retailer_path = os.path.join(data_dir, "05_device_retailer_prices.csv")
    if os.path.exists(retailer_path):
        return pd.read_csv(retailer_path)
    return pd.DataFrame()


def build_robust_price_table(retailer_df):
    """
    Tạo bảng giá tham chiếu từ dữ liệu cửa hàng và bỏ các giá thấp bất thường.
    Ví dụ: một flagship 40 triệu nhưng có 1 dòng crawl nhầm 5 triệu thì không dùng
    dòng 5 triệu đó để xếp hạng DSS.
    """
    if retailer_df.empty or "variant_id" not in retailer_df.columns:
        return pd.DataFrame()

    condition_col = "condition_type" if "condition_type" in retailer_df.columns else "condition"
    records = []

    def is_obvious_bad_price(row):
        variant_text = str(row.get("variant_id", "")).lower()
        condition_text = str(row.get(condition_col, "")).lower()
        price = float(row.get("price", 0) or 0)
        return (
            condition_text == "new"
            and "apple_iphone" in variant_text
            and price < 9000000
        )

    for (variant_id, condition), group in retailer_df.groupby(["variant_id", condition_col]):
        prices = group.copy()
        prices = prices[pd.to_numeric(prices["price"], errors="coerce").fillna(0) > 0].copy()
        if prices.empty:
            continue

        in_stock = prices[prices["stock_status"].astype(str).str.lower().eq("in_stock")]
        if not in_stock.empty:
            prices = in_stock

        obvious_bad_mask = prices.apply(is_obvious_bad_price, axis=1)
        obvious_bad_count = int(obvious_bad_mask.sum())
        if obvious_bad_count:
            prices = prices[~obvious_bad_mask].copy()
        if prices.empty:
            continue

        median_price = prices["price"].median()
        min_allowed = median_price * 0.60
        clean_prices = prices[prices["price"] >= min_allowed].copy()
        outliers_removed = len(prices) - len(clean_prices) + obvious_bad_count

        if clean_prices.empty:
            clean_prices = prices
            outliers_removed = 0

        best_row = clean_prices.sort_values("price", ascending=True).iloc[0]
        min_price = int(clean_prices["price"].min())
        avg_price = int(round(clean_prices["price"].mean()))
        max_price = int(clean_prices["price"].max())

        records.append({
            "variant_id": variant_id,
            "condition_type": condition,
            "min_price": min_price,
            "avg_price": avg_price,
            "max_price": max_price,
            "best_retailer": best_row.get("retailer", "Đại lý"),
            "best_retailer_url": best_row.get("product_url", ""),
            "savings_amount": max(0, max_price - min_price),
            "retailers_count": clean_prices["retailer"].nunique() if "retailer" in clean_prices.columns else len(clean_prices),
            "in_stock_count": len(clean_prices),
            "price_outliers_removed": outliers_removed,
        })

    return pd.DataFrame(records)


def calculate_balanced_score(row):
    """Tính điểm tổng hòa trung bình cộng 5 khía cạnh cốt lõi."""
    return (
        row.get("camera_score", 50)
        + row.get("gaming_score", 50)
        + row.get("battery_score", 50)
        + row.get("display_score", 50)
        + row.get("thin_light_score", 50)
    ) / 5.0


def calculate_new_value_score(row):
    """
    Chấm điểm P/P (Hiệu năng trên giá thành) cho máy mới.
    Mức chuẩn tham chiếu: 8 - 10 điểm hiệu năng / 1 triệu VNĐ.
    """
    price_million = float(row.get("price", 0)) / 1000000.0
    if price_million <= 0:
        return 0.0

    raw_value = float(row.get("balanced_score", 50)) / price_million
    value_score = (raw_value / 10.0) * 100.0
    return round(clamp(value_score), 2)


def add_price_data(df, condition="new"):
    """
    Gắn dữ liệu giá tổng hợp (min_price, avg_price, best_retailer, savings)
    từ 6 nhà phân phối lớn tại Việt Nam.
    """
    data_dir = get_data_dir()
    agg_path = os.path.join(data_dir, "05_device_aggregated_prices.csv")
    
    if os.path.exists(agg_path):
        agg_prices = pd.read_csv(agg_path)
        cond_col = "condition_type" if "condition_type" in agg_prices.columns else "condition"

        retailer_prices = load_retailer_prices()
        robust_prices = build_robust_price_table(retailer_prices)
        if not robust_prices.empty:
            agg_prices = agg_prices.drop(columns=[
                col for col in [
                    "min_price", "avg_price", "max_price", "best_retailer",
                    "best_retailer_url", "savings_amount", "retailers_count",
                    "in_stock_count", "price_outliers_removed"
                ] if col in agg_prices.columns
            ])
            agg_prices = agg_prices.merge(
                robust_prices,
                left_on=["variant_id", cond_col],
                right_on=["variant_id", "condition_type"],
                how="inner",
                suffixes=("", "_robust")
            )
            if cond_col != "condition_type" and "condition_type_robust" in agg_prices.columns:
                agg_prices = agg_prices.rename(columns={"condition_type_robust": "condition_type"})

        cond_prices = agg_prices[agg_prices[cond_col] == condition].copy()
        cond_prices["condition"] = condition

        merged = df.merge(cond_prices, on="variant_id", how="inner")
        merged["price"] = merged["min_price"]  # Dùng min_price làm giá tham chiếu lọc ngân sách

        merged["balanced_score"] = merged.apply(calculate_balanced_score, axis=1)

        if condition == "new":
            merged["value_score"] = merged.apply(calculate_new_value_score, axis=1)
        else:
            merged["condition_score"] = merged.apply(calculate_used_condition_score, axis=1)
            merged["base_value_score"] = merged.apply(calculate_new_value_score, axis=1)
            merged["value_score"] = (
                merged["base_value_score"] * 0.60
                + merged["condition_score"] * 0.40
            ).round(2)

        return merged
    else:
        # Fallback nếu thiếu file giá
        df["price"] = 10000000
        df["min_price"] = 10000000
        df["avg_price"] = 10000000
        df["best_retailer"] = "HoangHaMobile"
        df["savings_amount"] = 0
        df["balanced_score"] = df.apply(calculate_balanced_score, axis=1)
        df["value_score"] = 75.0
        return df


def calculate_final_score(row, priorities):
    """
    Tính điểm tổng kết theo trọng số sở thích đa tiêu chí (MCDA).
    """
    score_mapping = {
        "camera": row.get("camera_score", 50),
        "gaming": row.get("gaming_score", 50),
        "battery": row.get("battery_score", 50),
        "display": row.get("display_score", 50),
        "thin_light": row.get("thin_light_score", 50)
    }

    if not priorities:
        priorities = ["gaming"]

    if len(priorities) == 1:
        p1 = score_mapping.get(priorities[0], row.get("balanced_score", 50))
        final_score = (
            p1 * 0.65
            + row.get("value_score", 50) * 0.20
            + row.get("balanced_score", 50) * 0.15
        )
    else:
        p1 = score_mapping.get(priorities[0], row.get("balanced_score", 50))
        p2 = score_mapping.get(priorities[1], row.get("balanced_score", 50))
        final_score = (
            p1 * 0.50
            + p2 * 0.30
            + row.get("value_score", 50) * 0.10
            + row.get("balanced_score", 50) * 0.10
        )

    return round(float(final_score), 2)


def generate_reason(row, priorities):
    """
    Tạo đoạn văn giải thích lý do chuyên gia đề xuất máy này.
    """
    reasons = []
    chip = row.get("chipset", "SoC")
    antutu = int(row.get("estimated_antutu", row.get("antutu_score", 300000)) or 300000)
    ram = row.get("ram_gb", 8)
    rom = row.get("rom_gb", 128)
    best_shop = row.get("best_retailer", "Đại lý")
    savings = int(row.get("savings_amount", 0) or 0)

    for priority in priorities:
        if priority == "gaming":
            reasons.append(
                f"Sức mạnh từ chip {chip} ({antutu:,} điểm AnTuTu), "
                f"RAM {ram}GB và màn hình {row.get('refresh_rate_hz', 60)}Hz cho trải nghiệm gaming mượt mà."
            )
        elif priority == "camera":
            ois_val = row.get("has_ois", 0)
            ois_text = "có chống rung OIS" if str(ois_val) in ["1", "1.0", "True", "true"] else "chống rung điện tử"
            zoom = row.get("optical_zoom_x", 0)
            zoom_text = f", zoom quang {zoom}x" if zoom > 0 else ""
            reasons.append(
                f"Cụm camera chính {row.get('main_camera_mp', 50)}MP ({ois_text}{zoom_text}) "
                f"kết hợp bộ nhớ {rom}GB tha hồ lưu trữ ảnh/video 4K."
            )
        elif priority == "battery":
            reasons.append(
                f"Viên pin lớn {row.get('battery_mah', 5000)}mAh đi kèm sạc nhanh {row.get('charging_w', 25)}W đáp ứng cả ngày dài."
            )
        elif priority == "display":
            reasons.append(
                f"Màn hình {row.get('display_type', 'AMOLED')} độ phân giải cao {row.get('resolution_width', 1080)}x{row.get('resolution_height', 2400)}px, tần số quét {row.get('refresh_rate_hz', 60)}Hz."
            )
        elif priority == "thin_light":
            reasons.append(
                f"Thiết kế thanh thoát trọng lượng {row.get('weight_g', 190)}g, độ mỏng {row.get('thickness_mm', 8.0)}mm cầm rất đầm tay."
            )

    if savings > 0 and best_shop:
        reasons.append(f"💰 Mua tại {best_shop} đang có giá tốt nhất (rẻ hơn mặt bằng chung {savings:,} đ).")

    return " ".join(reasons)


def get_buying_advice(variant_id):
    """
    Truy vấn bảng giá chi tiết của toàn bộ 6 nhà bán lẻ cho 1 phiên bản SKU.
    """
    retailer_df = load_retailer_prices()
    if retailer_df.empty or "variant_id" not in retailer_df.columns:
        return []

    stores_data = retailer_df[retailer_df["variant_id"] == variant_id].copy()
    if stores_data.empty:
        return []

    stores_data = stores_data[pd.to_numeric(stores_data["price"], errors="coerce").fillna(0) > 0].copy()
    if stores_data.empty:
        return []

    in_stock = stores_data[stores_data["stock_status"].astype(str).str.lower().eq("in_stock")]
    if not in_stock.empty:
        stores_data = in_stock

    median_price = stores_data["price"].median()
    clean_data = stores_data[
        (stores_data["price"] >= median_price * 0.60)
        & (stores_data["price"] <= median_price * 1.80)
    ].copy()
    if not clean_data.empty:
        stores_data = clean_data

    stores_data = stores_data.sort_values(by=["price"], ascending=True)
    results = []
    for _, row in stores_data.iterrows():
        results.append({
            "retailer": row.get("retailer", "Cửa hàng"),
            "price": int(row.get("price", 0)),
            "stock_status": row.get("stock_status", "in_stock"),
            "condition": row.get("condition_type", row.get("condition", "new")),
            "product_url": row.get("product_url", "#")
        })
    return results


def extract_base_model_id(device_id):
    """
    Chuẩn hóa device_id để nhận diện chính xác dòng máy gốc (loại bỏ hậu tố tình trạng máy cũ).
    Ví dụ: apple_iphone_15_pro_max_c_p -> apple_iphone_15_pro_max
    """
    dev_str = str(device_id).lower()
    # Cắt bỏ các hậu tố máy cũ
    suffixes = [
        "_c_p", "_c_tr_y_x_c", "_c_x_c_c_n", "_k_ch_ho_t",
        "_cu_dep", "_cu_tray_xuoc", "_cu_xuoc_can", "_da_kich_hoat"
    ]
    for s in suffixes:
        if s in dev_str:
            dev_str = dev_str.split(s)[0]
    return dev_str


def recommend(
    min_budget=0.0,
    max_budget=50.0,
    condition="new",
    priorities=None,
    top_n=3,
    min_year=2021,
    brand=None,
    has_5g=None,
    has_ip68=None,
    enable_relaxation=True,
    brand_diversity=False
):
    """
    Hệ thống gợi ý đa tiêu chí 6 tầng (Phone DSS Engine):
    1. Lọc theo min_price thực tế của 6 nhà bán lẻ (kèm biên nới lỏng ±7%).
    2. Chấm điểm MCDA toàn diện.
    3. Bộ chọn bản RAM/ROM thông minh theo nhu cầu.
    4. Ràng buộc đa dạng hóa: Đảm bảo Top 1, Top 2, Top 3 là 3 MẪU MÁY KHÁC NHAU.
    5. Xuất kèm Nơi mua rẻ nhất + Link so sánh 6 nhà bán lẻ.
    """
    if priorities is None:
        priorities = ["gaming"]

    df = load_data()
    df = add_price_data(df, condition)

    min_vnd = min_budget * 1000000.0
    max_vnd = max_budget * 1000000.0

    # Lọc thương hiệu nếu có yêu cầu
    if brand and brand != "Tất cả hãng":
        df = df[df["brand"].str.lower() == brand.lower()].copy()

    # Lọc 5G nếu có
    if has_5g and "has_5g" in df.columns:
        df = df[df["has_5g"] == 1].copy()

    # Lọc chống nước nếu có
    if has_ip68 and "ip_rating" in df.columns:
        df = df[df["ip_rating"].astype(str).str.contains("68|67", case=False, na=False)].copy()

    # Lọc năm ra mắt
    if min_year and "release_year" in df.columns:
        df = df[df["release_year"] >= min_year].copy()

    # Lọc giá ngân sách chính xác
    filtered = df[(df["price"] >= min_vnd) & (df["price"] <= max_vnd)].copy()

    # Smart Budget Relaxation: Nếu không tìm thấy máy, nới biên ±7%
    if filtered.empty and enable_relaxation:
        margin_min = min_vnd * 0.93
        margin_max = max_vnd * 1.07
        filtered = df[(df["price"] >= margin_min) & (df["price"] <= margin_max)].copy()

    if filtered.empty:
        return pd.DataFrame()

    # Tính điểm tổng kết
    filtered["final_score"] = filtered.apply(
        lambda r: calculate_final_score(r, priorities),
        axis=1
    )

    # Thêm cột base_model_id để chống trùng lặp tuyệt đối
    filtered["base_model_id"] = filtered["device_id"].apply(extract_base_model_id)

    # TẦNG 4: SMART VARIANT SELECTION & DEVICE DIVERSITY CONSTRAINT
    # Đảm bảo mỗi base_model_id chỉ chọn ra 1 phiên bản SKU tối ưu nhất
    primary_prio = priorities[0] if priorities else "gaming"

    def select_best_variant_for_device(group):
        if primary_prio == "gaming":
            # Ưu tiên RAM cao nhất, nếu bằng thì điểm final_score cao nhất
            return group.sort_values(by=["ram_gb", "final_score", "price"], ascending=[False, False, True]).iloc[0]
        elif primary_prio == "camera":
            # Ưu tiên ROM cao nhất để lưu ảnh, sau đó đến điểm final_score
            return group.sort_values(by=["rom_gb", "final_score", "price"], ascending=[False, False, True]).iloc[0]
        elif primary_prio == "thin_light":
            # Ưu tiên giá rẻ hơn trong cùng mẫu máy
            return group.sort_values(by=["final_score", "price"], ascending=[False, True]).iloc[0]
        else:
            # Mặc định: Điểm final_score cao nhất
            return group.sort_values(by=["final_score", "price"], ascending=[False, True]).iloc[0]

    selected_rows = [
        select_best_variant_for_device(group)
        for _, group in filtered.groupby("base_model_id", sort=False)
    ]
    unique_devices = pd.DataFrame(selected_rows).reset_index(drop=True)

    # Sắp xếp Top máy theo điểm cuối cùng
    unique_devices = unique_devices.sort_values("final_score", ascending=False).reset_index(drop=True)

    if brand_diversity:
        # Giữ lại máy điểm cao nhất của mỗi thương hiệu (không trùng hãng trong Top)
        top_by_brand = unique_devices.drop_duplicates(subset=["brand"]).copy()
        top_results = top_by_brand.head(top_n).copy()
    else:
        top_results = unique_devices.head(top_n).copy()

    # Tạo lý do đề xuất
    top_results["reason"] = top_results.apply(
        lambda r: generate_reason(r, priorities),
        axis=1
    )

    return top_results
