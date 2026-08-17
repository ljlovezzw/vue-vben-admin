import type {
  AdAutomationAnalysis,
  AdAutomationOverview,
  AdCampaignDrilldown,
  AdMonitorFilters,
  AdMonitorOverview,
  AdMonitorTrend,
  AnalyticsOverview,
  AnalyticsReportOverview,
  Asin360Overview,
  Asin360StoreOptions,
  CategoryConfigRow,
  ConfigOverview,
  ConfigUserAuthPayload,
  ConfigUserRow,
  InAppCardNotification,
  InAppCardNotificationHistory,
  KanbanDailyMetric,
  KanbanFbaInventorySkuBreakdown,
  KanbanFilters,
  KanbanOverview,
  KanbanProductDetailMeta,
  KanbanProductDetailOverview,
  KanbanProductDetailRows,
  KeywordReversePayload,
  KeywordReverseResult,
  LoginLogRow,
  NetProfitDetails,
  NetProfitOverview,
  OperationGroupPayload,
  OperationGroupRow,
  SearchTermReportCampaignsResult,
  SearchTermReportOptions,
  SearchTermReportParentAsinsResult,
  SearchTermReportPayload,
  SearchTermReportTask,
  ShippingAllocationMeta,
  ShippingCartonCalculationPayload,
  ShippingCartonCalculationResult,
  ShippingLocationFinderBootstrap,
  ShippingLocationFinderResult,
  ShippingReceipt,
  ShippingReceiptSyncResult,
  ShippingSimulationPayload,
  ShippingSimulationResult,
  ShippingSkuPlan,
  ShippingSkuPlanSyncResult,
  ShippingWorkspaceBootstrap,
  ShippingWorkspaceState,
  SpuManagerFilters,
  SpuManagerOptions,
  SpuManagerOverview,
  SpuManagerRow,
  SpuPayload,
  TargetTrackerOverview,
} from './types';

import { requestClient, silentRequestClient } from '#/api/request';

export type {
  AlertLevel,
  InAppCardNotification,
  InAppCardNotificationHistory,
  KanbanCoreKpi,
  KanbanDailyMetric,
  KanbanFbaInventorySkuBreakdown,
  KanbanFbaInventorySkuRow,
  KanbanOverview,
  KanbanProductDetailColumn,
  KanbanProductDetailMeta,
  KanbanProductDetailOverview,
  KanbanProductDetailRow,
  KanbanProductDetailRows,
  KanbanSpuRow,
  KeywordReverseColumn,
  KeywordReversePayload,
  KeywordReverseResult,
  SearchTermReportDatePreset,
  SearchTermReportOptions,
  SearchTermReportParentAsinRow,
  SearchTermReportParentAsinsResult,
  SearchTermReportPayload,
  SearchTermReportResult,
  SearchTermReportSheet,
  SearchTermReportTask,
  SearchTermReportTaskStatus,
  SpuManagerRow,
} from './types';

export type KanbanOverviewParams = Partial<KanbanFilters>;

export interface AdMonitorOverviewParams extends Partial<AdMonitorFilters> {
  endDate?: string;
  projectTags?: string[];
  rangePreset?: '7d' | '30d' | 'month';
  responsibles?: string[];
  startDate?: string;
}

export interface AdCampaignDrilldownParams extends AdMonitorOverviewParams {
  responsible: string;
}

export interface AdAutomationParams {
  action?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  projectTags?: string[];
  search?: string;
  shops?: string[];
  sponsoredTypes?: string[];
  startDate?: string;
  targetAcos?: number;
}

export interface AnalyticsReportParams {
  countries?: string[];
  dateRangeType?: string;
  departments?: string[];
  endDate?: string;
  operationGroupIds?: number[];
  page?: number;
  pageSize?: number;
  productTypes?: string[];
  projectTags?: string[];
  responsibles?: string[];
  siteDate?: string;
  sites?: string[];
  spus?: string[];
  sortField?: string;
  sortOrder?: string;
  startDate?: string;
}

