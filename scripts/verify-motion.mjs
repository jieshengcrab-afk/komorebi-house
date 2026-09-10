import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
const url = process.argv[2] || 'http://127.0.0.1:5182/';
const out = process.argv[3] || 'test-results/motion-evidence';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const log = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 0.5 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 45000 });
  const diag = () => page.evaluate(() => window.__gallery.getDiagnostics());
  // CDP screenshot: grabs compositor output, no animation-stability wait, never hangs.
  const shot = async name => {
    try { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }); await writeFile(`${out}/${name}.png`, Buffer.from(data, 'base64')); }
    catch (e) { log.push({ shotErr: name, e: String(e).slice(0, 60) }); }
  };

  // ---- FALLING PETALS ----
  const petalTimeline = [];
  for (let i = 0; i < 8; i++) {
    const d = await diag();
    petalTimeline.push({ t: i * 0.4, sampleY: d.petals.sampleY, aloft: d.petals.aloft, meanFallRate: +d.petals.meanFallRate.toFixed(4), minY: +d.petals.minY.toFixed(3), maxY: +d.petals.maxY.toFixed(3) });
    if (i === 0 || i === 4) await shot(`petals-t${i}`);
    await page.waitForTimeout(400);
  }
  log.push({ petalTimeline });
  const descent = await page.evaluate(async () => {
    const read = () => window.__gallery.getDiagnostics().petals.sampleY[0];
    const series = [];
    for (let i = 0; i < 90; i++) { await new Promise(r => requestAnimationFrame(r)); series.push(read()); }
    let down = 0, up = 0;
    for (let i = 1; i < series.length; i++) { if (series[i] < series[i - 1]) down++; else if (series[i] > series[i - 1]) up++; }
    return { first: series[0], last: series[series.length - 1], down, up, span: [Math.min(...series), Math.max(...series)] };
  });
  log.push({ singlePetalDescent: descent });

  // ---- WHEELS: walk ramp ----
  await page.locator('#mode-walk').click();
  const wheelRamp = [];
  for (let i = 0; i < 8; i++) {
    const d = await diag();
    wheelRamp.push({ t: i * 0.35, velocity: d.locomotion.velocity, distance: d.locomotion.distance, roll: d.locomotion.roll, wheelX: d.wheels.map(w => +w[0].toFixed(4)) });
    if (i === 0 || i === 7) await shot(`walk-t${i}`);
    await page.waitForTimeout(350);
  }
  log.push({ wheelRamp });
  const R = 0.49;
  const slideOK = wheelRamp.filter(s => s.distance > 0).every(s => Math.abs(s.roll - (-s.distance / R)) < 1e-3);
  const velEased = wheelRamp[0].velocity < 0.55 && wheelRamp[wheelRamp.length - 1].velocity > 0.5;
  const velMonotonic = wheelRamp.every((s, i) => i === 0 || s.velocity >= wheelRamp[i - 1].velocity - 1e-6 || Math.abs(s.velocity - 0.6) < 0.02);
  const wheelsAligned = wheelRamp.every(s => { const [a, b, c, e] = s.wheelX; return Math.abs(a - b) < 1e-6 && Math.abs(a - c) < 1e-6 && Math.abs(a - e) < 1e-6; });
  const wheelYaw = await page.evaluate(() => window.__gallery.getDiagnostics().wheels.map(w => +w[1].toFixed(4)));

  // ---- STOP: smooth decel ----
  await page.locator('#mode-stand').click();
  const distAtStop = (await diag()).locomotion.distance;
  // Software WebGL can run far below realtime; wait for simulation settlement.
  await page.waitForFunction(() => window.__gallery.getDiagnostics().locomotion.velocity === 0, null, { timeout: 30000 });
  const stopped = await diag();

  const verdict = {
    errors,
    petals: { descendsMoreThanRises: descent.down > descent.up, down: descent.down, up: descent.up, span: descent.span, aloftFraction: +(petalTimeline[0].aloft / (await diag()).petals.count).toFixed(2) },
    wheels: { slideOK, velEased, velMonotonic, wheelsAligned, wheelYaw, allYawZero: wheelYaw.every(y => y === 0) },
    stop: { velocityZero: stopped.locomotion.velocity === 0, keptRollingWhileDecel: stopped.locomotion.distance > distAtStop }
  };
  log.push({ verdict });
  await writeFile(`${out}/motion-report.json`, JSON.stringify(log, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  assert.deepEqual(errors, []);
  assert.ok(verdict.petals.descendsMoreThanRises);
  assert.ok(slideOK && velEased && velMonotonic && wheelsAligned && verdict.wheels.allYawZero);
  assert.ok(verdict.stop.velocityZero);
} finally { await browser.close(); }
