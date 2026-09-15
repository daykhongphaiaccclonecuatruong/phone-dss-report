import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

async function testUsedPhoneEndpoints() {
  const usedUrls = {
    'CellphoneS_Used': 'https://cellphones.com.vn/hang-cu/dien-thoai.html',
    'TGDD_Used': 'https://www.thegioididong.com/may-doi-tra/dien-thoai-di-dong',
    'FPTShop_Used': 'https://fptshop.com.vn/may-doi-tra/dien-thoai-cu-gia-re',
    'HoangHa_Used': 'https://hoanghamobile.com/hang-cu/dien-thoai-cu',
    'DiDongViet_Used': 'https://didongviet.vn/dien-thoai-cu.html',
    'ViettelStore_Used': 'https://viettelstore.vn/dien-thoai-cu-gia-re.html'
  };

  for (const [key, url] of Object.entries(usedUrls)) {
    try {
      const res = await axios.get(url, { headers, timeout: 15000 });
      const $ = cheerio.load(res.data);
      const title = $('title').text().trim();
      const length = res.data.length;
      console.log(`[${key}] -> Status: ${res.status} | Title: ${title.substring(0, 50)} | Bytes: ${length}`);
    } catch (e) {
      console.log(`[${key}] -> Error: ${e.message}`);
    }
  }
}

testUsedPhoneEndpoints();

