import type { AdCvrBatchTask } from '#/api/kanban/ad-cvr-optimization';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  adCvrExecutionInProgress,
  adCvrExecutionRevision,
  resumeAdCvrExecutionTask,
  runAdCvrExecutionTask,
} from './execution-task';

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  notification: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));
vi.mock('#/api/kanban/ad-cvr-optimization', () => ({
  submitAdCvrBatchTask: mocks.submit,
  fetchAdCvrBatchTask: mocks.get,
  fetchAdCvrBatchTasks: mocks.list,
}));
vi.mock('ant-design-vue', () => ({ notification: mocks.notification }));

function task(status: AdCvrBatchTask['status']): AdCvrBatchTask {
  return {
    taskId: 'task-one',
    status,
    total: 2,
    completed: status === 'queued' ? 0 : 2,
    createdAt: '',
    message: '',
    result: null,
  };
}

describe('durable background execution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits once and polls progress without keeping a write request open', async () => {
    mocks.submit.mockResolvedValue(task('queued'));
    mocks.get.mockResolvedValue(task('succeeded'));
    const before = adCvrExecutionRevision.value;
    const promise = runAdCvrExecutionTask(['a', 'b'], {});
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;
    expect(result.status).toBe('succeeded');
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.submit.mock.calls[0]?.[0].requestId).toMatch(/^[\w-]{16,64}$/);
    expect(mocks.get).toHaveBeenCalledWith('task-one', 'legacy');
    expect(adCvrExecutionInProgress.value).toBe(false);
    expect(adCvrExecutionRevision.value).toBe(before + 1);
  });

  it('rejects duplicate submissions while running', async () => {
    mocks.submit.mockResolvedValue(task('queued'));
    mocks.get.mockResolvedValue(task('succeeded'));
    const promise = runAdCvrExecutionTask(['a'], {});
    await expect(runAdCvrExecutionTask(['b'], {})).rejects.toThrow(
      '已有广告优化任务',
    );
    await vi.advanceTimersByTimeAsync(2000);
    await promise;
    expect(mocks.submit).toHaveBeenCalledTimes(1);
  });

  it('recovers an existing batch after reload without resubmitting writes', async () => {
    mocks.list.mockResolvedValue({ tasks: [task('running')] });
    mocks.get.mockResolvedValue(task('succeeded'));
    const promise = resumeAdCvrExecutionTask('daily');
    await vi.advanceTimersByTimeAsync(2000);
    await promise;
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledWith('task-one', 'daily');
  });

  it('does not replay a lost submission response', async () => {
    mocks.submit.mockRejectedValue(new Error('timeout'));
    await expect(runAdCvrExecutionTask(['a'], {})).rejects.toThrow('timeout');
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.notification.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('勿直接重复提交'),
      }),
    );
  });

  it('keeps interrupted results visible and never resubmits', async () => {
    mocks.submit.mockResolvedValue(task('interrupted'));
    await runAdCvrExecutionTask(['a'], {});
    expect(mocks.notification.warning).toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.notification.success).not.toHaveBeenCalled();
  });
});
