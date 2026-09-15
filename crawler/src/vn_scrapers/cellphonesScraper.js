import axios from 'axios';
import * as cheerio from 'cheerio';
import { parsePriceNumber, extractMemory, normalizeBrandName, generateVariantId } from '../vnExporter.js';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

const BRANDS = [
  'apple', 'samsung', 'xiaomi', 'oppo', 'vivo', 'realme', 'honor',
  'tecno', 'infinix', 'nubia', 'asus', 'sony', 'nothing-phone',
  'oneplus', 'huawei', 'meizu', 'nokia', 'masstel', 'itel', 'benco', 'tcl'
];

export async function crawlCellphoneS({ brandFilter = null, conditionFilter = 'all' } = {}) {
  const results = [];
  const brandsToCrawl = brandFilter
    ? BRANDS.filter(b => b.toLowerCase().includes(brandFilter.toLowerCase()))
    : BRANDS;

  console.log(`\n🛍️ [CellphoneS] Bắt đầu cào ${brandsToCrawl.length} thương hiệu...`);

  // 1. Luồng Máy Mới (New)
  if (conditionFilter === 'all' || conditionFilter === 'new') {
    for (const brand of brandsToCrawl) {
      const url = `https://cellphones.com.vn/mobile/${brand}.html`;
      try {
        const res = await axios.get(url, { headers, timeout: 20000 });
        const $ = cheerio.load(res.data);
        let count = 0;

        $('.product-item, .product-info-container, [data-product-id]').each((i, el) => {
          const rawName = $(el).find('.product__name h3, h3, .product-title').text().trim();
          const showPriceRaw = $(el).find('.product__price--show, .special-price, .price').text().trim();
          const throughPriceRaw = $(el).find('.product__price--through, .old-price').text().trim();
          const link = $(el).find('a.product__link, a').first().attr('href') || '';

          const price = parsePriceNumber(showPriceRaw);
          const originalPrice = parsePriceNumber(throughPriceRaw) || price;

          if (rawName && price > 0 && link) {
            const memory = extractMemory(rawName);
            const canonicalBrand = normalizeBrandName(brand);
            const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

            const fullUrl = link.startsWith('http') ? link : `https://cellphones.com.vn${link}`;
            if (!results.some(r => r.product_url === fullUrl)) {
              results.push({
                price_id: `CPS_NEW_${variantId}_${Date.now()}_${results.length}`,
                variant_id: variantId,
                brand: canonicalBrand,
                product_name: rawName,
                retailer: 'CellphoneS',
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
        console.log(`   ✅ CellphoneS [Mới] - ${brand.toUpperCase()}: ${count} máy`);
      } catch (e) {
        console.log(`   ⚠️ CellphoneS [Mới] - ${brand.toUpperCase()}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // 2. Luồng Máy Cũ (Used) - Cào 10 trang để lấy toàn bộ kho máy cũ
  if (conditionFilter === 'all' || conditionFilter === 'used') {
    try {
      let usedCount = 0;
      for (let page = 1; page <= 10; page++) {
        const pageUrl = page === 1
          ? 'https://cellphones.com.vn/hang-cu/dien-thoai.html'
          : `https://cellphones.com.vn/hang-cu/dien-thoai.html?page=${page}`;

        const res = await axios.get(pageUrl, { headers, timeout: 20000 });
        const $ = cheerio.load(res.data);
        const items = $('.product-item, .product-info-container');
        if (items.length === 0) break;

        items.each((i, el) => {
          const rawName = $(el).find('.product__name h3, h3').text().trim();
          const showPriceRaw = $(el).find('.product__price--show, .price').text().trim();
          const throughPriceRaw = $(el).find('.product__price--through').text().trim();
          const link = $(el).find('a.product__link, a').first().attr('href') || '';

          const price = parsePriceNumber(showPriceRaw);
          const originalPrice = parsePriceNumber(throughPriceRaw) || price;

          if (rawName && price > 0 && link) {
            const memory = extractMemory(rawName);
            const canonicalBrand = normalizeBrandName(rawName);

            if (brandFilter && !canonicalBrand.toLowerCase().includes(brandFilter.toLowerCase())) {
              return;
            }

            const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

            let subCondition = 'Cũ 99% / Like New';
            if (rawName.toLowerCase().includes('trầy xước')) subCondition = 'Cũ Trầy Xước (95%)';
            else if (rawName.toLowerCase().includes('đã kích hoạt')) subCondition = 'Cũ Đã Kích Hoạt';
            else if (rawName.toLowerCase().includes('trưng bày')) subCondition = 'Hàng Trưng Bày';

            const fullUrl = link.startsWith('http') ? link : `https://cellphones.com.vn${link}`;
            if (!results.some(r => r.product_url === fullUrl)) {
              results.push({
                price_id: `CPS_USED_${variantId}_${Date.now()}_${results.length}`,
                variant_id: variantId,
                brand: canonicalBrand,
                product_name: rawName,
                retailer: 'CellphoneS Cũ',
                condition: 'used',
                sub_condition: subCondition,
                price: price,
                original_price: originalPrice,
                ram_gb: memory.ram_gb,
                rom_gb: memory.rom_gb,
                stock_status: 'in_stock',
                product_url: fullUrl,
                crawled_at: new Date().toISOString()
              });
              usedCount++;
            }
          }
        });
        await new Promise(r => setTimeout(r, 400));
      }
      console.log(`   ✅ CellphoneS [Kho Máy Cũ]: Đã cào ${usedCount} máy cũ`);
    } catch (e) {
      console.log(`   ⚠️ CellphoneS [Kho Máy Cũ]: ${e.message}`);
    }
  }

  return results;
}
