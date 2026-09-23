// The transfer iframe is owned by the document, never by a cached route.
// Create it before the operator can submit; never move an already running frame.
(() => {
  if (window.__kanbanUploadFrameHost) return;
  let frame;
  let anchor;
  let lastLayout = '';
  let observer;
  function layout() {
    if (!frame) return;
    const box = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
    const visible = Boolean(box && box.width > 0 && box.height > 0
      && anchor.getClientRects().length > 0 && anchor.parentElement?.checkVisibility?.() !== false);
    const geometry = visible
      ? `${box.left}px|${box.top}px|${box.width}px|${box.height}px` : '';
    if (geometry === lastLayout) return;
    lastLayout = geometry;
    frame.style.visibility = visible ? 'visible' : 'hidden';
    frame.inert = !visible;
    frame.setAttribute('aria-hidden', String(!visible));
    if (visible) {
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height] = geometry.split('|');
    }
  }
  window.__kanbanUploadFrameHost = {
    attach(placeholder) {
      if (!placeholder || placeholder.ownerDocument !== document
        || Object.hasOwn(placeholder.dataset, 'uploadPersistent')) return false;
      const url = new URL(placeholder.src, location.href);
      if (url.origin !== location.origin || !url.pathname.endsWith('/tools/upload-tool.html')) return false;
      anchor = placeholder;
      placeholder.classList.remove('upload-tool-frame');
      placeholder.classList.add('upload-tool-placeholder');
      placeholder.style.visibility = 'hidden';
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      placeholder.style.display = 'block';
      placeholder.style.border = '0';
      placeholder.tabIndex = -1;
      placeholder.setAttribute('aria-hidden', 'true');
      if (!frame) {
        frame = document.createElement('iframe');
        frame.className = 'upload-tool-frame';
        frame.dataset.uploadPersistent = 'true';
        frame.title = '自动传图任务工作区';
        frame.style.cssText = 'position:fixed;z-index:10;border:0;background:#eef3f8;visibility:hidden';
        frame.src = url.href;
        document.body.append(frame);
        window.addEventListener('resize', layout);
        document.addEventListener('scroll', layout, true);
        // KeepAlive DOM changes and layout animations can occur without resize.
        setInterval(layout, 100);
        window.addEventListener('beforeunload', event => {
          if (frame.contentWindow?.__kanbanUploadHasActiveJobs?.()) {
            event.preventDefault();
            event.returnValue = '';
          }
        });
      }
      observer?.disconnect();
      observer = new ResizeObserver(layout);
      observer.observe(placeholder);
      // The route component still addresses its placeholder WindowProxy.
      // Forward only parent-originated auth/focus messages, never arbitrary data.
      placeholder.contentWindow.addEventListener('message', event => {
        if (event.source !== window || event.origin !== location.origin
          || !['kanban-auth-token', 'kanban-upload-draft-focus'].includes(event.data?.type)) return;
        frame.contentWindow?.postMessage(event.data, location.origin);
      });
      lastLayout = 'uninitialized';
      layout();
      return true;
    },
  };
})();
