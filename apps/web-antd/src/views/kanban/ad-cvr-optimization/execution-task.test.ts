import type { AdCvrOptimizationExecutionResult } from '#/api/kanban/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  adCvrExecutionInProgress,
  adCvrExecutionPhase,
  adCvrExecutionRevision,
  runAdCvrExecutionTask,
} from './execution-task';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  notification: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('#/api/kanban/ad-cvr-optimization', () => ({
  executeAdCvrOptimizationSuggestions: mocks.execute,
}));

vi.mock('ant-design-vue', () => ({
  notification: mocks.notification,
}));

function result(
  overrides: Partial<AdCvrOptimizationExecutionResult> = {},
): AdCvrOptimizationExecutionResult {
  return {
    failed: 0,
    message: '已执行 2 条，未变更 0 条，失败 0 条',
    results: [],
    status: 'succeeded',
    succeeded: 2,
    unchanged: 0,
    ...overrides,
  };
}

describe('runAdCvrExecutionTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates one persistent notification from submitting to executing and success', async () => {
    let finish: (value: AdCvrOptimizationExecutionResult) => void = () => {};
    mocks.execute.mockReturnValue(
      new Promise<AdCvrOptimizationExecutionResult>((resolve) => {
        finish = resolve;
      }),
    );
    const initialRevision = adCvrExecutionRevision.value;

    const task = runAdCvrExecutionTask(['one', 'two'], {});
    expect(adCvrExecutionPhase.value).toBe('submitting');
    expect(mocks.notification.info).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: 'ad-cvr-optimization-execution',
        message: '提交中',
      }),
    );

    await vi.advanceTimersByTimeAsync(450);
    expect(adCvrExecutionPhase.value).toBe('executing');
    expect(mocks.notification.info).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: 'ad-cvr-optimization-execution',
        message: '执行中',
      }),
    );

    finish(result());
    await task;
    expect(mocks.notification.success).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'ad-cvr-optimization-execution',
        message: '执行完成',
      }),
    );
    expect(adCvrExecutionInProgress.value).toBe(false);
    expect(adCvrExecutionRevision.value).toBe(initialRevision + 1);
  });

  it('keeps partial failures visible for operator review', async () => {
    mocks.execute.mockResolvedValue(
      result({
        failed: 1,
        message: '已执行 1 条，未变更 0 条，失败 1 条',
        status: 'partial_failed',
        succeeded: 1,
      }),
    );

    await runAdCvrExecutionTask(['one', 'two'], {});

    expect(mocks.notification.warning).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 0,
        message: '执行完成，部分失败',
      }),
    );
  });

  it('rejects duplicate submissions while a task is active', async () => {
    let finish: (value: AdCvrOptimizationExecutionResult) => void = () => {};
    mocks.execute.mockReturnValue(
      new Promise<AdCvrOptimizationExecutionResult>((resolve) => {
        finish = resolve;
      }),
    );

    const task = runAdCvrExecutionTask(['one'], {});
    await expect(runAdCvrExecutionTask(['two'], {})).rejects.toThrow(
      '已有广告优化任务正在执行',
    );

    finish(result({ succeeded: 1 }));
    await task;
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});
