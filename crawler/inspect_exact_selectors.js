import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function inspectSelectors() {
  // 1. CellphoneS Used page links
  const resCPS = await axios.get('https://cellphones.com.vn/hang-cu/dien-thoai.html', { headers });
  const $cps = cheerio.load(resCPS.data);
  console.log('CPS Used Page items:', $cps('.product-item').length);
  $cps('.product-item').slice(0, 3).each((i, el) => {
    console.log(' CPS item:', $cps(el).find('.product__name h3, h3').text().trim(), '->', $cps(el).find('.product__price--show').text().trim());
  });
  console.log('CPS Used brand links:');
  $cps('a[href*="/hang-cu/dien-thoai"]').each((i, el) => {
    console.log(' ', $cps(el).attr('href'), '->', $cps(el).text().trim());
  });

  // 2. TGDD title
  const resTGDD = await axios.get('https://www.thegioididong.com/dtdd-apple-iphone', { headers });
  const $tgdd = cheerio.load(resTGDD.data);
  console.log('\nTGDD items:');
  $tgdd('li.item').slice(0, 3).each((i, el) => {
    const a = $tgdd(el).find('a.main-contain, a').first();
    const title = a.attr('title') || a.find('h3').text().trim() || a.find('img').attr('alt') || a.attr('href');
    const price = $tgdd(el).find('.price, strong.price').text().trim();
    console.log(' TGDD item:', title, '->', price, '->', a.attr('href'));
  });

  // 3. Hoang Ha HTML
  const resHH = await axios.get('https://hoanghamobile.com/dien-thoai-di-dong/iphone', { headers });
  const $hh = cheerio.load(resHH.data);
  console.log('\nHoang Ha page items:');
  $hh('.item-product, .col-content, .product-item, .list-product .item').each((i, el) => {
    console.log(' HH product-item:', $hh(el).find('a').attr('href'), '->', $hh(el).text().trim().replace(/\s+/g, ' ').substring(0, 80));
  });
  // Check if Hoang Ha uses /dien-thoai-di-dong?brand=... or /dien-thoai-di-dong/apple
  $hh('a[href*="iphone-"], a[href*="dien-thoai-di-dong"]').slice(0, 5).each((i, el) => {
    console.log(' HH a href:', $hh(el).attr('href'), '->', $hh(el).text().trim().replace(/\s+/g, ' ').substring(0, 80));
  });
}

inspectSelectors();