export interface AnalyticsOverviewParams {
  endDate?: string;
  departments?: string[];
  granularity?: 'day' | 'month';
  operationGroupIds?: number[];
  productExpressionRealtime?: boolean;
  projectTags?: string[];
  responsibles?: string[];
  siteDate?: string;
  sites?: string[];
  startDate?: string;
}

export interface NetProfitOverviewParams {
  brands?: string[];
  category1?: string[];
  category2?: string[];
  category3?: string[];
  countries?: string[];
  departments?: string[];
  developers?: string[];
  dimension?: string;
  limit?: number;
  operators?: string[];
  periodFrom?: string;
  periodTo?: string;
  period?: string;
  pivotColumn?: string;
  pivotRow?: string;
  productTypes?: string[];
  suppliers?: string[];
}

export interface NetProfitDetailsParams extends NetProfitOverviewParams {
  metric?: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: string;
  value?: string;
}

export type SpuManagerParams = Partial<SpuManagerFilters>;

export interface KanbanProductDetailParams extends KanbanOverviewParams {
  analyticsDepartmentScope?: boolean;
  categorySearch?: string;
  countries?: string[];
  dateRangeType?: string;
  departments?: string[];
  endDate?: string;
  operationGroupIds?: number[];
  shopNames?: string[];
  spuMatchMode?: 'exact' | 'fuzzy';
  spuSearch?: string;
  startDate?: string;
  year?: number;
}

export interface KanbanProductDetailExportParams extends KanbanProductDetailParams {
  columns?: string[];
  includeAttachments?: boolean;
}

export interface KanbanProductDetailRowsParams extends KanbanProductDetailParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: string;
}

export interface KanbanProductDetailFbaInventoryParams {
  analyticsDepartmentScope?: boolean;
  site: string;
  spu: string;
}

export interface Asin360OverviewParams {
  endDate?: string;
  parent_ASIN: string;
  sids?: string[];
  startDate?: string;
}

export interface Asin360SectionParams extends Asin360OverviewParams {
  dateSummaryType?: string;
  dateType?: string;
  kind?: string;
  section: string;
}

export interface LingxingProxyPayload {
  body?: Record<string, any>;
  method?: 'GET' | 'POST';
  params?: Record<string, any>;
  path: string;
}

export interface TargetTrackerParams {
  operatorName?: string;
  site?: string;
  store?: string;
  year?: number;
}

export interface CreateConfigUserPayload {
  avatarColor: string;
  department: string;
  email: string;
  password: string;
  role: string;
  username: string;
}

export async function fetchKeywordReverse(
  data: KeywordReversePayload,
): Promise<KeywordReverseResult> {
  return requestClient.post('/kanban/tools/keyword-reverse', data);
}

export async function fetchSearchTermReportOptions(): Promise<SearchTermReportOptions> {
  return requestClient.get('/kanban/tools/search-term-report/options');
}

export async function fetchSearchTermReportParentAsins(params: {
  shopName: string;
  spu: string;
}): Promise<SearchTermReportParentAsinsResult> {
  return requestClient.get('/kanban/tools/search-term-report/parent-asins', {
    params,
  });
}

export async function fetchSearchTermReportCampaigns(
  params: {
    parentAsins: string;
    shopName: string;
    spu: string;
  },
  signal?: AbortSignal,
): Promise<SearchTermReportCampaignsResult> {
  return requestClient.get('/kanban/tools/search-term-report/campaigns', {
    params,
    signal,
  });
}

export async function createSearchTermReportTask(
  data: SearchTermReportPayload,
): Promise<SearchTermReportTask> {
  return requestClient.post('/kanban/tools/search-term-report', data);
}

export async function fetchSearchTermReportTask(
  taskId: string,
): Promise<SearchTermReportTask> {
  return requestClient.get(
    `/kanban/tools/search-term-report/tasks/${encodeURIComponent(taskId)}`,
  );
}

export async function downloadSearchTermReport(
  fileName: string,
): Promise<Blob> {
  return requestClient.download(
    `/kanban/tools/search-term-report/download/${encodeURIComponent(fileName)}`,
    { timeout: 300_000 },
  );
}

