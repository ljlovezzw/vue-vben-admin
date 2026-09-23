/* eslint-disable vue/one-component-per-file -- Real routing fixture intentionally owns layout, wrappers and page mock. */
import type { App, Component, VNode } from 'vue';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';

import {
  cloneVNode,
  createApp,
  defineComponent,
  Fragment,
  h,
  KeepAlive,
  nextTick,
  Transition,
  watch,
} from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';

import { getTabKey } from '@vben/stores';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'vue/compiler-sfc';

import Entry from './index.vue';
// oxlint-disable-next-line import/no-duplicates -- Vite's raw query is a separate resource used to assert the SFC root shape.
import entrySource from './index.vue?raw';

interface Request {
  instance: number;
  mountedScope: string;
  projectTags: string[];
  scope: string;
  snapshotDate: string;
}
const mocks = vi.hoisted(() => ({
  afterLeave: vi.fn(),
  nextInstance: 0,
  requests: [] as Request[],
  resume: vi.fn(),
}));
vi.mock('./execution-task', () => ({ resumeAdCvrExecutionTask: mocks.resume }));
vi.mock('./TaskWorkbench.vue', () => ({
  default: defineComponent({
    props: {
      projectTags: { type: Array, required: true },
      scope: { type: String, required: true },
      snapshotDate: { type: String, required: true },
    },
    setup(props) {
      const instance = ++mocks.nextInstance;
      const mountedScope = props.scope;
      watch(
        () => [props.scope, props.projectTags, props.snapshotDate],
        () => {
          mocks.requests.push({
            instance,
            mountedScope,
            projectTags: [...props.projectTags] as string[],
            scope: props.scope,
            snapshotDate: props.snapshotDate,
          });
        },
        { deep: true, immediate: true },
      );
      // Preserve ConfigProvider -> LocaleProvider slots-array/Fragment root.
      // A single-element mock would hide the route-transition regression.
      return () =>
        h(Fragment, [
          h(
            'main',
            { 'data-instance': instance, 'data-scope': props.scope },
            JSON.stringify(props),
          ),
          h('aside', { 'data-overlay': instance }),
        ]);
    },
  }),
}));

const MONTHLY = 'KanbanAdCvrOptimization';
const DAILY = 'KanbanDailyAdOptimization';
const OTHER = 'UnrelatedDashboard';
const names = [MONTHLY, DAILY, OTHER];

// Same route.name wrapper as effects/access/src/accessible.ts.
function accessibleWrapper(name: string, component: Component) {
  return defineComponent({
    name,
    setup(props, { attrs, slots }) {
      return () => h(component, { ...props, ...attrs }, slots);
    },
  });
}

