import type { HalloweenRow } from '#/api/kanban/halloween-calendar';

export function periodSummary(rows: HalloweenRow[], index: number) {
  const periods = rows
    .map((row) => row.salesPeriods?.[index])
    .filter((p) => p !== undefined);
  const paced = periods.filter(
    (p) =>
      p.target !== null && p.target > 0 && p.due !== null && p.actual !== null,
  );
  const matched = periods.filter(
    (p) => p.actual !== null && p.previous !== null,
  );
  const target =
    paced.length > 0 ? paced.reduce((n, p) => n + (p.target ?? 0), 0) : null;
  const actual =
    paced.length > 0 ? paced.reduce((n, p) => n + (p.actual ?? 0), 0) : null;
  const due =
    paced.length > 0 ? paced.reduce((n, p) => n + (p.due ?? 0), 0) : null;
  const current =
    matched.length > 0
      ? matched.reduce((n, p) => n + (p.actual ?? 0), 0)
      : null;
  const previous =
    matched.length > 0
      ? matched.reduce((n, p) => n + (p.previous ?? 0), 0)
      : null;
  return {
    target,
    actual,
    due,
    current,
    previous,
    paceCount: paced.length,
    matchedCount: matched.length,
    rate: target && actual !== null ? actual / target : null,
    expected: target && due !== null ? due / target : null,
    delta: actual !== null && due !== null ? actual - due : null,
    points:
      target && actual !== null && due !== null
        ? ((actual - due) / target) * 100
        : null,
    yoy:
      previous !== null && previous > 0 && current !== null
        ? (current - previous) / previous
        : null,
    yearDelta:
      current !== null && previous !== null ? current - previous : null,
  };
}

export function paceLabel(
  summary: ReturnType<typeof periodSummary>,
  state: string,
  hasTarget = true,
) {
  if (state === 'upcoming') return '未开始';
  if (!hasTarget) return '未设销售目标';
  if (summary.points === null) return '进度待核对';
  if (Math.abs(summary.delta ?? 0) < 0.05) return '符合均摊参考';
  return `${summary.points > 0 ? '高于均摊' : '低于均摊'} ${Math.abs(summary.points).toFixed(1)} 个百分点`;
}

export function yoyLabel(summary: ReturnType<typeof periodSummary>) {
  if (summary.current === null || summary.previous === null)
    return '暂无可比数据';
  if (summary.previous === 0)
    return summary.current === 0 ? '两年均为 0' : '去年为 0，不计算同比';
  const value = summary.yoy ?? 0;
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

/** Stage status compares same-date sales, independently of this year's goals. */
export function yearPaceLabel(
  summary: ReturnType<typeof periodSummary>,
  state: string,
) {
  if (state === 'upcoming') return '未开始';
  if (summary.current === null || summary.previous === null)
    return '暂无同期对比';
  if (summary.previous === 0)
    return summary.current === 0 ? '同期均为 0' : '去年同期为 0';
  if (summary.current === summary.previous) return '与去年同期持平';
  if (summary.yearDelta === null || summary.yoy === null) return '暂无同期对比';
  return `比去年同期${summary.yearDelta > 0 ? '多' : '少'} ${Math.abs(summary.yoy * 100).toFixed(1)}%`;
}
