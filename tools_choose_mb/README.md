# 📱 TOOLS_CHOOSE_MB — HỆ THỐNG TRƯNG BÀY & GỢI Ý ĐIỆN THOẠI (PHONE DSS)

Thư mục đóng gói toàn diện toàn bộ **Dữ liệu chuẩn hóa (Data)** và **Thuật toán thông minh (Logic)** của Hệ trợ giúp quyết định chọn mua điện thoại tại thị trường Việt Nam.

---

## 📂 Cấu trúc Thư mục

```
tools_choose_mb/
├── data/                                  # Kho dữ liệu chuẩn hóa cho thị trường VN
│   ├── 01_devices.csv                     # 287 dòng máy đang bán tại VN
│   ├── 02_device_specs.csv                # Thông số kỹ thuật chi tiết (Chip, Màn, Cam, Pin, 5G, IP)
│   ├── 03_device_variants.csv             # 526 phiên bản cấu hình (RAM / ROM)
│   ├── 04_device_benchmarks.csv           # Điểm benchmark AnTuTu, Geekbench, 3DMark
│   ├── 05_device_retailer_prices.csv      # 673 dòng giá chi tiết từ 6 chuỗi bán lẻ kèm link mua
│   ├── 05_device_aggregated_prices.csv    # Giá tổng hợp (min_price, avg_price, best_retailer, savings)
│   ├── phone_database.db                  # SQLite database gồm 6 bảng sạch
│   ├── phone_dss_master_database.xlsx     # File Master Excel 6 sheets
│   ├── phone_dss_database.sql             # File Master MySQL 8.0+ DDL & INSERT
│   └── raw_backup_global_14k/             # 🛡️ Sao lưu toàn bộ 14,815 máy GSMArena gốc (không sợ mất)
│       ├── 01_devices.csv
│       ├── 02_device_specs.csv
│       ├── 03_device_variants.csv
│       ├── 04_device_benchmarks.csv
│       └── 05_device_prices.csv
│
├── scoring.py                             # Bộ máy chấm điểm đa tiêu chí MCDA (Gaming, Cam, Pin, Màn, Mỏng nhẹ, Máy cũ)
├── recommender.py                         # Thuật toán DSS 6 tầng (Lọc giá min, Chống trùng lặp, Chọn bản RAM/ROM, Tư vấn nơi mua)
├── web_app.py                             # Giao diện Web Streamlit (Catalog trưng bày + DSS Đề xuất thông minh)
├── test_cases.py                          # Bộ kịch bản kiểm thử tự động
└── sync_database.py                       # Tool đồng bộ 1 chạm từ Master Excel sang CSVs & SQLite
```

---

## 🚀 Hướng Dẫn Sử Dụng

### 1. Khởi chạy Ứng Dụng Web Streamlit
```bash
streamlit run tools_choose_mb/web_app.py
```

### 2. Chạy Bộ Kiểm Thử Thuật toán
```bash
python tools_choose_mb/test_cases.py
```

### 3. Đồng bộ Dữ liệu nếu Cập Nhật Master Excel
```bash
python tools_choose_mb/sync_database.py
```

---

## 🎯 Điểm Nổi Bật của Thuật Toán Nâng Cấp (6 Tầng)
1. **Lọc Ngân Sách Thực Tế:** Dựa trên `min_price` đang có hàng tại 6 nhà bán lẻ (CellphoneS, TGDD, FPT Shop, Hoàng Hà Mobile, Di Động Việt, Viettel Store) kèm cơ chế nới biên `±7%`.
2. **Chống Trùng Lặp (Anti-Duplicate):** Top 1, Top 2, Top 3 luôn là 3 mẫu điện thoại khác nhau.
3. **Tự Động Chọn Bản Cấu Hình RAM/ROM Tối Ưu:** Nhu cầu Gaming -> RAM cao nhất; Nhu cầu Chụp ảnh -> ROM cao nhất; Nhu cầu Giá rẻ -> Min price.
4. **Tư Vấn Nơi Mua & So Sánh Giá:** Chỉ rõ cửa hàng đang bán rẻ nhất, số tiền tiết kiệm so với thị trường và cung cấp nút bấm chuyển link mua trực tiếp.

