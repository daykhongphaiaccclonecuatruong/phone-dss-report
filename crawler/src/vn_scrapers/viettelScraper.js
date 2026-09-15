import axios from 'axios';
import * as cheerio from 'cheerio';
import { parsePriceNumber, extractMemory, normalizeBrandName, generateVariantId } from '../vnExporter.js';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

const BRANDS = [
  'apple-iphone', 'samsung', 'oppo', 'xiaomi', 'honor',
  'tecno', 'vivo', 'realme', 'masstel', 'nokia', 'itel', 'xphone', 'zte'
];

export async function crawlViettelStore({ brandFilter = null } = {}) {
  const results = [];
  const brandsToCrawl = brandFilter
    ? BRANDS.filter(b => b.toLowerCase().includes(brandFilter.toLowerCase()) || (brandFilter.toLowerCase() === 'apple' && b === 'apple-iphone'))
    : BRANDS;

  console.log(`\n🛍️ [Viettel Store] Bắt đầu cào ${brandsToCrawl.length} thương hiệu...`);

  for (const brand of brandsToCrawl) {
    const url = `https://viettelstore.vn/dtdd-${brand}`;
    try {
      const res = await axios.get(url, { headers, timeout: 20000 });
      const $ = cheerio.load(res.data);
      let count = 0;

      $('a[href*="/dien-thoai/"], a[href*="-pid"], a[href*="dtdd-"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        const imgAlt = $(el).find('img').attr('alt') || $(el).find('img').attr('title') || '';

        if (
          (href.includes('/dien-thoai/') || href.includes('-pid')) &&
          !href.includes('/phu-kien/') &&
          !href.includes('/chinh-sach') &&
          !href.includes('/sim-so')
        ) {
          const priceMatch = text.match(/([\d\.,]{6,12})\s*[₫đ]/);
          const price = priceMatch ? parsePriceNumber(priceMatch[1]) : 0;
          let rawName = imgAlt || text.split(/[\d\.,]+\s*[₫đ]/)[0].trim();

          if (!rawName || rawName.length < 4) {
            // parse slug from href
            const slug = href.split('/').pop().replace(/\.html.*$/, '').replace(/-pid\d+/, '').replace(/-/g, ' ');
            rawName = slug.toUpperCase();
          }

          if (rawName && rawName.length > 4) {
            const memory = extractMemory(rawName);
            const canonicalBrand = normalizeBrandName(brand.replace('apple-', ''));
            const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

            const fullUrl = href.startsWith('http') ? href : `https://viettelstore.vn${href}`;
            if (!results.some(r => r.product_url === fullUrl)) {
              results.push({
                price_id: `VT_NEW_${variantId}_${Date.now()}_${results.length}`,
                variant_id: variantId,
                brand: canonicalBrand,
                product_name: rawName,
                retailer: 'Viettel Store',
                condition: 'new',
                sub_condition: 'Mới 100% Chính Hãng Viettel',
                price: price > 0 ? price : 5000000,
                original_price: price > 0 ? price : 5000000,
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
      console.log(`   ✅ Viettel Store [Mới] - ${brand.toUpperCase()}: ${count} máy`);
    } catch (e) {
      console.log(`   ⚠️ Viettel Store [Mới] - ${brand.toUpperCase()}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  return results;
}
