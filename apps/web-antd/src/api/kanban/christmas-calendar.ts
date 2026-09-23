import { requestClient } from '#/api/request';

export interface ChristmasStock {
  id: number;
  spu: string;
  sites: string[];
  warehouse: string;
  refreshed: null | string;
  total: null | number;
  available: null | number;
  sellable: null | number;
  shipped: null | number;
  actualTransit: null | number;
}

export interface ChristmasRow {
  id: string;
  spu: string;
  site: string;
  owner: string;
  department: string;
  category: string;
  target: null | number;
  monthly: Record<string, null | number>;
  targetMode: 'category' | 'exact' | 'missing';
  targetIssue: string;
  matchedCategory?: string;
  targetSources: {
    month: number;
    operator_name: string;
    source_file: string;
    source_sheet: string;
    spu: string;
    target_units: number;
  }[];
  planUnits: null | number;
  actual: null | number;
  comparable: boolean;
  done: null | number;
  due: null | number;
  sevenComplete: boolean;
  recent7: number;
  kind: string;
  priority: number;
  action: string;
  reason: string;
  actionKey: string;
  canConfirm?: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  inventory: {
    available: null | number;
    ids: number[];
    missingInventory: boolean;
    refreshed: null | string;
    rows: number;
    sellable: null | number;
    total: null | number;
  };
  masters: { life: string; owner: string; parent: string; shop: string }[];
}

export interface ChristmasPhase {
  start: string;
  end: string;
  name: string;
  condition: string;
  product: string;
  ads: string;
  stock: string;
  days: number;
  elapsed: number;
  progress: number;
  state: string;
}

export interface ChristmasOverview {
  asOf: string;
  fetchedAt: string;
  salesThrough: null | string;
  sourceSpus: number;
  skuRows: number;
  sites: Record<string, string>;
  rows: ChristmasRow[];
  inventoryRecords: ChristmasStock[];
  phases: ChristmasPhase[];
  viewer: { defaultLabel: string; defaultResponsibles: null | string[] };
  source: {
    plans: {
      categories: string[];
      new: string[];
      sites: Record<string, number>;
      skuCount: number;
      spu: string;
    }[];
    sourceUrl: string;
    strategies: {
      late: string;
      logistics: string;
      peak: string;
      reduce: string;
      site: string;
    }[];
  };
}

export function fetchChristmasOverview(): Promise<ChristmasOverview> {
  return requestClient.get('/kanban/christmas-calendar/overview');
}

export function confirmChristmasAction(
  actionKey: string,
): Promise<{ confirmedAt: string; confirmedBy: string }> {
  return requestClient.post(
    `/kanban/christmas-calendar/actions/${encodeURIComponent(actionKey)}/confirm`,
  );
}
