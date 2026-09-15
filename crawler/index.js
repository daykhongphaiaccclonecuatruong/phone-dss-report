import chalk from 'chalk';
import fs from 'fs';
import { CONFIG } from './config.js';
import { IpBannedError } from './src/client.js';
import { fetchBrands } from './src/brandCrawler.js';
import { fetchDevicesForBrand } from './src/deviceCrawler.js';
import {
  ensureOutputDirs,
  resetGlobalCsv,
  appendDevicesToGlobalCsv,
  exportSingleBrandCsv,
  exportBrandsSummaryCsv,
  exportMultiSheetExcel,
  loadProgress,
  saveProgress
} from './src/exporter.js';

/**
 * Hiển thị Banner giới thiệu
 */
function printBanner() {
  console.log(chalk.blue.bold('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║       GSMARENA SMART PHONE SCRAPER - BÁO CÁO & XUẤT ĐA ĐỊNH DẠNG     ║'));
  console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════════════════╝\n'));
  console.log(chalk.gray(`📊 File Trang Thống Kê Tổng : `) + chalk.green(CONFIG.SUMMARY_CSV));
  console.log(chalk.gray(`📁 File CSV Toàn Bộ Máy     : `) + chalk.green(CONFIG.OUTPUT_CSV));
  console.log(chalk.gray(`📑 File Excel Đa Sheet      : `) + chalk.green(CONFIG.OUTPUT_EXCEL));
  console.log(chalk.gray(`📂 Thư mục CSV Từng Hãng    : `) + chalk.green(CONFIG.BRANDS_DIR));
  console.log(chalk.gray(`⏱️  Delay an toàn            : `) + chalk.yellow(`${CONFIG.MIN_DELAY_MS}ms - ${CONFIG.MAX_DELAY_MS}ms\n`));
}

/**
 * Hiển thị bảng tóm tắt
 */
function printBrandsOverview(brands) {
  console.log(chalk.bold.yellow('📊 ──── DANH SÁCH TOÀN BỘ CÁC HÃNG & SỐ LƯỢNG MÁY DỰ KIẾN ────'));
  
  let totalExpected = 0;
  brands.forEach((b, index) => {
    totalExpected += b.expectedDevices;
    const num = String(index + 1).padStart(3, ' ');
    const name = b.name.padEnd(20, ' ');
    const count = `${b.expectedDevices} máy`.padStart(12, ' ');
    console.log(` ${chalk.gray(num)}. ${chalk.white.bold(name)} : ${chalk.cyan(count)}`);
  });

  console.log(chalk.bold.yellow('─────────────────────────────────────────────────────────────'));
  console.log(chalk.green.bold(`🎯 Tổng số hãng: ${brands.length} hãng | Tổng số máy dự kiến: ${totalExpected.toLocaleString()} máy`));
  console.log(chalk.bold.yellow('─────────────────────────────────────────────────────────────\n'));
}

