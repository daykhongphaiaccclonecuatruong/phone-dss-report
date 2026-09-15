import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

async function findUsedUrls() {
  // Check HH
  const resHH = await axios.get('https://hoanghamobile.com', { headers });
  const $hh = cheerio.load(resHH.data);
  console.log('HH Used Links:');
  $hh('a[href*="hang-cu"], a[href*="may-cu"], a[href*="doi-tra"]').each((_, el) => {
    console.log(' ', $hh(el).attr('href'), '=>', $hh(el).text().trim());
  });

  // Check Viettel
  const resVT = await axios.get('https://viettelstore.vn', { headers });
  const $vt = cheerio.load(resVT.data);
  console.log('\nViettel Used Links:');
  $vt('a[href*="hang-cu"], a[href*="may-cu"], a[href*="doi-tra"], a[href*="cu-gia-re"]').each((_, el) => {
    console.log(' ', $vt(el).attr('href'), '=>', $vt(el).text().trim());
  });
}

findUsedUrls();

