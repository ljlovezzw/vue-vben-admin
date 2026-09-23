const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const app = path.resolve(__dirname, '..');
const deploy = path.join(app, 'dist-production');
const build = path.join(app, 'dist');
const activeConfigPath = path.join(deploy, 'active-root.conf');
const activeConfig = fs.readFileSync(activeConfigPath, 'utf8');
const active = path.resolve(activeConfig.match(/set \$kanban_root "([^"]+)";/)?.[1] || '');
const candidate = path.join(deploy, 'net-profit-no-margin-20260923');

assert.ok(active.startsWith(deploy + path.sep), 'Active frontend must be inside dist-production');
assert.ok(fs.existsSync(active), 'Active frontend is missing');
assert.ok(!fs.existsSync(candidate), 'Candidate already exists');

const read = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const sha = (content) => crypto.createHash('sha256').update(content).digest('hex');
const entry = (root) => read(root, 'index.html').match(/\/(jse\/[^"\s]+\.js)/)[1];
const refs = (source) => [
  ...source.matchAll(/["'`]((?:\.\.?\/)[^"'`]+\.js)["'`]/g),
].map((match) => match[1]);
const resolveRef = (relative, ref) => path.posix.normalize(
  path.posix.join(path.posix.dirname(relative), ref),
);
const logicalStem = (relative) => {
  const name = path.posix.basename(relative);
  const match = name.match(/^(.*)-[A-Za-z0-9_-]{8}(?:-.*)?\.js$/);
  assert.ok(match, `Cannot identify module stem: ${relative}`);
  return match[1];
};
const findBuildModule = (stem) => {
  const matches = fs.readdirSync(path.join(build, 'js')).filter(
    (name) => name.endsWith('.js') && logicalStem(name) === stem,
  );
  assert.equal(matches.length, 1, `Expected one built ${stem} module`);
  return `js/${matches[0]}`;
};

const activeEntry = entry(active);
const builtEntry = entry(build);
const activeEntryBody = read(active, activeEntry);
const activeRouteMatch = activeEntryBody.match(/(?:\.\.\/)?js\/(net-profit-[A-Za-z0-9_-]+\.js)/);
assert.ok(activeRouteMatch, 'Active net-profit route chunk is missing');
const activeRoute = `js/${activeRouteMatch[1]}`;

const activeGraph = new Set();
function walk(relative) {
  if (activeGraph.has(relative)) return;
  assert.ok(fs.existsSync(path.join(active, relative)), `Missing active dependency: ${relative}`);
  activeGraph.add(relative);
  for (const ref of refs(read(active, relative))) {
    const dependency = resolveRef(relative, ref);
    if (fs.existsSync(path.join(active, dependency))) walk(dependency);
  }
}
walk(activeRoute);
activeGraph.add(activeEntry);

const activeByStem = new Map();
for (const relative of activeGraph) {
  const stem = logicalStem(relative);
  const matches = activeByStem.get(stem) || [];
  matches.push(relative);
  activeByStem.set(stem, matches);
}

const activeModule = (stem) => {
  const matches = activeByStem.get(stem) || [];
  assert.equal(matches.length, 1, `Expected one active ${stem} module`);
  return matches[0];
};

const changedStems = [
  'net-profit',
  'StrategicDashboard',
  'RiskAlertPanel',
  'WaterfallChart',
];
const builtChanged = new Map(changedStems.map((stem) => [stem, findBuildModule(stem)]));
const newEntry = activeEntry.replace(/\.js$/, '-no-margin-20260923.js');
const newModules = new Map(
  changedStems.map((stem) => [
    stem,
    activeModule(stem).replace(/\.js$/, '-no-margin-20260923.js'),
  ]),
);

assert.ok(read(active, activeModule('net-profit')).includes('纯利率'));
assert.ok(read(active, activeModule('StrategicDashboard')).includes('净利率'));
assert.ok(read(active, activeModule('RiskAlertPanel')).includes('净利率偏低'));
assert.ok(!read(build, builtChanged.get('net-profit')).includes('纯利率'));
assert.ok(!read(build, builtChanged.get('StrategicDashboard')).includes('净利率'));
assert.ok(!read(build, builtChanged.get('RiskAlertPanel')).includes('净利率偏低'));

function rewriteBuiltModule(stem) {
  const builtRelative = builtChanged.get(stem);
  const targetRelative = newModules.get(stem);
  let source = read(build, builtRelative);
  const activeRelative = activeModule(stem);
  const activeSource = read(active, activeRelative);
  const activeScopes = [...new Set(activeSource.match(/data-v-[a-f0-9]+/g) || [])];
  const builtScopes = [...new Set(source.match(/data-v-[a-f0-9]+/g) || [])];
  assert.equal(builtScopes.length, activeScopes.length, `Scoped CSS contract changed: ${stem}`);
  for (let index = 0; index < builtScopes.length; index += 1) {
    source = source.split(builtScopes[index]).join(activeScopes[index]);
  }
  const builtRefs = refs(source);
  const activeRefs = refs(activeSource);
  assert.equal(builtRefs.length, activeRefs.length, `Dependency contract changed: ${stem}`);
  for (let index = 0; index < builtRefs.length; index += 1) {
    const ref = builtRefs[index];
    const dependency = resolveRef(builtRelative, ref);
    const dependencyStem = logicalStem(dependency);
    const activeDependency = resolveRef(activeRelative, activeRefs[index]);
    assert.equal(
      logicalStem(activeDependency),
      dependencyStem,
      `Dependency order changed: ${stem}`,
    );
    const target = dependencyStem === 'index-index'
      ? newEntry
      : newModules.get(dependencyStem) || activeDependency;
    assert.ok(target, `No active dependency mapping for ${dependencyStem}`);
    const relativeRef = path.posix.relative(path.posix.dirname(targetRelative), target);
    source = source.split(ref).join(relativeRef.startsWith('.') ? relativeRef : `./${relativeRef}`);
  }
  return source;
}

const rewrittenModules = new Map(
  changedStems.map((stem) => [newModules.get(stem), rewriteBuiltModule(stem)]),
);
let rewrittenEntry = activeEntryBody;
for (const stem of changedStems) {
  rewrittenEntry = rewrittenEntry
    .split(path.posix.basename(activeModule(stem)))
    .join(path.posix.basename(newModules.get(stem)));
}
assert.notEqual(rewrittenEntry, activeEntryBody, 'Entry module did not change');

const newIndex = read(active, 'index.html').replace(`/${activeEntry}`, `/${newEntry}`);
assert.notEqual(newIndex, read(active, 'index.html'));

fs.cpSync(active, candidate, { recursive: true, errorOnExist: true, force: false });
const changed = new Map([
  [newEntry, rewrittenEntry],
  ['index.html', newIndex],
  ...rewrittenModules,
]);
for (const [relative, content] of changed) {
  const target = path.join(candidate, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  fs.writeFileSync(`${target}.gz`, zlib.gzipSync(content, { level: 9 }));
}

assert.equal(read(candidate, '_app.config.js'), read(active, '_app.config.js'));
assert.equal(fs.readFileSync(activeConfigPath, 'utf8'), activeConfig, 'Active frontend changed during preparation');
for (const [relative, content] of rewrittenModules) {
  assert.equal(read(candidate, relative), content);
}

const manifest = {
  active,
  activeConfig,
  builtEntry,
  candidate,
  changedFiles: [...changed.keys()],
  createdAt: new Date().toISOString(),
  entry: newEntry,
  files: Object.fromEntries([...changed].map(([relative, content]) => [relative, sha(content)])),
};
fs.writeFileSync(
  path.join(deploy, 'net-profit-no-margin-20260923.manifest.json'),
  JSON.stringify(manifest, null, 2),
);
console.log(JSON.stringify(manifest, null, 2));
