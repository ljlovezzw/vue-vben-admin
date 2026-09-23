const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const publicRoot = path.resolve(__dirname, '../public');
const screenshotRoot = process.env.UPLOAD_QUEUE_SCREENSHOT_DIR
  || 'E:/junlee/Kanban/tmp/upload-queue-qa';
let server;
let browser;
let origin;

test.before(async () => {
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(publicRoot, `.${pathname}`);
    if (!file.startsWith(`${publicRoot}${path.sep}`)
      || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({
    executablePath: fs.existsSync(systemChrome) ? systemChrome : undefined,
    headless: true,
  });
});

test.after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function createHarness(t) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const writes = [];
  // No test may reach a real API, including URLs on a different localhost port.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin && request.method() === 'GET' && url.pathname.startsWith('/tools/')) {
      await route.continue();
    } else {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        writes.push({ method: request.method(), pathname: url.pathname });
      }
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Network disabled by isolated upload queue browser test' }),
      });
    }
  });
  t.after(async () => context.close());
  return { context, writes, page: await createPage(context) };
}

async function createPage(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await page.goto(`${origin}/tools/upload-tool.html`);
  await page.evaluate(() => {
    state.authToken = 'queue-browser-test-token';
    state.authOwner = 'person-a';
    loadTaskLog = () => {};
    window.queueTest = { calls: [], jobs: {}, source: null };
    const transport = (...args) => new Promise((resolve, reject) => {
      const metadata = args[0];
      const context = args.at(-1);
      if (!context || typeof context.report !== 'function' || typeof context.phase !== 'function') {
        reject(new Error('Transport must receive a task-scoped progress context'));
        return;
      }
      queueTest.calls.push({
        spu: metadata[0].spu,
        metadata: structuredClone(metadata),
        context,
        resolve,
        reject,
      });
    });
    uploadFeishuTaskViaBackend = transport;
    uploadFeishuTaskViaEdge = transport;
    queueTest.enqueue = async (id, parentAsin = `PARENT-${id}`, shop = 'TEST-US') => {
      const draft = {
        id,
        ownerKey: await uploadDraftOwnerKey(),
        spu: id,
        metadataList: [{ shop, spu: id, parentAsin, asins: [`CHILD-${id}`], sidMsku: [] }],
        galleryZip: { filename: `${id}.zip`, blob: new Blob([`files:${id}`]) },
        aplusZip: null,
        brandZip: null,
        gpsrImage: null,
        status: 'queued',
        error: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveUploadDraft(draft);
      const job = enqueueUploadDraft(draft, authToken());
      if (!job || typeof job.then === 'function') {
        throw new Error('enqueueUploadDraft must immediately return a job, not await upload completion');
      }
      queueTest.jobs[id] = job;
      return id;
    };
    queueTest.settle = (spu, failure = '', pending = false) => {
      const call = queueTest.calls.find(entry => entry.spu === spu && !entry.settled);
      if (!call) throw new Error(`No active transport for ${spu}`);
      call.settled = true;
      if (failure) {
        const error = new Error(failure);
        if (pending) error.uploadPending = true;
        call.reject(error);
      } else {
        call.resolve({ data: { taskCount: 1, recordIds: [`record:${spu}`] } });
      }
    };
  });
  return page;
}

async function enqueue(page, id, parentAsin, shop) {
  return page.evaluate(([id, parentAsin, shop]) => queueTest.enqueue(id, parentAsin, shop), [id, parentAsin, shop]);
}

async function waitCalls(page, count) {
  await page.waitForFunction(count => queueTest.calls.length === count, count);
}

async function waitDraftStatus(page, id, status) {
  await page.waitForFunction(async ([id, status]) => (await readUploadDraft(id))?.status === status, [id, status]);
}

async function settle(page, id, error = '', pending = false) {
  await page.evaluate(args => queueTest.settle(...args), [id, error, pending]);
}

test('parent ASIN option is off by default and appends a unique parent ASIN when enabled', async t => {
  const { page, writes } = await createHarness(t);
  const includeParentAsin = page.locator('#includeParentAsin');
  assert.equal(await includeParentAsin.isChecked(), false);
  assert.equal(await page.locator('#includeParentAsinHint').textContent(), '默认仅包含子 ASIN');

  const defaultAsins = await page.evaluate(() =>
    uploadAsinsForGroup({ asins: ['B0CHILD001', 'B0CHILD002'], parentAsin: 'B0PARENT01' }),
  );
  assert.deepEqual(defaultAsins, ['B0CHILD001', 'B0CHILD002']);

  await includeParentAsin.check();
  const includedAsins = await page.evaluate(() => ({
    standard: uploadAsinsForGroup({
      asins: ['B0CHILD001', 'B0CHILD002'],
      parentAsin: 'B0PARENT01',
    }),
    deduplicated: uploadAsinsForGroup({
      asins: ['B0CHILD001', 'B0PARENT01'],
      parentAsin: 'B0PARENT01',
    }),
  }));
  assert.deepEqual(includedAsins.standard, ['B0CHILD001', 'B0CHILD002', 'B0PARENT01']);
  assert.deepEqual(includedAsins.deduplicated, ['B0CHILD001', 'B0PARENT01']);
  assert.equal(writes.length, 0);
});

test('two tasks run independently, a third waits, failures retain files and successes retain lightweight results', { timeout: 30_000 }, async t => {
  const { page, writes } = await createHarness(t);
  await enqueue(page, 'QUEUE-A');
  await enqueue(page, 'QUEUE-B');
  await enqueue(page, 'QUEUE-C');
  await waitCalls(page, 2);
  assert.deepEqual(await page.evaluate(() => queueTest.calls.map(call => call.spu)), ['QUEUE-A', 'QUEUE-B']);
  const progress = await page.evaluate(async () => {
    queueTest.calls[0].context.report('A 独立进度：分片 3/10', 'normal', { completed: 3, total: 10, unit: 'chunks' });
    queueTest.calls[1].context.report('B 独立进度：分片 7/10', 'normal', { completed: 7, total: 10, unit: 'chunks' });
    await renderUploadDrafts();
    return {
      a: document.querySelector('[data-draft-id="QUEUE-A"]').textContent,
      b: document.querySelector('[data-draft-id="QUEUE-B"]').textContent,
      bars: ['QUEUE-A', 'QUEUE-B'].map(id => {
        const bar = document.querySelector(`[data-draft-id="${id}"] progress`);
        return { value: bar?.value, max: bar?.max, label: bar?.getAttribute('aria-label') };
      }),
      unlocked: !els.uploadFeishuTask.disabled && !state.feishuTaskInFlight,
    };
  });
  assert.match(progress.a, /A 独立进度/);
  assert.doesNotMatch(progress.a, /B 独立进度/);
  assert.match(progress.b, /B 独立进度/);
  assert.doesNotMatch(progress.b, /A 独立进度/);
  assert.deepEqual(progress.bars, [
    { value: 3, max: 10, label: 'QUEUE-A 上传进度' },
    { value: 7, max: 10, label: 'QUEUE-B 上传进度' },
  ]);
  assert.equal(progress.unlocked, true);
  await settle(page, 'QUEUE-B', 'B 模拟传输失败');
  await waitDraftStatus(page, 'QUEUE-B', 'failed');
  await waitCalls(page, 3);
  assert.equal(await page.evaluate(async () => (await readUploadDraft('QUEUE-B')).galleryZip.blob.text()), 'files:QUEUE-B');
  await page.evaluate(() => { els.spu.value = 'NEXT-FORM-UNSUBMITTED'; });
  await settle(page, 'QUEUE-A');
  await settle(page, 'QUEUE-C');
  await waitDraftStatus(page, 'QUEUE-A', 'succeeded');
  await waitDraftStatus(page, 'QUEUE-C', 'succeeded');
  const completed = await page.evaluate(async () => {
    const a = await readUploadDraft('QUEUE-A');
    const inMemory = state.uploadJobs.get('QUEUE-A').draft;
    await renderUploadDrafts();
    return { sourceRemoved: !a.galleryZip && !a.aplusZip && !a.brandZip && !a.gpsrImage && !a.preparation,
      memoryReleased: !inMemory.galleryZip && !inMemory.aplusZip && !inMemory.brandZip && !inMemory.gpsrImage && !inMemory.preparation,
      formSpu: els.spu.value, result: document.querySelector('[data-draft-id="QUEUE-A"]').textContent };
  });
  assert.equal(completed.sourceRemoved, true);
  assert.equal(completed.memoryReleased, true);
  assert.equal(completed.formSpu, 'NEXT-FORM-UNSUBMITTED');
  assert.match(completed.result, /record:QUEUE-A|成功|完成/);
  assert.equal(writes.length, 0);
  fs.mkdirSync(screenshotRoot, { recursive: true });
  await page.locator('#uploadDrafts').screenshot({ path: path.join(screenshotRoot, 'upload-queue-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#uploadDrafts').screenshot({ path: path.join(screenshotRoot, 'upload-queue-mobile.png') });
  const dimensions = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  assert.ok(dimensions.documentWidth <= dimensions.width + 1, `Mobile page overflows: ${JSON.stringify(dimensions)}`);
});

test('submit persists original sources and frees the form before compression or network completes', { timeout: 30_000 }, async t => {
  const { page } = await createHarness(t);
  const saved = await page.evaluate(async () => {
    els.spu.value = 'FORM-SOURCE';
    els.includeParentAsin.checked = true;
    state.queriedSpu = 'FORM-SOURCE';
    selectedListingGroups = () => state.queriedSpu === 'FORM-SOURCE'
      ? [{ shop: 'TEST-US', parentAsin: 'FORM-PARENT', asins: ['FORM-CHILD'], sidMsku: [], rows: [] }]
      : [];
    collectGalleryFiles = () => [{ file: new File(['raw-original-file'], 'original.jpg', { type: 'image/jpeg' }), isImage: false, path: 'FORM-SOURCE/original.jpg' }];
    collectAPlusFiles = () => [];
    collectBrandFiles = () => [];
    currentGalleryValidationErrors = () => [];
    galleryCoverageValidationErrors = () => [];
    currentAPlusValidationErrors = () => [];
    currentImageValidationErrors = async () => [];
    buildUploadZip = async entries => {
      if (!entries.length) return null;
      queueTest.compressionStarted = true;
      await new Promise(resolve => { queueTest.finishCompression = resolve; });
      return { filename: 'prepared.zip', blob: new Blob(['compressed']) };
    };
    await uploadFeishuTask();
    const drafts = await listUploadDrafts();
    return { id: drafts[0]?.id, formSpu: els.spu.value, unlocked: !state.feishuTaskInFlight && !els.uploadFeishuTask.disabled,
      saved: Boolean(drafts[0]), transportCount: queueTest.calls.length,
      jobs: state.uploadJobs.size, message: els.feishuTaskStatus.textContent,
      asins: drafts[0]?.metadataList?.[0]?.asins };
  });
  assert.equal(saved.saved, true);
  assert.deepEqual(saved.asins, ['FORM-CHILD', 'FORM-PARENT']);
  assert.equal(saved.formSpu, '');
  assert.equal(saved.unlocked, true);
  assert.equal(saved.transportCount, 0);
  assert.equal(saved.jobs, 1, JSON.stringify(saved));
  await page.waitForFunction(() => queueTest.compressionStarted);
  const raw = await page.evaluate(async id => {
    const draft = await readUploadDraft(id);
    const blobs = [];
    function visit(value) {
      if (value instanceof Blob) blobs.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    }
    visit(draft);
    return Promise.all(blobs.map(blob => blob.text()));
  }, saved.id);
  assert.ok(raw.includes('raw-original-file'), 'Original file must survive in IndexedDB before compression');
  await page.evaluate(() => { els.spu.value = 'FORM-SECOND'; queueTest.finishCompression(); });
  await waitCalls(page, 1);
  await settle(page, 'FORM-SOURCE');
  await waitDraftStatus(page, saved.id, 'succeeded');
  assert.equal(await page.evaluate(() => els.spu.value), 'FORM-SECOND');
});

test('queued source names, keywords, AI flags and GPSR naming are isolated from the next form', { timeout: 30_000 }, async t => {
  const { page } = await createHarness(t);
  await enqueue(page, 'MATERIAL-BLOCKER-A');
  await enqueue(page, 'MATERIAL-BLOCKER-B');
  await waitCalls(page, 2);
  const id = await page.evaluate(async () => {
    els.spu.value = 'MATERIAL-ORIGINAL';
    state.queriedSpu = 'MATERIAL-ORIGINAL';
    els.galleryZip.value = 'ORIGINAL-GALLERY';
    els.aPlusZip.value = 'ORIGINAL-APLUS';
    els.brandZip.value = 'ORIGINAL-BRAND';
    els.coreImageKeywordInput.value = 'original core\noriginal subject';
    els.sceneImageKeywordInput.value = 'original scene\noriginal comment';
    state.gpsrImage = new File(['original-gpsr-bytes'], 'original-gpsr.jpg', { type: 'image/jpeg' });
    queueTest.originalEntries = ['gallery', 'aplus', 'brand'].map(kind => ({
      file: new File([`original-${kind}-bytes`], `${kind}.jpg`, { type: 'image/jpeg' }),
      path: `ORIGINAL-${kind.toUpperCase()}/${kind}.jpg`, isImage: false,
      aiGenerated: true, aiGeneratedPerson: false,
    }));
    selectedListingGroups = () => state.queriedSpu === 'MATERIAL-ORIGINAL'
      ? [{ shop: 'TEST-US', parentAsin: 'MATERIAL-PARENT', asins: ['MATERIAL-CHILD'], sidMsku: [], rows: [] }]
      : [];
    collectGalleryFiles = () => [queueTest.originalEntries[0]];
    collectAPlusFiles = () => [queueTest.originalEntries[1]];
    collectBrandFiles = () => [queueTest.originalEntries[2]];
    currentGalleryValidationErrors = () => [];
    galleryCoverageValidationErrors = () => [];
    currentAPlusValidationErrors = () => [];
    currentImageValidationErrors = async () => [];
    queueTest.prepared = [];
    buildUploadZip = async (entries, root, options) => {
      queueTest.prepared.push({ root, options: structuredClone(options), entries: await Promise.all(entries.map(async entry => ({
        path: entry.path, aiGenerated: entry.aiGenerated, aiGeneratedPerson: entry.aiGeneratedPerson,
        bytes: await entry.file.text(),
      }))) });
      return { filename: `${root}.zip`, blob: new Blob(['prepared']) };
    };
    imageFileWithKeywordMetadata = async (file, metadata) => {
      queueTest.gpsrEmbedding = { bytes: await file.text(), metadata: structuredClone(metadata) };
      return file;
    };
    await uploadFeishuTask();
    const draft = (await listUploadDrafts()).find(item => item.spu === 'MATERIAL-ORIGINAL');
    if (!draft) throw new Error(`Original draft was not saved: ${els.feishuTaskStatus.textContent}`);
    // Simulate filling the next form, including mutation of the original source objects.
    els.spu.value = 'MATERIAL-NEXT';
    els.galleryZip.value = 'NEXT-GALLERY';
    els.aPlusZip.value = 'NEXT-APLUS';
    els.brandZip.value = 'NEXT-BRAND';
    els.coreImageKeywordInput.value = 'next core\nnext subject';
    els.sceneImageKeywordInput.value = 'next scene\nnext comment';
    state.gpsrImage = new File(['next-gpsr-bytes'], 'next-gpsr.jpg', { type: 'image/jpeg' });
    queueTest.originalEntries.forEach(entry => {
      entry.aiGenerated = false;
      entry.aiGeneratedPerson = true;
      entry.path = 'next-form/mutated.jpg';
      entry.file = new File(['next-form-bytes'], 'next.jpg');
    });
    return draft.id;
  });
  assert.equal(await page.evaluate(() => queueTest.prepared.length), 0, 'Original material must still be queued');
  await settle(page, 'MATERIAL-BLOCKER-A');
  await waitCalls(page, 3);
  const prepared = await page.evaluate(async id => ({
    archives: queueTest.prepared,
    gpsr: queueTest.gpsrEmbedding,
    gpsrFilename: (await readUploadDraft(id)).gpsrImage.filename,
    formSpu: els.spu.value,
  }), id);
  const keywords = {
    all: ['original core', 'original subject', 'original scene', 'original comment'],
    title: 'original core', subject: 'original subject', tags: 'original scene', comment: 'original comment',
  };
  assert.deepEqual(prepared.archives.map(archive => archive.root), ['ORIGINAL-GALLERY', 'ORIGINAL-APLUS', 'ORIGINAL-BRAND']);
  for (const [index, archive] of prepared.archives.entries()) {
    assert.deepEqual(archive.options.keywordMetadata, keywords);
    const kind = ['gallery', 'aplus', 'brand'][index];
    assert.deepEqual(archive.entries, [{ path: `ORIGINAL-${kind.toUpperCase()}/${kind}.jpg`,
      aiGenerated: true, aiGeneratedPerson: false, bytes: `original-${kind}-bytes` }]);
  }
  assert.deepEqual(prepared.gpsr, { bytes: 'original-gpsr-bytes', metadata: keywords });
  assert.equal(prepared.gpsrFilename, 'MATERIAL-ORIGINAL-GPSR合规图片.jpg');
  assert.equal(prepared.formSpu, 'MATERIAL-NEXT');
  await settle(page, 'MATERIAL-ORIGINAL');
  await settle(page, 'MATERIAL-BLOCKER-B');
  await waitDraftStatus(page, id, 'succeeded');
});

test('failed local persistence never clears the current form or starts a background upload', { timeout: 30_000 }, async t => {
  const { page } = await createHarness(t);
  const result = await page.evaluate(async () => {
    els.spu.value = 'KEEP-FORM';
    state.queriedSpu = 'KEEP-FORM';
    selectedListingGroups = () => [{ shop: 'TEST-US', parentAsin: 'KEEP-PARENT', asins: ['KEEP-CHILD'], sidMsku: [], rows: [] }];
    collectGalleryFiles = () => [{ file: new File(['retain-me'], 'original.jpg'), isImage: false, path: 'retain.jpg' }];
    collectAPlusFiles = () => [];
    collectBrandFiles = () => [];
    currentGalleryValidationErrors = () => [];
    galleryCoverageValidationErrors = () => [];
    currentAPlusValidationErrors = () => [];
    currentImageValidationErrors = async () => [];
    saveUploadDraft = async () => { throw new DOMException('Simulated disk quota exceeded', 'QuotaExceededError'); };
    await uploadFeishuTask();
    return { formSpu: els.spu.value, requests: queueTest.calls.length, jobs: state.uploadJobs.size,
      unlocked: !state.feishuTaskInFlight && !els.uploadFeishuTask.disabled, message: els.feishuTaskStatus.textContent };
  });
  assert.equal(result.formSpu, 'KEEP-FORM');
  assert.equal(result.requests, 0);
  assert.equal(result.jobs, 0);
  assert.equal(result.unlocked, true);
  assert.match(result.message, /保存|缓存/);
});

test('the same Listing is serialized while unrelated Listings can upload concurrently', { timeout: 30_000 }, async t => {
  const { page } = await createHarness(t);
  await enqueue(page, 'LISTING-FIRST', 'SAME-PARENT');
  await waitCalls(page, 1);
  await enqueue(page, 'LISTING-SECOND', 'SAME-PARENT');
  await enqueue(page, 'LISTING-OTHER', 'OTHER-PARENT');
  await waitCalls(page, 2);
  assert.deepEqual(await page.evaluate(() => queueTest.calls.map(call => call.spu)), ['LISTING-FIRST', 'LISTING-OTHER']);
  await settle(page, 'LISTING-FIRST');
  await waitDraftStatus(page, 'LISTING-FIRST', 'succeeded');
  await waitCalls(page, 3);
  assert.equal(await page.evaluate(() => queueTest.calls[2].spu), 'LISTING-SECOND');
  await settle(page, 'LISTING-SECOND');
  await settle(page, 'LISTING-OTHER');
});

test('uncertain prior completion blocks a later write to the same Listing', { timeout: 30_000 }, async t => {
  const { page } = await createHarness(t);
  await enqueue(page, 'UNCERTAIN-FIRST', 'PENDING-PARENT');
  await waitCalls(page, 1);
  await enqueue(page, 'UNCERTAIN-SECOND', 'PENDING-PARENT');
  await settle(page, 'UNCERTAIN-FIRST', '后台结果待确认，请先查询状态', true);
  await waitDraftStatus(page, 'UNCERTAIN-FIRST', 'pending');
  await enqueue(page, 'UNCERTAIN-OTHER', 'OTHER-PARENT');
  await page.waitForFunction(() => queueTest.calls.some(call => call.spu === 'UNCERTAIN-OTHER'));
  await settle(page, 'UNCERTAIN-OTHER');
  await waitDraftStatus(page, 'UNCERTAIN-OTHER', 'succeeded');
  assert.equal(await page.evaluate(() => queueTest.calls.some(call => call.spu === 'UNCERTAIN-SECOND')), false);
  assert.ok(await page.evaluate(async () => Boolean((await readUploadDraft('UNCERTAIN-SECOND'))?.galleryZip?.blob)));
});

test('two tabs cannot submit the same cached draft twice', { timeout: 30_000 }, async t => {
  const { page, context } = await createHarness(t);
  const secondPage = await createPage(context);
  await enqueue(page, 'SHARED-DRAFT');
  await waitCalls(page, 1);
  await secondPage.evaluate(async () => {
    const draft = await readUploadDraft('SHARED-DRAFT');
    queueTest.jobs['SHARED-DRAFT'] = enqueueUploadDraft(draft, authToken());
  });
  await secondPage.evaluate(() => renderUploadDrafts());
  assert.equal(await secondPage.evaluate(() => queueTest.calls.length), 0);
  await settle(page, 'SHARED-DRAFT');
  await waitDraftStatus(page, 'SHARED-DRAFT', 'succeeded');
  await waitDraftStatus(secondPage, 'SHARED-DRAFT', 'succeeded');
  // Explicit retry must also honor the persisted success result, not replay it.
  await secondPage.evaluate(async () => { await retryUploadDraft('SHARED-DRAFT'); });
  assert.equal(await secondPage.evaluate(() => queueTest.calls.length), 0);
});

test('the same Listing is also protected across tabs without blocking an unrelated Listing', { timeout: 30_000 }, async t => {
  const { page, context } = await createHarness(t);
  const secondPage = await createPage(context);
  await enqueue(page, 'CROSS-TAB-FIRST', 'CROSS-TAB-PARENT');
  await waitCalls(page, 1);
  await enqueue(secondPage, 'CROSS-TAB-SECOND', 'CROSS-TAB-PARENT');
  await enqueue(secondPage, 'CROSS-TAB-OTHER', 'INDEPENDENT-PARENT');
  await waitCalls(secondPage, 1);
  assert.deepEqual(await secondPage.evaluate(() => queueTest.calls.map(call => call.spu)), ['CROSS-TAB-OTHER']);
  await settle(page, 'CROSS-TAB-FIRST');
  await waitDraftStatus(page, 'CROSS-TAB-FIRST', 'succeeded');
  await waitCalls(secondPage, 2);
  assert.equal(await secondPage.evaluate(() => queueTest.calls[1].spu), 'CROSS-TAB-SECOND');
  await settle(secondPage, 'CROSS-TAB-SECOND');
  await settle(secondPage, 'CROSS-TAB-OTHER');
});

test('retrying an existing packaged draft does not rewrite its large cached ZIP', { timeout: 30_000 }, async t => {
  const { page } = await createHarness(t);
  await enqueue(page, 'RETRY-PACKAGED');
  await waitCalls(page, 1);
  await settle(page, 'RETRY-PACKAGED', 'Retryable network failure');
  await waitDraftStatus(page, 'RETRY-PACKAGED', 'failed');
  await page.evaluate(async () => {
    const originalSave = saveUploadDraft;
    saveUploadDraft = async draft => {
      if (draft.galleryZip?.blob) throw new DOMException('Large cached ZIP must not be rewritten', 'AbortError');
      return originalSave(draft);
    };
    await retryUploadDraft('RETRY-PACKAGED');
  });
  await waitCalls(page, 2);
  await settle(page, 'RETRY-PACKAGED');
  await waitDraftStatus(page, 'RETRY-PACKAGED', 'succeeded');
  assert.equal(await page.evaluate(async () => Boolean((await readUploadDraft('RETRY-PACKAGED'))?.galleryZip)), false);
});

test('switching owner pauses queued work and hides the previous account drafts', { timeout: 30_000 }, async t => {
  const { page } = await createHarness(t);
  await enqueue(page, 'OWNER-ACTIVE-A');
  await enqueue(page, 'OWNER-ACTIVE-B');
  await enqueue(page, 'OWNER-WAITING');
  await waitCalls(page, 2);
  await page.evaluate(() => {
    state.authToken = 'different-owner-token';
    state.authOwner = 'person-b';
  });
  await settle(page, 'OWNER-ACTIVE-A');
  await settle(page, 'OWNER-ACTIVE-B');
  await page.waitForFunction(() => {
    const waiting = state.uploadJobs.get('OWNER-WAITING');
    return state.uploadWorkers === 0 && waiting && (waiting.paused || !waiting.enqueued);
  });
  await page.evaluate(() => renderUploadDrafts());
  assert.equal(await page.locator('#uploadDraftList .upload-draft').count(), 0);
  assert.equal(await page.evaluate(async () => readUploadDraft('OWNER-WAITING')), null);
  await page.evaluate(() => {
    state.authToken = 'queue-browser-test-token';
    state.authOwner = 'person-a';
  });
  await waitDraftStatus(page, 'OWNER-ACTIVE-A', 'succeeded');
  await waitDraftStatus(page, 'OWNER-ACTIVE-B', 'succeeded');
  assert.equal(await page.evaluate(() => queueTest.calls.some(call => call.spu === 'OWNER-WAITING')), false);
  assert.ok(await page.evaluate(async () => Boolean((await readUploadDraft('OWNER-WAITING'))?.galleryZip?.blob)));
});

test('reload shows recoverable drafts without automatically replaying business writes', { timeout: 30_000 }, async t => {
  const { page, writes } = await createHarness(t);
  await enqueue(page, 'RELOAD-ACTIVE-A');
  await enqueue(page, 'RELOAD-ACTIVE-B');
  await enqueue(page, 'RELOAD-WAITING');
  await waitCalls(page, 2);
  await page.reload();
  await page.evaluate(async () => {
    state.authToken = 'queue-browser-test-token';
    state.authOwner = 'person-a';
    await renderUploadDrafts();
  });
  assert.equal(await page.locator('#uploadDraftList .upload-draft').count(), 3);
  assert.equal(await page.evaluate(() => state.uploadJobs.size), 0);
  assert.equal(writes.length, 0);
});
