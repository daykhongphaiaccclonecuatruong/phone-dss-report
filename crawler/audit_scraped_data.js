import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.resolve(__dirname, '..', 'gsmarena_devices.csv');
const SPECS_DIR = path.resolve(__dirname, '..', 'device_specs');
const PROGRESS_FILE = path.resolve(__dirname, 'specs_progress.json');
const JSONL_FILE = path.resolve(__dirname, '..', 'gsmarena_all_specs.jsonl');

const AUDIT_REPORT_FILE = path.resolve(__dirname, 'audit_report.json');
const REFETCH_LIST_FILE = path.resolve(__dirname, 'missing_to_refetch.json');

/**
 * Trích xuất chuẩn xác dòng CSV của GSMArena
 * Xử lý an toàn các tên máy hoặc URL chứa dấu phẩy
 */
function parseDeviceCsvLine(line) {
  const urlIdx = line.indexOf('https://www.gsmarena.com/');
  if (urlIdx === -1) return null;

  // Phần trước URL: sttTong, sttHang, brand, deviceName
  const prefix = line.substring(0, urlIdx).trim().replace(/,$/, '');
  const urlAndRest = line.substring(urlIdx).trim();

  // Tìm kết thúc của URL (.php)
  const phpIdx = urlAndRest.indexOf('.php');
  if (phpIdx === -1) return null;

  const deviceUrl = urlAndRest.substring(0, phpIdx + 4);
  const afterUrl = urlAndRest.substring(phpIdx + 4).replace(/^,/, '');
  const thumbUrlMatch = afterUrl.match(/(https?:\/\/[^,]+)/);
  const thumbnailUrl = thumbUrlMatch ? thumbUrlMatch[1] : '';

  // Parse phần prefix (sttTong, sttHang, brand, deviceName)
  const prefixParts = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < prefix.length; i++) {
    const c = prefix[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) {
      prefixParts.push(cur.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  prefixParts.push(cur.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

  if (prefixParts.length < 4) return null;

  return {
    sttTong: parseInt(prefixParts[0], 10),
    sttHang: parseInt(prefixParts[1], 10),
    brand: prefixParts[2],
    deviceName: prefixParts[3],
    deviceUrl,
    thumbnailUrl
  };
}

function loadCsvDevices() {
  if (!fs.existsSync(CSV_FILE)) {
    throw new Error(`Không tìm thấy file ${CSV_FILE}`);
  }

  const content = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
  const rows = content.slice(1);
  const devices = [];

  for (const row of rows) {
    if (!row.trim()) continue;
    const parsed = parseDeviceCsvLine(row);
    if (parsed) {
      devices.push(parsed);
    }
  }
  return devices;
}

function loadAllScrapedSpecs() {
  const specsMap = new Map(); // url -> record

  // 1. Đọc từ thư mục device_specs/*.json (nguồn chuẩn theo từng hãng)
  if (fs.existsSync(SPECS_DIR)) {
    const files = fs.readdirSync(SPECS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const filePath = path.join(SPECS_DIR, file);
        const records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(records)) {
          for (const rec of records) {
            if (rec && rec.deviceUrl) {
              specsMap.set(rec.deviceUrl, rec);
            }
          }
        }
      } catch (e) {
        console.error(chalk.red(`Lỗi đọc file ${file}: ${e.message}`));
      }
    }
  }

  // 2. Đối soát thêm với file tổng jsonl nếu có máy chưa nằm trong folder
  if (fs.existsSync(JSONL_FILE)) {
    try {
      const lines = fs.readFileSync(JSONL_FILE, 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const rec = JSON.parse(line);
          if (rec && rec.deviceUrl && !specsMap.has(rec.deviceUrl)) {
            specsMap.set(rec.deviceUrl, rec);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  return specsMap;
}

export function runAudit() {
  console.log(chalk.blue.bold('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║      AUDIT DATA CRAWLER - KIỂM TRA MÁY THIẾU & DỮ LIỆU BỊ THIẾU      ║'));
  console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.cyan('🔍 Đang nạp danh sách gốc từ CSV và đối soát với toàn bộ dữ liệu cào...'));
  const csvDevices = loadCsvDevices();
  const scrapedMap = loadAllScrapedSpecs();

  console.log(chalk.gray(`  • Tổng số máy gốc trong CSV     : `) + chalk.white.bold(`${csvDevices.length.toLocaleString()} máy`));
  console.log(chalk.gray(`  • Tổng số bản ghi đã cào được   : `) + chalk.white.bold(`${scrapedMap.size.toLocaleString()} máy\n`));

  const missingDevices = [];
  const emptySpecsDevices = [];
  const incompleteDataDevices = [];
  const validDevices = [];

  for (const device of csvDevices) {
    const scraped = scrapedMap.get(device.deviceUrl);

    if (!scraped) {
      // 1. Máy hoàn toàn CHƯA CÀO ĐƯỢC
      missingDevices.push({
        sttTong: device.sttTong,
        sttHang: device.sttHang,
        brand: device.brand,
        deviceName: device.deviceName,
        deviceUrl: device.deviceUrl,
        reason: 'CHƯA_CÀO (Missing in database)'
      });
      continue;
    }

    const specs = scraped.specs || {};
    const specKeys = Object.keys(specs);
    const specKeysCount = specKeys.length;

    // Đếm tổng số thông số chi tiết con
    let totalSubPropertiesCount = 0;
    for (const category of Object.values(specs)) {
      if (typeof category === 'object' && category !== null) {
        totalSubPropertiesCount += Object.keys(category).length;
      }
    }

    if (specKeysCount === 0 || totalSubPropertiesCount === 0) {
      // 2. Đã cào nhưng specs rỗng
      emptySpecsDevices.push({
        sttTong: device.sttTong,
        sttHang: device.sttHang,
        brand: device.brand,
        deviceName: scraped.deviceName || device.deviceName,
        deviceUrl: device.deviceUrl,
        reason: 'SPECS_RỖNG (0 categories/properties)',
        specCategoriesCount: 0,
        subPropertiesCount: 0
      });
    } else if (specKeysCount < 3 || totalSubPropertiesCount < 5) {
      // 3. Quá ít thông số (nghi ngờ bị lỗi HTML / captcha cản)
      incompleteDataDevices.push({
        sttTong: device.sttTong,
        sttHang: device.sttHang,
        brand: device.brand,
        deviceName: scraped.deviceName || device.deviceName,
        deviceUrl: device.deviceUrl,
        reason: `DỮ_LIỆU_QUÁ_ÍT (${specKeysCount} danh mục, ${totalSubPropertiesCount} thông số con)`,
        specCategoriesCount: specKeysCount,
        subPropertiesCount: totalSubPropertiesCount,
        categories: specKeys
      });
    } else {
      // 4. Hợp lệ đầy đủ
      validDevices.push({
        sttTong: device.sttTong,
        brand: device.brand,
        deviceName: scraped.deviceName || device.deviceName,
        specCategoriesCount: specKeysCount,
        subPropertiesCount: totalSubPropertiesCount
      });
    }
  }

  // Hiển thị kết quả tổng hợp
  console.log(chalk.cyan(`══════════════════════════════════════════════════════════════════════`));
  console.log(chalk.bold.white(` 📊 KẾT QUẢ ĐỐI SOÁT & KIỂM ĐỊNH TOÀN BỘ DATA:`));
  console.log(chalk.green(`  ✅ 1. Máy cào đầy đủ & hoàn chỉnh : `) + chalk.green.bold(`${validDevices.length.toLocaleString()} máy`) + chalk.gray(` (${((validDevices.length / csvDevices.length) * 100).toFixed(2)}%)`));
  console.log(chalk.red(`  ❌ 2. Máy bị thiếu hoàn toàn (chưa cào) : `) + chalk.red.bold(`${missingDevices.length.toLocaleString()} máy`));
  console.log(chalk.yellow(`  ⚠️  3. Máy cào được nhưng SPECS rỗng    : `) + chalk.yellow.bold(`${emptySpecsDevices.length.toLocaleString()} máy`));
  console.log(chalk.magenta(`  ⚠️  4. Máy cào được nhưng QUÁ ÍT DATA   : `) + chalk.magenta.bold(`${incompleteDataDevices.length.toLocaleString()} máy`));
  console.log(chalk.cyan(`══════════════════════════════════════════════════════════════════════\n`));

  // In danh sách chi tiết các máy cần xử lý
  if (missingDevices.length > 0) {
    console.log(chalk.red.bold(`❌ DANH SÁCH ${missingDevices.length} MÁY BỊ THIẾU HOÀN TOÀN:`));
    missingDevices.forEach((d, i) => {
      console.log(chalk.red(`  ${i + 1}. [STT ${d.sttTong}] [${d.brand}] ${d.deviceName} `) + chalk.gray(`-> ${d.deviceUrl}`));
    });
    console.log('');
  }

  if (emptySpecsDevices.length > 0) {
    console.log(chalk.yellow.bold(`⚠️ DANH SÁCH ${emptySpecsDevices.length} MÁY CÓ SPECS BỊ RỖNG:`));
    emptySpecsDevices.forEach((d, i) => {
      console.log(chalk.yellow(`  ${i + 1}. [STT ${d.sttTong}] [${d.brand}] ${d.deviceName} `) + chalk.gray(`-> ${d.deviceUrl}`));
    });
    console.log('');
  }

  if (incompleteDataDevices.length > 0) {
    console.log(chalk.magenta.bold(`⚠️ DANH SÁCH ${incompleteDataDevices.length} MÁY DỮ LIỆU BỊ THIẾU/ÍT THÔNG SỐ:`));
    incompleteDataDevices.forEach((d, i) => {
      console.log(chalk.magenta(`  ${i + 1}. [STT ${d.sttTong}] [${d.brand}] ${d.deviceName} (${d.reason}) `) + chalk.gray(`-> ${d.deviceUrl}`));
    });
    console.log('');
  }

  // Tạo danh sách tổng hợp cần cào bù (Refetch List)
  const needRefetchList = [
    ...missingDevices,
    ...emptySpecsDevices,
    ...incompleteDataDevices
  ];

  // Xuất file báo cáo chi tiết
  const fullReport = {
    auditedAt: new Date().toISOString(),
    totalExpectedInCsv: csvDevices.length,
    validCompleteCount: validDevices.length,
    totalNeedRefetch: needRefetchList.length,
    summary: {
      missingCount: missingDevices.length,
      emptySpecsCount: emptySpecsDevices.length,
      incompleteDataCount: incompleteDataDevices.length
    },
    missingDevices,
    emptySpecsDevices,
    incompleteDataDevices
  };

  fs.writeFileSync(AUDIT_REPORT_FILE, JSON.stringify(fullReport, null, 2), 'utf8');
  fs.writeFileSync(REFETCH_LIST_FILE, JSON.stringify(needRefetchList, null, 2), 'utf8');

  console.log(chalk.green.bold(`📁 ĐÃ XUẤT BÁO CÁO CHI TIẾT:`));
  console.log(chalk.gray(`  1. File báo cáo đầy đủ Audit : `) + chalk.green(AUDIT_REPORT_FILE));
  console.log(chalk.gray(`  2. File danh sách cần cào bù  : `) + chalk.green(REFETCH_LIST_FILE));
  console.log(chalk.cyan(`══════════════════════════════════════════════════════════════════════\n`));

  return fullReport;
}

runAudit();