describe('advertising route switching with real Transition and KeepAlive', () => {
  let app: App;
  let host: HTMLDivElement;
  let router: Router;
  let warnings: string[];

  async function open(
    name: string,
    query: Record<string, string | string[]> = {},
  ) {
    await router.push({ name, query: { pageKey: name, ...query } });
    // css=false removes CSS timing, not the out-in isLeaving/afterLeave gate.
    for (let count = 0; count < 5; count += 1) await nextTick();
  }
  async function mount() {
    await open(MONTHLY, { projectTags: ['月度款'] });
    await router.isReady();
    app.mount(host);
    await nextTick();
  }
  function visible() {
    const main = host.querySelector<HTMLElement>('main[data-scope]');
    if (!main) {
      throw new Error(
        JSON.stringify({
          route: router.currentRoute.value.fullPath,
          warnings,
          html: host.innerHTML,
          leaves: mocks.afterLeave.mock.calls.length,
        }),
      );
    }
    expect(host.querySelectorAll('main[data-scope]')).toHaveLength(1);
    // A comment preceding the entry div creates DEV_ROOT_FRAGMENT. Require a
    // literal element root, not merely one element among root-level comments.
    expect([...host.childNodes].map((node) => node.nodeType)).toEqual([
      Node.ELEMENT_NODE,
    ]);
    expect(host.firstElementChild?.tagName).toBe('DIV');
    return {
      instance: Number(main.dataset.instance),
      ...(JSON.parse(main.textContent || '{}') as Omit<
        Request,
        'instance' | 'mountedScope'
      >),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nextInstance = 0;
    mocks.requests = [];
    warnings = [];
    host = document.createElement('div');
    document.body.append(host);
    const Other = defineComponent({
      setup: () => () => h('section', { 'data-other-page': '' }, '其他模块'),
    });
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          component: accessibleWrapper(MONTHLY, Entry),
          meta: { keepAlive: true, title: '月度广告' },
          name: MONTHLY,
          path: '/kanban/ad-cvr-optimization',
        },
        {
          component: accessibleWrapper(DAILY, Entry),
          meta: { keepAlive: true, title: '今日广告' },
          name: DAILY,
          path: '/kanban/daily-ad-optimization',
        },
        {
          component: accessibleWrapper(OTHER, Other),
          meta: { keepAlive: true, title: '其他模块' },
          name: OTHER,
          path: '/unrelated',
        },
      ],
    });
    const Layout = defineComponent({
      setup: () => () =>
        h(RouterView, null, {
          default: ({
            Component: View,
            route,
          }: {
            Component: VNode;
            route: RouteLocationNormalizedLoaded;
          }) =>
            h(
              Transition,
              {
                css: false,
                mode: 'out-in',
                onAfterLeave: mocks.afterLeave,
                onLeave: (_element: Element, done: () => void) =>
                  queueMicrotask(done),
              },
              {
                default: () =>
                  h(KeepAlive, { include: names }, [
                    View ? cloneVNode(View, { key: getTabKey(route) }) : null,
                  ]),
              },
            ),
        }),
    });
    app = createApp(Layout);
    app.config.warnHandler = (message) => {
      warnings.push(message);
    };
    app.use(router);
  });
  afterEach(() => {
    app.unmount();
    host.remove();
  });

  it('has exactly one literal div template root, including development comments', async () => {
    await mount();
    const { descriptor, errors } = parse(entrySource);
    expect(errors).toEqual([]);
    expect(descriptor.template?.ast?.children).toHaveLength(1);
    const root = descriptor.template?.ast?.children[0];
    expect(root?.type).toBe(1);
    if (root?.type === 1) expect(root.tag).toBe('div');
  });

  it('completes leave hooks through monthly, daily, unrelated and repeated return tabs', async () => {
    await mount();
    const monthly = visible().instance;
    await open(DAILY, { projectTags: ['雨靴'], snapshotDate: '2026-09-17' });
    const daily = visible().instance;
    expect(daily).not.toBe(monthly);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await open(OTHER, { projectTags: ['无关'], snapshotDate: '2099-01-01' });
      expect(host.querySelector('[data-other-page]')?.textContent).toBe(
        '其他模块',
      );
      expect(host.querySelector('main[data-scope]')).toBeNull();
      await open(MONTHLY, { projectTags: ['月度款'] });
      expect(visible()).toEqual({
        instance: monthly,
        projectTags: ['月度款'],
        scope: 'legacy',
        snapshotDate: '',
      });
      await open(DAILY, { projectTags: ['雨靴'], snapshotDate: '2026-09-17' });
      expect(visible()).toEqual({
        instance: daily,
        projectTags: ['雨靴'],
        scope: 'daily',
        snapshotDate: '2026-09-17',
      });
    }
    expect(mocks.afterLeave).toHaveBeenCalledTimes(10);
    expect(mocks.resume.mock.calls).toEqual([['legacy'], ['daily']]);
    expect(mocks.requests).toHaveLength(2);
    expect(
      warnings.filter((message) =>
        /non-element root|cannot be animated|KeepAlive|Transition/.test(
          message,
        ),
      ),
    ).toEqual([]);
  });

  it('keeps cached scopes fixed and only synchronizes the current owning route filters', async () => {
    await mount();
    const monthly = visible().instance;
    const calls = (instance: number) =>
      mocks.requests.filter((request) => request.instance === instance);
    const monthlyBefore = calls(monthly).length;
    await open(DAILY, { projectTags: ['雨靴'], snapshotDate: '2026-09-17' });
    const daily = visible().instance;
    expect(calls(monthly)).toHaveLength(monthlyBefore);
    await open(DAILY, { projectTags: ['圣诞'], snapshotDate: '2026-09-18' });
    expect(visible()).toEqual({
      instance: daily,
      projectTags: ['圣诞'],
      scope: 'daily',
      snapshotDate: '2026-09-18',
    });
    expect(calls(monthly)).toHaveLength(monthlyBefore);
    const dailyBefore = calls(daily).length;
    await open(OTHER, {
      projectTags: ['不属于广告'],
      snapshotDate: '2099-12-31',
    });
    expect(host.querySelector('[data-other-page]')).not.toBeNull();
    expect(calls(monthly)).toHaveLength(monthlyBefore);
    expect(calls(daily)).toHaveLength(dailyBefore);
    await open(MONTHLY, {
      projectTags: ['啤酒服'],
      snapshotDate: '2098-01-01',
    });
    expect(visible()).toEqual({
      instance: monthly,
      projectTags: ['啤酒服'],
      scope: 'legacy',
      snapshotDate: '',
    });
    expect(calls(daily)).toHaveLength(dailyBefore);
    await open(DAILY, { projectTags: ['圣诞'], snapshotDate: '2026-09-18' });
    expect(visible().instance).toBe(daily);
    expect(
      mocks.requests.every((request) => request.scope === request.mountedScope),
    ).toBe(true);
    expect(calls(monthly).every((request) => request.snapshotDate === '')).toBe(
      true,
    );
    expect(
      mocks.requests.some((request) =>
        request.projectTags.includes('不属于广告'),
      ),
    ).toBe(false);
    expect(mocks.resume.mock.calls).toEqual([['legacy'], ['daily']]);
  });
});
