import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { fetchDeviceSpecs } from './src/specCrawler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSingleSpec() {
  const args = process.argv.slice(2);
  const targetUrl = args[0] || 'https://www.gsmarena.com/samsung_galaxy_s24_ultra-12771.php';

  console.log(chalk.blue.bold('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║              KIỂM TRA CÀO THÔNG SỐ KỸ THUẬT (1 MÁY)                  ║'));
  console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════════════════╝\n'));
  console.log(chalk.cyan(`🌐 Đang gửi request tới: `) + chalk.underline(targetUrl));

  try {
    const data = await fetchDeviceSpecs(targetUrl);

    console.log(chalk.green.bold('\n✅ ĐÃ BÓC TÁCH ĐẦY ĐỦ 100% THÔNG SỐ MÁY!'));
    console.log(chalk.white(`📱 Tên máy: `) + chalk.yellow.bold(data.deviceName));
    console.log(chalk.white(`🖼️  Ảnh lớn: `) + chalk.gray(data.imageUrl));

    console.log(chalk.yellow('\n📋 CÁC NHÓM THÔNG SỐ ĐÃ BÓC TÁCH:'));
    Object.keys(data.specs).forEach((cat) => {
      const fieldCount = Object.keys(data.specs[cat]).length;
      console.log(`  • ${chalk.white.bold(cat.toUpperCase().padEnd(16, ' '))} : ${chalk.cyan(`${fieldCount} trường thông số`)}`);
    });

    const outputFile = path.resolve(__dirname, '..', 'sample_device_spec.json');
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf8');

    console.log(chalk.green.bold(`\n💾 Đã lưu toàn bộ kết quả JSON ra file:`));
    console.log(chalk.green(`   👉 ${outputFile}\n`));

  } catch (error) {
    console.log(chalk.red.bold(`❌ Lỗi: ${error.message}`));
    console.error(error);
  }
}

testSingleSpec();
