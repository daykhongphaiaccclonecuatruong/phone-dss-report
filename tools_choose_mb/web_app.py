import html
import os
import sys

import pandas as pd
import streamlit as st

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from recommender import (
    add_price_data,
    calculate_final_score,
    extract_base_model_id,
    get_buying_advice,
    load_data,
    recommend,
)


NO_BRAND = "Không khóa hãng"
PRIORITY_LABELS = {
    "gaming": "Gaming / hiệu năng",
    "camera": "Camera",
    "battery": "Pin",
    "display": "Màn hình",
    "thin_light": "Mỏng nhẹ",
}
PRIORITY_HINTS = {
    "gaming": "Chip, điểm AnTuTu, RAM và tần số quét",
    "camera": "MP, OIS, zoom quang và bộ nhớ lưu trữ",
    "battery": "Dung lượng pin và công suất sạc nhanh",
    "display": "Tấm nền, độ phân giải và tần số quét",
    "thin_light": "Trọng lượng và độ mỏng thân máy",
}
CONDITION_LABELS = {
    "new": "Máy mới",
    "used": "Máy cũ",
}
YEAR_OPTIONS = [2024, 2023, 2022, 2021, 2020, 0]

st.set_page_config(
    page_title="Phone DSS - Hỗ trợ chọn điện thoại",
    page_icon="📱",
    layout="wide",
    initial_sidebar_state="expanded",
)


def escape(value):
    if value is None or pd.isna(value):
        return ""
    return html.escape(str(value), quote=True)


def format_price(value):
    value = 0 if value is None or pd.isna(value) else int(value)
    return f"{value:,} đ".replace(",", ".")


def clean_device_name(brand, device_name):
    brand = str(brand or "").strip()
    device_name = str(device_name or "").strip()
    if brand and device_name.lower().startswith(brand.lower()):
        return device_name
    return f"{brand} {device_name}".strip()


def get_secondary_options(primary_priority):
    return [item for item in PRIORITY_LABELS if item != primary_priority]


def resolve_secondary_priority(primary_priority, current_secondary):
    options = get_secondary_options(primary_priority)
    return current_secondary if current_secondary in options else options[0]


def format_min_year(value):
    return f"{value} trở lên" if value else "Tất cả năm"


def format_variant_detail(row):
    variant = str(row.get("variant_name", "Phiên bản tiêu chuẩn") or "Phiên bản tiêu chuẩn")
    variant_id = str(row.get("variant_id", "") or "").lower()
    tags = []
    if "_5g_" in variant_id:
        tags.append("5G")
    elif "_4g_" in variant_id:
        tags.append("4G")
    if "k_ch_ho_t" in variant_id or "da_kich_hoat" in variant_id:
        tags.append("đã kích hoạt")
    return " · ".join([variant] + tags)


def has_column(df, column):
    return column in df.columns


def score_bar(label, value, color="#0f766e"):
    value = max(0, min(float(value or 0), 100))
    return f"""
    <div class="score-line">
        <div class="score-line-head"><span>{escape(label)}</span><strong>{value:.1f}</strong></div>
        <div class="score-track"><span style="width:{value:.1f}%; background:{color};"></span></div>
    </div>
    """


def score_breakdown(row):
    return {
        "Gaming": row.get("gaming_score", 0),
        "Camera": row.get("camera_score", 0),
        "Pin": row.get("battery_score", 0),
        "Màn hình": row.get("display_score", 0),
        "Mỏng nhẹ": row.get("thin_light_score", 0),
        "Đáng tiền": row.get("value_score", 0),
    }


@st.cache_data(show_spinner=False)
def load_base_data():
    return load_data()


@st.cache_data(show_spinner=False)
def load_condition_data(condition):
    return add_price_data(load_data(), condition)


@st.cache_data(show_spinner=False)
def load_summary():
    base = load_base_data()
    new_data = load_condition_data("new")
    used_data = load_condition_data("used")
    retailer_path = os.path.join(CURRENT_DIR, "data", "05_device_retailer_prices.csv")
    agg_path = os.path.join(CURRENT_DIR, "data", "05_device_aggregated_prices.csv")
    retailer_rows = len(pd.read_csv(retailer_path)) if os.path.exists(retailer_path) else 0
    agg_rows = len(pd.read_csv(agg_path)) if os.path.exists(agg_path) else 0

    return {
        "devices": base["device_id"].nunique(),
        "variants": base["variant_id"].nunique(),
        "brands": base["brand"].nunique(),
        "new_options": len(new_data),
        "used_options": len(used_data),
        "retailer_rows": retailer_rows,
        "agg_rows": agg_rows,
        "max_year": int(base["release_year"].max()),
    }


