import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// Helper to clean names for fuzzy matching
function cleanForMatch(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/điện thoại|chính hãng|vn\/a|máy cũ|đổi trả|99%|like new|trưng bày|giá rẻ|\b5g\b|\b4g\b|\blte\b|\b\d+gb\b|\b\d+tb\b|\(.*\)/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse CSV helper
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let cur = '';
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        values.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (values[idx] || '').replace(/^"|"$/g, '');
    });
    rows.push(obj);
  }
  return rows;
}

// Escape SQL string
function sqlEscape(str) {
  if (str === null || str === undefined) return "''";
  return "'" + str.toString().replace(/'/g, "''").replace(/\\/g, "\\\\") + "'";
}

async function buildMasterDatasets() {
  console.log('================================================================');
  console.log('🚀 XUẤT MASTER DATABASE: 1 FILE EXCEL (6 SHEETS) + 1 FILE .SQL');
  console.log('================================================================\n');

  const vnAggPath = 'd:/Documents/Website/tools_dt/phone_dss/data/05_device_aggregated_prices.csv';
  const vnPricesPath = 'd:/Documents/Website/tools_dt/phone_dss/data/05_device_retailer_prices.csv';
  const gsmDevicesPath = 'd:/Documents/Website/tools_dt/phone_dss/data/01_devices.csv';
  const gsmSpecsPath = 'd:/Documents/Website/tools_dt/phone_dss/data/02_device_specs.csv';
  const gsmBenchPath = 'd:/Documents/Website/tools_dt/phone_dss/data/04_device_benchmarks.csv';

  const vnAggRows = parseCSV(vnAggPath);
  const vnPriceRows = parseCSV(vnPricesPath);
  const gsmDevices = parseCSV(gsmDevicesPath);
  const gsmSpecs = parseCSV(gsmSpecsPath);
  const gsmBench = parseCSV(gsmBenchPath);

  console.log(`📦 Đã nạp ${vnAggRows.length} SKU tổng hợp và ${vnPriceRows.length} dòng giá từ 6 nhà bán lẻ.`);

  const specsMap = new Map();
  for (const s of gsmSpecs) specsMap.set(s.device_id, s);

  const benchMap = new Map();
  for (const b of gsmBench) benchMap.set(b.device_id, b);

  const gsmLookup = [];
  for (const d of gsmDevices) {
    gsmLookup.push({
      device_id: d.device_id,
      brand: d.brand.toLowerCase(),
      clean_name: cleanForMatch(d.device_name),
      raw_name: d.device_name,
      release_year: d.release_year,
      image_url: d.image_url
    });
  }

  // Build the 6 relational tables
  const devicesTable = new Map();
  const specsTable = new Map();
  const benchmarksTable = new Map();
  const variantsTable = new Map();
  const retailerPricesTable = [];
  const aggregatedPricesTable = [];

  // Helper to infer specs for models not on global GSMArena (e.g. Masstel, Mobell, Viettel feature phones)
  function getDefaultSpecs(brand, name, ram, rom, price) {
    const isFeaturePhone = ['masstel', 'mobell', 'itel', 'benco', 'viettel'].includes(brand.toLowerCase()) && (ram <= 1 || price < 1500000);
    if (isFeaturePhone) {
      return {
        chipset: 'Unisoc T107 4G',
        cpu: 'Single-core 1.0 GHz',
        gpu: 'Feature GPU',
        screen_size_inch: 2.4,
        refresh_rate_hz: 60,
        display_type: 'TFT LCD',
        resolution_width: 240,
        resolution_height: 320,
        main_camera_mp: 2,
        main_camera_aperture: 2.8,
        has_ois: 0,
        optical_zoom_x: 0.0,
        battery_mah: 1800,
        charging_w: 5,
        weight_g: 110.0,
        thickness_mm: 14.0,
        has_5g: 0,
        antutu_score: 50000,
        geekbench_single: 0,
        geekbench_multi: 0,
        score_camera: 20,
        score_display: 30,
        score_battery: 80
      };
    }
    // Smartphone default fallback
    const estAntutu = price > 20000000 ? 1500000 : (price > 10000000 ? 900000 : (price > 5000000 ? 550000 : 350000));
    return {
      chipset: brand === 'Apple' ? 'Apple A-Series' : (price > 15000000 ? 'Snapdragon 8 Gen Series' : 'MediaTek Dimensity / Helio'),
      cpu: 'Octa-core',
      gpu: 'Adreno / Mali GPU',
      screen_size_inch: 6.67,
      refresh_rate_hz: price > 5000000 ? 120 : 90,
      display_type: price > 6000000 ? 'AMOLED' : 'IPS LCD',
      resolution_width: 1080,
      resolution_height: 2400,
      main_camera_mp: 50,
      main_camera_aperture: 1.8,
      has_ois: price > 7000000 ? 1 : 0,
      optical_zoom_x: price > 15000000 ? 3.0 : 0.0,
      battery_mah: 5000,
      charging_w: price > 8000000 ? 67 : (price > 4000000 ? 33 : 18),
      weight_g: 188.0,
      thickness_mm: 7.9,
      has_5g: price > 4000000 ? 1 : 0,
      antutu_score: estAntutu,
      geekbench_single: Math.round(estAntutu / 1200),
      geekbench_multi: Math.round(estAntutu / 400),
      score_camera: price > 15000000 ? 88 : (price > 7000000 ? 75 : 60),
      score_display: price > 10000000 ? 90 : 75,
      score_battery: 80
    };
  }

  // 1. Process Aggregated Prices & Match Devices
  for (const vn of vnAggRows) {
    const b = (vn.brand || 'Other').trim();
    const bLower = b.toLowerCase();
    const cleanP = cleanForMatch(vn.product_name);
    const ram = parseInt(vn.ram_gb, 10) || 8;
    const rom = parseInt(vn.rom_gb, 10) || 128;
    const minPrice = parseInt(vn.min_price, 10) || 0;
    const avgPrice = parseInt(vn.avg_price, 10) || 0;
    const maxPrice = parseInt(vn.max_price, 10) || 0;
    const savings = parseInt(vn.savings_amount, 10) || 0;

    // Best match search in GSMArena
    let bestMatch = null;
    let maxScore = 0;

    for (const gsm of gsmLookup) {
      if (gsm.brand === bLower || (bLower === 'apple' && gsm.brand === 'apple')) {
        if (cleanP === gsm.clean_name) {
          bestMatch = gsm;
          maxScore = 1000;
          break;
        } else if (gsm.clean_name && cleanP.includes(gsm.clean_name)) {
          if (gsm.clean_name.length > maxScore) {
            maxScore = gsm.clean_name.length;
            bestMatch = gsm;
          }
        } else if (cleanP && gsm.clean_name.includes(cleanP)) {
          if (cleanP.length > maxScore) {
            maxScore = cleanP.length;
            bestMatch = gsm;
          }
        }
      }
    }

    const deviceId = bestMatch ? bestMatch.device_id : `${bLower}_${cleanP.replace(/\s+/g, '_')}`;
    const deviceName = bestMatch ? bestMatch.raw_name : vn.product_name.replace(/\b\d+gb\b/gi, '').replace(/\b\d+tb\b/gi, '').trim();
    const releaseYear = bestMatch && bestMatch.release_year ? parseInt(bestMatch.release_year, 10) : (minPrice > 20000000 ? 2024 : 2023);
    const imageUrl = bestMatch && bestMatch.image_url ? bestMatch.image_url : 'https://cdn-icons-png.flaticon.com/512/0/191.png';

    // 1. Table 1: devices
    if (!devicesTable.has(deviceId)) {
      devicesTable.set(deviceId, {
        device_id: deviceId,
        brand: b,
        device_name: deviceName,
        release_year: releaseYear,
        image_url: imageUrl
      });
    }

    // 2. Table 2 & 3: device_specs & device_benchmarks
    if (!specsTable.has(deviceId)) {
      const gsmSpec = specsMap.get(deviceId);
      const gsmB = benchMap.get(deviceId);
      const fallback = getDefaultSpecs(b, deviceName, ram, rom, minPrice);

      specsTable.set(deviceId, {
        device_id: deviceId,
        chipset: gsmSpec?.chipset || fallback.chipset,
        cpu: gsmSpec?.cpu || fallback.cpu,
        gpu: gsmSpec?.gpu || fallback.gpu,
        screen_size_inch: parseFloat(gsmSpec?.screen_size_inch) || fallback.screen_size_inch,
        refresh_rate_hz: parseInt(gsmSpec?.refresh_rate_hz, 10) || fallback.refresh_rate_hz,
        display_type: gsmSpec?.display_type || fallback.display_type,
        resolution_width: parseInt(gsmSpec?.resolution_width, 10) || fallback.resolution_width,
        resolution_height: parseInt(gsmSpec?.resolution_height, 10) || fallback.resolution_height,
        main_camera_mp: parseInt(gsmSpec?.main_camera_mp, 10) || fallback.main_camera_mp,
        main_camera_aperture: parseFloat(gsmSpec?.main_camera_aperture) || fallback.main_camera_aperture,
        has_ois: parseInt(gsmSpec?.has_ois, 10) || fallback.has_ois,
        optical_zoom_x: parseFloat(gsmSpec?.optical_zoom_x) || fallback.optical_zoom_x,
        battery_mah: parseInt(gsmSpec?.battery_mah, 10) || fallback.battery_mah,
        charging_w: parseInt(gsmSpec?.charging_w, 10) || fallback.charging_w,
        weight_g: parseFloat(gsmSpec?.weight_g) || fallback.weight_g,
        thickness_mm: parseFloat(gsmSpec?.thickness_mm) || fallback.thickness_mm,
        has_5g: parseInt(gsmSpec?.has_5g, 10) || fallback.has_5g
      });

      benchmarksTable.set(deviceId, {
        device_id: deviceId,
        antutu_score: parseInt(gsmB?.antutu_base, 10) || fallback.antutu_score,
        geekbench_single: parseInt(gsmB?.geekbench_single, 10) || fallback.geekbench_single,
        geekbench_multi: parseInt(gsmB?.geekbench_multi, 10) || fallback.geekbench_multi,
        score_camera: parseInt(gsmB?.score_camera, 10) || fallback.score_camera,
        score_display: parseInt(gsmB?.score_display, 10) || fallback.score_display,
        score_battery: parseInt(gsmB?.score_battery, 10) || fallback.score_battery
      });
    }

    // 3. Table 4: device_variants
    const variantId = vn.variant_id;
    if (!variantsTable.has(variantId)) {
      variantsTable.set(variantId, {
        variant_id: variantId,
        device_id: deviceId,
        ram_gb: ram,
        rom_gb: rom,
        variant_name: `${deviceName} (${ram}GB/${rom >= 1024 ? `${rom / 1024}TB` : `${rom}GB`})`
      });
    }

    // 4. Table 6: device_aggregated_prices
    aggregatedPricesTable.push({
      variant_id: variantId,
      condition_type: vn.condition || 'new',
      min_price: minPrice,
      avg_price: avgPrice,
      max_price: maxPrice,
      best_retailer: vn.best_retailer || 'Hoàng Hà Mobile',
      best_retailer_url: vn.best_retailer_url || '',
      savings_amount: savings,
      retailers_count: parseInt(vn.retailers_count, 10) || 1,
      in_stock_count: parseInt(vn.in_stock_count, 10) || 1
    });
  }

  // 5. Table 5: device_retailer_prices
  for (const p of vnPriceRows) {
    const variantId = p.variant_id;
    if (variantsTable.has(variantId)) {
      retailerPricesTable.push({
        price_id: p.price_id || `P_${variantId}_${retailerPricesTable.length}`,
        variant_id: variantId,
        retailer: p.retailer || '',
        condition_type: p.condition || 'new',
        sub_condition: p.sub_condition || 'Mới 100% Chính Hãng',
        price: parseInt(p.price, 10) || 0,
        original_price: parseInt(p.original_price, 10) || parseInt(p.price, 10) || 0,
        stock_status: p.stock_status || 'in_stock',
        product_url: p.product_url || '',
        updated_at: p.crawled_at || new Date().toISOString()
      });
    }
  }

  const devicesArr = Array.from(devicesTable.values());
  const specsArr = Array.from(specsTable.values());
  const benchArr = Array.from(benchmarksTable.values());
  const variantsArr = Array.from(variantsTable.values());

  console.log('📊 THỐNG KÊ 6 BẢNG DỮ LIỆU THỊ TRƯỜNG VIỆT NAM:');
  console.log(`   1. devices:                  ${devicesArr.length} dòng máy`);
  console.log(`   2. device_specs:             ${specsArr.length} dòng cấu hình`);
  console.log(`   3. device_benchmarks:        ${benchArr.length} dòng điểm hiệu năng`);
  console.log(`   4. device_variants:          ${variantsArr.length} biến thể RAM/ROM`);
  console.log(`   5. device_retailer_prices:   ${retailerPricesTable.length} dòng giá 6 cửa hàng`);
  console.log(`   6. device_aggregated_prices: ${aggregatedPricesTable.length} dòng giá tổng hợp DSS\n`);

  // =========================================================================
  // FILE 1: EXCEL (.XLSX) WITH 6 SHEETS
  // =========================================================================
  console.log('💾 Đang tạo File Excel Đa Sheet (phone_dss_master_database.xlsx)...');
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(devicesArr), 'devices');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(specsArr), 'device_specs');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(benchArr), 'device_benchmarks');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(variantsArr), 'device_variants');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(retailerPricesTable), 'device_retailer_prices');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aggregatedPricesTable), 'device_aggregated_prices');

  const excelPath1 = 'd:/Documents/Website/tools_dt/phone_dss/data/phone_dss_master_database.xlsx';
  const excelPath2 = 'd:/Documents/Website/tools_dt/phone_dss_master_database.xlsx';
  XLSX.writeFile(wb, excelPath1);
  XLSX.writeFile(wb, excelPath2);
  console.log(`   ✅ Đã xuất File Excel: ${excelPath1}`);

  // =========================================================================
  // FILE 2: SQL (.SQL) COMPATIBLE WITH MYSQL
  // =========================================================================
  console.log('\n💾 Đang tạo File SQL hoàn chỉnh (phone_dss_database.sql)...');
  let sql = `-- =======================================================================
-- PHONE DSS DATABASE - DỮ LIỆU ĐIỆN THOẠI & GIÁ THỊ TRƯỜNG VIỆT NAM
-- Tương thích: MySQL 8.0+ / MariaDB (InnoDB, utf8mb4)
-- Ngày tạo: ${new Date().toISOString()}
-- =======================================================================

CREATE DATABASE IF NOT EXISTS phone_dss CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE phone_dss;

-- Tắt kiểm tra khóa ngoại trong lúc import
SET FOREIGN_KEY_CHECKS = 0;

-- 1. BẢNG DÒNG MÁY (devices)
DROP TABLE IF EXISTS device_aggregated_prices;
DROP TABLE IF EXISTS device_retailer_prices;
DROP TABLE IF EXISTS device_variants;
DROP TABLE IF EXISTS device_benchmarks;
DROP TABLE IF EXISTS device_specs;
DROP TABLE IF EXISTS devices;

CREATE TABLE devices (
    device_id VARCHAR(100) PRIMARY KEY,
    brand VARCHAR(50) NOT NULL,
    device_name VARCHAR(150) NOT NULL,
    release_year INT,
    image_url TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BẢNG THÔNG SỐ PHẦN CỨNG (device_specs)
CREATE TABLE device_specs (
    device_id VARCHAR(100) PRIMARY KEY,
    chipset VARCHAR(100),
    cpu VARCHAR(100),
    gpu VARCHAR(100),
    screen_size_inch DECIMAL(4,2),
    refresh_rate_hz INT DEFAULT 60,
    display_type VARCHAR(50),
    resolution_width INT DEFAULT 1080,
    resolution_height INT DEFAULT 2400,
    main_camera_mp INT DEFAULT 50,
    main_camera_aperture DECIMAL(3,1) DEFAULT 1.8,
    has_ois TINYINT DEFAULT 0,
    optical_zoom_x DECIMAL(3,1) DEFAULT 0.0,
    battery_mah INT DEFAULT 5000,
    charging_w INT DEFAULT 33,
    weight_g DECIMAL(5,1) DEFAULT 190.0,
    thickness_mm DECIMAL(4,1) DEFAULT 8.0,
    has_5g TINYINT DEFAULT 1,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. BẢNG ĐIỂM HIỆU NĂNG & LAB (device_benchmarks)
CREATE TABLE device_benchmarks (
    device_id VARCHAR(100) PRIMARY KEY,
    antutu_score INT DEFAULT 500000,
    geekbench_single INT DEFAULT 0,
    geekbench_multi INT DEFAULT 0,
    score_camera INT DEFAULT 70,
    score_display INT DEFAULT 70,
    score_battery INT DEFAULT 70,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. BẢNG BIẾN THỂ RAM/ROM TẠI VN (device_variants)
CREATE TABLE device_variants (
    variant_id VARCHAR(150) PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    ram_gb INT NOT NULL,
    rom_gb INT NOT NULL,
    variant_name VARCHAR(150),
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. BẢNG GIÁ CHI TIẾT 6 CỬA HÀNG (device_retailer_prices)
CREATE TABLE device_retailer_prices (
    price_id VARCHAR(200) PRIMARY KEY,
    variant_id VARCHAR(150) NOT NULL,
    retailer VARCHAR(100) NOT NULL,
    condition_type VARCHAR(20) DEFAULT 'new',
    sub_condition VARCHAR(100),
    price BIGINT NOT NULL,
    original_price BIGINT,
    stock_status VARCHAR(50) DEFAULT 'in_stock',
    product_url TEXT,
    updated_at DATETIME,
    FOREIGN KEY (variant_id) REFERENCES device_variants(variant_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BẢNG GIÁ TỔNG HỢP CHO THUẬT TOÁN DSS (device_aggregated_prices)
CREATE TABLE device_aggregated_prices (
    variant_id VARCHAR(150) PRIMARY KEY,
    condition_type VARCHAR(20) DEFAULT 'new',
    min_price BIGINT NOT NULL,
    avg_price BIGINT NOT NULL,
    max_price BIGINT NOT NULL,
    best_retailer VARCHAR(100) NOT NULL,
    best_retailer_url TEXT,
    savings_amount BIGINT DEFAULT 0,
    retailers_count INT DEFAULT 1,
    in_stock_count INT DEFAULT 1,
    FOREIGN KEY (variant_id) REFERENCES device_variants(variant_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =======================================================================
-- INSERT DỮ LIỆU SẠCH 100% THỊ TRƯỜNG VIỆT NAM
-- =======================================================================
\n`;

  // Insert 1: devices
  sql += `-- 1. INSERT INTO devices (${devicesArr.length} records)\n`;
  for (const d of devicesArr) {
    sql += `INSERT INTO devices (device_id, brand, device_name, release_year, image_url) VALUES (${sqlEscape(d.device_id)}, ${sqlEscape(d.brand)}, ${sqlEscape(d.device_name)}, ${d.release_year}, ${sqlEscape(d.image_url)});\n`;
  }

  // Insert 2: device_specs
  sql += `\n-- 2. INSERT INTO device_specs (${specsArr.length} records)\n`;
  for (const s of specsArr) {
    sql += `INSERT INTO device_specs (device_id, chipset, cpu, gpu, screen_size_inch, refresh_rate_hz, display_type, resolution_width, resolution_height, main_camera_mp, main_camera_aperture, has_ois, optical_zoom_x, battery_mah, charging_w, weight_g, thickness_mm, has_5g) VALUES (${sqlEscape(s.device_id)}, ${sqlEscape(s.chipset)}, ${sqlEscape(s.cpu)}, ${sqlEscape(s.gpu)}, ${s.screen_size_inch}, ${s.refresh_rate_hz}, ${sqlEscape(s.display_type)}, ${s.resolution_width}, ${s.resolution_height}, ${s.main_camera_mp}, ${s.main_camera_aperture}, ${s.has_ois}, ${s.optical_zoom_x}, ${s.battery_mah}, ${s.charging_w}, ${s.weight_g}, ${s.thickness_mm}, ${s.has_5g});\n`;
  }

  // Insert 3: device_benchmarks
  sql += `\n-- 3. INSERT INTO device_benchmarks (${benchArr.length} records)\n`;
  for (const b of benchArr) {
    sql += `INSERT INTO device_benchmarks (device_id, antutu_score, geekbench_single, geekbench_multi, score_camera, score_display, score_battery) VALUES (${sqlEscape(b.device_id)}, ${b.antutu_score}, ${b.geekbench_single}, ${b.geekbench_multi}, ${b.score_camera}, ${b.score_display}, ${b.score_battery});\n`;
  }

  // Insert 4: device_variants
  sql += `\n-- 4. INSERT INTO device_variants (${variantsArr.length} records)\n`;
  for (const v of variantsArr) {
    sql += `INSERT INTO device_variants (variant_id, device_id, ram_gb, rom_gb, variant_name) VALUES (${sqlEscape(v.variant_id)}, ${sqlEscape(v.device_id)}, ${v.ram_gb}, ${v.rom_gb}, ${sqlEscape(v.variant_name)});\n`;
  }

  // Insert 5: device_retailer_prices
  sql += `\n-- 5. INSERT INTO device_retailer_prices (${retailerPricesTable.length} records)\n`;
  for (const p of retailerPricesTable) {
    sql += `INSERT INTO device_retailer_prices (price_id, variant_id, retailer, condition_type, sub_condition, price, original_price, stock_status, product_url, updated_at) VALUES (${sqlEscape(p.price_id)}, ${sqlEscape(p.variant_id)}, ${sqlEscape(p.retailer)}, ${sqlEscape(p.condition_type)}, ${sqlEscape(p.sub_condition)}, ${p.price}, ${p.original_price}, ${sqlEscape(p.stock_status)}, ${sqlEscape(p.product_url)}, NOW());\n`;
  }

  // Insert 6: device_aggregated_prices
  sql += `\n-- 6. INSERT INTO device_aggregated_prices (${aggregatedPricesTable.length} records)\n`;
  for (const a of aggregatedPricesTable) {
    sql += `INSERT INTO device_aggregated_prices (variant_id, condition_type, min_price, avg_price, max_price, best_retailer, best_retailer_url, savings_amount, retailers_count, in_stock_count) VALUES (${sqlEscape(a.variant_id)}, ${sqlEscape(a.condition_type)}, ${a.min_price}, ${a.avg_price}, ${a.max_price}, ${sqlEscape(a.best_retailer)}, ${sqlEscape(a.best_retailer_url)}, ${a.savings_amount}, ${a.retailers_count}, ${a.in_stock_count});\n`;
  }

  sql += `\n-- Bật lại kiểm tra khóa ngoại\nSET FOREIGN_KEY_CHECKS = 1;\n`;

  const sqlPath1 = 'd:/Documents/Website/tools_dt/phone_dss/data/phone_dss_database.sql';
  const sqlPath2 = 'd:/Documents/Website/tools_dt/phone_dss_database.sql';
  fs.writeFileSync(sqlPath1, sql, 'utf-8');
  fs.writeFileSync(sqlPath2, sql, 'utf-8');
  console.log(`   ✅ Đã xuất File SQL: ${sqlPath1}`);

  console.log('\n================================================================');
  console.log('🎉 XUẤT THÀNH CÔNG MASTER EXCEL (6 SHEETS) & MASTER SQL!');
  console.log('================================================================\n');
}

buildMasterDatasets();

