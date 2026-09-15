import { chromium } from 'playwright';
import chalk from 'chalk';
import { parseDeviceSpecsFromHtml } from './specCrawler.js';

export class IpBannedError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'IpBannedError';
    this.details = details;
  }
}

export class BrowserWorkerPool {
  constructor(workerCount = 3) {
    this.workerCount = workerCount;
    this.browser = null;
    this.contexts = [];
    this.pages = [];
  }

  async init() {
    console.log(chalk.cyan(`🚀 Đang khởi động Chromium Headless Browser (${this.workerCount} Workers)...`));
    
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,800'
      ]
    });

    for (let i = 0; i < this.workerCount; i++) {
      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'en-US',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
          'Referer': 'https://www.gsmarena.com/'
        }
      });

      const page = await context.newPage();
      
      // Chặn tài nguyên rác (ảnh, css, ads) để tải nhanh gấp 5 lần
      await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,css}', route => route.abort());
      await page.route('**/google-analytics.com/**', route => route.abort());
      await page.route('**/doubleclick.net/**', route => route.abort());
      await page.route('**/adservice.google.com/**', route => route.abort());

      try {
        await page.goto('https://www.gsmarena.com/', { waitUntil: 'domcontentloaded', timeout: 25000 });
      } catch (e) {
        // bỏ qua
      }

      this.contexts.push(context);
      this.pages.push(page);
    }

    console.log(chalk.green(`✅ Đã khởi tạo thành công ${this.workerCount} Tab Chrome với Session Cookie thật!`));
  }

  /**
   * Cào thông số của 1 URL qua Worker
   * Nếu phát hiện 429 hoặc bị chặn: NÉM LỖI DỪNG NGAY LẬP TỨC để người dùng đổi IP, KHÔNG CHỜ LÂU
   */
  async scrapeUrl(workerIndex, url) {
    const page = this.pages[workerIndex];

    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const statusCode = response?.status();

      // Nếu gặp mã 429 hoặc 403: Dừng ngay để đổi IP
      if (statusCode === 429 || statusCode === 403) {
        throw new IpBannedError(`HTTP ${statusCode} (Rate Limit / Ban IP) tại ${url}`, { url, status: statusCode });
      }

      await page.waitForSelector('#specs-list', { timeout: 6000 }).catch(() => null);
      const html = await page.content();

      // Kiểm tra xem có bảng thông số không
      if (html.includes('id="specs-list"')) {
        return parseDeviceSpecsFromHtml(html, url);
      }

      // Kiểm tra nội dung có chữ Too Many Requests hoặc Captcha
      if (html.includes('Too Many Requests') || html.includes('cf-browser-verification') || html.includes('Access Denied')) {
        throw new IpBannedError(`Bị chặn rate limit trong HTML (Too Many Requests) tại ${url}`, { url, status: 429 });
      }

      throw new Error(`Trang không chứa bảng #specs-list`);
    } catch (err) {
      if (err instanceof IpBannedError) {
        throw err;
      }
      throw err;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
