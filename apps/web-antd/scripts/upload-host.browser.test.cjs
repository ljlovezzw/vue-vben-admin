const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('node:http');
const test = require('node:test');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../public');
const vue = path.join(path.dirname(require.resolve('vue/package.json')), 'dist/vue.esm-browser.prod.js');

test('route iframe detach, cache restore and close never unload the document-owned transfer iframe', async () => {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://test').pathname;
    res.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript' : 'text/html');
    if (pathname === '/') return res.end(`<!doctype html><html><body style="margin:0">
      <script src="/tools/upload-frame-host.js"></script><div id="app"></div>
      <script type="module">
      import {createApp,h,ref,KeepAlive} from '/vue.js';
      const show=ref(true); window.showUpload=value=>show.value=value;
      const Upload={name:'Upload',setup:()=>()=>h('div',{style:'height:850px;margin:70px 20px 0 200px'},[
        h('iframe',{class:'upload-tool-frame',src:'/tools/upload-tool.html',style:'width:100%;height:100%;border:0'})])};
      const Other={setup:()=>()=>h('main','其他模块')};
      createApp({setup:()=>()=>h(KeepAlive,null,{default:()=>h(show.value?Upload:Other)})}).mount('#app');
      </script></body></html>`);
    const file = pathname === '/vue.js' ? vue : path.resolve(root, `.${pathname}`);
    if ((file === vue || file.startsWith(root + path.sep)) && fs.existsSync(file) && fs.statSync(file).isFile()) return fs.createReadStream(file).pipe(res);
    res.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin === origin && request.method() === 'GET' && (url.pathname === '/' || url.pathname === '/vue.js' || url.pathname.startsWith('/tools/'))) return route.continue();
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"isolated test only"}' });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    const locator = page.locator('iframe[data-upload-persistent]');
    await locator.waitFor({ state: 'visible' });
    const frame = await (await locator.elementHandle()).contentFrame();
    await frame.waitForFunction(() => typeof state !== 'undefined');
    await frame.evaluate(() => {
      state.authOwner = 'test'; state.authToken = 'isolated';
      window.testPagehides = 0;
      addEventListener('pagehide', () => window.testPagehides++);
      window.sentinel = Math.random();
      const draft = { id: 'test-transfer', spu: 'TEST', ownerKey: 'user:test' };
      const job = createUploadJob(draft, 'isolated');
      job.active = true; job.enqueued = false;
      state.uploadJobs.set(draft.id, job);
      window.testJob = job;
      window.testDone = false;
      window.fetch = () => new Promise(resolve => { window.finishTransfer = () => resolve({ok:true,status:200,text:async()=>'{"receipt":"ok"}'}); });
      void fetchJsonWithRetry('/mock-edge', {}, '测试上传', {retryLimit:1}, job)
        .then(() => { testDone = true; job.active = false; })
        .catch(error => { window.transferError = error.message; });
    });
    const sentinel = await frame.evaluate(() => window.sentinel);
    await page.evaluate(() => showUpload(false));
    await page.waitForFunction(() => document.querySelector('[data-upload-persistent]').style.visibility === 'hidden');
    assert.equal(await frame.evaluate(() => testJob.controller.signal.aborted), false);
    await frame.evaluate(() => finishTransfer());
    await frame.waitForFunction(() => testDone);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => showUpload(true));
      await locator.waitFor({state:'visible'});
      await page.evaluate(() => showUpload(false));
      await page.waitForFunction(() => document.querySelector('[data-upload-persistent]').style.visibility === 'hidden');
    }
    await page.evaluate(() => showUpload(true));
    await locator.waitFor({state:'visible'});
    assert.equal(await frame.evaluate(() => window.sentinel), sentinel);
    assert.equal(await frame.evaluate(() => testPagehides), 0);
    assert.equal(await locator.count(), 1);
    const box = await locator.boundingBox();
    assert.ok(box.width > 1000 && box.height >= 800, 'placeholder retains layout after its old CSS class is removed');
    const snapshots = 'E:/junlee/Kanban/tmp/upload-resilience-qa';
    fs.mkdirSync(snapshots, {recursive:true});
    await page.screenshot({path:path.join(snapshots,'persistent-host-desktop.png')});
    // Parent route auth and draft focus still reach the real persistent frame.
    await page.evaluate(() => document.querySelector('.upload-tool-placeholder').contentWindow.postMessage({type:'kanban-auth-token',token:'new-token',userId:'next'},location.origin));
    await frame.waitForFunction(() => state.authOwner === 'next');
    await page.evaluate(() => document.querySelector('.upload-tool-placeholder').contentWindow.postMessage({type:'kanban-upload-draft-focus',draftId:'focus-me'},location.origin));
    await frame.waitForFunction(() => requestedUploadDraftId === 'focus-me');
    await page.evaluate(() => document.querySelector('.upload-tool-placeholder').remove());
    await page.waitForFunction(() => document.querySelector('[data-upload-persistent]').style.visibility === 'hidden');
    assert.equal(await frame.evaluate(() => testPagehides), 0);
    await page.evaluate(() => {
      const placeholder=document.createElement('iframe');
      placeholder.className='upload-tool-frame';
      placeholder.src='/tools/upload-tool.html';
      const host=document.createElement('div');
      host.style.cssText='height:700px;margin:70px 20px';
      host.appendChild(placeholder);document.body.appendChild(host);
    });
    await page.waitForFunction(() => document.querySelectorAll('.upload-tool-placeholder').length > 0);
    await locator.waitFor({state:'visible'});
    assert.equal(await frame.evaluate(() => window.sentinel), sentinel, 'reopening a closed business tab reuses the same document');
    assert.equal(await locator.count(), 1);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
