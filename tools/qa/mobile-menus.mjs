import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5198';
const out = 'test-results/mobile-menus';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--use-angle=d3d11',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const results = [];
try {
  for (const size of [
    { width: 568, height: 230, inset: 0 },
    { width: 844, height: 250, inset: 47 },
    { width: 844, height: 390, inset: 47 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/api/auth/login', route => route.fulfill({ status: 401, json: { error: '아이디 또는 비밀번호를 확인해 주세요.' } }));
    await page.goto(base);
    await page.getByText('게스트로 시작', { exact: true }).waitFor({ timeout: 60000 });
    await page.evaluate((inset) => {
      for (const side of ['l', 'r'])
        document.documentElement.style.setProperty(`--safe-${side}`, `${inset}px`);
    }, size.inset);
    const bounds = async (selector) => {
      const minimum = /title-screen|main-menu|character-footer|vehicle-start/.test(selector) ? 36 : 44;
      const boxes = await page.locator(selector).evaluateAll((nodes) =>
        nodes
          .filter((e) => e.getClientRects().length)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { label: el.textContent.slice(0, 30), x: r.x, y: r.y, w: r.width, h: r.height };
          }),
      );
      for (const r of boxes)
      {
        assert(r.w >= minimum && r.h >= minimum, `small touch target ${JSON.stringify(r)}`);
        assert(
          r.x >= -2 && r.y >= -2 && r.x + r.w <= size.width + 2 && r.y + r.h <= size.height + 2,
          `${size.width}x${size.height}: clipped ${JSON.stringify(r)}`,
        );
      }
    };
    const shot = async (name) => page.screenshot({ path: `${out}/${size.width}x${size.height}-${name}.png` });
    await bounds('.title-screen .btn');
    await shot('title');
    await page.locator('.title-auth-actions').getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByLabel('아이디', { exact: true }).fill('mobile_test');
    await page.getByLabel('비밀번호', { exact: true }).fill('password123');
    await page.locator('.auth-actions button[type=submit]').click();
    await page.getByRole('alert').waitFor();
    await bounds('.auth-actions .btn,.auth-header .btn');
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.locator('.title-auth-actions').getByRole('button', { name: '회원가입', exact: true }).click();
    await page.getByLabel('닉네임', { exact: true }).waitFor();
    await bounds('.auth-actions .btn,.auth-header .btn');
    await shot('signup');
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByText('게스트로 시작', { exact: true }).click();
    await page.locator('.main-menu').waitFor();
    await bounds('.main-menu .btn,.main-menu .mode-tile,.main-menu .mini-tile');
    await shot('menu');
    for (const label of ['상점', '미션', '설정', '프로필', '대시보드']) {
      await (
        label === '대시보드'
          ? page.getByRole('button', { name: '대시보드' })
          : page.locator('.mini-tile').filter({ hasText: label })
      ).click();
      await page.getByRole('button', { name: '뒤로', exact: true }).waitFor();
      await shot(label);
      await page.getByRole('button', { name: '뒤로', exact: true }).click();
      await page.locator('.main-menu').waitFor();
    }
    for (const label of ['출석', '룰렛']) {
      await page.locator('.mini-tile').filter({ hasText: label }).click();
      await page.locator('.modal').waitFor();
      const modal = await page.locator('.modal').boundingBox();
      assert(modal.y >= 0 && modal.y + modal.height <= size.height + 1);
      await page.locator('.modal').evaluate((el) => (el.scrollTop = el.scrollHeight));
      await page.getByRole('button', { name: '닫기', exact: true }).click();
    }
    await page.getByText('대전 레이스', { exact: true }).click();
    await page.locator('.mode-select').waitFor();
    await bounds('.difficulty-options .card');
    await shot('difficulty');
    await page.getByText('쉬움', { exact: true }).click();
    await page.getByText('별사탕 구름 협곡', { exact: true }).click();
    await page.locator('.character-select').waitFor();
    await bounds('.character-footer>.btn');
    await shot('characters');
    const choices = page.locator('.character-options');
    await choices.evaluate((el) => (el.scrollLeft = el.scrollWidth));
    await page.getByText('하나', { exact: true }).click();
    await page.getByRole('button', { name: '다음', exact: false }).click();
    await page.locator('.vehicle-select').waitFor();
    const summary = page.locator('.vehicle-summary');
    await summary.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.getByRole('button', { name: '출발!', exact: false }).scrollIntoViewIfNeeded();
    await bounds('.vehicle-start .btn');
    await shot('vehicles');
    // Exercise actual race start and ensure automatic throttle does not overheat at countdown.
    await page.getByRole('button', { name: '출발!', exact: false }).click();
    await page.locator('.drive-drift').waitFor({ timeout: 60000 });
    await page.waitForFunction(
      () => !document.querySelector('.drive-drift')?.disabled,
      {},
      { timeout: 20000 },
    );
    await page.waitForTimeout(1200);
    assert(!(await page.getByText('엔진 과열!', { exact: false }).count()), 'automatic start overheated');
    assert(
      parseFloat(await page.locator('.hud-speed').innerText()) > 0,
      'automatic acceleration did not move the kart',
    );
    await shot('racing');
    await bounds('.drive-button');
    await page.getByRole('button', { name: '일시정지' }).click();
    await page.getByRole('button', { name: '계속하기', exact: false }).waitFor();
    await bounds('.pause-actions .btn');
    await shot('pause');
    assert.deepEqual(errors, [], errors.join('\n'));
    results.push({ ...size, passed: true });
    await context.close();
    console.log(`${size.width}x${size.height} menu-to-race passed`);
  }
} finally {
  await browser.close();
}
await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
