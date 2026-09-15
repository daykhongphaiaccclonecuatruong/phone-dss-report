import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function probeStore(name, url, fn) {
  console.log(`\n========================================`);
  console.log(`PROBING: ${name} (${url})`);
  console.log(`========================================`);
  try {
    const res = await axios.get(url, { headers, timeout: 20000 });
    await fn(res.data, res.headers);
  } catch (err) {
    console.error(`Error probing ${name}: ${err.message}`);
  }
}

async function runProbes() {
  const findings = {};

  // 1. CellphoneS (Probe category + API / Next.js)
  await probeStore('CellphoneS', 'https://cellphones.com.vn/mobile.html', async (html) => {
    const $ = cheerio.load(html);
    // Check if products are in HTML
    const productsInHtml = $('.product-item, .product-info, [data-product-id]').length;
    // Check Next.js data
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">({.*?})<\/script>/);
    let nextDataInfo = 'None';
    if (nextDataMatch) {
      try {
        const json = JSON.parse(nextDataMatch[1]);
        const keys = Object.keys(json.props?.pageProps || {});
        nextDataInfo = `Next.js PageProps keys: ${keys.join(', ')}`;
      } catch (e) {
        nextDataInfo = 'Error parsing Next.js';
      }
    }
    // Also test CellphoneS internal REST / GraphQL API
    let apiInfo = 'Testing API...';
    try {
      const apiRes = await axios.post('https://api.cellphones.com.vn/v2/graphql/normal', {
        query: `query {
          products(
            filter: { category_id: { eq: 3 } }
            pageSize: 10
            currentPage: 1
          ) {
            total_count
            items {
              id
              name
              sku
              url_key
              price_range {
                minimum_price {
                  final_price { value }
                  regular_price { value }
                }
              }
              stock_status
            }
          }
        }`
      }, { headers });
      if (apiRes.data?.data?.products) {
        apiInfo = `GraphQL API OK: Found ${apiRes.data.data.products.total_count} total phones!`;
      }
    } catch (e) {
      // Test REST API
      try {
        const restRes = await axios.get('https://api.cellphones.com.vn/v2/products/categories/3?size=10&page=1', { headers });
        apiInfo = `REST API OK: ${JSON.stringify(restRes.data).substring(0, 100)}`;
      } catch (e2) {
        apiInfo = `API error: ${e2.message}`;
      }
    }

    findings['CellphoneS'] = {
      htmlItems: productsInHtml,
      nextData: nextDataInfo,
      api: apiInfo,
      sampleCards: $('.product-item').slice(0, 2).map((i, el) => $(el).text().trim().replace(/\s+/g, ' ')).get()
    };
    console.log(JSON.stringify(findings['CellphoneS'], null, 2));
  });

  // 2. Hoàng Hà Mobile
  await probeStore('Hoàng Hà Mobile', 'https://hoanghamobile.com/dien-thoai-di-dong', async (html) => {
    const $ = cheerio.load(html);
    const items = $('.item-product, .col-content, div[data-id], .product-item');
    const samples = [];
    $('.col-content, .item-product').slice(0, 3).each((i, el) => {
      const title = $(el).find('.title a, h3 a').text().trim();
      const price = $(el).find('.price, .current-price').text().trim();
      const link = $(el).find('.title a, h3 a').attr('href');
      samples.push({ title, price, link });
    });
    // Check pagination
    const pagination = $('.pagination a, .btn-more, a.more-link').map((i, el) => $(el).attr('href') || $(el).text()).get();

    findings['HoangHaMobile'] = {
      htmlItems: items.length,
      sampleProducts: samples,
      pagination: pagination
    };
    console.log(JSON.stringify(findings['HoangHaMobile'], null, 2));
  });

  // 3. Thế Giới Di Động (TGDD)
  await probeStore('Thế Giới Di Động', 'https://www.thegioididong.com/dtdd', async (html) => {
    const $ = cheerio.load(html);
    const items = $('li.item, .listproduct li');
    const samples = [];
    $('li.item, .listproduct li').slice(0, 3).each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const price = $(el).find('.price, strong.price').text().trim();
      const link = $(el).find('a.main-contain, a').attr('href');
      samples.push({ title, price, link });
    });
    // Check view more / ajax endpoint
    const btnMore = $('.view-more a, .see-more').attr('href') || $('.view-more a, .see-more').attr('onclick');

    findings['TGDD'] = {
      htmlItems: items.length,
      sampleProducts: samples,
      pagination: btnMore
    };
    console.log(JSON.stringify(findings['TGDD'], null, 2));
  });

  // 4. FPT Shop
  await probeStore('FPT Shop', 'https://fptshop.com.vn/dien-thoai', async (html) => {
    const $ = cheerio.load(html);
    const items = $('.product-item, .ProductCard_card__');
    const samples = [];
    // Check Next.js data
    const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">({.*?})<\/script>/);
    let nextInfo = 'None';
    if (nextMatch) {
      try {
        const json = JSON.parse(nextMatch[1]);
        const pList = json.props?.pageProps?.products || json.props?.pageProps?.initialData?.products || [];
        nextInfo = `Next.js props products count: ${Array.isArray(pList) ? pList.length : typeof pList}`;
      } catch (e) {
        nextInfo = 'Parse error';
      }
    }
    // Test API
    let apiInfo = 'None';
    try {
      const fptApi = await axios.get('https://fptshop.com.vn/api-data/dien-thoai?page=1&limit=20', { headers });
      apiInfo = `API returned: ${typeof fptApi.data}`;
    } catch (e) {}

    findings['FPTShop'] = {
      htmlItems: items.length,
      nextData: nextInfo,
      sampleProducts: samples
    };
    console.log(JSON.stringify(findings['FPTShop'], null, 2));
  });

  // 5. Di Động Việt
  await probeStore('Di Động Việt', 'https://didongviet.vn/dien-thoai.html', async (html) => {
    const $ = cheerio.load(html);
    const items = $('.product-item, .product-card, .item');
    const samples = [];
    $('.product-item, .product-card').slice(0, 3).each((i, el) => {
      const title = $(el).find('.product-name, h3').text().trim();
      const price = $(el).find('.price, .product-price').text().trim();
      const link = $(el).find('a').attr('href');
      samples.push({ title, price, link });
    });

    findings['DiDongViet'] = {
      htmlItems: items.length,
      sampleProducts: samples
    };
    console.log(JSON.stringify(findings['DiDongViet'], null, 2));
  });

  // 6. Viettel Store
  await probeStore('Viettel Store', 'https://viettelstore.vn/dien-thoai', async (html) => {
    const $ = cheerio.load(html);
    const items = $('.product-item, .item, .ProductItem');
    const samples = [];
    $('.item, .ProductItem').slice(0, 3).each((i, el) => {
      const title = $(el).find('.name, h3').text().trim();
      const price = $(el).find('.price').text().trim();
      const link = $(el).find('a').attr('href');
      samples.push({ title, price, link });
    });

    findings['ViettelStore'] = {
      htmlItems: items.length,
      sampleProducts: samples
    };
    console.log(JSON.stringify(findings['ViettelStore'], null, 2));
  });

  fs.writeFileSync('store_probing_details.json', JSON.stringify(findings, null, 2), 'utf-8');
}

runProbes();

