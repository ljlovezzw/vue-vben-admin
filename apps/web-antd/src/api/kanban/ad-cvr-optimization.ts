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

export type AdCvrOptimizationScope = 'daily' | 'legacy';

function optimizationBase(scope: AdCvrOptimizationScope) {
  return scope === 'daily'
    ? '/kanban/ads/daily-optimization'
    : '/kanban/ads/cvr-optimization';
}

export async function fetchAdCvrOptimizationOverview(
  params: Record<string, any>,
  scope: AdCvrOptimizationScope = 'legacy',
): Promise<AdCvrOptimizationOverview> {
  return requestClient.get(`${optimizationBase(scope)}/overview`, { params });
}

export async function updateAdCvrOptimizationDecisions(
  suggestionIds: string[],
  status: 'approved' | 'dismissed' | 'pending',
  scope: AdCvrOptimizationScope = 'legacy',
): Promise<{ status: string; updated: number }> {
  return requestClient.post(`${optimizationBase(scope)}/decisions`, {
    status,
    suggestionIds,
  });
}

export async function executeAdCvrOptimizationSuggestions(
  suggestionIds: string[],
  budgetAdjustments: Record<string, number> = {},
  scope: AdCvrOptimizationScope = 'legacy',
  bidAdjustments: Record<string, number> = {},
  matchTypeAdjustments: Record<
    string,
    { cpc: number; groupName: string; matchType: 'broad' | 'exact' | 'phrase' }
  > = {},
): Promise<AdCvrOptimizationExecutionResult> {
  return requestClient.post(
    `${optimizationBase(scope)}/execute`,
    {
      budgetAdjustments,
      bidAdjustments,
      matchTypeAdjustments,
      suggestionIds,
    },
    { timeout: 300_000 },
  );
}

export async function fetchAdCvrOptimizationOperationContext(
  suggestionId: string,
  scope: AdCvrOptimizationScope = 'legacy',
): Promise<AdCvrOptimizationOperationContext> {
  return requestClient.get(
    `${optimizationBase(scope)}/suggestions/${encodeURIComponent(suggestionId)}/operation-context`,
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
  scope: AdCvrOptimizationScope = 'legacy',
): Promise<AdCvrOptimizationOperationResult> {
  return requestClient.put(
    `${optimizationBase(scope)}/suggestions/${encodeURIComponent(suggestionId)}/campaign`,
    payload,
    { timeout: 300_000 },
  );
}

export async function updateAdCvrOptimizationAdGroup(
  suggestionId: string,
  payload: { adGroupName: string; expectedAdGroupName?: string },
  scope: AdCvrOptimizationScope = 'legacy',
): Promise<AdCvrOptimizationOperationResult> {
  return requestClient.put(
    `${optimizationBase(scope)}/suggestions/${encodeURIComponent(suggestionId)}/ad-group`,
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
