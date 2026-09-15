import * as cheerio from 'cheerio';
import chalk from 'chalk';
import { CONFIG } from '../config.js';
import { fetchPage } from './client.js';

/**
 * Lấy danh sách tất cả các hãng và số lượng máy dự kiến từ makers.php3
 */
export async function fetchBrands() {
  console.log(chalk.cyan('🔍 Đang tải danh sách toàn bộ các hãng từ: ') + chalk.underline(CONFIG.MAKERS_URL));
  
  const html = await fetchPage(CONFIG.MAKERS_URL);
  const $ = cheerio.load(html);
  
  const brands = [];
  
  // Các hãng được đặt trong bảng table hoặc .st-text
  // Thường cấu trúc: <td><a href="samsung-phones-9.php">Samsung<br><span>1380 devices</span></a></td>
  $('table td a').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href');
    
    if (href && href.includes('-phones-')) {
      // Tách tên hãng và số lượng
      const fullText = $el.text().trim();
      const countText = $el.find('span').text().trim(); // ví dụ: "1380 devices"
      
      // Tên hãng là phần text trừ đi countText
      let brandName = $el.clone().children().remove().end().text().trim();
      if (!brandName) {
        brandName = fullText.replace(countText, '').trim();
      }

      // Trích xuất số lượng từ "1380 devices" -> 1380
      let expectedDevices = 0;
      const matchCount = countText.match(/(\d+)\s*devices?/i);
      if (matchCount) {
        expectedDevices = parseInt(matchCount[1], 10);
      }

      // Đảm bảo URL là đường dẫn tuyệt đối
      const brandUrl = href.startsWith('http') ? href : `${CONFIG.BASE_URL}/${href}`;

      if (brandName) {
        brands.push({
          id: href.replace('.php', ''),
          name: brandName,
          url: brandUrl,
          relativeUrl: href,
          expectedDevices: expectedDevices
        });
      }
    }
  });

  return brands;
}
