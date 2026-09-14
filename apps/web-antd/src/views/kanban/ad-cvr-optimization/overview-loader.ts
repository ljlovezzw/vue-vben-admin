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
