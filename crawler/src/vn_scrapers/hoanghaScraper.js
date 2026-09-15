import axios from 'axios';
import * as cheerio from 'cheerio';
import { parsePriceNumber, extractMemory, normalizeBrandName, generateVariantId } from '../vnExporter.js';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

const BRANDS = [
  'iphone', 'samsung', 'xiaomi', 'oppo', 'honor', 'tecno', 'infinix',
  'redmagic', 'huawei', 'nokia', 'xphone', 'htc', 'inoi', 'benco',
  'nubia', 'masstel', 'tcl', 'itel', 'mobell', 'zte', 'viettel'
];

export async function crawlHoangHa({ brandFilter = null } = {}) {
  const results = [];
  const brandsToCrawl = brandFilter
    ? BRANDS.filter(b => b.toLowerCase().includes(brandFilter.toLowerCase()) || (brandFilter.toLowerCase() === 'apple' && b === 'iphone'))
    : BRANDS;

  console.log(`\n🛍️ [Hoàng Hà Mobile] Bắt đầu cào ${brandsToCrawl.length} thương hiệu...`);

  for (const brand of brandsToCrawl) {
    const brandUrl = `https://hoanghamobile.com/dien-thoai-di-dong/${brand}`;
    try {
      const res = await axios.get(brandUrl, { headers, timeout: 20000 });
      const $ = cheerio.load(res.data);
      let count = 0;

      // Find all subcategories or product URLs on brand page
      const urlsToScan = new Set([brandUrl]);
      $('a[href*="/dien-thoai-di-dong/"]').each((_, el) => {
        const h = $(el).attr('href');
        if (h && h.includes(`/dien-thoai-di-dong/${brand}/`)) {
          urlsToScan.add(h.startsWith('http') ? h : `https://hoanghamobile.com${h}`);
        }
      });

      for (const pageUrl of urlsToScan) {
        try {
          const pRes = pageUrl === brandUrl ? res : await axios.get(pageUrl, { headers, timeout: 15000 });
          const $p = cheerio.load(pRes.data);

          $p('a[href*="/dien-thoai/"]').each((i, el) => {
            const href = $p(el).attr('href') || '';
            const text = $p(el).text().trim().replace(/\s+/g, ' ');
            const imgAlt = $p(el).find('img').attr('alt') || '';
            const rawName = imgAlt || text;

            if (rawName && rawName.length > 5 && !href.includes('/tra-gop/') && !href.includes('/tin-tuc/')) {
              // Find price in neighboring elements or text
              const parent = $p(el).closest('.item-product, .col-content, div');
              const priceText = parent.text().trim();
              const priceMatch = priceText.match(/([\d\.,]{6,12})\s*[₫đ]/);

              let price = 0;
              if (priceMatch) {
                price = parsePriceNumber(priceMatch[1]);
              }

              if (price > 500000) {
                const memory = extractMemory(rawName);
                const canonicalBrand = normalizeBrandName(brand === 'iphone' ? 'Apple' : brand);
                const variantId = generateVariantId(canonicalBrand, rawName, memory.ram_gb, memory.rom_gb);

                const fullUrl = href.startsWith('http') ? href : `https://hoanghamobile.com${href}`;
                if (!results.some(r => r.product_url === fullUrl)) {
                  results.push({
                    price_id: `HH_NEW_${variantId}_${Date.now()}_${results.length}`,
                    variant_id: variantId,
                    brand: canonicalBrand,
                    product_name: rawName,
                    retailer: 'Hoàng Hà Mobile',
                    condition: 'new',
                    sub_condition: 'Mới 100% Chính Hãng',
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
        } catch (subErr) {}
      }

      console.log(`   ✅ Hoàng Hà Mobile [Mới] - ${brand.toUpperCase()}: ${count} máy`);
    } catch (e) {
      console.log(`   ⚠️ Hoàng Hà Mobile [Mới] - ${brand.toUpperCase()}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  return results;
}

