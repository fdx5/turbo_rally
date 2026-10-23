import { webkit, chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5198';
const out = 'test-results/mobile-controls';
await mkdir(out, { recursive: true });
const sizes = [
  { name: 'se-toolbar', width: 568, height: 230, inset: 0 },
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone-toolbar', width: 844, height: 250, inset: 47 },
  { name: 'iphone', width: 844, height: 390, inset: 47 },
  { name: 'max', width: 932, height: 430, inset: 59 },
  { name: 'ipad', width: 1024, height: 768, inset: 0 },
];
const results = [];
for (const engine of ['webkit', 'chrome']) {
  const browser =
    engine === 'webkit'
      ? await webkit.launch({ headless: true })
      : await chromium.launch({
          channel: 'chrome',
          headless: true,
          args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
        });
  try {
    for (const size of sizes) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 1,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${base}/dev/touch-review.html`);
      await page.waitForFunction(() => window.review);
      await page.evaluate((inset) => {
        for (const side of ['l', 'r'])
          document.documentElement.style.setProperty(`--safe-${side}`, `${inset}px`);
      }, size.inset);
      for (const auto of [true, false])
        for (const mode of ['stick', 'buttons']) {
          await page.evaluate(
            ({ auto, mode }) => window.review.settings.getState().set({ autoAccel: auto, touchSteer: mode }),
            { auto, mode },
          );
          await page.waitForTimeout(60);
          const rects = await page.locator('.drive-button').evaluateAll((nodes) =>
            nodes.map((el) => {
              const r = el.getBoundingClientRect();
              return { label: el.getAttribute('aria-label'), x: r.x, y: r.y, w: r.width, h: r.height };
            }),
          );
          for (const r of rects) {
            assert(r.w >= 43.9 && r.h >= 43.9, `${engine}/${size.name} small ${r.label}`);
            assert(
              r.x >= size.inset - 1 &&
                r.x + r.w <= size.width - size.inset + 1 &&
                r.y >= 0 &&
                r.y + r.h <= size.height,
              `${engine}/${size.name} outside viewport ${JSON.stringify(r)}`,
            );
          }
          for (let a = 0; a < rects.length; a++)
            for (let b = a + 1; b < rects.length; b++) {
              const A = rects[a],
                B = rects[b],
                overlapX = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x),
                overlapY = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
              assert(overlapX <= 1 || overlapY <= 1, `${size.name}: ${A.label} overlaps ${B.label}`);
            }
        }
      await page.evaluate(() =>
        window.review.settings.getState().set({ autoAccel: true, touchSteer: 'stick' }),
      );
      const zone = page.locator('.steering-zone');
      const zr = await zone.boundingBox();
      // Synthetic pointer streams exercise production React handlers and cancellation in both engines.
      await page.evaluate(() => {
        HTMLElement.prototype.setPointerCapture = function () {};
      });
      await zone.dispatchEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: zr.x + 80,
        clientY: zr.y + 80,
        button: 0,
        bubbles: true,
      });
      assert.equal(await page.evaluate(() => window.review.input.touch.steer), 0);
      await zone.dispatchEvent('pointermove', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: zr.x + 120,
        clientY: zr.y + 80,
        bubbles: true,
      });
      await page
        .locator('.drive-drift')
        .dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', bubbles: true });
      await page
        .locator('.drive-item')
        .dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch', bubbles: true });
      let state = await page.evaluate(() => ({
        steer: window.review.input.touch.steer,
        drift: window.review.input.touch.drift,
        item: window.review.input.consume('item'),
      }));
      assert(state.steer > 0.5 && state.drift && state.item);
      await page
        .locator('.drive-drift')
        .dispatchEvent('pointercancel', { pointerId: 2, pointerType: 'touch', bubbles: true });
      state = await page.evaluate(() => ({
        steer: window.review.input.touch.steer,
        drift: window.review.input.touch.drift,
      }));
      assert(state.steer > 0.5 && !state.drift);
      await zone.dispatchEvent('lostpointercapture', { pointerId: 1, pointerType: 'touch', bubbles: true });
      assert.equal(await page.evaluate(() => window.review.input.touch.steer), 0);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.equal(await page.evaluate(() => window.review.input.touch.drift), false);
      await page.locator('.install-button').click();
      await page.getByRole('dialog').waitFor();
      assert((await page.getByText('홈 화면에 추가', { exact: false }).count()) > 0);
      await page.screenshot({ path: `${out}/${engine}-${size.name}-install.png` });
      await page.getByRole('button', { name: '확인 · 게임 계속하기' }).click();
      await page.getByRole('button', { name: '일시정지' }).click();
      await page.getByLabel('조향 민감도').waitFor();
      const modal = page.locator('.modal');
      assert(
        await modal.evaluate(
          (el) => el.scrollHeight > el.clientHeight || el.getBoundingClientRect().height < window.innerHeight,
        ),
      );
      await modal.evaluate((el) => (el.scrollTop = el.scrollHeight));
      await page.getByRole('button', { name: '계속하기', exact: true }).click();
      await page.screenshot({ path: `${out}/${engine}-${size.name}-controls.png` });
      assert.deepEqual(errors, [], `${engine}/${size.name} runtime errors`);
      results.push({
        engine,
        viewport: size.name,
        width: size.width,
        height: size.height,
        inset: size.inset,
        passed: true,
      });
      await context.close();
      console.log(`${engine}/${size.name} passed`);
    }
  } finally {
    await browser.close();
  }
}
await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
