import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const url = process.argv[2] || 'http://127.0.0.1:5182/';
const output = process.argv[3] || 'test-results/rebuild';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const reports = [];
await mkdir(output,{recursive:true});
try {
  for (const [width,height] of [[1440,960],[390,844],[768,1024],[320,568]]) {
    const page = await browser.newPage({viewport:{width,height}, reducedMotion:'reduce'});
    const errors=[],badResponses=[];
    page.on('pageerror', e=>errors.push(e.message));
    page.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response', r=>{if(r.status()>=400)badResponses.push([r.url(),r.status()]);});
    await page.goto(url,{waitUntil:'networkidle',timeout:60000});
    await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:45000});
    await page.evaluate(()=>document.fonts.ready);
    const diagnostics=await page.evaluate(()=>window.__gallery.getDiagnostics());
    assert.equal(diagnostics.revision,'reference-rebuild-2');

    const materialRevision = await page.evaluate(() => window.__gallery.getDiagnostics().materialRevision);
    assert.equal(materialRevision, 'pbr-detail-3');
    assert.ok(diagnostics.triangles>10000); assert.ok(diagnostics.meshes>10);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`${output}/day-${width}.png`,fullPage:true});
    await page.locator('#night').click();
    await page.waitForFunction(()=>window.__gallery.getDiagnostics().nightFactor>.99);
    await page.screenshot({path:`${output}/night-${width}.png`,fullPage:true});
    await page.locator('#night').click();
    if(width===1440){
      for(const view of ['roof','terrace','chassis','back']){
        await page.locator(`[data-view="${view}"]`).click();
        await page.waitForFunction(v=>window.__gallery.getDiagnostics().state.view===v,view);
        await page.screenshot({path:`${output}/${view}.png`});
      }
      await page.locator('#home').click();
      const start=await page.evaluate(()=>window.__gallery.getDiagnostics().camera);
      await page.locator('#orbit').click();
      await page.waitForFunction(p=>Math.abs(window.__gallery.getDiagnostics().camera[0]-p[0])>.1,start);
      await page.locator('#home').click();
      await page.locator('#mode-walk').click();
      const wheels=await page.evaluate(()=>window.__gallery.getDiagnostics().wheels);
      await page.waitForFunction(w=>JSON.stringify(window.__gallery.getDiagnostics().wheels)!==JSON.stringify(w),wheels);
    }
    assert.deepEqual(errors,[]); assert.deepEqual(badResponses,[]);
    reports.push({url,viewport:[width,height],diagnostics,errors,badResponses});
    await page.close();
  }
  await writeFile(`${output}/verification.json`,JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports.map(({url,viewport,diagnostics,errors,badResponses})=>({url,viewport,revision:diagnostics.revision,meshes:diagnostics.meshes,triangles:diagnostics.triangles,errors,badResponses})),null,2));
}finally{await browser.close();}
