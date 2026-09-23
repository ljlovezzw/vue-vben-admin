const assert = require('node:assert/strict');
const { createHash, webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/tools/upload-tool.html'), 'utf8');
function section(start, end) {
  const offset = html.indexOf(start);
  const limit = html.indexOf(end, offset);
  assert.ok(offset >= 0 && limit > offset, `missing script section: ${start}`);
  return html.slice(offset, limit);
}
function runtime() {
  const storage = new Map();
  const ctx = vm.createContext({
    Blob, Uint8Array, Uint32Array, TextEncoder, AbortController,
    crypto: webcrypto,
    location: { hostname: 'localhost' },
    sessionStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    setTimeout: (callback, delay) => { if (delay <= 2000) queueMicrotask(callback); return 1; },
    clearTimeout() {},
    setFeishuTaskStatus() {},
    setUploadPhase() {},
    fetch: async () => { throw new Error('unexpected network request'); },
  });
  vm.runInContext([
    section('    const BACKEND_UPLOAD_CHUNK_SIZE', '    function activeAPlusComponents('),
    section('    function imageFlagRecord(', '    function renderGalleryPool('),
    section('    function crc32Table(', '    function utf16LeNullTerminated('),
    section('    async function buildZip(', '    async function downloadZip('),
    section('    function adler32(', '    async function gpsrImageUploadFile('),
    section('    function feishuTaskApiBaseUrl(', '    function taskLogStatusText('),
    section('    async function readJsonResponse(', '    async function requestFeishuEdgeTicket('),
    section('    async function pollBackendUploadTask(', '    async function uploadFeishuTaskViaBackend('),
    section('    async function uploadFeishuTaskViaBackend(', '    async function uploadFeishuTask('),
  ].join('\n'), ctx);
  return ctx;
}
const meta = [{ shop: 'test', spu: 'test', parentAsin: 'B000000001', asins: ['B000000002'] }];

test('upload type and holiday name separate otherwise identical submissions', async () => {
  const ctx = runtime();
  const file = [{ key: 'aplusZip', filename: 'a.zip', contentFingerprint: 'same-content' }];
  const regular = await ctx.submissionCacheKey(meta, file);
  const holiday = await ctx.submissionCacheKey(
    [{ ...meta[0], uploadType: 'holiday', holidayName: '圣诞节' }], file,
  );
  assert.notEqual(regular, holiday);
  assert.match(html, /<option value="regular" selected>常规<\/option>/);
  assert.match(html, /<option value="holiday">节日<\/option>/);
});

test('ZIP filenames contain the first 16 MD5 characters of actual ZIP bytes', async () => {
  const ctx = runtime();
  for (const length of [0, 1, 55, 56, 63, 64, 65, 4096]) {
    const bytes = Buffer.alloc(length, 0x61);
    assert.equal(ctx.md5Hex(bytes), createHash('md5').update(bytes).digest('hex'));
  }
  ctx.preparedZipEntries = async entries => entries;
  ctx.sourceFilesFingerprint = async () => 'source-fingerprint';
  const first = await ctx.buildUploadZip(
    [{ path: 'same/a.txt', file: new Blob(['first']) }], 'same', { includeImageFlags: false },
  );
  const second = await ctx.buildUploadZip(
    [{ path: 'same/a.txt', file: new Blob(['second']) }], 'same', { includeImageFlags: false },
  );
  const expected = createHash('md5').update(Buffer.from(await first.blob.arrayBuffer())).digest('hex');
  assert.equal(first.filename, `same_${expected.slice(0, 16)}.zip`);
  assert.match(second.filename, /^same_[0-9a-f]{16}\.zip$/);
  assert.notEqual(first.filename, second.filename);
  assert.equal(await ctx.zipFilenameWithMd5('same', first.blob), first.filename);
  assert.equal(await ctx.zipFilenameWithMd5(`same_${expected}`, first.blob), first.filename);
});

test('same A+ images produce identical ZIP bytes and keys across time and selection order', async () => {
  const ctx = runtime();
  const entries = ['a', 'b'].map(name => ({ path: `aplus/${name}.jpg`, file: new Blob([name]), isImage: true }));
  async function build(items) {
    const flagged = ctx.withImageFlagJson(items, 'aplus');
    const blob = await ctx.buildZip(flagged);
    const prepared = await ctx.prepareUploadZipFile({ blob, filename: 'a.zip', key: 'aplusZip' });
    return { bytes: Buffer.from(await blob.arrayBuffer()), key: await ctx.submissionCacheKey(meta, [prepared]) };
  }
  const first = await build(entries);
  vm.runInContext('Date = class extends Date { constructor(...args) { super(...(args.length ? args : [1900000000000])); } }', ctx);
  const second = await build([...entries].reverse());
  assert.deepEqual(first, second);
  entries[0].aiGenerated = true;
  const changed = await build(entries);
  assert.notEqual(first.key, changed.key);
  assert.notDeepEqual(first.bytes, changed.bytes);
});

test('unknown server progress stops without retransmitting', async () => {
  const ctx = runtime();
  let posts = 0;
  ctx.fetch = async () => { posts++; throw new TypeError('response lost'); };
  await assert.rejects(ctx.fetchJsonWithRetry('/chunks', {}, 'chunk', {
    confirmCompletion: async () => { throw new Error('progress offline'); },
  }), error => error.uploadPending === true);
  assert.equal(posts, 1);
});

test('persisted chunk with lost response is confirmed without retransmitting', async () => {
  const ctx = runtime();
  let posts = 0;
  ctx.fetch = async () => { posts++; throw new TypeError('response lost'); };
  const confirmed = { data: { files: { galleryZip: { uploaded: [0] } } } };
  assert.equal(await ctx.fetchJsonWithRetry('/chunks', {}, 'chunk', {
    confirmCompletion: async () => confirmed,
  }), confirmed);
  assert.equal(posts, 1);
});

test('confirmed missing chunk is retransmitted', async () => {
  const ctx = runtime();
  let posts = 0;
  ctx.fetch = async () => {
    if (++posts === 1) throw new TypeError('connection lost');
    return { ok: true, text: async () => '{"data":{"uploaded":true}}' };
  };
  const result = await ctx.fetchJsonWithRetry('/chunks', {}, 'chunk', { confirmCompletion: async () => null });
  assert.equal(result.data.uploaded, true);
  assert.equal(posts, 2);
});

test('malformed progress is unknown, not proof of missing chunks', async () => {
  const ctx = runtime();
  ctx.fetch = async () => ({ ok: true, text: async () => '{"data":{}}' });
  await assert.rejects(ctx.confirmBackendChunkProgress('abc', 'galleryZip', 0, 'token'));
});

test('polling tolerates a dropped response and returns the original task result', async () => {
  const ctx = runtime();
  let calls = 0;
  ctx.fetch = async () => {
    if (++calls === 1) throw new TypeError('offline');
    return { ok: true, text: async () => '{"data":{"status":"succeeded","result":{"recordId":"original"}}}' };
  };
  const result = await ctx.pollBackendUploadTask('task1', 'key1', 'token');
  assert.equal(result.data.recordId, 'original');
  assert.equal(calls, 2);
  assert.equal(ctx.readFeishuTaskCache('pending:key1'), null);
});

test('long polling outage retains task ID and resumes after connectivity returns', async () => {
  const ctx = runtime();
  ctx.fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(ctx.pollBackendUploadTask('task1', 'key1', 'token'), error => error.uploadPending === true);
  assert.equal(ctx.readFeishuTaskCache('pending:key1').taskId, 'task1');
  ctx.fetch = async () => ({ ok: true, text: async () => '{"data":{"status":"succeeded","result":{"recordId":"original"}}}' });
  const result = await ctx.pollBackendUploadTask(ctx.readFeishuTaskCache('pending:key1').taskId, 'key1', 'token');
  assert.equal(result.data.recordId, 'original');
});

test('only an explicit failed task is reported as execution failure', async () => {
  const ctx = runtime();
  ctx.fetch = async () => ({ ok: true, text: async () => '{"data":{"status":"failed","error":"upstream rejected"}}' });
  await assert.rejects(ctx.pollBackendUploadTask('task1', 'key1', 'token'), error => !error.uploadPending && /upstream rejected/.test(error.message));
  assert.equal(ctx.readFeishuTaskCache('pending:key1'), null);
});

test('resubmission with a retained task only polls, without uploading or creating a session', async () => {
  const ctx = runtime();
  const zip = { blob: new Blob(['zip']), filename: 'a.zip' };
  const prepared = await ctx.prepareUploadZipFile({ ...zip, key: 'aplusZip' });
  const cacheKey = await ctx.taskResultCacheKey(await ctx.submissionCacheKey(meta, [prepared]), 'token');
  ctx.writeFeishuTaskCache(`pending:${cacheKey}`, { taskId: 'original' });
  const urls = [];
  ctx.fetch = async url => {
    urls.push(url);
    return { ok: true, text: async () => '{"data":{"status":"succeeded","result":{"recordId":"original"}}}' };
  };
  const result = await ctx.uploadFeishuTaskViaBackend(meta, null, zip, null, null, 'token');
  assert.equal(result.data.recordId, 'original');
  assert.equal(urls.length, 1);
  assert.match(urls[0], /image-upload-tasks\/original$/);
});

test('a confirmed failed retained task starts a new upload in the same retry', async () => {
  const ctx = runtime();
  const zip = { blob: new Blob(['zip']), filename: 'a.zip' };
  const prepared = await ctx.prepareUploadZipFile({ ...zip, key: 'aplusZip' });
  const cacheKey = await ctx.taskResultCacheKey(await ctx.submissionCacheKey(meta, [prepared]), 'token');
  ctx.writeFeishuTaskCache(`pending:${cacheKey}`, { taskId: 'failed-original' });
  const urls = [];
  ctx.fetch = async url => {
    urls.push(url);
    const body = url.endsWith('/failed-original')
      ? { data: { status: 'failed', error: 'expired credentials' } }
      : url.endsWith('image-upload-sessions')
        ? { data: { uploadId: 'fresh-session', files: { aplusZip: { uploaded: [0] } } } }
        : url.endsWith('/finish')
          ? { data: { taskId: 'new-task' } }
          : { data: { status: 'succeeded', result: { recordId: 'new-record' } } };
    return { ok: true, text: async () => JSON.stringify(body) };
  };
  const result = await ctx.uploadFeishuTaskViaBackend(meta, null, zip, null, null, 'token');
  assert.equal(result.data.recordId, 'new-record');
  assert.equal(urls.filter(url => url.endsWith('image-upload-sessions')).length, 1);
  assert.equal(urls.some(url => url.endsWith('/chunks')), false);
});

test('server-retained finished session recovers original task without sending chunks', async () => {
  const ctx = runtime();
  const urls = [];
  ctx.fetch = async url => {
    urls.push(url);
    const body = url.endsWith('image-upload-sessions')
      ? { data: { uploadId: 'abc123', finishedResult: { taskId: 'original' } } }
      : { data: { status: 'succeeded', result: { recordId: 'original' } } };
    return { ok: true, text: async () => JSON.stringify(body) };
  };
  const result = await ctx.uploadFeishuTaskViaBackend(meta, null, { blob: new Blob(['zip']), filename: 'a.zip' }, null, null, 'new-token');
  assert.equal(result.data.recordId, 'original');
  assert.equal(urls.length, 2);
  assert.equal(urls.some(url => /\/(chunks|finish)$/.test(url)), false);
});

function networkJob(draft = {}) {
  return {
    draft,
    controller: new AbortController(),
    messages: [],
    report(message, type, progress) { this.messages.push({ message, type, progress }); },
    phase(phase, message) { this.messages.push({ phase, message }); },
    async persist(patch) { this.draft = { ...this.draft, ...patch }; },
  };
}

function guardContext(ctx) {
  ctx.assertUploadJobCurrent = job => {
    if (job.controller.signal.aborted) {
      const error = new Error('owner changed');
      error.uploadPending = true;
      throw error;
    }
  };
}

test('context abort cancels the in-flight request and does not retry', async () => {
  const ctx = runtime();
  guardContext(ctx);
  const job = networkJob();
  let calls = 0;
  ctx.fetch = async (_url, options) => {
    calls++;
    job.controller.abort();
    assert.equal(options.signal.aborted, true);
    throw new Error('aborted');
  };
  await assert.rejects(
    ctx.fetchJsonWithRetry('/a', {}, 'A', {}, job),
    error => error.uploadPending === true,
  );
  assert.equal(calls, 1);
});

test('parallel retries report only to their own contexts', async () => {
  const ctx = runtime();
  guardContext(ctx);
  const first = networkJob();
  const second = networkJob();
  const counts = {};
  ctx.setFeishuTaskStatus = () => { throw new Error('global progress is forbidden'); };
  ctx.fetch = async url => {
    counts[url] = (counts[url] || 0) + 1;
    if (counts[url] === 1) throw new Error('temporary');
    return { ok: true, text: async () => '{"ok":true}' };
  };
  await Promise.all([
    ctx.fetchJsonWithRetry('/a', {}, 'A', {}, first),
    ctx.fetchJsonWithRetry('/b', {}, 'B', {}, second),
  ]);
  assert.deepEqual(counts, { '/a': 2, '/b': 2 });
  assert.equal(first.messages.length, 1);
  assert.match(first.messages[0].message, /^A/);
  assert.equal(second.messages.length, 1);
  assert.match(second.messages[0].message, /^B/);
});

test('durable task ID is queried without creating an upload session', async () => {
  const ctx = runtime();
  guardContext(ctx);
  const job = networkJob({ taskId: 'durable' });
  const urls = [];
  ctx.fetch = async url => {
    urls.push(url);
    return { ok: true, text: async () => '{"data":{"status":"succeeded","result":{"recordId":"saved"}}}' };
  };
  const result = await ctx.uploadFeishuTaskViaBackend(
    meta, null, { blob: new Blob(['zip']), filename: 'a.zip' }, null, null, 'token', job,
  );
  assert.equal(result.data.recordId, 'saved');
  assert.equal(urls.length, 1);
  assert.match(urls[0], /image-upload-tasks\/durable$/);
});

test('durable upload session resumes the original accepted task', async () => {
  const ctx = runtime();
  guardContext(ctx);
  const job = networkJob({ uploadId: 'session-original' });
  const requests = [];
  ctx.fetch = async (url, options) => {
    requests.push({ url, method: options.method || 'GET' });
    const data = url.endsWith('/session-original')
      ? { data: { uploadId: 'session-original', finished: true, finishedResult: { taskId: 'task-original' } } }
      : { data: { status: 'succeeded', result: { recordId: 'saved' } } };
    return { ok: true, text: async () => JSON.stringify(data) };
  };
  const result = await ctx.uploadFeishuTaskViaBackend(
    meta, null, { blob: new Blob(['zip']), filename: 'a.zip' }, null, null, 'token', job,
  );
  assert.equal(result.data.recordId, 'saved');
  assert.equal(job.draft.taskId, 'task-original');
  assert.equal(requests.length, 2);
  assert.equal(requests.every(request => request.method === 'GET'), true);
  assert.match(requests[0].url, /image-upload-sessions\/session-original$/);
  assert.match(requests[1].url, /image-upload-tasks\/task-original$/);
});

test('failure to persist an accepted task remains pending, not retryable failure', async () => {
  const ctx = runtime();
  guardContext(ctx);
  const job = networkJob();
  job.persist = async () => { throw new Error('quota'); };
  await assert.rejects(
    ctx.pollBackendUploadTask('accepted', 'key', 'token', job),
    error => error.uploadPending === true && error.cause?.message === 'quota',
  );
});

test('malformed finish response remains pending with the upload session retained', async () => {
  const ctx = runtime();
  guardContext(ctx);
  const job = networkJob();
  const urls = [];
  ctx.fetch = async url => {
    urls.push(url);
    const data = url.endsWith('image-upload-sessions')
      ? { data: { uploadId: 'retained', files: { aplusZip: { uploaded: [0] } } } }
      : { data: {} };
    return { ok: true, text: async () => JSON.stringify(data) };
  };
  await assert.rejects(
    ctx.uploadFeishuTaskViaBackend(
      meta, null, { blob: new Blob(['zip']), filename: 'a.zip' }, null, null, 'token', job,
    ),
    error => error.uploadPending === true,
  );
  assert.equal(job.draft.uploadId, 'retained');
  assert.equal(urls.length, 2);
  assert.equal(urls.filter(url => url.endsWith('/finish')).length, 1);
});

test('unknown edge record creation is blocked from blind re-submission', async () => {
  const ctx = runtime();
  guardContext(ctx);
  const job = networkJob();
  let creates = 0;
  let requests = 0;
  ctx.formatBytes = () => '3B';
  vm.runInContext(
    section('    async function requestFeishuEdgeTicket(', '    function shouldUseBackendGalleryUpload('),
    ctx,
  );
  ctx.fetch = async url => {
    requests++;
    if (url.endsWith('/from-tokens')) {
      creates++;
      throw new Error('response lost');
    }
    const data = url.endsWith('/upload-small')
      ? { receipt: 'receipt' }
      : { data: { ticket: 'ticket', uploadBaseUrl: 'https://edge.test' } };
    return { ok: true, text: async () => JSON.stringify(data) };
  };
  const upload = () => ctx.uploadFeishuTaskViaEdge(
    meta, null, { blob: new Blob(['zip']), filename: 'a.zip' }, null, null, 'token', job,
  );
  await assert.rejects(upload(), error => error.uploadPending === true);
  assert.equal(job.draft.edgeSubmissionPending, true);
  const requestsBeforeRetry = requests;
  await assert.rejects(upload(), error => error.uploadPending === true);
  assert.equal(creates, 1);
  assert.equal(requests, requestsBeforeRetry);
});

test('resume markers persist without rewriting cached ZIP blobs', async () => {
  const ctx = runtime();
  const markers = new Map();
  ctx.localStorage = {
    getItem: key => markers.get(key) || null,
    setItem: (key, value) => markers.set(key, value),
  };
  ctx.saveUploadDraft = async () => { throw new Error('unexpected ZIP rewrite'); };
  const draft = { id: 'durable', ownerKey: 'user:one', updatedAt: 0,
    galleryZip: { blob: new Blob(['cached']) } };
  const job = ctx.createUploadJob(draft, 'token');
  await job.persist({ taskId: 'task', uploadId: 'session', submissionKey: 'signature', edgeSubmissionPending: true });
  assert.equal(markers.size, 1);
  const marker = JSON.parse([...markers.values()][0]);
  assert.equal(marker.taskId, 'task');
  assert.equal(marker.uploadId, 'session');
  assert.equal(marker.submissionKey, 'signature');
  assert.equal(marker.edgeSubmissionPending, true);
  assert.equal(Object.hasOwn(marker, 'galleryZip'), false);
  const restored = ctx.uploadDraftWithStatus(draft);
  assert.equal(restored.taskId, 'task');
  assert.equal(restored.galleryZip, draft.galleryZip);
});

test('resume marker persistence falls back to IndexedDB if localStorage fails', async () => {
  const ctx = runtime();
  ctx.localStorage = { setItem: () => { throw new Error('quota'); } };
  const writes = [];
  ctx.saveUploadDraft = async draft => { writes.push(draft); };
  const job = ctx.createUploadJob({ id: 'draft', ownerKey: 'user:one' }, 'token');
  await job.persist({ taskId: 'accepted' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].taskId, 'accepted');
  ctx.saveUploadDraft = async () => { throw new Error('both stores unavailable'); };
  await assert.rejects(job.persist({ taskId: 'another' }), /both stores unavailable/);
});

test('asset changes still persist the full draft to IndexedDB', async () => {
  const ctx = runtime();
  const writes = [];
  ctx.saveUploadDraft = async draft => { writes.push(draft); };
  const job = ctx.createUploadJob({ id: 'draft', ownerKey: 'user:one' }, 'token');
  const galleryZip = { blob: new Blob(['prepared']) };
  await job.persist({ galleryZip, preparation: null });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].galleryZip, galleryZip);
  assert.equal(writes[0].preparation, null);
});

