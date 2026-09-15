import fs from 'fs';
import path from 'path';
import { crawlCellphoneS } from './src/vn_scrapers/cellphonesScraper.js';
import { crawlHoangHa } from './src/vn_scrapers/hoanghaScraper.js';
import { crawlTGDD } from './src/vn_scrapers/tgddScraper.js';
import { crawlFPTShop } from './src/vn_scrapers/fptScraper.js';
import { crawlDiDongViet } from './src/vn_scrapers/didongvietScraper.js';
import { crawlViettelStore } from './src/vn_scrapers/viettelScraper.js';
import { exportAllData } from './src/vnExporter.js';

// Parse command line arguments
const args = process.argv.slice(2);
let storeFilter = null;
let brandFilter = null;
let conditionFilter = 'all';
let isFresh = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--store' && args[i + 1]) {
    storeFilter = args[i + 1].toLowerCase();
    i++;
  } else if (args[i] === '--brand' && args[i + 1]) {
    brandFilter = args[i + 1].toLowerCase();
    i++;
  } else if (args[i] === '--condition' && args[i + 1]) {
    conditionFilter = args[i + 1].toLowerCase();
    i++;
  } else if (args[i] === '--fresh') {
    isFresh = true;
  }
}

const PROGRESS_FILE = 'vn_crawler_progress.json';

function loadProgress() {
  if (isFresh || !fs.existsSync(PROGRESS_FILE)) {
    return { records: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch (e) {
    return { records: [] };
  }
}

function saveProgress(records) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ records, updated_at: new Date().toISOString() }, null, 2), 'utf-8');
}

async function main() {
  console.log('================================================================');
  console.log('🚀 MULTI-STORE VIETNAM PHONE PRICE CRAWLER (NEW & USED)');
  console.log('================================================================');
  console.log(`📌 Cấu hình chạy:`);
  console.log(`   - Cửa hàng: ${storeFilter ? storeFilter.toUpperCase() : 'TẤT CẢ 6 NHÀ BÁN LẺ'}`);
  console.log(`   - Thương hiệu: ${brandFilter ? brandFilter.toUpperCase() : 'TẤT CẢ 23 HÃNG'}`);
  console.log(`   - Tình trạng máy: ${conditionFilter.toUpperCase()}`);
  console.log(`   - Chế độ: ${isFresh ? 'Cào mới hoàn toàn (--fresh)' : 'Cộng dồn / Tiếp tục'}\n`);

  const progress = loadProgress();
  let allRecords = progress.records || [];

  const shouldCrawl = (storeName) => {
    if (!storeFilter) return true;
    return storeName.toLowerCase().includes(storeFilter);
  };

  try {
    // 1. CellphoneS
    if (shouldCrawl('cellphones')) {
      const cpsRecords = await crawlCellphoneS({ brandFilter, conditionFilter });
      allRecords = allRecords.concat(cpsRecords);
      saveProgress(allRecords);
    }

    // 2. Hoàng Hà Mobile
    if (shouldCrawl('hoangha') && conditionFilter !== 'used') {
      const hhRecords = await crawlHoangHa({ brandFilter });
      allRecords = allRecords.concat(hhRecords);
      saveProgress(allRecords);
    }

    // 3. Thế Giới Di Động
    if (shouldCrawl('tgdd')) {
      const tgddRecords = await crawlTGDD({ brandFilter, conditionFilter });
      allRecords = allRecords.concat(tgddRecords);
      saveProgress(allRecords);
    }

    // 4. FPT Shop
    if (shouldCrawl('fpt')) {
      const fptRecords = await crawlFPTShop({ brandFilter, conditionFilter });
      allRecords = allRecords.concat(fptRecords);
      saveProgress(allRecords);
    }

    // 5. Di Động Việt
    if (shouldCrawl('didongviet')) {
      const ddvRecords = await crawlDiDongViet({ brandFilter, conditionFilter });
      allRecords = allRecords.concat(ddvRecords);
      saveProgress(allRecords);
    }

    // 6. Viettel Store
    if (shouldCrawl('viettel') && conditionFilter !== 'used') {
      const vtRecords = await crawlViettelStore({ brandFilter });
      allRecords = allRecords.concat(vtRecords);
      saveProgress(allRecords);
    }

    // Deduplicate by (variant_id + retailer + condition)
    const uniqueMap = new Map();
    for (const r of allRecords) {
      const uniqueKey = `${r.variant_id}_${r.retailer}_${r.condition}`;
      uniqueMap.set(uniqueKey, r);
    }
    const finalRecords = Array.from(uniqueMap.values());

    // Export to CSV & JSON
    exportAllData(finalRecords, '../phone_dss/data');
    exportAllData(finalRecords, './output');

    console.log('\n================================================================');
    console.log(`🎉 HOÀN TẤT CÀO DỮ LIỆU THÀNH CÔNG: Tổng ${finalRecords.length} dòng giá điện thoại.`);
    console.log('================================================================\n');

  } catch (err) {
    console.error(`\n❌ LỖI TRONG QUÁ TRÌNH CÀO: ${err.message}`);
  }
}

main();

