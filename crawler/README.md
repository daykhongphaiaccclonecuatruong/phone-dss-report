# GSMArena Scraper Tool (Node.js)

Công cụ tự động cào toàn bộ danh sách thiết bị điện thoại từ GSMArena, xuất file CSV, có cơ chế đối soát số lượng và phát hiện cảnh báo Ban IP.

---

## 📂 Cấu trúc thư mục

```
tools_dt/
├── gsmarena_brands_summary.csv   # Trang thống kê riêng tổng số lượng 126 hãng
├── gsmarena_devices.csv          # File CSV tổng hợp toàn bộ 14,815 máy (có STT đầy đủ)
├── gsmarena_full_devices.xlsx    # File Excel (.xlsx) đa Sheet (Sheet 1: Tổng quan, các sheet sau: từng hãng)
├── brands_csv/                   # Thư mục chứa 126 file CSV riêng của từng hãng
└── crawler/                      # Thư mục chứa mã nguồn Tool
    ├── package.json
    ├── config.js                 # Cấu hình headers, delay, đường dẫn file
    ├── index.js                  # File chạy chính (hỗ trợ checkpoint/resume)
    ├── syncAndAudit.js           # Script rà soát & đồng bộ toàn bộ dữ liệu
    ├── progress.json             # File ghi nhớ tiến độ cào
    └── src/
        ├── client.js             # Request HTTP, delay an toàn & bắt lỗi Ban IP
        ├── brandCrawler.js       # Quét thống kê toàn bộ hãng từ makers.php3
        ├── deviceCrawler.js      # Bóc tách danh sách máy & tự động duyệt phân trang
        └── exporter.js           # Quản lý xuất CSV, Excel và Checkpoint
```

---

## 🚀 Các lệnh chạy tiện ích

Vào thư mục `crawler`:
```bash
cd crawler
```

### 1. Cào bổ sung khi có hãng mới / cào tiếp các hãng còn thiếu (Resume)
Tool sẽ tự động bỏ qua các hãng đã cào xong và chỉ cào các hãng chưa cào hoặc hãng mới:
```bash
npm start
# hoặc: node index.js
```

### 2. Cào bổ sung hoặc cập nhật lại 1 hãng cụ thể (khi hãng đó ra máy mới)
```bash
node index.js --brand apple
node index.js --brand samsung
node index.js --brand xiaomi
```

### 3. Đồng bộ hóa và cập nhật lại toàn bộ file CSV & Excel
Quét lại toàn bộ các file trong `brands_csv/`, cào bổ sung nếu thiếu và xuất lại toàn bộ file Excel/CSV tổng:
```bash
npm run sync
# hoặc: node syncAndAudit.js
```

### 4. Xem nhanh bảng thống kê số lượng máy của 126 hãng
```bash
npm run stats
# hoặc: node index.js --stats-only
```

### 5. Cào mới hoàn toàn từ đầu (Clear dữ liệu cũ)
```bash
npm run fresh
# hoặc: node index.js --fresh
```
