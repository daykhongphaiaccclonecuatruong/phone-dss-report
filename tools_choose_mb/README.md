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
├── ml_model.py                            # Mô hình học máy KNN Regression dự đoán mức độ phù hợp
├── recommender.py                         # Thuật toán DSS + ML (lọc, dự đoán, xếp hạng, tư vấn nơi mua)
├── web_app.py                             # Giao diện Web Streamlit (Catalog trưng bày + DSS Đề xuất thông minh)
├── test_cases.py                          # Bộ kịch bản kiểm thử tự động
├── dss_validation_checks.py                # Kiểm thử profile nhu cầu, ML score và dữ liệu giá
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

### 3. Chạy Kiểm Thử DSS + Học Máy
```bash
python tools_choose_mb/dss_validation_checks.py
```

### 4. Đồng bộ Dữ liệu nếu Cập Nhật Master Excel
```bash
python tools_choose_mb/sync_database.py
```

---

## 🎯 Quy Trình Hệ Trợ Giúp Ra Quyết Định Có Học Máy

1. **Xác định người dùng:** Người dùng nhập ngân sách, tình trạng máy, thương hiệu và nhu cầu chính/phụ.
2. **Phân tích sở thích:** Hệ thống mã hóa nhu cầu thành vector ưu tiên như gaming, camera, pin, màn hình, mỏng nhẹ.
3. **Dự đoán mức độ phù hợp:** `ml_model.py` dùng KNN Regression với hàm `fit()` và `predict()` để dự đoán `ml_score`.
4. **Xếp hạng:** `recommender.py` kết hợp `final_score = 70% mcda_score + 30% ml_score`.
5. **Sinh khuyến nghị:** Hệ thống trả Top điện thoại phù hợp, kèm giá, nơi mua và lý do chọn.
6. **Trợ giúp lựa chọn:** Web hiển thị điểm cuối, điểm ML, điểm MCDA, ma trận điểm và bảng giá.
7. **Đánh giá hệ thống:** `dss_validation_checks.py` kiểm tra profile mẫu, ngân sách biên, đổi trọng số ưu tiên và đánh giá MAE/RMSE của mô hình.

## 🎯 Điểm Nổi Bật của Thuật Toán Nâng Cấp
1. **Lọc Ngân Sách Thực Tế:** Dựa trên `min_price` đang có hàng tại 6 nhà bán lẻ (CellphoneS, TGDD, FPT Shop, Hoàng Hà Mobile, Di Động Việt, Viettel Store) kèm cơ chế nới biên `±7%`.
2. **Dự Đoán Bằng Học Máy:** KNN Regression dự đoán `ml_score` cho từng điện thoại theo profile người dùng.
3. **Kết Hợp MCDA + ML:** MCDA giúp giải thích được lý do, ML giúp mô hình hóa độ phù hợp theo profile.
4. **Chống Trùng Lặp (Anti-Duplicate):** Top 1, Top 2, Top 3 luôn là 3 mẫu điện thoại khác nhau.
5. **Tự Động Chọn Bản Cấu Hình RAM/ROM Tối Ưu:** Nhu cầu Gaming -> RAM cao nhất; Nhu cầu Chụp ảnh -> ROM cao nhất; Nhu cầu Giá rẻ -> Min price.
6. **Tư Vấn Nơi Mua & So Sánh Giá:** Chỉ rõ cửa hàng đang bán rẻ nhất, số tiền tiết kiệm so với thị trường và cung cấp nút bấm chuyển link mua trực tiếp.
