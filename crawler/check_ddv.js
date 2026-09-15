import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function checkDDV() {
  const res = await axios.get('https://didongviet.vn', { headers });
  const $ = cheerio.load(res.data);
  const found = new Set();
  $('a').each((i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.includes('dien-thoai-') || href.includes('/dien-thoai/')) {
      if (text && text.length < 40) found.add(`${text} => ${href}`);
    }
  });
  console.log('DDV All phone links:');
  for (const item of found) console.log(item);
}

checkDDV();

