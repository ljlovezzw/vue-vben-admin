import type {
  HalloweenInventoryRecord,
  HalloweenRow,
  StockField,
} from '#/api/kanban/halloween-calendar';

export type GroupKey = 'category' | 'owner' | 'site';
export type QueueKind = 'action' | 'all' | 'data' | 'slow' | 'stock';

export const formatNumber = (value: null | number | undefined) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
export const formatRate = (value: null | number) =>
  value === null ? '—' : `${(value * 100).toFixed(1)}%`;
export const stockText = (row: HalloweenRow, field: StockField = 'available') =>
  row.inventory.rows > 0 && row.inventory[field] !== null
    ? formatNumber(row.inventory[field])
    : '待核对';
export const pending = (row: HalloweenRow, kind: QueueKind) =>
  kind === 'all' ||
  (!row.confirmedAt &&
    (kind === 'action'
      ? ['slow', 'stock'].includes(row.kind)
      : row.kind === kind));
export const ordered = (rows: HalloweenRow[]) =>
  [...rows].toSorted(
    (a, b) =>
      a.priority - b.priority ||
      (a.gap ?? 1) - (b.gap ?? 1) ||
      (b.target ?? 0) - (a.target ?? 0) ||
      a.id.localeCompare(b.id),
  );

export function inventoryFor(
  rows: HalloweenRow[],
  records: HalloweenInventoryRecord[],
) {
  const ids = new Set(rows.flatMap((r) => r.inventory.ids));
  return records.filter((r) => ids.has(r.id));
}

export function aggregate(
  rows: HalloweenRow[],
  records: HalloweenInventoryRecord[],
) {
  const comparable = rows.filter((r) => r.comparable);
  const sum = (key: 'actual' | 'due' | 'target') =>
    comparable.reduce((n, r) => n + (r[key] ?? 0), 0);
  const target = sum('target');
  const actual = sum('actual');
  const inventory = inventoryFor(rows, records);
  return {
    actual,
    available:
      inventory.length > 0
        ? (inventory.some((i) => i.available === null)
          ? null
          : inventory.reduce((n, i) => n + (i.available ?? 0), 0))
        : null,
    comparable: comparable.length,
    expected: target > 0 ? sum('due') / target : null,
    gap: Math.max(0, target - actual),
    inventoryPairs: rows.filter((r) => r.inventory.rows > 0).length,
    rate: target > 0 ? actual / target : null,
    stock: rows.filter((r) => pending(r, 'stock')).length,
    target,
  };
}

export function groupsFor(
  rows: HalloweenRow[],
  records: HalloweenInventoryRecord[],
  key: GroupKey,
) {
  const groups = new Map<string, HalloweenRow[]>();
  for (const row of rows) {
    const list = groups.get(row[key]) ?? [];
    list.push(row);
    groups.set(row[key], list);
  }
  return [...groups]
    .map(([name, list]) => ({
      key: name,
      summary: aggregate(list, records),
    }))
    .toSorted(
      (a, b) =>
        b.summary.target - a.summary.target || a.key.localeCompare(b.key),
    );
}

// An empty personal/team scope intentionally matches no products.
export const DEFAULT_OWNER_SCOPE = '__my_scope__';
export function matchesOwnerScope(
  owner: string,
  selected: string,
  defaults: null | string[],
) {
  return selected === DEFAULT_OWNER_SCOPE
    ? defaults !== null && defaults.includes(owner)
    : !selected || owner === selected;
}
