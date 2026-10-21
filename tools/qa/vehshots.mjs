import { chromium } from 'playwright';
const [out, ids] = process.argv.slice(2);
const chars = ['momo', 'mungchi', 'piyo', 'lulu', 'toto', 'piko', 'kkang', 'hana'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
let i = 0;
for (const id of ids.split(',')) {
  for (const [tag, angle] of [['f', 0.65], ['b', 3.6]]) {
    await page.goto(`http://localhost:5173/dev/turntable.html?asset=vehicle:${id}&char=${chars[i % 8]}&angle=${angle}&elev=0.22`);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/v_${id}_${tag}.png` });
  }
  i++;
}
await browser.close();
