import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function getPage(url) {
  try {
    const res = await axios.get(url, { headers, timeout: 20000 });
    return res.data;
  } catch (err) {
    console.error(`Lỗi khi tải ${url}: ${err.message}`);
    return null;
  }
}

async function analyzeAll() {
  const summary = {};

  // 1. CellphoneS
  console.log('--- 1. CellphoneS ---');
  const htmlCPS = await getPage('https://cellphones.com.vn/mobile.html');
  if (htmlCPS) {
    const $ = cheerio.load(htmlCPS);
    const brands = new Map();
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/cellphones\.com\.vn\/mobile\/([a-zA-Z0-9\-]+)\.html/);
      if (m) {
        const slug = m[1].toLowerCase();
        let name = $(el).text().trim();
        const imgAlt = $(el).find('img').attr('alt');
        if (imgAlt) name = imgAlt.replace(/Điện thoại/i, '').trim();
        if (!name) name = slug.toUpperCase();
        if (!['hang-cu', 'phu-kien', 'chinh-hang', 'mobile'].includes(slug)) {
          brands.set(slug, { name, slug, url: href });
        }
      }
    });
    // Check quick filter items
    $('.box-quickfilter a, .filter-item a, .list-brand a').each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href') || '';
      if (text && text.length < 25 && href.includes('/mobile/')) {
        const slug = href.replace(/.*\/mobile\//, '').replace('.html', '');
        if (slug && !brands.has(slug)) {
          brands.set(slug, { name: text, slug, url: href });
        }
      }
    });
    summary['CellphoneS'] = Array.from(brands.values());
    console.log(`CellphoneS: ${summary['CellphoneS'].length} hãng`);
  }

  // 2. Hoàng Hà Mobile
  console.log('\n--- 2. Hoàng Hà Mobile ---');
  const htmlHH = await getPage('https://hoanghamobile.com/dien-thoai-di-dong');
  if (htmlHH) {
    const $ = cheerio.load(htmlHH);
    const brands = new Map();
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/\/dien-thoai-di-dong\/([a-zA-Z0-9\-]+)/);
      if (m) {
        const slug = m[1].toLowerCase();
        let name = $(el).text().trim();
        const imgAlt = $(el).find('img').attr('alt');
        if (imgAlt) name = imgAlt.replace(/Điện thoại/i, '').trim();
        if (!name) name = slug.toUpperCase();
        if (!['san-pham-hot', 'flash-sale', 'hang-cu'].includes(slug)) {
          brands.set(slug, { name, slug, url: `https://hoanghamobile.com${href.startsWith('/') ? '' : '/'}${href}` });
        }
      }
    });
    summary['HoangHaMobile'] = Array.from(brands.values());
    console.log(`Hoàng Hà Mobile: ${summary['HoangHaMobile'].length} hãng`);
  }

  // 3. Thế Giới Di Động (TGDD)
  console.log('\n--- 3. Thế Giới Di Động ---');
  const htmlTGDD = await getPage('https://www.thegioididong.com/dtdd');
  if (htmlTGDD) {
    const $ = cheerio.load(htmlTGDD);
    const brands = new Map();
    $('a').each((_, el) => {
      const href = $(el).attr('href') || $(el).attr('data-href') || '';
      const m = href.match(/dtdd-([a-zA-Z0-9\-]+)/);
      if (m) {
        const slug = m[1].toLowerCase();
        let name = $(el).text().trim();
        const imgAlt = $(el).find('img').attr('alt') || $(el).find('img').attr('title');
        if (imgAlt) name = imgAlt.replace(/Điện thoại/i, '').trim();
        if (!name) name = slug.toUpperCase();
        brands.set(slug, { name, slug, url: href.startsWith('http') ? href : `https://www.thegioididong.com${href}` });
      }
    });
    summary['TGDD'] = Array.from(brands.values());
    console.log(`TGDD: ${summary['TGDD'].length} hãng`);
  }

  // 4. FPT Shop
  console.log('\n--- 4. FPT Shop ---');
  const htmlFPT = await getPage('https://fptshop.com.vn/dien-thoai');
  if (htmlFPT) {
    const $ = cheerio.load(htmlFPT);
    const brands = new Map();
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/\/dien-thoai\/([a-zA-Z0-9\-]+)/);
      if (m) {
        const slug = m[1].toLowerCase();
        let name = $(el).text().trim();
        const imgAlt = $(el).find('img').attr('alt');
        if (imgAlt) name = imgAlt.replace(/Điện thoại/i, '').trim();
        if (!name) name = slug.toUpperCase();
        if (!['tra-gop-0', 'hang-cu', 'phu-kien', 'apple-authorized-reseller'].includes(slug)) {
          brands.set(slug, { name, slug, url: href.startsWith('http') ? href : `https://fptshop.com.vn${href}` });
        }
      }
    });
    summary['FPTShop'] = Array.from(brands.values());
    console.log(`FPT Shop: ${summary['FPTShop'].length} hãng`);
  }

  // 5. Di Động Việt
  console.log('\n--- 5. Di Động Việt ---');
  const htmlDDV = await getPage('https://didongviet.vn/dien-thoai.html');
  if (htmlDDV) {
    const $ = cheerio.load(htmlDDV);
    const brands = new Map();
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/\/dien-thoai\/([a-zA-Z0-9\-]+)/) || href.match(/\/dien-thoai-([a-zA-Z0-9\-]+)\.html/);
      if (m) {
        const slug = m[1].toLowerCase();
        let name = $(el).text().trim();
        const imgAlt = $(el).find('img').attr('alt');
        if (imgAlt) name = imgAlt.replace(/Điện thoại/i, '').trim();
        if (!name) name = slug.toUpperCase();
        if (!['chinh-hang', 'cu-gia-re', 'html'].includes(slug)) {
          brands.set(slug, { name, slug, url: href.startsWith('http') ? href : `https://didongviet.vn${href}` });
        }
      }
    });
    summary['DiDongViet'] = Array.from(brands.values());
    console.log(`Di Động Việt: ${summary['DiDongViet'].length} hãng`);
  }

  // 6. Viettel Store
  console.log('\n--- 6. Viettel Store ---');
  const htmlVT = await getPage('https://viettelstore.vn/dien-thoai');
  if (htmlVT) {
    const $ = cheerio.load(htmlVT);
    const brands = new Map();
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/dien-thoai-([a-zA-Z0-9\-]+)/);
      if (m) {
        const slug = m[1].toLowerCase();
        let name = $(el).text().trim();
        const imgAlt = $(el).find('img').attr('alt');
        if (imgAlt) name = imgAlt.replace(/Điện thoại/i, '').trim();
        if (!name) name = slug.toUpperCase();
        if (!['gia-re', 'chinh-hang'].includes(slug)) {
          brands.set(slug, { name, slug, url: href.startsWith('http') ? href : `https://viettelstore.vn${href}` });
        }
      }
    });
    summary['ViettelStore'] = Array.from(brands.values());
    console.log(`Viettel Store: ${summary['ViettelStore'].length} hãng`);
  }

  fs.writeFileSync('vn_distributors_brands.json', JSON.stringify(summary, null, 2), 'utf-8');
  console.log('\nĐã lưu kết quả vào crawler/vn_distributors_brands.json');
}

analyzeAll();

