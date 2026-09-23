const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');

const production = path.resolve(__dirname, '../dist-production');
const config = path.join(production, 'active-root.conf');
const before = fs.readFileSync(config, 'utf8');
const match = before.match(/set\s+\$kanban_root\s+"([^"]+)";/);
assert.ok(match, 'Missing active frontend root');
const active = match[1];
assert.ok(active.startsWith(production.replaceAll('\\', '/')), 'Unexpected frontend root');
const candidate = path.join(production, 'christmas-scope-20260923');
assert.ok(!fs.existsSync(candidate), 'Candidate already exists');

const index = fs.readFileSync(path.join(active, 'index.html'), 'utf8');
const entryMatch = index.match(/\/jse\/[^"\s]+\.js/);
assert.ok(entryMatch, 'Missing active entry');
const oldEntry = entryMatch[0].slice(1);
const newEntry = oldEntry.replace(/\.js$/, '-christmas-scope-20260923.js');
const entryScript = fs.readFileSync(path.join(active, oldEntry), 'utf8');
const oldName = 'christmas-calendar-BX-xj9qm-xmas20260923v2.js';
const newName = 'christmas-calendar-BX-xj9qm-scope20260923.js';
const oldChunk = path.join(active, 'js', oldName);
assert.ok(fs.existsSync(oldChunk), 'Active Christmas chunk changed');
const oldScript = fs.readFileSync(oldChunk, 'utf8');
const oldLogic = 'C.value&&C.value!==b&&!en.value.includes(C.value)&&(C.value=b)}catch(e)';
const newLogic = 'C.value&&C.value!==b&&!en.value.includes(C.value)&&(C.value=R.value===null?``:b)}catch(e)';
assert.equal(oldScript.split(oldLogic).length, 2, 'Expected exactly one stale owner-reset expression');
const newScript = oldScript.replace(oldLogic, newLogic);
assert.notEqual(newScript, oldScript);
assert.equal(entryScript.split(oldName).length, 2, 'Expected exactly one Christmas chunk reference');
const newEntryScript = entryScript.replace(oldName, newName);
const newIndex = index.replace(`/${oldEntry}`, `/${newEntry}`);
assert.equal(newIndex.split(`/${newEntry}`).length, 2);

fs.cpSync(active, candidate, { recursive: true, force: false, errorOnExist: true });
for (const [relative, content] of [['index.html', newIndex], [newEntry, newEntryScript], [`js/${newName}`, newScript]]) {
  const file = path.join(candidate, relative);
  fs.writeFileSync(file, content);
  fs.writeFileSync(`${file}.gz`, zlib.gzipSync(content, { level: 9 }));
}
assert.equal(fs.readFileSync(config, 'utf8'), before, 'Active frontend changed during preparation');
console.log(JSON.stringify({ active, candidate, oldEntry, newEntry, oldName, newName,
  changedFiles: ['index.html', newEntry, `js/${newName}`] }));
