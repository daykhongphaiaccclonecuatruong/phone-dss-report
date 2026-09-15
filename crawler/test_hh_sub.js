import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

async function testHoangHaSubcategories() {
  const res = await axios.get('https://hoanghamobile.com/dien-thoai-di-dong/iphone', { headers });
  const $ = cheerio.load(res.data);
  console.log('Hoàng Hà /iphone links:');
  const sublinks = [];
  $('a[href*="/dien-thoai-di-dong/iphone/"]').each((_, el) => {
    const h = $(el).attr('href');
    if (!sublinks.includes(h)) sublinks.push(h);
  });
  console.log('Sublinks found:', sublinks);

  if (sublinks.length > 0) {
    const testSub = sublinks[0].startsWith('http') ? sublinks[0] : `https://hoanghamobile.com${sublinks[0]}`;
    console.log(`Fetching sublink: ${testSub}`);
    const resSub = await axios.get(testSub, { headers });
    const $sub = cheerio.load(resSub.data);
    console.log('Sublink product items:');
    $sub('a').each((_, el) => {
      const h = $sub(el).attr('href') || '';
      const t = $sub(el).text().trim().replace(/\s+/g, ' ');
      if (t.includes('₫') || t.includes('đ') || h.includes('.html') || h.includes('iphone')) {
        if (t.length > 5 && t.length < 100) console.log('  ', h, '=>', t);
      }
    });
  }
}

testHoangHaSubcategories();

