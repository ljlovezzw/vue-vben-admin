import type {
  AdCampaignDetailMeta,
  AdCampaignDetailSection,
  AdCampaignDetailSectionResult,
  AdCampaignDetailTrendResult,
  AdCvrOptimizationOverview,
} from './types';

import { requestClient } from '#/api/request';

export async function fetchAdCvrOptimizationOverview(
  params: Record<string, any>,
): Promise<AdCvrOptimizationOverview> {
  return requestClient.get('/kanban/ads/cvr-optimization/overview', { params });
}

export async function updateAdCvrOptimizationDecisions(
  suggestionIds: string[],
  status: 'approved' | 'dismissed' | 'pending',
): Promise<{ status: string; updated: number }> {
  return requestClient.post('/kanban/ads/cvr-optimization/decisions', {
    status,
    suggestionIds,
  });
}

export async function executeAdCvrOptimizationSuggestions(
  suggestionIds: string[],
): Promise<Record<string, any>> {
  return requestClient.post('/kanban/ads/cvr-optimization/execute', {
    suggestionIds,
  });
}

export async function fetchAdCampaignDetailMeta(
  profileId: string,
  campaignId: string,
): Promise<AdCampaignDetailMeta> {
  return requestClient.get(
    `/kanban/ads/campaign-detail/${encodeURIComponent(profileId)}/${encodeURIComponent(campaignId)}/meta`,
  );
}

export async function fetchAdCampaignDetailSection(
  profileId: string,
  campaignId: string,
  params: {
    adGroupId?: string;
    endDate: string;
    keyword?: string;
    page: number;
    pageSize: number;
    refresh?: boolean;
    section: AdCampaignDetailSection;
    startDate: string;
  },
  signal?: AbortSignal,
): Promise<AdCampaignDetailSectionResult> {
  return requestClient.get(
    `/kanban/ads/campaign-detail/${encodeURIComponent(profileId)}/${encodeURIComponent(campaignId)}/section`,
    { params, signal },
  );
}

export async function fetchAdCampaignDetailTrend(
  profileId: string,
  campaignId: string,
  params: {
    endDate: string;
    refresh?: boolean;
    startDate: string;
  },
  signal?: AbortSignal,
): Promise<AdCampaignDetailTrendResult> {
  return requestClient.get(
    `/kanban/ads/campaign-detail/${encodeURIComponent(profileId)}/${encodeURIComponent(campaignId)}/trend`,
    { params, signal },
  );
}
