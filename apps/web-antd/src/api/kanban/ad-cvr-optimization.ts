import type {
  AdCampaignDetailMeta,
  AdCampaignDetailSection,
  AdCampaignDetailSectionResult,
  AdCampaignDetailTrendResult,
  AdCvrOptimizationExecutionResult,
  AdCvrOptimizationOperationContext,
  AdCvrOptimizationOperationResult,
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
  budgetAdjustments: Record<string, number> = {},
): Promise<AdCvrOptimizationExecutionResult> {
  return requestClient.post(
    '/kanban/ads/cvr-optimization/execute',
    {
      budgetAdjustments,
      suggestionIds,
    },
    { timeout: 300_000 },
  );
}

export async function fetchAdCvrOptimizationOperationContext(
  suggestionId: string,
): Promise<AdCvrOptimizationOperationContext> {
  return requestClient.get(
    `/kanban/ads/cvr-optimization/suggestions/${encodeURIComponent(suggestionId)}/operation-context`,
    { timeout: 300_000 },
  );
}

export async function updateAdCvrOptimizationCampaign(
  suggestionId: string,
  payload: {
    campaignName?: string;
    dailyBudget?: number;
    expectedCampaignName?: string;
    expectedDailyBudget?: number;
  },
): Promise<AdCvrOptimizationOperationResult> {
  return requestClient.put(
    `/kanban/ads/cvr-optimization/suggestions/${encodeURIComponent(suggestionId)}/campaign`,
    payload,
    { timeout: 300_000 },
  );
}

export async function updateAdCvrOptimizationAdGroup(
  suggestionId: string,
  payload: { adGroupName: string; expectedAdGroupName?: string },
): Promise<AdCvrOptimizationOperationResult> {
  return requestClient.put(
    `/kanban/ads/cvr-optimization/suggestions/${encodeURIComponent(suggestionId)}/ad-group`,
    payload,
    { timeout: 300_000 },
  );
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
