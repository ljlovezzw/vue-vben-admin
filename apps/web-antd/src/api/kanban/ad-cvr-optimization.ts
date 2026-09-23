import type {
  AdCampaignDetailMeta,
  AdCampaignDetailSection,
  AdCampaignDetailSectionResult,
  AdCampaignDetailTrendResult,
  AdCvrOptimizationExecutionResult,
  AdCvrOptimizationOperationContext,
  AdCvrOptimizationOverview,
  AdCvrOptimizationSuggestion,
} from './types';

import { requestClient } from '#/api/request';

export type AdCvrOptimizationScope = 'daily' | 'legacy';

export interface AdCvrSnapshotTiming {
  cadence: 'monthly' | 'rolling';
  cadenceLabel: string;
  dataThrough: string;
  calculatedAt: string;
  stale: boolean;
  executable: boolean;
  message: string;
  attributionObservationDays: number;
  cooldownHours: number;
  matureThrough: string;
}

export interface AdCvrAccuracyRow {
  actionLabel: string;
  suggestion_id: string;
  action_type: string;
  entity_name: string;
  site: string;
  store_name: string;
  spu: string;
  clicks: null | number;
  orders: null | number;
  spend: null | number;
  reason: string;
  reviewVersion: number;
  rating?: 'correct' | 'incorrect' | 'insufficient';
  note: string;
  reviewedBy: string;
  evidence: { eligible: boolean; reason: string; state: string };
}

export interface AdCvrAccuracySample {
  snapshot: AdCvrTaskPackageDetail['snapshot'];
  items: AdCvrAccuracyRow[];
  counts: Array<{
    action_type: string;
    actionLabel: string;
    correct: number;
    incorrect: number;
    insufficient: number;
    reviewed: number;
    total: number;
  }>;
  sampling: string;
}

export function fetchAdCvrAccuracy(
  params: { projectTags: string[] },
  scope: AdCvrOptimizationScope,
): Promise<AdCvrAccuracySample> {
  return requestClient.get(`${optimizationBase(scope)}/task-accuracy`, {
    params,
  });
}

