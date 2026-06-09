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
  adCvr7: number;
  alertLevel: AlertLevel;
  avgSales7: number;
  bsrTrend: Array<null | number>;
  category: string;
  cvr7: number;
  cpc7: number;
  cpo7: number;
  budgetUtilization: number;
  daysSinceFirstOrder: null | number;
  daysSinceLaunch: number;
  erpLifecycle: string;
  fbaInbound: number;
  fbaStock: number;
  inventoryDays: number;
  lastProfit: number;
  lastSalesAmount: number;
  lastSalesQty: number;
  lastMetricDate: string;
  lifecycleStage: string;
  parentAsin: string;
  priorityRank: number;
  reasonCount: number;
  reasonText: string;
  responsibleName: string;
  reviewCount: number;
  salesTrend: Array<null | number>;
  site: string;
  spu: string;
  starRating: number;
  status: string;
  roas7: number;
  tacos7: number;
}

export interface KanbanDailyMetric {
  acos: number;
  adCvr: number;
  adSalesQty: number;
  adSalesAmount: number;
  adSpend: number;
  averageSellingPrice: number;
  bsrMainRank: null | number;
  bsrSubRank: null | number;
  budgetUtilization: number;
  clicks: number;
  ctr: number;
  cvr: number;
  cpc: number;
  cpo: number;
  cpu: number;
  dayIndex: null | number;
  fbaInbound: number;
  fbaStock: number;
  impressions: number;
  inventoryDays: number;
  metricDate: string;
  organicClicks: number;
  organicCvr: number;
  organicSalesQty: number;
  profit: number;
  refundQty: number;
  refundRate: number;
  reviewCount: number;
  salesAmount: number;
  sessions: number;
  starRating: number;
  roas: number;
  tacos: number;
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

export interface KanbanProductDetailColumn {
  defaultVisible: boolean;
  key: string;
  kind: 'decimal' | 'image' | 'number' | 'percent' | 'text';
  label: string;
  source: string;
}

export interface KanbanProductDetailRow {
  [key: string]: any;
  country: string;
  key: string;
  site: string;
}

export interface KanbanProductDetailOverview {
  columns: KanbanProductDetailColumn[];
  countries: string[];
  rows: KanbanProductDetailRow[];
}

export interface SpuManagerFilters {
  categories: string[];
  responsibles: string[];
  sites: string[];
  statuses: string[];
}

export interface SpuManagerRow {
  category: string;
  daysSinceFirstOrder: null | number;
  daysSinceLaunch: null | number;
  devDate: string;
  erpLifecycle: string;
  fbaShipDate: string;
  firstArrivalDate: string;
  firstOrderDate: string;
  lastMetricDate: string;
  lifecycleStage: string;
  listingCreated: string;
  notes: string;
  parentAsin: string;
  responsibleName: string;
  responsibleUid: null | number;
  site: string;
  spu: string;
  status: string;
}

export interface SpuManagerOverview {
  filters: SpuManagerFilters;
  rows: SpuManagerRow[];
}

export interface SpuManagerOptions {
  categories: string[];
  users: Array<{
    id: number;
    username: string;
  }>;
}

export interface SpuPayload {
  category?: null | string;
  devDate?: null | string;
  fbaShipDate?: null | string;
  firstArrivalDate?: null | string;
  firstOrderDate?: null | string;
  listingCreated?: null | string;
  notes?: null | string;
  parentAsin?: null | string;
  responsibleUid?: null | number;
  site: string;
  spu: string;
  status: '成品' | '新品' | '滞销';
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

export interface AnalyticsFilters {
  departments: string[];
  operationGroups: AnalyticsOperationGroup[];
  responsibles: string[];
  sites: string[];
  transactionStatuses: string[];
}

export interface AnalyticsOperationGroup {
  id: number;
  memberNames: string[];
  name: string;
}

export interface AnalyticsOperationMetric {
  adSales: number;
  adSpend: number;
  date: string;
  dailyTargetProfit?: number;
  dailyTargetSales?: number;
  dailyTargetUnits?: number;
  grossProfit: number;
  inventoryQty: number;
  inventoryRiskCount: number;
  salesAmount: number;
  salesQty: number;
  turnoverMonths: number;
}

export interface AnalyticsResponsibleOperationRow extends AnalyticsOperationMetric {
  responsible: string;
}

export interface AnalyticsOverview {
  advertising: {
    days: number;
    endDate: string;
    startDate: string;
    summary: Pick<AdMonitorSummary, 'adSales' | 'totalSales' | 'totalSpend'>;
  };
  filters: AnalyticsFilters;
  operations: {
    inventorySnapshotDate: string;
    latest: AnalyticsOperationMetric;
    latestDate: string;
    previous: AnalyticsOperationMetric;
    responsibleRows: AnalyticsResponsibleOperationRow[];
    weekBefore: AnalyticsOperationMetric;
  };
  period: {
    endDate: string;
    granularity: 'day' | 'month';
    previousLabel: string;
    secondaryLabel: string;
    startDate: string;
    targetLabel: string;
  };
  query: {
    departments: string[];
    granularity: 'day' | 'month';
    operationGroupIds: number[];
    productExpressionRealtime: boolean;
    responsibles: string[];
    siteDate: string;
    sites: string[];
    transactionStatuses: string[];
  };
  targets: {
    dailyTargetProfit: number;
    dailyTargetSales: number;
    dailyTargetUnits: number;
  };
  source: {
    message: string;
    mode: 'database' | 'live_api';
    status: 'ok' | 'unavailable';
  };
  updatedAt: string;
}

export interface Asin360Query {
  endDate: string;
  parentAsins: string[];
  sids: string[];
  startDate: string;
  summaryField: string;
}

export interface Asin360StoreOption {
  country: string;
  countryId: number;
  currencyCode: string;
  currencyIcon: string;
  currencyName: string;
  exchangeRate: number;
  region: string;
  sid: string;
  storeName: string;
}

export interface Asin360StoreOptions {
  defaultSids: string[];
  source: 'live_api' | 'local_cache';
  stores: Asin360StoreOption[];
  updatedAt: string;
}

export interface Asin360Product {
  amazonUrl: string;
  asin: string;
  avgStar: number;
  cateRank: number;
  category: string;
  countryCodes: string[];
  fbaInbound: number;
  fbaStock: number;
  imageUrl: string;
  itemNames: string[];
  localSkus: string[];
  parentAsin: string;
  priceList: Record<string, any>[];
  productNames: string[];
  realnames: string[];
  reservedQuantity: number;
  smallCateRank: Record<string, any>[];
  spu: string;
  title: string;
  unsellableQuantity: number;
}

export interface Asin360AdMetricRow {
  acos: number;
  campaign_id?: string;
  clicks: number;
  cpc: number;
  ctr: number;
  currency?: string;
  cvr: number;
  impressions: number;
  key?: string;
  name?: string;
  orders: number;
  profile_alias?: string;
  query?: string;
  roas: number;
  sales: number;
  spends: number;
  sponsored_type?: string;
  state?: string;
}

export interface Asin360RelationRow {
  asin: string;
  sellerNames: string[];
  sids: string[];
  type: string;
}

export interface Asin360CompareRow {
  chainValue: number;
  incrementRate: number;
  indexName: string;
  value: number;
  variableValue: number;
}

export interface Asin360AsinAllRow {
  acos: number;
  adCvr: number;
  adSalesAmount: number;
  adSpend: number;
  adSalesQty: number;
  asin: string;
  averageSellingPrice: number;
  bsrMainRank: null | number;
  bsrSubRank: null | number;
  budgetUtilization: number;
  clicks: number;
  cpc: number;
  cpo: number;
  cpu: number;
  ctr: number;
  cvr: number;
  fbaInbound: number;
  fbaStock: number;
  impressions: number;
  inventoryDays: number;
  metricDate: string;
  organicSalesQty: number;
  orderQty?: number;
  parentAsin: string;
  profit: number;
  raw?: Record<string, any>;
  roas: number;
  salesAmount: number;
  sessions: number;
  starRating: number;
  spu: string;
  tacos: number;
  totalSalesQty: number;
  volumeChainRatio?: number;
  volumeYoyRatio?: number;
  orderChainRatio?: number;
  orderYoyRatio?: number;
  amountChainRatio?: number;
  amountYoyRatio?: number;
  reviewCount: number;
}

export interface Asin360BriefLogRow {
  asin: string;
  cateRank: null | number;
  groupName: string;
  metricDate: string;
  msku: string;
  operateDetail: string;
  operateTime: string;
  operateType: string;
  operateUser: string;
  smallCateRank: Record<string, any>[];
  source: string;
  storeId: null | number;
  storeName: string;
}

export interface Asin360Item {
  adGroupRows: Record<string, any>[];
  adSummary: Record<string, number>;
  afterSaleAnalysis?: Record<string, any>;
  autoTagData?: any;
  campaignRows: Record<string, any>[];
  compareRows: Asin360CompareRow[];
  errors: Array<{ message: string; section: string }>;
  asinAllRows: Asin360AsinAllRow[];
  asinAllSummary?: {
    avgAcos: number;
    avgCvr: number;
    latestMetricDate: string;
    rowCount: number;
  };
  briefLogRows: Asin360BriefLogRow[];
  inventoryAnalysis?: Record<string, any>;
  orderAnalysis?: Record<string, any>;
  parentAsin: string;
  product: Asin360Product;
  profitAnalysis?: Record<string, any>;
  raw?: Record<string, any>;
  relationRows: Asin360RelationRow[];
  subAsinRows?: Record<string, any>[];
  tagData?: any;
  taskRows: Record<string, any>[];
  topCampaignRows: Asin360AdMetricRow[];
  topSearchTermRows: Asin360AdMetricRow[];
}

export interface Asin360Overview {
  items: Asin360Item[];
  query: Asin360Query;
  updatedAt: string;
}

export interface CategoryConfigRow {
  acosTarget?: null | number;
  acosWarn?: null | number;
  category: string;
  planNewItems2026: number;
  qualifyDailySales: number;
  qualifyRateTarget: number;
  tacosTarget?: null | number;
  tacosWarn?: null | number;
}

export interface ConfigUserRow {
  avatarColor: string;
  authProvider: string;
  department: string;
  email: string;
  feishuOpenId: string;
  feishuUserId: string;
  id: number;
  lastLoginAt: string;
  loginCount: number;
  managedUserIds: number[];
  permissions: string[];
  role: string;
  status: 'active' | 'disabled';
  username: string;
}

export interface ConfigUserAuthPayload {
  department?: null | string;
  managedUserIds: number[];
  permissions: string[];
  role: string;
  status: 'active' | 'disabled';
}

export interface LoginLogRow {
  createdAt: string;
  email: string;
  id: number;
  ip: string;
  message: string;
  provider: string;
  success: boolean;
  userAgent: string;
  userId?: null | number;
  username: string;
}

export interface ConfigRuleGroup {
  level: string;
  rules: string[];
  title: string;
}

export interface ConfigOverview {
  alertRules: ConfigRuleGroup[];
  categoryConfigs: CategoryConfigRow[];
  operationGroups: OperationGroupRow[];
  users: ConfigUserRow[];
}

export interface OperationGroupMember {
  id: number;
  username: string;
}

export interface OperationGroupRow {
  id: number;
  memberUserIds: number[];
  members: OperationGroupMember[];
  name: string;
}

export interface OperationGroupPayload {
  id?: number;
  memberUserIds: number[];
  name: string;
}

export interface TargetTrackerQuery {
  operatorName: string;
  site: string;
  store: string;
  year: number;
}

export interface TargetTrackerSummary {
  actualProfit: number;
  actualUnits: number;
  asOfDate: string;
  challengeCompletionRate: number;
  challengeProfit: number;
  completedMonths: number;
  currentMonthActualProfit: number;
  currentMonthCompletionRate: number;
  currentMonthTargetProfit: number;
  gapProfit: number;
  monthlyRequiredProfit: number;
  operatorCount: number;
  runRateCompletionRate: number;
  runRateProfit: number;
  targetCompletionRate: number;
  targetProfit: number;
  targetUnits: number;
  timeProgress: number;
  year: number;
}

export interface TargetTrackerKpi {
  key: string;
  label: string;
  sub: string;
  tone: 'amber' | 'blue' | 'green' | 'red';
  value: number;
}

export interface TargetTrackerMonthRow {
  actualProfit: number;
  actualUnits: number;
  challengeProfit: number;
  completionRate: number;
  gapProfit: number;
  label: string;
  month: number;
  runRateProfit: null | number;
  targetProfit: number;
  targetUnits: number;
  timeProgress?: number;
}

export interface TargetTrackerQuarterRow {
  actualProfit: number;
  actualUnits: number;
  challengeProfit: number;
  completionRate: number;
  gapProfit: number;
  label: string;
  quarter: number;
  runRateProfit: null | number;
  targetProfit: number;
  targetUnits: number;
  timeProgress: number;
}

export interface TargetTrackerOperatorRow {
  actualProfit: number;
  actualUnits: number;
  challengeProfit: number;
  completionRate: number;
  gapProfit: number;
  operatorName: string;
  spuCount: number;
  status: 'danger' | 'normal' | 'warning';
  statusText: string;
  targetProfit: number;
  targetUnits: number;
}

export interface TargetTrackerOperatorPeriodRow extends TargetTrackerOperatorRow {
  label: string;
  month?: number;
  quarter?: number;
}

export interface TargetTrackerSpuRow {
  actualProfit: number;
  actualUnits: number;
  challengeProfit: number;
  completionRate: number;
  gapProfit: number;
  operatorName: string;
  site: string;
  spu: string;
  targetProfit: number;
  targetUnits: number;
}

export interface TargetTrackerAlert {
  description: string;
  level: 'danger' | 'warning';
  time: string;
  title: string;
}

export interface TargetTrackerOverview {
  alerts: TargetTrackerAlert[];
  gapRows: TargetTrackerOperatorRow[];
  kpis: TargetTrackerKpi[];
  lossSpuRows: TargetTrackerSpuRow[];
  monthRows: TargetTrackerMonthRow[];
  operatorMonthRows: TargetTrackerOperatorPeriodRow[];
  operatorQuarterRows: TargetTrackerOperatorPeriodRow[];
  operatorRows: TargetTrackerOperatorRow[];
  quarterRows: TargetTrackerQuarterRow[];
  query: TargetTrackerQuery;
  spuRows: TargetTrackerSpuRow[];
  summary: TargetTrackerSummary;
  topSpuRows: TargetTrackerSpuRow[];
  updatedAt: string;
}
