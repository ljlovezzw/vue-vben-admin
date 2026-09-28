import type {
  HalloweenRow,
  HalloweenSalesPeriod,
} from '#/api/kanban/halloween-calendar';

import { describe, expect, it } from 'vitest';

import {
  paceLabel,
  periodSummary,
  yearPaceLabel,
  yoyLabel,
} from './sales-progress';

const row = (p: HalloweenSalesPeriod) =>
  ({ salesPeriods: [p] }) as HalloweenRow;
describe('halloween stage pace and same-window comparisons', () => {
  it('uses weighted totals, keeps target and yoy cohorts separate', () => {
    const rows = [
      row({ target: 100, due: 50, actual: 60, previous: 40 }),
      row({ target: null, due: null, actual: 30, previous: 20 }),
    ];
    const s = periodSummary(rows, 0);
    expect(s.actual).toBe(60);
    expect(s.rate).toBe(0.6);
    expect(s.delta).toBe(10);
    expect(s.points).toBe(10);
    expect(s.current).toBe(90);
    expect(s.previous).toBe(60);
    expect(s.yoy).toBe(0.5);
    expect(paceLabel(s, 'current')).toBe('高于均摊 10.0 个百分点');
    expect(yoyLabel(s)).toBe('+50.0%');
    expect(yearPaceLabel(s, 'current')).toBe('比去年同期多 50.0%');
  });
  it('shows lag in units and percentage points', () => {
    const s = periodSummary(
      [row({ target: 200, due: 100, actual: 60, previous: 80 })],
      0,
    );
    expect(s.delta).toBe(-40);
    expect(paceLabel(s, 'done')).toBe('低于均摊 20.0 个百分点');
    expect(yoyLabel(s)).toBe('-25.0%');
  });
  it('missing history is excluded, a real zero is retained', () => {
    const s = periodSummary(
      [
        row({ target: 100, due: 50, actual: 10, previous: null }),
        row({ target: 100, due: 50, actual: 10, previous: 0 }),
      ],
      0,
    );
    expect(s.matchedCount).toBe(1);
    expect(s.previous).toBe(0);
    expect(s.yoy).toBeNull();
    expect(yoyLabel(s)).toContain('不计算同比');
  });
  it('empty scope never claims zero sales or progress', () => {
    const s = periodSummary([], 0);
    expect(s.actual).toBeNull();
    expect(s.previous).toBeNull();
    expect(paceLabel(s, 'current')).toBe('进度待核对');
    expect(yoyLabel(s)).toBe('暂无可比数据');
  });
  it('upcoming and goal-free stages never claim lag', () => {
    const s = periodSummary([], 0);
    expect(paceLabel(s, 'upcoming')).toBe('未开始');
    expect(paceLabel(s, 'done', false)).toBe('未设销售目标');
  });
  it('higher YoY sales remain ahead even below a higher current target', () => {
    const s = periodSummary(
      [row({ target: 200, due: 160, actual: 150, previous: 100 })],
      0,
    );
    expect(yearPaceLabel(s, 'current')).toBe('比去年同期多 50.0%');
    expect(paceLabel(s, 'current')).toBe('低于均摊 5.0 个百分点');
    expect(yearPaceLabel(s, 'upcoming')).toBe('未开始');
  });
  it('filtering input rows scopes every metric', () => {
    const rows = [
      row({ target: 100, due: 50, actual: 60, previous: 40 }),
      row({ target: 900, due: 450, actual: 90, previous: 180 }),
    ];
    expect(periodSummary(rows, 0).rate).toBe(0.15);
    expect(periodSummary(rows.slice(0, 1), 0).rate).toBe(0.6);
  });
});