export function saveAdCvrAccuracy(
  payload: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<unknown> {
  return requestClient.post(
    `${optimizationBase(scope)}/task-accuracy`,
    payload,
  );
}

export interface AdCvrTaskLease {
  assignedTo: string;
  holder: string;
  expiresAt: null | string;
  version: number;
  canEdit: boolean;
}

export interface AdCvrTaskPolicy {
  mode: 'shadow' | 'single_package' | 'team';
  dailyCapacity: null | number;
  pilotOwners: string[];
  pilotSpus: string[];
  shadowChecks: string[];
  acceptanceNote: string;
  ruleVersion: string;
  version: number;
  actor?: string;
  assignees?: string[];
  canManage?: boolean;
  canConfigure?: boolean;
  availableShadowDates?: string[];
  requiredShadowCycles?: number;
}

export type AdCvrTaskPolicyUpdate = Pick<
  AdCvrTaskPolicy,
  | 'acceptanceNote'
  | 'dailyCapacity'
  | 'mode'
  | 'pilotOwners'
  | 'pilotSpus'
  | 'shadowChecks'
  | 'version'
>;

export function updateAdCvrTaskLease(
  payload: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<AdCvrTaskLease> {
  return requestClient.post(`${optimizationBase(scope)}/task-lease`, payload);
}
export function transferAdCvrTasks(
  packages: Record<string, unknown>[],
  scope: AdCvrOptimizationScope,
): Promise<{
  results: Array<{
    error?: string;
    ok: boolean;
    site: string;
    spu: string;
    store: string;
  }>;
}> {
  return requestClient.post(`${optimizationBase(scope)}/task-transfer`, {
    packages,
  });
}
export interface AdCvrTaskReview {
  suggestion_id: string;
  source_version: string;
  source_date: string;
  review_date: string;
  review_kind: string;
  site: string;
  store_name: string;
  spu: string;
  responsible: string;
  status: string;
  evidence_json: string;
}
export function acknowledgeAdCvrTaskReview(
  payload: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<unknown> {
  return requestClient.post(
    `${optimizationBase(scope)}/task-reviews/acknowledge`,
    payload,
  );
}
export function fetchAdCvrTaskReviews(
  params: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<{ items: AdCvrTaskReview[]; page: number; total: number }> {
  return requestClient.get(`${optimizationBase(scope)}/task-reviews`, {
    params,
  });
}
export function fetchAdCvrTaskPolicy(
  scope: AdCvrOptimizationScope,
): Promise<AdCvrTaskPolicy> {
  return requestClient.get(`${optimizationBase(scope)}/task-policy`);
}
export function updateAdCvrTaskPolicy(
  payload: AdCvrTaskPolicyUpdate,
  scope: AdCvrOptimizationScope,
): Promise<AdCvrTaskPolicy> {
  return requestClient.post(`${optimizationBase(scope)}/task-policy`, payload);
}
export interface AdCvrBatchTask {
  completed: number;
  createdAt: string;
  message: string;
  result: null | Partial<AdCvrOptimizationExecutionResult>;
  status: 'interrupted' | 'partial_failed' | 'queued' | 'running' | 'succeeded';
  taskId: string;
  total: number;
}

export type AdCvrTaskStage =
  | 'ad_group'
  | 'campaign'
  | 'color'
  | 'health'
  | 'search_term'
  | 'target';

export interface AdCvrTaskPackage {
  lease?: AdCvrTaskLease;
  taskStatus?: string;
  packageId: string;
  snapshotDate: string;
  snapshotVersion: string;
  site: string;
  store: string;
  spu: string;
  responsible: string;
  suggestionCount: number;
  reviewedCount: number;
  pendingCount: number;
  failedCount: number;
  adGroupCount: number;
  groupSpend: number;
  priority: 'high' | 'observe' | 'routine' | 'urgent';
  priorityScore: number;
  stageCounts: Record<string, number>;
  responsibles: string[];
  readyCount: number;
  blockedCount: number;
  observeCount: number;
  adCvr: null | number;
  priorityReason: string;
  priorityEvidence?: {
    eligibleObjects: number;
    scoreMeaning: string;
    topObjectSpend: null | number;
    totalObjects: number;
  };
}

export interface AdCvrTaskParameters {
  bidPercentage?: number | string;
  budgetPercentage?: number | string;
  negative?: {
    keywordText?: null | string;
    matchType?: 'negativeExact' | 'negativePhrase';
    scope: 'ad_group' | 'campaign';
  };
  matchType?: {
    cpc: number | string;
    groupName: string;
    matchType: 'broad' | 'exact' | 'phrase';
  };
}

export interface AdCvrTaskPackageDetail {
  executionCandidateTotal?: number;
  executionCandidates?: AdCvrTaskPackageDetail['items'];
  ownerBreakdown?: Array<{ name: string; suggestions: number }>;
  lease?: AdCvrTaskLease;
  policy?: AdCvrTaskPolicy;
  stale?: boolean;
  latestSnapshot?: AdCvrTaskPackageDetail['snapshot'];
  inheritedCount?: number;
  suppressedCount?: number;
  packageId: string;
  snapshot: {
    date: string;
    rangeEnd: string;
    rangeStart: string;
    status: string;
    timing?: AdCvrSnapshotTiming;
    version: string;
  };
  site: string;
  store: string;
  spu: string;
  stage: AdCvrTaskStage;
  nextStage: string;
  stageCounts: Record<AdCvrTaskStage, { reviewed: number; total: number }>;
  health: {
    adCvr: null | number;
    adGroupCount: number;
    clicks: number;
    naturalCvr: null | number;
    naturalCvrSource?: 'organic' | 'sessions' | 'snapshot' | 'unavailable';
    naturalCvrVaries: boolean;
    naturalParentCount?: number;
    orders: number;
    sales: number;
    spend: number;
    targetCvr: null | number;
  };
  items: Array<
    AdCvrOptimizationSuggestion & {
      task_actor?: string;
      task_decided_at?: string;
      task_decision?: 'adopt' | 'ignore' | 'modify' | 'observe' | 'retain';
      task_history?: Array<{
        actor: string;
        at: string;
        decision: string;
        note: string;
        version: number;
      }>;
      task_note?: string;
      task_observe_until?: null | string;
      task_parameters?: AdCvrTaskParameters;
      task_state?: {
        childCount: number;
        evidence: { eligible: boolean; reason: string; state: string };
        inheritedFrom?: null | string;
        invalidatedReason?: null | string;
        parentIds: string[];
        projection?: null | {
          basis: string;
          clicks: number;
          cvr: null | number;
          orders: number;
          spend: number;
        };
        suppressedReason?: null | string;
      };
      task_version?: number;
    }
  >;
  pagination: { page: number; pageSize: number; total: number };
}

export interface AdCvrTaskPreview {
  timing?: AdCvrSnapshotTiming;
  matureEvidence?: Array<{
    action: string;
    clicks: number;
    orders: number;
    rangeEnd: string;
    rangeStart: string;
    spend: number;
    suggestionId: string;
  }>;
  colorAdIds: Record<string, string[]>;
  physicalCount: number;
  finalIds: string[];
  finalCount: number;
  inheritedCount: number;
  suppressedCount: number;
  executionAllowed?: boolean;
  policy?: AdCvrTaskPolicy;
  ready: boolean;
  blockers: string[];
  warnings: string[];
  selectedCount: number;
  validatedCount: number;
  snapshotDate: string;
  actionCounts: Record<string, number>;
  inheritance: 'none' | 'unverified' | 'verified';
  previewHash: string;
  items: Array<{
    action: string;
    adGroupId: string;
    campaignId: string;
    entityId: string;
    name: string;
    profileId: string;
    suggestionId: string;
  }>;
}

export function fetchAdCvrTaskPackages(
  params: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<{
  items: AdCvrTaskPackage[];
  options: { responsibles: string[]; sites: string[] };
  pagination: { page: number; pageSize: number; total: number };
  snapshot: {
    date: string;
    rangeEnd: string;
    rangeStart: string;
    status: string;
    timing?: AdCvrSnapshotTiming;
    version: string;
  };
  summary: Record<
    'blocked' | 'failed' | 'observe' | 'today' | 'total' | 'urgent',
    number
  >;
  workloads?: Array<{
    capacity: null | number;
    owner: string;
    pending: number;
  }>;
}> {
  return requestClient.get(`${optimizationBase(scope)}/task-packages`, {
    params,
  });
}

export function fetchAdCvrTaskPackage(
  params: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<AdCvrTaskPackageDetail> {
  return requestClient.get(`${optimizationBase(scope)}/task-package`, {
    params,
  });
}

export interface AdCvrTaskHistory {
  versions?: Array<{ count: number; date: string; version: string }>;
  items?: Array<{
    decision: null | string;
    history: Array<{
      actor?: string;
      at?: string;
      decision?: string;
      note?: string;
    }>;
    note: null | string;
    suggestion: { entity_name?: string; suggestion_id?: string };
  }>;
  page?: number;
  total?: number;
}

export function fetchAdCvrTaskHistory(
  params: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<AdCvrTaskHistory> {
  return requestClient.get(`${optimizationBase(scope)}/task-history`, {
    params,
  });
}

export function saveAdCvrTaskDecision(
  payload: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<{
  actor: string;
  decision: string;
  note: string;
  suggestionId: string;
  version: number;
}> {
  return requestClient.post(
    `${optimizationBase(scope)}/task-decisions`,
    payload,
  );
}

export function bulkAdoptAdCvrTaskDecisions(
  payload: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<{
  existingUnchanged: number;
  newlyAdopted: number;
  selected: number;
}> {
  return requestClient.post(
    `${optimizationBase(scope)}/task-decisions/bulk`,
    payload,
  );
}

export function previewAdCvrTask(
  payload: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<AdCvrTaskPreview> {
  return requestClient.post(`${optimizationBase(scope)}/task-preview`, payload);
}

export function previewAdCvrTaskRetry(
  taskId: string,
  scope: AdCvrOptimizationScope,
  projectTags: string[],
): Promise<{
  excludedCount: number;
  payload: Record<string, unknown>;
  preview: AdCvrTaskPreview;
}> {
  return requestClient.get(
    `${optimizationBase(scope)}/execution-tasks/${encodeURIComponent(taskId)}/retry-preview`,
    { params: { projectTags } },
  );
}

export function submitAdCvrTaskPackage(
  payload: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
): Promise<AdCvrBatchTask> {
  return requestClient.post(`${optimizationBase(scope)}/task-submit`, payload);
}

export function fetchAdCvrBatchTask(
  taskId: string,
  scope: AdCvrOptimizationScope,
): Promise<AdCvrBatchTask> {
  return requestClient.get(
    `${optimizationBase(scope)}/execution-tasks/${encodeURIComponent(taskId)}`,
  );
}

export function fetchAdCvrBatchTasks(
  scope: AdCvrOptimizationScope,
): Promise<{ tasks: AdCvrBatchTask[] }> {
  return requestClient.get(`${optimizationBase(scope)}/execution-tasks`);
}

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

export function reconcileAdCvrExecution(
  suggestionId: string,
  scope: AdCvrOptimizationScope = 'legacy',
): Promise<{
  batchId?: string;
  currentBid?: string;
  error?: string;
  message: string;
  operation?: string;
  status: string;
  targetBid?: string;
}> {
  return requestClient.post(
    `${optimizationBase(scope)}/suggestions/${encodeURIComponent(suggestionId)}/reconcile`,
    {},
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
