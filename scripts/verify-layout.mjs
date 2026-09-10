// scripts/verify-layout.mjs
// Typography + responsive layout verification for the redesign.
// Screenshots each required viewport (day + night on mobile widths),
// asserts >=44px interactive controls, no horizontal overflow, readable
// font sizes, and no overlap between the control chrome and the masthead.
//
// Usage: node scripts/verify-layout.mjs [url] [outDir]
//   defaults: http://127.0.0.1:4182/  test-results/layout-v1
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.argv[2] || 'http://127.0.0.1:4182/';
const output = process.argv[3] || 'test-results/layout-v1';

// [w, h, label] — the five required cases.
const viewports = [
  [1440, 960, 'desktop'],
  [900, 500, 'desktop-short'],
  [768, 1024, 'tablet'],
  [390, 844, 'phone'],
  [320, 568, 'phone-small'],
];

// Selectors that must be tappable (>=44px) and legible.
const controlSel =
  '.tools button, .view-selector button, .mode-buttons button, #explore, #about-open, .text-button';

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
await mkdir(output, { recursive: true });
const reports = [];
let failures = 0;

try {
  for (const [width, height, label] of viewports) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);

    // No horizontal overflow.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth);
    const hasOverflow = overflow > 1;

    // Control hit-target + font-size audit.
    const controls = await page.$$eval(controlSel, (els) =>
      els.filter(el => el.offsetParent !== null).map(el => {
        const r = el.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(el).fontSize);
        return {
          id: el.id || el.className || el.tagName,
          w: Math.round(r.width),
          h: Math.round(r.height),
          fontSize: fs,
        };
      }));
    const tooSmall = controls.filter(c => c.h < 44 || c.w < 44);

    // Body/label readability: sample visible text nodes.
    const smallText = await page.evaluate(() => {
      const sels = ['.description', '.view-selector button', '.mode-buttons button span',
        '.material-notes span', '.dock-heading span', '.scene-caption', '.text-button',
        '.tiny-label', '.eyebrow'];
      const out = [];
      for (const s of sels) {
        for (const el of document.querySelectorAll(s)) {
          if (el.offsetParent === null) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < 13) out.push({ sel: s, fontSize: fs, text: el.textContent.trim().slice(0, 18) });
        }
      }
      return out;
    });

    // Overlap check: control sheet/rail must not collide with masthead.
    const overlap = await page.evaluate(() => {
      const rect = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      const mast = rect('.masthead');
      const controls = rect('.controls');
      if (!mast || !controls) return false;
      // vertical overlap = collision (both are horizontal bands)
      return controls.top < mast.bottom && controls.bottom > mast.top;
    });

    await page.screenshot({ path: `${output}/${label}-${width}x${height}-day.png`, fullPage: false });

    // Night pass on the smaller widths (where the bottom sheet lives).
    if (width <= 900) {
      await page.locator('#night').click();
      await page.waitForFunction(() => window.__gallery.getDiagnostics().nightFactor > 0.99, null, { timeout: 10000 }).catch(() => {});
      await page.screenshot({ path: `${output}/${label}-${width}x${height}-night.png`, fullPage: false });
    }

    const pass = !hasOverflow && tooSmall.length === 0 && smallText.length === 0 && !overlap && errors.length === 0;
    if (!pass) failures++;
    reports.push({ label, viewport: [width, height], pass, overflowPx: overflow, hasOverflow, tooSmall, smallText, overlap, errors });
    await page.close();
  }

  await writeFile(`${output}/layout-report.json`, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports.map(r => ({
    label: r.label, viewport: r.viewport, pass: r.pass,
    overflowPx: r.overflowPx, tooSmall: r.tooSmall.length,
    smallText: r.smallText.length, overlap: r.overlap, errors: r.errors.length,
  })), null, 2));
  console.log(failures === 0 ? '\nLAYOUT OK — all viewports passed.' : `\nLAYOUT FAIL — ${failures} viewport(s) failed.`);
} finally {
  await browser.close();
}
process.exit(failures === 0 ? 0 : 1);
