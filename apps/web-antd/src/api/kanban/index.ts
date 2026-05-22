import { requestClient } from '#/api/request';

import type {
  AdMonitorFilters,
  AdMonitorOverview,
  KanbanDailyMetric,
  KanbanFilters,
  KanbanOverview,
} from './types';

export type {
  AlertLevel,
  KanbanDailyMetric,
  KanbanOverview,
  KanbanSpuRow,
} from './types';

export interface KanbanOverviewParams extends Partial<KanbanFilters> {}

export interface AdMonitorOverviewParams extends Partial<AdMonitorFilters> {
  endDate?: string;
  startDate?: string;
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

export async function fetchAdMonitorOverview(
  params: AdMonitorOverviewParams = {},
): Promise<AdMonitorOverview> {
  return requestClient.get('/kanban/ads/overview', { params });
}
