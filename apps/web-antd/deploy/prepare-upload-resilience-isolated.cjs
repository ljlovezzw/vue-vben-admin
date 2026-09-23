// Immutable candidate only; does not touch active-root, backends, caches or users.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const app = path.resolve(__dirname, '..');
const deploy = path.join(app, 'dist-production');
const active = path.join(deploy, 'active-root.conf');
const before = fs.readFileSync(active, 'utf8');
const base = path.resolve(before.match(/set \$kanban_root "([^"]+)";/)?.[1] || '');
const candidate = path.join(deploy, 'upload-resilience-20260921');
assert.ok(base.startsWith(deploy + path.sep) && base !== candidate);
assert.ok(!fs.existsSync(candidate), 'Never overwrite a release directory');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(file);
const walk = (root, relative = '') => fs.readdirSync(path.join(root, relative), {withFileTypes:true}).flatMap(entry => {
  const name = path.posix.join(relative, entry.name);
  return entry.isDirectory() ? walk(root, name) : [name];
});
const original = new Map(walk(base).map(name => [name, hash(read(path.join(base, name)))]));
fs.cpSync(base, candidate, {recursive:true,errorOnExist:true,force:false});
const changed = new Set();
function artifact(name, bytes) {
  fs.writeFileSync(path.join(candidate, name), bytes);
  fs.writeFileSync(path.join(candidate, name + '.gz'), zlib.gzipSync(bytes, {level:9}));
  changed.add(name); changed.add(name + '.gz');
}
for (const name of ['tools/upload-tool.html', 'tools/upload-frame-host.js', 'tools/upload-diagnostic.txt']) {
  artifact(name, read(path.join(app, 'public', name)));
}
const index = read(path.join(base, 'index.html')).toString();
assert.ok(!index.includes('/tools/upload-frame-host.js'));
artifact('index.html', index.replace('</head>', '<script src="/tools/upload-frame-host.js?v=20260921-resilience-v1"></script></head>'));
for (const [name, expected] of original) {
  if (!changed.has(name)) assert.equal(hash(read(path.join(candidate,name))), expected, `Unrelated asset changed: ${name}`);
}
const files = walk(candidate);
for (const name of files.filter(name => name.endsWith('.gz'))) {
  assert.deepEqual(zlib.gunzipSync(read(path.join(candidate,name))),read(path.join(candidate,name.slice(0,-3))),`Invalid gzip: ${name}`);
}
assert.equal(fs.readFileSync(active,'utf8'),before,'Another deployment changed the baseline');
const manifest = {
  base, candidate, activeConfig:before, createdAt:new Date().toISOString(),
  changed:[...changed], unchangedAssets:original.size - [...changed].filter(name=>original.has(name)).length,
  runtimeConfigHash:hash(read(path.join(candidate,'_app.config.js'))),
  files:Object.fromEntries(files.map(name=>[name,hash(read(path.join(candidate,name)))])),
};
fs.writeFileSync(path.join(deploy,'upload-resilience-20260921.manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({...manifest,files:files.length},null,2));
