import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import * as XLSX from 'xlsx';
import { CONFIG } from '../config.js';

// Biến đếm STT tổng toàn bộ thiết bị
let globalDeviceCounter = 0;

/**
 * Đảm bảo các thư mục đầu ra tồn tại
 */
export function ensureOutputDirs() {
  if (!fs.existsSync(CONFIG.BRANDS_DIR)) {
    fs.mkdirSync(CONFIG.BRANDS_DIR, { recursive: true });
  }
}

/**
 * Xuất trang thống kê riêng: gsmarena_brands_summary.csv
 */
export async function exportBrandsSummaryCsv(brandsWithResults) {
  const csvWriter = createObjectCsvWriter({
    path: CONFIG.SUMMARY_CSV,
    header: [
      { id: 'stt', title: 'STT' },
      { id: 'brandName', title: 'Tên Hãng' },
      { id: 'expectedDevices', title: 'Số Máy GSMArena Báo' },
      { id: 'actualDevices', title: 'Số Máy Cào Thực Tế' },
      { id: 'status', title: 'Trạng Thái Khớp' },
      { id: 'errorCount', title: 'Số Lượng Lỗi (Cần cào tay)' },
      { id: 'brandUrl', title: 'GSMArena Brand URL' }
    ],
    append: false,
    encoding: 'utf8'
  });

  const records = brandsWithResults.map((b, idx) => ({
    stt: idx + 1,
    brandName: b.name,
    expectedDevices: b.expectedDevices,
    actualDevices: b.actualDevices || 0,
    status: (b.actualDevices || 0) >= b.expectedDevices ? 'Đầy đủ (100%)' : 'Chênh lệch',
    errorCount: b.errorCount || 0,
    brandUrl: b.url
  }));

  await csvWriter.writeRecords(records);
}

/**
 * Khởi tạo hoặc xóa file CSV tổng hợp để chuẩn bị cào mới
 */
export function resetGlobalCsv() {
  globalDeviceCounter = 0;
  if (fs.existsSync(CONFIG.OUTPUT_CSV)) {
    fs.unlinkSync(CONFIG.OUTPUT_CSV);
  }
  const csvWriter = createObjectCsvWriter({
    path: CONFIG.OUTPUT_CSV,
    header: [
      { id: 'sttTong', title: 'STT Tổng' },
      { id: 'sttHang', title: 'STT Hãng' },
      { id: 'brand', title: 'Hãng' },
      { id: 'deviceName', title: 'Tên Máy' },
      { id: 'deviceUrl', title: 'Device URL' },
      { id: 'thumbnailUrl', title: 'Thumbnail URL' },
      { id: 'status', title: 'Trạng Thái' },
      { id: 'errorNote', title: 'Ghi Chú Lỗi (Cào tay)' }
    ],
    append: false,
    encoding: 'utf8'
  });
  return csvWriter;
}

/**
 * Append danh sách máy của 1 hãng vào file CSV tổng hợp
 */
export async function appendDevicesToGlobalCsv(devices) {
  if (!devices || devices.length === 0) return;

  const fileExists = fs.existsSync(CONFIG.OUTPUT_CSV);
  const csvWriter = createObjectCsvWriter({
    path: CONFIG.OUTPUT_CSV,
    header: [
      { id: 'sttTong', title: 'STT Tổng' },
      { id: 'sttHang', title: 'STT Hãng' },
      { id: 'brand', title: 'Hãng' },
      { id: 'deviceName', title: 'Tên Máy' },
      { id: 'deviceUrl', title: 'Device URL' },
      { id: 'thumbnailUrl', title: 'Thumbnail URL' },
      { id: 'status', title: 'Trạng Thái' },
      { id: 'errorNote', title: 'Ghi Chú Lỗi (Cào tay)' }
    ],
    append: fileExists,
    encoding: 'utf8'
  });

  const recordsWithGlobalStt = devices.map(d => {
    globalDeviceCounter++;
    return {
      sttTong: globalDeviceCounter,
      sttHang: d.sttHang,
      brand: d.brand,
      deviceName: d.deviceName,
      deviceUrl: d.deviceUrl,
      thumbnailUrl: d.thumbnailUrl,
      status: d.status,
      errorNote: d.errorNote || ''
    };
  });

  await csvWriter.writeRecords(recordsWithGlobalStt);
  return recordsWithGlobalStt;
}