def ensure_dss_state_defaults(brand_options):
    defaults = {
        "dss_budget": (7.0, 15.0),
        "dss_condition": "new",
        "dss_brand": NO_BRAND,
        "dss_primary": "gaming",
        "dss_add_second": True,
        "dss_secondary": "camera",
        "dss_min_year": 2021,
        "dss_top_n": 3,
        "needs_popup_done": False,
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)

    if st.session_state.dss_brand not in brand_options:
        st.session_state.dss_brand = NO_BRAND
    if st.session_state.dss_primary not in PRIORITY_LABELS:
        st.session_state.dss_primary = "gaming"
    st.session_state.dss_secondary = resolve_secondary_priority(
        st.session_state.dss_primary,
        st.session_state.dss_secondary,
    )
    if st.session_state.dss_min_year not in YEAR_OPTIONS:
        st.session_state.dss_min_year = 2021


@st.dialog("Chọn nhu cầu mong muốn", width="small")
def show_needs_popup(brand_options):
    st.markdown("Chọn nhanh nhu cầu ban đầu để hệ thống tự chấm điểm và đề xuất máy phù hợp.")

    popup_budget = st.slider(
        "Ngân sách (triệu đồng)",
        min_value=1.0,
        max_value=50.0,
        value=st.session_state.dss_budget,
        step=0.5,
        key="popup_budget",
    )
    popup_condition = st.radio(
        "Tình trạng máy",
        options=["new", "used"],
        index=["new", "used"].index(st.session_state.dss_condition),
        format_func=lambda item: CONDITION_LABELS[item],
        horizontal=True,
        key="popup_condition",
    )
    popup_brand = st.selectbox(
        "Hãng muốn ưu tiên",
        options=brand_options,
        index=brand_options.index(st.session_state.dss_brand),
        key="popup_brand",
    )
    popup_primary = st.selectbox(
        "Nhu cầu chính",
        options=list(PRIORITY_LABELS.keys()),
        index=list(PRIORITY_LABELS.keys()).index(st.session_state.dss_primary),
        format_func=lambda item: PRIORITY_LABELS[item],
        key="popup_primary",
    )
    popup_add_second = st.checkbox(
        "Thêm nhu cầu phụ",
        value=st.session_state.dss_add_second,
        key="popup_add_second",
    )

    popup_secondary = resolve_secondary_priority(popup_primary, st.session_state.dss_secondary)
    if popup_add_second:
        secondary_options = get_secondary_options(popup_primary)
        popup_secondary_key = f"popup_secondary_{popup_primary}"
        if st.session_state.get(popup_secondary_key) not in secondary_options:
            st.session_state[popup_secondary_key] = popup_secondary
        popup_secondary = st.selectbox(
            "Nhu cầu phụ",
            options=secondary_options,
            index=secondary_options.index(st.session_state[popup_secondary_key]),
            format_func=lambda item: PRIORITY_LABELS[item],
            key=popup_secondary_key,
        )

    popup_min_year = st.selectbox(
        "Ra mắt từ năm",
        options=YEAR_OPTIONS,
        index=YEAR_OPTIONS.index(st.session_state.dss_min_year),
        format_func=format_min_year,
        key="popup_min_year",
        help="Ví dụ chọn 2020 nghĩa là giữ các máy ra mắt từ 2020 trở lên, nên máy 2025/2026 vẫn được xét.",
    )

    submitted = st.button("Xem gợi ý phù hợp", type="primary", use_container_width=True)

    if submitted:
        st.session_state.dss_budget = popup_budget
        st.session_state.dss_condition = popup_condition
        st.session_state.dss_brand = popup_brand
        st.session_state.dss_primary = popup_primary
        st.session_state.dss_add_second = popup_add_second
        st.session_state.dss_secondary = resolve_secondary_priority(popup_primary, popup_secondary)
        st.session_state.dss_min_year = popup_min_year
        st.session_state.needs_popup_done = True
        st.rerun()