test('legacy edge Internal Error retries only attachment requests, not validation or task creation', async () => {
  for (const [message, status, edgeAttachment, expected] of [
    ['上传 a.zip失败: Internal Error', 400, true, 3],
    ['上传 a.zip失败: HTTP 503', 400, true, 3],
    ['上传 a.zip失败: permission denied', 400, true, 1],
    ['上传 a.zip失败: Internal Error', 400, false, 1],
    ['rate limit', 429, true, 3],
    ['forbidden', 403, true, 1],
  ]) {
    const ctx = runtime();
    let attempts = 0;
    ctx.fetch = async () => { attempts++; return { ok: false, status, text: async () => JSON.stringify({ message }) }; };
    await assert.rejects(ctx.fetchJsonWithRetry('/attachment', {}, 'attachment', { retryLimit: 3, edgeAttachment }));
    assert.equal(attempts, expected, message);
  }
});

test('edge attachment resumes after transient failure and stops after bounded attempts', async () => {
  const ctx = runtime();
  let attempts = 0;
  ctx.fetch = async () => ({ ok: ++attempts >= 3, status: attempts < 3 ? 400 : 200,
    text: async () => JSON.stringify(attempts < 3 ? { message: '上传 a.zip失败: Internal Error' } : { receipt: 'ok' }) });
  assert.equal((await ctx.fetchJsonWithRetry('/attachment', {}, 'attachment', { retryLimit: 3, edgeAttachment: true })).receipt, 'ok');
  assert.equal(attempts, 3);
});

