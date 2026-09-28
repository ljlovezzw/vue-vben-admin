const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const root = 'E:/desktop/vue-vben-admin/apps/web-antd/dist-production';
const live = path.join(root, 'analytics-no-ad-summary-20260927');
const build = path.join(root, 'halloween-progress-20260928');
const candidate = path.join(root, 'halloween-progress-isolated-20260928');
const read = (r, f) => fs.readFileSync(path.join(r, f), 'utf8');
const config = read(root, 'active-root.conf');
assert.ok(config.includes('/analytics-no-ad-summary-20260927";'));
assert.ok(!fs.existsSync(candidate));
const refs = s => [...s.matchAll(/["'`]((?:\.\.?\/|\/)?(?:js\/|jse\/)?[\w.-]+\.js)["'`]/g)].map(m => m[1]);
const resolve = (f,r) => r.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(f),r)) : r.replace(/^\//,'');
const entry = read(live,'index.html').match(/\/jse\/[^"\s]+\.js/)[0].slice(1);
const active = new Set();
function walk(f) { if(active.has(f))return; active.add(f); for(const ref of refs(read(live,f))) {const dep=resolve(f,ref);if(fs.existsSync(path.join(live,dep)))walk(dep);} }
walk(entry);
const stem = f => path.basename(f).replace(/-[\w-]{8}\.js$/,'');
const exportsOf = s => s.slice(s.lastIndexOf('export{')).replace(/-[\w-]{8}(?=\.js)/g,'-HASH');
const oldRoutes=[...active].filter(f=>stem(f)==='halloween-calendar');
assert.equal(oldRoutes.length,1);
const fresh='js/'+fs.readdirSync(path.join(build,'js')).find(f=>stem(f)==='halloween-calendar');
const newModules=new Map();
function adapt(f) {
  let source=read(build,f);
  for(const ref of refs(source)) {
    const dep=resolve(f,ref);
    const matches=[...active].filter(old=>stem(old)===stem(dep));
    let target;
    if(matches.length) {
      assert.equal(matches.length,1,dep);
      target=matches[0];
      assert.equal(exportsOf(read(live,target)),exportsOf(read(build,dep)),`Export mismatch ${dep}`);
    } else {
      target=dep;
      if(!newModules.has(dep)) {newModules.set(dep,'');newModules.set(dep,adapt(dep));}
    }
    const relative=path.posix.relative(path.posix.dirname(f),target);
    source=source.split(ref).join(relative.startsWith('.')?relative:'./'+relative);
  }
  return source;
}
const replacement=adapt(fresh);
const oldCss=[...new Set([...active].flatMap(f=>[...read(live,f).matchAll(/["'](css\/halloween-calendar[^"']*\.css)["']/g)].map(m=>m[1])))];
assert.equal(oldCss.length,1);
const cssFiles=fs.readdirSync(path.join(build,'css')).filter(f=>f.endsWith('.css')&&(f.startsWith('halloween-calendar-')||f.startsWith('StageSalesProgress-')));
assert.equal(cssFiles.length,2);
const cssPath='css/halloween-progress-20260928.css';
const mapping=new Map([...active,...newModules.keys()].map(f=>[f,f.replace(/\.js$/,'-hp20260928.js')]));
const names=new Map([...mapping].map(([a,b])=>[path.posix.basename(a),path.posix.basename(b)]));
names.set(oldCss[0],cssPath);
const pattern=new RegExp([...names.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
const version=s=>s.replace(pattern,m=>names.get(m));
fs.cpSync(live,candidate,{recursive:true,errorOnExist:true,force:false});
for(const [old,next] of mapping) {
  const source=old===oldRoutes[0]?replacement:newModules.get(old)??read(live,old);
  const text=version(source);
  fs.writeFileSync(path.join(candidate,next),text);
  fs.writeFileSync(path.join(candidate,next+'.gz'),zlib.gzipSync(text,{level:9}));
  if(old!==oldRoutes[0]&&!newModules.has(old)) {
    let reverse=text;for(const [a,b]of names)reverse=reverse.split(b).join(a);
    assert.equal(reverse,read(live,old),`Unrelated module changed ${old}`);
  }
}
const css=cssFiles.map(f=>read(build,'css/'+f)).join('\n');
fs.writeFileSync(path.join(candidate,cssPath),css);fs.writeFileSync(path.join(candidate,cssPath+'.gz'),zlib.gzipSync(css));
const html=version(read(live,'index.html'));
fs.writeFileSync(path.join(candidate,'index.html'),html);fs.writeFileSync(path.join(candidate,'index.html.gz'),zlib.gzipSync(html));
assert.equal(read(root,'active-root.conf'),config);
const manifest={baseline:live,candidate,route:oldRoutes[0],newModules:[...newModules.keys()],unchangedModules:active.size-1,entry:mapping.get(entry)};
fs.writeFileSync(path.join(candidate,'progress-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
