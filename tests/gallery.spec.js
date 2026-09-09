import { test, expect } from '@playwright/test';
test('real WebGL gallery loads with navigable scene', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#scene canvas')).toBeVisible();
  await expect(page.locator('#scene canvas')).toHaveCSS('opacity', '1');
  await expect(page.locator('#mode-stand')).toHaveAttribute('aria-pressed', 'true');
  const info = await page.evaluate(() => window.__gallery.getDiagnostics());
  expect(info.triangles).toBeGreaterThan(1000);
  expect(info.meshes).toBeGreaterThan(5);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/day-desktop.png' });
});

test('day/night, movement, detail views, orbit and reset work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.locator('#mode-walk').click();
  await expect(page.locator('#mode-walk')).toHaveAttribute('aria-pressed', 'true');
  const wheels = await page.evaluate(() => window.__gallery.getDiagnostics().wheels);
  await expect.poll(() => page.evaluate(() => window.__gallery.getDiagnostics().wheels)).not.toEqual(wheels);
  await page.locator('#mode-rest').click();
  await expect(page.locator('body')).toHaveClass(/night/);
  await expect.poll(() => page.evaluate(() => window.__gallery.getDiagnostics().nightFactor)).toBeGreaterThan(0.95);
  await page.screenshot({ path: 'test-results/night-desktop.png' });
  await page.locator('[data-view="back"]').click();
  await expect.poll(() => page.evaluate(() => window.__gallery.getDiagnostics().camera[2])).toBeLessThan(-15);
  await page.screenshot({ path: 'test-results/back-desktop.png' });
  await page.locator('#night').click();
  await page.locator('[data-view="roof"]').click();
  await expect.poll(() => page.evaluate(() => window.__gallery.getDiagnostics().target[1])).toBeGreaterThan(5.8);
  await page.screenshot({ path: 'test-results/roof-desktop.png' });
  await page.locator('[data-view="terrace"]').click();
  await expect(page.locator('#scene-caption')).toContainText('午後露台');
  await page.locator('[data-view="chassis"]').click();
  await expect.poll(() => page.evaluate(() => window.__gallery.getDiagnostics().target[1])).toBeLessThan(1.2);
  await page.locator('#orbit').click();
  await expect(page.locator('#orbit')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#home').click();
  await expect(page.locator('#orbit')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => window.__gallery.getDiagnostics().state.view)).toBe('home');
  await page.locator('#petals').click();
  await expect(page.locator('#petals')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#about-open').click();
  await expect(page.locator('#about-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#about-dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('mouse orbit, wheel zoom and keyboard inspection manipulate a real camera', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const start = await page.evaluate(() => window.__gallery.getDiagnostics().camera);
  const box = await page.locator('#scene').boundingBox();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5, { steps: 12 });
  await page.mouse.up();
  const moved = await page.evaluate(() => window.__gallery.getDiagnostics().camera);
  expect(moved).not.toEqual(start);
  const distance = () => page.evaluate(() => { const d = window.__gallery.getDiagnostics(); return Math.hypot(...d.camera.map((v, i) => v - d.target[i])); });
  const before = await distance();
  await page.mouse.wheel(0, -400);
  await expect.poll(distance).toBeLessThan(before - 0.5);
  await page.locator('#scene').focus();
  await page.keyboard.press('Home');
  await expect.poll(() => page.evaluate(() => window.__gallery.getDiagnostics().camera[2])).toBeGreaterThan(15);
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => window.__gallery.getDiagnostics().camera)).not.toEqual(start);
});

test('mobile controls stay usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#mode-walk')).toBeInViewport();
  await page.locator('#night').click();
  await expect(page.locator('body')).toHaveClass(/night/);
  await page.locator('#night').click();
  await expect.poll(() => page.evaluate(() => window.__gallery.getDiagnostics().nightFactor)).toBeLessThan(0.05);
  await page.screenshot({ path: 'test-results/day-mobile.png', fullPage: true });
});

test('reduced motion is respected and no off-origin requests are needed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const external = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5178') && !request.url().startsWith('data:')) external.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#petals')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#orbit')).toHaveAttribute('aria-pressed', 'false');
  expect(external).toEqual([]);
});

test('WebGL unavailable gives an honest usable image fallback', async ({ page }) => {
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return String(type).startsWith('webgl') ? null : original.call(this, type, ...args); }; });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-fallback', 'true');
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#loading')).not.toBeVisible();
  await expect(page.locator('#orbit')).toBeDisabled();
  expect(await page.locator('#fallback img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
});
