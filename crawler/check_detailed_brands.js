import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function checkDetailedBrands() {
  const result = {};

  // 1. CellphoneS: Inspect navigation menu & filter brands
  const resCPS = await axios.get('https://cellphones.com.vn/mobile.html', { headers });
  const $cps = cheerio.load(resCPS.data);
  const cps = new Set();
  $cps('a').each((_, el) => {
    const href = $cps(el).attr('href') || '';
    if (href.match(/cellphones\.com\.vn\/mobile\/[a-zA-Z0-9\-]+\.html/)) {
      const slug = href.replace(/.*\/mobile\//, '').replace('.html', '').toLowerCase();
      if (!['hang-cu', 'phu-kien', 'chinh-hang', 'dien-thoai-gaming', 'dien-thoai-pin-trau', 'dien-thoai-chup-anh-quay-phim', 'dien-thoai-pho-thong', 'ai'].includes(slug)) {
        cps.add(slug);
      }
    }
  });
  result['CellphoneS'] = Array.from(cps).sort();

  // 2. Hoàng Hà Mobile: inspect navigation menu
  const resHH = await axios.get('https://hoanghamobile.com/dien-thoai-di-dong', { headers });
  const $hh = cheerio.load(resHH.data);
  const hh = new Set();
  $hh('a[href*="/dien-thoai-di-dong/"]').each((_, el) => {
    const href = $hh(el).attr('href') || '';
    const parts = href.split('/dien-thoai-di-dong/')[1];
    if (parts) {
      const slug = parts.split('/')[0].split('?')[0].toLowerCase();
      if (slug && !['san-pham-hot', 'flash-sale', 'hang-cu', 'phu-kien', 'tin-tuc'].includes(slug)) {
        hh.add(slug);
      }
    }
  });
  result['Hoàng Hà Mobile'] = Array.from(hh).sort();

  // 3. Thế Giới Di Động (TGDD): inspect main menu & brand quicklinks
  const resTGDD = await axios.get('https://www.thegioididong.com/dtdd', { headers });
  const $tgdd = cheerio.load(resTGDD.data);
  const tgdd = new Set();
  $tgdd('a[href*="dtdd-"], a[data-href*="dtdd-"]').each((_, el) => {
    const href = $tgdd(el).attr('href') || $tgdd(el).attr('data-href') || '';
    const m = href.match(/dtdd-([a-zA-Z0-9\-]+)/);
    if (m) {
      const slug = m[1].toLowerCase();
      if (!['gap', 'choi-game', 'pin-khung', 'livestream', 'mong-nhe', 'chong-nuoc-bui', '5g', 'tra-gop-0-phan-tram'].includes(slug) && !slug.startsWith('ram-') && !slug.startsWith('rom-')) {
        tgdd.add(slug);
      }
    }
  });
  result['Thế Giới Di Động'] = Array.from(tgdd).sort();

  // 4. FPT Shop
  const resFPT = await axios.get('https://fptshop.com.vn/dien-thoai', { headers });
  const $fpt = cheerio.load(resFPT.data);
  const fpt = new Set();
  $fpt('a[href*="/dien-thoai/"]').each((_, el) => {
    const href = $fpt(el).attr('href') || '';
    const parts = href.split('/dien-thoai/')[1];
    if (parts) {
      const slug = parts.split('/')[0].split('?')[0].toLowerCase();
      if (slug && !['tra-gop-0', 'hang-cu', 'phu-kien', 'apple-authorized-reseller', 'iphone-duo'].includes(slug)) {
        // filter out individual product slugs (which usually have numbers/dashes like iphone-17-pro-max)
        if (!slug.includes('-series') && !slug.match(/\d+/) && !slug.includes('gb')) {
          fpt.add(slug);
        } else if (['apple-iphone', 'honor-magic-series', 'xiaomi-poco-series'].includes(slug)) {
          fpt.add(slug);
        }
      }
    }
  });
  result['FPT Shop'] = Array.from(fpt).sort();

  // 5. Di Động Việt
  const resDDV = await axios.get('https://didongviet.vn/dien-thoai.html', { headers });
  const $ddv = cheerio.load(resDDV.data);
  const ddv = new Set();
  $ddv('a[href*="/dien-thoai/"], a[href*="/dien-thoai-"]').each((_, el) => {
    const href = $ddv(el).attr('href') || '';
    let slug = '';
    if (href.includes('/dien-thoai/')) slug = href.split('/dien-thoai/')[1].split('/')[0].split('?')[0].replace('.html', '');
    else if (href.includes('/dien-thoai-')) slug = href.split('/dien-thoai-')[1].split('/')[0].split('?')[0].replace('.html', '');
    slug = slug.toLowerCase();
    if (slug && !slug.includes('chinh-hang') && !slug.includes('cu-gia-re') && !slug.match(/\d{2,}/) && !slug.includes('gb') && !slug.includes('pro-max')) {
      ddv.add(slug);
    }
  });
  result['Di Động Việt'] = Array.from(ddv).sort();

  // 6. Viettel Store
  const resVT = await axios.get('https://viettelstore.vn/dien-thoai', { headers });
  const $vt = cheerio.load(resVT.data);
  const vt = new Set();
  $vt('a[href*="dien-thoai-"]').each((_, el) => {
    const href = $vt(el).attr('href') || '';
    const m = href.match(/dien-thoai-([a-zA-Z0-9\-]+)/);
    if (m) {
      const slug = m[1].toLowerCase().replace('.html', '');
      if (!['gia-re', 'chinh-hang', 'kem-goi-cuoc'].includes(slug)) {
        vt.add(slug);
      }
    }
  });
  result['Viettel Store'] = Array.from(vt).sort();

  fs.writeFileSync('detailed_brands_by_store.json', JSON.stringify(result, null, 2), 'utf-8');
  console.log(JSON.stringify(result, null, 2));
}

checkDetailedBrands();