def build_decision_context(condition, budget, brand, min_year, need_5g, priorities):
    df = load_condition_data(condition).copy()
    steps = []
    steps.append(("SKU có giá", len(df), "Dữ liệu giá từ bảng tổng hợp/cửa hàng"))

    if brand:
        df = df[df["brand"].astype(str).str.lower() == brand.lower()].copy()
        steps.append((f"Sau khóa hãng {brand}", len(df), "Chỉ xét các máy thuộc hãng người dùng chọn"))
    else:
        steps.append(("Không khóa hãng", len(df), "So sánh tự do giữa nhiều thương hiệu"))

    if min_year:
        df = df[df["release_year"] >= min_year].copy()
        steps.append((f"Ra mắt từ {min_year} trở lên", len(df), "Giữ lại các mẫu ra mắt từ năm đã chọn trở lên"))

    if need_5g and has_column(df, "has_5g"):
        df = df[df["has_5g"] == 1].copy()
        steps.append(("Có 5G", len(df), "Giữ lại máy hỗ trợ 5G"))

    min_vnd = budget[0] * 1000000
    max_vnd = budget[1] * 1000000
    budget_df = df[(df["price"] >= min_vnd) & (df["price"] <= max_vnd)].copy()
    relaxed = False
    if budget_df.empty:
        budget_df = df[(df["price"] >= min_vnd * 0.93) & (df["price"] <= max_vnd * 1.07)].copy()
        relaxed = not budget_df.empty

    step_name = "Trong ngân sách" if not relaxed else "Trong ngân sách nới ±7%"
    steps.append((step_name, len(budget_df), "Ứng viên đủ điều kiện để chấm điểm"))

    if not budget_df.empty:
        budget_df["final_score"] = budget_df.apply(lambda row: calculate_final_score(row, priorities), axis=1)
        budget_df["base_model_id"] = budget_df["device_id"].apply(extract_base_model_id)
        steps.append(("Mẫu máy sau gộp SKU", budget_df["base_model_id"].nunique(), "Mỗi mẫu chỉ giữ cấu hình tối ưu"))

    return budget_df, steps, relaxed


def render_funnel(steps):
    columns = st.columns(len(steps))
    for col, (title, count, caption) in zip(columns, steps):
        with col:
            st.markdown(
                f"""
                <div class="funnel-card">
                    <div class="funnel-title">{escape(title)}</div>
                    <div class="funnel-count">{count:,}</div>
                    <div class="funnel-caption">{escape(caption)}</div>
                </div>
                """.replace(",", "."),
                unsafe_allow_html=True,
            )


