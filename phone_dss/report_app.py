import html
import os
import sys

import pandas as pd
import streamlit as st

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from recommender import add_price_data, load_data, recommend


PRIORITY_LABELS = {
    "gaming": "Gaming / hiệu năng",
    "camera": "Camera",
    "battery": "Pin",
    "display": "Màn hình",
    "thin_light": "Mỏng nhẹ",
}

SORT_OPTIONS = {
    "Điểm phù hợp cao nhất": ("final_score", False),
    "Giá thấp đến cao": ("price", True),
    "Giá cao đến thấp": ("price", False),
    "Đáng tiền nhất": ("value_score", False),
}

st.set_page_config(
    page_title="Phone DSS Store",
    page_icon="📱",
    layout="wide",
    initial_sidebar_state="expanded",
)


def format_price(value):
    return f"{int(value):,} VNĐ".replace(",", ".")


def safe_text(value):
    if value is None or pd.isna(value):
        return ""
    return html.escape(str(value), quote=True)


def clean_device_title(brand, device_name):
    brand = str(brand or "").strip()
    device_name = str(device_name or "").strip()
    if brand and device_name.lower().startswith(brand.lower()):
        return device_name
    return f"{brand} {device_name}".strip()


def numeric_value(row, key, default=0):
    value = row.get(key, default)
    if pd.isna(value):
        return default
    return value


def clamp_score(value):
    return max(0, min(float(value), 100))


@st.cache_data(show_spinner=False)
def get_dataset_summary():
    data = load_data()
    new_data = add_price_data(data, "new")
    used_data = add_price_data(data, "used")

    return {
        "devices": data["device_id"].nunique(),
        "variants": data["variant_id"].nunique() if "variant_id" in data.columns else len(data),
        "new_options": len(new_data),
        "used_options": len(used_data),
        "brands": data["brand"].nunique() if "brand" in data.columns else 0,
        "max_year": int(data["release_year"].max()) if "release_year" in data.columns else 2026,
    }


def score_columns(row):
    return {
        "Gaming": row["gaming_score"],
        "Camera": row["camera_score"],
        "Pin": row["battery_score"],
        "Màn hình": row["display_score"],
        "Mỏng nhẹ": row["thin_light_score"],
        "Đáng tiền": row["value_score"],
    }


def build_product_card(rank, row, condition_label):
    title = clean_device_title(row.get("brand"), row.get("device_name"))
    image_url = str(row.get("image_url", "") or "")
    image_html = (
        f'<img src="{safe_text(image_url)}" alt="{safe_text(title)}">'
        if image_url.startswith("http")
        else '<div class="image-empty">No image</div>'
    )
    price = format_price(row["price"])
    final_score = clamp_score(row["final_score"])
    value_score = clamp_score(row["value_score"])
    gaming_score = clamp_score(row["gaming_score"])
    camera_score = clamp_score(row["camera_score"])
    variant = row.get("variant_name", "Tiêu chuẩn")
    ram = numeric_value(row, "ram_gb", "")
    rom = numeric_value(row, "rom_gb", "")
    battery = numeric_value(row, "battery_mah", "")
    refresh = numeric_value(row, "refresh_rate_hz", "")
    year = row.get("release_year", "N/A")

    specs = []
    if ram and rom:
        specs.append(f"{int(ram)}GB/{int(rom)}GB")
    if battery:
        specs.append(f"{int(battery)}mAh")
    if refresh:
        specs.append(f"{int(refresh)}Hz")
    specs.append(str(year))

    spec_html = "".join(f"<span>{safe_text(spec)}</span>" for spec in specs[:4])

    return f"""
    <div class="product-card">
        <div class="product-image">
            <div class="rank-badge">TOP {rank}</div>
            {image_html}
        </div>
        <div class="product-body">
            <div class="brand-line">{safe_text(row.get("brand", ""))}</div>
            <div class="product-title">{safe_text(title)}</div>
            <div class="product-subtitle">{safe_text(variant)} · {safe_text(condition_label)}</div>
            <div class="price-row">
                <span class="price">{safe_text(price)}</span>
                <span class="score-pill">{final_score:.1f}/100</span>
            </div>
            <div class="spec-list">{spec_html}</div>
            <div class="score-block">
                <div class="score-head"><span>Phù hợp</span><strong>{final_score:.1f}</strong></div>
                <div class="meter"><span style="width: {final_score:.1f}%"></span></div>
                <div class="score-head muted"><span>Đáng tiền</span><strong>{value_score:.1f}</strong></div>
                <div class="meter meter-green"><span style="width: {value_score:.1f}%"></span></div>
            </div>
            <div class="mini-scores">
                <span>Gaming {gaming_score:.0f}</span>
                <span>Camera {camera_score:.0f}</span>
            </div>
        </div>
    </div>
    """


