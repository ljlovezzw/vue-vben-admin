/** Compare sales completion with elapsed natural days in the Sep-Oct season. */
export function calendarProgress(
  year: number,
  through: null | string,
  salesRate: null | number,
  target: number,
  actual: number,
) {
  const start = Date.UTC(year, 8, 1);
  const end = Date.UTC(year, 9, 31);
  const totalDays = (end - start) / 86_400_000 + 1;
  const parsed =
    through && /^\d{4}-\d{2}-\d{2}$/.test(through)
      ? Date.parse(`${through}T00:00:00Z`)
      : Number.NaN;
  const valid =
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === through;
  const elapsedDays = valid
    ? Math.max(0, Math.min(totalDays, (parsed - start) / 86_400_000 + 1))
    : null;
  const timeRate = elapsedDays === null ? null : elapsedDays / totalDays;
  const points =
    timeRate !== null && salesRate !== null && target > 0
      ? (salesRate - timeRate) * 100
      : null;
  const due = timeRate !== null && target > 0 ? target * timeRate : null;
  const delta = due === null ? null : actual - due;
  let label: string;
  if (elapsedDays === null) {
    label = '时间进度待核对';
  } else if (elapsedDays === 0) {
    label = '销售周期尚未开始';
  } else if (points === null) {
    label = '销量目标待核对，暂不比较';
  } else if (Math.abs(points) < 0.05) {
    label = '销量与时间进度持平';
  } else {
    label = `销量${points > 0 ? '领先' : '落后'}时间进度 ${Math.abs(points).toFixed(1)} 个百分点`;
  }
  return {
    totalDays,
    elapsedDays,
    timeRate,
    points,
    due,
    delta,
    label,
    cutoff: valid
      ? new Date(Math.min(parsed, end)).toISOString().slice(0, 10)
      : null,
  };
}
