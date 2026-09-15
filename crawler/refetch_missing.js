import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { parseDeviceSpecsFromHtml } from './src/specCrawler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REFETCH_LIST_FILE = path.resolve(__dirname, 'missing_to_refetch.json');
const SPECS_DIR = path.resolve(__dirname, '..', 'device_specs');
const ALL_SPECS_JSONL = path.resolve(__dirname, '..', 'gsmarena_all_specs.jsonl');
const SPECS_PROGRESS_FILE = path.resolve(__dirname, 'specs_progress.json');
const GOOD_PROXIES_FILE = path.resolve(__dirname, 'good_proxies.json');

async function getLiveProxy() {
  if (fs.existsSync(GOOD_PROXIES_FILE)) {
    try {
      const list = JSON.parse(fs.readFileSync(GOOD_PROXIES_FILE, 'utf8'));
      if (Array.isArray(list) && list.length > 0) {
        return list[0].proxyStr || list[0];
      }
    } catch (e) {}
  }
  return null;
}

async function fetchHtml(url, proxyStr = null) {
  const config = {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.gsmarena.com/'
    },
    validateStatus: () => true
  };

  if (proxyStr) {
    const [h, p] = proxyStr.split(':');
    config.httpsAgent = new HttpsProxyAgent(`http://${h}:${p}`, { timeout: 10000 });
  }

  const res = await axios.get(url, config);
  if (res.status === 200 && res.data && res.data.includes('id="specs-list"')) {
    return res.data;
  }
  throw new Error(`HTTP ${res.status}`);
}

async function runRefetch() {
  console.log(chalk.blue.bold('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║              TIẾN TRÌNH CÀO BÙ CÁC MÁY BỊ THIẾU / LỖI DATA           ║'));
  console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════════════════╝\n'));

  if (!fs.existsSync(REFETCH_LIST_FILE)) {
    console.log(chalk.red(`Không tìm thấy file ${REFETCH_LIST_FILE}. Vui lòng chạy audit_scraped_data.js trước!`));
    return;
  }

  const items = JSON.parse(fs.readFileSync(REFETCH_LIST_FILE, 'utf8'));
  if (!items || items.length === 0) {
    console.log(chalk.green.bold('🎉 Không có máy nào bị thiếu hoặc lỗi data cần cào bù!'));
    return;
  }

  console.log(chalk.yellow(`🎯 Tìm thấy ${items.length} máy cần cào bù. Bắt đầu xử lý...\n`));

  const proxy = await getLiveProxy();
  console.log(chalk.gray(`  • Proxy sử dụng: `) + chalk.cyan(proxy || 'Direct Connection'));

  let progressSet = new Set();
  if (fs.existsSync(SPECS_PROGRESS_FILE)) {
    try {
      progressSet = new Set(JSON.parse(fs.readFileSync(SPECS_PROGRESS_FILE, 'utf8')));
    } catch (e) {}
  }

  let successCount = 0;

  for (let i = 0; i < items.length; i++) {
    const device = items[i];
    console.log(chalk.cyan(`[${i + 1}/${items.length}] `) + chalk.white(`Đang cào: [${device.brand}] ${device.deviceName}...`));

    try {
      let html = null;
      try {
        html = await fetchHtml(device.deviceUrl, proxy);
      } catch (errProxy) {
        html = await fetchHtml(device.deviceUrl, null);
      }

      const specData = parseDeviceSpecsFromHtml(html, device.deviceUrl);
      const fullRecord = {
        sttTong: device.sttTong,
        sttHang: device.sttHang,
        brand: device.brand,
        deviceName: specData.deviceName || device.deviceName,
        deviceUrl: device.deviceUrl,
        thumbnailUrl: device.thumbnailUrl || '',
        imageUrl: specData.imageUrl || device.thumbnailUrl || '',
        specs: specData.specs,
        scrapedAt: new Date().toISOString()
      };

      // 1. Lưu vào file JSON từng hãng
      const safeBrand = device.brand.replace(/[^a-zA-Z0-9_-]/g, '_');
      const brandFilePath = path.join(SPECS_DIR, `${safeBrand}_specs.json`);
      let brandData = [];
      if (fs.existsSync(brandFilePath)) {
        try {
          brandData = JSON.parse(fs.readFileSync(brandFilePath, 'utf8'));
        } catch (e) {
          brandData = [];
        }
      }
      const existingIdx = brandData.findIndex(d => d.deviceUrl === device.deviceUrl);
      if (existingIdx >= 0) {
        brandData[existingIdx] = fullRecord;
      } else {
        brandData.push(fullRecord);
      }
      fs.writeFileSync(brandFilePath, JSON.stringify(brandData, null, 2), 'utf8');

      // 2. Ghi vào file tổng JSONL
      fs.appendFileSync(ALL_SPECS_JSONL, JSON.stringify(fullRecord) + '\n', 'utf8');

      // 3. Cập nhật specs_progress.json
      progressSet.add(device.deviceUrl);
      fs.writeFileSync(SPECS_PROGRESS_FILE, JSON.stringify(Array.from(progressSet)), 'utf8');

      console.log(chalk.green(`   ✅ Thành công! Đã lưu đầy đủ thông số cho ${device.deviceName}`));
      successCount++;
    } catch (err) {
      console.log(chalk.red(`   ❌ Thất bại: ${err.message}`));
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(chalk.green.bold(`\n🎉 HOÀN TẤT CÀO BÙ: Thành công ${successCount}/${items.length} máy!\n`));
}

runRefetch();
