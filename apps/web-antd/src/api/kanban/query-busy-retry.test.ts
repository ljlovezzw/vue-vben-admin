import { describe, expect, it, vi } from 'vitest';

import { retryQueryBusy } from './query-busy-retry';

const busy = (retryAfter = '2') => ({
  response: {
    data: { code: 'QUERY_BUSY' },
    headers: { 'retry-after': retryAfter },
    status: 503,
  },
});

describe('retryQueryBusy', () => {
  it('retries only a bounded number of busy responses', async () => {
    const operation = vi.fn().mockRejectedValue(busy());
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(retryQueryBusy(operation, { sleep })).rejects.toMatchObject(
      busy(),
    );
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('returns the first successful retry', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(busy())
      .mockResolvedValue('ready');
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(retryQueryBusy(operation, { sleep })).resolves.toBe('ready');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const error = {
      response: { data: { code: 'QUERY_TIMEOUT' }, status: 503 },
    };
    const operation = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(retryQueryBusy(operation, { sleep })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not send another request after cancellation during the delay', async () => {
    const controller = new AbortController();
    const error = busy();
    const operation = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn().mockImplementation(async () => controller.abort());
    await expect(
      retryQueryBusy(operation, { signal: controller.signal, sleep }),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
