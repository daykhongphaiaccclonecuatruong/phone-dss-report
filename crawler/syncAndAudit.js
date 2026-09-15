import fs from 'fs';
import { CONFIG } from './config.js';
import { fetchBrands } from './src/brandCrawler.js';
import { fetchDevicesForBrand } from './src/deviceCrawler.js';
import {
  exportBrandsSummaryCsv,
  resetGlobalCsv,
  appendDevicesToGlobalCsv,
  exportSingleBrandCsv,
  exportMultiSheetExcel,
  saveProgress,
  loadProgress
} from './src/exporter.js';

async function syncAndAudit() {
  console.log('🔍 Đang kiểm tra đối soát toàn bộ 126 hãng...');
  const brands = await fetchBrands();
  
  // Đọc danh sách các file trong brands_csv để tổng hợp lại
  const brandDevicesMap = new Map();
  resetGlobalCsv();

  let totalScraped = 0;
  let reScrapedCount = 0;

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    const brandIndex = i + 1;
    const safeName = brand.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${String(brandIndex).padStart(2, '0')}_${safeName}.csv`;
    const filePath = `${CONFIG.BRANDS_DIR}/${fileName}`;

    let devices = [];

    // Nếu file chưa có hoặc số lượng máy quá lệch (như Panasonic hoặc Infinix), cào lại ngay
    const needsReScrape = !fs.existsSync(filePath) || brand.name === 'Panasonic' || brand.name === 'Infinix';

    if (needsReScrape) {
      console.log(`🔄 Đang cào cập nhật cho hãng: ${brand.name}...`);
      devices = await fetchDevicesForBrand(brand, brandIndex);
      await exportSingleBrandCsv(brandIndex, brand.name, devices);
      reScrapedCount++;
    } else {
      // Đọc từ file CSV của hãng
      const content = fs.readFileSync(filePath, 'utf8').trim().split('\n').slice(1);
      devices = content.map((line, idx) => {
        const parts = line.split(',');
        return {
          sttHang: idx + 1,
          brand: parts[1] || brand.name,
          deviceName: parts[2] || '',
          deviceUrl: parts[3] || '',
          thumbnailUrl: parts[4] || '',
          status: parts[5] || 'Success',
          errorNote: parts[6] || ''
        };
      });
    }

    brand.actualDevices = devices.length;
    brand.errorCount = devices.filter(d => d.status === 'Error').length;
    brandDevicesMap.set(brand.name, devices);

    await appendDevicesToGlobalCsv(devices);
    totalScraped += devices.length;

    saveProgress(brand.name, devices.length, brand.expectedDevices, brand.errorCount);
  }

  // Cập nhật lại Summary CSV và Excel
  await exportBrandsSummaryCsv(brands);
  exportMultiSheetExcel(brands, brandDevicesMap);

  console.log('\n✅ ĐÃ HOÀN TẤT ĐỒNG BỘ VÀ ĐỐI SOÁT TOÀN BỘ DỮ LIỆU!');
  console.log(`• Tổng số hãng: ${brands.length}`);
  console.log(`• Tổng số máy sau đối soát: ${totalScraped.toLocaleString()} máy`);
}

syncAndAudit();
