import type { OverviewState } from './overview-loader';

import { describe, expect, it, vi } from 'vitest';

import {
  createOverviewLoader,
  mergeOverviewSummary,
  overviewParams,
} from './overview-loader';

function value(date = '2026-09-02'): OverviewState {
  return {
    availableSnapshotDates: [date],
    snapshot: { snapshot_date: date },
    rows: [],
    pagination: { page: 1, pageSize: 50, total: 7 },
  };
}

describe('progressive overview', () => {
  it('does not recalculate a summary when paging or sorting', async () => {
    const fetcher = vi.fn().mockResolvedValue(value());
    const loader = createOverviewLoader(fetcher);
    await loader.get(
      { snapshotDate: '2026-09-02', page: 1 },
      'legacy',
      'summary',
    );
    await loader.get(
      { snapshotDate: '2026-09-02', page: 3, sortField: 'spend' },
      'legacy',
      'summary',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    await loader.get(
      { snapshotDate: '2026-09-02', countries: ['DE'] },
      'legacy',
      'summary',
    );
    await loader.get({ snapshotDate: '2026-09-02' }, 'daily', 'summary');
    await loader.get({ snapshotDate: '2026-09-02' }, 'legacy', 'rows');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('merges statistics without replacing the visible page or its total', () => {
    const rows = value();
    rows.pagination.page = 3;
    const summary = value();
    summary.pagination.total = 0;
    expect(mergeOverviewSummary(rows, summary).pagination).toEqual(
      rows.pagination,
    );
    expect(() => mergeOverviewSummary(rows, value('2026-09-03'))).toThrow(
      '快照已变化',
    );
    rows.snapshot = { ...rows.snapshot, run_id: 'old-run' };
    summary.snapshot = { ...summary.snapshot, run_id: 'new-run' };
    expect(() => mergeOverviewSummary(rows, summary)).toThrow('快照已重新生成');
  });

  it('invalidates in-flight data after a mutation', async () => {
    let resolve!: (data: OverviewState) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(value());
    const loader = createOverviewLoader(fetcher);
    const first = loader.get({}, 'legacy', 'rows');
    loader.clear();
    resolve(value());
    await first;
    await loader.get({}, 'legacy', 'rows');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('deduplicates requests but isolates returned objects', async () => {
    const fetcher = vi.fn().mockResolvedValue(value());
    const loader = createOverviewLoader(fetcher);
    const [a, b] = await Promise.all([
      loader.get({}, 'legacy', 'rows'),
      loader.get({}, 'legacy', 'rows'),
    ]);
    a.pagination.total = 0;
    expect(b.pagination.total).toBe(7);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not cache failed summaries; row data remains independently cached', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(value())
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue(value());
    const loader = createOverviewLoader(fetcher);
    await loader.get({}, 'legacy', 'rows');
    await expect(loader.get({}, 'legacy', 'summary')).rejects.toThrow(
      'timeout',
    );
    await loader.get({}, 'legacy', 'rows');
    await loader.get({}, 'legacy', 'summary');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('preserves all business filters in summary keys', () => {
    const filters = {
      countries: ['US'],
      projectTags: ['雨靴'],
      hierarchyPaths: ['path'],
      levels: ['target'],
      snapshotDate: '2026-09-02',
      page: 3,
    };
    expect(overviewParams(filters, 'summary')).toEqual({
      ...filters,
      page: undefined,
      responsePart: 'summary',
    });
    expect(filters.page).toBe(3);
  });
});
