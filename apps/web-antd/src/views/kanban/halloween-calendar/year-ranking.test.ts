import type { HalloweenRow } from '#/api/kanban/halloween-calendar';

import { describe, expect, it } from 'vitest';

import { rankYearChanges } from './year-ranking';

function row(
  spu: string,
  site: string,
  actual: null | number,
  previous: null | number,
  stageActual = actual,
) {
  return {
    id: `${spu}|${site}`,
    spu,
    site,
    owner: '当前负责人',
    salesPeriods: [
      { actual, previous, target: null, due: null },
      { actual: stageActual, previous, target: null, due: null },
    ],
  } as HalloweenRow;
}

describe('year-on-year product ranking', () => {
  it('checks the prior-year baseline after aggregating the currently selected sites', () => {
    const rows = [row('A', 'US', 100, 50), row('A', 'CA', 20, 0)];
    expect(rankYearChanges(rows, 0).growth[0]).toMatchObject({
      current: 120,
      previous: 50,
      delta: 70,
    });
    expect(rankYearChanges(rows.slice(1), 0).growth).toEqual([]);
    expect(
      rankYearChanges(
        [
          {
            ...rows[1],
            allStageSales: { actual: 20, previous: 0, target: null, due: null },
          } as HalloweenRow,
        ],
        'all',
      ).growth,
    ).toEqual([]);
  });
  it('uses the continuous all-stage period, never substitutes stage or seasonal sums', () => {
    const product = {
      ...row('A', 'US', 900, 1),
      allStageSales: { actual: 100, previous: 120, target: null, due: null },
    };
    expect(rankYearChanges([product], 'all').decline[0]?.delta).toBe(-20);
    expect(
      rankYearChanges([row('A', 'US', 900, 1)], 'all').comparableSpus,
    ).toBe(0);
  });
  it('nets sites per SPU and ranks units, not growth percentages', () => {
    const result = rankYearChanges(
      [
        row('A', 'US', 1000, 500),
        row('A', 'CA', 100, 300),
        row('B', 'US', 100, 1),
        row('C', 'US', 10, 100),
      ],
      0,
    );
    expect(result.growth.map((p) => [p.spu, p.delta])).toEqual([
      ['A', 300],
      ['B', 99],
    ]);
    expect(result.growth[0]?.sites).toHaveLength(2);
    expect(result.decline.map((p) => [p.spu, p.delta])).toEqual([['C', -90]]);
    expect(result.totalIncrease).toBe(399);
    expect(result.totalDecline).toBe(90);
    expect(result.netDelta).toBe(309);
  });
  it('excludes missing pairs and zero prior-year SPUs but retains a current-year zero decline', () => {
    const rows = [
      row('A', 'US', 80, null),
      row('A', 'CA', 10, 0),
      row('B', 'US', 0, 30),
      row('C', 'US', 0, 0),
    ];
    const result = rankYearChanges(rows, 0);
    expect(result.growth).toEqual([]);
    expect(result.decline[0]).toMatchObject({ spu: 'B', delta: -30, yoy: -1 });
    expect(result.comparableSpus).toBe(1);
    expect(result.netDelta).toBe(-30);
  });
  it('limits both sides to ten with stable SPU tie-breaking and all-product denominators', () => {
    const rows = Array.from({ length: 12 }, (_, n) => [
      row(`UP${n.toString().padStart(2, '0')}`, 'US', 20, 10),
      row(`DOWN${n.toString().padStart(2, '0')}`, 'CA', 0, 10),
    ])
      .flat()
      .toReversed();
    const result = rankYearChanges(rows, 0);
    expect(result.growth).toHaveLength(10);
    expect(result.decline).toHaveLength(10);
    expect(result.growth[0]?.spu).toBe('UP00');
    expect(result.decline[0]?.spu).toBe('DOWN00');
    expect(result.totalIncrease).toBe(120);
    expect(result.totalDecline).toBe(120);
  });
  it('uses the requested period and only the caller-filtered rows', () => {
    const rows = [row('A', 'US', 100, 50, 20), row('B', 'CA', 100, 30, 60)];
    expect(rankYearChanges(rows, 0).growth[0]?.spu).toBe('B');
    expect(rankYearChanges(rows, 1).decline[0]?.spu).toBe('A');
    expect(rankYearChanges(rows.slice(0, 1), 0).growth).toHaveLength(1);
    expect(rankYearChanges(rows, 8).comparableSpus).toBe(0);
    expect(rankYearChanges([], 0).growth).toEqual([]);
    expect(rankYearChanges([row('A', 'US', 10, 10)], 0).decline).toEqual([]);
  });
});
