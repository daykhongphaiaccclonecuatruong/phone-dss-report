import * as cheerio from 'cheerio';
import { fetchPage } from './client.js';

/**
 * Chuẩn hóa tên trường key thành dạng snake_case đẹp
 */
function formatKey(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Bóc tách toàn diện 100% tất cả các thông số kỹ thuật
 */
export function parseDeviceSpecsFromHtml(html, deviceUrl = '') {
  const $ = cheerio.load(html);
  
  const pageTitle = $('h1.specs-phone-name-title').text().trim();
  const bigImg = $('.specs-photo-main img').attr('src') || '';
  
  const specs = {};

  $('#specs-list table').each((_, table) => {
    const $table = $(table);
    
    // Tên nhóm lớn (Network, Launch, Body, Display, Platform, Memory, Main Camera, Selfie Camera, Sound, Comms, Features, Battery, Misc, Our Tests...)
    let categoryName = $table.find('th').first().text().trim();
    if (!categoryName) categoryName = 'General';
    const categoryKey = formatKey(categoryName);

    if (!specs[categoryKey]) {
      specs[categoryKey] = {};
    }

    let currentMainKey = '';

    $table.find('tr').each((_, tr) => {
      const $tr = $(tr);
      const rawTtl = $tr.find('td.ttl').text().trim();
      const rawNfo = $tr.find('td.nfo').text().trim();

      if (rawTtl) {
        currentMainKey = formatKey(rawTtl);
        if (rawNfo) {
          specs[categoryKey][currentMainKey] = rawNfo;
        }
      } else if (rawNfo && currentMainKey) {
        // Dòng chi tiết bổ sung của cùng 1 thông số (ví dụ: SIM có thêm dòng IP68/Stylus, Display có thêm DX coating, Memory có thêm UFS 4.0)
        specs[categoryKey][currentMainKey] = `${specs[categoryKey][currentMainKey]}\n${rawNfo}`.trim();
      } else if (rawNfo) {
        specs[categoryKey]['extra_info'] = rawNfo;
      }
    });
  });

  return {
    deviceName: pageTitle,
    deviceUrl: deviceUrl,
    imageUrl: bigImg,
    specs: specs
  };
}

/**
 * Cào thông số của 1 thiết bị từ URL
 */
export async function fetchDeviceSpecs(url) {
  const html = await fetchPage(url);
  return parseDeviceSpecsFromHtml(html, url);
}
