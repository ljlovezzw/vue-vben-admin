export type AlertLevel = 'gray' | 'green' | 'orange' | 'red';

export interface KanbanFilters {
  alertLevels: AlertLevel[];
  categories: string[];
  responsibles: string[];
  sites: string[];
  statuses: string[];
}

export interface KanbanSummary {
  judgeCount: number;
  lastMetricDate: string;
  monthNew: number;
  needAction: number;
  orangeCount: number;
  qualified: number;
  qualifyRate: number;
  redCount: number;
  scopeTotal: number;
  totalNew: number;
}

export interface KanbanCoreKpi {
  delta?: number;
  inverseDelta?: boolean;
  key: string;
  label: string;
  tone: 'amber' | 'blue' | 'cyan' | 'green' | 'purple' | 'red';
  unit?: string;
  value: number;
}

export interface KanbanTrendPoint {
  adSpend: number;
  date: string;
  salesAmount: number;
  salesQty: number;
}

export interface KanbanFunnel {
  clicks: number;
  impressions: number;
  salesQty: number;
  sessions: number;
}

export interface KanbanStageSummary {
  avgLaunchDays: number;
  count: number;
  orange: number;
  red: number;
  stage: string;
}

export interface KanbanCategoryProgress {
  category: string;
  currentRate: number;
  needAction: number;
  qualified: number;
  targetRate: number;
  total: number;
}

export interface KanbanSpuRow {
  acos7: number;
  alertLevel: AlertLevel;
  avgSales7: number;
  bsrTrend: number[];
  category: string;
  cvr7: number;
  daysSinceFirstOrder: null | number;
  daysSinceLaunch: number;
  erpLifecycle: string;
  inventoryDays: number;
  lastMetricDate: string;
  lifecycleStage: string;
  parentAsin: string;
  priorityRank: number;
  reasonCount: number;
  reasonText: string;
  responsibleName: string;
  reviewCount: number;
  salesTrend: number[];
  site: string;
  spu: string;
  starRating: number;
  status: string;
}

export interface KanbanDailyMetric {
  acos: number;
  adSalesQty: number;
  adSpend: number;
  bsrMainRank: null | number;
  bsrSubRank: null | number;
  budgetUtilization: number;
  clicks: number;
  ctr: number;
  cvr: number;
  dayIndex: null | number;
  fbaInbound: number;
  fbaStock: number;
  impressions: number;
  inventoryDays: number;
  metricDate: string;
  organicSalesQty: number;
  profit: number;
  refundQty: number;
  refundRate: number;
  reviewCount: number;
  salesAmount: number;
  sessions: number;
  starRating: number;
  totalSalesQty: number;
}

export interface KanbanOverview {
  actionRows: KanbanSpuRow[];
  categoryProgress: KanbanCategoryProgress[];
  coreKpis: KanbanCoreKpi[];
  filters: KanbanFilters;
  funnel: KanbanFunnel;
  stageSummary: KanbanStageSummary[];
  summary: KanbanSummary;
  trend: KanbanTrendPoint[];
}

export interface AdMonitorFilters {
  categories: string[];
  responsibles: string[];
  shops: string[];
  sites: string[];
}

export interface AdMonitorKpi {
  delta?: null | number;
  inverseDelta: boolean;
  key: string;
  label: string;
  tone: 'amber' | 'blue' | 'cyan' | 'green' | 'purple' | 'red';
  unit?: string;
  value: number;
}

export interface AdMonitorSummary {
  acos: number;
  adSales: number;
  campaignCount: number;
  cpa: number;
  cpc: number;
  endDate: string;
  productRows: number;
  roas: number;
  shopCount: number;
  spuCount: number;
  startDate: string;
  tacos: number;
  totalSales: number;
  totalSpend: number;
}

export interface AdTrendPoint {
  acos: number;
  adSales: number;
  cpa: number;
  cpc: number;
  date: string;
  roas: number;
  spend: number;
  tacos: number;
  totalSales: number;
}

export interface AdCategoryRow {
  acos: number;
  adOrders: number;
  adSales: number;
  category: string;
  cpa: number;
  responsibleCount: number;
  roas: number;
  spend: number;
  spuCount: number;
  tacos: number;
  totalSales: number;
}

export interface AdResponsibleRow {
  acos: number;
  adSales: number;
  cpa: number;
  responsible: string;
  roas: number;
  spend: number;
  spuCount: number;
  tacos: number;
  totalSales: number;
}

export interface AdTypeRow {
  acos: number;
  orders: number;
  roas: number;
  sales: number;
  spend: number;
  spendShare: number;
  type: string;
}

export interface AdCampaignRow {
  acos: number;
  adOrders: number;
  adSales: number;
  budgetUtilization: number;
  campaignName: string;
  campaignType: string;
  category: string;
  clicks: number;
  cpc: number;
  ctr: number;
  cvr: number;
  impressions: number;
  inBudgetMinutes: number;
  maxDailyBudget: number;
  overBudgetPeriods: string;
  responsible: string;
  roas: number;
  shopName: string;
  site: string;
  spend: number;
  spu: string;
}

export interface AdMonitorOverview {
  campaignRows: AdCampaignRow[];
  categoryRows: AdCategoryRow[];
  filters: AdMonitorFilters;
  kpis: AdMonitorKpi[];
  responsibleRows: AdResponsibleRow[];
  summary: AdMonitorSummary;
  trend: AdTrendPoint[];
  typeRows: AdTypeRow[];
}
