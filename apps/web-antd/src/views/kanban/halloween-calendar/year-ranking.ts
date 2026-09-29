import type { HalloweenRow } from '#/api/kanban/halloween-calendar';

export interface YearRankSite {
  current: number;
  delta: number;
  id: string;
  owner: string;
  previous: number;
  site: string;
}

export interface YearRankProduct {
  current: number;
  delta: number;
  previous: number;
  sites: YearRankSite[];
  spu: string;
  totalSites: number;
  yoy: null | number;
}

/** Same cohort as periodSummary: only matching current/previous site sales. */
export function rankYearChanges(
  rows: HalloweenRow[],
  periodIndex: 'all' | number,
) {
  const products = new Map<string, YearRankProduct>();
  for (const row of rows) {
    const product = products.get(row.spu) ?? {
      current: 0,
      delta: 0,
      previous: 0,
      sites: [],
      spu: row.spu,
      totalSites: 0,
      yoy: null,
    };
    products.set(row.spu, product);
    product.totalSites++;
    const period =
      periodIndex === 'all'
        ? row.allStageSales
        : row.salesPeriods?.[periodIndex];
    if (!period || period.actual === null || period.previous === null) continue;
    const current = period.actual;
    const previous = period.previous;
    product.current += current;
    product.previous += previous;
    product.sites.push({
      current,
      delta: current - previous,
      id: row.id,
      owner: row.owner,
      previous,
      site: row.site,
    });
  }
  const matched = [...products.values()].filter(
    (p) => p.sites.length > 0 && p.previous > 0,
  );
  for (const product of matched) {
    product.delta = product.current - product.previous;
    product.yoy =
      product.previous > 0 ? product.delta / product.previous : null;
    product.sites.sort((a, b) => a.site.localeCompare(b.site));
  }
  const growth = matched
    .filter((p) => p.delta > 0)
    .toSorted((a, b) => b.delta - a.delta || a.spu.localeCompare(b.spu));
  const decline = matched
    .filter((p) => p.delta < 0)
    .toSorted((a, b) => a.delta - b.delta || a.spu.localeCompare(b.spu));
  return {
    comparableSpus: matched.length,
    decline: decline.slice(0, 10),
    growth: growth.slice(0, 10),
    netDelta: matched.reduce((sum, p) => sum + p.delta, 0),
    totalDecline: decline.reduce((sum, p) => sum - p.delta, 0),
    totalIncrease: growth.reduce((sum, p) => sum + p.delta, 0),
  };
}
