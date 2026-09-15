import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function inspectDetail() {
  // 1. CellphoneS DOM
  console.log('--- 1. CellphoneS Details ---');
  const resCPS = await axios.get('https://cellphones.com.vn/mobile.html', { headers });
  const $cps = cheerio.load(resCPS.data);
  const cpsProducts = [];
  $cps('.product-item').each((i, el) => {
    if (i < 5) {
      const name = $cps(el).find('.product__name h3, h3').text().trim();
      const showPrice = $cps(el).find('.product__price--show').text().trim();
      const throughPrice = $cps(el).find('.product__price--through').text().trim();
      const link = $cps(el).find('a.product__link').attr('href');
      cpsProducts.push({ name, showPrice, throughPrice, link });
    }
  });
  console.log('CellphoneS Products:', cpsProducts);

  // 2. Hoàng Hà Mobile DOM
  console.log('\n--- 2. Hoàng Hà Mobile Details ---');
  const resHH = await axios.get('https://hoanghamobile.com/dien-thoai-di-dong', { headers });
  const $hh = cheerio.load(resHH.data);
  const hhProducts = [];
  $hh('.item-product').each((i, el) => {
    if (i < 5) {
      const name = $hh(el).find('.title a, h4 a, h3 a').text().trim() || $hh(el).find('.info a').attr('title');
      const price = $hh(el).find('.price strong, .price').text().trim();
      const link = $hh(el).find('.title a, .info a').attr('href');
      hhProducts.push({ name, price, link });
    }
  });
  console.log('Hoàng Hà Products:', hhProducts);

  // 3. TGDD DOM & AJAX endpoint
  console.log('\n--- 3. Thế Giới Di Động Details ---');
  const resTGDD = await axios.get('https://www.thegioididong.com/dtdd', { headers });
  const $tgdd = cheerio.load(resTGDD.data);
  const tgddProducts = [];
  $tgdd('li.item[data-id], li.item a.main-contain').each((i, el) => {
    if (i < 5) {
      const parent = $tgdd(el).closest('li.item');
      const name = parent.find('h3').text().trim();
      const price = parent.find('.price').text().trim();
      const link = parent.find('a.main-contain').attr('href');
      const id = parent.attr('data-id');
      tgddProducts.push({ id, name, price, link: `https://www.thegioididong.com${link}` });
    }
  });
  console.log('TGDD Products:', tgddProducts);

  // 4. FPT Shop (Look at embedded scripts / JSON)
  console.log('\n--- 4. FPT Shop Details ---');
  const resFPT = await axios.get('https://fptshop.com.vn/dien-thoai', { headers });
  const $fpt = cheerio.load(resFPT.data);
  const fptProducts = [];
  $fpt('a[href*="/dien-thoai/"]').each((i, el) => {
    const text = $fpt(el).text().trim();
    const href = $fpt(el).attr('href');
    if (text.includes('₫') || text.includes('đ') || href.includes('iphone') || href.includes('samsung') || href.includes('xiaomi')) {
      if (fptProducts.length < 5 && text.length > 10) {
        fptProducts.push({ text: text.replace(/\s+/g, ' '), href: `https://fptshop.com.vn${href}` });
      }
    }
  });
  console.log('FPT Products found in HTML:', fptProducts);

  // 5. Di Động Việt DOM
  console.log('\n--- 5. Di Động Việt Details ---');
  const resDDV = await axios.get('https://didongviet.vn/dien-thoai.html', { headers });
  const $ddv = cheerio.load(resDDV.data);
  const ddvProducts = [];
  $ddv('a[href*=".html"]').each((i, el) => {
    const text = $ddv(el).text().trim();
    const href = $ddv(el).attr('href');
    if (text.includes('₫') || text.includes('đ') || (href && href.includes('dien-thoai/'))) {
      if (ddvProducts.length < 5 && text.length > 5) {
        ddvProducts.push({ text: text.replace(/\s+/g, ' '), href });
      }
    }
  });
  console.log('DDV Products found in HTML:', ddvProducts);

  // 6. Viettel Store DOM
  console.log('\n--- 6. Viettel Store Details ---');
  const resVT = await axios.get('https://viettelstore.vn/dien-thoai', { headers });
  const $vt = cheerio.load(resVT.data);
  const vtProducts = [];
  $vt('.ProductList .item, .product-list .item, .item_product').each((i, el) => {
    if (i < 5) {
      const name = $vt(el).find('.name, .title, h3').text().trim();
      const price = $vt(el).find('.price, .price-current').text().trim();
      const link = $vt(el).find('a').attr('href');
      vtProducts.push({ name, price, link });
    }
  });
  // Also search for product links in Viettel Store HTML
  if (vtProducts.length === 0) {
    $vt('a[href*="dtdd-"], a[href*="dien-thoai-"]').each((i, el) => {
      const t = $vt(el).text().trim();
      const h = $vt(el).attr('href');
      if (t && t.length > 10 && (t.includes('GB') || t.includes('128') || t.includes('256'))) {
        if (vtProducts.length < 5) vtProducts.push({ name: t, link: h });
      }
    });
  }
  console.log('Viettel Products:', vtProducts);
}

inspectDetail();

