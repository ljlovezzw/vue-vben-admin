// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file -- The test keeps small inline component mocks beside their assertions. */
import type { App } from 'vue';

import { createApp, h, nextTick, reactive } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import Workbench from './TaskWorkbench.vue';

const mocks = vi.hoisted(() => ({
  policy: vi.fn(),
  queue: vi.fn(),
  detail: vi.fn(),
  history: vi.fn(),
  bulk: vi.fn(),
  preview: vi.fn(),
  submit: vi.fn(),
}));
vi.mock('#/api/kanban/ad-cvr-optimization', () => ({
  fetchAdCvrTaskPolicy: mocks.policy,
  fetchAdCvrTaskPackages: mocks.queue,
  fetchAdCvrTaskPackage: mocks.detail,
  fetchAdCvrTaskHistory: mocks.history,
  bulkAdoptAdCvrTaskDecisions: mocks.bulk,
  previewAdCvrTask: mocks.preview,
  fetchAdCvrBatchTask: vi.fn(),
  fetchAdCvrBatchTasks: vi.fn(),
  fetchAdCvrOptimizationOperationContext: vi.fn(),
  previewAdCvrTaskRetry: vi.fn(),
  reconcileAdCvrExecution: vi.fn(),
  saveAdCvrTaskDecision: vi.fn(),
  transferAdCvrTasks: vi.fn(),
}));
vi.mock('./execution-task', async () => {
  const { ref } = await import('vue');
  return {
    adCvrExecutionInProgress: ref(false),
    runAdCvrTaskPackageExecution: mocks.submit,
  };
});
vi.mock('./queue-layout', () => ({ useQueueDock: () => ({}) }));
vi.mock('./TaskReviews.vue', () => ({ default: { template: '<div />' } }));
vi.mock('./TaskActionParameters.vue', () => ({
  default: { template: '<div />' },
}));

