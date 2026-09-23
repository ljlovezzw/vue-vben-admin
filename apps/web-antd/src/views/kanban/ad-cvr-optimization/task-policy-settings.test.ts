// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file -- The test keeps small inline component mocks beside their assertions. */
import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import Settings from './TaskPolicySettings.vue';

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('#/api/kanban/ad-cvr-optimization', () => ({
  updateAdCvrTaskPolicy: mocks.update,
}));

const basePolicy = {
  mode: 'shadow' as const,
  dailyCapacity: null,
  pilotOwners: ['陈宇星'],
  pilotSpus: ['LLW000015'],
  shadowChecks: ['2026-09-01', '2026-09-02', '2026-09-03'],
  availableShadowDates: ['2026-09-01', '2026-09-02', '2026-09-03'],
  acceptanceNote: '三次快照已经人工核对',
  ruleVersion: 'p3-test',
  version: 2,
  canConfigure: true,
  assignees: ['陈宇星'],
};

describe('task policy settings', () => {
  let app: App | undefined;
  let host: HTMLDivElement;
  afterEach(() => {
    app?.unmount();
    host?.remove();
    vi.clearAllMocks();
  });

  it('requires confirmation before switching to a live pilot mode', async () => {
    host = document.createElement('div');
    document.body.append(host);
    mocks.update.mockResolvedValue({
      ...basePolicy,
      mode: 'single_package',
      version: 3,
    });
    app = createApp(Settings, { policy: basePolicy, scope: 'legacy' });
    app.mount(host);
    host.querySelectorAll<HTMLButtonElement>('.mode-option')[1]?.click();
    await nextTick();
    const save = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) => item.textContent?.includes('保存执行设置'),
    );
    expect(save?.disabled).toBe(false);
    save?.click();
    await nextTick();
    expect(mocks.update).not.toHaveBeenCalled();
    [...document.querySelectorAll<HTMLButtonElement>('.ant-modal button')]
      .find((item) => item.textContent?.includes('确认保存'))
      ?.click();
    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0]?.[0]).toMatchObject({
      mode: 'single_package',
      pilotOwners: ['陈宇星'],
      pilotSpus: ['LLW000015'],
      version: 2,
    });
  });

  it('keeps live modes unavailable without three verified dates', async () => {
    host = document.createElement('div');
    document.body.append(host);
    app = createApp(Settings, {
      policy: { ...basePolicy, shadowChecks: ['2026-09-01'] },
      scope: 'legacy',
    });
    app.mount(host);
    host.querySelectorAll<HTMLButtonElement>('.mode-option')[2]?.click();
    await nextTick();
    expect(host.textContent).toContain('须选满 3 个不同的已归档快照日期');
    const save = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) => item.textContent?.includes('保存执行设置'),
    );
    expect(save?.disabled).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('shows the policy without editing controls for a non-admin operator', async () => {
    host = document.createElement('div');
    document.body.append(host);
    app = createApp(Settings, {
      policy: { ...basePolicy, canConfigure: false },
      scope: 'legacy',
    });
    app.mount(host);
    await nextTick();
    expect(host.textContent).toContain('仅管理员可以修改');
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('.mode-option')].every(
        (item) => item.disabled,
      ),
    ).toBe(true);
    expect(host.textContent).not.toContain('保存执行设置');
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
