import type { AdCvrOptimizationOverview } from '#/api/kanban/types';

export type OverviewRows = Pick<
  AdCvrOptimizationOverview,
  'availableSnapshotDates' | 'pagination' | 'rows' | 'snapshot'
>;
export type OverviewState = OverviewRows &
  Partial<Omit<AdCvrOptimizationOverview, keyof OverviewRows>>;
export type OverviewPart = 'rows' | 'summary';
type Params = Record<string, any>;
type Fetcher = (
  params: Params,
  scope: 'daily' | 'legacy',
) => Promise<OverviewState>;
export type ScheduledTaskResult<T> =
  | { error: unknown }
  | { skipped: true }
  | { value: T };

// Page/order never change aggregate scope. Snapshot is pinned by the row response.
export function overviewParams(params: Params, part: OverviewPart): Params {
  const paging = new Set(['page', 'pageSize', 'sortField', 'sortOrder']);
  return {
    ...Object.fromEntries(
      Object.entries(params).filter(
        ([key]) => part !== 'summary' || !paging.has(key),
      ),
    ),
    responsePart: part,
  };
}

export function pinOverviewSnapshot(
  params: Params,
  currentSnapshotDate: unknown,
  enabled: boolean,
): Params {
  const requested = String(params.snapshotDate ?? '').trim();
  const current = String(currentSnapshotDate ?? '').trim();
  if (!enabled || requested || !current) return { ...params };
  return { ...params, snapshotDate: current };
}

export function createLatestTaskScheduler<T>(delayMs = 150) {
  type Pending = {
    resolve: (result: ScheduledTaskResult<T>) => void;
    task: () => Promise<T>;
    timer?: ReturnType<typeof setTimeout>;
  };
  let pending: Pending | undefined;
  let running = false;

  const launch = () => {
    if (running || !pending) return;
    const item = pending;
    item.timer = setTimeout(async () => {
      if (pending !== item) return;
      pending = undefined;
      running = true;
      try {
        item.resolve({ value: await item.task() });
      } catch (error) {
        item.resolve({ error });
      } finally {
        running = false;
        launch();
      }
    }, Math.max(0, delayMs));
  };

  return {
    clear() {
      if (!pending) return;
      if (pending.timer) clearTimeout(pending.timer);
      pending.resolve({ skipped: true });
      pending = undefined;
    },
    schedule(task: () => Promise<T>): Promise<ScheduledTaskResult<T>> {
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer);
        pending.resolve({ skipped: true });
      }
      return new Promise((resolve) => {
        pending = { resolve, task };
        launch();
      });
    },
  };
}

export function createOverviewLoader(fetcher: Fetcher) {
  let generation = 0;
  const cache = new Map<string, { expires: number; value: OverviewState }>();
  const requests = new Map<string, Promise<OverviewState>>();
  return {
    clear() {
      generation += 1;
      cache.clear();
      requests.clear();
    },
    async get(params: Params, scope: 'daily' | 'legacy', part: OverviewPart) {
      const requestParams = overviewParams(params, part);
      const key = JSON.stringify([scope, requestParams]);
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now())
        return structuredClone(cached.value);
      const existing = requests.get(key);
      if (existing) return structuredClone(await existing);
      const startedGeneration = generation;
      const request = fetcher(requestParams, scope).then((value) => {
        if (generation === startedGeneration) {
          if (cache.size >= 24) {
            const oldest = cache.keys().next();
            if (!oldest.done) cache.delete(oldest.value);
          }
          cache.set(key, {
            expires: Date.now() + 20_000,
            value: structuredClone(value),
          });
        }
        return value;
      });
      requests.set(key, request);
      try {
        return structuredClone(await request);
      } finally {
        if (requests.get(key) === request) requests.delete(key);
      }
    },
  };
}

export function mergeOverviewSummary(
  rows: OverviewState,
  summary: OverviewState,
): OverviewState {
  if (
    String(rows.snapshot?.snapshot_date ?? '') !==
    String(summary.snapshot?.snapshot_date ?? '')
  ) {
    throw new Error('快照已变化，请刷新后重试');
  }
  if (
    rows.snapshot?.run_id &&
    rows.snapshot.run_id !== summary.snapshot?.run_id
  ) {
    throw new Error('快照已重新生成，请刷新后重试');
  }
  return { ...rows, ...summary, rows: rows.rows, pagination: rows.pagination };
}
