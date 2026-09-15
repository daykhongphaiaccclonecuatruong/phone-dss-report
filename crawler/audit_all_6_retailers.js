import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function getHtml(url) {
  try {
    const res = await axios.get(url, { headers, timeout: 20000 });
    return res.data;
  } catch (e) {
    console.error(`Error fetching ${url}: ${e.message}`);
    return null;
  }
}

// Canonical brand normalizer
function normalizeBrand(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s.includes('apple') || s.includes('iphone')) return 'Apple';
  if (s.includes('samsung') || s.includes('galaxy')) return 'Samsung';
  if (s.includes('xiaomi') || s.includes('redmi') || s.includes('poco')) return 'Xiaomi (Redmi / POCO)';
  if (s.includes('oppo') || s.includes('reno') || s.includes('find')) return 'OPPO';
  if (s.includes('vivo') || s.includes('iqoo')) return 'vivo';
  if (s.includes('realme')) return 'realme';
  if (s.includes('honor')) return 'HONOR';
  if (s.includes('tecno')) return 'TECNO';
  if (s.includes('nubia') || s.includes('redmagic') || s.includes('zte')) return 'Nubia / ZTE';
  if (s.includes('infinix')) return 'Infinix';
  if (s.includes('nokia') || s.includes('hmd')) return 'Nokia / HMD';
  if (s.includes('asus') || s.includes('rog')) return 'ASUS (ROG Phone)';
  if (s.includes('sony') || s.includes('xperia')) return 'Sony';
  if (s.includes('nothing')) return 'Nothing Phone';
  if (s.includes('oneplus')) return 'OnePlus';
  if (s.includes('huawei')) return 'Huawei';
  if (s.includes('masstel')) return 'Masstel';
  if (s.includes('mobell')) return 'Mobell';
  if (s.includes('itel')) return 'Itel';
  if (s.includes('benco')) return 'Benco';
  if (s.includes('tcl')) return 'TCL';
  if (s.includes('meizu')) return 'Meizu';
  if (s.includes('motorola')) return 'Motorola';
  if (s.includes('inoi')) return 'Inoi';
  if (s.includes('viettel') || s.includes('vsmart') || s.includes('xphone')) return raw.trim();
  return null;
}

