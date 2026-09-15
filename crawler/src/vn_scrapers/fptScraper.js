import axios from 'axios';
import * as cheerio from 'cheerio';
import { parsePriceNumber, extractMemory, normalizeBrandName, generateVariantId } from '../vnExporter.js';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

const BRANDS = [
  'apple-iphone', 'samsung', 'xiaomi', 'oppo', 'vivo', 'realme',
  'honor', 'tecno', 'nokia', 'masstel', 'mobell', 'tcl', 'itel',
  'benco', 'inoi', 'zte', 'viettel'
];

export async function crawlFPTShop({ brandFilter = null, conditionFilter = 'all' } = {}) {
  const results = [];
  const brandsToCrawl = brandFilter
    ? BRANDS.filter(b => b.toLowerCase().includes(brandFilter.toLowerCase()) || (brandFilter.toLowerCase() === 'apple' && b === 'apple-iphone'))
    : BRANDS;

  console.log(`\n🛍️ [FPT Shop] Bắt đầu cào ${brandsToCrawl.length} thương hiệu...`);

  // 1. Luồng Máy Mới (New)
  if (conditionFilter === 'all' || conditionFilter === 'new') {
    for (const brand of brandsToCrawl) {
      const url = `https://fptshop.com.vn/dien-thoai/${brand}`;
      try {
        const res = await axios.get(url, { headers, timeout: 20000 });
        const $ = cheerio.load(res.data);
        let count = 0;

        $('a[href*="/dien-thoai/"]').each((i, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim().replace(/\s+/g, ' ');

          // Check if link points to a single product (not another category)
          const parts = href.replace('https://fptshop.com.vn', '').split('/');
          if (parts.length >= 3 && !BRANDS.includes(parts[2])) {
            const priceMatch = text.match(/([\d\.,]+)\s*[₫đ]/);
            if (priceMatch) {
              const price = parsePriceNumber(priceMatch[1]);
              let rawName = text.replace(/[\d\.,]+\s*[₫đ]|Giảm\s*[\d\.,]+|Trả góp.*|Còn \d+ ngày.*/gi, '').trim();

              if (rawName.length > 5 && price > 500000) {
                const memory = extractMemory(rawName);
                const canonicalBrand = normalizeBrandName(brand.replace('apple-', ''));
                const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

                const fullUrl = href.startsWith('http') ? href : `https://fptshop.com.vn${href}`;
                if (!results.some(r => r.product_url === fullUrl)) {
                  results.push({
                    price_id: `FPT_NEW_${variantId}_${Date.now()}_${i}`,
                    variant_id: variantId,
                    brand: canonicalBrand,
                    product_name: rawName,
                    retailer: 'FPT Shop',
                    condition: 'new',
                    sub_condition: 'Mới 100% Chính Hãng (Bảo hành 12-18th)',
                    price: price,
                    original_price: price,
                    ram_gb: memory.ram_gb,
                    rom_gb: memory.rom_gb,
                    stock_status: 'in_stock',
                    product_url: fullUrl,
                    crawled_at: new Date().toISOString()
                  });
                  count++;
                }
              }
            }
          }
        });
        console.log(`   ✅ FPT Shop [Mới] - ${brand.toUpperCase()}: ${count} máy`);
      } catch (e) {
        console.log(`   ⚠️ FPT Shop [Mới] - ${brand.toUpperCase()}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // 2. Luồng Máy Cũ Giá Rẻ (Used)
  if (conditionFilter === 'all' || conditionFilter === 'used') {
    const urlUsed = 'https://fptshop.com.vn/may-doi-tra/dien-thoai-cu-gia-re';
    try {
      const res = await axios.get(urlUsed, { headers, timeout: 20000 });
      const $ = cheerio.load(res.data);
      let count = 0;

      $('a[href*="/may-doi-tra/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        const priceMatch = text.match(/([\d\.,]+)\s*[₫đ]/);

        if (priceMatch && href.split('/').length >= 3) {
          const price = parsePriceNumber(priceMatch[1]);
          let rawName = text.replace(/[\d\.,]+\s*[₫đ].*/gi, '').trim();

          if (rawName.length > 5 && price > 500000) {
            const memory = extractMemory(rawName);
            const canonicalBrand = normalizeBrandName(rawName);
            const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

            const fullUrl = href.startsWith('http') ? href : `https://fptshop.com.vn${href}`;
            if (!results.some(r => r.product_url === fullUrl)) {
              results.push({
                price_id: `FPT_USED_${variantId}_${Date.now()}_${i}`,
                variant_id: variantId,
                brand: canonicalBrand,
                product_name: rawName,
                retailer: 'FPT Shop Cũ',
                condition: 'used',
                sub_condition: 'Máy Đổi Trả / Còn Bảo Hành FPT',
                price: price,
                original_price: price,
                ram_gb: memory.ram_gb,
                rom_gb: memory.rom_gb,
                stock_status: 'in_stock',
                product_url: fullUrl,
                crawled_at: new Date().toISOString()
              });
              count++;
            }
          }
        }
      });
      console.log(`   ✅ FPT Shop [Máy Cũ]: ${count} máy`);
    } catch (e) {
      console.log(`   ⚠️ FPT Shop [Máy Cũ]: ${e.message}`);
    }
  }

  return results;
}

