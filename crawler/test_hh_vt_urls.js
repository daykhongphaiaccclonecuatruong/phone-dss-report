import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

async function testHHAndViettel() {
  // HH
  const resHH = await axios.get('https://hoanghamobile.com/dien-thoai-di-dong', { headers });
  const $hh = cheerio.load(resHH.data);
  console.log('HH Brand hrefs:');
  $hh('a[href*="/dien-thoai-di-dong/"]').slice(0, 10).each((i, el) => {
    console.log(' ', $hh(el).attr('href'), '->', $hh(el).text().trim());
  });

  // Test one brand page from HH
  const firstBrand = 'https://hoanghamobile.com/dien-thoai-di-dong/samsung';
  const resHHBrand = await axios.get(firstBrand, { headers });
  const $hb = cheerio.load(resHHBrand.data);
  console.log('\nHH Samsung page product links:');
  $hb('a').each((i, el) => {
    const h = $hb(el).attr('href') || '';
    if (h.includes('/dien-thoai-di-dong/samsung/') || (h.includes('galaxy') && h.includes('.html'))) {
      console.log(' ', h, '->', $hb(el).text().trim().replace(/\s+/g, ' ').substring(0, 80));
    }
  });

  // Viettel Store
  const resVT = await axios.get('https://viettelstore.vn/dien-thoai', { headers });
  const $vt = cheerio.load(resVT.data);
  console.log('\nViettel Brand hrefs:');
  $vt('a[href*="dtdd-"], a[href*="dien-thoai-"]').slice(0, 10).each((i, el) => {
    console.log(' ', $vt(el).attr('href'), '->', $vt(el).text().trim());
  });
}

testHHAndViettel();

