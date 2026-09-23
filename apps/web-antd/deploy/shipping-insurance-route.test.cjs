const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const shippingRoute = { name: 'KanbanShipping', components: { default: () => 'old' } };
const otherRoute = { name: 'Other', components: { default: () => 'unchanged' } };
const oldShippingLoader = shippingRoute.components.default;
const oldOtherLoader = otherRoute.components.default;
const routes = [shippingRoute, otherRoute];
const links = [];
let intervalCallback;
let beforeEach;
const router = {
  addRoute(route) { routes.push(route); },
  beforeEach(guard) { beforeEach = guard; },
  getRoutes() { return routes; },
};
const document = {
  currentScript: {
    dataset: {
      shippingModule: '/js/shipping-insurance-test.js',
      shippingCss: '/css/shipping-existing.css',
    },
  },
  getElementById(id) {
    if (id === 'app') return { __vue_app__: { config: { globalProperties: { $router: router } } } };
    return links.find((link) => link.id === id);
  },
  createElement(tag) { return { tag }; },
  head: { appendChild(link) { links.push(link); } },
};
const source = fs.readFileSync(path.join(__dirname, 'shipping-insurance-route.js'), 'utf8');
vm.runInNewContext(source, {
  clearInterval() {},
  document,
  setInterval(callback) { intervalCallback = callback; return 1; },
});
intervalCallback();
assert.notEqual(shippingRoute.components.default, oldShippingLoader);
assert.equal(otherRoute.components.default, oldOtherLoader);
const addedRoute = { name: 'KanbanShipping', component: oldShippingLoader };
router.addRoute(addedRoute);
assert.notEqual(addedRoute.component, oldShippingLoader);
beforeEach({ name: 'KanbanShipping', matched: [shippingRoute] });
beforeEach({ name: 'KanbanShipping', matched: [shippingRoute] });
assert.equal(links.length, 1);
assert.equal(links[0].href, '/css/shipping-existing.css');
console.log('shipping route bridge: passed');