export interface SearchTermReportDownloadChunk {
  blob: Blob;
  end: number;
  fileSize: number;
  start: number;
  contentType: string;
  status: number;
}

export async function downloadSearchTermReportChunk(
  fileName: string,
  start: number,
  end: number,
): Promise<SearchTermReportDownloadChunk> {
  const response = await requestClient.download<any>(
    `/kanban/tools/search-term-report/download-chunk/${encodeURIComponent(fileName)}`,
    {
      params: { end, start },
      responseReturn: 'raw',
      timeout: 60_000,
    },
  );
  return {
    blob: response.data,
    end: Number(response.headers?.['x-chunk-end']),
    fileSize: Number(response.headers?.['x-file-size']),
    start: Number(response.headers?.['x-chunk-start']),
    contentType: String(response.headers?.['content-type'] ?? ''),
    status: Number(response.status),
  };
}

export async function fetchInAppCardNotifications(
  params: {
    limit?: number;
  } = {},
): Promise<InAppCardNotification[]> {
  return silentRequestClient.get('/kanban/card-notifications/in-app', {
    params,
  });
}

export async function fetchInAppCardNotificationHistory(
  params: {
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: 'acked' | 'pending';
  } = {},
): Promise<InAppCardNotificationHistory> {
  return requestClient.get('/kanban/card-notifications/in-app/history', {
    params,
  });
}

export async function acknowledgeInAppCardNotification(
  eventId: number,
): Promise<{ id: number; status: string }> {
  return requestClient.post(`/kanban/card-notifications/in-app/${eventId}/ack`);
}

export async function fetchKanbanOverview(
  params: KanbanOverviewParams = {},
): Promise<KanbanOverview> {
  return requestClient.get('/kanban/monitor/overview', { params });
}

export async function fetchAnalyticsOverview(
  params: AnalyticsOverviewParams = {},
  signal?: AbortSignal,
): Promise<AnalyticsOverview> {
  return requestClient.get('/kanban/analytics/overview', { params, signal });
}

export async function fetchAnalyticsReport(
  params: AnalyticsReportParams = {},
  signal?: AbortSignal,
): Promise<AnalyticsReportOverview> {
  return requestClient.get('/kanban/analytics/report', { params, signal });
}

export async function fetchNetProfitOverview(
  params: NetProfitOverviewParams = {},
): Promise<NetProfitOverview> {
  return requestClient.get('/kanban/net-profit/overview', { params });
}

export async function fetchNetProfitBreakEven(
  params: NetProfitOverviewParams = {},
): Promise<NetProfitOverview['breakEven']> {
  return requestClient.get('/kanban/net-profit/break-even', { params });
}

export async function fetchNetProfitPivot(
  params: NetProfitOverviewParams = {},
): Promise<NetProfitOverview['pivot']> {
  return requestClient.get('/kanban/net-profit/pivot', { params });
}

export async function fetchNetProfitDetails(
  params: NetProfitDetailsParams = {},
): Promise<NetProfitDetails> {
  return requestClient.get('/kanban/net-profit/details', { params });
}

export async function fetchKanbanProductDetail(
  params: KanbanProductDetailParams = {},
): Promise<KanbanProductDetailOverview> {
  return requestClient.get('/kanban/monitor/product-detail', { params });
}

export async function fetchKanbanProductDetailMeta(
  params: KanbanProductDetailParams = {},
): Promise<KanbanProductDetailMeta> {
  return requestClient.get('/kanban/monitor/product-detail/meta', { params });
}

export async function fetchKanbanProductDetailRows(
  params: KanbanProductDetailRowsParams = {},
): Promise<KanbanProductDetailRows> {
  return requestClient.get('/kanban/monitor/product-detail/rows', { params });
}

export function downloadKanbanProductDetail(
  params: KanbanProductDetailExportParams = {},
): Promise<Blob> {
  return requestClient.download('/kanban/monitor/product-detail/export', {
    params,
    timeout: 300_000,
  });
}

