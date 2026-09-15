import os
import sys
import sqlite3
import pandas as pd
import streamlit as st

# Thêm thư mục hiện tại vào path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from recommender import recommend, load_data, add_price_data, calculate_final_score, generate_reason
from scoring import calculate_all_scores

# -------------------------------------------------------------
# CẤU HÌNH TRANG WEB (THEME SÁNG TRẮNG CHUẨN E-COMMERCE)
# -------------------------------------------------------------
st.set_page_config(
    page_title="Phone DSS & Store - Trưng Bày & Gợi Ý Điện Thoại",
    page_icon="📱",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS giao diện Light Theme toàn diện
st.markdown("""
<style>
    /* Nền sáng tổng thể và font chữ */
    .stApp, div[data-testid="stAppViewContainer"], div[data-testid="stHeader"] {
        background-color: #F8FAFC !important;
        color: #0F172A !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    
    /* BẮT BUỘC TẤT CẢ LABEL, CHỮ, TIÊU ĐỀ, ĐOẠN VĂN HIỂN THỊ MÀU ĐẬM */
    p, span, label,
    .stMarkdown, .stMarkdown p,
    label[data-testid="stWidgetLabel"],
    label[data-testid="stWidgetLabel"] p,
    label[data-testid="stWidgetLabel"] span,
    div[data-testid="stMarkdownContainer"] p,
    div[data-testid="stRadio"] label,
    div[data-testid="stRadio"] label span,
    div[data-testid="stRadio"] label div,
    div[data-testid="stCheckbox"] label,
    div[data-testid="stCheckbox"] label span,
    div[data-testid="stSlider"] label,
    div[data-testid="stSlider"] div {
        color: #0F172A !important;
        font-weight: 600 !important;
    }

    /* ĐỔI Ô NHẬP LIỆU (INPUT) VÀ DROPDOWN (SELECTBOX) SANG NỀN TRẮNG, CHỮ ĐẬM */
    div[data-baseweb="input"],
    div[data-baseweb="input"] > div,
    div[data-baseweb="select"],
    div[data-baseweb="select"] > div,
    div[data-baseweb="base-input"] {
        background-color: #FFFFFF !important;
        color: #0F172A !important;
        border: 1px solid #CBD5E1 !important;
        border-radius: 8px !important;
    }

    div[data-baseweb="input"] input {
        color: #0F172A !important;
        background-color: #FFFFFF !important;
        font-weight: 500 !important;
    }

    div[data-baseweb="select"] span,
    div[data-baseweb="select"] div {
        color: #0F172A !important;
        font-weight: 500 !important;
    }

    div[data-baseweb="select"] svg {
        fill: #334155 !important;
    }

    /* Menu xổ xuống của dropdown */
    ul[role="listbox"],
    ul[role="listbox"] li,
    div[data-baseweb="popover"],
    div[data-baseweb="popover"] div {
        background-color: #FFFFFF !important;
        color: #0F172A !important;
    }
    ul[role="listbox"] li:hover {
        background-color: #EFF6FF !important;
        color: #1D4ED8 !important;
    }

    /* Header chính */
    .site-header {
        background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%);
        color: #FFFFFF !important;
        padding: 22px 28px;
        border-radius: 14px;
        margin-bottom: 22px;
        box-shadow: 0 8px 16px -4px rgba(29, 78, 216, 0.25);
    }
    .site-title {
        font-size: 2.1rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        margin-bottom: 4px;
        color: #FFFFFF !important;
    }
    .site-subtitle {
        font-size: 1.0rem;
        opacity: 0.95;
        color: #EFF6FF !important;
    }

    /* Tiêu đề Section Hàng 1 và Hàng 2 */
    .section-title-box {
        background-color: #FFFFFF;
        border-left: 6px solid #2563EB;
        padding: 12px 18px;
        border-radius: 0 10px 10px 0;
        margin: 24px 0 16px 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .section-title {
        font-size: 1.35rem;
        font-weight: 800;
        color: #0F172A !important;
        margin: 0;
    }
    .section-desc {
        font-size: 0.88rem;
        color: #64748B !important;
        margin-top: 3px;
    }

    /* Định dạng Text và Giá tiền */
    .price-tag-big {
        color: #DC2626 !important;
        font-size: 1.25rem !important;
        font-weight: 800 !important;
        margin: 4px 0;
    }
    .badge-year {
        background-color: #EEF2F6;
        color: #334155 !important;
        font-size: 0.78rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        display: inline-block;
    }
    .badge-brand {
        color: #2563EB !important;
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
    }

    /* ÉP TOÀN BỘ MODAL DIALOG SANG NỀN TRẮNG SÁNG VÀ CHỮ ĐẬM RÕ RÀNG (ẢNH 2) */
    div[role="dialog"],
    div[data-testid="stDialog"],
    div[data-testid="stModal"],
    div[data-baseweb="modal"],
    div[data-baseweb="modal"] div[role="dialog"],
    div[data-baseweb="modal"] > div,
    section[data-testid="stDialog"] {
        background-color: #FFFFFF !important;
        color: #0F172A !important;
        border-radius: 16px !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
    }

    /* Tất cả văn bản, nhãn, thẻ p, span bên trong modal dialog */
    div[role="dialog"] p,
    div[role="dialog"] span,
    div[role="dialog"] label,
    div[role="dialog"] div,
    div[role="dialog"] h1,
    div[role="dialog"] h2,
    div[role="dialog"] h3,
    div[role="dialog"] h4,
    div[role="dialog"] li,
    div[data-testid="stDialog"] p,
    div[data-testid="stDialog"] span,
    div[data-testid="stDialog"] label,
    div[data-testid="stDialog"] div,
    div[data-testid="stDialog"] h1,
    div[data-testid="stDialog"] h2,
    div[data-testid="stDialog"] h3,
    div[data-testid="stDialog"] h4,
    div[data-testid="stDialog"] li {
        color: #0F172A !important;
    }

    /* Nút X đóng dialog */
    div[role="dialog"] button[aria-label="Close"],
    div[data-testid="stDialog"] button[aria-label="Close"] {
        color: #0F172A !important;
    }
    div[role="dialog"] button[aria-label="Close"] svg,
    div[data-testid="stDialog"] button[aria-label="Close"] svg {
        fill: #0F172A !important;
    }

    /* Giá trị Metric trong dialog và toàn trang */
    div[data-testid="stMetricValue"] {
        color: #0F172A !important;
        font-weight: 800 !important;
        font-size: 1.4rem !important;
    }
    div[data-testid="stMetricLabel"] {
        color: #475569 !important;
        font-weight: 700 !important;
    }

    /* Khung lý do gợi ý DSS */
    .reason-box-ui {
        background-color: #F0FDF4;
        border: 1px solid #BBF7D0;
        border-left: 4px solid #16A34A;
        padding: 10px 14px;
        border-radius: 0 8px 8px 0;
        color: #166534 !important;
        font-size: 0.92rem;
        margin-top: 8px;
        line-height: 1.45;
    }

    /* Tùy biến nút bấm */
    button[kind="secondary"] {
        background-color: #FFFFFF !important;
        color: #1E293B !important;
        border: 1px solid #CBD5E1 !important;
        border-radius: 8px !important;
        font-weight: 600 !important;
        transition: all 0.2s ease !important;
    }
    button[kind="secondary"]:hover {
        border-color: #2563EB !important;
        color: #2563EB !important;
        background-color: #EFF6FF !important;
    }
    button[kind="primary"] {
        background-color: #2563EB !important;
        color: #FFFFFF !important;
        font-weight: 700 !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25) !important;
    }

    /* Thẻ Card Container */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        background-color: #FFFFFF !important;
        border: 1px solid #E2E8F0 !important;
        border-radius: 12px !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03) !important;
        padding: 10px !important;
    }
</style>
""", unsafe_allow_html=True)


# -------------------------------------------------------------
# LOAD VÀ CACHE DỮ LIỆU TỪ SQLITE
# -------------------------------------------------------------
@st.cache_data
def get_cached_database():
    db_path = os.path.join(current_dir, "data", "phone_database.db")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        devices = pd.read_sql("SELECT * FROM devices", conn)
        specs = pd.read_sql("SELECT * FROM device_specs", conn)
        variants = pd.read_sql("SELECT * FROM device_variants", conn)
        benchmarks = pd.read_sql("SELECT * FROM device_benchmarks", conn)
        prices = pd.read_sql("SELECT * FROM device_prices", conn)
        conn.close()

        # Merge thông tin sản phẩm đầy đủ
        full_df = devices.merge(specs, on="device_id", how="inner")
        full_df = full_df.merge(benchmarks, on="device_id", how="inner")
        full_df = full_df.merge(variants, on="device_id", how="inner")
        full_df = full_df.merge(prices[prices["condition"] == "new"], on="variant_id", how="left")
        return devices, specs, variants, benchmarks, prices, full_df
    else:
        df = load_data()
        df = add_price_data(df, "new")
        return df, df, df, df, df, df


devices_df, specs_df, variants_df, benchmarks_df, prices_df, full_df = get_cached_database()


# -------------------------------------------------------------
# POPUP DIALOG: CHI TIẾT THÔNG SỐ ĐIỆN THOẠI
# -------------------------------------------------------------
@st.dialog("📱 Chi Tiết Điện Thoại & Thông Số Kỹ Thuật", width="large")
def show_device_detail(dev_id):
    dev = devices_df[devices_df["device_id"] == dev_id].iloc[0]
    spec = specs_df[specs_df["device_id"] == dev_id].iloc[0] if not specs_df[specs_df["device_id"] == dev_id].empty else None
    dev_vars = variants_df[variants_df["device_id"] == dev_id]
    bench = benchmarks_df[benchmarks_df["device_id"] == dev_id].iloc[0] if not benchmarks_df[benchmarks_df["device_id"] == dev_id].empty else None

    col_img, col_info = st.columns([1, 2], gap="medium")

    with col_img:
        img_url = dev.get("image_url", "")
        if img_url and str(img_url).startswith("http"):
            st.image(img_url, use_container_width=True)
        st.markdown(f"<p style='color:#0F172A; margin: 4px 0;'>🏷️ <b>Hãng:</b> {dev.get('brand')}</p>", unsafe_allow_html=True)
        st.markdown(f"<p style='color:#0F172A; margin: 4px 0;'>📅 <b>Năm ra mắt:</b> {dev.get('release_year', 'N/A')}</p>", unsafe_allow_html=True)
        st.markdown(f"<p style='color:#0F172A; margin: 4px 0;'>📦 <b>Tình trạng:</b> {dev.get('status', 'Available')}</p>", unsafe_allow_html=True)
        if dev.get("device_url"):
            st.markdown(f"<a href='{dev.get('device_url')}' target='_blank' style='color:#2563EB; font-weight:600;'>🔗 Xem nguồn GSMArena</a>", unsafe_allow_html=True)

    with col_info:
        st.markdown(f"<h3 style='color:#0F172A; margin-top:0;'>{dev.get('brand')} {dev.get('device_name')}</h3>", unsafe_allow_html=True)

        # Chọn Variant để cập nhật giá
        if not dev_vars.empty:
            var_options = dev_vars["variant_name"].tolist()
            selected_var_name = st.selectbox("⚙️ Chọn phiên bản cấu hình (RAM / ROM):", var_options)
            sel_var = dev_vars[dev_vars["variant_name"] == selected_var_name].iloc[0]
            var_id = sel_var["variant_id"]

            p_new = prices_df[(prices_df["variant_id"] == var_id) & (prices_df["condition"] == "new")]
            p_used = prices_df[(prices_df["variant_id"] == var_id) & (prices_df["condition"] == "used")]

            price_new_val = int(p_new.iloc[0]["price"]) if not p_new.empty else 0
            price_used_val = int(p_used.iloc[0]["price"]) if not p_used.empty else 0

            c_p1, c_p2, c_antutu = st.columns(3)
            with c_p1:
                st.metric("💰 Giá máy mới", f"{price_new_val:,} đ" if price_new_val > 0 else "Liên hệ")
            with c_p2:
                st.metric("🔄 Giá máy cũ", f"{price_used_val:,} đ" if price_used_val > 0 else "Liên hệ")
            with c_antutu:
                st.metric("⚡ AnTuTu ước tính", f"{sel_var.get('estimated_antutu', 0):,} điểm")

        # Điểm đánh giá đa tiêu chí
        if spec is not None and bench is not None:
            temp_row = {**spec.to_dict(), **bench.to_dict(), "ram_gb": 8, "rom_gb": 128}
            scores = calculate_all_scores(temp_row)

            st.write("---")
            st.markdown("<h4 style='color:#0F172A; margin-bottom: 8px;'>📊 Đánh giá điểm khía cạnh (0 - 100 điểm):</h4>", unsafe_allow_html=True)
            c1, c2, c3, c4, c5 = st.columns(5)
            c1.metric("🎮 Gaming", f"{scores['gaming_score']}")
            c2.metric("📷 Camera", f"{scores['camera_score']}")
            c3.metric("🔋 Pin", f"{scores['battery_score']}")
            c4.metric("🖥️ Màn hình", f"{scores['display_score']}")
            c5.metric("🪶 Mỏng nhẹ", f"{scores['thin_light_score']}")

    # Thông số chi tiết
    if spec is not None:
        st.write("---")
        st.markdown("<h4 style='color:#0F172A;'>📋 Bảng thông số kỹ thuật chi tiết</h4>", unsafe_allow_html=True)
        t1, t2 = st.columns(2)
        with t1:
            st.markdown(f"- **Chip xử lý:** {spec.get('chipset', 'N/A')}")
            st.markdown(f"- **CPU:** {spec.get('cpu', 'N/A')}")
            st.markdown(f"- **GPU:** {spec.get('gpu', 'N/A')}")
            st.markdown(f"- **Hệ điều hành:** {spec.get('os', 'N/A')}")
            st.markdown(f"- **Màn hình:** {spec.get('display_type')} ({spec.get('refresh_rate_hz')}Hz)")
            st.markdown(f"- **Độ phân giải:** {spec.get('resolution_width')} x {spec.get('resolution_height')} px ({spec.get('screen_size_inch')}\")")
        with t2:
            ois_txt = "Có OIS" if spec.get("has_ois") == 1 else "Không OIS"
            zoom_txt = f", Zoom quang {spec.get('optical_zoom_x')}x" if spec.get("optical_zoom_x", 0) > 0 else ""
            st.markdown(f"- **Camera chính:** {spec.get('main_camera_mp')}MP (f/{spec.get('main_camera_aperture')}, {ois_txt}{zoom_txt})")
            st.markdown(f"- **Pin & Sạc:** {spec.get('battery_mah')} mAh (Sạc nhanh {spec.get('charging_w')}W)")
            st.markdown(f"- **Kích thước & Trọng lượng:** Dày {spec.get('thickness_mm')} mm, Nặng {spec.get('weight_g')} g")
            st.markdown(f"- **Kết nối 5G:** {'Có hỗ trợ 5G' if spec.get('has_5g') == 1 else '4G/LTE'}")
            st.markdown(f"- **Chuẩn chống nước:** {spec.get('ip_rating', 'None')}")


# -------------------------------------------------------------
# BANNER HEADER
# -------------------------------------------------------------
st.markdown("""
<div class="site-header">
    <div class="site-title">📱 PHONE DSS & STORE — HỆ THỐNG TRƯNG BÀY & GỢI Ý ĐIỆN THOẠI</div>
    <div class="site-subtitle">Không gian trưng bày 14,815 mẫu điện thoại kết hợp hệ thống gợi ý chuyên gia đa tiêu chí theo ngân sách & sở thích thực tế.</div>
</div>
""", unsafe_allow_html=True)


# =============================================================
# HÀNG 1: KHÔNG GIAN TRƯNG BÀY & BÁN ĐIỆN THOẠI (CATALOG)
# CỘT PHẢI HIỂN THỊ ĐÚNG 2 HÀNG x 4 CỘT = 8 THẺ MÁY KÈM PHÂN TRANG
# =============================================================
st.markdown("""
<div class="section-title-box">
    <div class="section-title">🏬 HÀNG 1: KHÔNG GIAN TRƯNG BÀY ĐIỆN THOẠI THEO GIÁ (CATALOG)</div>
    <div class="section-desc">Duyệt và tra cứu thông số kỹ thuật chi tiết của các dòng máy theo hãng, mức giá và cấu hình.</div>
</div>
""", unsafe_allow_html=True)

# Thanh chọn Hãng nhanh dạng nút bấm
st.write("🏷️ **Chọn nhanh theo thương hiệu nổi bật:**")
pop_brands = ["Tất cả hãng", "Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "Realme", "Google", "Honor", "Asus", "Sony"]
brand_cols = st.columns(len(pop_brands))

if "selected_brand_btn" not in st.session_state:
    st.session_state.selected_brand_btn = "Tất cả hãng"

for b_idx, b_name in enumerate(pop_brands):
    btn_type = "primary" if st.session_state.selected_brand_btn.lower() == b_name.lower() else "secondary"
    if brand_cols[b_idx].button(b_name, key=f"brand_btn_{b_name}", use_container_width=True, type=btn_type):
        st.session_state.selected_brand_btn = b_name
        st.session_state.current_page = 1
        st.rerun()

col_filter_left, col_catalog_right = st.columns([1, 3.3], gap="medium")

# --- CỘT TRÁI: BỘ LỌC TÌM KIẾM & GIÁ ---
with col_filter_left:
    with st.container(border=True):
        st.markdown("#### ⚙️ Bộ Lọc Sản Phẩm")

        # Tìm kiếm tên
        search_txt = st.text_input("🔍 Tìm kiếm tên máy:", placeholder="iPhone 15, S24, Redmi...")

        # Lọc Hãng sản xuất
        all_brands_list = ["Tất cả hãng"] + sorted(devices_df["brand"].dropna().unique().tolist())
        curr_b = st.session_state.get("selected_brand_btn", "Tất cả hãng")
        brand_idx = all_brands_list.index(curr_b) if curr_b in all_brands_list else 0

        brand_dropdown = st.selectbox(
            "🏷️ Hãng sản xuất:",
            options=all_brands_list,
            index=brand_idx,
            key="filter_brand_dropdown_select"
        )
        if brand_dropdown != st.session_state.selected_brand_btn:
            st.session_state.selected_brand_btn = brand_dropdown
            st.session_state.current_page = 1
            st.rerun()

        # Phân khúc giá
        price_seg = st.selectbox(
            "💵 Phân khúc mức giá:",
            options=[
                "Tất cả mức giá",
                "Dưới 5 triệu",
                "5 - 10 triệu",
                "10 - 15 triệu",
                "15 - 20 triệu",
                "Trên 20 triệu"
            ]
        )

        # Lọc RAM
        ram_filter = st.selectbox(
            "⚡ Dung lượng RAM:",
            options=["Tất cả", "4GB", "6GB", "8GB", "12GB", "16GB+"]
        )

        # Lọc năm ra mắt
        year_filter_cat = st.selectbox(
            "📅 Năm ra mắt:",
            options=["Tất cả", "2024", "2023", "2022", "2021", "2020", "Cũ hơn (trước 2020)"]
        )

        # Sắp xếp
        sort_cat = st.selectbox(
            "↕️ Sắp xếp theo:",
            options=["Mới nhất", "Giá thấp -> cao", "Giá cao -> thấp"]
        )

# --- CỘT PHẢI: LƯỚI 2 HÀNG x 4 CỘT (8 MÁY) + PHÂN TRANG ĐẦY ĐỦ ---
with col_catalog_right:
    # Lọc DataFrame
    cat_data = full_df.drop_duplicates(subset=["device_id"]).copy()

    # Áp dụng Hãng
    if st.session_state.selected_brand_btn != "Tất cả hãng":
        cat_data = cat_data[cat_data["brand"].str.lower() == st.session_state.selected_brand_btn.lower()]

    # Áp dụng tìm kiếm
    if search_txt:
        cat_data = cat_data[
            cat_data["device_name"].str.contains(search_txt, case=False, na=False)
            | cat_data["brand"].str.contains(search_txt, case=False, na=False)
        ]

    # Áp dụng phân khúc giá
    if price_seg == "Dưới 5 triệu":
        cat_data = cat_data[cat_data["price"] < 5000000]
    elif price_seg == "5 - 10 triệu":
        cat_data = cat_data[(cat_data["price"] >= 5000000) & (cat_data["price"] <= 10000000)]
    elif price_seg == "10 - 15 triệu":
        cat_data = cat_data[(cat_data["price"] >= 10000000) & (cat_data["price"] <= 15000000)]
    elif price_seg == "15 - 20 triệu":
        cat_data = cat_data[(cat_data["price"] >= 15000000) & (cat_data["price"] <= 20000000)]
    elif price_seg == "Trên 20 triệu":
        cat_data = cat_data[cat_data["price"] > 20000000]

    # Áp dụng RAM
    if ram_filter != "Tất cả":
        if ram_filter == "16GB+":
            cat_data = cat_data[cat_data["ram_gb"] >= 16]
        else:
            r_val = int(ram_filter.replace("GB", ""))
            cat_data = cat_data[cat_data["ram_gb"] == r_val]

    # Áp dụng năm
    if year_filter_cat != "Tất cả":
        if year_filter_cat.startswith("Cũ hơn"):
            cat_data = cat_data[cat_data["release_year"] < 2020]
        else:
            cat_data = cat_data[cat_data["release_year"] == int(year_filter_cat)]

    # Sắp xếp
    if sort_cat == "Mới nhất":
        cat_data = cat_data.sort_values("release_year", ascending=False)
    elif sort_cat == "Giá thấp -> cao":
        cat_data = cat_data.sort_values("price", ascending=True)
    elif sort_cat == "Giá cao -> thấp":
        cat_data = cat_data.sort_values("price", ascending=False)

    total_devices_count = len(cat_data)
    st.markdown(f"📦 Tìm thấy **{total_devices_count:,}** điện thoại phù hợp trong danh mục:")

    # Phân trang: 8 thẻ máy / trang (2 hàng x 4 cột)
    PAGE_SIZE = 8
    total_pages = max(1, (total_devices_count - 1) // PAGE_SIZE + 1)

    if "current_page" not in st.session_state:
        st.session_state.current_page = 1

    if st.session_state.current_page > total_pages:
        st.session_state.current_page = 1

    start_i = (st.session_state.current_page - 1) * PAGE_SIZE
    end_i = start_i + PAGE_SIZE
    page_subset = cat_data.iloc[start_i:end_i]

    if page_subset.empty:
        st.info("Không có máy nào thỏa mãn bộ lọc. Vui lòng chọn điều kiện tìm kiếm khác.")
    else:
        # Hàng 1 (4 máy đầu)
        row1_items = page_subset.iloc[0:4]
        if not row1_items.empty:
            r1_cols = st.columns(4)
            for idx, (_, row) in enumerate(row1_items.iterrows()):
                with r1_cols[idx]:
                    with st.container(border=True):
                        dev_id = row.get("device_id")
                        img = row.get("image_url", "")
                        name = row.get("device_name", "")
                        brand = row.get("brand", "")
                        price = int(row.get("price", 0))
                        year = row.get("release_year", "")
                        chip = str(row.get("chipset", "Standard"))[:20]

                        # Header thẻ: Badge năm + Tên hãng
                        c_head1, c_head2 = st.columns([1, 1])
                        c_head1.markdown(f"<span class='badge-year'>{year}</span>", unsafe_allow_html=True)
                        c_head2.markdown(f"<span class='badge-brand' style='float:right;'>{brand}</span>", unsafe_allow_html=True)

                        # Ảnh
                        if img and str(img).startswith("http"):
                            st.image(img, use_container_width=True)
                        else:
                            st.markdown("<div style='height:140px; display:flex; align-items:center; justify-content:center; color:#94A3B8;'>📱 Không có ảnh</div>", unsafe_allow_html=True)

                        # Tên & Giá & Chip
                        st.markdown(f"**{name}**")
                        st.markdown(f"<div class='price-tag-big'>Từ {price:,} đ</div>", unsafe_allow_html=True)
                        st.markdown(f"<span style='font-size: 0.8rem; color: #64748B;'>Chip: {chip}...</span>", unsafe_allow_html=True)

                        if st.button("👁️ Xem chi tiết", key=f"cat_r1_{dev_id}_{idx}", use_container_width=True):
                            show_device_detail(dev_id)

        # Hàng 2 (4 máy tiếp theo)
        row2_items = page_subset.iloc[4:8]
        if not row2_items.empty:
            r2_cols = st.columns(4)
            for idx, (_, row) in enumerate(row2_items.iterrows()):
                with r2_cols[idx]:
                    with st.container(border=True):
                        dev_id = row.get("device_id")
                        img = row.get("image_url", "")
                        name = row.get("device_name", "")
                        brand = row.get("brand", "")
                        price = int(row.get("price", 0))
                        year = row.get("release_year", "")
                        chip = str(row.get("chipset", "Standard"))[:20]

                        # Header thẻ: Badge năm + Tên hãng
                        c_head1, c_head2 = st.columns([1, 1])
                        c_head1.markdown(f"<span class='badge-year'>{year}</span>", unsafe_allow_html=True)
                        c_head2.markdown(f"<span class='badge-brand' style='float:right;'>{brand}</span>", unsafe_allow_html=True)

                        # Ảnh
                        if img and str(img).startswith("http"):
                            st.image(img, use_container_width=True)
                        else:
                            st.markdown("<div style='height:140px; display:flex; align-items:center; justify-content:center; color:#94A3B8;'>📱 Không có ảnh</div>", unsafe_allow_html=True)

                        # Tên & Giá & Chip
                        st.markdown(f"**{name}**")
                        st.markdown(f"<div class='price-tag-big'>Từ {price:,} đ</div>", unsafe_allow_html=True)
                        st.markdown(f"<span style='font-size: 0.8rem; color: #64748B;'>Chip: {chip}...</span>", unsafe_allow_html=True)

                        if st.button("👁️ Xem chi tiết", key=f"cat_r2_{dev_id}_{idx}", use_container_width=True):
                            show_device_detail(dev_id)

    # --- CHÂN TRANG PHÂN TRANG ĐẦY ĐỦ (PAGINATION FOOTER) ---
    st.write("---")
    p_c1, p_c2, p_c3 = st.columns([1.2, 2, 1.2])
    with p_c1:
        if st.button("◀ Trang trước", disabled=(st.session_state.current_page <= 1), use_container_width=True):
            st.session_state.current_page -= 1
            st.rerun()
    with p_c2:
        st.markdown(
            f"<div style='text-align: center; font-weight: 700; color: #1E293B; margin-top: 6px; font-size: 0.95rem;'>"
            f"Trang {st.session_state.current_page} / {total_pages} (Hiển thị {len(page_subset)} trên tổng số {total_devices_count:,} máy)"
            f"</div>",
            unsafe_allow_html=True
        )
    with p_c3:
        if st.button("Trang sau ▶", disabled=(st.session_state.current_page >= total_pages), use_container_width=True):
            st.session_state.current_page += 1
            st.rerun()


# =============================================================
# HÀNG 2: HỆ TRỢ GIÚP QUYẾT ĐỊNH CHỌN MÁY THÔNG MINH (DSS)
# =============================================================
st.markdown("""
<div class="section-title-box" style="margin-top: 40px; border-left-color: #16A34A;">
    <div class="section-title">🎯 HÀNG 2: HỆ TRỢ GIÚP QUYẾT ĐỊNH CHỌN MÁY THÔNG MINH (PHONE DSS)</div>
    <div class="section-desc">Thuật toán phân tích đa tiêu chí (MCDA) tự động chấm điểm và tìm ra các mẫu máy đáng tiền nhất theo đúng ngân sách & sở thích của bạn.</div>
</div>
""", unsafe_allow_html=True)

col_dss_left, col_dss_right = st.columns([1, 2.3], gap="large")

# --- CỘT TRÁI: NHẬP NHU CẦU ---
with col_dss_left:
    with st.container(border=True):
        st.markdown("#### ⚙️ Nhập Nhu Cầu Của Bạn")

        # Khoảng ngân sách
        dss_budget = st.slider(
            "💵 Khoảng ngân sách (Triệu VNĐ):",
            min_value=1.0,
            max_value=40.0,
            value=(5.0, 15.0),
            step=0.5
        )

        # Tình trạng
        dss_condition = st.radio(
            "🏷️ Tình trạng máy:",
            options=["new", "used"],
            format_func=lambda x: "✨ Máy mới 100% (Brand-new)" if x == "new" else "🔄 Máy cũ tiết kiệm (Like-new / Đã dùng)"
        )

        # Tiêu chí 1
        prio_labels = {
            "gaming": "🎮 Chơi Game / Cấu hình khủng (Chip, RAM, 120Hz)",
            "camera": "📷 Chụp ảnh đẹp / Quay phim (MP, OIS, Zoom)",
            "battery": "🔋 Pin trâu / Sạc siêu nhanh (mAh, Watt)",
            "display": "🖥️ Màn hình sắc nét (2K/FHD+, AMOLED, 144Hz)",
            "thin_light": "🪶 Thiết kế mỏng nhẹ / Cầm nắm thoải mái"
        }

        dss_prio_1 = st.selectbox(
            "🥇 Tiêu chí ưu tiên số 1:",
            options=list(prio_labels.keys()),
            format_func=lambda x: prio_labels[x],
            index=0
        )

        use_dss_prio_2 = st.checkbox("Thêm tiêu chí ưu tiên số 2?", value=True)
        dss_priorities = [dss_prio_1]

        if use_dss_prio_2:
            dss_prio_2_opts = [k for k in prio_labels.keys() if k != dss_prio_1]
            dss_prio_2 = st.selectbox(
                "🥈 Tiêu chí ưu tiên số 2:",
                options=dss_prio_2_opts,
                format_func=lambda x: prio_labels[x],
                index=1 if len(dss_prio_2_opts) > 1 else 0
            )
            dss_priorities.append(dss_prio_2)

        # Năm ra mắt
        dss_year = st.selectbox(
            "📅 Năm ra mắt tối thiểu:",
            options=[2023, 2022, 2021, 2020, 0],
            format_func=lambda x: f"Từ năm {x} đến nay" if x > 0 else "Tất cả các năm (Kể cả máy cổ)",
            index=2
        )
        dss_min_year = dss_year if dss_year > 0 else None

        dss_top_n = st.slider("Số lượng máy đề xuất (Top N):", min_value=3, max_value=8, value=4)

        btn_dss_run = st.button("🚀 PHÂN TÍCH & ĐỀ XUẤT NGAY", type="primary", use_container_width=True)

# --- CỘT PHẢI: KẾT QUẢ ĐỀ XUẤT TỐI ƯU NHẤT ---
with col_dss_right:
    st.markdown("#### 🏆 Danh Sách Điện Thoại Đề Xuất Tối Ưu Nhất")

    with st.spinner("Đang tính toán điểm số đa tiêu chí..."):
        dss_results = recommend(
            min_budget=dss_budget[0],
            max_budget=dss_budget[1],
            condition=dss_condition,
            priorities=dss_priorities,
            top_n=dss_top_n,
            min_year=dss_min_year
        )

    if dss_results.empty:
        st.warning("⚠️ Không tìm thấy điện thoại nào phù hợp với khoảng ngân sách. Vui lòng nới rộng khoảng giá.")
    else:
        for idx, (_, row) in enumerate(dss_results.iterrows(), start=1):
            dev_id = row.get("device_id")
            name = row.get("device_name", row.get("model_name", "Điện thoại"))
            brand = row.get("brand", "")
            variant = row.get("variant_name", row.get("variant", ""))
            price = int(row.get("price", 0))
            final_score = row.get("final_score", 0)
            img = row.get("image_url", "")

            badge_text = "🥇 TOP 1 - TỐI ƯU NHẤT" if idx == 1 else (f"🥈 TOP {idx}" if idx == 2 else f"🥉 TOP {idx}" if idx == 3 else f"TOP {idx}")

            with st.container(border=True):
                # Header thẻ đề xuất
                h_c1, h_c2 = st.columns([2.5, 1])
                with h_c1:
                    st.markdown(f"**{badge_text}**: <span style='font-size: 1.25rem; font-weight: 800; color: #0F172A;'>{brand} {name}</span> `({variant})`", unsafe_allow_html=True)
                with h_c2:
                    st.markdown(f"<div class='price-tag-big' style='text-align:right;'>{price:,} đ</div>", unsafe_allow_html=True)

                col_dss_card_img, col_dss_card_info = st.columns([1, 3.2], gap="small")

                with col_dss_card_img:
                    if img and str(img).startswith("http"):
                        st.image(img, use_container_width=True)
                    if st.button("👁️ Chi tiết", key=f"dss_view_{dev_id}_{idx}", use_container_width=True):
                        show_device_detail(dev_id)

                with col_dss_card_info:
                    m1, m2, m3, m4, m5, m6 = st.columns(6)
                    m1.metric("🎯 Điểm Tổng", f"{final_score:.1f}")
                    m2.metric("🎮 Gaming", f"{row.get('gaming_score', 0)}")
                    m3.metric("📷 Camera", f"{row.get('camera_score', 0)}")
                    m4.metric("🔋 Pin", f"{row.get('battery_score', 0)}")
                    m5.metric("🖥️ Màn hình", f"{row.get('display_score', 0)}")
                    m6.metric("💡 Đáng tiền", f"{row.get('value_score', 0):.1f}")

                    st.markdown(f'<div class="reason-box-ui">💡 <b>Lý do chuyên gia đề xuất:</b> {row.get("reason")}</div>', unsafe_allow_html=True)
