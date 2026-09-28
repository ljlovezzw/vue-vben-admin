type HttpError = {
  response?: {
    data?: { code?: string };
    headers?: Record<string, string>;
    status?: number;
  };
};

export async function retryQueryBusy<T>(
  operation: () => Promise<T>,
  options: {
    signal?: AbortSignal;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<T> {
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const response = (error as HttpError)?.response;
      if (
        attempt === 2 ||
        options.signal?.aborted ||
        response?.status !== 503 ||
        response.data?.code !== 'QUERY_BUSY'
      ) {
        throw error;
      }
      const retryAfter = Number(response.headers?.['retry-after']);
      const delay = Number.isFinite(retryAfter)
        ? Math.min(3000, Math.max(1000, retryAfter * 1000))
        : 2000;
      await sleep(delay);
      if (options.signal?.aborted) throw error;
    }
  }
  throw new Error('Unreachable query retry state');
}
