import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

async function inspectViettelCards() {
  const res = await axios.get('https://viettelstore.vn/dtdd-samsung', { headers });
  const $ = cheerio.load(res.data);
  console.log('Viettel Samsung Page inspection:');
  console.log('Title:', $('title').text());
  console.log('Items found:');
  $('a').each((i, el) => {
    const h = $(el).attr('href') || '';
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t.includes('₫') || t.includes('đ') || h.includes('samsung') || h.includes('galaxy')) {
      if (t.length > 5 && t.length < 100) console.log('  ', h, '=>', t);
    }
  });
}

inspectViettelCards();

