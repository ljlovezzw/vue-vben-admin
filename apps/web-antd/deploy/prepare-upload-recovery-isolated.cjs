// Prepare an upload-only candidate from the active production release.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const appRoot = path.resolve(__dirname, '..');
const deployRoot = path.join(appRoot, 'dist-production');
const config = fs.readFileSync(path.join(deployRoot, 'active-root.conf'), 'utf8');
const slot = config.match(/\/dist-production\/(blue|green)"?;/)?.[1];
if (!slot) throw new Error('Active production slot is not blue or green');
const base = path.join(deployRoot, slot);
const stage = path.join(deployRoot, 'upload-recovery-candidate-20260918');
if (fs.existsSync(stage)) throw new Error(`Candidate already exists: ${stage}`);
if (!fs.existsSync(path.join(base, 'index.html'))) throw new Error('Active release is incomplete');

const sourceHtml = path.join(appRoot, 'public/tools/upload-tool.html');
const sourceShell = path.join(__dirname, 'upload-task-shell.js');
const oldTag = '<script defer src="/tools/upload-task-shell.js?v=20260917-upload-drafts-v1"></script>';
const newTag = '<script defer src="/tools/upload-task-shell.js?v=20260918-upload-recovery-v2"></script>';
const index = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
if (!index.includes(oldTag) || index.includes(newTag)) throw new Error('Unexpected upload shell entry');

fs.cpSync(base, stage, { recursive: true, errorOnExist: true, force: false });
function writeWithGzip(relative, bytes) {
  const content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  const target = path.join(stage, relative);
  fs.writeFileSync(target, content);
  fs.writeFileSync(`${target}.gz`, zlib.gzipSync(content, { level: 9, mtime: 0 }));
}
writeWithGzip('tools/upload-tool.html', fs.readFileSync(sourceHtml));
writeWithGzip('tools/upload-task-shell.js', fs.readFileSync(sourceShell));
writeWithGzip('index.html', index.replace(oldTag, newTag));

const changed = new Set([
  'index.html', 'index.html.gz',
  'tools/upload-tool.html', 'tools/upload-tool.html.gz',
  'tools/upload-task-shell.js', 'tools/upload-task-shell.js.gz',
]);
function walk(root, relative = '') {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const name = path.posix.join(relative, entry.name);
    return entry.isDirectory() ? walk(root, name) : [name];
  });
}
const baseFiles = walk(base);
const candidateFiles = walk(stage);
if (baseFiles.length !== candidateFiles.length || baseFiles.some((name, i) => name !== candidateFiles[i])) {
  throw new Error('Candidate asset inventory changed unexpectedly');
}
for (const relative of baseFiles) {
  if (changed.has(relative)) continue;
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (hash(path.join(base, relative)) !== hash(path.join(stage, relative))) {
    throw new Error(`Unrelated asset changed: ${relative}`);
  }
}
if (!fs.readFileSync(path.join(stage, 'tools/upload-tool.html')).equals(fs.readFileSync(sourceHtml))) {
  throw new Error('Candidate upload tool does not match source');
}
if (!fs.readFileSync(path.join(stage, 'tools/upload-task-shell.js')).equals(fs.readFileSync(sourceShell))) {
  throw new Error('Candidate upload shell does not match source');
}
console.log(JSON.stringify({ base, stage, changed: [...changed], unchangedAssets: baseFiles.length - changed.size }, null, 2));
