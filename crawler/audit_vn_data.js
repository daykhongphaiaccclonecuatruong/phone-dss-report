import fs from 'fs';
import path from 'path';

const CANONICAL_BRANDS = [
  'Apple', 'Samsung', 'Xiaomi', 'OPPO', 'vivo', 'realme', 'HONOR',
  'TECNO', 'Infinix', 'Nubia', 'ASUS', 'Sony', 'Nothing', 'OnePlus',
  'Huawei', 'Meizu', 'Nokia', 'Masstel', 'Mobell', 'Itel', 'Benco', 'TCL', 'Viettel'
];

const RETAILERS = [
  'CellphoneS', 'Hoàng Hà Mobile', 'Thế Giới Di Động', 'FPT Shop', 'Di Động Việt', 'Viettel Store'
];

function loadData() {
  const possiblePaths = [
    'd:/Documents/Website/tools_dt/phone_dss/data/05_device_retailer_prices_raw.json',
    './output/05_device_retailer_prices_raw.json',
    'vn_crawler_progress.json'
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
        const records = Array.isArray(raw) ? raw : (raw.records || []);
        if (records.length > 0) return { records, source: p };
      } catch (e) {}
    }
  }
  return { records: [], source: 'None' };
}

async function auditData() {
  console.log('================================================================');
  console.log('🔍 CÔNG CỤ ĐỐI SOÁT & KIỂM TRA ĐỘ PHỦ DỮ LIỆU ĐIỆN THOẠI VN');
  console.log('================================================================');

  const { records, source } = loadData();
  console.log(`📂 Nguồn dữ liệu kiểm tra: ${source}`);
  console.log(`📦 Tổng số bản ghi giá nạp vào: ${records.length}\n`);

  if (records.length === 0) {
    console.log('⚠️ Chưa có dữ liệu giá. Vui lòng chạy `node crawl_vn_prices.js` trước!');
    return;
  }

  // 1. Phân tích Độ phủ: Hãng x Cửa hàng
  const brandStoreMatrix = {};
  const brandConditionMatrix = {};

  for (const b of CANONICAL_BRANDS) {
    brandStoreMatrix[b] = {};
    for (const r of RETAILERS) brandStoreMatrix[b][r] = 0;
    brandConditionMatrix[b] = { new: 0, used: 0, total: 0 };
  }

  const issues = [];

  for (const r of records) {
    const brand = r.brand || 'Other';
    const store = r.retailer ? r.retailer.replace(' Cũ', '').replace(' Máy Đổi Trả', '') : 'Other';
    const cond = r.condition || 'new';

    if (brandStoreMatrix[brand]) {
      const matchedStore = RETAILERS.find(s => store.includes(s)) || store;
      if (brandStoreMatrix[brand][matchedStore] !== undefined) {
        brandStoreMatrix[brand][matchedStore]++;
      }
    }

    if (brandConditionMatrix[brand]) {
      if (cond === 'used') brandConditionMatrix[brand].used++;
      else brandConditionMatrix[brand].new++;
      brandConditionMatrix[brand].total++;
    }

    // Data quality checks
    if (!r.price || r.price < 300000) {
      issues.push({ type: 'GIÁ_THẤP_BẤT_THƯỜNG', record: r });
    }
    if (r.price > 150000000) {
      issues.push({ type: 'GIÁ_CAO_BẤT_THƯỜNG', record: r });
    }
    if (!r.product_url || !r.product_url.startsWith('http')) {
      issues.push({ type: 'THIẾU_LINK_SAN_PHAM', record: r });
    }
    if (!r.ram_gb || !r.rom_gb) {
      issues.push({ type: 'THIẾU_THONG_TIN_RAM_ROM', record: r });
    }
  }

  // 2. In Bảng Ma trận Độ phủ
  console.log('📊 1. MA TRẬN ĐỘ PHỦ THEO 23 HÃNG & 6 NHÀ BÁN LẺ:');
  const tableData = [];
  let zeroCountBrands = [];

  for (const b of CANONICAL_BRANDS) {
    const row = {
      'Hãng máy': b,
      'CellphoneS': brandStoreMatrix[b]['CellphoneS'] || 0,
      'Hoàng Hà': brandStoreMatrix[b]['Hoàng Hà Mobile'] || 0,
      'TGDD': brandStoreMatrix[b]['Thế Giới Di Động'] || 0,
      'FPT Shop': brandStoreMatrix[b]['FPT Shop'] || 0,
      'Di Động Việt': brandStoreMatrix[b]['Di Động Việt'] || 0,
      'Viettel': brandStoreMatrix[b]['Viettel Store'] || 0,
      'Mới': brandConditionMatrix[b].new,
      'Cũ': brandConditionMatrix[b].used,
      'TỔNG CỘNG': brandConditionMatrix[b].total
    };
    if (brandConditionMatrix[b].total === 0) {
      zeroCountBrands.push(b);
    }
    tableData.push(row);
  }
  console.table(tableData);

  // 3. Đánh giá Cảnh báo Bỏ sót (Zero-count Check)
  console.log('\n🚨 2. KIỂM TRA CẢNH BÁO BỎ SÓT (ZERO-COUNT AUDIT):');
  if (zeroCountBrands.length > 0) {
    console.log(`   ❌ PHÁT HIỆN ${zeroCountBrands.length} HÃNG CHƯA CÓ DỮ LIỆU: ${zeroCountBrands.join(', ')}`);
    console.log(`   👉 Hãy chạy cào bổ sung với lệnh: node crawl_vn_prices.js --brand <ten_hang>`);
  } else {
    console.log(`   ✅ HOÀN HẢO: 100% tất cả ${CANONICAL_BRANDS.length} hãng đều đã có dữ liệu máy!`);
  }

  // 4. Kiểm tra Chất lượng Dữ liệu
  console.log('\n🧹 3. KIỂM TRA CHẤT LƯỢNG DỮ LIỆU (DATA INTEGRITY):');
  const issueTypes = {};
  for (const iss of issues) {
    issueTypes[iss.type] = (issueTypes[iss.type] || 0) + 1;
  }
  if (issues.length === 0) {
    console.log('   ✅ Không phát hiện bất kỳ bản ghi lỗi giá, thiếu link hay thiếu RAM/ROM nào.');
  } else {
    console.log(`   ⚠️ Phát hiện ${issues.length} cảnh báo chất lượng:`);
    for (const [k, v] of Object.entries(issueTypes)) {
      console.log(`      - ${k}: ${v} trường hợp`);
    }
  }

  // 5. Xuất báo cáo ra file JSON
  const auditReport = {
    audited_at: new Date().toISOString(),
    total_records: records.length,
    canonical_brands_count: CANONICAL_BRANDS.length,
    zero_count_brands: zeroCountBrands,
    summary_by_brand: brandConditionMatrix,
    quality_issues_count: issues.length,
    quality_issues_summary: issueTypes
  };

  const reportPath = 'vn_audit_report.json';
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2), 'utf-8');
  console.log(`\n💾 Đã lưu báo cáo đối soát chi tiết tại: ${reportPath}\n`);
}

auditData();

