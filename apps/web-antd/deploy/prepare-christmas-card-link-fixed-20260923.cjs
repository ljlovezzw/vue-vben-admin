const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');

const dist = path.resolve(__dirname, '../dist-production');
const active = path.join(dist, 'christmas-scope-20260923');
const patched = path.join(dist, 'christmas-card-link-20260923');
const candidate = path.join(dist, 'christmas-card-link-fixed-v2-20260923');
const version = 'v20260923-card-link-fixed-v2';
assert.equal(fs.readFileSync(path.join(dist, 'active-root.conf'), 'utf8').trim(),
  `set $kanban_root "${active.replaceAll('\\', '/')}";`);
assert.ok(!fs.existsSync(candidate), 'Candidate already exists');

const activeIndex = fs.readFileSync(path.join(active, 'index.html'), 'utf8');
const patchedIndex = fs.readFileSync(path.join(patched, 'index.html'), 'utf8');
const activeEntry = activeIndex.match(/\/jse\/([^"\s]+\.js)/)?.[1];
const oldEntry = 'index-index-CyLdWZja-hc20260922-xmas20260923v2.js';
const newEntry = patchedIndex.match(/\/jse\/([^"\s]+\.js)/)?.[1];
assert.ok(activeEntry && newEntry);
assert.ok(fs.existsSync(path.join(active, 'jse', oldEntry)));
const patchedEntry = fs.readFileSync(path.join(patched, 'jse', newEntry), 'utf8');
const oldBasic = 'basic-DKDDyFV9-hc20260922-xmas20260923v2.js';
const newBasic = 'basic-DKDDyFV9-christmas-card-link-20260923.js';
assert.equal(patchedEntry.split(newBasic).length, 4);
assert.equal(patchedEntry.split(oldEntry).length, 1);
assert.ok(fs.existsSync(path.join(patched, 'js', newBasic)));

fs.cpSync(active, candidate, { recursive: true, force: false, errorOnExist: true });
const versionRoot = path.join(candidate, version);
fs.cpSync(active, versionRoot, { recursive: true, force: false, errorOnExist: true });

const replacements = [
  [path.join(versionRoot, 'jse', oldEntry), patchedEntry],
  [path.join(versionRoot, 'js', newBasic), fs.readFileSync(path.join(patched, 'js', newBasic), 'utf8')],
];
for (const [target, content] of replacements) {
  fs.writeFileSync(target, content);
  fs.writeFileSync(`${target}.gz`, zlib.gzipSync(content, { level: 9 }));
}
let index = activeIndex.replace(`/jse/${activeEntry}`, `/jse/${oldEntry}`)
  .replaceAll('src="/', `src="/${version}/`).replaceAll('href="/', `href="/${version}/`);
assert.ok(index.includes(`src="/${version}/jse/${oldEntry}"`));
assert.ok(!index.includes(`src="/jse/${oldEntry}"`));
fs.writeFileSync(path.join(candidate, 'index.html'), index);
fs.writeFileSync(path.join(candidate, 'index.html.gz'), zlib.gzipSync(index, { level: 9 }));
console.log(JSON.stringify({ candidate, version, entry: oldEntry, basic: newBasic }));
