const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const releaseRoot = path.resolve(
  process.env.UPLOAD_RELEASE_ROOT || path.join(__dirname, '../dist-production/green'),
);

test('isolated release retains app routes and shows upload status outside the iframe', async () => {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = pathname === '/tools/upload-task-shell.js'
      ? path.join(__dirname, 'upload-task-shell.js')
      : path.resolve(releaseRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
    if ((pathname !== '/tools/upload-task-shell.js' && !file.startsWith(`${releaseRoot}${path.sep}`)) || !fs.existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    const extension = path.extname(file);
    const contentType = extension === '.js' ? 'text/javascript'
      : extension === '.css' ? 'text/css' : 'text/html';
    response.setHeader('Content-Type', contentType);
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await chromium.launch({
      executablePath: fs.existsSync(chrome) ? chrome : undefined,
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => Boolean(
      document.getElementById('app')?.__vue_app__?.config?.globalProperties?.$router?.__kanbanUploadKeepAlive,
    ));
    const keepAlive = await page.evaluate(() => {
      const router = document.getElementById('app').__vue_app__.config.globalProperties.$router;
      router.addRoute({ path: '/__upload-release-test', name: 'UploadTool', component: {}, meta: {} });
      const enabled = router.getRoutes().find(route => route.name === 'UploadTool')?.meta.keepAlive;
      router.removeRoute('UploadTool');
      return enabled;
    });
    assert.equal(keepAlive, true);

    await page.evaluate(() => window.postMessage({
      source: 'kanban-upload-tool', type: 'kanban-upload-task-status',
      draftId: 'browser-test', cached: true, phase: 'uploading',
      spu: 'TEST-SPU', message: '正在上传 2/8 片',
    }, location.origin));
    await page.getByText('正在上传图片').waitFor();
    assert.match(await page.locator('.kanban-upload-notice').innerText(), /正在上传 2\/8 片/);
    await page.getByRole('button', { name: '关闭通知' }).click();
    await page.evaluate(() => window.postMessage({
      source: 'kanban-upload-tool', type: 'kanban-upload-task-status',
      draftId: 'browser-test', cached: true, phase: 'uploading', message: '正在上传 3/8 片',
    }, location.origin));
    assert.equal(await page.locator('.kanban-upload-notice').count(), 0);
    await page.evaluate(() => window.postMessage({
      source: 'kanban-upload-tool', type: 'kanban-upload-task-status',
      draftId: 'browser-test', cached: true, phase: 'failed', message: '网络超时',
    }, location.origin));
    await page.getByRole('button', { name: '查看任务并重试' }).waitFor();
    assert.match(await page.locator('.kanban-upload-notice').innerText(), /网络超时/);
    await page.evaluate(() => {
      window.__uploadRoutePushes = [];
      const router = document.getElementById('app').__vue_app__.config.globalProperties.$router;
      router.push = async target => { window.__uploadRoutePushes.push(target); };
    });
    const currentUrl = page.url();
    await page.getByRole('button', { name: '查看任务并重试' }).click();
    assert.equal(page.url(), currentUrl, 'the retry link must not reload the app');
    assert.deepEqual(await page.evaluate(() => window.__uploadRoutePushes), ['/tools/upload?uploadDraft=browser-test']);

    await page.evaluate(() => {
      const pinia = document.getElementById('app').__vue_app__.config.globalProperties.$pinia;
      pinia._s.get('core-access').accessToken = 'browser-test-token';
      pinia._s.get('core-user').userInfo = { userId: 'browser-test-user', username: 'browser-test-user' };
      const iframe = document.createElement('iframe');
      iframe.id = 'upload-bridge-test';
      iframe.src = '/tools/upload-tool.html';
      document.body.appendChild(iframe);
    });
    await page.waitForFunction(() => {
      const iframe = document.getElementById('upload-bridge-test');
      try { return iframe?.contentWindow?.eval('state.authOwner') === 'browser-test-user'; }
      catch { return false; }
    });
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
