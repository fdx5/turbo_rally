import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5198';
const out = 'test-results/mobile-auth';
await mkdir(out, { recursive: true });
const report = [];
for (const engine of ['webkit', 'chrome']) {
  const browser = engine === 'webkit'
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const size of [
      { width: 568, height: 230, inset: 0 },
      { width: 667, height: 320, inset: 0 },
      { width: 844, height: 250, inset: 47 },
      { width: 844, height: 390, inset: 47 },
      { width: 932, height: 430, inset: 59 },
      { width: 390, height: 664, inset: 0 },
    ]) {
      const context = await browser.newContext({
        viewport: size, hasTouch: true, isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1',
      });
      const page = await context.newPage();
      const errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      let rejectLogin = true, fixture;
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const data = route.request().postDataJSON();
        requests.push({ path: url.pathname, data });
        if (url.pathname.endsWith('/auth/login') && rejectLogin) {
          await route.fulfill({ status: 401, json: { error: '아이디 또는 비밀번호를 확인해 주세요.' } });
        } else await route.fulfill({ json: { profile: fixture } });
      });
      await page.goto(`${base}/dev/auth-review.html`);
      await page.getByRole('dialog', { name: '로그인', exact: true }).waitFor();
      fixture = await page.evaluate(() => window.review.profile.getState().profile);
      await page.evaluate(inset => {
        for (const side of ['l', 'r']) document.documentElement.style.setProperty(`--safe-${side}`, `${inset}px`);
        document.documentElement.style.setProperty('--safe-b', '21px');
        // Model Safari: layout viewport remains fixed while keyboard changes the visual viewport.
        const viewport = Object.assign(new EventTarget(), {
          width: innerWidth, height: innerHeight, offsetLeft: 0, offsetTop: 0,
        });
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
        window.review.resizeVisible = (height, top = 0) => {
          viewport.height = height; viewport.offsetTop = top;
          viewport.dispatchEvent(new Event('resize'));
          window.dispatchEvent(new Event('resize'));
        };
        window.dispatchEvent(new Event('resize'));
      }, size.inset);
      const checkActions = async () => {
        const result = await page.locator('.auth-actions .btn,.auth-header .btn').evaluateAll(nodes => {
          const viewport = visualViewport;
          return nodes.map(el => {
            const r = el.getBoundingClientRect();
            return { label: el.textContent, x: r.x, y: r.y, w: r.width, h: r.height,
              left: viewport.offsetLeft, top: viewport.offsetTop, vw: viewport.width, vh: viewport.height };
          });
        });
        for (const r of result) {
          assert(r.w >= 44 && r.h >= 44, `${engine}: small target ${JSON.stringify(r)}`);
          assert(r.x >= size.inset && r.x + r.w <= r.vw - size.inset + 1 && r.y >= r.top && r.y + r.h <= r.top + r.vh,
            `${engine}: hidden action ${JSON.stringify(r)}`);
        }
        for (let a = 0; a < result.length; a++) for (let b = a + 1; b < result.length; b++) {
          const A = result[a], B = result[b];
          assert(Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x) <= 0 || Math.min(A.y+A.h,B.y+B.h)-Math.max(A.y,B.y) <= 0, 'overlapping actions');
        }
      };
      const keyboard = async (height) => {
        await page.evaluate(height => window.review.resizeVisible(height, height < innerHeight ? 18 : 0), height);
        await page.waitForTimeout(100);
      };
      await checkActions();
      await page.getByLabel('아이디', { exact: true }).fill('mobile_test');
      await page.getByLabel('비밀번호', { exact: true }).fill('password123');
      await keyboard(Math.min(150, size.height - 40));
      await checkActions();
      await page.screenshot({ path: `${out}/${engine}-${size.width}x${size.height}-login-keyboard.png` });
      await page.locator('.auth-actions button[type=submit]').click();
      await page.getByRole('alert').waitFor();
      assert.equal(requests.filter(r => r.path.endsWith('/auth/login')).length, 1);
      await keyboard(size.height);
      await page.locator('.auth-actions button[type=button]').click();
      await page.getByRole('dialog', { name: '회원가입', exact: true }).waitFor();
      assert.equal(await page.getByRole('alert').count(), 0, 'stale login error in signup');
      await page.getByLabel('아이디', { exact: true }).fill('mobile_new');
      await page.getByLabel('비밀번호', { exact: true }).fill('password123');
      await page.getByLabel('비밀번호 확인', { exact: true }).fill('password123');
      await page.getByLabel('닉네임', { exact: true }).fill('모바일');
      await keyboard(Math.min(150, size.height - 40));
      await checkActions();
      const field = await page.getByLabel('닉네임', { exact: true }).boundingBox();
      const body = await page.locator('.auth-body').boundingBox();
      assert(field.y >= body.y - 1 && field.y + field.height <= body.y + body.height + 1, 'focused field hidden under actions or keyboard');
      await page.screenshot({ path: `${out}/${engine}-${size.width}x${size.height}-signup-keyboard.png` });
      await page.locator('.auth-actions button[type=submit]').click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const signup = requests.find(r => r.path.endsWith('/auth/signup'));
      assert.equal(signup.data.nickname, '모바일');
      assert.equal(await page.evaluate(() => window.review.profile.getState().member), true);
      // Return to login after signup and exercise a successful member login as well.
      await page.evaluate(() => window.review.app.getState().set({ modal: 'login' }));
      await keyboard(size.height);
      rejectLogin = false;
      await page.getByLabel('아이디', { exact: true }).fill('mobile_test');
      await page.getByLabel('비밀번호', { exact: true }).fill('password123');
      await page.locator('.auth-actions button[type=submit]').click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      // Rotating while authentication is open must never add a blocking overlay.
      await page.evaluate(() => window.review.app.getState().set({ modal: 'signup' }));
      await page.setViewportSize({ width: 390, height: 664 });
      await page.evaluate(() => {
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: null });
        window.dispatchEvent(new Event('resize'));
      });
      await page.getByRole('button', { name: '닫기', exact: true }).click();
      assert.equal(await page.locator('.rotate-overlay').count(), 0);
      assert.deepEqual(errors, []);
      report.push({ engine, ...size, passed: true });
      console.log(`${engine} ${size.width}x${size.height} login/signup/keyboard/rotation passed`);
      await context.close();
    }
  } finally { await browser.close(); }
}
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