export async function fetchKanbanProductDetailFbaInventory(
  params: KanbanProductDetailFbaInventoryParams,
): Promise<KanbanFbaInventorySkuBreakdown> {
  return requestClient.get('/kanban/monitor/product-detail/fba-inventory', {
    params,
  });
}

export async function fetchSpuDailyMetrics(params: {
  limit?: number;
  site?: string;
  spu: string;
}): Promise<KanbanDailyMetric[]> {
  return requestClient.get('/kanban/monitor/spu-daily', { params });
}

export async function fetchSpuManagerOverview(
  params: SpuManagerParams = {},
): Promise<SpuManagerOverview> {
  return requestClient.get('/kanban/spus', { params });
}

export async function fetchSpuManagerOptions(): Promise<SpuManagerOptions> {
  return requestClient.get('/kanban/spus/options');
}

export async function fetchSpuDetail(params: {
  site?: string;
  spu: string;
}): Promise<SpuManagerRow> {
  return requestClient.get('/kanban/spus/detail', { params });
}

export async function createSpu(data: SpuPayload): Promise<SpuManagerRow> {
  return requestClient.post('/kanban/spus', data);
}

export async function updateSpu(
  spu: string,
  site: string,
  data: SpuPayload,
): Promise<SpuManagerRow> {
  return requestClient.put(`/kanban/spus/${spu}/${site}`, data);
}

export async function fetchAdMonitorOverview(
  params: AdMonitorOverviewParams = {},
  signal?: AbortSignal,
): Promise<AdMonitorOverview> {
  return requestClient.get('/kanban/ads/overview', { params, signal });
}

export async function fetchAdMonitorTrend(
  params: AdMonitorOverviewParams = {},
  signal?: AbortSignal,
): Promise<AdMonitorTrend> {
  return requestClient.get('/kanban/ads/trend', { params, signal });
}

export async function fetchAdCampaignDrilldown(
  params: AdCampaignDrilldownParams,
  signal?: AbortSignal,
): Promise<AdCampaignDrilldown> {
  return requestClient.get('/kanban/ads/campaign-drilldown', {
    params,
    signal,
  });
}

export async function fetchAdAutomationCampaigns(
  params: AdAutomationParams = {},
  signal?: AbortSignal,
): Promise<AdAutomationOverview> {
  return requestClient.get('/kanban/ad-automation/campaigns', {
    params,
    signal,
  });
}

export async function fetchAdAutomationAnalysis(
  profileId: string,
  campaignId: string,
  params: Pick<AdAutomationParams, 'endDate' | 'startDate' | 'targetAcos'> & {
    refresh?: boolean;
  } = {},
): Promise<AdAutomationAnalysis> {
  return requestClient.get(
    `/kanban/ad-automation/campaigns/${profileId}/${campaignId}/analysis`,
    { params },
  );
}

export async function fetchShippingAllocationMeta(): Promise<ShippingAllocationMeta> {
  return requestClient.get('/kanban/shipping/meta');
}

export async function searchShippingLocations(
  codes: string[],
): Promise<ShippingLocationFinderResult> {
  return requestClient.post('/kanban/shipping/location-finder/search', {
    codes,
  });
}

export async function fetchShippingLocationFinderBootstrap(): Promise<ShippingLocationFinderBootstrap> {
  return requestClient.get('/kanban/shipping/location-finder/bootstrap');
}

export async function simulateShippingAllocation(
  data: ShippingSimulationPayload,
): Promise<ShippingSimulationResult> {
  return requestClient.post('/kanban/shipping/simulate', data);
}

export async function calculateShippingCartons(
  data: ShippingCartonCalculationPayload,
): Promise<ShippingCartonCalculationResult> {
  return requestClient.post('/kanban/shipping/cartons/calculate', data);
}

export async function fetchShippingWorkspace(): Promise<ShippingWorkspaceState> {
  return requestClient.get('/kanban/shipping/workspace');
}

export async function fetchShippingWorkspaceBootstrap(): Promise<ShippingWorkspaceBootstrap> {
  return requestClient.get('/kanban/shipping/workspace/bootstrap');
}

