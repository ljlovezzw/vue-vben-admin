import { describe, expect, it, vi } from 'vitest';

import { authenticateResponseInterceptor } from './preset-interceptors';
import { RequestClient } from './request-client';

function unauthorized(url: string) {
  return {
    config: { headers: { Authorization: 'Bearer old' }, url },
    response: { status: 401 },
  };
}

function setup() {
  const client = new RequestClient();
  const request = vi.spyOn(client, 'request').mockResolvedValue('ok');
  const doReAuthenticate = vi.fn().mockResolvedValue(undefined);
  const doRefreshToken = vi.fn<() => Promise<string>>();
  const interceptor = authenticateResponseInterceptor({
    client,
    doReAuthenticate,
    doRefreshToken,
    enableRefreshToken: true,
    formatToken: (token) => `Bearer ${token}`,
  });
  const reject = interceptor.rejected;
  if (!reject)
    throw new Error('Authentication interceptor must handle rejection');
  return { client, doReAuthenticate, doRefreshToken, reject, request };
}

describe('concurrent token refresh', () => {
  it('rejects all waiting requests without replaying them when refresh fails', async () => {
    const { client, doReAuthenticate, doRefreshToken, reject, request } =
      setup();
    let fail!: (error: Error) => void;
    doRefreshToken.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const first = reject(unauthorized('/first'));
    const second = reject(unauthorized('/second'));
    const outcomes = Promise.allSettled([first, second]);
    const error = new Error('session expired');
    fail(error);
    expect(await outcomes).toEqual([
      { reason: error, status: 'rejected' },
      { reason: error, status: 'rejected' },
    ]);
    expect(request).not.toHaveBeenCalled();
    expect(doReAuthenticate).toHaveBeenCalledOnce();
    expect(client.refreshTokenQueue).toEqual([]);
    expect(client.isRefreshing).toBe(false);
  });

  it('replays leader and waiters once with the fresh token and a retry marker', async () => {
    const { client, doReAuthenticate, doRefreshToken, reject, request } =
      setup();
    let finish!: (token: string) => void;
    doRefreshToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = reject(unauthorized('/first'));
    const second = reject(unauthorized('/second'));
    finish('new');
    await Promise.all([first, second]);
    expect(doRefreshToken).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(2);
    for (const [, config] of request.mock.calls) {
      expect(config).toMatchObject({
        __isRetryRequest: true,
        headers: { Authorization: 'Bearer new' },
      });
    }
    const [firstCall] = request.mock.calls;
    if (!firstCall)
      throw new Error('Expected the original request to be replayed');
    const retryError = {
      config: firstCall[1],
      response: { status: 401 },
    };
    await expect(reject(retryError)).rejects.toBe(retryError);
    expect(doRefreshToken).toHaveBeenCalledOnce();
    expect(doReAuthenticate).toHaveBeenCalledOnce();
    expect(client.isRefreshing).toBe(false);
  });

  it('rejects an empty refreshed token without sending a request', async () => {
    const { doRefreshToken, reject, request } = setup();
    doRefreshToken.mockResolvedValue('');
    await expect(reject(unauthorized('/first'))).rejects.toThrow('empty token');
    expect(request).not.toHaveBeenCalled();
  });
});
