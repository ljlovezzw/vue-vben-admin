import type { AdMonitorSummary } from '#/api/kanban/types';

import { describe, expect, it } from 'vitest';

import { mergeAdMonitorFollowSummary } from './compact-ad-monitor-summary';

const baseSummary: AdMonitorSummary = {
  acoas: 0.168,
  adCvr: 0.074,
  adOrders: 873,
  adOrderShare: 0.45,
  cvrChangePp: 0.21,
  last30AdCvr: 0.072,
  overTargetPp: -0.4,
  previousAdCvr: 0.072,
  previousSpend: 5000,
  spendChangeRate: 0.04,
  targetAcoas: 0.172,
  targetCoverage: 0.991,
  totalExcessSpend: 260,
  totalSalesQty: 1941,
  totalSpend: 5210,
  yoyAdCvr: 0.061,
  yoyChangePp: 1.3,
};

describe('mergeAdMonitorFollowSummary', () => {
  it('uses the dashboard response for every duplicated KPI', () => {
    const result = mergeAdMonitorFollowSummary(baseSummary, {
      adCvr: 0.0812,
      adOrders: 1024,
      adSpendRate: 0.189,
      previousAdCvr: 0.079,
      previousSpend: 5400,
      totalSalesQty: 2080,
      totalSpend: 6260.28,
    });

    expect(result.totalSpend).toBe(6260.28);
    expect(result.adOrders).toBe(1024);
    expect(result.totalSalesQty).toBe(2080);
    expect(result.adOrderShare).toBe(0.4923);
    expect(result.adCvr).toBe(0.0812);
    expect(result.previousAdCvr).toBe(0.079);
    expect(result.acoas).toBe(0.189);
    expect(result.overTargetPp).toBe(1.7);
    expect(result.totalExcessSpend).toBe(baseSummary.totalExcessSpend);
    expect(result.targetCoverage).toBe(baseSummary.targetCoverage);
  });

  it('keeps zero-denominator comparisons finite', () => {
    const result = mergeAdMonitorFollowSummary(baseSummary, {
      adCvr: 0,
      adOrders: 0,
      adSpendRate: 0,
      previousAdCvr: 0,
      previousSpend: 0,
      totalSalesQty: 0,
      totalSpend: 0,
    });

    expect(result.adOrderShare).toBe(0);
    expect(result.spendChangeRate).toBe(0);
    expect(Number.isFinite(result.overTargetPp)).toBe(true);
  });
});
