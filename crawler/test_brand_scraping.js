import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function testBrandScraping() {
  console.log('=== TEST BRAND SCRAPING ACROSS 6 STORES ===\n');

  // 1. CellphoneS (Xiaomi)
  try {
    const res = await axios.get('https://cellphones.com.vn/mobile/xiaomi.html', { headers });
    const $ = cheerio.load(res.data);
    const items = [];
    $('.product-item').slice(0, 3).each((i, el) => {
      const name = $(el).find('.product__name h3, h3').text().trim();
      const price = $(el).find('.product__price--show').text().trim();
      const link = $(el).find('a.product__link').attr('href');
      items.push({ name, price, link });
    });
    console.log('1. CellphoneS (Xiaomi):', items);
  } catch (e) {
    console.log('1. CellphoneS Error:', e.message);
  }

  // 2. Hoàng Hà Mobile (Samsung)
  try {
    const res = await axios.get('https://hoanghamobile.com/dien-thoai-di-dong/samsung', { headers });
    const $ = cheerio.load(res.data);
    const items = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (href.includes('/dien-thoai-di-dong/samsung/') && (text.includes('₫') || text.includes('đ')) && text.includes('Galaxy')) {
        if (items.length < 3 && !items.some(x => x.link === href)) {
          items.push({ text: text.substring(0, 100), link: `https://hoanghamobile.com${href}` });
        }
      }
    });
    console.log('\n2. Hoàng Hà Mobile (Samsung):', items);
  } catch (e) {
    console.log('\n2. Hoàng Hà Error:', e.message);
  }

  // 3. Thế Giới Di Động (OPPO)
  try {
    const res = await axios.get('https://www.thegioididong.com/dtdd-oppo', { headers });
    const $ = cheerio.load(res.data);
    const items = [];
    $('li.item').slice(0, 3).each((i, el) => {
      const name = $(el).find('h3').text().trim();
      const price = $(el).find('.price').text().trim();
      const link = $(el).find('a.main-contain').attr('href');
      if (name || price) {
        items.push({ name, price, link: `https://www.thegioididong.com${link}` });
      }
    });
    console.log('\n3. Thế Giới Di Động (OPPO):', items);
  } catch (e) {
    console.log('\n3. TGDD Error:', e.message);
  }

  // 4. FPT Shop (Apple)
  try {
    const res = await axios.get('https://fptshop.com.vn/dien-thoai/apple-iphone', { headers });
    const $ = cheerio.load(res.data);
    const items = [];
    $('a[href*="/dien-thoai/"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.includes('iPhone') && (text.includes('đ') || text.includes('₫'))) {
        if (items.length < 3 && !items.some(x => x.link === href)) {
          items.push({ text: text.substring(0, 100), link: `https://fptshop.com.vn${href}` });
        }
      }
    });
    console.log('\n4. FPT Shop (iPhone):', items);
  } catch (e) {
    console.log('\n4. FPT Shop Error:', e.message);
  }

  // 5. Di Động Việt (Samsung)
  try {
    const res = await axios.get('https://didongviet.vn/dien-thoai-samsung.html', { headers });
    const $ = cheerio.load(res.data);
    const items = [];
    $('a[href*="/dien-thoai/"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.includes('Samsung') && (text.includes('đ') || text.includes('₫'))) {
        if (items.length < 3 && !items.some(x => x.link === href)) {
          items.push({ text: text.substring(0, 100), link: href.startsWith('http') ? href : `https://didongviet.vn${href}` });
        }
      }
    });
    console.log('\n5. Di Động Việt (Samsung):', items);
  } catch (e) {
    console.log('\n5. Di Động Việt Error:', e.message);
  }

  // 6. Viettel Store (Xiaomi)
  try {
    const res = await axios.get('https://viettelstore.vn/dtdd-xiaomi', { headers });
    const $ = cheerio.load(res.data);
    const items = [];
    $('a[href*="dien-thoai-"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.includes('Xiaomi') || text.includes('Redmi') || text.includes('POCO')) {
        if (items.length < 3 && !items.some(x => x.link === href)) {
          items.push({ text: text.substring(0, 100), link: `https://viettelstore.vn${href}` });
        }
      }
    });
    console.log('\n6. Viettel Store (Xiaomi):', items);
  } catch (e) {
    console.log('\n6. Viettel Store Error:', e.message);
  }
}

testBrandScraping();

