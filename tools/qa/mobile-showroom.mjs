import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5198';
const out = process.argv[3] ?? 'test-results/mobile-showroom';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const report = [];
try {
  for (const size of [
    { width:568, height:230, inset:0 }, { width:667, height:320, inset:0 },
    { width:844, height:250, inset:47 }, { width:844, height:390, inset:47 },
    { width:932, height:430, inset:59 }, { width:1024, height:768, inset:0 },
  ]) {
    const context = await browser.newContext({ viewport:size, isMobile:true, hasTouch:true });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.getByText('게스트로 시작', {exact:true}).waitFor({ timeout:60000 });
    await page.evaluate(inset => {
      for (const side of ['l','r']) document.documentElement.style.setProperty(`--safe-${side}`, `${inset}px`);
      window.dispatchEvent(new Event('gameviewportchange'));
    }, size.inset);
    const check = async name => {
      await page.waitForTimeout(500);
      const slot = await page.locator('.showroom-space:visible').boundingBox();
      assert(slot && slot.width >= 150 && slot.height >= 65, `preview too small ${name}: ${JSON.stringify(slot)}`);
      const rects = await page.locator('.screen .btn,.screen .mode-tile,.screen .mini-tile').evaluateAll(nodes =>
        nodes.filter(el=>el.getClientRects().length).map(el=>{
          const r=el.getBoundingClientRect();return {label:el.textContent,x:r.x,y:r.y,w:r.width,h:r.height};
        }));
      for (const r of rects) {
        assert(r.w >= 35.9 && r.h >= 35.9, `tiny control ${JSON.stringify(r)}`);
        assert(r.x >= size.inset-1 && r.x+r.w <= size.width-size.inset+1 && r.y >= -1 && r.y+r.h <= size.height+1,
          `clipped ${name}: ${JSON.stringify(r)}`);
        const overlapX=Math.min(r.x+r.w,slot.x+slot.width)-Math.max(r.x,slot.x);
        const overlapY=Math.min(r.y+r.h,slot.y+slot.height-24)-Math.max(r.y,slot.y);
        assert(overlapX<=1 || overlapY<=1, `control obscures ${name}: ${r.label}`);
      }
      await page.screenshot({path:`${out}/${size.width}x${size.height}-${name}.png`});
      report.push({...size, screen:name, preview:slot, passed:true});
    };
    await check('title');
    await page.getByText('게스트로 시작', {exact:true}).click();
    await page.locator('.main-menu').waitFor();
    await check('menu');
    await page.getByText('대전 레이스', {exact:true}).click();
    await page.getByText('쉬움', {exact:true}).click();
    await page.getByText('별사탕 구름 협곡', {exact:true}).click();
    await page.locator('.character-select').waitFor();
    await check('character');
    await page.locator('.character-options').evaluate(el=>el.scrollLeft=el.scrollWidth);
    await page.getByText('하나', {exact:true}).click();
    await check('character-hana');
    await page.getByRole('button', {name:'다음',exact:false}).click();
    await page.locator('.vehicle-select').waitFor();
    await check('vehicle');
    assert.deepEqual(errors,[]);
    console.log(`${size.width}x${size.height}: title/menu/character/vehicle preview clear`);
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
