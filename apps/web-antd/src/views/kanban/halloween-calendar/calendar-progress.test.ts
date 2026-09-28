import { describe, expect, it } from 'vitest';

import { calendarProgress } from './calendar-progress';
describe('overall sales vs calendar time', () => {
  it('uses 27 of 61 days at the same sales cutoff, not the monthly goal weight', () => {
    const p = calendarProgress(2026, '2026-09-27', 0.315, 200_000, 63_000);
    expect(p.totalDays).toBe(61);
    expect(p.elapsedDays).toBe(27);
    expect(p.timeRate).toBeCloseTo(27 / 61);
    expect(p.points).toBeCloseTo(-12.762_295);
    expect(p.label).toBe('销量落后时间进度 12.8 个百分点');
    expect(p.due).toBeCloseTo((200_000 * 27) / 61);
    expect(p.delta).toBeCloseTo(63_000 - (200_000 * 27) / 61);
  });
  it('counts the first and last day inclusively and clamps outside the season', () => {
    expect(calendarProgress(2026, '2026-08-31', 0, 100, 0).label).toBe(
      '销售周期尚未开始',
    );
    expect(calendarProgress(2026, '2026-09-01', 0, 100, 0).elapsedDays).toBe(1);
    expect(calendarProgress(2026, '2026-10-31', 1, 100, 100).timeRate).toBe(1);
    expect(calendarProgress(2026, '2026-11-07', 1, 100, 100).cutoff).toBe(
      '2026-10-31',
    );
  });
  it('handles missing/invalid dates and missing targets without inventing a lag', () => {
    for (const day of [null, 'bad', '2026-02-30'])
      expect(calendarProgress(2026, day, 0.5, 100, 50).points).toBeNull();
    expect(calendarProgress(2026, '2026-09-27', null, 0, 0).label).toBe(
      '销量目标待核对，暂不比较',
    );
  });
  it('reports ahead, aligned and completion over 100 percent', () => {
    expect(
      calendarProgress(2026, '2026-09-27', 0.8, 100, 80).points,
    ).toBeGreaterThan(0);
    expect(calendarProgress(2026, '2026-09-27', 27 / 61, 61, 27).label).toBe(
      '销量与时间进度持平',
    );
    expect(
      calendarProgress(2026, '2026-10-31', 1.2, 100, 120).points,
    ).toBeCloseTo(20);
  });
});
