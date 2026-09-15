import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { SmartProxyManager, BASE_DELAY_MS } from './src/smartProxyScraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPECS_DIR = path.resolve(__dirname, '..', 'device_specs');
const ALL_SPECS_JSONL = path.resolve(__dirname, '..', 'gsmarena_all_specs.jsonl');
const SPECS_PROGRESS_FILE = path.resolve(__dirname, 'specs_progress.json');

const CONCURRENCY = 10; // Chạy 10 luồng cào song song độc lập

function ensureDirs() {
  if (!fs.existsSync(SPECS_DIR)) {
    fs.mkdirSync(SPECS_DIR, { recursive: true });
  }
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  return result;
}

function loadDevicesFromCsv() {
  if (!fs.existsSync(CONFIG.OUTPUT_CSV)) {
    throw new Error(`Không tìm thấy file ${CONFIG.OUTPUT_CSV}. Vui lòng chạy cào danh sách máy trước!`);
  }

  const content = fs.readFileSync(CONFIG.OUTPUT_CSV, 'utf8').trim().split('\n');
  const rows = content.slice(1);
  const devices = [];

  for (const row of rows) {
    const parts = parseCsvLine(row);
    if (parts.length >= 5 && parts[4].startsWith('https://www.gsmarena.com/')) {
      devices.push({
        sttTong: parseInt(parts[0], 10),
        sttHang: parseInt(parts[1], 10),
        brand: parts[2],
        deviceName: parts[3],
        deviceUrl: parts[4],
        thumbnailUrl: parts[5] || ''
      });
    }
  }

  return devices;
}

function loadSpecsProgress() {
  if (fs.existsSync(SPECS_PROGRESS_FILE)) {
    try {
      const data = fs.readFileSync(SPECS_PROGRESS_FILE, 'utf8');
      return new Set(JSON.parse(data));
    } catch (e) {
      return new Set();
    }
  }
  return new Set();
}

// Khóa ghi file an toàn chống xung đột giữa 5 luồng
let isSavingProgress = false;
function saveRecordSafely(brand, record, progressSet) {
  while (isSavingProgress) {
    // chờ nhịp nhỏ
  }
  isSavingProgress = true;
  try {
    // 1. Ghi vào file tổng jsonl
    fs.appendFileSync(ALL_SPECS_JSONL, JSON.stringify(record) + '\n', 'utf8');

    // 2. Ghi vào file hãng json
    const safeBrand = brand.replace(/[^a-zA-Z0-9_-]/g, '_');
    const brandFilePath = path.join(SPECS_DIR, `${safeBrand}_specs.json`);
    let brandData = [];
    if (fs.existsSync(brandFilePath)) {
      try {
        brandData = JSON.parse(fs.readFileSync(brandFilePath, 'utf8'));
      } catch (e) {
        brandData = [];
      }
    }
    const existingIdx = brandData.findIndex(d => d.deviceUrl === record.deviceUrl);
    if (existingIdx >= 0) {
      brandData[existingIdx] = record;
    } else {
      brandData.push(record);
    }
    fs.writeFileSync(brandFilePath, JSON.stringify(brandData, null, 2), 'utf8');

    // 3. Ghi vào progress.json
    fs.writeFileSync(SPECS_PROGRESS_FILE, JSON.stringify(Array.from(progressSet)), 'utf8');
  } finally {
    isSavingProgress = false;
  }
}

