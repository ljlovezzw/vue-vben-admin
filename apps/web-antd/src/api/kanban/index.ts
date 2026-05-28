import type {
  AdMonitorFilters,
  AdMonitorOverview,
  Asin360Overview,
  CategoryConfigRow,
  ConfigOverview,
  ConfigUserRow,
  KanbanDailyMetric,
  KanbanFilters,
  KanbanOverview,
  SpuManagerFilters,
  SpuManagerOverview,
  SpuManagerRow,
  SpuPayload,
  TargetTrackerOverview,
} from './types';

import { requestClient } from '#/api/request';

export type {
  AlertLevel,
  KanbanDailyMetric,
  KanbanOverview,
  KanbanSpuRow,
  SpuManagerRow,
} from './types';

export type KanbanOverviewParams = Partial<KanbanFilters>;

export interface AdMonitorOverviewParams extends Partial<AdMonitorFilters> {
  endDate?: string;
  startDate?: string;
}

export type SpuManagerParams = Partial<SpuManagerFilters>;

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

export async function fetchKanbanOverview(
  params: KanbanOverviewParams = {},
): Promise<KanbanOverview> {
  return requestClient.get('/kanban/monitor/overview', { params });
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
): Promise<AdMonitorOverview> {
  return requestClient.get('/kanban/ads/overview', { params });
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
  data: Omit<ConfigUserRow, 'id'>,
): Promise<ConfigUserRow> {
  return requestClient.post('/kanban/config/users', data);
}
