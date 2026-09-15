import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function checkMissing() {
  console.log('=== 1. CHECK INFINIX & ONEPLUS ===');
  // Infinix
  for (const url of [
    'https://cellphones.com.vn/mobile/infinix.html',
    'https://hoanghamobile.com/dien-thoai-di-dong/infinix',
    'https://www.thegioididong.com/dtdd-infinix'
  ]) {
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);
      console.log(`Infinix [${url}] -> Status: ${res.status}, Title: ${$('title').text().substring(0, 30)}, Products: ${$('.product-item, .col-content, li.item').length}`);
    } catch (e) {
      console.log(`Infinix [${url}] -> Error: ${e.message}`);
    }
  }

  // OnePlus
  for (const url of [
    'https://cellphones.com.vn/mobile/oneplus.html',
    'https://www.thegioididong.com/dtdd-oneplus',
    'https://hoanghamobile.com/dien-thoai-di-dong/oneplus'
  ]) {
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);
      console.log(`OnePlus [${url}] -> Status: ${res.status}, Title: ${$('title').text().substring(0, 30)}, Products: ${$('.product-item, .col-content, li.item').length}`);
    } catch (e) {
      console.log(`OnePlus [${url}] -> Error: ${e.message}`);
    }
  }

  console.log('\n=== 2. CHECK VIETTEL STORE URLS ===');
  for (const brand of ['samsung', 'oppo', 'xiaomi', 'vivo', 'realme', 'honor']) {
    for (const url of [
      `https://viettelstore.vn/dtdd-${brand}`,
      `https://viettelstore.vn/dien-thoai-${brand}`,
      `https://viettelstore.vn/dien-thoai-${brand}.html`
    ]) {
      try {
        const res = await axios.get(url, { headers });
        const $ = cheerio.load(res.data);
        const links = $('a[href*="dtdd-"], a[href*="dien-thoai-"]').length;
        if (links > 5) {
          console.log(`Viettel [${url}] -> Status: ${res.status}, Links: ${links}`);
        }
      } catch (e) {}
    }
  }

  console.log('\n=== 3. CHECK FPT SHOP (VIVO, REALME, HONOR) ===');
  for (const brand of ['vivo', 'realme', 'honor']) {
    const url = `https://fptshop.com.vn/dien-thoai/${brand}`;
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);
      console.log(`FPT [${url}] -> Products with price: ${$('a[href*="/dien-thoai/"]').length}`);
      $('a[href*="/dien-thoai/"]').slice(0, 3).each((_, el) => {
        console.log('   Sample:', $(el).attr('href'), '->', $(el).text().trim().replace(/\s+/g, ' ').substring(0, 60));
      });
    } catch (e) {
      console.log(`FPT [${url}] -> Error: ${e.message}`);
    }
  }
}

checkMissing();