/**
 * Lưu file CSV riêng cho từng hãng vào thư mục brands_csv/
 */
export async function exportSingleBrandCsv(brandIndex, brandName, devices) {
  ensureOutputDirs();
  const safeName = brandName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${String(brandIndex).padStart(2, '0')}_${safeName}.csv`;
  const filePath = path.join(CONFIG.BRANDS_DIR, fileName);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'sttHang', title: 'STT Hãng' },
      { id: 'brand', title: 'Hãng' },
      { id: 'deviceName', title: 'Tên Máy' },
      { id: 'deviceUrl', title: 'Device URL' },
      { id: 'thumbnailUrl', title: 'Thumbnail URL' },
      { id: 'status', title: 'Trạng Thái' },
      { id: 'errorNote', title: 'Ghi Chú Lỗi (Cào tay)' }
    ],
    append: false,
    encoding: 'utf8'
  });

  await csvWriter.writeRecords(devices);
  return filePath;
}

/**
 * Xuất file Excel (.xlsx) đa sheet: Sheet 1 là Tổng quan, các sheet tiếp theo là từng hãng
 */
export function exportMultiSheetExcel(summaryList, brandDevicesMap) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Tổng quan Hãng
  const summaryData = summaryList.map((b, idx) => ({
    'STT': idx + 1,
    'Tên Hãng': b.name,
    'Số Máy GSMArena Báo': b.expectedDevices,
    'Số Máy Cào Được': b.actualDevices || 0,
    'Trạng Thái': (b.actualDevices || 0) >= b.expectedDevices ? 'Đầy đủ (100%)' : 'Chênh lệch',
    'Số Máy Lỗi (Cần cào tay)': b.errorCount || 0,
    'GSMArena URL': b.url
  }));
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, '00_Tong_Quan_Hang');

  // Các sheet tiếp theo: Mỗi hãng 1 sheet
  summaryList.forEach((b, idx) => {
    const devices = brandDevicesMap.get(b.name) || [];
    const sheetData = devices.map(d => ({
      'STT Hãng': d.sttHang,
      'Hãng': d.brand,
      'Tên Máy': d.deviceName,
      'Device URL': d.deviceUrl,
      'Thumbnail URL': d.thumbnailUrl,
      'Trạng Thái': d.status,
      'Ghi Chú Lỗi': d.errorNote || ''
    }));

    // Tên sheet trong Excel tối đa 31 ký tự
    const cleanBrandName = b.name.replace(/[\\/?*[\]:]/g, '_');
    const sheetName = `${String(idx + 1).padStart(2, '0')}_${cleanBrandName}`.substring(0, 31);
    
    const brandSheet = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, brandSheet, sheetName);
  });

  XLSX.writeFile(workbook, CONFIG.OUTPUT_EXCEL);
}

/**
 * Đọc tiến độ
 */
export function loadProgress() {
  if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return { completedBrands: [], lastUpdated: null };
    }
  }
  return { completedBrands: [], lastUpdated: null };
}

/**
 * Lưu tiến độ
 */
export function saveProgress(brandName, actualCount, expectedCount, errorCount) {
  const progress = loadProgress();
  const existingIndex = progress.completedBrands.findIndex(b => b.name === brandName);
  
  const record = {
    name: brandName,
    actualCount,
    expectedCount,
    errorCount: errorCount || 0,
    isMatch: actualCount >= expectedCount,
    completedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    progress.completedBrands[existingIndex] = record;
  } else {
    progress.completedBrands.push(record);
  }

  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
}
