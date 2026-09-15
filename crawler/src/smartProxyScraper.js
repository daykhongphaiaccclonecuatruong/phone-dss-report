import fs from 'fs';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { parseDeviceSpecsFromHtml } from './specCrawler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GOOD_PROXIES_FILE = path.resolve(__dirname, '..', 'good_proxies.json');

const PROXY_APIS = [
  'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all',
  'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
  'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt',
  'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
  'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt'
];

// Cấu hình tối ưu
export const BASE_DELAY_MS = 3000;              // Giãn cách an toàn 3.0s - 4.2s mỗi luồng
const BATCH_TEST_SIZE = 50;              // Quét song song 50 proxy cùng lúc khi lọc ngầm
const BUFFER_TARGET_SIZE = 35;           // Luôn duy trì 35 proxy sống sẵn sàng trong kho đệm
const TEST_BENCHMARK_URL = 'https://www.gsmarena.com/'; // Test trực tiếp trang chủ GSMArena

export class SmartProxyManager {
  constructor() {
    this.rawQueue = [];                  // Kho proxy thô chưa test
    this.workingPool = new Map();        // Kho VIP: proxyStr -> { totalScraped }
    this.readyBuffer = [];               // Hàng đợi proxy sống sẵn sàng cấp phát cho 10 worker
    this.totalRawLoaded = 0;
    this.totalTestedCount = 0;
    this.isProducerRunning = false;
    this.stopProducerFlag = false;

    this.loadGoodProxies();
  }

  loadGoodProxies() {
    if (fs.existsSync(GOOD_PROXIES_FILE)) {
      try {
        const saved = JSON.parse(fs.readFileSync(GOOD_PROXIES_FILE, 'utf8'));
        if (Array.isArray(saved)) {
          for (const p of saved) {
            const proxyStr = typeof p === 'string' ? p : p.proxyStr;
            const totalScraped = typeof p === 'object' ? (p.totalScraped || 0) : 0;
            if (proxyStr) {
              this.workingPool.set(proxyStr, {
                totalScraped
              });
              if (!this.readyBuffer.includes(proxyStr)) {
                this.readyBuffer.push(proxyStr);
              }
            }
          }
        }
      } catch (e) {
        // bỏ qua
      }
    }
  }

  saveGoodProxies() {
    try {
      const list = Array.from(this.workingPool.entries()).map(([proxyStr, meta]) => ({
        proxyStr,
        totalScraped: meta.totalScraped || 0,
        status: 'Sẵn sàng'
      }));
      fs.writeFileSync(GOOD_PROXIES_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      // bỏ qua
    }
  }

  async refreshProxies() {
    console.log(chalk.cyan('\n🌐 [PROXY POOL] Đang nạp danh sách Proxy mới từ internet...'));
    const proxySet = new Set();

    for (const api of PROXY_APIS) {
      try {
        const res = await axios.get(api, { timeout: 10000 });
        const lines = res.data.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && trimmed.includes(':') && !trimmed.startsWith('#')) {
            if (!this.workingPool.has(trimmed)) {
              proxySet.add(trimmed);
            }
          }
        }
      } catch (e) {
        // bỏ qua nguồn lỗi
      }
    }