export async function fetchShippingWorkspaceSimulation(): Promise<ShippingSimulationResult> {
  return requestClient.get('/kanban/shipping/workspace/simulation');
}

export async function saveShippingWorkspace(
  data: ShippingWorkspaceState,
): Promise<ShippingWorkspaceState> {
  return requestClient.put('/kanban/shipping/workspace', data);
}

export async function syncShippingReceipts(): Promise<ShippingReceiptSyncResult> {
  return requestClient.post('/kanban/shipping/workspace/sync-receipts');
}

export async function syncShippingSkuPlans(): Promise<ShippingSkuPlanSyncResult> {
  return requestClient.post('/kanban/shipping/workspace/sync-sku-plans');
}

export async function importShippingReceipts(
  file: File,
): Promise<ShippingReceipt[]> {
  return requestClient.post(
    '/kanban/shipping/import/receipts',
    await file.arrayBuffer(),
    {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
      },
    },
  );
}

export async function importShippingSkuPlans(
  file: File,
): Promise<ShippingSkuPlan[]> {
  return requestClient.post(
    '/kanban/shipping/import/sku-plans',
    await file.arrayBuffer(),
    {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
      },
    },
  );
}

export function downloadShippingReceiptTemplate(): Promise<Blob> {
  return requestClient.download('/kanban/shipping/templates/receipt');
}

export function downloadShippingSkuPlanTemplate(): Promise<Blob> {
  return requestClient.download('/kanban/shipping/templates/sku-plan');
}

export function exportShippingWorkspace(): Promise<Blob> {
  return requestClient.download('/kanban/shipping/export');
}

export function exportTodayShippingWorkspace(): Promise<Blob> {
  return requestClient.download('/kanban/shipping/export/today');
}

export async function fetchTargetTrackerOverview(
  params: TargetTrackerParams = {},
): Promise<TargetTrackerOverview> {
  return requestClient.get('/kanban/targets/overview', { params });
}

export async function fetchAsin360Overview(
  params: Asin360OverviewParams,
  signal?: AbortSignal,
): Promise<Asin360Overview> {
  return requestClient.get('/kanban/asin360/overview', { params, signal });
}

export async function fetchAsin360StoreOptions(): Promise<Asin360StoreOptions> {
  return requestClient.get('/kanban/asin360/stores');
}

export async function fetchAsin360Section(
  params: Asin360SectionParams,
  signal?: AbortSignal,
): Promise<Record<string, any>> {
  const { section, ...rest } = params;
  return requestClient.get(`/kanban/asin360/${section}`, {
    params: rest,
    signal,
  });
}

export async function proxyLingxingApi(
  data: LingxingProxyPayload,
): Promise<Record<string, any>> {
  return requestClient.post('/kanban/asin360/proxy', data);
}

export async function fetchConfigOverview(): Promise<ConfigOverview> {
  return requestClient.get('/kanban/config/overview');
}

export async function saveCategoryConfig(
  data: CategoryConfigRow,
): Promise<CategoryConfigRow> {
  return requestClient.post('/kanban/config/categories', data);
}

export async function createConfigUser(
  data: CreateConfigUserPayload,
): Promise<ConfigUserRow> {
  return requestClient.post('/kanban/config/users', data);
}

export async function updateConfigUserAuth(
  userId: number,
  data: ConfigUserAuthPayload,
): Promise<ConfigUserRow> {
  return requestClient.put(`/kanban/config/users/${userId}/auth`, data);
}

export async function fetchConfigLoginLogs(
  limit = 100,
): Promise<LoginLogRow[]> {
  return requestClient.get('/kanban/config/login-logs', {
    params: { limit },
  });
}

export async function saveOperationGroup(
  data: OperationGroupPayload,
): Promise<OperationGroupRow> {
  return requestClient.post('/kanban/config/operation-groups', data);
}

export async function deleteOperationGroup(groupId: number): Promise<boolean> {
  return requestClient.delete(`/kanban/config/operation-groups/${groupId}`);
}
