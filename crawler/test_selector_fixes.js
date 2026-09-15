import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function fixSelectors() {
  console.log('=== TEST SELECTOR FIXES ===');

  // 1. CellphoneS Used Apple URL
  const cpsUsedUrls = [
    'https://cellphones.com.vn/hang-cu/dien-thoai/iphone.html',
    'https://cellphones.com.vn/hang-cu/dien-thoai/apple.html',
    'https://cellphones.com.vn/hang-cu/dien-thoai/samsung.html',
    'https://cellphones.com.vn/hang-cu/dien-thoai/xiaomi.html'
  ];
  for (const u of cpsUsedUrls) {
    try {
      const res = await axios.get(u, { headers });
      const $ = cheerio.load(res.data);
      console.log(`CPS Used [${u}]: Status ${res.status}, items: ${$('.product-item').length}`);
    } catch (e) {
      console.log(`CPS Used [${u}]: Error ${e.message}`);
    }
  }

  // 2. Hoàng Hà Selector
  try {
    const res = await axios.get('https://hoanghamobile.com/dien-thoai-di-dong/iphone', { headers });
    const $ = cheerio.load(res.data);
    const items = [];
    $('.col-content, .item-product, div[data-id], .product-item').each((i, el) => {
      const title = $(el).find('.title a, h3 a, h4 a').text().trim() || $(el).find('a').attr('title');
      const price = $(el).find('.price, .current-price, .item-gap8px').text().trim();
      const link = $(el).find('.title a, h3 a, a').attr('href');
      if (title && price) items.push({ title, price, link });
    });
    // Check all product links
    $('a').each((i, el) => {
      const h = $(el).attr('href') || '';
      const t = $(el).text().trim().replace(/\s+/g, ' ');
      if (h.includes('/dien-thoai-di-dong/iphone/') || h.includes('/dien-thoai-di-dong/samsung/')) {
        if (t.includes('₫') || t.includes('đ')) {
          items.push({ t: t.substring(0, 50), h });
        }
      }
    });
    console.log(`\nHoàng Hà products found: ${items.length}`);
    if (items.length > 0) console.log('Sample HH:', items.slice(0, 2));
  } catch (e) {
    console.log('HH Error:', e.message);
  }

  // 3. TGDD Selector
  try {
    const res = await axios.get('https://www.thegioididong.com/dtdd-apple-iphone', { headers });
    const $ = cheerio.load(res.data);
    const items = [];
    $('li.item, .listproduct li').each((i, el) => {
      const h3 = $(el).find('h3').text().trim();
      const price = $(el).find('.price, strong.price').text().trim();
      const link = $(el).find('a').attr('href');
      if (h3 || price) items.push({ h3, price, link });
    });
    console.log(`\nTGDD products found: ${items.length}`);
    if (items.length > 0) console.log('Sample TGDD:', items.slice(0, 2));
  } catch (e) {
    console.log('TGDD Error:', e.message);
  }
}

fixSelectors();

