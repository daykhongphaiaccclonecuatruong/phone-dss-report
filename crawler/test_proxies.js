import axios from 'axios';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Các nguồn Proxy miễn phí công cộng
const PROXY_SOURCES = [
  'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=3000&country=all&ssl=all&anonymity=elite',
  'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
  'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt'
];

/**
 * Tải danh sách proxy thô từ các nguồn
 */
async function fetchRawProxies() {
  console.log(chalk.cyan('🌐 Đang tải danh sách Proxy miễn phí từ các nguồn công cộng...'));
  const proxySet = new Set();

  for (const source of PROXY_SOURCES) {
    try {
      const res = await axios.get(source, { timeout: 8000 });
      const lines = res.data.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.includes(':') && !trimmed.startsWith('#')) {
          proxySet.add(trimmed);
        }
      }
    } catch (e) {
      // bỏ qua nguồn lỗi
    }
  }

  return Array.from(proxySet);
}

/**
 * Kiểm tra xem proxy có truy cập được GSMArena không
 */
async function testProxyWithGSMArena(proxyStr) {
  const [host, port] = proxyStr.split(':');
  const proxyUrl = `http://${host}:${port}`;
  const agent = new HttpsProxyAgent(proxyUrl);

  const startTime = Date.now();
  try {
    const res = await axios.get('https://www.gsmarena.com/acer_liquid_z530s-7527.php', {
      httpsAgent: agent,
      timeout: 7000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      validateStatus: (status) => true
    });

    const elapsed = Date.now() - startTime;

    if (res.status === 200 && res.data.includes('id="specs-list"')) {
      return {
        proxy: proxyStr,
        status: 'SUCCESS',
        ping: `${elapsed}ms`,
        statusCode: 200
      };
    } else if (res.status === 429) {
      return {
        proxy: proxyStr,
        status: 'RATE_LIMITED_429',
        ping: `${elapsed}ms`,
        statusCode: 429
      };
    } else {
      return {
        proxy: proxyStr,
        status: `BLOCKED_${res.status}`,
        ping: `${elapsed}ms`,
        statusCode: res.status
      };
    }
  } catch (err) {
    return {
      proxy: proxyStr,
      status: 'DEAD',
      error: err.code || err.message
    };
  }
}

async function main() {
  console.log(chalk.blue.bold('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║              KIỂM TRA PROXY MIỄN PHÍ VỚI GSMARENA                    ║'));
  console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════════════════╝\n'));

  const rawProxies = await fetchRawProxies();
  console.log(chalk.white(`📋 Đã lấy được: `) + chalk.yellow.bold(`${rawProxies.length.toLocaleString()} Proxy thô.`));

  // Lấy 60 proxy ngẫu nhiên để test nhanh
  const sampleSize = 60;
  const sampleProxies = rawProxies.sort(() => 0.5 - Math.random()).slice(0, sampleSize);

  console.log(chalk.cyan(`🧪 Đang kiểm tra đồng thời ${sampleSize} proxy ngẫu nhiên với GSMArena... (khoảng 10-15s)\n`));

  const results = await Promise.all(sampleProxies.map(p => testProxyWithGSMArena(p)));

  const workingProxies = results.filter(r => r.status === 'SUCCESS');
  const rateLimited = results.filter(r => r.status === 'RATE_LIMITED_429');
  const deadProxies = results.filter(r => r.status === 'DEAD');
  const otherBlocked = results.filter(r => r.status.startsWith('BLOCKED'));

  console.log(chalk.bold.yellow('📊 ──── KẾT QUẢ KIỂM TRA PROXY MIỄN PHÍ ────'));
  console.log(chalk.green(`  ✅ Proxy SỐNG KHỎE & Vào được GSMArena (200 OK) : ${workingProxies.length} proxy`));
  console.log(chalk.yellow(`  ⚠️ Proxy Bị GSMArena 429 / Rate Limit           : ${rateLimited.length} proxy`));
  console.log(chalk.magenta(`  ⛔ Proxy Bị chặn khác (403/Captcha)             : ${otherBlocked.length} proxy`));
  console.log(chalk.gray(`  ❌ Proxy CHẾT / Timeout (Không kết nối được)    : ${deadProxies.length} proxy`));
  console.log(chalk.bold.yellow('─────────────────────────────────────────────\n'));

  if (workingProxies.length > 0) {
    console.log(chalk.green.bold('🎉 DANH SÁCH PROXY MIỄN PHÍ HOẠT ĐỘNG TỐT:'));
    console.table(workingProxies.map(w => ({
      'Proxy': w.proxy,
      'Thời gian phản hồi (Ping)': w.ping,
      'Mã HTTP': w.statusCode,
      'Trạng thái': 'Truy cập GSMArena mượt mà'
    })));
  } else {
    console.log(chalk.red('⚠️ Đợt mẫu này chưa có proxy nào phản hồi nhanh với GSMArena.'));
  }
}

main();
