import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick, reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Entry from './index.vue';

const mocks = vi.hoisted(() => ({ resume: vi.fn(), route: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: mocks.route }));
vi.mock('./execution-task', () => ({
  resumeAdCvrExecutionTask: mocks.resume,
}));
vi.mock('./TaskWorkbench.vue', () => ({
  default: defineComponent({
    props: {
      scope: { type: String, required: true },
      projectTags: { type: Array, required: true },
      snapshotDate: { type: String, required: true },
    },
    setup: (props) => () => h('main', JSON.stringify(props)),
  }),
}));

describe('advertising workbench entry', () => {
  let app: App;
  let host: HTMLDivElement;
  let route: {
    name: string;
    query: Record<string, (null | string)[] | null | string>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    route = reactive({ name: 'KanbanAdCvrOptimization', query: {} });
    mocks.route.mockReturnValue(route);
    host = document.createElement('div');
    document.body.append(host);
    app = createApp(Entry);
  });
  afterEach(() => {
    app.unmount();
    host.remove();
  });

  it('renders only the workbench and restores execution tracking', () => {
    app.mount(host);
    expect(JSON.parse(host.textContent || '{}')).toEqual({
      scope: 'legacy',
      projectTags: [],
      snapshotDate: '',
    });
    expect(host.querySelectorAll('main')).toHaveLength(1);
    expect(host.querySelector('button')).toBeNull();
    expect(mocks.resume).toHaveBeenCalledExactlyOnceWith('legacy');
  });

  it('retains the daily scope and filters while another cached route is active', async () => {
    route.name = 'KanbanDailyAdOptimization';
    route.query = { projectTags: ['雨靴', null], snapshotDate: '2026-09-17' };
    app.mount(host);
    expect(JSON.parse(host.textContent || '{}')).toEqual({
      scope: 'daily',
      projectTags: ['雨靴'],
      snapshotDate: '2026-09-17',
    });
    expect(mocks.resume).toHaveBeenCalledExactlyOnceWith('daily');

    route.name = 'KanbanAdCvrOptimization';
    route.query.projectTags = '啤酒服';
    await nextTick();
    expect(JSON.parse(host.textContent || '{}')).toEqual({
      scope: 'daily',
      projectTags: ['雨靴'],
      snapshotDate: '2026-09-17',
    });
    expect(mocks.resume).toHaveBeenCalledExactlyOnceWith('daily');

    route.name = 'KanbanDailyAdOptimization';
    route.query = { projectTags: '啤酒服', snapshotDate: '2026-09-18' };
    await nextTick();
    expect(JSON.parse(host.textContent || '{}')).toEqual({
      scope: 'daily',
      projectTags: ['啤酒服'],
      snapshotDate: '2026-09-18',
    });
    expect(mocks.resume).toHaveBeenCalledExactlyOnceWith('daily');
  });
});
