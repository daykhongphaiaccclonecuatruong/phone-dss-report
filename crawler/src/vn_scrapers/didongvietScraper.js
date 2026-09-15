import axios from 'axios';
import * as cheerio from 'cheerio';
import { parsePriceNumber, extractMemory, normalizeBrandName, generateVariantId } from '../vnExporter.js';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

const BRANDS = ['iphone', 'samsung', 'xiaomi', 'oppo', 'honor', 'tecno'];

export async function crawlDiDongViet({ brandFilter = null, conditionFilter = 'all' } = {}) {
  const results = [];
  const brandsToCrawl = brandFilter
    ? BRANDS.filter(b => b.toLowerCase().includes(brandFilter.toLowerCase()) || (brandFilter.toLowerCase() === 'apple' && b === 'iphone'))
    : BRANDS;

  console.log(`\n🛍️ [Di Động Việt] Bắt đầu cào ${brandsToCrawl.length} thương hiệu...`);

  // 1. Luồng Máy Mới (New)
  if (conditionFilter === 'all' || conditionFilter === 'new') {
    for (const brand of brandsToCrawl) {
      const url = `https://didongviet.vn/dien-thoai-${brand}.html`;
      try {
        const res = await axios.get(url, { headers, timeout: 20000 });
        const $ = cheerio.load(res.data);
        let count = 0;

        $('a[href*="/dien-thoai/"]').each((i, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim().replace(/\s+/g, ' ');

          const priceMatch = text.match(/([\d\.,]+)\s*[₫đ]/);
          if (priceMatch) {
            const price = parsePriceNumber(priceMatch[1]);
            let rawName = text.split(/[\d\.,]+\s*[₫đ]/)[0].replace(/Trả góp 0%|Chính Hãng|Giá đã trừ voucher.*/gi, '').trim();

            if (rawName.length > 5 && price > 500000) {
              const memory = extractMemory(rawName);
              const canonicalBrand = normalizeBrandName(brand === 'iphone' ? 'Apple' : brand);
              const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

              const fullUrl = href.startsWith('http') ? href : `https://didongviet.vn${href}`;
              if (!results.some(r => r.product_url === fullUrl)) {
                results.push({
                  price_id: `DDV_NEW_${variantId}_${Date.now()}_${i}`,
                  variant_id: variantId,
                  brand: canonicalBrand,
                  product_name: rawName,
                  retailer: 'Di Động Việt',
                  condition: 'new',
                  sub_condition: 'Mới 100% Chính Hãng (AAR)',
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
        console.log(`   ✅ Di Động Việt [Mới] - ${brand.toUpperCase()}: ${count} máy`);
      } catch (e) {
        console.log(`   ⚠️ Di Động Việt [Mới] - ${brand.toUpperCase()}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // 2. Luồng Máy Cũ (Used)
  if (conditionFilter === 'all' || conditionFilter === 'used') {
    const urlUsed = 'https://didongviet.vn/dien-thoai-cu.html';
    try {
      const res = await axios.get(urlUsed, { headers, timeout: 20000 });
      const $ = cheerio.load(res.data);
      let count = 0;

      $('a[href*="/dien-thoai/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        const priceMatch = text.match(/([\d\.,]+)\s*[₫đ]/);

        if (priceMatch) {
          const price = parsePriceNumber(priceMatch[1]);
          let rawName = text.split(/[\d\.,]+\s*[₫đ]/)[0].trim();

          if (rawName.length > 5 && price > 500000) {
            const memory = extractMemory(rawName);
            const canonicalBrand = normalizeBrandName(rawName);
            const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

            const fullUrl = href.startsWith('http') ? href : `https://didongviet.vn${href}`;
            if (!results.some(r => r.product_url === fullUrl)) {
              results.push({
                price_id: `DDV_USED_${variantId}_${Date.now()}_${i}`,
                variant_id: variantId,
                brand: canonicalBrand,
                product_name: rawName,
                retailer: 'Di Động Việt Cũ',
                condition: 'used',
                sub_condition: 'Máy Cũ Like New 99% / Zin',
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
      console.log(`   ✅ Di Động Việt [Máy Cũ]: ${count} máy`);
    } catch (e) {
      console.log(`   ⚠️ Di Động Việt [Máy Cũ]: ${e.message}`);
    }
  }

  return results;
}

