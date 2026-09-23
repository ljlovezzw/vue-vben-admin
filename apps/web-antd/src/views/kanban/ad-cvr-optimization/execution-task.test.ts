import type { AdCvrBatchTask } from '#/api/kanban/ad-cvr-optimization';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  adCvrExecutionInProgress,
  resumeAdCvrExecutionTask,
  runAdCvrTaskPackageExecution,
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
  submitAdCvrTaskPackage: mocks.submit,
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

const payload = {
  requestId: 'signed-preview-request-0001',
  previewHash: 'server-preview-signature',
  suggestionIds: ['a', 'b'],
};

describe('p3 durable background execution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits once and polls progress without keeping a write request open', async () => {
    mocks.submit.mockResolvedValue(task('queued'));
    mocks.get.mockResolvedValue(task('succeeded'));
    const promise = runAdCvrTaskPackageExecution(payload, 'legacy');
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;
    expect(result.status).toBe('succeeded');
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.submit).toHaveBeenCalledWith(payload, 'legacy');
    expect(mocks.submit.mock.calls[0]?.[0]).toBe(payload);
    expect(mocks.get).toHaveBeenCalledWith('task-one', 'legacy');
    expect(adCvrExecutionInProgress.value).toBe(false);
  });

  it('rejects duplicate submissions while running', async () => {
    mocks.submit.mockResolvedValue(task('queued'));
    mocks.get.mockResolvedValue(task('succeeded'));
    const promise = runAdCvrTaskPackageExecution(payload, 'legacy');
    await expect(
      runAdCvrTaskPackageExecution(payload, 'daily'),
    ).rejects.toThrow('已有广告优化任务');
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
    await expect(
      runAdCvrTaskPackageExecution(payload, 'legacy'),
    ).rejects.toThrow('timeout');
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.notification.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('勿直接重复提交'),
      }),
    );
  });

  it('keeps interrupted results visible and never resubmits', async () => {
    mocks.submit.mockResolvedValue(task('interrupted'));
    await runAdCvrTaskPackageExecution(payload, 'legacy');
    expect(mocks.notification.warning).toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.notification.success).not.toHaveBeenCalled();
  });

  it('forwards the signed payload to the daily scope unchanged', async () => {
    mocks.submit.mockResolvedValue(task('succeeded'));
    await runAdCvrTaskPackageExecution(payload, 'daily');
    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(payload, 'daily');
    expect(mocks.submit.mock.calls[0]?.[0]).toBe(payload);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('does not resume or replay completed batches', async () => {
    mocks.list.mockResolvedValue({ tasks: [task('succeeded')] });
    await resumeAdCvrExecutionTask('legacy');
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(adCvrExecutionInProgress.value).toBe(false);
  });

  it('recovers a transient polling failure without submitting again', async () => {
    mocks.submit.mockResolvedValue(task('queued'));
    mocks.get
      .mockRejectedValueOnce(new Error('temporary read failure'))
      .mockResolvedValueOnce(task('succeeded'));
    const promise = runAdCvrTaskPackageExecution(payload, 'legacy');
    await vi.advanceTimersByTimeAsync(4000);
    const result = await promise;
    expect(result.status).toBe('succeeded');
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.notification.error).not.toHaveBeenCalled();
  });

  it('stops after five failed reads and releases the busy state without replay', async () => {
    mocks.submit.mockResolvedValue(task('queued'));
    mocks.get.mockRejectedValue(new Error('read timeout'));
    const promise = runAdCvrTaskPackageExecution(payload, 'legacy');
    await Promise.all([
      expect(promise).rejects.toThrow('read timeout'),
      vi.advanceTimersByTimeAsync(10_000),
    ]);
    expect(mocks.get).toHaveBeenCalledTimes(5);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(adCvrExecutionInProgress.value).toBe(false);
    expect(mocks.notification.success).not.toHaveBeenCalled();
  });
});
