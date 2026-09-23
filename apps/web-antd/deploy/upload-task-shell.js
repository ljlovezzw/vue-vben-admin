// Isolated production bridge for the upload notice release. The normal source
// build renders UploadTaskNotice.vue; this file lets us preserve all currently
// deployed non-upload JS chunks while the shared worktree contains other edits.
(() => {
  if (window.__kanbanUploadNoticeBridge) return;
  window.__kanbanUploadNoticeBridge = true;
  const phases = {
    caching: '正在保存本地副本',
    executing: '后台执行中',
    failed: '上传失败',
    pending: '等待确认结果',
    preparing: '正在准备图片',
    queued: '已加入上传队列',
    running: '后台执行中',
    submitted: '已提交，等待处理',
    succeeded: '提交完成',
    uploading: '正在上传图片',
  };
  const terminal = new Set(['failed', 'pending', 'succeeded']);
  const notices = new Map();
  const cards = new Map();
  let noticeStack = null;
  let currentOwner = '';
  let currentToken = '';
  let legacyOwner = '';
  let allowLegacyMessages = true;
  const subscribedStores = new WeakSet();
  const verifiedFrames = new WeakMap();
  // Keep the WindowProxy as well as the element: KeepAlive can temporarily move
  // the iframe outside document without ending an in-flight upload.
  const identityTargets = new Map();

  function appServices() {
    const app = document.querySelector('#app')?.__vue_app__;
    return {
      router: app?.config?.globalProperties?.$router,
      pinia: app?.config?.globalProperties?.$pinia,
    };
  }

  function patchUploadRoute(route) {
    if (!route || typeof route !== 'object') return;
    if (route.name === 'UploadTool') {
      route.meta ||= {};
      route.meta.keepAlive = true;
    }
    for (const child of route.children || []) patchUploadRoute(child);
  }

  function refreshCachedUploadTab(pinia) {
    const tabbar = pinia?._s?.get('core-tabbar');
    if (!tabbar) return;
    let changed = false;
    for (const tab of tabbar.tabs || []) {
      if (tab.name !== 'UploadTool' || tab.meta?.keepAlive) continue;
      tab.meta ||= {};
      tab.meta.keepAlive = true;
      changed = true;
    }
    if (changed) void tabbar.updateCacheTabs();
  }

  function installRouteBridge() {
    const { router, pinia } = appServices();
    if (!router) return false;
    if (router.__kanbanUploadKeepAlive) return true;
    router.__kanbanUploadKeepAlive = true;
    const addRoute = router.addRoute;
    router.addRoute = function (...args) {
      patchUploadRoute(args.at(-1));
      return addRoute.apply(this, args);
    };
    for (const route of router.getRoutes()) patchUploadRoute(route);
    refreshCachedUploadTab(pinia);
    router.afterEach(() => {
      for (const route of router.getRoutes()) patchUploadRoute(route);
      setTimeout(() => refreshCachedUploadTab(pinia), 0);
    });
    return true;
  }

  const routeBridgeTimer = setInterval(() => {
    const routeReady = installRouteBridge();
    const identityReady = installIdentitySubscriptions();
    if (routeReady && identityReady) clearInterval(routeBridgeTimer);
  }, 50);

  function syncIdentity() {
    const { pinia } = appServices();
    const user = pinia?._s?.get('core-user')?.userInfo;
    const id = user?.userId || user?.id || user?.username;
    const token = String(pinia?._s?.get('core-access')?.accessToken || '');
    const owner = token && id ? `user:${String(id)}` : '';
    const effectiveToken = owner ? token : '';
    const identityChanged =
      owner !== currentOwner || effectiveToken !== currentToken;
    if (owner !== currentOwner) {
      if (currentOwner) allowLegacyMessages = false;
      if (owner && !legacyOwner) legacyOwner = owner;
      currentOwner = owner;
      notices.clear();
      cards.clear();
      noticeStack?.remove();
      noticeStack = null;
    }
    currentToken = effectiveToken;
    if (identityChanged) {
      for (const frame of document.querySelectorAll('.upload-tool-frame')) {
        if (frame.contentWindow) isUploadFrame(frame.contentWindow);
      }
      for (const target of identityTargets.keys()) {
        if (!isUploadFrame(target)) {
          identityTargets.delete(target);
          continue;
        }
        postAccountIdentity(target, owner ? String(id) : '');
      }
    }
    return owner;
  }

  function installIdentitySubscriptions() {
    const { pinia } = appServices();
    const stores = ['core-user', 'core-access'].map((name) =>
      pinia?._s?.get(name),
    );
    if (stores.some((store) => !store?.$subscribe)) return false;
    for (const store of stores) {
      if (subscribedStores.has(store)) continue;
      store.$subscribe(syncIdentity, { detached: true, flush: 'sync' });
      subscribedStores.add(store);
    }
    syncIdentity();
    return true;
  }

  function isUploadFrame(source) {
    if (!source) return false;
    const knownFrame = verifiedFrames.get(source);
    const frames = knownFrame
      ? [knownFrame]
      : [...document.querySelectorAll('.upload-tool-frame')];
    return frames.some((frame) => {
      try {
        const url = new URL(frame.src, location.href);
        const valid =
          (frame === knownFrame || frame.contentWindow === source) &&
          url.origin === location.origin &&
          url.pathname.endsWith('/tools/upload-tool.html');
        if (valid) {
          verifiedFrames.set(source, frame);
          identityTargets.set(source, frame);
        }
        return valid;
      } catch {
        return false;
      }
    });
  }

  function sendAccountIdentity(target) {
    syncIdentity();
    // Requests must receive a reply even for an empty session or a reloaded
    // iframe. A negative reply makes the upload queue pause instead of retaining
    // credentials from the previous operator.
    postAccountIdentity(target, currentOwner ? currentOwner.slice(5) : '');
  }

  function postAccountIdentity(target, userId) {
    if (!target) return;
    try {
      target.postMessage(
        {
          source: 'kanban-dashboard',
          type: 'kanban-auth-token',
          token: currentToken,
          userId,
        },
        location.origin,
      );
    } catch {
      // A destroyed frame cannot keep transferring; retain all other targets.
      identityTargets.delete(target);
    }
  }

  function addStyles() {
    if (document.querySelector('#kanban-upload-notice-style')) return;
    const style = document.createElement('style');
    style.id = 'kanban-upload-notice-style';
    style.textContent = `
      .kanban-upload-notices{position:fixed;z-index:900;top:74px;right:20px;width:min(360px,calc(100vw - 32px));display:grid;gap:10px;max-height:calc(100dvh - 94px);overflow-y:auto;overscroll-behavior:contain;padding:4px;font-family:ui-sans-serif,system-ui,sans-serif}
      .kanban-upload-notice{padding:15px 17px;border-radius:14px;background:#fff;color:#14243a;box-shadow:0 12px 36px rgb(15 23 42 / 20%)}
      .kanban-upload-notice-head{display:flex;align-items:center;gap:9px}
      .kanban-upload-notice-head strong{flex:1;font-size:14px;line-height:1.4}
      .kanban-upload-notice-dot{width:9px;height:9px;flex:none;border-radius:50%;background:#2563eb}
      .kanban-upload-notice[data-phase="succeeded"] .kanban-upload-notice-dot{background:#059669}
      .kanban-upload-notice[data-phase="failed"] .kanban-upload-notice-dot{background:#dc2626}
      .kanban-upload-notice[data-phase="pending"] .kanban-upload-notice-dot{background:#d97706}
      .kanban-upload-notice-close{display:grid;place-items:center;padding:4px;border:0;background:transparent;color:#64748b;cursor:pointer}
      .kanban-upload-notice-close svg{width:16px;height:16px}
      .kanban-upload-notice-spu{margin-top:6px;color:#52657e;font-size:12px}
      .kanban-upload-notice p{margin:6px 0 0;overflow-wrap:anywhere;color:#334155;font-size:13px;line-height:1.5}
      .kanban-upload-notice-progress{display:flex;gap:8px;align-items:center;margin-top:9px;color:#52657e;font-size:12px;font-variant-numeric:tabular-nums}
      .kanban-upload-notice-progress[hidden]{display:none}
      .kanban-upload-notice-progress progress{min-width:0;width:100%;height:6px;accent-color:#2563eb}
      .kanban-upload-notice-progress span{flex:none}
      .kanban-upload-notice-action{margin-top:10px;padding:0;border:0;background:transparent;color:#1d4ed8;font-size:13px;font-weight:600;cursor:pointer}
      .kanban-upload-notice-more{padding:10px 14px;border:0;border-radius:12px;background:#fff;color:#1d4ed8;font-size:13px;cursor:pointer}
      .kanban-upload-notice-more:hover{background:#eff6ff}
      .kanban-upload-notice-more:focus-visible{outline:2px solid #2563eb;outline-offset:-2px}
      .kanban-upload-notice-action:hover{text-decoration:underline;text-underline-offset:3px}
      .kanban-upload-notice button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
      .dark .kanban-upload-notice{background:#1e293b;color:#f8fafc;box-shadow:0 12px 36px rgb(0 0 0 / 35%)}
      .dark .kanban-upload-notice-spu,.dark .kanban-upload-notice p{color:#cbd5e1}
      .dark .kanban-upload-notice-action{color:#93c5fd}
      .dark .kanban-upload-notice-progress{color:#cbd5e1}
      .dark .kanban-upload-notice-more{background:#1e293b;color:#93c5fd}
      @media(max-width:640px){.kanban-upload-notices{top:62px;right:16px;max-height:calc(100dvh - 82px)}}
    `;
    document.head.append(style);
  }

  function openDraft(draftId) {
    const target = new URL('/tools/upload', location.origin);
    if (draftId) target.searchParams.set('uploadDraft', draftId);
    const { router } = appServices();
    // Do not reload a live upload page while other tasks are transferring.
    if (!router) return;
    void Promise.resolve(
      router.push(`${target.pathname}${target.search}`),
    ).then(() => {
      if (draftId) {
        document
          .querySelector('.upload-tool-frame')
          ?.contentWindow?.postMessage(
            {
              source: 'kanban-dashboard',
              type: 'kanban-upload-draft-focus',
              draftId,
            },
            location.origin,
          );
      }
    });
  }

  function createCard(draftId) {
    const card = document.createElement('div');
    card.className = 'kanban-upload-notice';
    card.dataset.draftId = draftId;
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    const header = document.createElement('div');
    header.className = 'kanban-upload-notice-head';
    const dot = document.createElement('span');
    dot.className = 'kanban-upload-notice-dot';
    dot.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong');
    const close = document.createElement('button');
    close.className = 'kanban-upload-notice-close';
    close.type = 'button';
    close.setAttribute('aria-label', '关闭通知');
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>';
    close.addEventListener('click', () => {
      const notice = notices.get(draftId);
      if (notice) notice.dismissed = true;
      renderNotices();
    });
    header.append(dot, title, close);
    card.append(header);
    const spu = document.createElement('div');
    spu.className = 'kanban-upload-notice-spu';
    card.append(spu);
    const description = document.createElement('p');
    card.append(description);
    const progress = document.createElement('div');
    progress.className = 'kanban-upload-notice-progress';
    progress.append(
      document.createElement('progress'),
      document.createElement('span'),
    );
    card.append(progress);
    const action = document.createElement('button');
    action.className = 'kanban-upload-notice-action';
    action.type = 'button';
    action.addEventListener('click', () => openDraft(draftId));
    card.append(action);
    return card;
  }

  function renderNotices() {
    if (!document.body) return;
    const all = [...notices.values()]
      .toReversed()
      .filter((notice) => !notice.dismissed);
    const visible = all.slice(0, 3);
    if (visible.length === 0) {
      noticeStack?.remove();
      noticeStack = null;
      return;
    }
    addStyles();
    if (!noticeStack) {
      noticeStack = document.createElement('section');
      noticeStack.className = 'kanban-upload-notices';
      noticeStack.setAttribute('aria-label', '图片上传任务通知');
      document.body.append(noticeStack);
    }
    const children = visible.map((notice) => {
      let card = cards.get(notice.draftId);
      if (!card) {
        card = createCard(notice.draftId);
        cards.set(notice.draftId, card);
      }
      card.dataset.phase = notice.phase;
      card.querySelector('strong').textContent = phases[notice.phase];
      card
        .querySelector('.kanban-upload-notice-close')
        .setAttribute('aria-label', `关闭 ${notice.spu || '上传任务'} 通知`);
      const spu = card.querySelector('.kanban-upload-notice-spu');
      spu.hidden = !notice.spu;
      spu.textContent = notice.spu ? `SPU ${notice.spu}` : '';
      card.querySelector('p').textContent = notice.message;
      const progress = card.querySelector('.kanban-upload-notice-progress');
      progress.hidden = !notice.progress;
      if (notice.progress) {
        const bar = progress.querySelector('progress');
        bar.max = notice.progress.total;
        bar.value = notice.progress.completed;
        bar.setAttribute('aria-label', `${notice.spu}上传进度`);
        progress.querySelector('span').textContent =
          `${notice.progress.completed} / ${notice.progress.total} ${notice.progress.unit === 'chunks' ? '片' : '个文件'}`;
      }
      card.querySelector('.kanban-upload-notice-action').textContent =
        notice.cached && ['failed', 'pending'].includes(notice.phase)
          ? '查看任务并重试'
          : '查看任务';
      return card;
    });
    if (all.length > visible.length) {
      const more = document.createElement('button');
      more.className = 'kanban-upload-notice-more';
      more.type = 'button';
      more.textContent = `另有 ${all.length - visible.length} 个任务，查看全部`;
      more.addEventListener('click', () => openDraft());
      children.push(more);
    }
    // Reuse unchanged cards so progress messages do not steal keyboard focus.
    for (const child of noticeStack.children)
      if (!children.includes(child)) child.remove();
    children.forEach((child, index) => {
      if (noticeStack.children[index] !== child)
        noticeStack.insertBefore(child, noticeStack.children[index] || null);
    });
  }

  function receiveNotice(data) {
    const owner = syncIdentity();
    if (!owner) return;
    if (
      data.ownerKey === undefined
        ? !allowLegacyMessages || legacyOwner !== owner
        : data.ownerKey !== owner
    )
      return;
    if (!Object.hasOwn(phases, data.phase)) return;
    const draftId = String(data.draftId || '').slice(0, 100);
    if (!draftId) return;
    const previous = notices.get(draftId);
    const progress = data.progress;
    notices.set(draftId, {
      draftId,
      cached: data.cached === true,
      dismissed: Boolean(
        previous?.dismissed &&
        (previous.phase === data.phase ||
          (!terminal.has(data.phase) && !terminal.has(previous.phase))),
      ),
      message: String(data.message || '').slice(0, 300),
      phase: data.phase,
      spu: String(data.spu || '').slice(0, 80),
      progress:
        progress &&
        Number.isFinite(progress.completed) &&
        Number.isFinite(progress.total) &&
        progress.total > 0 &&
        ['chunks', 'files'].includes(progress.unit)
          ? {
              completed: Math.min(
                progress.total,
                Math.max(0, progress.completed),
              ),
              total: progress.total,
              unit: progress.unit,
            }
          : null,
    });
    renderNotices();
  }

  window.addEventListener(
    'message',
    (event) => {
      if (
        event.origin !== location.origin ||
        event.data?.source !== 'kanban-upload-tool'
      )
        return;
      if (!isUploadFrame(event.source)) return;
      if (event.data.type === 'kanban-auth-token-request') {
        sendAccountIdentity(event.source);
      } else if (event.data.type === 'kanban-upload-task-status') {
        // This bridge is loaded before the app. Consume only upload status events,
        // including stale-owner events, so the older single-notice Vue chunk cannot
        // render a duplicate or leak a previous operator's late task status.
        event.stopImmediatePropagation();
        receiveNotice(event.data);
      }
    },
    true,
  );
})();
