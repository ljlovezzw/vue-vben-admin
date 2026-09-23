const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');

const production = path.resolve(__dirname, '../dist-production');
const config = path.join(production, 'active-root.conf');
const before = fs.readFileSync(config, 'utf8');
const active = path.join(production, 'christmas-scope-20260923');
assert.equal(before.trim(), `set $kanban_root "${active.replaceAll('\\', '/')}";`);
const candidate = path.join(production, 'christmas-card-link-20260923');
assert.ok(!fs.existsSync(candidate), 'Candidate already exists');

const index = fs.readFileSync(path.join(active, 'index.html'), 'utf8');
const entryMatch = index.match(/\/jse\/[^"\s]+\.js/);
assert.ok(entryMatch, 'Missing active entry');
const oldEntry = entryMatch[0].slice(1);
const newEntry = oldEntry.replace(/\.js$/, '-card-link-20260923.js');
const oldBasic = 'basic-DKDDyFV9-hc20260922-xmas20260923v2.js';
const newBasic = 'basic-DKDDyFV9-christmas-card-link-20260923.js';
let entry = fs.readFileSync(path.join(active, oldEntry), 'utf8');
assert.equal(entry.split(oldBasic).length, 4, 'Expected three basic layout references');
entry = entry.replaceAll(oldBasic, newBasic);

let basic = fs.readFileSync(path.join(active, 'js', oldBasic), 'utf8');
function replaceOnce(from, to) {
  assert.equal(basic.split(from).length, 2, `Expected one match: ${from.slice(0, 70)}`);
  basic = basic.replace(from, to);
}
replaceOnce('halloween_calendar:`万圣节运营日历`,cold_start_fba_arrival:',
  'halloween_calendar:`万圣节运营日历`,christmas_calendar:`圣诞节运营日历`,cold_start_fba_arrival:');
replaceOnce('if((e==null?void 0:e.scene)===`halloween_calendar`)return`https://hub.junlee.top/kanban/halloween-calendar`;',
  'if((e==null?void 0:e.scene)===`halloween_calendar`)return`/kanban/halloween-calendar`;if((e==null?void 0:e.scene)===`christmas_calendar`)return`/kanban/christmas-calendar`;');
replaceOnce('function qe(e){let t=Ke(e);t?yt(t):v.push({name:`KanbanBeerDressCalendar`})}',
  'function qe(e){let t=Ke(e);re.value=!0,d.value=null,a.value=!1,t?yt(t):v.push({name:`KanbanBeerDressCalendar`})}');
replaceOnce('ne.value.scene===`halloween_calendar`?',
  '[`halloween_calendar`,`christmas_calendar`].includes(ne.value.scene)?');
replaceOnce('d.value.scene===`halloween_calendar`?',
  '[`halloween_calendar`,`christmas_calendar`].includes(d.value.scene)?');
replaceOnce('V(()=>[...n[22]||(n[22]=[k(` 打开万圣节运营日历 `,-1)])])',
  'V(()=>[k(`打开${Ae(ne.value.scene)}`,1)])');
replaceOnce('V(()=>[...n[25]||(n[25]=[k(` 打开万圣节运营日历 `,-1)])])',
  'V(()=>[k(`打开${Ae(d.value.scene)}`,1)])');

const newIndex = index.replace(`/${oldEntry}`, `/${newEntry}`);
assert.notEqual(newIndex, index);
fs.cpSync(active, candidate, { recursive: true, force: false, errorOnExist: true });
for (const [relative, content] of [['index.html', newIndex], [newEntry, entry], [`js/${newBasic}`, basic]]) {
  const target = path.join(candidate, relative);
  fs.writeFileSync(target, content);
  fs.writeFileSync(`${target}.gz`, zlib.gzipSync(content, { level: 9 }));
}
assert.equal(fs.readFileSync(config, 'utf8'), before, 'Active root changed during preparation');
console.log(JSON.stringify({ active, candidate, newEntry, newBasic }));
