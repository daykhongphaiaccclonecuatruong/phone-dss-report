import axios from 'axios';
import chalk from 'chalk';
import { CONFIG } from '../config.js';

export class IpBannedError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'IpBannedError';
    this.details = details;
  }
}

function getRandomUserAgent() {
  const list = CONFIG.USER_AGENTS || [CONFIG.HEADERS['User-Agent']];
  return list[Math.floor(Math.random() * list.length)];
}

export async function sleep(minMs = CONFIG.MIN_DELAY_MS, maxMs = CONFIG.MAX_DELAY_MS) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

function checkForBanPatterns(statusCode, html, url) {
  // Chỉ 403 hoặc 503 mới là ban vĩnh viễn/tường lửa
  if (statusCode === 403 || statusCode === 503) {
    return {
      isBanned: true,
      reason: `HTTP Status Code: ${statusCode} (Access Denied / Tường lửa chặn)`
    };
  }

  const lowerHtml = (html || '').toLowerCase();
  for (const keyword of CONFIG.BAN_KEYWORDS) {
    if (lowerHtml.includes(keyword)) {
      return {
        isBanned: true,
        reason: `Phát hiện từ khóa chặn trong HTML: "${keyword}"`
      };
    }
  }

  return { isBanned: false };
}

/**
 * Gửi HTTP request có cơ chế VÒNG LẶP CHỜ TỰ ĐỘNG (Auto Exponential Backoff) khi bị 429
 * Tool sẽ KHÔNG BAO GIỜ DỪNG khi dính 429 mà sẽ kiên nhẫn chờ đến khi server mở lại.
 */
export async function fetchPage(url, customHeaders = {}, retryCount = 0) {
  await sleep();

  const userAgent = getRandomUserAgent();
  const headers = {
    ...CONFIG.HEADERS,
    'User-Agent': userAgent,
    ...customHeaders
  };

  try {
    const response = await axios.get(url, {
      headers,
      timeout: 20000,
      validateStatus: (status) => status < 500
    });

    // Nếu gặp 429: Tự động lặp lại chờ cấp số nhân, không thoát tiến trình
    if (response.status === 429) {
      // Thời gian chờ: Lần 1: 45s, Lần 2: 90s, Lần 3: 180s, Tối đa: 300s (5 phút)
      const waitTimes = [45, 90, 150, 240, 300];
      const waitSeconds = waitTimes[Math.min(retryCount, waitTimes.length - 1)];

      console.log(chalk.yellow(`\n⏳ [429 RATE LIMIT] GSMArena đang tạm giữ kết nối.`));
      console.log(chalk.yellow(`   👉 Tự động chờ ${waitSeconds}s (Lần thử lại ${retryCount + 1}). Đang kiên nhẫn đợi server mở lại...`));
      
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      return fetchPage(url, customHeaders, retryCount + 1);
    }

    // Kiểm tra ban 403 / Cloudflare
    const banCheck = checkForBanPatterns(response.status, response.data, url);
    if (banCheck.isBanned) {
      throw new IpBannedError(`Bị chặn khi truy cập ${url}: ${banCheck.reason}`, {
        url,
        status: response.status,
        reason: banCheck.reason
      });
    }

    return response.data;
  } catch (error) {
    if (error instanceof IpBannedError) {
      throw error;
    }

    if (error.response && error.response.status === 429) {
      const waitTimes = [45, 90, 150, 240, 300];
      const waitSeconds = waitTimes[Math.min(retryCount, waitTimes.length - 1)];

      console.log(chalk.yellow(`\n⏳ [429 RATE LIMIT] Tự động chờ ${waitSeconds}s (Lần thử lại ${retryCount + 1})...`));
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      return fetchPage(url, customHeaders, retryCount + 1);
    }

    // Lỗi mạng hoặc timeout: Thử lại sau 5s
    if (retryCount < 3 && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout') || error.code === 'ECONNRESET')) {
      console.log(chalk.gray(`\n🔄 Kết nối chập chờn tới ${url}. Đang thử lại lần ${retryCount + 1}/3...`));
      await sleep(3000, 5000);
      return fetchPage(url, customHeaders, retryCount + 1);
    }

    throw error;
  }
}
