const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');

const root = 'E:/desktop/vue-vben-admin/apps/web-antd';
const deploy = path.join(root, 'dist-production');
const build = path.join(root, 'dist');
const active = path.join(deploy, 'halloween-card-20260922-v4');
const candidate = path.join(deploy, 'christmas-calendar-20260923-v1');
const config = fs.readFileSync(path.join(deploy, 'active-root.conf'), 'utf8');
assert.ok(config.includes('/halloween-card-20260922-v4";'), 'Active frontend changed');
assert.ok(!fs.existsSync(candidate), 'Candidate already exists');
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const entry = (dir) => read(dir, 'index.html').match(/\/jse\/[^"\s]+\.js/)[0].slice(1);
const activeEntry = entry(active);
const buildEntry = entry(build);
const activeText = read(active, activeEntry);
const buildText = read(build, buildEntry);
const builtChristmas = fs.readdirSync(path.join(build, 'js')).find((x) => /^christmas-calendar-.*\.js$/.test(x));
const builtCss = fs.readdirSync(path.join(build, 'css')).find((x) => /^christmas-calendar-.*\.css$/.test(x));
assert.ok(builtChristmas && builtCss);
const newChunk = `js/${builtChristmas.replace('.js', '-xmas20260923.js')}`;
const newEntry = activeEntry.replace('.js', '-xmas20260923.js');
const newCss = `css/${builtCss}`;
const route = buildText.match(/\{name:`KanbanChristmasCalendar`,path:`christmas-calendar`,component:.*?title:`圣诞节运营日历`\}\}/)?.[0];
assert.ok(route, 'Missing compiled Christmas route');
let rewrittenRoute = route.replace(/component:\(\)=>Z\(\(\)=>import\(`[^`]+`\),__vite__mapDeps\(\[[^\]]+\]\)\)/,
  `component:()=>import(\`../${newChunk}\`)`);
assert.ok(rewrittenRoute.includes(`import(\`../${newChunk}\`)`));
assert.ok(!activeText.includes('KanbanChristmasCalendar'));
const anchor = activeText.match(/\{name:`KanbanHalloweenCalendar`,path:`halloween-calendar`,component:.*?title:`万圣节运营日历`\}\}/)?.[0];
assert.ok(anchor, 'Missing active Halloween route');
const patchedEntry = activeText.replace(anchor, `${anchor},${rewrittenRoute}`);
assert.equal((patchedEntry.match(/KanbanChristmasCalendar/g) ?? []).length, 1);
let christmas = read(build, `js/${builtChristmas}`);
const required = [...christmas.matchAll(/from"([^"]+)"/g)].map((m) => m[1]);
assert.equal(required.length, 4);
for (const ref of required) {
  if (ref.startsWith('../jse/')) {
    christmas = christmas.replace(ref, `../${newEntry}`);
    continue;
  }
  const basename = ref.slice(2);
  const activeDep = `js/${basename.replace('.js', '-hc20260922.js')}`;
  assert.ok(fs.existsSync(path.join(active, activeDep)), `Missing active dependency ${activeDep}`);
  assert.equal(read(build, `js/${basename}`), read(active, `js/${basename}`), `Changed dependency ${basename}`);
  christmas = christmas.replace(ref, `./${path.posix.basename(activeDep)}`);
}
const newIndex = read(active, 'index.html')
  .replace(`/${activeEntry}`, `/${newEntry}`)
  .replace('</head>', `<link rel="stylesheet" href="/${newCss}"></head>`);
assert.notEqual(newIndex, read(active, 'index.html'));
fs.cpSync(active, candidate, { recursive: true, errorOnExist: true, force: false });
for (const [rel, body] of [[newEntry,patchedEntry],[newChunk,christmas],['index.html',newIndex],[newCss,read(build,`css/${builtCss}`)]]) {
  const target = path.join(candidate,rel);
  fs.writeFileSync(target,body);
  fs.writeFileSync(`${target}.gz`,zlib.gzipSync(body,{level:9}));
}
assert.equal(read(candidate,'_app.config.js'),read(active,'_app.config.js'));
assert.equal(fs.readFileSync(path.join(deploy,'active-root.conf'),'utf8'),config);
const manifest={active,candidate,entry:newEntry,chunk:newChunk,css:newCss,
  files:Object.fromEntries([[newEntry,patchedEntry],[newChunk,christmas],['index.html',newIndex],[newCss,read(build,`css/${builtCss}`)]].map(([p,s])=>[p,sha(s)]))};
fs.writeFileSync(path.join(deploy,'christmas-calendar-20260923-v1.manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
