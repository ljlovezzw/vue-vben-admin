// Execute the real Vue SFC loaders with synthetic deferred API responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const { ref, watch } = require('vue');

const source = fs.readFileSync(path.join(__dirname, '../src/views/kanban/asin360/index.vue'), 'utf8');
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const tree = ts.createSourceFile('asin360.ts', script, ts.ScriptTarget.Latest, true);
const names = new Set([
  'overviewParams', 'overviewRequestKey', 'sectionParams', 'sectionRequestKey',
  'afterSaleParams', 'afterSaleRequestKey', 'afterSaleDateSummaryType', 'isAbortError',
  'resetDataRequests', 'isCurrentOverview', 'loadData', 'loadModuleData', 'loadAfterSaleData', 'refreshData',
]);
const nodes = tree.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) ||
  (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) &&
    ['watch', 'onBeforeUnmount'].includes(node.expression.expression.getText(tree))),
);
assert.equal(nodes.filter(ts.isFunctionDeclaration).length, names.size);
const compiled = ts.transpileModule(nodes.map(node => node.getText(tree)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const result = parentAsin => ({ items: [{ parentAsin }] });
const sectionResult = (key, parent) => ({ items: [{ data: { [key]: { source: parent } } }] });

function harness(t) {
  const overview = ref(result('A'));
  const startDate = ref('2026-08-01');
  const cleanup = [];
  const errors = [];
  const ctx = {
    AbortController, clearTimeout, console: { error: error => errors.push(error) },
    overview, currentItem: { get value() { return overview.value?.items[0] ?? null; } },
    parentAsinInput: ref('A'), selectedSids: ref(['1039']), tablePagination: { current: 1 },
    loading: ref(false), afterSaleLoading: ref(false), moduleTab: ref('overview'),
    afterSaleRemoteAnalysis: ref(null), afterSaleAnalysis: { get value() { return ctx.afterSaleRemoteAnalysis.value ?? {}; } },
    afterSaleTimeDim: ref('day'), afterSaleDateKind: ref('return'), afterSaleKind: ref('return'),
    overviewCache: new Map(), sectionCache: new Map(), OVERVIEW_CACHE_TTL: 60000,
    activeRequestKey: '', activeRequestController: null, requestVersion: 0,
    activeSectionKey: '', activeSectionController: null, sectionRequestVersion: 0,
    activeAfterSaleKey: '', activeAfterSaleController: null, afterSaleRequestVersion: 0,
    loadedOverviewKey: '', disposed: false, loadTimer: undefined,
    parseList: value => value.trim() ? value.split(',') : [],
    rangeParams: () => ({ startDate: startDate.value, endDate: '2026-08-30' }),
    sectionForModule: name => name === 'overview' ? undefined : name,
    fetchAsin360Overview: async params => result(params.parent_ASIN),
    fetchAsin360Section: async () => ({ items: [] }),
    watch: (...args) => cleanup.push(watch(...args)),
    onBeforeUnmount: fn => { ctx.unmount = fn; },
  };
  vm.createContext(ctx);
  vm.runInContext(compiled, ctx);
  ctx.loadedOverviewKey = ctx.overviewRequestKey(ctx.overviewParams());
  t.after(() => { ctx.unmount(); cleanup.forEach(stop => stop()); });
  return { ctx, startDate, errors };
}

test('old section response cannot contaminate the next product', async t => {
  const { ctx } = harness(t);
  const old = deferred();
  ctx.fetchAsin360Section = () => old.promise;
  const pending = ctx.loadModuleData('profit');
  const signal = ctx.activeSectionController.signal;
  ctx.parentAsinInput.value = 'B';
  assert.equal(signal.aborted, true);
  await ctx.loadData();
  old.resolve(sectionResult('profitAnalysis', 'A'));
  await pending;
  assert.equal(ctx.currentItem.value.parentAsin, 'B');
  assert.equal(ctx.currentItem.value.profitAnalysis, undefined);
});

test('cached overview invalidates a pending network overview and resets loading', async t => {
  const { ctx } = harness(t);
  const old = deferred();
  ctx.fetchAsin360Overview = () => old.promise;
  const pending = ctx.loadData();
  ctx.parentAsinInput.value = 'B';
  ctx.overviewCache.set(ctx.overviewRequestKey(ctx.overviewParams()), { data: result('B'), expiresAt: Date.now() + 60000 });
  await ctx.loadData();
  assert.equal(ctx.loading.value, false);
  old.resolve(result('A'));
  await pending;
  assert.equal(ctx.currentItem.value.parentAsin, 'B');
});

test('old after-sale response cannot overwrite a cached new product', async t => {
  const { ctx } = harness(t);
  ctx.afterSaleRemoteAnalysis.value = { source: 'previous' };
  const old = deferred();
  ctx.fetchAsin360Section = () => old.promise;
  const pending = ctx.loadAfterSaleData();
  const signal = ctx.activeAfterSaleController.signal;
  ctx.parentAsinInput.value = 'B';
  ctx.overviewCache.set(ctx.overviewRequestKey(ctx.overviewParams()), { data: result('B'), expiresAt: Date.now() + 60000 });
  await ctx.loadData();
  old.resolve({ items: [{ data: { source: 'A' } }] });
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(ctx.afterSaleRemoteAnalysis.value, null);
  assert.equal(ctx.afterSaleLoading.value, false);
});

test('section cache hit invalidates an earlier section for the same product', async t => {
  const { ctx } = harness(t);
  const old = deferred();
  ctx.fetchAsin360Section = () => old.promise;
  const pending = ctx.loadModuleData('profit', { force: true });
  const signal = ctx.activeSectionController.signal;
  // A cached different section must invalidate the pending section as well.
  ctx.sectionCache.set(ctx.sectionRequestKey(ctx.sectionParams('inventory')), {
    data: { inventoryAnalysis: { source: 'cached' } }, expiresAt: Date.now() + 60000,
  });
  await ctx.loadModuleData('inventory');
  old.resolve(sectionResult('profitAnalysis', 'late'));
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(ctx.currentItem.value.profitAnalysis, undefined);
  assert.equal(ctx.currentItem.value.inventoryAnalysis.source, 'cached');
});

for (const field of ['date', 'store', 'empty parent']) {
  test(`${field} input change invalidates during the debounce window`, async t => {
    const { ctx, startDate } = harness(t);
    const old = deferred();
    ctx.fetchAsin360Overview = () => old.promise;
    const pending = ctx.loadData();
    if (field === 'date') startDate.value = '2026-08-02';
    else if (field === 'store') ctx.selectedSids.value = ['2'];
    else ctx.parentAsinInput.value = '';
    old.resolve(result('A'));
    await pending;
    assert.equal(ctx.currentItem.value, null);
    assert.equal(ctx.loading.value, false);
  });
}

test('current section and after-sale responses still load successfully', async t => {
  const { ctx } = harness(t);
  ctx.fetchAsin360Section = async params => params.section === 'after-sale'
    ? { items: [{ data: { source: 'current after-sale' } }] }
    : sectionResult('profitAnalysis', 'A');
  await ctx.loadModuleData('profit');
  assert.equal(ctx.currentItem.value.profitAnalysis.source, 'A');
  await ctx.loadAfterSaleData();
  assert.equal(ctx.afterSaleRemoteAnalysis.value.source, 'current after-sale');
});

test('after-sale filters are checked again before applying a response', async t => {
  const { ctx } = harness(t);
  const old = deferred();
  ctx.fetchAsin360Section = () => old.promise;
  const pending = ctx.loadAfterSaleData();
  ctx.afterSaleKind.value = 'refund';
  old.resolve({ items: [{ data: { source: 'return' } }] });
  await pending;
  assert.equal(ctx.afterSaleRemoteAnalysis.value, null);
});

test('refreshing a new product from after-sale loads its overview before the section', async t => {
  const { ctx } = harness(t);
  ctx.moduleTab.value = 'afterSale';
  ctx.parentAsinInput.value = 'B';
  ctx.fetchAsin360Section = async params => ({ items: [{ data: { source: params.parent_ASIN } }] });
  await ctx.refreshData();
  assert.equal(ctx.currentItem.value.parentAsin, 'B');
  assert.equal(ctx.afterSaleRemoteAnalysis.value.source, 'B');
});

test('unmount cancels requests and prevents late state writes or errors', async t => {
  const { ctx, errors } = harness(t);
  const old = deferred();
  ctx.fetchAsin360Overview = () => old.promise;
  const pending = ctx.loadData();
  const signal = ctx.activeRequestController.signal;
  ctx.unmount();
  old.reject(new Error('late response'));
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(ctx.currentItem.value, null);
  assert.deepEqual(errors, []);
});
