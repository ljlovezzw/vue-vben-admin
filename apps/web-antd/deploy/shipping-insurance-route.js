// Isolated shipping release bridge. The deployed Vue bundle stays unchanged;
// only the KanbanShipping lazy route loads the reviewed shipping page chunk.
(() => {
  const script = document.currentScript;
  const moduleUrl = script?.dataset.shippingModule;
  const cssUrl = script?.dataset.shippingCss;
  if (!moduleUrl || !cssUrl) return;

  const loadShippingPage = () => import(moduleUrl);

  function ensureStyles() {
    if (document.querySelector('#kanban-shipping-insurance-css')) return;
    const link = document.createElement('link');
    link.id = 'kanban-shipping-insurance-css';
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.append(link);
  }

  function patchRoute(route) {
    if (!route || typeof route !== 'object') return;
    if (route.name === 'KanbanShipping') {
      route.component = loadShippingPage;
      if (route.components) route.components.default = loadShippingPage;
    }
    for (const child of route.children || []) patchRoute(child);
  }

  function install() {
    const router =
      document.querySelector('#app')?.__vue_app__?.config?.globalProperties
        ?.$router;
    if (!router) return false;
    if (router.__kanbanShippingInsurance) return true;
    router.__kanbanShippingInsurance = true;

    const originalAddRoute = router.addRoute;
    router.addRoute = function (...args) {
      patchRoute(args.at(-1));
      return originalAddRoute.apply(this, args);
    };
    for (const route of router.getRoutes()) patchRoute(route);
    router.beforeEach((to) => {
      if (to.name !== 'KanbanShipping') return;
      ensureStyles();
      for (const route of to.matched || []) patchRoute(route);
    });
    return true;
  }

  const timer = setInterval(() => {
    if (install()) clearInterval(timer);
  }, 20);
})();