async function main() {
  console.log(chalk.blue.bold('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║   GSMARENA 10-WORKER PARALLEL SCRAPER - ĐỘC LẬP & TỐI ĐA HIỆU NĂNG   ║'));
  console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════════════════╝\n'));

  ensureDirs();

  const args = process.argv.slice(2);
  const targetBrandArgIndex = args.indexOf('--brand');
  const targetBrand = targetBrandArgIndex !== -1 ? args[targetBrandArgIndex + 1]?.toLowerCase() : null;

  const allDevices = loadDevicesFromCsv();
  let targetDevices = allDevices;

  if (targetBrand) {
    targetDevices = allDevices.filter(d => d.brand.toLowerCase() === targetBrand);
    console.log(chalk.yellow(`🎯 Chế độ cào riêng hãng "${targetBrand}": ${targetDevices.length} máy`));
  }

  const totalTargetCount = targetDevices.length;
  const progressSet = loadSpecsProgress();
  const remainingDevices = targetDevices.filter(d => !progressSet.has(d.deviceUrl));

  console.log(chalk.cyan(`══════════════════════════════════════════════════════════════════════`));
  console.log(chalk.bold.white(` 📋 ĐỐI SOÁT TIẾN ĐỘ HIỆN TẠI:`));
  console.log(chalk.gray(`  • Tổng số máy trong danh sách : `) + chalk.white.bold(`${totalTargetCount.toLocaleString()} máy`));
  console.log(chalk.gray(`  • Đã hoàn thành trước đó      : `) + chalk.green.bold(`${progressSet.size.toLocaleString()} máy`));
  console.log(chalk.gray(`  • Bắt đầu tiếp tục từ máy số  : `) + chalk.yellow.bold(`STT ${progressSet.size + 1} (${remainingDevices.length.toLocaleString()} máy còn lại)`));
  console.log(chalk.gray(`  • Số luồng cào song song      : `) + chalk.magenta.bold(`${CONCURRENCY} Luồng (5 Workers)`));
  console.log(chalk.cyan(`══════════════════════════════════════════════════════════════════════\n`));

  if (remainingDevices.length === 0) {
    console.log(chalk.green.bold('🎉 Tất cả máy trong danh sách đã được cào xong thông số kỹ thuật!'));
    return;
  }

  // Khởi động Hệ thống quản lý Proxy & Producer ngầm
  const proxyManager = new SmartProxyManager();
  await proxyManager.refreshProxies();
  proxyManager.startBackgroundProducer();

  const startTime = Date.now();
  let completedCount = 0;
  const deviceQueue = [...remainingDevices];

  // Hàm thực thi cho 1 Worker
  async function runWorker(workerId) {
    const workerTag = chalk.magenta.bold(`[W${workerId}]`);
    let activeProxy = await proxyManager.getLiveProxy();
    let consecutiveScraped = 0;

    console.log(chalk.gray(`🚀 ${workerTag} Khởi động với Proxy ban đầu: `) + chalk.yellow(`${activeProxy}`));

    while (deviceQueue.length > 0) {
      const device = deviceQueue.shift();
      if (!device) break;

      // Giãn cách từ tốn 3.0s - 4.2s mỗi luồng
      const randomJitter = Math.floor(Math.random() * 1200);
      const delayMs = BASE_DELAY_MS + randomJitter;
      await new Promise(r => setTimeout(r, delayMs));

      try {
        const specData = await proxyManager.fetchDeviceSpec(activeProxy, device.deviceUrl);
        consecutiveScraped++;
        proxyManager.reportProxyResult(activeProxy, true);

        const fullRecord = {
          sttTong: device.sttTong,
          sttHang: device.sttHang,
          brand: device.brand,
          deviceName: specData.deviceName || device.deviceName,
          deviceUrl: device.deviceUrl,
          thumbnailUrl: device.thumbnailUrl,
          imageUrl: specData.imageUrl || device.thumbnailUrl,
          specs: specData.specs,
          scrapedAt: new Date().toISOString()
        };

        progressSet.add(device.deviceUrl);
        saveRecordSafely(device.brand, fullRecord, progressSet);
        completedCount++;

        const percent = (((progressSet.size) / totalTargetCount) * 100).toFixed(1);
        const elapsedMin = (Date.now() - startTime) / 60000;
        const totalSpeed = elapsedMin > 0 ? (completedCount / elapsedMin).toFixed(1) : '0';

        console.log(
          `${workerTag} ` +
          chalk.blue(`[${progressSet.size}/${totalTargetCount}] (${percent}%) [${totalSpeed} m/p] `) +
          chalk.cyan(`[${device.brand}] `) +
          chalk.white.bold(`${device.deviceName} `) +
          chalk.green(`✅ [${activeProxy}] `) +
          chalk.yellow(`(${consecutiveScraped}m liên tục) `) +
          chalk.gray(`| Buffer: ${proxyManager.readyBuffer.length} | VIP: ${proxyManager.workingPool.size}`)
        );

      } catch (err) {
        // Trả lại máy này vào đầu hàng đợi để cào lại
        deviceQueue.unshift(device);

        const is429 = err.is429 || err.message === 'RATE_LIMIT_429';
        proxyManager.reportProxyResult(activeProxy, false, is429);

        if (is429) {
          console.log(chalk.yellow(`\n   ⚠️ ${workerTag} Proxy [${activeProxy}] gặp 429 sau ${consecutiveScraped} máy -> Đã xóa khỏi kho VIP. Đang đổi proxy mới...`));
        } else {
          console.log(chalk.gray(`\n   ℹ️ ${workerTag} Proxy [${activeProxy}] rớt mạng sau ${consecutiveScraped} máy -> Đã xóa khỏi kho VIP. Đang đổi proxy mới...`));
        }

        // Bốc ngay proxy sống mới từ Buffer (0ms)
        activeProxy = await proxyManager.getLiveProxy();
        consecutiveScraped = 0;
        console.log(chalk.green(`   ✨ ${workerTag} Đã chuyển sang Proxy mới: [${activeProxy}]\n`));
      }
    }

    console.log(chalk.green(`🏁 ${workerTag} Đã hoàn thành toàn bộ phần việc!`));
  }

  // Khởi động đồng loạt 5 Workers
  console.log(chalk.yellow.bold(`\n⚡ Đang kích hoạt đồng thời ${CONCURRENCY} Luồng cào song song...\n`));
  const workerPromises = Array.from({ length: CONCURRENCY }, (_, i) => runWorker(i + 1));

  await Promise.all(workerPromises);

  proxyManager.stopBackgroundProducer();

  console.log('\n\n' + chalk.green.bold('╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.green.bold('║               HOÀN TẤT TIẾN TRÌNH CÀO THÔNG SỐ KỸ THUẬT              ║'));
  console.log(chalk.green.bold('╚══════════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.white(`  • Tổng số máy đã cào : `) + chalk.green.bold(`${progressSet.size.toLocaleString()} máy`));
  console.log(chalk.yellow('\n  📂 DỮ LIỆU ĐÃ XUẤT RA:'));
  console.log(chalk.gray(`  1. File JSONL tổng hợp toàn bộ : `) + chalk.green(ALL_SPECS_JSONL));
  console.log(chalk.gray(`  2. Thư mục JSON từng hãng      : `) + chalk.green(SPECS_DIR));
  console.log(chalk.green.bold('══════════════════════════════════════════════════════════════════════\n'));
}

main();
