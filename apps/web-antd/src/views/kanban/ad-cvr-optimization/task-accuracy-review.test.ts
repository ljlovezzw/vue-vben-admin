// @vitest-environment happy-dom
import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';

import Accuracy from './TaskAccuracyReview.vue';
import Performance from './TaskPerformanceReview.vue';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock('#/api/kanban/ad-cvr-optimization', () => ({
  fetchAdCvrAccuracy: mocks.fetch,
  saveAdCvrAccuracy: mocks.save,
}));
let app: App | undefined;
let host: HTMLDivElement;
function mount(
  component: typeof Accuracy | typeof Performance,
  props: Record<string, unknown>,
) {
  host = document.createElement('div');
  document.body.append(host);
  app = createApp(component, props);
  app.mount(host);
}
afterEach(() => {
  app?.unmount();
  host?.remove();
  vi.clearAllMocks();
});

it.each(['legacy', 'daily'])(
  'loads scoped samples without inventing accuracy for %s',
  async (scope) => {
    mocks.fetch.mockResolvedValue({
      snapshot: { date: '2026-09-20', version: 'v' },
      sampling: '每类最多 5 条',
      counts: [
        {
          action_type: 'close_target',
          actionLabel: '关闭投放',
          total: 10,
          reviewed: 0,
          correct: 0,
        },
      ],
      items: [
        {
          suggestion_id: 's',
          entity_name: '测试投放',
          actionLabel: '关闭投放',
          action_type: 'close_target',
          site: 'US',
          store_name: 'Store',
          spu: 'SPU',
          clicks: 100,
          orders: 0,
          spend: 20,
          reason: '零订单且达到门槛',
          reviewVersion: 0,
          note: '',
          evidence: { reason: '样本达标' },
        },
      ],
    });
    mount(Accuracy, { scope, projectTags: ['雨靴'] });
    await vi.waitFor(() => expect(host.textContent).toContain('测试投放'));
    expect(mocks.fetch).toHaveBeenCalledWith({ projectTags: ['雨靴'] }, scope);
    expect(host.textContent).toContain('未审核');
    expect(host.textContent).not.toContain('100%');
    host.querySelectorAll<HTMLButtonElement>('button')[1]?.click();
    await nextTick();
    const ok = document.querySelector<HTMLButtonElement>(
      '.ant-modal-footer .ant-btn-primary',
    );
    expect(ok?.disabled).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
  },
);

it('does not show a metric comparison while attribution is still open', () => {
  mount(Performance, {
    value: {
      status: 'awaiting_data',
      contextOnly: true,
      level: 'ad_group',
      message: '等待归因观察完成',
      note: '不能归因于单一搜索词',
    },
  });
  expect(host.textContent).toContain('所属广告组背景趋势');
  expect(host.querySelector('table')).toBeNull();
});

it('renders missing ratios separately from true zero', () => {
  mount(Performance, {
    value: {
      status: 'ready',
      contextOnly: false,
      level: 'ad_group',
      message: '窗口已成熟',
      note: '前后各 7 天',
      before: { clicks: 0, acos: null },
      after: { clicks: 10, acos: null },
      changes: { clicks: 10, acos: null },
    },
  });
  const text = host.querySelector('tbody')?.textContent;
  expect(text).toContain('点击01010');
  expect(text).toContain('ACoS (%)———');
});
