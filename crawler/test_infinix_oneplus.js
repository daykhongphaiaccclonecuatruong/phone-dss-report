import axios from 'axios';
import * as cheerio from 'cheerio';
import { parsePriceNumber, extractMemory, normalizeBrandName, generateVariantId } from './src/vnExporter.js';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

async function testInfinixAndOnePlus() {
  console.log('=== TEST INFINIX & ONEPLUS ===');

  // CellphoneS Infinix
  try {
    const res = await axios.get('https://cellphones.com.vn/mobile/infinix.html', { headers });
    const $ = cheerio.load(res.data);
    console.log('CPS Infinix products found in HTML:', $('.product-item, [data-product-id]').length);
    $('.product-item, [data-product-id]').each((i, el) => {
      console.log('  CPS Infinix item:', $(el).find('.product__name h3, h3, .product-title').text().trim(), '-> Price:', $(el).find('.product__price--show, .price').text().trim());
    });
  } catch (e) {
    console.log('CPS Infinix error:', e.message);
  }

  // TGDD OnePlus
  try {
    const res = await axios.get('https://www.thegioididong.com/dtdd-oneplus', { headers });
    const $ = cheerio.load(res.data);
    console.log('TGDD OnePlus items found in HTML:', $('li.item, .listproduct li').length);
    $('li.item, .listproduct li').each((i, el) => {
      const a = $(el).find('a.main-contain, a').first();
      console.log('  TGDD OnePlus item:', a.attr('title') || $(el).find('h3').text().trim(), '-> Price:', $(el).find('.price, strong.price').text().trim());
    });
  } catch (e) {
    console.log('TGDD OnePlus error:', e.message);
  }

  // TGDD Infinix
  try {
    const res = await axios.get('https://www.thegioididong.com/dtdd-infinix', { headers });
    const $ = cheerio.load(res.data);
    console.log('TGDD Infinix items found in HTML:', $('li.item, .listproduct li').length);
    $('li.item, .listproduct li').each((i, el) => {
      const a = $(el).find('a.main-contain, a').first();
      console.log('  TGDD Infinix item:', a.attr('title') || $(el).find('h3').text().trim(), '-> Price:', $(el).find('.price, strong.price').text().trim());
    });
  } catch (e) {
    console.log('TGDD Infinix error:', e.message);
  }
}

testInfinixAndOnePlus();

