const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const deploy = 'E:/desktop/vue-vben-admin/apps/web-antd/dist-production';
const live = path.join(deploy, 'halloween-20260921-v2');
const baseline = 'E:/desktop/vue-vben-admin/tmp/halloween-card-baseline';
const build = 'E:/desktop/vue-vben-admin/tmp/halloween-card-build';
const candidate = path.join(deploy, 'halloween-card-20260922-v4');
const config = fs.readFileSync(path.join(deploy, 'active-root.conf'), 'utf8');
assert.ok(config.includes('/halloween-20260921-v2";'));
assert.ok(!fs.existsSync(candidate), 'Candidate must be new');
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const hash = content => crypto.createHash('sha256').update(content).digest('hex');
const entry = root => read(root, 'index.html').match(/\/jse\/[^"\s]+\.js/)[0].slice(1);
const stem = value => value.replace(/-[\w-]{8}\.js$/, '');
const normalize = value => value.replace(/-[\w-]{8}(?=\.js|\.css)/g, '-HASH');
const refs = source => [...source.matchAll(/["'`]((?:\.\.?\/|\/)?(?:js\/|jse\/)?[\w.-]+\.js)["'`]/g)].map(m => m[1]);
const resolve = (rel, ref) => ref.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), ref)) : ref.replace(/^\//, '');
const active = new Set();
function walk(rel) {
  if (active.has(rel)) return;
  assert.ok(fs.existsSync(path.join(live,rel)), `Missing live dependency: ${rel}`);
  active.add(rel);
  for(const ref of refs(read(live,rel))) {
    const dep = resolve(rel,ref);
    if (fs.existsSync(path.join(live,dep))) walk(dep);
  }
}
walk(entry(live));
const findFile = (root, name) => 'js/' + fs.readdirSync(path.join(root,'js')).find(f => stem(f) === name);
const replacements = new Map();
const integrations = [];
for (const name of ['halloween-calendar', 'basic']) {
  const old = [...active].filter(f => stem(path.posix.basename(f)) === name);
  assert.equal(old.length,1);
  const before = findFile(baseline,name), after = findFile(build,name);
  assert.equal(normalize(read(live,old[0])),normalize(read(baseline,before)), `Baseline ${name} differs from production`);
  let source = read(build,after);
  // The source edits change Vue's production scope hash. Retain the existing
  // scope only after proving that every compiled CSS rule is unchanged.
  const freshCss = fs.readdirSync(path.join(build,'css')).find(f=>f.startsWith(name+'-')&&f.endsWith('.css'));
  const css = read(build,'css/'+freshCss);
  const normalizeCss = value => value.replace(/data-v-[a-f0-9]+/g,'data-v-SCOPE');
  const oldCss = fs.readdirSync(path.join(live,'css')).filter(f=>f.startsWith(name+'-')&&f.endsWith('.css')&&normalizeCss(read(live,'css/'+f))===normalizeCss(css));
  assert.equal(oldCss.length,1,`Styles changed: ${name}`);
  assert.ok([...active].some(f=>read(live,f).includes(oldCss[0])),`Styles not active: ${oldCss[0]}`);
  const oldScopes=[...new Set(read(live,'css/'+oldCss[0]).match(/data-v-[a-f0-9]+/g))];
  const freshScopes=[...new Set(css.match(/data-v-[a-f0-9]+/g))];
  assert.equal(oldScopes.length,freshScopes.length);
  freshScopes.forEach((scope,i)=>{source=source.split(scope).join(oldScopes[i]);});
  for (const ref of refs(source)) {
    const dep = resolve(after,ref);
    let matches = [...active].filter(f => stem(f) === stem(dep));
    if (matches.length > 1) matches = matches.filter(f => normalize(read(live,f)) === normalize(read(build,dep)));
    assert.equal(matches.length,1, `Ambiguous dependency ${dep}`);
    const target = matches[0];
    const oldBody = read(live,target), newBody = read(build,dep);
    const exportPart = value => normalize(value.slice(value.lastIndexOf('export{')));
    assert.equal(exportPart(oldBody),exportPart(newBody),`Dependency export contract changed: ${dep}`);
    const relative = path.posix.relative(path.posix.dirname(old[0]),target);
    source = source.split(ref).join(relative.startsWith('.') ? relative : './'+relative);
  }
  replacements.set(old[0],source);
  integrations.push({module:name,old:old[0],built:after,sourceHash:hash(read(build,after))});
}
// Version the entire active JS graph together: one module URL per runtime,
// no stale cache collisions and no unrelated unpublished source changes.
const mapping = new Map([...active].map(f => [f,f.replace(/\.js$/,'-hc20260922.js')]));
const basenames = new Map([...mapping].map(([a,b]) => [path.posix.basename(a),path.posix.basename(b)]));
assert.equal(basenames.size,mapping.size);
const pattern = new RegExp([...basenames.keys()].map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).sort((a,b)=>b.length-a.length).join('|'),'g');
const version = content => content.replace(pattern,match=>basenames.get(match));
fs.cpSync(live,candidate,{recursive:true,errorOnExist:true,force:false});
for (const [old,next] of mapping) {
  const source = replacements.get(old) ?? read(live,old);
  const content = version(source);
  fs.writeFileSync(path.join(candidate,next),content);
  fs.writeFileSync(path.join(candidate,next+'.gz'),zlib.gzipSync(content,{level:9}));
  if (!replacements.has(old)) {
    let reverse=content;
    for(const [a,b] of basenames) reverse=reverse.split(b).join(a);
    assert.equal(reverse,read(live,old),`Unrelated logic changed: ${old}`);
  }
}
const html = version(read(live,'index.html'));
fs.writeFileSync(path.join(candidate,'index.html'),html);
fs.writeFileSync(path.join(candidate,'index.html.gz'),zlib.gzipSync(html,{level:9}));
assert.equal(read(candidate,'_app.config.js'),read(live,'_app.config.js'));
assert.equal(fs.readFileSync(path.join(deploy,'active-root.conf'),'utf8'),config);
const manifest={createdAt:new Date().toISOString(),baseline:live,candidate,entry:mapping.get(entry(live)),activeModules:active.size,integrations,files:Object.fromEntries([...mapping.values()].map(f=>[f,hash(read(candidate,f))]))};
fs.writeFileSync(path.join(deploy,'halloween-card-20260922-v4.manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({...manifest,files:Object.keys(manifest.files).length},null,2));
