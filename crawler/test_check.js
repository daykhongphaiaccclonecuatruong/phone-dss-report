import { fetchDevicesForBrand } from './src/deviceCrawler.js';

async function testBrands() {
  const panasonic = { name: 'Panasonic', url: 'https://www.gsmarena.com/panasonic-phones-6.php', expectedDevices: 123 };
  const panaDevices = await fetchDevicesForBrand(panasonic, 1, (p) => console.log('Pana:', p));
  console.log('Panasonic devices total:', panaDevices.length);

  const infinix = { name: 'Infinix', url: 'https://www.gsmarena.com/infinix-phones-119.php', expectedDevices: 172 };
  const infDevices = await fetchDevicesForBrand(infinix, 2, (p) => console.log('Infinix:', p));
  console.log('Infinix devices total:', infDevices.length);
}

testBrands();