async function run() {
  const storeData = {};

  // 1. CellphoneS
  console.log('--- Scanning CellphoneS ---');
  const htmlCPS = await getHtml('https://cellphones.com.vn/mobile.html');
  const cpsBrands = new Set();
  if (htmlCPS) {
    const $ = cheerio.load(htmlCPS);
    $('a[href*="/mobile/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim() || $(el).find('img').attr('alt') || '';
      const m = href.match(/mobile\/([a-zA-Z0-9\-]+)\.html/);
      if (m && !['phu-kien', 'hang-cu', 'dien-thoai-pho-thong', 'dien-thoai-gaming', 'dien-thoai-pin-trau', 'dien-thoai-chup-anh-quay-phim', 'ai'].includes(m[1])) {
        const norm = normalizeBrand(text || m[1]);
        if (norm) cpsBrands.add(norm);
      }
    });
  }
  storeData['CellphoneS'] = Array.from(cpsBrands);

  // 2. Thế Giới Di Động
  console.log('--- Scanning Thế Giới Di Động ---');
  const htmlTGDD = await getHtml('https://www.thegioididong.com/dtdd');
  const tgddBrands = new Set();
  if (htmlTGDD) {
    const $ = cheerio.load(htmlTGDD);
    $('a[href*="dtdd-"], a[data-href*="dtdd-"]').each((i, el) => {
      const href = $(el).attr('href') || $(el).attr('data-href') || '';
      const text = $(el).text().trim() || $(el).find('img').attr('alt') || '';
      const m = href.match(/dtdd-([a-zA-Z0-9\-]+)/);
      if (m) {
        const norm = normalizeBrand(text || m[1]);
        if (norm) tgddBrands.add(norm);
      }
    });
  }
  storeData['Thế Giới Di Động'] = Array.from(tgddBrands);

  // 3. FPT Shop
  console.log('--- Scanning FPT Shop ---');
  const htmlFPT = await getHtml('https://fptshop.com.vn/dien-thoai');
  const fptBrands = new Set();
  if (htmlFPT) {
    const $ = cheerio.load(htmlFPT);
    $('a[href*="/dien-thoai/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim() || $(el).find('img').attr('alt') || '';
      const m = href.match(/\/dien-thoai\/([a-zA-Z0-9\-]+)/);
      if (m) {
        const norm = normalizeBrand(text || m[1]);
        if (norm) fptBrands.add(norm);
      }
    });
  }
  storeData['FPT Shop'] = Array.from(fptBrands);

  // 4. Hoàng Hà Mobile
  console.log('--- Scanning Hoàng Hà Mobile ---');
  const htmlHH = await getHtml('https://hoanghamobile.com/dien-thoai-di-dong');
  const hhBrands = new Set();
  if (htmlHH) {
    const $ = cheerio.load(htmlHH);
    $('a[href*="/dien-thoai-di-dong/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim() || $(el).find('img').attr('alt') || '';
      const m = href.match(/\/dien-thoai-di-dong\/([a-zA-Z0-9\-]+)/);
      if (m) {
        const norm = normalizeBrand(text || m[1]);
        if (norm) hhBrands.add(norm);
      }
    });
  }
  storeData['Hoàng Hà Mobile'] = Array.from(hhBrands);

  // 5. Di Động Việt
  console.log('--- Scanning Di Động Việt ---');
  const htmlDDV = await getHtml('https://didongviet.vn/dien-thoai.html');
  const ddvBrands = new Set();
  if (htmlDDV) {
    const $ = cheerio.load(htmlDDV);
    $('a[href*="dien-thoai"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim() || $(el).find('img').attr('alt') || '';
      const norm = normalizeBrand(text + ' ' + href);
      if (norm) ddvBrands.add(norm);
    });
  }
  storeData['Di Động Việt'] = Array.from(ddvBrands);

  // 6. Viettel Store
  console.log('--- Scanning Viettel Store ---');
  const htmlVT = await getHtml('https://viettelstore.vn/dien-thoai');
  const vtBrands = new Set();
  if (htmlVT) {
    const $ = cheerio.load(htmlVT);
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim() || $(el).find('img').attr('alt') || '';
      if (href.includes('dien-thoai') || href.includes('dtdd') || href.includes('apple') || href.includes('samsung') || href.includes('xiaomi') || href.includes('oppo') || href.includes('vivo') || href.includes('realme') || href.includes('honor') || href.includes('tecno')) {
        const norm = normalizeBrand(text + ' ' + href);
        if (norm) vtBrands.add(norm);
      }
    });
  }
  storeData['Viettel Store'] = Array.from(vtBrands);

  // Also let's scan Viettel Store main page or product listings
  const htmlVTMain = await getHtml('https://viettelstore.vn');
  if (htmlVTMain) {
    const $ = cheerio.load(htmlVTMain);
    $('a').each((i, el) => {
      const text = $(el).text().trim() || $(el).find('img').attr('alt') || '';
      const href = $(el).attr('href') || '';
      if (href.includes('dien-thoai')) {
        const norm = normalizeBrand(text + ' ' + href);
        if (norm) vtBrands.add(norm);
      }
    });
  }
  storeData['Viettel Store'] = Array.from(vtBrands);

  // Summary Matrix
  console.log('\n=========================================');
  console.log('BẢNG TỔNG HỢP CÁC HÃNG TẠI 6 NHÀ BÁN LẺ');
  console.log('=========================================');

  // Collect all unique brands
  const allBrands = new Set();
  for (const list of Object.values(storeData)) {
    for (const b of list) allBrands.add(b);
  }

  const sortedBrands = Array.from(allBrands).sort();
  console.log(`\nTổng số thương hiệu điện thoại đang phân phối tại VN: ${sortedBrands.length}\n`);

  const matrix = [];
  for (const b of sortedBrands) {
    const row = {
      'Thương hiệu': b,
      'CellphoneS': storeData['CellphoneS'].includes(b) ? '✅' : '❌',
      'TGDD': storeData['Thế Giới Di Động'].includes(b) ? '✅' : '❌',
      'FPT Shop': storeData['FPT Shop'].includes(b) ? '✅' : '❌',
      'Hoàng Hà': storeData['Hoàng Hà Mobile'].includes(b) ? '✅' : '❌',
      'Di Động Việt': storeData['Di Động Việt'].includes(b) ? '✅' : '❌',
      'Viettel Store': storeData['Viettel Store'].includes(b) ? '✅' : '❌',
    };
    matrix.push(row);
  }

  console.table(matrix);

  fs.writeFileSync('audit_matrix.json', JSON.stringify({ storeData, matrix }, null, 2), 'utf-8');
}

run();

