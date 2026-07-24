export type AlertLevel = 'gray' | 'green' | 'orange' | 'red';

export interface KanbanFilters {
  alertLevels: AlertLevel[];
  categories: string[];
  projectTags: string[];
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

export interface NetProfitBreakdownItem {
  key: string;
  label: string;
  type: 'cost' | 'income';
  value: number;
}

export interface NetProfitBreakdown {
  detailRows: number;
  items: NetProfitBreakdownItem[];
  netProfit: number;
  updatedAt: string;
}

export interface NetProfitDimensionOption {
  key: string;
  label: string;
}

export interface NetProfitGroupRow {
  accountCount: number;
  dimension: string;
  dimensionLabel: string;
  name: string;
  negativeCount: number;
  netProfit: number;
  parentAsinCount: number;
  rowCount: number;
  ytdNetProfit: number;
}

export interface NetProfitPeriodOption {
  key: string;
  label: string;
}

export interface NetProfitProgressStep {
  description: string;
  key: string;
  label: string;
  status: 'complete' | 'warning';
  updatedAt: string;
}

export interface NetProfitSummary {
  accountCount: number;
  latestNetProfit: number;
  negativeCount: number;
  negativeRate: number;
  parentAsinCount: number;
  positiveCount: number;
  profitLabel: string;
  rowCount: number;
  selectedNetProfit: number;
  updatedAt: string;
  ytdNetProfit: number;
}

export interface NetProfitTrendPoint {
  label: string;
  netProfit: number;
  period: string;
}

export interface NetProfitOverview {
  breakdown: NetProfitBreakdown;
  dimension: string;
  dimensions: NetProfitDimensionOption[];
  filters: {
    brands: string[];
    countries: string[];
    departments: string[];
    operators: string[];
  };
  groups: NetProfitGroupRow[];
  period: string;
  periodLabel: string;
  periods: NetProfitPeriodOption[];
  progress: NetProfitProgressStep[];
  query: Record<string, any>;
  risks: NetProfitGroupRow[];
  summary: NetProfitSummary;
  trend: NetProfitTrendPoint[];
}

export interface NetProfitDetailRow {
  amount: number;
  asin: string;
  brand: string;
  cashIncome: number;
  country: string;
  customCost: number;
  department: string;
  firstLegCost: number;
  firstLegFee: number;
  focusLabel?: string;
  focusMetric?: string;
  focusShare?: number;
  focusValue?: number;
  grossProfit: number;
  key: string;
  marketingFee: number;
  msku: string;
  netProfit: number;
  operator: string;
  otherFee: number;
  packageCost: number;
  parentAsin: string;
  period: string;
  productName: string;
  purchaseCost: number;
  purchaseQty: number;
  shop: string;
  sku: string;
  spu: string;
  standardFee: number;
}

export interface NetProfitDetailColumn {
  key: string;
  label: string;
  role: 'context' | 'focus';
}

export interface NetProfitDetails {
  columns: NetProfitDetailColumn[];
  dimension: string;
  display: {
    mode: 'full-detail' | 'metric-focus';
    note: string;
  };
  focus: {
    description: string;
    dimension: string;
    dimensionLabel: string;
    metric: string;
    metricLabel: string;
    sortField: string;
    value: string;
  };
  focusAbsTotal: number;
  page: number;
  pageSize: number;
  period: string;
  periodLabel: string;
  query: Record<string, any>;
  rows: NetProfitDetailRow[];
  total: number;
}

export interface KanbanProductDetailColumn {
  defaultVisible: boolean;
  group?: string;
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
  page: number;
  pageSize: number;
  query: {
    countries: string[];
    dateRangeType: string;
    days: number;
    endDate: string;
    previousEndDate: string;
    previousStartDate: string;
    projectTags: string[];
    responsibles: string[];
    sites: string[];
    startDate: string;
  };
  rows: KanbanProductDetailRow[];
  summary: Record<string, any>;
  totalRows: number;
}

export interface KanbanProductDetailMeta {
  columns: KanbanProductDetailColumn[];
  countries: string[];
  query: KanbanProductDetailOverview['query'];
  totalRows: number;
}

export interface KanbanProductDetailRows {
  page: number;
  pageSize: number;
  query: KanbanProductDetailOverview['query'];
  rows: KanbanProductDetailRow[];
  summary: Record<string, any>;
  totalRows: number;
}

export interface KanbanFbaInventorySkuRow {
  asinList: string;
  fbaAvailableQty: number;
  fbaInboundQty: number;
  fbaReservedQty: number;
  fbaStockQty: number;
  isSummary: boolean;
  mskuList: string;
  shopNames: string;
  sku: string;
  totalQty: number;
  warehouseNames: string;
}

export interface KanbanFbaInventorySkuBreakdown {
  refreshedAt: string;
  rows: KanbanFbaInventorySkuRow[];
  site: string;
  spu: string;
  summary: KanbanFbaInventorySkuRow;
}

export interface KeywordReversePayload {
  asins: string[];
  expendMethod?: string;
  marketPlaceId?: number;
  monthStr?: string;
  pageNo?: number;
  pageSize?: number;
  searchType?: string;
  sortDirection?: 'ASC' | 'DESC';
  sortField?: string;
}

export interface KeywordReverseColumn {
  fixed?: string;
  key: string;
  kind: 'number' | 'percent' | 'rank' | 'text';
  label: string;
}

export interface KeywordReverseResult {
  columns: KeywordReverseColumn[];
  highFrequencyWords: Array<Record<string, any> & { text: string }>;
  page: {
    pageNo: number;
    pages: number;
    pageSize: number;
    total: number;
  };
  query: Required<KeywordReversePayload>;
  rawSummary: Record<string, any>;
  rows: Record<string, any>[];
}

export interface SearchTermReportDatePreset {
  endDate: string;
  label: string;
  startDate: string;
}

export interface SearchTermReportOptions {
  datePresets: SearchTermReportDatePreset[];
  shops: string[];
}

export interface SearchTermReportParentAsinRow {
  asinList: string;
  categoryLevel1: string;
  categoryLevel2: string;
  lifecycle: string;
  parentAsin: string;
  projectTag: string;
  rowCount: number;
  shopName: string;
  site: string;
  spu: string;
}

export interface SearchTermReportParentAsinsResult {
  query: {
    shopName: string;
    spu: string;
  };
  rows: SearchTermReportParentAsinRow[];
}

export interface SearchTermReportPayload {
  adAnalyzerEndDate?: null | string;
  adAnalyzerSearchField?: 'asin' | 'msku';
  adAnalyzerStartDate?: null | string;
  endDate: string;
  includeAdAnalyzer?: boolean;
  parentAsin?: null | string;
  parentAsins?: string[];
  shopName: string;
  spu: string;
  startDate: string;
}

export interface SearchTermReportSheet {
  key: string;
  label: string;
  previewRows: Record<string, any>[];
  rowCount: number;
  summary: Record<string, any>;
}

export interface SearchTermReportResult {
  downloadUrl: string;
  extraFiles?: SearchTermReportExtraFile[];
  fileName: string;
  parentAsin: string;
  parentAsins: string[];
  reportDate: string;
  sheets: SearchTermReportSheet[];
  shopName: string;
  spu: string;
  summaryRows: Record<string, any>[];
}

export interface SearchTermReportExtraFile {
  downloadUrl: string;
  fileName: string;
  key: string;
  label: string;
  matchedParentAsins?: string[];
  reportDate: string;
  requestedSearchField?: string;
  rowCount: number;
  searchField: string;
  searchText?: string[];
  searchTextCount: number;
}

export type SearchTermReportTaskStatus =
  | 'failed'
  | 'queued'
  | 'running'
  | 'succeeded';

export interface SearchTermReportTask {
  error?: null | string;
  finishedAt?: null | number;
  queued: boolean;
  queuedAt: number;
  result?: null | SearchTermReportResult;
  startedAt?: null | number;
  status: SearchTermReportTaskStatus;
  taskId: string;
  updatedAt: number;
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
  countries: string[];
  departments: string[];
  shops: string[];
}

export interface AdMonitorPeriod {
  days: number;
  endDate: string;
  rangePreset: '7d' | '30d' | 'month';
  startDate: string;
}

export interface AdMonitorSummary {
  adOrders: number;
  adOrderShare: number;
  adCvr: number;
  acoas: number;
  cvrChangePp: number;
  previousAdCvr: number;
  /** @deprecated Use previousAdCvr. */
  last30AdCvr: number;
  overTargetPp: number;
  previousSpend: number;
  spendChangeRate: number;
  targetAcoas: number;
  targetCoverage: number;
  totalExcessSpend: number;
  totalSalesQty: number;
  totalSpend: number;
  yoyAdCvr: number;
  yoyChangePp: number;
}

export type AdMonitorStatus =
  | 'flat'
  | 'high_risk'
  | 'rising'
  | 'warning'
  | 'watch';

export interface AdResponsibleRow {
  acoas: number;
  adCvr: number;
  adOrders: number;
  adOrderShare: number;
  adSpend: number;
  allowedAdSpend: number;
  cvrChangePp: number;
  department: string;
  effectiveExcessSpend: number;
  excessContribution: number;
  excessSeverity: number;
  excessSpend: number;
  previousAdCvr: number;
  /** @deprecated Use previousAdCvr. */
  last30AdCvr: number;
  previousAdSpend: number;
  responsible: string;
  salesAmount: number;
  status: AdMonitorStatus;
  targetAcoas: number;
  targetConfigured: boolean;
  targetedSalesAmount: number;
  totalSalesQty: number;
  yoyAdCvr: number;
}

export interface AdMonitorInsight {
  message: string;
  topContribution: number;
  topResponsibleNames: string[];
}

export interface AdMonitorOverview {
  dataUpdatedAt: string;
  filters: AdMonitorFilters;
  impactRows: AdResponsibleRow[];
  insight: AdMonitorInsight;
  period: AdMonitorPeriod;
  responsibleRows: AdResponsibleRow[];
  summary: AdMonitorSummary;
}

export interface AnalyticsFilters {
  departments: string[];
  operationGroups: AnalyticsOperationGroup[];
  projectTags: string[];
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
  adAcoas: number;
  adCvr: number;
  adOrders: number;
  adSales: number;
  adSpend: number;
  adSpendRate: number;
  clicks: number;
  date: string;
  dailyTargetProfit?: number;
  dailyTargetSales?: number;
  dailyTargetUnits?: number;
  fbaAvailableQty: number;
  grossProfit: number;
  grossMarginCompletionRate?: number;
  grossMarginRate?: number;
  inventoryQty: number;
  inventoryRiskCount: number;
  productExpressionAdSpend: number;
  productExpressionSalesAmount: number;
  salesAmount: number;
  salesQty: number;
  targetGrossMarginRate?: number;
  turnoverFbaAvailableMonths: number;
  turnoverMonths: number;
}

export interface AnalyticsResponsibleOperationRow extends AnalyticsOperationMetric {
  department: string;
  responsible: string;
}

export interface AnalyticsDepartmentOperationRow extends AnalyticsOperationMetric {
  department: string;
}

export interface AnalyticsOverview {
  advertising: {
    days: number;
    endDate: string;
    startDate: string;
    summary: {
      adSales: number;
      totalSales: number;
      totalSpend: number;
    };
  };
  filters: AnalyticsFilters;
  operations: {
    departmentRows: AnalyticsDepartmentOperationRow[];
    inventorySnapshotDate: string;
    latest: AnalyticsOperationMetric;
    latestDate: string;
    previous: AnalyticsOperationMetric;
    responsibleRows: AnalyticsResponsibleOperationRow[];
    weekBefore: AnalyticsOperationMetric;
  };
  period: {
    days: number;
    endDate: string;
    granularity: 'day' | 'month';
    previousLabel: string;
    secondaryLabel: string;
    startDate: string;
    targetLabel: string;
  };
  query: {
    departments: string[];
    endDate: string;
    granularity: 'day' | 'month';
    operationGroupIds: number[];
    productExpressionRealtime: boolean;
    projectTags: string[];
    responsibles: string[];
    siteDate: string;
    sites: string[];
    startDate: string;
    transactionStatuses: string[];
  };
  targets: {
    dailyTargetProfit: number;
    dailyTargetSales: number;
    dailyTargetSalesCny?: number;
    dailyTargetUnits: number;
    targetGrossMarginRate?: number;
  };
  source: {
    message: string;
    mode: 'database' | 'live_api' | 'mixed';
    status: 'ok' | 'stale' | 'unavailable';
  };
  updatedAt: string;
}

export interface AnalyticsReportColumn {
  defaultVisible: boolean;
  key: string;
  kind:
    | 'decimal'
    | 'image'
    | 'money'
    | 'number'
    | 'percent'
    | 'tag'
    | 'text'
    | 'trend';
  label: string;
}

export interface AnalyticsReportTrendPoint {
  adSpend: number;
  date: string;
  orders: number;
  sales: number;
  salesAmount: number;
}

export interface AnalyticsReportRow {
  [key: string]: any;
  acos: null | number;
  adCvr: null | number;
  adOrders: number;
  adSales: number;
  adSpend: number;
  asinList: string;
  avgSales7: number;
  category1: string;
  category2: string;
  clicks: number;
  country: string;
  currencyCode?: string;
  currencySymbol?: string;
  cpc: null | number;
  cpo: null | number;
  ctr: null | number;
  cvr: null | number;
  fbaAvailable: number;
  imageUrl: string;
  impressions: number;
  key: string;
  lifecycle: string;
  netSalesAmount: number;
  orderProfit: number;
  orderQty: number;
  parentAsin: string;
  profitGrade: string;
  productType: 'new' | 'old';
  projectTag: string;
  pv: number;
  rating: number;
  refundQty: number;
  refundRate: null | number;
  responsible: string;
  reviewCount: number;
  roas: null | number;
  salesAmount: number;
  salesQty: number;
  salesTrend: AnalyticsReportTrendPoint[];
  sessions: number;
  settlementProfit: number;
  shopName: string;
  site: string;
  spu: string;
  tacos: null | number;
  targetUnits: number;
}

export interface AnalyticsReportOverview {
  columns: AnalyticsReportColumn[];
  defaultColumns: string[];
  filters: {
    countries: string[];
    productTypes: Array<'new' | 'old'>;
    responsibles: string[];
    spus: string[];
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  query: {
    countries: string[];
    dateRangeType: string;
    departments: string[];
    endDate: string;
    operationGroupIds: number[];
    productTypes: string[];
    projectTags: string[];
    responsibles: string[];
    sites: string[];
    sortField: string;
    sortOrder: string;
    spus: string[];
    startDate: string;
  };
  rows: AnalyticsReportRow[];
  summary: Record<string, null | number>;
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
  countryScope: string[];
  role: string;
  status: 'active' | 'disabled';
  username: string;
}

export interface ConfigUserAuthPayload {
  department?: null | string;
  managedUserIds: number[];
  permissions: string[];
  countryScope: string[];
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

export interface InAppCardNotification {
  acknowledgedAt: string;
  card: Record<string, any>;
  detectedAt: string;
  event: Record<string, any>;
  eventKey: string;
  id: number;
  inAppStatus: 'acked' | 'pending';
  preview: boolean;
  scene: string;
  sentAt: string;
  title: string;
}

export interface InAppCardNotificationHistory {
  items: InAppCardNotification[];
  page: number;
  pageSize: number;
  total: number;
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
