import type { periodSummary } from './sales-progress';
export function trendTone(value: null | number) {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 0.05)
    return 'trend-neutral';
  return value > 0 ? 'trend-up' : 'trend-down';
}
export function compactGap(points: null | number) {
  if (points === null || !Number.isFinite(points)) return '待核对';
  if (Math.abs(points) < 0.05) return '持平';
  return `${points > 0 ? '超前' : '滞后'} ${Math.abs(points).toFixed(1)} 个百分点`;
}
export function compactYoy(s: ReturnType<typeof periodSummary>, state = '') {
  if (state === 'upcoming') return '未开始';
  if (s.current === null || s.previous === null) return '待核对';
  if (s.previous === 0) return s.current === 0 ? '两年均为 0' : '去年为 0';
  const pct = (s.yoy ?? 0) * 100;
  if (Math.abs(pct) < 0.05) return '持平';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}
