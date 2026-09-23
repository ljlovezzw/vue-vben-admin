const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const publicRoot = path.join(__dirname, '../public');

test('prepared upload files survive reload and remain isolated by account', async () => {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(publicRoot, `.${pathname}`);
    if (!file.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await chromium.launch({
      executablePath: fs.existsSync(systemChrome) ? systemChrome : undefined,
      headless: true,
    });
    const page = await browser.newPage();
    const url = `http://127.0.0.1:${server.address().port}/tools/upload-tool.html`;
    await page.goto(url);
    const id = await page.evaluate(async () => {
      state.authToken = 'browser-test-token';
      state.authOwner = 'person-a';
      const draft = {
        id: uid('upload'), ownerKey: await uploadDraftOwnerKey(), spu: 'TEST-SPU',
        metadataList: [{ shop: 'test', spu: 'TEST-SPU', parentAsin: 'B000000001', asins: ['B000000002'] }],
        galleryZip: { filename: 'test.zip', blob: new Blob(['image bytes']) },
        aplusZip: null, brandZip: null, gpsrImage: null,
        status: 'failed', error: 'temporary network error', createdAt: Date.now(), updatedAt: Date.now(),
      };
      await saveUploadDraft(draft);
      await renderUploadDrafts();
      return draft.id;
    });
    assert.equal(await page.locator('#uploadDraftList .upload-draft').count(), 1);
    if (process.env.UPLOAD_DRAFT_SCREENSHOT) {
      await page.locator('#uploadDrafts').screenshot({ path: process.env.UPLOAD_DRAFT_SCREENSHOT });
    }
    await page.reload();
    const restored = await page.evaluate(async id => {
      state.authToken = 'browser-test-token';
      state.authOwner = 'person-a';
      const draft = await readUploadDraft(id);
      await renderUploadDrafts();
      return { file: await draft.galleryZip.blob.text(), spu: draft.spu };
    }, id);
    assert.deepEqual(restored, { file: 'image bytes', spu: 'TEST-SPU' });
    assert.equal(await page.locator('#uploadDraftList .upload-draft').count(), 1);
    assert.equal(await page.evaluate(async id => {
      state.authOwner = 'person-b';
      return readUploadDraft(id);
    }, id), null);
    await page.evaluate(async id => {
      state.authOwner = 'person-a';
      // A retry must not rewrite the large cached ZIP merely to change status.
      saveUploadDraft = async () => { throw new DOMException('The operation was aborted', 'AbortError'); };
      uploadFeishuTaskViaEdge = async () => { throw new Error('temporary network error'); };
      await retryUploadDraft(id);
    }, id);
    await page.waitForFunction(id => state.uploadJobs.get(id)?.status === 'failed'
      && !state.uploadJobs.get(id)?.active, id);
    const failed = await page.evaluate(async id => {
      const draft = await readUploadDraft(id);
      return { status: draft.status, message: draft.message };
    }, id);
    assert.equal(failed.status, 'failed');
    assert.match(failed.message, /本地副本可重新提交/);
    assert.doesNotMatch(failed.message, /operation was aborted/);
    await page.reload();
    assert.equal(await page.evaluate(async id => {
      state.authToken = 'browser-test-token';
      state.authOwner = 'person-a';
      return (await readUploadDraft(id)).status;
    }, id), 'failed');
    await page.evaluate(async id => {
      state.authToken = 'browser-test-token';
      state.authOwner = 'person-a';
      uploadFeishuTaskViaEdge = async (metadata, gallery) => {
        window.submitted = { metadata, filename: gallery.filename, file: await gallery.blob.text() };
        return { data: { taskCount: 1, recordIds: ['record-1'] } };
      };
      loadTaskLog = () => {};
      await retryUploadDraft(id);
    }, id);
    await page.waitForFunction(id => state.uploadJobs.get(id)?.status === 'succeeded'
      && !state.uploadJobs.get(id)?.active, id);
    const retried = await page.evaluate(async id => {
      await renderUploadDrafts();
      const remaining = await readUploadDraft(id);
      return { submitted: window.submitted, status: remaining.message, remaining };
    }, id);
    assert.equal(retried.submitted.file, 'image bytes');
    assert.equal(retried.submitted.filename, 'test.zip');
    assert.match(retried.status, /已创建 1 个飞书任务/);
    assert.equal(retried.remaining.status, 'succeeded');
    assert.equal(retried.remaining.galleryZip, null);
    assert.equal(await page.locator('#uploadDraftList .upload-draft').count(), 1);
    assert.equal(await page.getByRole('button', { name: '重新提交', exact: true }).count(), 0);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