def apply_search_and_sort(data, keyword, sort_label):
    if data.empty:
        return data

    filtered = data.copy()
    if keyword.strip():
        lowered_keyword = keyword.strip().lower()
        titles = filtered.apply(
            lambda row: clean_device_title(row.get("brand"), row.get("device_name")).lower(),
            axis=1,
        )
        filtered = filtered[titles.str.contains(lowered_keyword, regex=False)].copy()

    sort_column, ascending = SORT_OPTIONS[sort_label]
    return filtered.sort_values(sort_column, ascending=ascending)


st.markdown(
    """
    <style>
    #MainMenu, footer, header,
    [data-testid="collapsedControl"],
    section[data-testid="stSidebar"] button[kind="header"] {
        visibility: hidden;
        display: none;
    }
    .stApp {
        background: #f4f6f9;
        color: #111827;
        font-family: "Segoe UI", Arial, sans-serif;
    }
    .block-container {
        max-width: 1280px;
        padding-top: 1.2rem;
        padding-bottom: 2.5rem;
    }
    section[data-testid="stSidebar"] {
        background: #ffffff;
        border-right: 1px solid #e5e7eb;
    }
    section[data-testid="stSidebar"] h1,
    section[data-testid="stSidebar"] h2,
    section[data-testid="stSidebar"] h3 {
        color: #111827;
    }
    div[data-testid="stMetric"] {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px 14px;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
    }
    div[data-testid="stMetricValue"] {
        color: #111827;
        font-size: 1.6rem;
        font-weight: 800;
    }
    .shop-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 14px 18px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
        margin-bottom: 14px;
    }
    .shop-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 900;
        font-size: 1.25rem;
        color: #111827;
    }
    .brand-mark {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: #dc2626;
        color: #ffffff;
        display: grid;
        place-items: center;
        font-weight: 900;
    }
    .nav-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
    }
    .nav-pills span {
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        padding: 7px 11px;
        background: #f9fafb;
        color: #374151;
        font-size: 0.88rem;
        font-weight: 700;
    }
    .hero-panel {
        background: linear-gradient(120deg, #111827 0%, #1f2937 48%, #0f766e 100%);
        color: #ffffff;
        border-radius: 8px;
        padding: 28px;
        margin-bottom: 18px;
        box-shadow: 0 14px 36px rgba(15, 23, 42, 0.16);
    }
    .hero-kicker {
        display: inline-flex;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 999px;
        padding: 6px 11px;
        color: #d1fae5;
        font-size: 0.86rem;
        font-weight: 800;
        margin-bottom: 12px;
    }
    .hero-panel h1 {
        color: #ffffff;
        font-size: 2.2rem;
        line-height: 1.12;
        margin: 0 0 8px;
        letter-spacing: 0;
    }
    .hero-panel p {
        color: #e5e7eb;
        margin: 0;
        max-width: 760px;
        font-size: 1rem;
    }
    .section-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 16px;
        margin: 22px 0 12px;
    }
    .section-head h2 {
        margin: 0;
        font-size: 1.55rem;
        color: #111827;
        letter-spacing: 0;
    }
    .section-head p {
        color: #6b7280;
        margin: 4px 0 0;
        font-size: 0.95rem;
    }
    .result-count {
        color: #374151;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        padding: 7px 12px;
        font-weight: 800;
        white-space: nowrap;
    }
    .product-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
        min-height: 560px;
        margin-bottom: 10px;
    }
    .product-image {
        position: relative;
        height: 260px;
        background: #f9fafb;
        border-bottom: 1px solid #eef2f7;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
    }
    .product-image img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
    .image-empty {
        color: #9ca3af;
        font-weight: 800;
    }
    .rank-badge {
        position: absolute;
        top: 12px;
        left: 12px;
        background: #dc2626;
        color: #ffffff;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 0.78rem;
        font-weight: 900;
        box-shadow: 0 8px 18px rgba(220, 38, 38, 0.22);
    }
    .product-body {
        padding: 15px;
    }
    .brand-line {
        color: #0f766e;
        font-size: 0.78rem;
        font-weight: 900;
        text-transform: uppercase;
        margin-bottom: 5px;
    }
    .product-title {
        color: #111827;
        font-weight: 900;
        font-size: 1.08rem;
        min-height: 48px;
        line-height: 1.25;
        margin-bottom: 6px;
    }
    .product-subtitle {
        color: #6b7280;
        font-size: 0.86rem;
        min-height: 36px;
        line-height: 1.35;
        margin-bottom: 10px;
    }
    .price-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 8px 0 11px;
    }
    .price {
        color: #dc2626;
        font-size: 1.25rem;
        font-weight: 950;
        line-height: 1.1;
    }
    .score-pill {
        background: #fff7ed;
        color: #c2410c;
        border: 1px solid #fed7aa;
        border-radius: 999px;
        padding: 5px 8px;
        font-size: 0.8rem;
        font-weight: 900;
        white-space: nowrap;
    }
    .spec-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 13px;
        min-height: 58px;
    }
    .spec-list span {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        padding: 5px 8px;
        font-size: 0.8rem;
        font-weight: 750;
    }
    .score-block {
        margin-top: 4px;
    }
    .score-head {
        display: flex;
        justify-content: space-between;
        color: #111827;
        font-size: 0.84rem;
        font-weight: 850;
        margin: 7px 0 5px;
    }
    .score-head.muted {
        color: #4b5563;
    }
    .meter {
        height: 8px;
        background: #eef2f7;
        border-radius: 999px;
        overflow: hidden;
    }
    .meter span {
        display: block;
        height: 100%;
        border-radius: 999px;
        background: #2563eb;
    }
    .meter-green span {
        background: #0f766e;
    }
    .mini-scores {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 12px;
    }
    .mini-scores span {
        flex: 1;
        text-align: center;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 7px 5px;
        color: #374151;
        font-size: 0.82rem;
        font-weight: 850;
    }
    .detail-box {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 14px;
        margin: 10px 0 18px;
    }
    .formula-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        min-height: 160px;
    }
    @media (max-width: 760px) {
        .shop-topbar,
        .section-head,
        .price-row {
            align-items: flex-start;
            flex-direction: column;
        }
        .hero-panel {
            padding: 22px;
        }
        .hero-panel h1 {
            font-size: 1.65rem;
        }
        .product-card {
            min-height: auto;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

summary = get_dataset_summary()

st.markdown(
    """
    <div class="shop-topbar">
        <div class="shop-brand">
            <div class="brand-mark">DSS</div>
            <div>Phone DSS Store</div>
        </div>
        <div class="nav-pills">
            <span>Gợi ý thông minh</span>
            <span>So sánh điểm</span>
            <span>Giá tham khảo</span>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    f"""
    <div class="hero-panel">
        <div class="hero-kicker">Báo cáo hệ hỗ trợ quyết định</div>
        <h1>Chọn điện thoại phù hợp theo ngân sách và nhu cầu</h1>
        <p>
            Hệ thống chấm điểm từng sản phẩm theo camera, hiệu năng, pin, màn hình, độ gọn nhẹ
            và mức đáng tiền, sau đó xếp hạng theo ưu tiên của người dùng.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)

overview_cols = st.columns(5)
overview_cols[0].metric("Thiết bị", f"{summary['devices']:,}".replace(",", "."))
overview_cols[1].metric("Phiên bản", f"{summary['variants']:,}".replace(",", "."))
overview_cols[2].metric("Hãng", summary["brands"])
overview_cols[3].metric("Máy mới", f"{summary['new_options']:,}".replace(",", "."))
overview_cols[4].metric("Máy cũ", f"{summary['used_options']:,}".replace(",", "."))

st.session_state.setdefault("show_filter_panel", True)
st.session_state.setdefault("filter_keyword", "")
st.session_state.setdefault("filter_budget", (5.0, 10.0))
st.session_state.setdefault("filter_condition", "Máy mới")
st.session_state.setdefault("filter_priorities", ["gaming"])
st.session_state.setdefault("filter_min_year", 2021)
st.session_state.setdefault("filter_sort", "Điểm phù hợp cao nhất")
st.session_state.setdefault("filter_top_n", 6)

filter_title_col, filter_button_col = st.columns([3, 1])
with filter_title_col:
    st.markdown(
        "<div class='section-head'><div><h2>Bộ lọc gợi ý</h2><p>Ẩn/hiện bộ lọc ngay trong trang, không dùng mũi tên sidebar.</p></div></div>",
        unsafe_allow_html=True,
    )
with filter_button_col:
    button_label = "Ẩn bộ lọc" if st.session_state.show_filter_panel else "Hiện bộ lọc"
    if st.button(button_label, use_container_width=True):
        st.session_state.show_filter_panel = not st.session_state.show_filter_panel
        st.rerun()

if st.session_state.show_filter_panel:
    with st.container(border=True):
        filter_col_1, filter_col_2, filter_col_3 = st.columns(3)
        with filter_col_1:
            keyword = st.text_input(
                "Tìm hãng hoặc tên máy",
                placeholder="Samsung, iPhone, Xiaomi...",
                key="filter_keyword",
            )
            condition_label = st.radio(
                "Tình trạng",
                ["Máy mới", "Máy cũ"],
                horizontal=True,
                key="filter_condition",
            )
        with filter_col_2:
            min_budget, max_budget = st.slider(
                "Khoảng giá (triệu đồng)",
                min_value=1.0,
                max_value=35.0,
                step=0.5,
                key="filter_budget",
            )
            min_year = st.slider(
                "Đời máy từ năm",
                min_value=2018,
                max_value=max(summary["max_year"], 2026),
                step=1,
                key="filter_min_year",
            )
        with filter_col_3:
            priority_names = st.multiselect(
                "Nhu cầu ưu tiên",
                options=list(PRIORITY_LABELS.keys()),
                format_func=lambda key: PRIORITY_LABELS[key],
                max_selections=2,
                key="filter_priorities",
            )
            sort_label = st.selectbox("Sắp xếp", list(SORT_OPTIONS.keys()), key="filter_sort")
            top_n = st.slider("Số sản phẩm", min_value=3, max_value=12, key="filter_top_n")
else:
    st.info("Bộ lọc đang được ẩn. Bấm nút “Hiện bộ lọc” ở bên phải tiêu đề để mở lại.")

keyword = st.session_state.filter_keyword
min_budget, max_budget = st.session_state.filter_budget
condition_label = st.session_state.filter_condition
condition = "new" if condition_label == "Máy mới" else "used"
priority_names = st.session_state.filter_priorities
priorities = priority_names or ["gaming"]
min_year = st.session_state.filter_min_year
sort_label = st.session_state.filter_sort
top_n = st.session_state.filter_top_n

raw_results = recommend(
    min_budget=min_budget,
    max_budget=max_budget,
    condition=condition,
    priorities=priorities,
    top_n=60,
    min_year=min_year,
)
results = apply_search_and_sort(raw_results, keyword, sort_label).head(top_n)

st.markdown(
    f"""
    <div class="section-head">
        <div>
            <h2>Top điện thoại gợi ý</h2>
            <p>{safe_text(condition_label)} · {min_budget:g} - {max_budget:g} triệu · {safe_text(", ".join(PRIORITY_LABELS[p] for p in priorities))}</p>
        </div>
        <div class="result-count">{len(results)} sản phẩm</div>
    </div>
    """,
    unsafe_allow_html=True,
)

if results.empty:
    st.warning("Không có sản phẩm phù hợp. Hãy nới khoảng giá, bỏ từ khóa tìm kiếm hoặc giảm năm ra mắt tối thiểu.")
else:
    rows = [results.iloc[i : i + 3] for i in range(0, len(results), 3)]
    for row_group in rows:
        columns = st.columns(3)
        for column, (index, product) in zip(columns, row_group.iterrows()):
            with column:
                rank = list(results.index).index(index) + 1
                st.markdown(build_product_card(rank, product, condition_label), unsafe_allow_html=True)
                with st.expander("Chi tiết DSS"):
                    st.write(product["reason"])
                    detail_table = pd.DataFrame(
                        {
                            "Tiêu chí": list(score_columns(product).keys()),
                            "Điểm": [round(value, 2) for value in score_columns(product).values()],
                        }
                    )
                    st.dataframe(detail_table, hide_index=True, width="stretch")

    compare = results.head(6).copy()
    compare["Tên máy"] = compare.apply(
        lambda row: clean_device_title(row.get("brand"), row.get("device_name")),
        axis=1,
    )
    st.markdown('<div class="section-head"><div><h2>So sánh nhanh</h2><p>Điểm phù hợp của các sản phẩm đang hiển thị</p></div></div>', unsafe_allow_html=True)
    st.bar_chart(compare, x="Tên máy", y="final_score", height=280)

st.divider()

tab_formula, tab_audit, tab_data = st.tabs(["Công thức DSS", "Nhận xét logic", "Bảng dữ liệu"])

with tab_formula:
    col_one, col_two = st.columns(2)
    with col_one:
        st.markdown(
            """
            <div class="formula-card">
                <h3>Một tiêu chí ưu tiên</h3>
                <p><strong>Final score</strong> = ưu tiên 65% + đáng tiền 20% + cân bằng 15%</p>
                <p>Cách này phù hợp khi người dùng có nhu cầu rõ ràng như gaming hoặc camera.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col_two:
        st.markdown(
            """
            <div class="formula-card">
                <h3>Hai tiêu chí ưu tiên</h3>
                <p><strong>Final score</strong> = ưu tiên 1 50% + ưu tiên 2 30% + đáng tiền 10% + cân bằng 10%</p>
                <p>Cách này giúp kết quả không bị lệch quá mạnh về một thông số duy nhất.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )

with tab_audit:
    st.success("Logic lọc, merge dữ liệu, tính điểm và xếp hạng chạy ổn với cả máy mới và máy cũ.")
    st.write(
        "Điểm mạnh: công thức rõ ràng, có trọng số theo nhu cầu người dùng, mỗi kết quả có lý do gợi ý, "
        "dễ giải thích trong phần thuyết trình."
    )
    st.write(
        "Giới hạn: giá là dữ liệu tham khảo, điểm camera/pin/màn hình được quy đổi từ thông số kỹ thuật, "
        "nên cần trình bày đây là mô hình hỗ trợ quyết định chứ không phải kết luận tuyệt đối."
    )

with tab_data:
    if results.empty:
        st.info("Chưa có dữ liệu để hiển thị.")
    else:
        table = results.copy()
        table["Tên máy"] = table.apply(lambda row: clean_device_title(row.get("brand"), row.get("device_name")), axis=1)
        table["Giá"] = table["price"].apply(format_price)
        visible_columns = [
            "Tên máy",
            "variant_name",
            "Giá",
            "release_year",
            "final_score",
            "gaming_score",
            "camera_score",
            "battery_score",
            "display_score",
            "thin_light_score",
            "value_score",
        ]
        st.dataframe(table[visible_columns], width="stretch", hide_index=True)
