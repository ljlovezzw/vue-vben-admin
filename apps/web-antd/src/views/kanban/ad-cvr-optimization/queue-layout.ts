import type { Ref } from 'vue';

import { ref, watch } from 'vue';

const EDGE_GAP = 12;

export function calculateQueueDock(input: {
  gridHeight: number;
  gridTop: number;
  headerBottom: number;
  panelHeight: number;
  viewportHeight: number;
  viewportWidth: number;
}): Record<string, string> {
  const top = Math.max(0, input.headerBottom) + EDGE_GAP;
  if (input.viewportWidth <= 900 || input.viewportHeight - top < 480) {
    return {};
  }
  return {
    '--queue-height': `${input.viewportHeight - top - EDGE_GAP}px`,
    '--queue-offset': `${Math.max(
      0,
      Math.min(top - input.gridTop, input.gridHeight - input.panelHeight),
    )}px`,
  };
}

export function useQueueDock(
  gridRef: Ref<HTMLElement | undefined>,
  panelRef: Ref<HTMLElement | undefined>,
) {
  const style = ref<Record<string, string>>({});
  watch([gridRef, panelRef], ([grid, panel], _previous, onCleanup) => {
    if (!grid || !panel) {
      style.value = {};
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = grid.getBoundingClientRect();
      const header = document.querySelector<HTMLElement>('._scroll__fixed_');
      const position = header ? getComputedStyle(header).position : '';
      const headerBottom =
        header && ['fixed', 'sticky'].includes(position)
          ? header.getBoundingClientRect().bottom
          : 0;
      // The app shell has overflow:hidden, which prevents CSS sticky from
      // tracking the document. Translate only within this grid, not the shell.
      style.value = calculateQueueDock({
        gridHeight: bounds.height,
        gridTop: bounds.top,
        headerBottom,
        panelHeight: panel.getBoundingClientRect().height,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    observer.observe(panel);
    window.addEventListener('scroll', schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', schedule);
    update();
    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    });
  });
  return style;
}