    this.rawQueue = Array.from(proxySet).sort(() => 0.5 - Math.random());
    this.totalRawLoaded = this.rawQueue.length;
    console.log(chalk.green(`✅ Đã nạp ${this.totalRawLoaded.toLocaleString()} Proxy thô | Kho VIP Pass có sẵn: ${this.workingPool.size} proxy!\n`));
  }

  /**
   * Thử tải qua 1 proxy cụ thể (ngắt kết nối cứng sau timeoutMs)
   */
  async tryFetch(proxyStr, url, timeoutMs = 5000) {
    const [host, port] = proxyStr.split(':');
    const agent = new HttpsProxyAgent(`http://${host}:${port}`, {
      timeout: timeoutMs,
      keepAlive: false
    });

    const response = await axios.get(url, {
      httpsAgent: agent,
      timeout: timeoutMs,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.gsmarena.com/'
      },
      validateStatus: () => true
    });

    if (response.status === 200 && response.data) {
      if (url === TEST_BENCHMARK_URL) {
        // Kiểm tra trang chủ GSMArena hợp lệ
        if (response.data.includes('GSMArena.com') || response.data.includes('makers.php3') || response.data.includes('id="body"')) {
          return { html: response.data, proxyStr };
        }
      } else if (response.data.includes('id="specs-list"')) {
        // Kiểm tra trang chi tiết thông số hợp lệ
        return { html: response.data, proxyStr };
      }
    }

    const is429 = response.status === 429 || (response.data && response.data.includes('Too Many Requests'));
    const err = new Error(is429 ? 'RATE_LIMIT_429' : `HTTP ${response.status}`);
    err.is429 = is429;
    throw err;
  }

  /**
   * Bộ lọc Proxy ngầm (Background Producer):
   * - Quét song song 50 proxy cùng lúc vào trang chủ GSMArena
   * - Luôn chạy nền để giữ Buffer Queue >= 20 proxy sống
   */
  startBackgroundProducer() {
    if (this.isProducerRunning) return;
    this.isProducerRunning = true;

    (async () => {
      while (!this.stopProducerFlag) {
        try {
          // 1. Nếu Buffer đã đủ proxy sống (>= TARGET), ngủ 2 giây rồi kiểm tra lại
          if (this.readyBuffer.length >= BUFFER_TARGET_SIZE) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          // 2. Nếu thiếu proxy sống -> quét mẻ 50 proxy thô từ internet
          if (this.rawQueue.length === 0) {
            await this.refreshProxies();
          }

          const batch = this.rawQueue.splice(0, BATCH_TEST_SIZE);
          this.totalTestedCount += batch.length;

          // Quét song song 50 proxy qua Trang chủ GSMArena
          await Promise.allSettled(
            batch.map(async (proxyStr) => {
              try {
                await this.tryFetch(proxyStr, TEST_BENCHMARK_URL, 5000);
                // Proxy Sống -> Lưu ngay vào VIP Pool và đẩy vào Buffer sẵn sàng!
                if (!this.workingPool.has(proxyStr)) {
                  this.workingPool.set(proxyStr, {
                    totalScraped: 0
                  });
                  this.saveGoodProxies();
                }
                if (!this.readyBuffer.includes(proxyStr)) {
                  this.readyBuffer.push(proxyStr);
                }
              } catch (e) {
                // proxy chết -> bỏ qua
              }
            })
          );

          // Nghỉ nhẹ 500ms giữa các mẻ quét ngầm
          await new Promise(r => setTimeout(r, 500));

        } catch (err) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    })();
  }

  stopBackgroundProducer() {
    this.stopProducerFlag = true;
    this.isProducerRunning = false;
  }

  /**
   * Cấp phát 1 Proxy sống ngay lập tức cho Worker
   */
  async getLiveProxy() {
    // 1. Nếu trong buffer có sẵn -> lấy ngay lập tức (0ms)
    if (this.readyBuffer.length > 0) {
      return this.readyBuffer.shift();
    }

    // 2. Nếu buffer đang tạm trống, quét nhanh 1 mẻ 50 proxy thô lấy con sống đầu tiên
    while (true) {
      if (this.rawQueue.length === 0) {
        await this.refreshProxies();
      }

      const batch = this.rawQueue.splice(0, BATCH_TEST_SIZE);
      this.totalTestedCount += batch.length;

      let found = null;
      let resolver = null;
      const promise = new Promise(r => { resolver = r; });

      const promises = batch.map(async (p) => {
        try {
          await this.tryFetch(p, TEST_BENCHMARK_URL, 5000);
          if (!this.workingPool.has(p)) {
            this.workingPool.set(p, { totalScraped: 0 });
            this.saveGoodProxies();
          }
          if (!found) {
            found = p;
            resolver(p);
          } else if (!this.readyBuffer.includes(p)) {
            this.readyBuffer.push(p);
          }
        } catch (e) {}
      });

      await Promise.race([promise, Promise.allSettled(promises)]);
      if (found) return found;
    }
  }

  /**
   * Báo cáo kết quả sau khi cào 1 máy:
   * - Thành công: tăng totalScraped
   * - 429 hoặc Die / Lỗi mạng: XÓA NGAY LẬP TỨC khỏi kho VIP và file json
   */
  reportProxyResult(proxyStr, success, is429 = false) {
    const meta = this.workingPool.get(proxyStr);

    if (success && meta) {
      meta.totalScraped = (meta.totalScraped || 0) + 1;
    } else {
      // Xóa vĩnh viễn khỏi workingPool
      this.workingPool.delete(proxyStr);

      // Xóa khỏi readyBuffer nếu còn
      const idx = this.readyBuffer.indexOf(proxyStr);
      if (idx !== -1) {
        this.readyBuffer.splice(idx, 1);
      }

      // Lưu lại file good_proxies.json
      this.saveGoodProxies();
    }
  }

  /**
   * Cào specs của 1 máy với proxy chỉ định
   */
  async fetchDeviceSpec(proxyStr, deviceUrl) {
    const { html } = await this.tryFetch(proxyStr, deviceUrl, 6000);
    const specData = parseDeviceSpecsFromHtml(html, deviceUrl);
    return specData;
  }
}
