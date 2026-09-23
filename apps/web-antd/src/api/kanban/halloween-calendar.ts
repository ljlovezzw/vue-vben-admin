import { requestClient } from '#/api/request';

export type StockField =
  | 'actualTransit'
  | 'available'
  | 'receiving'
  | 'reserved'
  | 'sellable'
  | 'shipped'
  | 'total'
  | 'working';
export type StockValues = Record<StockField, null | number>;
export interface HalloweenInventoryRecord extends StockValues {
  id: number;
  refreshed: null | string;
  shops: string[];
  sites: string[];
  spu: string;
  warehouse: string;
}
export interface HalloweenRow {
  action: string;
  actionKey: string;
  actual: null | number;
  canConfirm?: boolean;
  category: string;
  comparable: boolean;
  complete: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  cover: null | number;
  department: string;
  done: null | number;
  due: null | number;
  expected: null | number;
  gap: null | number;
  id: string;
  inventory: StockValues & {
    ids: number[];
    missingInventory: boolean;
    refreshed: null | string;
    rows: number;
    sharedAvailable: number;
    sharedSellable: number;
    sharedTotal: number;
  };
  kind: 'data' | 'normal' | 'slow' | 'stock';
  masters: {
    life: string;
    modified: null | string;
    owner: string;
    parent: string;
    shop: string;
  }[];
  monthly: Record<string, null | number>;
  oldOwners: string[];
  owner: string;
  ownerChanged: boolean;
  ownerIssue: string;
  priority: number;
  profit7: number;
  reason: string;
  recent7: number;
  sellableCover: null | number;
  sevenComplete: boolean;
  sharedStock: boolean;
  site: string;
  spu: string;
  target: null | number;
  targetIssues: string[];
  targetSources: {
    id: number;
    month: number;
    operator_name: string;
    source_file: string;
    source_row: number;
    source_sheet: string;
    target_units: null | number;
  }[];
}
export interface HalloweenOverview {
  viewer?: { defaultLabel: string; defaultResponsibles: null | string[] };
  asOf: string;
  fetchedAt: string;
  inventoryAt: null | string;
  inventoryRecords: HalloweenInventoryRecord[];
  operations: [string, string][];
  phases: {
    days: number;
    elapsed: number;
    end: string;
    name: string;
    progress: number;
    start: string;
    state: 'current' | 'done' | 'upcoming';
    task: string;
  }[];
  rows: HalloweenRow[];
  salesThrough: null | string;
  scopeSource: string;
  sites: Record<string, string>;
  targetPools: {
    month: number;
    scope: string;
    spu: string;
    status: string;
    units: number;
  }[];
  year: number;
}

export function fetchHalloweenOverview(): Promise<HalloweenOverview> {
  return requestClient.get('/kanban/halloween-calendar/overview');
}

export function confirmHalloweenAction(actionKey: string): Promise<{
  actionKey: string;
  confirmedAt: string;
  confirmedBy: string;
}> {
  return requestClient.post(
    `/kanban/halloween-calendar/actions/${encodeURIComponent(actionKey)}/confirm`,
  );
}
