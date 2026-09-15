import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

async function inspectHHAndViettel() {
  // Hoang Ha
  const resHH = await axios.get('https://hoanghamobile.com/dien-thoai-di-dong', { headers });
  const $hh = cheerio.load(resHH.data);
  console.log('=== HOANG HA HTML INSPECTION ===');
  // Look for product containers
  $hh('div').each((_, el) => {
    const cls = $hh(el).attr('class') || '';
    if (cls.includes('product') || cls.includes('item') || cls.includes('list')) {
      const txt = $hh(el).text().trim();
      if (txt.includes('₫') || txt.includes('đ') || txt.includes('Galaxy') || txt.includes('iPhone')) {
        // find links inside
        const links = $hh(el).find('a');
        if (links.length > 0 && links.length < 5 && txt.length < 200 && txt.length > 20) {
          console.log(`Class [${cls}] -> text: ${txt.replace(/\s+/g, ' ')}`);
        }
      }
    }
  });

  // Viettel Store
  const resVT = await axios.get('https://viettelstore.vn/dien-thoai', { headers });
  const $vt = cheerio.load(resVT.data);
  console.log('\n=== VIETTEL STORE HTML INSPECTION ===');
  $vt('div').each((_, el) => {
    const cls = $vt(el).attr('class') || '';
    if (cls.includes('product') || cls.includes('item') || cls.includes('item-') || cls.includes('box')) {
      const txt = $vt(el).text().trim();
      if (txt.includes('₫') || txt.includes('đ') || txt.includes('Galaxy') || txt.includes('iPhone')) {
        const links = $vt(el).find('a');
        if (links.length > 0 && links.length < 5 && txt.length < 200 && txt.length > 20) {
          console.log(`Class [${cls}] -> text: ${txt.replace(/\s+/g, ' ')}`);
        }
      }
    }
  });
}

inspectHHAndViettel();