def render_formula(priorities):
    if len(priorities) == 1:
        label = PRIORITY_LABELS[priorities[0]]
        formula = "65% nhu cầu chính + 20% đáng tiền + 15% cân bằng"
        note = f"Hệ thống đang ưu tiên mạnh vào {label}, nhưng vẫn giữ yếu tố giá trị/giá và độ cân bằng."
    else:
        label = f"{PRIORITY_LABELS[priorities[0]]} + {PRIORITY_LABELS[priorities[1]]}"
        formula = "50% ưu tiên 1 + 30% ưu tiên 2 + 10% đáng tiền + 10% cân bằng"
        note = f"Hệ thống đang cân bằng hai nhu cầu: {label}."

    st.markdown(
        f"""
        <div class="formula-panel">
            <div class="formula-kicker">Công thức DSS đang dùng</div>
            <div class="formula-main">{escape(formula)}</div>
            <div class="formula-note">{escape(note)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_product_card(row, rank, condition):
    name = clean_device_name(row.get("brand"), row.get("device_name"))
    variant = format_variant_detail(row)
    image_url = str(row.get("image_url", "") or "")
    price = format_price(row.get("price", 0))
    final_score = float(row.get("final_score", 0) or 0)
    best_retailer = row.get("best_retailer", "Đại lý")
    title_badge = f"Top {rank}"

    with st.container(border=True):
        col_img, col_info = st.columns([1.05, 2.7], gap="medium", vertical_alignment="top")
        with col_img:
            if image_url.startswith("http"):
                st.image(image_url, width="stretch")
            else:
                st.markdown("<div class='empty-image'>Không có ảnh</div>", unsafe_allow_html=True)

        with col_info:
            st.markdown(
                f"""
                <div class="result-head">
                    <div>
                        <span class="result-badge">{escape(title_badge)}</span>
                        <h3>{escape(name)}</h3>
                        <p>{escape(variant)} · {escape(CONDITION_LABELS[condition])} · Ra mắt {escape(row.get("release_year", "N/A"))}</p>
                    </div>
                    <div class="price-box">
                        <span>Giá tham chiếu</span>
                        <strong>{escape(price)}</strong>
                        <small>{escape(best_retailer)}</small>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            m1, m2, m3 = st.columns(3)
            m1.metric("Điểm phù hợp", f"{final_score:.1f}/100")
            m2.metric("Đáng tiền", f"{float(row.get('value_score', 0) or 0):.1f}/100")
            m3.metric("AnTuTu", f"{int(row.get('estimated_antutu', row.get('antutu_score', 0)) or 0):,}".replace(",", "."))

            bars_html = "".join([
                score_bar("Điểm phù hợp tổng", row.get("final_score", 0), "#dc2626"),
                score_bar("Nhu cầu gaming", row.get("gaming_score", 0), "#2563eb"),
                score_bar("Camera", row.get("camera_score", 0), "#0f766e"),
                score_bar("Pin", row.get("battery_score", 0), "#f59e0b"),
            ])
            st.markdown(bars_html, unsafe_allow_html=True)

            st.markdown(
                f"<div class='reason-box'><strong>Vì sao hệ thống chọn máy này?</strong><br>{escape(row.get('reason', ''))}</div>",
                unsafe_allow_html=True,
            )

            advice = [
                item for item in get_buying_advice(row.get("variant_id"))
                if item.get("condition") == condition
            ]
            if advice:
                best = advice[0]
                url = best.get("product_url", "")
                if isinstance(url, str) and url.startswith("http"):
                    st.markdown(
                        f"<a class='buy-link' href='{escape(url)}' target='_blank'>Xem giá tại {escape(best.get('retailer'))}</a>",
                        unsafe_allow_html=True,
                    )

            with st.expander("Xem ma trận điểm và bảng giá"):
                score_table = pd.DataFrame(
                    [{"Tiêu chí": key, "Điểm": round(float(value or 0), 2)} for key, value in score_breakdown(row).items()]
                )
                st.dataframe(score_table, hide_index=True, width="stretch")

                if advice:
                    price_table = pd.DataFrame(advice)
                    price_table = price_table.rename(columns={
                        "retailer": "Cửa hàng",
                        "price": "Giá",
                        "stock_status": "Tình trạng",
                        "condition": "Loại máy",
                        "product_url": "Link",
                    })
                    price_table["Giá"] = price_table["Giá"].apply(format_price)
                    st.dataframe(price_table[["Cửa hàng", "Loại máy", "Giá", "Tình trạng", "Link"]], hide_index=True, width="stretch")


def render_catalog():
    st.markdown("<h2>Catalog tham khảo</h2>", unsafe_allow_html=True)
    st.caption("Phần này giống web bán hàng để tra cứu sản phẩm. Kết luận nên lấy ở khu vực DSS phía trên.")

    catalog = load_condition_data("new").copy()
    catalog["base_model_id"] = catalog["device_id"].apply(extract_base_model_id)
    catalog = catalog.sort_values(["price", "release_year"], ascending=[True, False])
    catalog = catalog.drop_duplicates("base_model_id")

    control_cols = st.columns([1.2, 1, 1])
    search = control_cols[0].text_input("Tìm nhanh trong catalog", placeholder="iPhone, Samsung, Redmi...")
    brand_list = ["Tất cả hãng"] + sorted(catalog["brand"].dropna().unique().tolist())
    brand = control_cols[1].selectbox("Hãng", brand_list)
    segment = control_cols[2].selectbox("Khoảng giá", ["Tất cả", "Dưới 5 triệu", "5 - 10 triệu", "10 - 15 triệu", "Trên 15 triệu"])

    if search:
        catalog = catalog[
            catalog["device_name"].str.contains(search, case=False, na=False)
            | catalog["brand"].str.contains(search, case=False, na=False)
        ]
    if brand != "Tất cả hãng":
        catalog = catalog[catalog["brand"] == brand]
    if segment == "Dưới 5 triệu":
        catalog = catalog[catalog["price"] < 5000000]
    elif segment == "5 - 10 triệu":
        catalog = catalog[(catalog["price"] >= 5000000) & (catalog["price"] <= 10000000)]
    elif segment == "10 - 15 triệu":
        catalog = catalog[(catalog["price"] >= 10000000) & (catalog["price"] <= 15000000)]
    elif segment == "Trên 15 triệu":
        catalog = catalog[catalog["price"] > 15000000]

    if catalog.empty:
        st.info("Không có sản phẩm phù hợp trong catalog.")
        return

    grid = catalog.head(8)
    for start in range(0, len(grid), 4):
        cols = st.columns(4)
        for col, (_, item) in zip(cols, grid.iloc[start:start + 4].iterrows()):
            with col:
                img = str(item.get("image_url", "") or "")
                name = clean_device_name(item.get("brand"), item.get("device_name"))
                image_html = f"<img src='{escape(img)}' alt='{escape(name)}'>" if img.startswith("http") else "<div class='catalog-empty'>No image</div>"
                st.markdown(
                    f"""
                    <div class="catalog-card">
                        <div class="catalog-img">{image_html}</div>
                        <div class="catalog-brand">{escape(item.get("brand"))}</div>
                        <div class="catalog-name">{escape(name)}</div>
                        <div class="catalog-price">Từ {escape(format_price(item.get("price", 0)))}</div>
                        <div class="catalog-meta">{escape(item.get("variant_name", ""))}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )


st.markdown(
    """
    <style>
    #MainMenu, header, footer,
    [data-testid="collapsedControl"],
    section[data-testid="stSidebar"] button[kind="header"] {
        visibility: hidden;
        display: none;
    }
    .stApp {
        background: #f5f7fb;
        color: #111827;
        font-family: "Segoe UI", Arial, sans-serif;
    }
    .block-container {
        max-width: 1280px;
        padding-top: 18px;
        padding-bottom: 42px;
    }
    h1, h2, h3 {
        letter-spacing: 0;
        color: #111827;
    }
    div[data-testid="stMetric"] {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px 14px;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
    }
    div[data-testid="stMetricValue"] {
        color: #111827;
        font-size: 1.35rem;
        font-weight: 850;
    }
    div[data-testid="stVerticalBlockBorderWrapper"] {
        background: #ffffff;
        border-color: #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
    }
    .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 14px 18px;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
        margin-bottom: 14px;
    }
    .brand-lockup {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.18rem;
        font-weight: 900;
    }
    .brand-mark {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        background: #dc2626;
        color: #ffffff;
        font-weight: 900;
    }
    .top-pills {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
    }
    .top-pills span {
        padding: 7px 11px;
        border-radius: 999px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        color: #374151;
        font-size: 0.86rem;
        font-weight: 750;
    }
    .hero {
        background:
            linear-gradient(120deg, rgba(17, 24, 39, 0.96), rgba(15, 118, 110, 0.92)),
            url("https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1600&q=80");
        background-size: cover;
        background-position: center;
        color: #ffffff;
        border-radius: 8px;
        min-height: 260px;
        padding: 30px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
        margin-bottom: 18px;
    }
    .hero-tag {
        width: fit-content;
        color: #ecfeff;
        background: rgba(255, 255, 255, 0.13);
        border: 1px solid rgba(255, 255, 255, 0.24);
        border-radius: 999px;
        padding: 7px 12px;
        font-weight: 850;
        font-size: 0.9rem;
        margin-bottom: 14px;
    }
    .hero h1 {
        color: #ffffff;
        max-width: 820px;
        font-size: 2.35rem;
        line-height: 1.1;
        margin: 0 0 10px;
    }
    .hero p {
        color: #e5e7eb;
        max-width: 760px;
        font-size: 1.02rem;
        line-height: 1.6;
        margin: 0;
    }
    .difference-card, .funnel-card, .formula-panel, .catalog-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
    }
    .difference-card {
        padding: 14px;
        min-height: 120px;
    }
    .difference-card strong {
        display: block;
        color: #111827;
        font-size: 1rem;
        margin-bottom: 6px;
    }
    .difference-card span {
        color: #6b7280;
        font-size: 0.92rem;
        line-height: 1.45;
    }
    .advisor-title {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 16px;
        margin: 24px 0 12px;
    }
    .advisor-title h2 {
        margin: 0;
        font-size: 1.55rem;
    }
    .advisor-title p {
        margin: 4px 0 0;
        color: #6b7280;
    }
    .mode-pill {
        color: #0f766e;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        border-radius: 999px;
        padding: 8px 12px;
        font-weight: 850;
        white-space: nowrap;
    }
    .funnel-card {
        padding: 13px;
        min-height: 132px;
    }
    .funnel-title {
        color: #374151;
        font-size: 0.82rem;
        font-weight: 850;
        min-height: 36px;
    }
    .funnel-count {
        color: #111827;
        font-size: 1.55rem;
        font-weight: 950;
        margin: 6px 0 3px;
    }
    .funnel-caption {
        color: #6b7280;
        font-size: 0.78rem;
        line-height: 1.35;
    }
    .formula-panel {
        padding: 16px;
        margin-top: 10px;
        border-left: 5px solid #0f766e;
    }
    .formula-kicker {
        color: #0f766e;
        font-size: 0.82rem;
        font-weight: 900;
        text-transform: uppercase;
    }
    .formula-main {
        color: #111827;
        font-size: 1.18rem;
        font-weight: 900;
        margin: 6px 0;
    }
    .formula-note {
        color: #6b7280;
        font-size: 0.92rem;
    }
    .result-head {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
        margin-bottom: 12px;
    }
    .result-badge {
        display: inline-flex;
        width: fit-content;
        color: #ffffff;
        background: #dc2626;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 0.78rem;
        font-weight: 900;
        margin-bottom: 8px;
    }
    .result-head h3 {
        margin: 0 0 5px;
        font-size: 1.35rem;
    }
    .result-head p {
        color: #6b7280;
        margin: 0;
    }
    .price-box {
        min-width: 190px;
        background: #fff7ed;
        border: 1px solid #fed7aa;
        border-radius: 8px;
        padding: 11px 12px;
        text-align: right;
    }
    .price-box span, .price-box small {
        display: block;
        color: #9a3412;
        font-weight: 750;
        font-size: 0.8rem;
    }
    .price-box strong {
        display: block;
        color: #dc2626;
        font-size: 1.3rem;
        font-weight: 950;
        margin: 2px 0;
    }
    .empty-image {
        height: 210px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        background: #f3f4f6;
        color: #9ca3af;
        font-weight: 800;
    }
    .score-line {
        margin: 8px 0;
    }
    .score-line-head {
        display: flex;
        justify-content: space-between;
        color: #374151;
        font-size: 0.84rem;
        font-weight: 850;
        margin-bottom: 4px;
    }
    .score-track {
        height: 8px;
        background: #eef2f7;
        border-radius: 999px;
        overflow: hidden;
    }
    .score-track span {
        display: block;
        height: 100%;
        border-radius: 999px;
    }
    .reason-box {
        color: #14532d;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-left: 5px solid #16a34a;
        border-radius: 8px;
        padding: 12px 14px;
        line-height: 1.55;
        margin: 12px 0;
    }
    .buy-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #0f766e;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 8px;
        padding: 9px 13px;
        font-weight: 850;
        margin: 4px 0 8px;
    }
    .catalog-card {
        overflow: hidden;
        margin-bottom: 16px;
    }
    .catalog-img {
        height: 210px;
        background: #f9fafb;
        border-bottom: 1px solid #eef2f7;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px;
    }
    .catalog-img img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
    .catalog-brand {
        color: #0f766e;
        font-size: 0.78rem;
        font-weight: 900;
        text-transform: uppercase;
        padding: 12px 13px 0;
    }
    .catalog-name {
        color: #111827;
        font-weight: 900;
        min-height: 48px;
        padding: 5px 13px 0;
        line-height: 1.25;
    }
    .catalog-price {
        color: #dc2626;
        font-size: 1.12rem;
        font-weight: 950;
        padding: 8px 13px 0;
    }
    .catalog-meta {
        color: #6b7280;
        font-size: 0.82rem;
        padding: 7px 13px 13px;
        min-height: 44px;
    }
    @media (max-width: 800px) {
        .topbar, .result-head, .advisor-title {
            flex-direction: column;
            align-items: flex-start;
        }
        .hero {
            padding: 22px;
        }
        .hero h1 {
            font-size: 1.75rem;
        }
        .price-box {
            width: 100%;
            text-align: left;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)


summary = load_summary()
brands = sorted(load_base_data()["brand"].dropna().unique().tolist())
brand_options = [NO_BRAND] + brands
ensure_dss_state_defaults(brand_options)

if not st.session_state.needs_popup_done:
    show_needs_popup(brand_options)

st.markdown(
    """
    <div class="topbar">
        <div class="brand-lockup"><div class="brand-mark">DSS</div><div>Phone DSS Advisor</div></div>
        <div class="top-pills">
            <span>Lọc theo nhu cầu</span>
            <span>Chấm điểm MCDA</span>
            <span>Giải thích lý do</span>
            <span>So sánh giá</span>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="hero">
        <div class="hero-tag">Hệ hỗ trợ quyết định chọn điện thoại</div>
        <h1>Không chỉ lọc sản phẩm, hệ thống tự chấm điểm và đề xuất máy phù hợp nhất.</h1>
        <p>
            Người dùng nhập ngân sách, tình trạng máy và nhu cầu sử dụng. Phone DSS lọc ứng viên,
            tính điểm theo nhiều tiêu chí, chọn cấu hình tối ưu và giải thích vì sao nên chọn máy đó.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

metric_cols = st.columns(5)
metric_cols[0].metric("Mẫu máy", f"{summary['devices']:,}".replace(",", "."))
metric_cols[1].metric("Phiên bản/SKU", f"{summary['variants']:,}".replace(",", "."))
metric_cols[2].metric("Hãng", summary["brands"])
metric_cols[3].metric("Dòng giá cửa hàng", f"{summary['retailer_rows']:,}".replace(",", "."))
metric_cols[4].metric("Giá tổng hợp", f"{summary['agg_rows']:,}".replace(",", "."))

st.markdown('<div class="advisor-title"><div><h2>Điểm khác biệt so với web bán hàng thường</h2><p>Phần này dùng để trình bày với giáo viên: DSS không chỉ lọc hãng/giá, mà có quy trình ra quyết định.</p></div></div>', unsafe_allow_html=True)
diff_cols = st.columns(3)
with diff_cols[0]:
    st.markdown("<div class='difference-card'><strong>1. Người dùng mô tả nhu cầu</strong><span>Ví dụ: 7-15 triệu, máy mới, ưu tiên gaming và màn hình. Đây là đầu vào quyết định.</span></div>", unsafe_allow_html=True)
with diff_cols[1]:
    st.markdown("<div class='difference-card'><strong>2. Hệ thống chấm điểm MCDA</strong><span>Mỗi máy được tính điểm gaming, camera, pin, màn hình, mỏng nhẹ và đáng tiền.</span></div>", unsafe_allow_html=True)
with diff_cols[2]:
    st.markdown("<div class='difference-card'><strong>3. Trả kết luận có giải thích</strong><span>Kết quả không chỉ là danh sách sản phẩm, mà là đề xuất kèm lý do và bảng điểm.</span></div>", unsafe_allow_html=True)

st.markdown('<div class="advisor-title"><div><h2>Trợ lý chọn máy theo yêu cầu</h2><p>Nhập nhu cầu, hệ thống sẽ tự lọc ứng viên và chấm điểm phù hợp.</p></div></div>', unsafe_allow_html=True)
popup_button_cols = st.columns([4, 1])
with popup_button_cols[1]:
    if st.button("Chọn lại nhu cầu", use_container_width=True):
        st.session_state.needs_popup_done = False
        st.rerun()

input_col, context_col = st.columns([1, 1.65], gap="large")

with input_col:
    with st.container(border=True):
        st.subheader("Bước 1: Nhập yêu cầu")
        budget = st.slider(
            "Khoảng ngân sách (triệu đồng)",
            min_value=1.0,
            max_value=50.0,
            step=0.5,
            key="dss_budget",
        )
        condition = st.radio(
            "Tình trạng máy",
            options=["new", "used"],
            format_func=lambda item: CONDITION_LABELS[item],
            horizontal=True,
            key="dss_condition",
        )
        brand_choice = st.selectbox(
            "Thương hiệu",
            options=brand_options,
            help="Nếu chọn một hãng, DSS sẽ lọc trong hãng đó rồi vẫn xếp hạng Top theo nhu cầu.",
            key="dss_brand",
        )
        selected_brand = None if brand_choice == NO_BRAND else brand_choice

        primary_priority = st.selectbox(
            "Nhu cầu quan trọng nhất",
            options=list(PRIORITY_LABELS.keys()),
            format_func=lambda item: PRIORITY_LABELS[item],
            key="dss_primary",
        )
        add_second = st.checkbox("Thêm nhu cầu phụ", key="dss_add_second")
        priorities = [primary_priority]
        if add_second:
            second_options = get_secondary_options(primary_priority)
            secondary_key = f"dss_secondary_{primary_priority}"
            current_secondary = resolve_secondary_priority(primary_priority, st.session_state.dss_secondary)
            if st.session_state.get(secondary_key) not in second_options:
                st.session_state[secondary_key] = current_secondary
            second_priority = st.selectbox(
                "Nhu cầu phụ",
                options=second_options,
                index=second_options.index(st.session_state[secondary_key]),
                format_func=lambda item: PRIORITY_LABELS[item],
                key=secondary_key,
            )
            st.session_state.dss_secondary = second_priority
            priorities.append(second_priority)

        min_year = st.selectbox(
            "Ra mắt từ năm",
            options=YEAR_OPTIONS,
            format_func=format_min_year,
            help="Chọn 2020 nghĩa là lấy máy ra mắt từ 2020 trở lên, nên máy mới hơn vẫn được xét.",
            key="dss_min_year",
        )

        top_label = "Số máy muốn xếp hạng trong hãng" if selected_brand else "Số máy muốn so sánh"
        top_n = st.slider(top_label, min_value=3, max_value=6, key="dss_top_n")
        if selected_brand:
            st.info(f"Đã chọn hãng {selected_brand}. DSS sẽ lọc các máy của hãng này, chấm điểm theo nhu cầu và xếp hạng Top {top_n}.")
        else:
            st.caption("Kết quả được sắp xếp trực tiếp theo điểm phù hợp DSS.")
        need_5g = False
        brand_diversity = False

with context_col:
    st.subheader("Bước 2: Hệ thống xử lý")
    filtered_candidates, decision_steps, relaxed_budget = build_decision_context(
        condition=condition,
        budget=budget,
        brand=selected_brand,
        min_year=min_year if min_year else None,
        need_5g=need_5g,
        priorities=priorities,
    )
    render_funnel(decision_steps)
    render_formula(priorities)
    if relaxed_budget:
        st.warning("Không có máy đúng hoàn toàn trong ngân sách, hệ thống đã nới biên ±7% để tìm phương án gần nhất.")

with st.spinner("Đang chạy thuật toán DSS..."):
    results = recommend(
        min_budget=budget[0],
        max_budget=budget[1],
        condition=condition,
        priorities=priorities,
        top_n=top_n,
        min_year=min_year if min_year else None,
        brand=selected_brand,
        has_5g=need_5g if need_5g else None,
        has_ip68=None,
        brand_diversity=brand_diversity,
    )

mode_label = (
    f"Top {len(results)} máy {selected_brand} phù hợp nhất"
    if selected_brand
    else f"Top {len(results)} máy phù hợp nhất"
)
st.markdown(
    f"""
    <div class="advisor-title">
        <div>
            <h2>Bước 3: Kết quả đề xuất DSS</h2>
            <p>{escape(CONDITION_LABELS[condition])} · {budget[0]:g}-{budget[1]:g} triệu · {escape(" + ".join(PRIORITY_LABELS[item] for item in priorities))}</p>
        </div>
        <div class="mode-pill">{escape(mode_label)}</div>
    </div>
    """,
    unsafe_allow_html=True,
)

if results.empty:
    st.warning("Không tìm thấy máy phù hợp với các điều kiện hiện tại. Hãy nới ngân sách, bỏ khóa hãng hoặc giảm năm ra mắt tối thiểu.")
else:
    for rank, (_, row) in enumerate(results.iterrows(), start=1):
        render_product_card(row, rank, condition)

st.divider()
tab_report, tab_catalog, tab_data = st.tabs(["Giải thích báo cáo", "Catalog tham khảo", "Dữ liệu kiểm tra"])

with tab_report:
    st.subheader("Luận điểm thuyết trình")
    st.write(
        "Phone DSS là hệ hỗ trợ quyết định vì người dùng không tự lọc thủ công rồi tự chọn máy. "
        "Hệ thống nhận yêu cầu, lọc ứng viên, tính điểm đa tiêu chí, xếp hạng hoặc chọn một máy tốt nhất, "
        "sau đó giải thích bằng điểm số và thông số."
    )
    st.write(
        "Khi không khóa hãng, hệ thống hiển thị Top N để người dùng so sánh nhiều lựa chọn. "
        "Khi chọn một hãng, hệ thống chỉ xét các máy thuộc hãng đó rồi vẫn chấm điểm và xếp hạng Top nhiều máy theo đúng nhu cầu người dùng."
    )
    st.write(
        "Giá được lấy từ bảng tổng hợp cửa hàng. Hệ thống đã có bước bỏ giá quá thấp bất thường để tránh trường hợp dữ liệu crawl sai làm lệch kết quả."
    )

with tab_catalog:
    render_catalog()

with tab_data:
    st.subheader("Dữ liệu đang dùng")
    data_table = pd.DataFrame([
        {"Bảng": "01_devices.csv", "Số dòng": summary["devices"], "Vai trò": "Danh sách mẫu máy"},
        {"Bảng": "03_device_variants.csv", "Số dòng": summary["variants"], "Vai trò": "Phiên bản RAM/ROM"},
        {"Bảng": "05_device_retailer_prices.csv", "Số dòng": summary["retailer_rows"], "Vai trò": "Giá từ từng cửa hàng"},
        {"Bảng": "05_device_aggregated_prices.csv", "Số dòng": summary["agg_rows"], "Vai trò": "Giá tổng hợp để DSS lọc ngân sách"},
    ])
    st.dataframe(data_table, hide_index=True, width="stretch")
    if not results.empty:
        export = results.copy()
        export["Tên máy"] = export.apply(lambda row: clean_device_name(row.get("brand"), row.get("device_name")), axis=1)
        export["Giá"] = export["price"].apply(format_price)
        st.subheader("Kết quả hiện tại")
        st.dataframe(
            export[[
                "Tên máy", "variant_name", "Giá", "best_retailer",
                "final_score", "gaming_score", "camera_score", "battery_score",
                "display_score", "thin_light_score", "value_score",
            ]],
            hide_index=True,
            width="stretch",
        )
