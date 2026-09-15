import fs from 'fs';

export function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  return result;
}

const content = fs.readFileSync('../gsmarena_devices.csv', 'utf8').trim().split('\n').slice(1);
let errors = 0;
for (let i = 0; i < content.length; i++) {
  const parts = parseCsvLine(content[i]);
  const url = parts[4];
  if (!url || !url.startsWith('https://www.gsmarena.com/')) {
    errors++;
    console.log('Lỗi dòng', i + 1, 'parts:', parts);
  }
}
console.log('Tổng số dòng kiểm tra:', content.length);
console.log('Tổng số lỗi sau khi dùng parseCsvLine chuẩn:', errors);
