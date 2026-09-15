import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  BASE_URL: 'https://www.gsmarena.com',
  MAKERS_URL: 'https://www.gsmarena.com/makers.php3',
  
  SUMMARY_CSV: path.resolve(__dirname, '..', 'gsmarena_brands_summary.csv'),
  OUTPUT_CSV: path.resolve(__dirname, '..', 'gsmarena_devices.csv'),
  OUTPUT_EXCEL: path.resolve(__dirname, '..', 'gsmarena_full_devices.xlsx'),
  BRANDS_DIR: path.resolve(__dirname, '..', 'brands_csv'),
  PROGRESS_FILE: path.resolve(__dirname, 'progress.json'),
  SUMMARY_JSON: path.resolve(__dirname, '..', 'brands_summary.json'),

  // Delay an toàn khi cào specs (2.5s - 4.5s) để không bị dính Rate Limit
  MIN_DELAY_MS: 2500,
  MAX_DELAY_MS: 4500,

  // Thời gian chờ nghỉ ngơi khi bị 429 (Cool-down: 45 giây)
  COOLDOWN_ON_429_MS: 45000,
  MAX_RETRIES: 3,

  // Danh sách User-Agents đa dạng
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0'
  ],

  // Headers giả lập trình duyệt Chrome thật
  HEADERS: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://www.gsmarena.com/'
  },

  BAN_KEYWORDS: [
    'cf-browser-verification',
    'cloudflare',
    'turnstile',
    'access denied',
    'captcha-delivery',
    'security check',
    'please verify you are a human',
    'temporarily blocked',
    'attention required! | cloudflare',
    'bot detection'
  ]
};
