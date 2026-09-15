import os
import pandas as pd
from scoring import calculate_all_scores


def load_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")

    devices_path = os.path.join(data_dir, "01_devices.csv")
    specs_path = os.path.join(data_dir, "02_device_specs.csv")
    variants_path = os.path.join(data_dir, "03_device_variants.csv")
    benchmarks_path = os.path.join(data_dir, "04_device_benchmarks.csv")

    if os.path.exists(devices_path) and os.path.exists(variants_path):
        # NEW 4-TABLE SYSTEM
        devices = pd.read_csv(devices_path)
        specs = pd.read_csv(specs_path)
        variants = pd.read_csv(variants_path)
        benchmarks = pd.read_csv(benchmarks_path)

        # Merge Device + Specs + Benchmarks
        data = devices.merge(specs, on="device_id", how="inner")
        data = data.merge(benchmarks, on="device_id", how="inner")

        # Merge with Variants (Parent-Child)
        data = data.merge(variants, on="device_id", how="inner")

        # Calculate scores for each variant
        score_data = data.apply(
            lambda row: pd.Series(calculate_all_scores(row)),
            axis=1
        )
        data = pd.concat([data, score_data], axis=1)
        return data
    else:
        # FALLBACK TO LEGACY DATA
        catalog = pd.read_csv(os.path.join(data_dir, "01_product_catalog.csv"))
        specs = pd.read_csv(os.path.join(data_dir, "02_specs.csv"))
        benchmark = pd.read_csv(os.path.join(data_dir, "03_chipset_benchmark.csv"))

        data = catalog.merge(specs, on="product_id", how="inner")
        data = data.merge(
            benchmark,
            left_on="chipset",
            right_on="chipset_name",
            how="left"
        )
        score_data = data.apply(
            lambda row: pd.Series(calculate_all_scores(row)),
            axis=1
        )
        data = pd.concat([data, score_data], axis=1)
        return data


def calculate_balanced_score(row):
    return (
        row["camera_score"]
        + row["gaming_score"]
        + row["battery_score"]
        + row["display_score"]
        + row["thin_light_score"]
    ) / 5.0


def calculate_new_value_score(row):
    price_million = row["price"] / 1000000.0

    if price_million <= 0:
        return 0

    raw_value = row["balanced_score"] / price_million
    # 12 điểm hiệu năng / 1 triệu VNĐ là mức tham chiếu xuất sắc
    value_score = (raw_value / 12.0) * 100.0

    return round(min(value_score, 100.0), 2)


def calculate_used_condition_score(row):
    battery_score = row.get("battery_health_percent", 90)

    exterior_mapping = {
        "brand-new": 100,
        "like-new": 100,
        "good": 80,
        "fair": 60
    }

    exterior_score = exterior_mapping.get(
        row.get("exterior_condition", "good"),
        70
    )

    warranty_score = (
        100
        if str(row.get("warranty_status", "")).lower() == "yes"
        else 0
    )

    score = (
        battery_score * 0.50
        + exterior_score * 0.30
        + warranty_score * 0.20
    )

    return round(score, 2)


def add_price_data(data, condition="new"):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    prices_path = os.path.join(data_dir, "05_device_prices.csv")

    if os.path.exists(prices_path) and "variant_id" in data.columns:
        prices = pd.read_csv(prices_path)
        # Filter by condition (new or used)
        prices_cond = prices[prices["condition"] == condition].copy()
        prices_cond = prices_cond.drop_duplicates(subset=["variant_id"], keep="last")

        merged = data.merge(prices_cond, on="variant_id", how="inner")
        merged = merged[merged["stock_status"] == "in_stock"].copy()

        merged["balanced_score"] = merged.apply(calculate_balanced_score, axis=1)

        if condition == "new":
            merged["value_score"] = merged.apply(calculate_new_value_score, axis=1)
        else:
            merged["condition_score"] = merged.apply(calculate_used_condition_score, axis=1)
            merged["base_value_score"] = merged.apply(calculate_new_value_score, axis=1)
            merged["value_score"] = (
                merged["base_value_score"] * 0.65
                + merged["condition_score"] * 0.35
            )
        return merged
    else:
        # Legacy price handling
        if condition == "new":
            prices = pd.read_csv(os.path.join(data_dir, "04a_price_new.csv"))
            data = data.merge(prices, on="product_id", how="inner")
            data = data[data["stock_status"] == "in_stock"].copy()
            data["balanced_score"] = data.apply(calculate_balanced_score, axis=1)
            data["value_score"] = data.apply(calculate_new_value_score, axis=1)
        else:
            prices = pd.read_csv(os.path.join(data_dir, "04b_price_used.csv"))
            data = data.merge(prices, on="product_id", how="inner")
            data["balanced_score"] = data.apply(calculate_balanced_score, axis=1)
            data["condition_score"] = data.apply(calculate_used_condition_score, axis=1)
            data["base_value_score"] = data.apply(calculate_new_value_score, axis=1)
            data["value_score"] = (
                data["base_value_score"] * 0.65
                + data["condition_score"] * 0.35
            )
        return data


