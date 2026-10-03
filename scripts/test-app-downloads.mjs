import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'nyx-download-test-'));
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static('dist'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try {
 for(const brand of ['nyx','tutsi']) {
  const tutsi=brand==='tutsi';const page=await browser.newPage({acceptDownloads:true});
  page.on('pageerror',e=>console.log('PAGE ERROR',e.message));await page.goto(base+'/app.webmanifest');
  await page.setContent(tutsi?'<section data-tutsi-install-card><button data-install-tutsi></button><button data-download-tutsi-singlefile>Download HTML</button><p data-install-tutsi-status></p></section>':'<div class="settings-panel"><div class="settings-grid"></div></div>');
  await page.addScriptTag({url:base+(tutsi?'/apps/tutsi/install.js':'/js/pwa-install.js')});
  const event=page.waitForEvent('download');await page.locator(`[data-download-${brand}-singlefile]`).click();const download=await event;
  assert.equal(download.suggestedFilename(),tutsi?'Tutsi-Download.html':'Nyx-Download.html');
  const text=await readFile(await download.path(),'utf8');assert.ok(text.includes('2026.09.18.1'));
  const host=tutsi?'https://tutsi.nyxlearning.org/':'https://nyxlearning.org/';assert.ok(text.includes(host));
  await page.route(host+'**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><h1>Live app fixture</h1>'}));
  const saved=join(temp,download.suggestedFilename());await download.saveAs(saved);await page.goto(pathToFileURL(saved).href);
  await page.frameLocator('iframe').getByText('Live app fixture').waitFor({timeout:5000});
  const manifest=await (await fetch(base+(tutsi?'/apps/tutsi/app.webmanifest':'/app.webmanifest'))).json();
  assert.equal(manifest.start_url,tutsi?'/tutsi?source=installed-app':'/?source=installed-app');
  for(const icon of manifest.icons)assert.equal((await fetch(base+icon.src)).status,200);
  await page.close();
 }
 console.log('PASS: both HTML downloads, filenames, current release, file:// launch, distinct app manifests and icons');
}finally{await browser.close();await rm(temp,{recursive:true,force:true});await new Promise(r=>server.close(r));}
