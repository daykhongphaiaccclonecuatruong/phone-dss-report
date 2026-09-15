import axios from 'axios';
import * as cheerio from 'cheerio';
import { parsePriceNumber, extractMemory, normalizeBrandName, generateVariantId } from '../vnExporter.js';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

const BRANDS = [
  'apple-iphone', 'samsung', 'oppo', 'xiaomi', 'vivo', 'realme',
  'honor', 'tecno', 'nubia', 'nokia', 'masstel', 'mobell', 'motorola', 'xphone'
];

export async function crawlTGDD({ brandFilter = null, conditionFilter = 'all' } = {}) {
  const results = [];
  const brandsToCrawl = brandFilter
    ? BRANDS.filter(b => b.toLowerCase().includes(brandFilter.toLowerCase()) || (brandFilter.toLowerCase() === 'apple' && b === 'apple-iphone'))
    : BRANDS;

  console.log(`\n🛍️ [Thế Giới Di Động] Bắt đầu cào ${brandsToCrawl.length} thương hiệu...`);

  // 1. Luồng Máy Mới (New)
  if (conditionFilter === 'all' || conditionFilter === 'new') {
    for (const brand of brandsToCrawl) {
      const url = `https://www.thegioididong.com/dtdd-${brand}`;
      try {
        const res = await axios.get(url, { headers, timeout: 20000 });
        const $ = cheerio.load(res.data);
        let count = 0;

        $('li.item, .listproduct li').each((i, el) => {
          const a = $(el).find('a.main-contain, a').first();
          const link = a.attr('href') || '';
          const rawName = a.attr('title') || $(el).find('h3').text().trim() || a.find('img').attr('alt') || '';
          const priceRaw = $(el).find('.price, strong.price').text().trim();
          const oldPriceRaw = $(el).find('.price-old, .box-p strong').text().trim();

          const price = parsePriceNumber(priceRaw);
          const originalPrice = parsePriceNumber(oldPriceRaw) || price;

          if (rawName && price > 0 && link && !link.includes('javascript:')) {
            const memory = extractMemory(rawName);
            const canonicalBrand = normalizeBrandName(brand.replace('apple-', ''));
            const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

            const fullUrl = link.startsWith('http') ? link : `https://www.thegioididong.com${link}`;
            if (!results.some(r => r.product_url === fullUrl)) {
              results.push({
                price_id: `TGDD_NEW_${variantId}_${Date.now()}_${i}`,
                variant_id: variantId,
                brand: canonicalBrand,
                product_name: rawName,
                retailer: 'Thế Giới Di Động',
                condition: 'new',
                sub_condition: 'Mới 100% Chính Hãng',
                price: price,
                original_price: originalPrice,
                ram_gb: memory.ram_gb,
                rom_gb: memory.rom_gb,
                stock_status: 'in_stock',
                product_url: fullUrl,
                crawled_at: new Date().toISOString()
              });
              count++;
            }
          }
        });
        console.log(`   ✅ TGDD [Mới] - ${brand.toUpperCase()}: ${count} máy`);
      } catch (e) {
        console.log(`   ⚠️ TGDD [Mới] - ${brand.toUpperCase()}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // 2. Luồng Máy Đổi Trả (Used)
  if (conditionFilter === 'all' || conditionFilter === 'used') {
    const urlUsed = 'https://www.thegioididong.com/may-doi-tra/dien-thoai-di-dong';
    try {
      const res = await axios.get(urlUsed, { headers, timeout: 20000 });
      const $ = cheerio.load(res.data);
      let count = 0;

      $('li.item, .listproduct li, .item-used').each((i, el) => {
        const a = $(el).find('a').first();
        const link = a.attr('href') || '';
        const rawName = a.attr('title') || $(el).find('h3, .item-name').text().trim() || a.find('img').attr('alt') || '';
        const priceRaw = $(el).find('.price, strong.price, .item-price').text().trim();

        const price = parsePriceNumber(priceRaw);
        if (rawName && price > 0 && link && !link.includes('javascript:')) {
          const memory = extractMemory(rawName);
          const canonicalBrand = normalizeBrandName(rawName);
          const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

          const fullUrl = link.startsWith('http') ? link : `https://www.thegioididong.com${link}`;
          if (!results.some(r => r.product_url === fullUrl)) {
            results.push({
              price_id: `TGDD_USED_${variantId}_${Date.now()}_${i}`,
              variant_id: variantId,
              brand: canonicalBrand,
              product_name: rawName,
              retailer: 'TGDD Máy Đổi Trả',
              condition: 'used',
              sub_condition: 'Máy Đổi Trả / Còn Bảo Hành TGDD',
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
      });
      console.log(`   ✅ TGDD [Máy Đổi Trả]: ${count} máy`);
    } catch (e) {
      console.log(`   ⚠️ TGDD [Máy Đổi Trả]: ${e.message}`);
    }
  }

  return results;
}

