import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const report = [];
try {
  for (const [width, height] of [[1440,960], [768,1024], [390,844], [320,568], [900,500]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [], badResponses = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) badResponses.push([response.url(), response.status()]); });
    page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4178') && !request.url().startsWith('data:')) external.push(request.url()); });
    await page.goto('http://127.0.0.1:4178/');
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    await page.evaluate(() => document.fonts.ready);
    const diagnostics = await page.evaluate(() => window.__gallery.getDiagnostics());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `horizontal overflow at ${width}`);
    assert.deepEqual(errors, []); assert.deepEqual(badResponses, []); assert.deepEqual(external, []);
    await page.locator('#mode-rest').click();
    await page.waitForFunction(() => window.__gallery.getDiagnostics().nightFactor > 0.95);
    await page.locator('#night').click();
    await page.waitForFunction(() => window.__gallery.getDiagnostics().nightFactor < 0.05);
    await mkdir('test-results/production', { recursive: true });
    await page.screenshot({ path: `test-results/production/${width}x${height}.png`, fullPage: true });
    report.push({ viewport: [width,height], diagnostics, overflow, errors, badResponses, external });
    await page.close();
  }
  await writeFile('test-results/production/verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
