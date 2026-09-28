import { describe, expect, it } from 'vitest';

import { compactGap, compactYoy, trendTone } from './progress-display';
import { periodSummary } from './sales-progress';
describe('concise progress states', () => {
  it('uses color and words for both directions', () => {
    expect(trendTone(12)).toBe('trend-up');
    expect(trendTone(-12)).toBe('trend-down');
    expect(compactGap(12.34)).toBe('超前 12.3 个百分点');
    expect(compactGap(-12.34)).toBe('滞后 12.3 个百分点');
  });
  it('does not imply a direction for missing or rounded zero values', () => {
    for (const n of [null, Number.NaN, 0, 0.01, -0.01])
      expect(trendTone(n)).toBe('trend-neutral');
    expect(compactGap(null)).toBe('待核对');
    expect(compactGap(0)).toBe('持平');
  });
  it('keeps future, missing and zero-base comparisons explicit', () => {
    const s = periodSummary([], 0);
    expect(compactYoy(s)).toBe('待核对');
    expect(compactYoy(s, 'upcoming')).toBe('未开始');
    expect(compactYoy({ ...s, current: 10, previous: 0 })).toBe('去年为 0');
    expect(compactYoy({ ...s, current: 0, previous: 0 })).toBe('两年均为 0');
    expect(compactYoy({ ...s, current: 110, previous: 100, yoy: 0.1 })).toBe(
      '+10.0%',
    );
    expect(compactYoy({ ...s, current: 90, previous: 100, yoy: -0.1 })).toBe(
      '-10.0%',
    );
  });
});
