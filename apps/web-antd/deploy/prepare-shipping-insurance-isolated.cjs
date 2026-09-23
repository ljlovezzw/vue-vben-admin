// Build a frontend candidate from the active production slot without
// rebuilding or replacing unrelated Vue chunks.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const appRoot = path.resolve(__dirname, '..');
const deployRoot = path.join(appRoot, 'dist-production');
const activeConfig = fs.readFileSync(path.join(deployRoot, 'active-root.conf'), 'utf8');
if (!activeConfig.includes('/dist-production/green')) {
  throw new Error('Expected green to be the active production slot');
}
const base = path.join(deployRoot, 'green');
const stage = path.join(deployRoot, 'blue-shipping-candidate-20260918');
const built = 'E:\\kanban-release\\frontend-shipping-source-20260918\\apps\\web-antd\\dist';
if (fs.existsSync(stage)) throw new Error(`Candidate already exists: ${stage}`);
if (!fs.existsSync(path.join(base, 'index.html')) || !fs.existsSync(path.join(built, 'index.html'))) {
  throw new Error('Production base or isolated shipping build is incomplete');
}

const indexHtml = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
const entryMatch = indexHtml.match(/\/jse\/(index-[^"']+\.js)/);
if (!entryMatch) throw new Error('Production entry script was not found');
const entryText = fs.readFileSync(path.join(base, 'jse', entryMatch[1]), 'utf8');
const oldShipping = [...entryText.matchAll(/shipping-[A-Za-z0-9_-]+\.js/g)]
  .map((match) => match[0])
  .filter((name) => !name.startsWith('shipping-location-'));
if (new Set(oldShipping).size !== 1) throw new Error('Production shipping chunk is ambiguous');
const oldShippingName = oldShipping[0];
const newShippingNames = fs.readdirSync(path.join(built, 'js'))
  .filter((name) => /^shipping-[A-Za-z0-9_-]+\.js$/.test(name) && !name.startsWith('shipping-location-'));
if (newShippingNames.length !== 1) throw new Error('Isolated shipping chunk is ambiguous');

const oldChunk = fs.readFileSync(path.join(base, 'js', oldShippingName), 'utf8');
let newChunk = fs.readFileSync(path.join(built, 'js', newShippingNames[0]), 'utf8');
if (!newChunk.includes('不受时效限制') || !newChunk.includes('保险参考日期')) {
  throw new Error('Built shipping chunk lacks the reviewed insurance labels');
}
const importPattern = /import\{([^;]+?)\}from"([^"]+)";/g;
const oldImports = [...oldChunk.matchAll(importPattern)];
const newImports = [...newChunk.matchAll(importPattern)];
if (oldImports.length === 0 || oldImports.length !== newImports.length) {
  throw new Error('Shipping import count does not match the deployed chunk');
}
for (let index = 0; index < oldImports.length; index += 1) {
  const oldImport = oldImports[index];
  const newImport = newImports[index];
  if (oldImport[1] !== newImport[1]) {
    throw new Error(`Shipping import bindings changed at position ${index}`);
  }
  newChunk = newChunk.replace(
    `from"${newImport[2]}";`,
    `from"${oldImport[2]}";`,
  );
}
if (newChunk.includes('index-index-4Xct2Hls.js')) {
  throw new Error('Isolated build entry still appears in the shipping module');
}

const cssMatches = [...entryText.matchAll(/shipping-[A-Za-z0-9_-]+\.css/g)]
  .map((match) => match[0])
  .filter((name) => !name.startsWith('shipping-location-'));
if (new Set(cssMatches).size !== 1) throw new Error('Production shipping stylesheet is ambiguous');
const cssName = cssMatches[0];
if (!fs.existsSync(path.join(base, 'css', cssName))) {
  throw new Error(`Production shipping stylesheet is missing: ${cssName}`);
}

fs.cpSync(base, stage, { recursive: true, errorOnExist: true, force: false });
const digest = crypto.createHash('sha256').update(newChunk).digest('hex').slice(0, 12);
const chunkName = `shipping-insurance-${digest}.js`;
const bridgeName = 'shipping-insurance-route.js';
const bridgeText = fs.readFileSync(path.join(__dirname, bridgeName));
const updatedIndex = indexHtml.replace(
  '<script type="module"',
  `<script defer src="/tools/${bridgeName}?v=20260918-1" data-shipping-module="/js/${chunkName}" data-shipping-css="/css/${cssName}"></script><script type="module"`,
);
if (updatedIndex === indexHtml || !updatedIndex.includes('upload-task-shell.js')) {
  throw new Error('Shipping bridge insertion failed or upload bridge was lost');
}

function writeWithGzip(filePath, bytes) {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  fs.writeFileSync(filePath, data);
  fs.writeFileSync(`${filePath}.gz`, zlib.gzipSync(data, { level: 9, mtime: 0 }));
}
writeWithGzip(path.join(stage, 'js', chunkName), newChunk);
writeWithGzip(path.join(stage, 'tools', bridgeName), bridgeText);
writeWithGzip(path.join(stage, 'index.html'), updatedIndex);

const expectedExtra = new Set([
  'index.html', 'index.html.gz',
  `js/${chunkName}`, `js/${chunkName}.gz`,
  `tools/${bridgeName}`, `tools/${bridgeName}.gz`,
]);
function listFiles(root) {
  const pending = [''];
  const result = [];
  while (pending.length) {
    const relative = pending.pop();
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const child = path.posix.join(relative.replaceAll('\\', '/'), entry.name);
      if (entry.isDirectory()) pending.push(child);
      else result.push(child);
    }
  }
  return result;
}
const baseFiles = new Set(listFiles(base));
const stageFiles = new Set(listFiles(stage));
for (const relative of baseFiles) {
  if (!stageFiles.has(relative)) throw new Error(`Production asset missing from candidate: ${relative}`);
  if (expectedExtra.has(relative)) continue;
  const before = fs.readFileSync(path.join(base, relative));
  const after = fs.readFileSync(path.join(stage, relative));
  if (!before.equals(after)) throw new Error(`Unrelated asset changed: ${relative}`);
}
for (const relative of stageFiles) {
  if (!baseFiles.has(relative) && !expectedExtra.has(relative)) {
    throw new Error(`Unexpected new candidate asset: ${relative}`);
  }
}
console.log(JSON.stringify({
  base,
  stage,
  previousShippingChunk: oldShippingName,
  shippingChunk: chunkName,
  cssName,
  unchangedAssets: baseFiles.size - 2,
  addedAssets: stageFiles.size - baseFiles.size,
}, null, 2));
