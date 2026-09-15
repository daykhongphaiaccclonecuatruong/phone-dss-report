import * as cheerio from 'cheerio';
import chalk from 'chalk';
import { CONFIG } from '../config.js';
import { fetchPage, IpBannedError } from './client.js';

/**
 * Trích xuất danh sách máy từ HTML của 1 trang danh mục
 */
function parseDevicesFromHtml($, brandName, currentUrl) {
  const devices = [];
  
  const makerItems = $('.makers ul li a');
  if (makerItems.length === 0) {
    // Nếu trang không có máy nào trong makers (hoặc lỗi cấu trúc)
    return devices;
  }

  makerItems.each((_, element) => {
    try {
      const $el = $(element);
      const href = $el.attr('href');
      
      let deviceName = $el.find('strong span').text().trim();
      if (!deviceName) {
        deviceName = $el.find('span').text().trim();
      }
      if (!deviceName) {
        deviceName = $el.text().trim();
      }

      const deviceUrl = href ? (href.startsWith('http') ? href : `${CONFIG.BASE_URL}/${href}`) : '';
      const $img = $el.find('img');
      const thumbUrl = $img.attr('src') || $img.attr('data-src') || '';

      if (deviceName && deviceUrl) {
        devices.push({
          brand: brandName,
          deviceName: deviceName,
          deviceUrl: deviceUrl,
          thumbnailUrl: thumbUrl,
          status: 'Success',
          errorNote: ''
        });
      } else {
        // Ghi lại máy bị thiếu thông tin để cào tay sau
        devices.push({
          brand: brandName,
          deviceName: deviceName || 'UNKNOWN_DEVICE_NAME',
          deviceUrl: deviceUrl || currentUrl,
          thumbnailUrl: thumbUrl,
          status: 'Error',
          errorNote: 'Thiếu tên máy hoặc URL chi tiết'
        });
      }
    } catch (err) {
      devices.push({
        brand: brandName,
        deviceName: 'PARSE_ERROR_ITEM',
        deviceUrl: currentUrl,
        thumbnailUrl: '',
        status: 'Error',
        errorNote: `Lỗi parse item: ${err.message}`
      });
    }
  });

  return devices;
}

/**
 * Tìm tất cả các link phân trang trong trang danh mục của hãng
 */
function findPaginationUrls($, currentUrl) {
  const pageUrls = new Set();
  
  $('.nav-pages a').each((_, element) => {
    const href = $(element).attr('href');
    if (href && href !== '#' && !href.startsWith('javascript:')) {
      const fullUrl = href.startsWith('http') ? href : `${CONFIG.BASE_URL}/${href}`;
      pageUrls.add(fullUrl);
    }
  });

  return Array.from(pageUrls);
}

/**
 * Cào toàn bộ thiết bị của 1 hãng (duyệt hết tất cả các trang phân trang)
 */
export async function fetchDevicesForBrand(brand, brandIndex, onPageProgress) {
  const visitedUrls = new Set();
  const queueUrls = [brand.url];
  const allDevices = [];

  while (queueUrls.length > 0) {
    const currentUrl = queueUrls.shift();
    if (visitedUrls.has(currentUrl)) continue;
    visitedUrls.add(currentUrl);

    const pageIndex = visitedUrls.size;
    
    try {
      const html = await fetchPage(currentUrl);
      const $ = cheerio.load(html);

      // Bóc tách danh sách máy trên trang hiện tại
      const pageDevices = parseDevicesFromHtml($, brand.name, currentUrl);
      allDevices.push(...pageDevices);

      // Tìm các trang phân trang tiếp theo và thêm vào queue
      const paginationLinks = findPaginationUrls($, currentUrl);
      for (const link of paginationLinks) {
        if (!visitedUrls.has(link) && !queueUrls.includes(link)) {
          queueUrls.push(link);
        }
      }

      if (onPageProgress) {
        onPageProgress({
          brandName: brand.name,
          pageIndex,
          pageDevicesCount: pageDevices.length,
          totalSoFar: allDevices.length,
          remainingPages: queueUrls.length
        });
      }
    } catch (error) {
      if (error instanceof IpBannedError) {
        throw error; // Ném lỗi ban IP ra ngoài để dừng ngay
      }

      console.log(chalk.red(`\n   ⚠️ Lỗi cào trang: ${currentUrl} (${error.message}). Ghi nhận để cào tay sau.`));
      
      // Lưu bản ghi lỗi vào danh sách để người dùng cào tay sau
      allDevices.push({
        brand: brand.name,
        deviceName: `PAGE_${pageIndex}_FETCH_FAILED`,
        deviceUrl: currentUrl,
        thumbnailUrl: '',
        status: 'Error',
        errorNote: `Lỗi tải trang phân trang ${pageIndex}: ${error.message}`
      });
    }
  }

  // Đánh số thứ tự (STT) cho từng máy trong hãng
  return allDevices.map((item, idx) => ({
    sttHang: idx + 1,
    ...item
  }));
}