test('edge receipt checkpoints survive status updates without rewriting ZIPs', async () => {
  const ctx = runtime();
  const markers = new Map();
  ctx.localStorage = { getItem: key => markers.get(key), setItem: (key, value) => markers.set(key, value) };
  ctx.uploadOwnerIsCurrent = () => false;
  ctx.scheduleUploadTaskRender = () => {};
  const draft = { id: 'edge', ownerKey: 'user:one', updatedAt: 0 };
  const job = ctx.createUploadJob(draft, 'token');
  const edgeCheckpoint = { submissionKey: 'key', ticketData: { ticket: 'opaque' }, receipts: { aplusZip: 'receipt' }, expiresAt: 123 };
  await job.persist({ edgeCheckpoint });
  job.locked = true;
  job.report('saved');
  assert.equal(ctx.uploadDraftWithStatus(draft).edgeCheckpoint.receipts.aplusZip, 'receipt');
});

test('valid edge checkpoint reuses the first receipt after the second file failed, with exactly one task creation', async () => {
  const ctx = runtime(); guardContext(ctx); ctx.formatBytes = () => '3B';
  vm.runInContext(section('    async function requestFeishuEdgeTicket(', '    function shouldUseBackendGalleryUpload('), ctx);
  const job = networkJob(); const counts = { ticket: 0, aplusZip: 0, brandZip: 0, create: 0 };
  let failBrand = true;
  ctx.fetch = async (url, options) => {
    let payload;
    if (url.endsWith('/from-tokens')) {
      counts.create++;
      const body = JSON.parse(options.body);
      assert.equal(body.receipts.aplusZip, 'receipt-aplusZip');
      payload = { data: { recordIds: ['record'], taskCount: 1 } };
    } else if (url.endsWith('/upload-small')) {
      const key = options.headers['X-File-Key']; counts[key]++;
      if (key === 'brandZip' && failBrand) return {ok:false,status:400,text:async()=>'{"message":"上传 b.zip失败: Internal Error"}'};
      payload = { receipt: `receipt-${key}` };
    } else { counts.ticket++; payload = {data:{ticket:'opaque',uploadBaseUrl:'https://edge.test',expiresIn:1800}}; }
    return {ok:true,status:200,text:async()=>JSON.stringify(payload)};
  };
  const upload = () => ctx.uploadFeishuTaskViaEdge(meta, null,
    {blob:new Blob(['aplus']),filename:'a.zip'}, {blob:new Blob(['brand']),filename:'b.zip'}, null, 'token', job);
  await assert.rejects(upload(), /3 次尝试/);
  assert.equal(counts.create, 0);
  failBrand = false;
  await upload();
  assert.deepEqual(counts, {ticket:1,aplusZip:1,brandZip:4,create:1});
  assert.equal(job.draft.edgeCheckpoint, null);
});

