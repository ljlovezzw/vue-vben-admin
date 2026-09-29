const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const root = 'E:/desktop/vue-vben-admin/apps/web-antd/dist-production';
const live = root + '/halloween-ranking-v2-isolated-20260928';
const build = root + '/halloween-ranking-old-products-20260928';
const candidate = root + '/halloween-ranking-aligned-isolated-20260928';
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const config = read(root, 'active-root.conf');
assert.ok(config.includes(live));
assert.ok(!fs.existsSync(candidate));
const refs = text => [...text.matchAll(/["'`]((?:\.\.?\/|\/)?(?:js\/|jse\/)?[\w.-]+\.js)["'`]/g)].map(m => m[1]);
const resolve = (file, ref) => ref.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), ref)) : ref.replace(/^\//, '');
const entry = read(live, 'index.html').match(/\/jse\/[^"\s]+\.js/)[0].slice(1);
const active = new Set();
function walk(file) {
  if (active.has(file)) return;
  active.add(file);
  for (const ref of refs(read(live, file))) {
    const dep = resolve(file, ref);
    if (fs.existsSync(path.join(live, dep))) walk(dep);
  }
}
walk(entry);
const stem = file => path.basename(file).replace(/-(?:hp|yoy|time|trim2|trim|compact|rank)20260928/g, '').replace(/-[\w-]{8}\.js$/, '');
const old = [...active].filter(file => stem(file) === 'YearSalesRanking');
const fresh = fs.readdirSync(build + '/js').filter(file => stem(file) === 'YearSalesRanking');
assert.equal(old.length, 1); assert.equal(fresh.length, 1);
const freshFile = 'js/' + fresh[0];
let replacement = read(build, freshFile);
for (const ref of refs(replacement)) {
  const dep = resolve(freshFile, ref);
  const matches = [...active].filter(file => stem(file) === stem(dep));
  assert.equal(matches.length, 1, dep);
  const target = matches[0];
  const exportsOf = text => text.slice(text.lastIndexOf('export{'));
  assert.equal(exportsOf(read(live, target)), exportsOf(read(build, dep)), 'Export contract: ' + dep);
  const relative = path.posix.relative(path.posix.dirname(freshFile), target);
  replacement = replacement.split(ref).join(relative.startsWith('.') ? relative : './' + relative);
}
const mapping = new Map([...active].map(file => [file, file.replace(/\.js$/, '-align20260928.js')]));
const names = new Map([...mapping].map(([a, b]) => [path.posix.basename(a), path.posix.basename(b)]));
const newCss = 'css/halloween-ranking-aligned-20260928.css';
names.set('css/halloween-ranking-20260928.css', newCss);
const pattern = new RegExp([...names.keys()].sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
const version = text => text.replace(pattern, value => names.get(value));
fs.cpSync(live, candidate, { recursive: true, force: false, errorOnExist: true });
for (const [file, next] of mapping) {
  const original = file === old[0] ? replacement : read(live, file);
  const text = version(original);
  fs.writeFileSync(path.join(candidate, next), text);
  fs.writeFileSync(path.join(candidate, next + '.gz'), zlib.gzipSync(text));
  if (file !== old[0]) {
    let reverse = text;
    for (const [a, b] of names) reverse = reverse.split(b).join(a);
    assert.equal(reverse, read(live, file));
  }
}
const cssFiles = fs.readdirSync(build + '/css').filter(file => /^(?:halloween-calendar|StageSalesProgress|YearSalesRanking)-.*\.css$/.test(file));
assert.equal(cssFiles.length, 3);
const css = cssFiles.map(file => read(build, 'css/' + file)).join('\n');
fs.writeFileSync(candidate + '/' + newCss, css);
fs.writeFileSync(candidate + '/' + newCss + '.gz', zlib.gzipSync(css));
const html = version(read(live, 'index.html'));
fs.writeFileSync(candidate + '/index.html', html);
fs.writeFileSync(candidate + '/index.html.gz', zlib.gzipSync(html));
assert.equal(read(root, 'active-root.conf'), config);
const manifest = {live, candidate, entry: mapping.get(entry), replaced: mapping.get(old[0]), css: newCss, unchangedModules: active.size - 1};
fs.writeFileSync(candidate + '/alignment-manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
