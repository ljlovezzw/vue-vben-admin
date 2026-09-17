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