describe('workbench checkbox to batch adoption', () => {
  let app: App | undefined;
  let host: HTMLDivElement;
  it('clears monthly evidence when daily has no published snapshot', async () => {
    const props = reactive({
      scope: 'legacy' as 'daily' | 'legacy',
      projectTags: [],
    });
    mocks.policy.mockResolvedValue({ actor: 'tester', mode: 'shadow' });
    mocks.queue.mockResolvedValueOnce({
      items: [],
      snapshot: {
        date: '2026-09-02',
        rangeStart: '2026-08-03',
        rangeEnd: '2026-09-01',
        status: 'succeeded',
        version: 'v',
      },
      summary: {
        total: 3,
        today: 3,
        urgent: 0,
        blocked: 0,
        observe: 0,
        failed: 0,
      },
      options: { responsibles: [], sites: [] },
      pagination: { page: 1, total: 0 },
    });
    host = document.createElement('div');
    document.body.append(host);
    app = createApp({ render: () => h(Workbench, props) });
    app.mount(host);
    await vi.waitFor(() => expect(host.textContent).toContain('2026-08-03'));
    mocks.queue.mockRejectedValue(new Error('没有可用的广告优化快照'));
    props.scope = 'daily';
    await vi.waitFor(() =>
      expect(host.textContent).toContain('没有可用的广告优化快照'),
    );
    expect(host.textContent).not.toContain('2026-08-03');
    expect(host.textContent).toContain('每日滚动更新 · 等待完整广告快照');
    expect(host.textContent).toContain('广告数据尚未就绪');
    expect(host.querySelector('.kpi strong')?.textContent).toBe('—');
  });
  afterEach(() => {
    app?.unmount();
    host?.remove();
    vi.clearAllMocks();
  });

  it('previews a checked subset before adoption, then clears stale selection and gathers the package action', async () => {
    const snapshot = {
      version: 'r1',
      status: 'succeeded',
      snapshotDate: '2026-09-18',
    };
    const pkg = {
      packageId: 'p1',
      snapshotVersion: 'r1',
      snapshotDate: '2026-09-18',
      spu: 'test',
      site: 'US',
      store: 'test',
      priority: 'urgent',
      suggestionCount: 2,
      reviewedCount: 0,
      pendingCount: 2,
      failedCount: 0,
      taskStatus: 'pending',
    };
    const adopted = new Set<string>();
    mocks.policy.mockResolvedValue({ actor: 'test', mode: 'shadow' });
    mocks.history.mockResolvedValue({ versions: [] });
    mocks.queue.mockResolvedValue({
      items: [pkg],
      snapshot,
      summary: {
        total: 1,
        today: 1,
        urgent: 1,
        blocked: 0,
        observe: 0,
        failed: 0,
      },
      options: { responsibles: [], sites: [] },
      pagination: { page: 1, total: 1 },
    });
    mocks.detail.mockImplementation(async () => ({
      snapshot,
      stale: false,
      nextStage: 'color',
      health: {},
      policy: { mode: 'shadow' },
      stageCounts: { color: { total: 2, reviewed: adopted.size } },
      pagination: { page: 1, total: 2 },
      executionCandidateTotal: adopted.size,
      executionCandidates: ['one', 'two']
        .filter((id) => adopted.has(id))
        .map((id) => ({
          suggestion_id: id,
          entity_name: id,
          level: 'color',
          action_type: 'close_color',
          execution_status: 'not_requested',
          decision_status: 'pending',
          task_decision: 'adopt',
          task_state: { evidence: { eligible: true } },
          metrics: {},
        })),
      items: ['one', 'two'].map((id) => ({
        suggestion_id: id,
        entity_name: id,
        level: 'color',
        action_type: 'close_color',
        execution_status: 'not_requested',
        decision_status: 'pending',
        task_decision: adopted.has(id) ? 'adopt' : undefined,
        task_state: { evidence: { eligible: true } },
        metrics: {},
      })),
    }));
    mocks.bulk.mockImplementation(
      async ({ suggestionIds }: { suggestionIds: string[] }) => {
        suggestionIds.forEach((id) => adopted.add(id));
        return { newlyAdopted: suggestionIds.length };
      },
    );
    host = document.createElement('div');
    document.body.append(host);
    app = createApp(Workbench, { scope: 'legacy' });
    app.mount(host);
    await vi.waitFor(() =>
      expect(host.querySelectorAll('.node-table tbody input')).toHaveLength(2),
    );
    expect(host.querySelectorAll('.queue-filters .ant-select')).toHaveLength(2);
    expect(host.querySelector('.queue-list')?.textContent).toContain(
      '等待逐层处理',
    );
    expect(host.querySelector('.row-actions')?.textContent).toContain(
      '采纳关闭',
    );
    const checkbox = host.querySelector<HTMLInputElement>(
      '.node-table tbody input',
    );
    expect(checkbox?.disabled).toBe(false);
    checkbox?.click();
    await nextTick();
    expect(host.querySelector('.action-bar')?.textContent).toContain(
      '0 个待提交动作',
    );
    const button = [
      ...host.querySelectorAll<HTMLButtonElement>('.stage-bulk-actions button'),
    ].find((item) => item.textContent?.includes('采纳'));
    button?.click();
    await nextTick();
    expect(mocks.bulk).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('将保存以下 1 项判断');
    [...document.querySelectorAll<HTMLButtonElement>('.ant-modal button')]
      .find((item) => item.textContent?.includes('确认采纳'))
      ?.click();
    await vi.waitFor(() =>
      expect(host.querySelector('.action-bar')?.textContent).toContain(
        '1 个待提交动作',
      ),
    );
    expect(mocks.bulk.mock.calls[0]?.[0].suggestionIds).toEqual(['one']);
    expect(
      host.querySelector<HTMLInputElement>('.node-table tbody input')?.checked,
    ).toBe(false);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
    host
      .querySelector<HTMLInputElement>('input[aria-label="选择 two"]')
      ?.click();
    await nextTick();
    [...host.querySelectorAll<HTMLButtonElement>('.action-bar button')]
      .find((item) => item.textContent?.includes('清空'))
      ?.click();
    await nextTick();
    expect(host.querySelector('.action-bar')?.textContent).toContain(
      '1 个待提交动作',
    );
    mocks.preview.mockResolvedValue({
      ready: true,
      executionAllowed: false,
      finalIds: ['one'],
      finalCount: 1,
      colorAdIds: {},
      blockers: [],
      warnings: [],
      items: [],
      actionCounts: {},
      selectedCount: 1,
      validatedCount: 1,
      inheritedCount: 0,
      suppressedCount: 0,
      previewHash: 'test-only',
    });
    [...host.querySelectorAll<HTMLButtonElement>('.action-bar button')]
      .find((item) => item.textContent?.includes('预览变更'))
      ?.click();
    await nextTick();
    const checkPreview = [
      ...document.querySelectorAll<HTMLButtonElement>('.ant-modal button'),
    ].find((item) => item.textContent?.includes('检查并预览'));
    expect(checkPreview).toBeDefined();
    checkPreview?.click();
    await vi.waitFor(() => expect(mocks.preview).toHaveBeenCalledOnce());
    expect(mocks.preview.mock.calls[0]?.[0].suggestionIds).toEqual(['one']);
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('当前影子模式不下发广告修改'),
    );
    const submit = [
      ...document.querySelectorAll<HTMLButtonElement>('.ant-modal button'),
    ].find((item) => item.textContent?.includes('确认提交执行'));
    expect(submit?.disabled).toBe(true);
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('offers a direct retain decision for a hold recommendation', async () => {
    const snapshot = { version: 'r2', date: '2026-09-18', status: 'succeeded' };
    mocks.policy.mockResolvedValue({ actor: 'test', mode: 'shadow' });
    mocks.queue.mockResolvedValue({
      items: [
        {
          packageId: 'p2',
          snapshotVersion: 'r2',
          snapshotDate: '2026-09-18',
          spu: 'test',
          site: 'US',
          store: 'test',
          priority: 'routine',
          suggestionCount: 1,
          reviewedCount: 0,
          pendingCount: 1,
          failedCount: 0,
        },
      ],
      snapshot,
      summary: {
        total: 1,
        today: 1,
        urgent: 0,
        blocked: 0,
        observe: 0,
        failed: 0,
      },
      options: { responsibles: [], sites: [] },
      pagination: { page: 1, total: 1 },
    });
    mocks.detail.mockResolvedValue({
      snapshot,
      nextStage: 'color',
      health: {},
      stageCounts: { color: { total: 1, reviewed: 0 } },
      pagination: { page: 1, total: 1 },
      items: [
        {
          suggestion_id: 'hold-1',
          entity_name: '保留对象',
          level: 'color',
          action_type: 'hold',
          execution_status: 'not_requested',
          task_state: { evidence: { eligible: false, state: 'manual' } },
          metrics: {},
        },
      ],
    });
    host = document.createElement('div');
    document.body.append(host);
    app = createApp(Workbench, { scope: 'legacy' });
    app.mount(host);
    await vi.waitFor(() =>
      expect(
        host.querySelector('.row-actions')?.textContent?.replaceAll(' ', ''),
      ).toContain('保留'),
    );
    expect(mocks.bulk).not.toHaveBeenCalled();
  });
});
