import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function checkViettelAndDDV() {
  console.log('=== VIETTEL STORE ===');
  const resVT = await axios.get('https://viettelstore.vn/dien-thoai', { headers });
  const $vt = cheerio.load(resVT.data);
  // find manufactures / brands
  const vtBrands = new Set();
  $vt('.filter-item a, .list-brand a, .manufacturer a, #divManufacture a, a[href*="dtdd-"], a[href*="dien-thoai-"]').each((_, el) => {
    const t = $vt(el).text().trim();
    const h = $vt(el).attr('href') || '';
    if (t) vtBrands.add(`${t} -> ${h}`);
  });
  console.log('Viettel elements found:');
  for (const b of vtBrands) console.log(' ', b);

  // Let's also check Di Dong Viet
  console.log('\n=== DI DONG VIET ===');
  const resDDV = await axios.get('https://didongviet.vn/dien-thoai.html', { headers });
  const $ddv = cheerio.load(resDDV.data);
  const ddvBrands = new Set();
  $ddv('.filter-brand a, .brand-list a, .quick-filter a, a[href*="dien-thoai"]').each((_, el) => {
    const t = $ddv(el).text().trim();
    const h = $ddv(el).attr('href') || '';
    if (t && t.length < 30) ddvBrands.add(`${t} -> ${h}`);
  });
  console.log('DDV elements found:');
  for (const b of ddvBrands) console.log(' ', b);
}

checkViettelAndDDV();