def calculate_final_score(row, priorities):
    score_mapping = {
        "camera": row["camera_score"],
        "gaming": row["gaming_score"],
        "battery": row["battery_score"],
        "display": row["display_score"],
        "thin_light": row["thin_light_score"]
    }

    if len(priorities) == 1:
        priority_score = score_mapping.get(priorities[0], row["balanced_score"])
        final_score = (
            priority_score * 0.65
            + row["value_score"] * 0.20
            + row["balanced_score"] * 0.15
        )
    else:
        priority_1 = score_mapping.get(priorities[0], row["balanced_score"])
        priority_2 = score_mapping.get(priorities[1], row["balanced_score"])
        final_score = (
            priority_1 * 0.50
            + priority_2 * 0.30
            + row["value_score"] * 0.10
            + row["balanced_score"] * 0.10
        )

    return round(final_score, 2)


def generate_reason(row, priorities):
    reasons = []

    for priority in priorities:
        if priority == "gaming":
            antutu = int(row.get("estimated_antutu", row.get("antutu_score", row.get("antutu_base", 300000))))
            chip = row.get("chipset", "Standard SoC")
            reasons.append(
                f"Chip {chip} có AnTuTu {antutu:,} điểm, "
                f"RAM {row.get('ram_gb', 8)}GB và màn hình {row.get('refresh_rate_hz', 60)}Hz."
            )

        elif priority == "camera":
            ois_val = row.get("has_ois", row.get("ois", 0))
            ois_text = "có chống rung OIS" if ois_val == 1 else "không OIS"
            zoom = row.get("optical_zoom_x", 0)
            zoom_text = f", zoom quang {zoom}x" if zoom > 0 else ""
            reasons.append(
                f"Camera chính {row.get('main_camera_mp', 50)}MP, "
                f"{ois_text}{zoom_text}, khẩu độ f/{row.get('main_camera_aperture', 1.8)}."
            )

        elif priority == "battery":
            reasons.append(
                f"Pin {row.get('battery_mah', 5000)}mAh kết hợp sạc nhanh {row.get('charging_w', 25)}W."
            )

        elif priority == "display":
            reasons.append(
                f"Màn hình {row.get('display_type', 'AMOLED')}, {row.get('refresh_rate_hz', 60)}Hz, "
                f"độ phân giải {row.get('resolution_width', 1080)}x{row.get('resolution_height', 2400)}px."
            )

        elif priority == "thin_light":
            reasons.append(
                f"Thiết kế gọn nhẹ {row.get('weight_g', 190)}g, độ mỏng {row.get('thickness_mm', 8.0)}mm."
            )

    return " ".join(reasons)


def recommend(
    min_budget,
    max_budget,
    condition="new",
    priorities=None,
    top_n=5,
    min_year=2021
):
    if priorities is None:
        priorities = ["gaming"]

    data = load_data()
    data = add_price_data(data, condition)

    min_price = min_budget * 1000000
    max_price = max_budget * 1000000

    # Filter price and minimum release year
    filter_cond = (data["price"] >= min_price) & (data["price"] <= max_price)
    if "release_year" in data.columns and min_year is not None:
        filter_cond = filter_cond & (data["release_year"] >= min_year)

    filtered = data[filter_cond].copy()

    if filtered.empty:
        return filtered

    filtered["final_score"] = filtered.apply(
        lambda row: calculate_final_score(row, priorities),
        axis=1
    )

    filtered["reason"] = filtered.apply(
        lambda row: generate_reason(row, priorities),
        axis=1
    )

    filtered = filtered.sort_values("final_score", ascending=False)
    return filtered.head(top_n)