const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/tools/upload-tool.html'), 'utf8');

function sourceBetween(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing validation source: ${start}`);
  return html.slice(from, to);
}

const pairSource = sourceBetween(
  'function currentAPlusPairValidationErrors()',
  'function currentAPlusValidationErrors()',
);
const dimensionSource = sourceBetween(
  'function dimensionError(',
  'async function hasJpegSignature(',
);
const galleryParseSource = sourceBetween(
  'async function parseGalleryEntry(',
  'async function buildGalleryInitialAssignment(',
);

function pairErrors(components) {
  return vm.runInNewContext(`${pairSource}\ncurrentAPlusPairValidationErrors()`, {
    activeAPlusComponents: () => components,
  });
}

const imageDimensionRule = vm.runInNewContext(
  `${dimensionSource}\nimageDimensionRule`,
);

async function parseGalleryFile(name, spu = 'SW000701') {
  return vm.runInNewContext(`${galleryParseSource}\nparseGalleryEntry({
    file: { name, type: 'image/jpeg' }, relativePath: name,
  })`, {
    name,
    els: { spu: { value: spu } },
    isImageFile: () => true,
    validateImageAsset: async () => ({ level: 'ok' }),
  });
}

test('A+ single image requires its matching desktop or mobile image', () => {
  const component = {
    type: 'full',
    title: '高级单张图片',
    slots: [
      { platform: '手机端', file: { name: 'mobile.jpg' } },
      { platform: '电脑端', file: null },
    ],
  };
  assert.match(pairErrors([component])[0], /缺少电脑端图片/);
  component.slots[1].file = { name: 'desktop.jpg' };
  assert.equal(pairErrors([component]).length, 0);
});

test('A+ carousel requires pairs at the same position, not just equal totals', () => {
  const component = {
    type: 'carousel',
    title: '多图轮播',
    slots: [
      { platform: '手机端', file: { name: 'mobile-1.jpg' } },
      { platform: '手机端', file: null },
      { platform: '电脑端', file: null },
      { platform: '电脑端', file: { name: 'desktop-2.jpg' } },
    ],
  };
  const errors = pairErrors([component]);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /第 1 组缺少电脑端图片/);
  assert.match(errors[1], /第 2 组缺少手机端图片/);
});

test('unused A+ image groups and video modules need no image pair', () => {
  assert.equal(pairErrors([
    { type: 'full', title: '高级单张图片', slots: [
      { platform: '手机端', file: null }, { platform: '电脑端', file: null },
    ] },
    { type: 'video', title: '高级视频', slots: [{ role: 'video', file: { name: 'video.mp4' } }] },
  ]).length, 0);
});

test('brand media height accepts 453px and rejects 452px', () => {
  const rule = imageDimensionRule({ name: 'media.jpg' }, {
    kind: 'brand', assetType: 'brandMedia',
  });
  assert.match(rule(800, 452).message, /最小高度为453px/);
  assert.equal(rule(800, 453), null);
  assert.match(rule(800, 5001).message, /最大高度为5000px/);
  assert.equal(imageDimensionRule({ name: 'hero.jpg' }, {
    kind: 'brand', assetType: 'brandHero',
  })(800, 452), null);
});

test('gallery folder import accepts the selected SPU instead of only LLW names', async () => {
  const matched = await parseGalleryFile('SW000701_R(2).jpg');
  assert.equal(matched.color, 'R');
  assert.equal(matched.order, 2);
  assert.equal(matched.role, 'other');
  const unrelated = await parseGalleryFile('LLW000701_R.jpg');
  assert.equal(unrelated.ignored, true);
  assert.match(unrelated.reason, /当前 SPU/);
});
