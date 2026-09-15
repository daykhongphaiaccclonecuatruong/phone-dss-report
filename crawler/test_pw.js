import { chromium } from 'playwright';

async function testPlaywrightPage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('Đang truy cập thử...');
  const response = await page.goto('https://www.gsmarena.com/acer_liquid_z530s-7527.php', { waitUntil: 'domcontentloaded' });
  
  console.log('Status code:', response?.status());
  const title = await page.title();
  console.log('Page Title:', title);

  const html = await page.content();
  console.log('HTML length:', html.length);
  console.log('HTML snippet:', html.substring(0, 500));

  await browser.close();
}

testPlaywrightPage();
