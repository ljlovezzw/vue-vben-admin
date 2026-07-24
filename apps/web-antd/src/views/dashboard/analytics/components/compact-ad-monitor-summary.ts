import type { AdMonitorSummary } from '#/api/kanban/types';

export interface AdMonitorFollowSummary {
  adCvr: number;
  adOrders: number;
  adSpendRate: number;
  previousAdCvr: number;
  previousSpend: number;
  totalSalesQty: number;
  totalSpend: number;
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function mergeAdMonitorFollowSummary(
  summary: AdMonitorSummary,
  follow: AdMonitorFollowSummary,
): AdMonitorSummary {
  const totalSpend = Number(follow.totalSpend || 0);
  const previousSpend = Number(follow.previousSpend || 0);
  const adOrders = Number(follow.adOrders || 0);
  const totalSalesQty = Number(follow.totalSalesQty || 0);
  const adCvr = Number(follow.adCvr || 0);
  const previousAdCvr = Number(follow.previousAdCvr || 0);
  const acoas = Number(follow.adSpendRate || 0);

  return {
    ...summary,
    acoas,
    adCvr,
    adOrders,
    adOrderShare: round(ratio(adOrders, totalSalesQty), 4),
    cvrChangePp: round((adCvr - previousAdCvr) * 100, 2),
    last30AdCvr: previousAdCvr,
    overTargetPp:
      summary.targetAcoas > 0
        ? round((acoas - summary.targetAcoas) * 100, 2)
        : 0,
    previousAdCvr,
    previousSpend,
    spendChangeRate: round(ratio(totalSpend - previousSpend, previousSpend), 4),
    totalSalesQty,
    totalSpend,
  };
}