async function main() {
  printBanner();
  ensureOutputDirs();

  const args = process.argv.slice(2);
  const isStatsOnly = args.includes('--stats-only');
  const targetBrandArgIndex = args.indexOf('--brand');
  const targetBrand = targetBrandArgIndex !== -1 ? args[targetBrandArgIndex + 1]?.toLowerCase() : null;
  const isFresh = args.includes('--fresh'); // Cào mới hoàn toàn

  try {
    // BƯỚC 1: Quét danh sách tất cả các hãng từ makers.php3
    const brands = await fetchBrands();
    if (!brands || brands.length === 0) {
      console.log(chalk.red('❌ Không tải được danh sách hãng. Vui lòng kiểm tra lại kết nối mạng.'));
      return;
    }

    // Hiển thị bảng tổng quan
    printBrandsOverview(brands);

    // Xuất file thống kê ban đầu
    await exportBrandsSummaryCsv(brands);

    if (isStatsOnly) {
      console.log(chalk.magenta('ℹ️ Chế độ --stats-only: Đã xuất bảng thống kê tổng số lượng hãng + máy ra file CSV.'));
      return;
    }

    if (isFresh || !fs.existsSync(CONFIG.OUTPUT_CSV)) {
      resetGlobalCsv();
    }

    const progress = isFresh ? { completedBrands: [] } : loadProgress();
    const completedMap = new Map(progress.completedBrands.map(b => [b.name, b]));

    let brandsToScrape = brands;
    if (targetBrand) {
      brandsToScrape = brands.filter(b => b.name.toLowerCase() === targetBrand);
      if (brandsToScrape.length === 0) {
        console.log(chalk.red(`❌ Không tìm thấy hãng nào có tên khớp với "${targetBrand}".`));
        return;
      }
    }

    console.log(chalk.bold.green('🚀 BẮT ĐẦU QUÁ TRÌNH CÀO TUẦN TỰ TỪNG HÃNG (CÓ ĐỐI SOÁT & LƯU LỖI)...\n'));

    const brandDevicesMap = new Map();
    let totalScrapedAll = 0;
    let totalErrorsAll = 0;

    for (let i = 0; i < brandsToScrape.length; i++) {
      const brand = brandsToScrape[i];
      const brandIndex = i + 1;
      const progressPrefix = `[${brandIndex}/${brandsToScrape.length}]`;

      // Kiểm tra nếu đã cào xong trước đó (chế độ resume)
      if (!isFresh && completedMap.has(brand.name) && !targetBrand) {
        const prev = completedMap.get(brand.name);
        brand.actualDevices = prev.actualCount;
        brand.errorCount = prev.errorCount || 0;
        console.log(chalk.gray(`${progressPrefix} ⏩ Bỏ qua ${brand.name} (Đã cào trước đó: ${prev.actualCount} máy | ${brand.errorCount} lỗi)`));
        totalScrapedAll += prev.actualCount;
        totalErrorsAll += brand.errorCount;
        continue;
      }

      console.log(chalk.blue.bold(`\n${progressPrefix} 📱 Đang cào hãng: ${chalk.white.underline(brand.name)} (GSMArena báo: ${brand.expectedDevices} máy)`));

      // Cào danh sách máy của hãng (tự động phân trang & bắt lỗi từng máy)
      const devices = await fetchDevicesForBrand(brand, brandIndex, (pageInfo) => {
        process.stdout.write(
          chalk.gray(`   ├── Trang ${pageInfo.pageIndex}: Lấy được ${pageInfo.pageDevicesCount} máy | Tích lũy: ${pageInfo.totalSoFar} máy...\r`)
        );
      });

      const errorCount = devices.filter(d => d.status === 'Error').length;
      brand.actualDevices = devices.length;
      brand.errorCount = errorCount;
      brandDevicesMap.set(brand.name, devices);

      console.log(`\n   ├── Thu thập xong hãng ${chalk.bold(brand.name)}: Tổng cộng ${chalk.green.bold(devices.length)} máy (${errorCount > 0 ? chalk.red(`${errorCount} máy bị lỗi`) : chalk.green('0 lỗi')}).`);

      // 1. Lưu vào file CSV riêng của hãng trong brands_csv/
      const brandCsvPath = await exportSingleBrandCsv(brandIndex, brand.name, devices);
      console.log(chalk.gray(`   ├── Đã lưu file CSV riêng của hãng: ${brandCsvPath}`));

      // 2. Append vào file CSV tổng hợp gsmarena_devices.csv
      await appendDevicesToGlobalCsv(devices);

      totalScrapedAll += devices.length;
      totalErrorsAll += errorCount;

      // 3. Đối soát số lượng máy
      if (devices.length >= brand.expectedDevices) {
        console.log(chalk.green(`   ✅ Đối soát: ${devices.length}/${brand.expectedDevices} máy (Khớp 100% hoặc có máy mới cập nhật).`));
      } else {
        const diff = brand.expectedDevices - devices.length;
        console.log(chalk.yellow(`   ⚠️ Đối soát: ${devices.length}/${brand.expectedDevices} máy (Lệch ${diff} máy - máy lỗi đã được ghi nhận trong CSV).`));
      }

      // 4. Lưu Checkpoint tiến độ
      saveProgress(brand.name, devices.length, brand.expectedDevices, errorCount);

      // 5. Cập nhật lại file tóm tắt sau mỗi hãng
      await exportBrandsSummaryCsv(brands);
    }

    // BƯỚC CUỐI: Xuất toàn bộ ra file Excel (.xlsx) đa Sheet
    console.log(chalk.cyan('\n📑 Đang tổng hợp và tạo file Excel (.xlsx) đa Sheet...'));
    try {
      exportMultiSheetExcel(brands, brandDevicesMap);
      console.log(chalk.green(`✅ Đã xuất thành công file Excel đa Sheet: ${CONFIG.OUTPUT_EXCEL}`));
    } catch (err) {
      console.log(chalk.yellow(`⚠️ Không thể tạo file Excel (có thể do quá nhiều sheet): ${err.message}`));
    }

    // Báo cáo hoàn thành chi tiết
    console.log('\n' + chalk.green.bold('╔══════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.green.bold('║                     BÁO CÁO HOÀN THÀNH CÀO DỮ LIỆU                   ║'));
    console.log(chalk.green.bold('╚══════════════════════════════════════════════════════════════════════╝'));
    console.log(chalk.white(`  • Tổng số hãng đã xử lý     : `) + chalk.cyan.bold(`${brandsToScrape.length} hãng`));
    console.log(chalk.white(`  • Tổng số máy thu thập được : `) + chalk.green.bold(`${totalScrapedAll.toLocaleString()} máy`));
    console.log(chalk.white(`  • Số máy ghi nhận lỗi       : `) + (totalErrorsAll > 0 ? chalk.red.bold(`${totalErrorsAll} máy (đã lưu sẵn trong CSV để lọc/cào tay)`) : chalk.green('0 máy')));
    console.log(chalk.yellow('\n  📂 DANH SÁCH FILE KẾT QUẢ ĐÃ XUẤT:'));
    console.log(chalk.gray('  1. File Thống Kê Tổng Hãng + Máy : ') + chalk.green(CONFIG.SUMMARY_CSV));
    console.log(chalk.gray('  2. File CSV Toàn Bộ Máy Có STT   : ') + chalk.green(CONFIG.OUTPUT_CSV));
    console.log(chalk.gray('  3. File Excel Đa Sheet (Từng Hãng): ') + chalk.green(CONFIG.OUTPUT_EXCEL));
    console.log(chalk.gray('  4. Thư Mục CSV Từng Hãng Riêng   : ') + chalk.green(CONFIG.BRANDS_DIR));
    console.log(chalk.green.bold('══════════════════════════════════════════════════════════════════════\n'));

  } catch (error) {
    if (error instanceof IpBannedError) {
      console.log(chalk.red.bold(`\n⛔ TIẾN TRÌNH TẠM DỪNG DO BỊ CHẶN TRUY CẬP (BAN IP).`));
      console.log(chalk.yellow(`💡 Đổi IP hoặc bật VPN rồi chạy lại, tool sẽ tự động chạy tiếp từ hãng đang cào!`));
    } else {
      console.log(chalk.red.bold(`\n❌ ĐÃ XẢY RA LỖI: ${error.message}`));
      console.error(error);
    }
  }
}

main();
