const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createServer } = require('node:http');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
const { chromium } = require('playwright');

const sourcePath = path.join(__dirname, '../src/views/kanban/tools/upload/UploadTaskNotice.vue');
const { descriptor } = parse(fs.readFileSync(sourcePath, 'utf8'));
const script = compileScript(descriptor, { id: 'notice-test', inlineTemplate: true });
const compiled = ts.transpileModule(script.content, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const vueBrowser = path.join(path.dirname(require.resolve('vue/package.json')), 'dist/vue.esm-browser.prod.js');
const shell = fs.readFileSync(path.join(__dirname, 'upload-task-shell.js'), 'utf8');

function harness(mode) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <script type="importmap">{"imports":{"vue":"/vue.js","vue-router":"/router.js","@vben/stores":"/stores.js"}}</script>
    <style>body{margin:0;background:#eef3f8;font-family:system-ui}iframe{width:80px;height:40px}${descriptor.styles.map((style) => style.content).join('\n')}</style>
    ${mode === 'shell' ? '<script defer src="/shell.js"></script>' : ''}
    </head><body><div id="app"></div><iframe class="upload-tool-frame" src="/tools/upload-tool.html"></iframe>
    <script type="module">
      import { createApp, reactive, watch } from 'vue';
      const access = reactive({ accessToken: 'test-session' });
      const user = reactive({ userInfo: { userId: 'operator-1' } });
      for (const store of [access, user]) store.$subscribe = (fn) => watch(store, fn, { deep: true, flush: 'sync' });
      window.testStores = { access, user };
      window.routePushes = [];
      window.testRouter = { addRoute() {}, getRoutes: () => [], afterEach() {}, push: async (target) => { window.routePushes.push(target); } };
      const pinia = { _s: new Map([['core-user', user], ['core-access', access]]) };
      ${mode === 'vue' ? "const { default: component } = await import('/notice.js'); const app = createApp(component); app.config.globalProperties.$router = window.testRouter; app.config.globalProperties.$pinia = pinia; app.mount('#app');" : "document.querySelector('#app').__vue_app__ = { config: { globalProperties: { $router: window.testRouter, $pinia: pinia } } }; window.legacyEvents = []; window.addEventListener('message', event => { if(event.data?.type === 'kanban-upload-task-status') window.legacyEvents.push(event.data); });"}
      window.testReady = true;
    </script></body></html>`;
}

test('multi-task notices remain isolated, navigable and scoped to the operator', async (t) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const files = {
      '/vue.js': () => fs.readFileSync(vueBrowser, 'utf8'),
      '/notice.js': () => compiled,
      '/shell.js': () => shell,
      '/router.js': () => 'export const useRouter = () => window.testRouter;',
      '/stores.js': () => 'export const useAccessStore = () => window.testStores.access; export const useUserStore = () => window.testStores.user;',
      '/tools/upload-tool.html': () => `<!doctype html><title>Trusted upload frame</title><script>
        window.receivedAuth = [];
        window.addEventListener('message', event => {
          if (event.origin === location.origin && event.source === parent && event.data?.type === 'kanban-auth-token') window.receivedAuth.push(event.data);
        });
      </script>`,
      '/': () => harness(url.searchParams.get('mode') || 'shell'),
    };
    if (!files[url.pathname]) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    response.end(files[url.pathname]());
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  let browser;
  try {
    browser = await chromium.launch({ executablePath: fs.existsSync(chrome) ? chrome : undefined, headless: true });
    for (const mode of ['shell', 'vue']) {
      await t.test(mode, async () => {
        const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);
        await page.waitForFunction(() => window.testReady);
        if (mode === 'shell') await page.waitForFunction(() => window.testRouter.__kanbanUploadKeepAlive);
        const cardClass = mode === 'shell' ? '.kanban-upload-notice' : '.upload-task-notice';
        const cards = page.locator(cardClass);
        const card = (id) => page.locator(`${cardClass}[data-draft-id="${id}"]`);
        const receivedAuth = () => page.evaluate(() => document.querySelector('iframe').contentWindow.receivedAuth);
        {
          await page.evaluate(() => document.querySelector('iframe').contentWindow.eval(`parent.postMessage({source:'kanban-upload-tool',type:'kanban-auth-token-request'}, location.origin)`));
          await page.waitForFunction(() => document.querySelector('iframe').contentWindow.receivedAuth.length > 0);
          assert.deepEqual((await receivedAuth()).at(-1), { source: 'kanban-dashboard', type: 'kanban-auth-token', token: 'test-session', userId: 'operator-1' });
          const before = (await receivedAuth()).length;
          await page.evaluate(() => { window.testStores.user.userInfo = { userId: 'operator-1', displayName: 'unchanged identity' }; });
          await page.waitForTimeout(20);
          assert.equal((await receivedAuth()).length, before, 'irrelevant store updates must not broadcast credentials again');
        }
        async function send(data, fromFrame = true) {
          await page.evaluate(({ data, fromFrame }) => {
            const payload = { source: 'kanban-upload-tool', type: 'kanban-upload-task-status', ownerKey: 'user:operator-1', cached: true, phase: 'uploading', draftId: 'a', spu: 'LLW000967', message: '正在上传', ...data };
            if (fromFrame) document.querySelector('iframe').contentWindow.eval(`parent.postMessage(${JSON.stringify(payload)}, location.origin)`);
            else window.postMessage(payload, location.origin);
          }, { data, fromFrame });
          // postMessage delivery occurs in the next task, before the next driver call.
          await page.waitForTimeout(20);
        }
        await send({ ownerKey: 'user:another-operator', message: 'must not leak' });
        assert.equal(await cards.count(), 0);
        await send({ phase: 'not-a-real-phase' });
        assert.equal(await cards.count(), 0);
        await send({ draftId: 'forged' }, false);
        assert.equal(await cards.count(), 0, 'same-origin non-frame messages must be ignored');
        await send({ draftId: '', phase: 'queued' });
        assert.equal(await cards.count(), 0);
        await send({ ownerKey: null });
        assert.equal(await cards.count(), 0, 'an invalid explicit owner must not use legacy compatibility');
        await send({ ownerKey: undefined, draftId: 'legacy', phase: 'queued' });
        assert.equal(await cards.count(), 1, 'trusted legacy iframe messages remain compatible in the first session');
        await card('legacy').getByRole('button', { name: /关闭/ }).click();

        await send({ phase: 'queued', message: 'A 已排队' });
        await send({ draftId: 'b', spu: 'LLW000968', phase: 'preparing', message: 'B 独立准备' });
        assert.equal(await cards.count(), 2);
        assert.match(await card('a').innerText(), /A 已排队/);
        assert.match(await card('b').innerText(), /B 独立准备/);
        await page.evaluate(() => { document.querySelector('iframe').className = ''; });
        await send({ message: 'A 在其他模块继续传输' });
        assert.match(await card('a').innerText(), /A 在其他模块继续传输/);
        await page.evaluate(() => { document.querySelector('iframe').className = 'upload-tool-frame'; });
        for (const phase of ['caching', 'uploading', 'submitted', 'running', 'executing']) {
          await send({ phase, message: `A ${phase}` });
          assert.match(await card('a').innerText(), new RegExp(`A ${phase}`));
          assert.match(await card('b').innerText(), /B 独立准备/);
        }
        await send({ progress: { completed: 2, total: 27, unit: 'chunks' } });
        assert.equal(await card('a').locator('progress').getAttribute('value'), '2');
        assert.match(await card('a').innerText(), /2 \/ 27 片/);
        await card('a').getByRole('button', { name: '查看任务', exact: true }).focus();
        await send({ progress: { completed: 3, total: 27, unit: 'chunks' } });
        assert.equal(await card('a').getByRole('button', { name: '查看任务', exact: true }).evaluate((node) => node === document.activeElement), true, 'progress updates retain keyboard focus');
        await send({ progress: { completed: 99, total: 27, unit: 'chunks' } });
        assert.equal(await card('a').locator('progress').getAttribute('value'), '27');
        await send({ progress: { completed: 3, total: 0, unit: 'chunks' } });
        assert.equal(await card('a').locator('progress').isVisible(), false);

        await card('a').getByRole('button', { name: /关闭/ }).click();
        await send({ message: 'dismissed progress' });
        assert.equal(await card('a').count(), 0);
        await send({ phase: 'failed', message: 'A 网络失败' });
        assert.match(await card('a').innerText(), /A 网络失败/);
        assert.match(await card('b').innerText(), /B 独立准备/);
        const initialUrl = page.url();
        await card('a').getByRole('button', { name: '查看任务并重试' }).click();
        assert.equal(page.url(), initialUrl, 'opening the task must not reload the page');
        const route = await page.evaluate(() => window.routePushes.at(-1));
        assert.deepEqual(route, mode === 'shell' ? '/tools/upload?uploadDraft=a' : { name: 'UploadTool', query: { uploadDraft: 'a' } });
        await card('a').getByRole('button', { name: /关闭/ }).click();
        await send({ phase: 'failed', message: 'same terminal update' });
        assert.equal(await card('a').count(), 0, 'dismissed terminal state should not repeatedly reopen');
        await send({ phase: 'queued', message: 'A 重新排队' });
        assert.match(await card('a').innerText(), /A 重新排队/);
        await send({ phase: 'pending', message: 'A 等待确认' });
        await send({ draftId: 'b', phase: 'succeeded', message: 'B 提交完成' });
        assert.match(await card('b').innerText(), /B 提交完成/);

        await send({ draftId: 'c', spu: 'LLW000969', phase: 'queued' });
        await send({ draftId: 'd', spu: 'LLW000970', phase: 'uploading', message: '<img src=x onerror=alert(1)> 很长的错误说明'.repeat(12) });
        assert.equal(await cards.count(), 3);
        assert.equal(await cards.locator('img').count(), 0, 'message content must be escaped');
        await page.getByRole('button', { name: '另有 1 个任务，查看全部' }).click();
        if (mode === 'shell') {
          assert.equal(await page.evaluate(() => window.routePushes.at(-1)), '/tools/upload');
          const leaked = await page.evaluate(() => window.legacyEvents.filter((entry) => entry.draftId !== 'forged'));
          assert.deepEqual(leaked, [], 'capture bridge must suppress the old Vue single-notice handler');
        }
        if (process.env.UPLOAD_NOTICE_SCREENSHOT_DIR) {
          await page.screenshot({ path: path.join(process.env.UPLOAD_NOTICE_SCREENSHOT_DIR, `${mode}-desktop.png`) });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (process.env.UPLOAD_NOTICE_SCREENSHOT_DIR) {
          await page.screenshot({ path: path.join(process.env.UPLOAD_NOTICE_SCREENSHOT_DIR, `${mode}-mobile.png`) });
        }
        await page.evaluate(() => {
          document.querySelector('iframe').className = '';
          window.testStores.access.accessToken = '';
        });
        await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 0, cardClass);
        {
          await page.waitForFunction(() => document.querySelector('iframe').contentWindow.receivedAuth.at(-1)?.token === '');
          assert.deepEqual((await receivedAuth()).at(-1), { source: 'kanban-dashboard', type: 'kanban-auth-token', token: '', userId: '' }, 'logout must actively clear credentials in a remembered hidden iframe');
        }
        await send({ message: 'late message after logout' });
        assert.equal(await cards.count(), 0);
        await page.evaluate(() => { window.testStores.user.userInfo = { userId: 'operator-2' }; window.testStores.access.accessToken = 'new-token'; });
        {
          await page.waitForFunction(() => document.querySelector('iframe').contentWindow.receivedAuth.at(-1)?.token === 'new-token');
          assert.deepEqual((await receivedAuth()).at(-1), { source: 'kanban-dashboard', type: 'kanban-auth-token', token: 'new-token', userId: 'operator-2' });
          const before = (await receivedAuth()).length;
          await page.evaluate(() => { window.testStores.access.accessToken = 'refreshed-token'; });
          await page.waitForFunction(() => document.querySelector('iframe').contentWindow.receivedAuth.at(-1)?.token === 'refreshed-token');
          assert.equal((await receivedAuth()).length, before + 1, 'an actual token refresh broadcasts exactly once');
          await page.evaluate(() => { window.testStores.access.accessToken = 'refreshed-token'; window.testStores.user.userInfo = { userId: 'operator-2' }; });
          await page.waitForTimeout(20);
          assert.equal((await receivedAuth()).length, before + 1, 'the same token must not cause broadcast loops');
        }
        await send({ message: 'old operator must not leak' });
        assert.equal(await cards.count(), 0);
        await send({ ownerKey: undefined, message: 'old-format messages must not cross sessions' });
        assert.equal(await cards.count(), 0);
        await send({ ownerKey: 'user:operator-2', draftId: 'new-user', phase: 'queued' });
        assert.equal(await cards.count(), 1);
        await page.evaluate(() => { window.testStores.user.userInfo = { id: 'operator-3' }; });
        await page.waitForFunction(() => document.querySelector('iframe').contentWindow.receivedAuth.at(-1)?.userId === 'operator-3');
        assert.equal(await cards.count(), 0, 'fallback user id switches clear previous owner notifications');
        await page.evaluate(() => { window.testStores.user.userInfo = { username: 'operator-4' }; });
        await page.waitForFunction(() => document.querySelector('iframe').contentWindow.receivedAuth.at(-1)?.userId === 'operator-4');
        assert.deepEqual(errors, []);
        await page.close();
      });
    }
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
