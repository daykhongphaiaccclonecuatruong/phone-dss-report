import fs from 'fs';

function cleanForMatch(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/chính hãng|vn\/a|máy cũ|đổi trả|99%|like new|trưng bày|giá rẻ|\b5g\b|\b4g\b|\b\d+gb\b|\b\d+tb\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Load CSV helper
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // simple csv parser handling quotes
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

const vnRows = parseCSV('d:/Documents/Website/tools_dt/phone_dss/data/05_device_aggregated_prices.csv');
const gsmDevices = parseCSV('d:/Documents/Website/tools_dt/phone_dss/data/01_devices.csv');
const gsmSpecs = parseCSV('d:/Documents/Website/tools_dt/phone_dss/data/02_device_specs.csv');
const gsmBenchmarks = parseCSV('d:/Documents/Website/tools_dt/phone_dss/data/04_device_benchmarks.csv');

console.log(`Số lượng SKU tại VN: ${vnRows.length}`);
console.log(`Số lượng Devices GSMArena: ${gsmDevices.length}`);

// Build specs and benchmarks map
const specsMap = new Map();
for (const s of gsmSpecs) specsMap.set(s.device_id, s);

const benchMap = new Map();
for (const b of gsmBenchmarks) benchMap.set(b.device_id, b);

// Build device lookup map
const gsmLookup = [];
for (const d of gsmDevices) {
  const b = d.brand.toLowerCase();
  const cleanName = cleanForMatch(d.device_name);
  gsmLookup.push({
    device_id: d.device_id,
    brand: b,
    clean_name: cleanName,
    raw_name: d.device_name,
    release_year: d.release_year,
    image_url: d.image_url
  });
}

let matchedCount = 0;
const unmatched = [];
const unifiedRecords = [];

for (const vn of vnRows) {
  const b = (vn.brand || '').toLowerCase();
  const cleanP = cleanForMatch(vn.product_name);

  // Match against gsmLookup
  let bestMatch = null;
  let maxScore = 0;

  for (const gsm of gsmLookup) {
    if (gsm.brand === b) {
      if (cleanP === gsm.clean_name) {
        bestMatch = gsm;
        maxScore = 100;
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

  if (bestMatch) {
    matchedCount++;
    const spec = specsMap.get(bestMatch.device_id) || {};
    const bench = benchMap.get(bestMatch.device_id) || {};

    unifiedRecords.push({
      variant_id: vn.variant_id,
      device_id: bestMatch.device_id,
      brand: vn.brand,
      product_name: vn.product_name,
      gsm_name: bestMatch.raw_name,
      ram_gb: parseInt(vn.ram_gb, 10) || 8,
      rom_gb: parseInt(vn.rom_gb, 10) || 128,
      condition: vn.condition,
      min_price: parseInt(vn.min_price, 10) || 0,
      avg_price: parseInt(vn.avg_price, 10) || 0,
      max_price: parseInt(vn.max_price, 10) || 0,
      best_retailer: vn.best_retailer,
      best_retailer_url: vn.best_retailer_url,
      savings_amount: parseInt(vn.savings_amount, 10) || 0,
      // Specs
      chipset: spec.chipset || 'Standard SoC',
      cpu: spec.cpu || '',
      gpu: spec.gpu || '',
      screen_size_inch: parseFloat(spec.screen_size_inch) || 6.67,
      refresh_rate_hz: parseInt(spec.refresh_rate_hz, 10) || 120,
      display_type: spec.display_type || 'AMOLED',
      resolution_width: parseInt(spec.resolution_width, 10) || 1080,
      resolution_height: parseInt(spec.resolution_height, 10) || 2400,
      main_camera_mp: parseInt(spec.main_camera_mp, 10) || 50,
      has_ois: parseInt(spec.has_ois, 10) || 0,
      optical_zoom_x: parseFloat(spec.optical_zoom_x) || 0.0,
      battery_mah: parseInt(spec.battery_mah, 10) || 5000,
      charging_w: parseInt(spec.charging_w, 10) || 33,
      weight_g: parseFloat(spec.weight_g) || 190.0,
      thickness_mm: parseFloat(spec.thickness_mm) || 8.0,
      has_5g: parseInt(spec.has_5g, 10) || 1,
      // Benchmarks
      antutu_score: parseInt(bench.antutu_base, 10) || 600000,
      geekbench_single: parseInt(bench.geekbench_single, 10) || 0,
      geekbench_multi: parseInt(bench.geekbench_multi, 10) || 0
    });
  } else {
    unmatched.push({ brand: vn.brand, product: vn.product_name });
  }
}

console.log(`\n==============================================`);
console.log(`KẾT QUẢ KHỚP NỐI:`);
console.log(`✅ Khớp thành công: ${matchedCount} / ${vnRows.length} (${(matchedCount / vnRows.length * 100).toFixed(1)}%)`);
console.log(`❌ Chưa khớp: ${unmatched.length}`);
console.log(`==============================================`);
if (unmatched.length > 0) {
  console.log('Mẫu 5 máy chưa khớp:', unmatched.slice(0, 5));
}