test('expired edge receipts are never submitted with a new ticket', async () => {
  const ctx = runtime(); guardContext(ctx); ctx.formatBytes = () => '3B';
  vm.runInContext(section('    async function requestFeishuEdgeTicket(', '    function shouldUseBackendGalleryUpload('), ctx);
  const job = networkJob({edgeCheckpoint:{submissionKey:'obsolete',expiresAt:0,receipts:{aplusZip:'old'}}});
  let tickets = 0; let uploads = 0;
  ctx.fetch = async url => {
    const payload = url.endsWith('/from-tokens') ? {data:{recordIds:['record']}}
      : url.endsWith('/upload-small') ? (++uploads, {receipt:'new'})
      : (++tickets, {data:{ticket:'new-ticket',uploadBaseUrl:'https://edge.test',expiresIn:1800}});
    return {ok:true,status:200,text:async()=>JSON.stringify(payload)};
  };
  await ctx.uploadFeishuTaskViaEdge(meta,null,{blob:new Blob(['zip']),filename:'a.zip'},null,null,'token',job);
  assert.equal(tickets,1); assert.equal(uploads,1);
});

test('diagnostic requests contain only bounded metadata, never tokens or original errors', async () => {
  const ctx = runtime(); ctx.window = {}; ctx.URL = URL; ctx.location.origin='https://test.local';
  const requests=[]; ctx.fetch=async(url, options)=>{requests.push({url:String(url),options});};
  ctx.reportUploadDiagnostic({draft:{id:'draft',spu:'LLW000786',token:'SECRET',receipt:'RECEIPT'}},'edge-small','upstream-internal',400,3);
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/stage=edge-small/);
  assert.doesNotMatch(requests[0].url,/SECRET|RECEIPT/);
  assert.equal(requests[0].options.credentials,'omit');
});
