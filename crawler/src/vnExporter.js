import fs from 'fs';
import path from 'path';

/**
 * Parses numeric price from a string (e.g., "19.490.000đ" -> 19490000)
 */
export function parsePriceNumber(raw) {
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  const cleaned = raw.toString().replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

/**
 * Extracts RAM and ROM (Storage) from product titles
 */
export function extractMemory(title) {
  if (!title) return { ram_gb: 8, rom_gb: 128 };

  let ram_gb = 8;
  let rom_gb = 128;

  // ROM matching: 1TB, 512GB, 256GB, 128GB, 64GB, 32GB
  const tbMatch = title.match(/\b(1|2)\s*TB\b/i);
  if (tbMatch) {
    rom_gb = parseInt(tbMatch[1], 10) * 1024;
  } else {
    const romMatch = title.match(/\b(32|64|128|256|512)\s*GB\b/i);
    if (romMatch) {
      rom_gb = parseInt(romMatch[1], 10);
    }
  }

  // Combined RAM/ROM matching: 8GB/256GB or 8GB-256GB or 8/256
  const comboMatch = title.match(/\b(\d{1,2})\s*(?:GB)?\s*[\/\-]\s*(\d{2,4})\s*GB\b/i);
  if (comboMatch) {
    ram_gb = parseInt(comboMatch[1], 10);
    rom_gb = parseInt(comboMatch[2], 10);
    return { ram_gb, rom_gb };
  }

  // RAM matching: 4GB, 6GB, 8GB, 12GB, 16GB, 24GB
  const ramMatch = title.match(/\b(3|4|6|8|12|16|24)\s*GB\s*(?:RAM)?\b/i);
  if (ramMatch && parseInt(ramMatch[1], 10) !== rom_gb) {
    ram_gb = parseInt(ramMatch[1], 10);
  }

  return { ram_gb, rom_gb };
}

/**
 * Normalizes brand names to canonical standard
 */
export function normalizeBrandName(rawBrand) {
  if (!rawBrand) return 'Other';
  const s = rawBrand.toLowerCase().trim();
  if (s.includes('apple') || s.includes('iphone')) return 'Apple';
  if (s.includes('samsung') || s.includes('galaxy')) return 'Samsung';
  if (s.includes('xiaomi') || s.includes('redmi') || s.includes('poco')) return 'Xiaomi';
  if (s.includes('oppo') || s.includes('reno') || s.includes('find')) return 'OPPO';
  if (s.includes('vivo') || s.includes('iqoo')) return 'vivo';
  if (s.includes('realme')) return 'realme';
  if (s.includes('honor')) return 'HONOR';
  if (s.includes('tecno')) return 'TECNO';
  if (s.includes('infinix')) return 'Infinix';
  if (s.includes('nubia') || s.includes('redmagic') || s.includes('zte')) return 'Nubia';
  if (s.includes('asus') || s.includes('rog')) return 'ASUS';
  if (s.includes('sony') || s.includes('xperia')) return 'Sony';
  if (s.includes('nothing')) return 'Nothing';
  if (s.includes('oneplus')) return 'OnePlus';
  if (s.includes('huawei')) return 'Huawei';
  if (s.includes('meizu')) return 'Meizu';
  if (s.includes('nokia') || s.includes('hmd')) return 'Nokia';
  if (s.includes('masstel')) return 'Masstel';
  if (s.includes('mobell')) return 'Mobell';
  if (s.includes('itel')) return 'Itel';
  if (s.includes('benco')) return 'Benco';
  if (s.includes('tcl')) return 'TCL';
  if (s.includes('motorola')) return 'Motorola';
  if (s.includes('inoi')) return 'INOI';
  if (s.includes('viettel') || s.includes('xphone')) return 'Viettel';
  return rawBrand.trim();
}

/**
 * Generates a clean slug ID from brand and model title
 */
export function generateVariantId(brand, cleanTitle, ram, rom) {
  const normBrand = normalizeBrandName(brand).toLowerCase();
  let baseName = cleanTitle.toLowerCase()
    .replace(/chính hãng|vn\/a|máy cũ|đổi trả|99%|like new|trưng bày|giá rẻ/gi, '')
    .replace(/\b\d+gb\b/gi, '')
    .replace(/\b\d+tb\b/gi, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!baseName.startsWith(normBrand)) {
    baseName = `${normBrand}_${baseName}`;
  }

  return `${baseName}_${ram}_${rom}`;
}

/**
 * Exports crawled data to JSON, Retailer Prices CSV, and Aggregated Prices CSV
 */
export function exportAllData(records, outputDir = 'd:/Documents/Website/tools_dt/phone_dss/data') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Raw JSON export
  const jsonPath = path.join(outputDir, '05_device_retailer_prices_raw.json');
  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), 'utf-8');

  // 2. Retailer Prices CSV
  const csvHeaders = [
    'price_id',
    'variant_id',
    'brand',
    'product_name',
    'retailer',
    'condition',
    'sub_condition',
    'price',
    'original_price',
    'ram_gb',
    'rom_gb',
    'stock_status',
    'product_url',
    'crawled_at'
  ];

  const csvRows = [csvHeaders.join(',')];
  for (const r of records) {
    const row = [
      `"${r.price_id || ''}"`,
      `"${r.variant_id || ''}"`,
      `"${r.brand || ''}"`,
      `"${(r.product_name || '').replace(/"/g, '""')}"`,
      `"${r.retailer || ''}"`,
      `"${r.condition || 'new'}"`,
      `"${r.sub_condition || ''}"`,
      r.price || 0,
      r.original_price || r.price || 0,
      r.ram_gb || 8,
      r.rom_gb || 128,
      `"${r.stock_status || 'in_stock'}"`,
      `"${r.product_url || ''}"`,
      `"${r.crawled_at || new Date().toISOString()}"`
    ];
    csvRows.push(row.join(','));
  }

  const retailerCsvPath = path.join(outputDir, '05_device_retailer_prices.csv');
  fs.writeFileSync(retailerCsvPath, csvRows.join('\n'), 'utf-8');

  // 3. Aggregated Prices CSV (Group by variant_id + condition)
  const grouped = new Map();

  for (const r of records) {
    if (!r.variant_id || r.price <= 0) continue;
    const key = `${r.variant_id}_${r.condition}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        variant_id: r.variant_id,
        brand: r.brand,
        product_name: r.product_name,
        condition: r.condition,
        ram_gb: r.ram_gb,
        rom_gb: r.rom_gb,
        offers: []
      });
    }
    grouped.get(key).offers.push(r);
  }

  const aggHeaders = [
    'variant_id',
    'brand',
    'product_name',
    'condition',
    'ram_gb',
    'rom_gb',
    'min_price',
    'avg_price',
    'max_price',
    'best_retailer',
    'best_retailer_url',
    'savings_amount',
    'retailers_count',
    'in_stock_count'
  ];

  const aggRows = [aggHeaders.join(',')];

  for (const item of grouped.values()) {
    const validInStock = item.offers.filter(o => o.stock_status === 'in_stock' && o.price > 0);
    const pool = validInStock.length > 0 ? validInStock : item.offers;

    const prices = pool.map(o => o.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

    const bestOffer = pool.find(o => o.price === minPrice) || pool[0];
    const savings = Math.max(0, maxPrice - minPrice);

    const row = [
      `"${item.variant_id}"`,
      `"${item.brand}"`,
      `"${(item.product_name || '').replace(/"/g, '""')}"`,
      `"${item.condition}"`,
      item.ram_gb,
      item.rom_gb,
      minPrice,
      avgPrice,
      maxPrice,
      `"${bestOffer.retailer}"`,
      `"${bestOffer.product_url}"`,
      savings,
      item.offers.length,
      validInStock.length
    ];
    aggRows.push(row.join(','));
  }

  const aggCsvPath = path.join(outputDir, '05_device_aggregated_prices.csv');
  fs.writeFileSync(aggCsvPath, aggRows.join('\n'), 'utf-8');

  console.log(`\n💾 [Export Complete]`);
  console.log(`   - Raw JSON: ${jsonPath} (${records.length} records)`);
  console.log(`   - Retailer Prices: ${retailerCsvPath} (${records.length} rows)`);
  console.log(`   - Aggregated Prices: ${aggCsvPath} (${grouped.size} unique SKUs)`);
}

