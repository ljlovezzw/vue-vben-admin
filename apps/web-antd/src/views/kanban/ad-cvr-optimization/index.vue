<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  AdCvrOptimizationOperationContext,
  AdCvrOptimizationOperatorSummaryRow,
  AdCvrOptimizationOverview,
  AdCvrOptimizationSuggestion,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  CircleX,
  Copy,
  ExternalLink,
  Eye,
  Info,
  RotateCw,
  Search,
  Settings,
} from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import {
  fetchAdCvrOptimizationOperationContext,
  fetchAdCvrOptimizationOverview,
  updateAdCvrOptimizationAdGroup,
  updateAdCvrOptimizationCampaign,
  updateAdCvrOptimizationDecisions,
} from '#/api/kanban/ad-cvr-optimization';

import {
  adCvrExecutionInProgress,
  adCvrExecutionRevision,
  runAdCvrExecutionTask,
} from './execution-task';

defineOptions({ name: 'KanbanAdCvrOptimization' });

const loading = ref(false);
const filtersExpanded = ref(false);
const router = useRouter();
const route = useRoute();
const apiScope = computed<'daily' | 'legacy'>(() =>
  route.name === 'KanbanDailyAdOptimization' ? 'daily' : 'legacy',
);
const isDailyOptimization = computed(() => apiScope.value === 'daily');
const submitting = ref(false);
const loadError = ref('');
const data = ref<AdCvrOptimizationOverview | null>(null);
const selectedIds = ref<string[]>([]);
const detail = ref<AdCvrOptimizationSuggestion | null>(null);
const operationOpen = ref(false);
const operationLoading = ref(false);
const operationSaving = ref<'' | 'budget' | 'campaign' | 'group'>('');
const operationContext = ref<AdCvrOptimizationOperationContext | null>(null);
const operationTarget = ref<AdCvrOptimizationSuggestion | null>(null);
const campaignNameDraft = ref('');
const adGroupNameDraft = ref('');
const dailyBudgetDraft = ref<number | undefined>();
const executionOpen = ref(false);
const budgetAdjustmentDrafts = ref<Record<string, number | undefined>>({});
const bidAdjustmentDrafts = ref<Record<string, number | undefined>>({});
const currentBids = ref<Record<string, number>>({});
const matchTypeDrafts = ref<Record<string, 'broad' | 'exact' | 'phrase' | undefined>>({});
const matchGroupNameDrafts = ref<Record<string, string>>({});
const matchCpcDrafts = ref<Record<string, number | undefined>>({});
const matchContexts = ref<Record<string, AdCvrOptimizationOperationContext>>({});
const bidLoading = ref(false);
const bidLoadError = ref('');
let operationLoadToken = 0;
let loadRequestSequence = 0;
let overviewCacheGeneration = 0;
const overviewCache = new Map<
  string,
  { expires: number; value: AdCvrOptimizationOverview }
>();
const overviewRequests = new Map<string, Promise<AdCvrOptimizationOverview>>();
const query = reactive({
  actions: [] as string[],
  adGroupKeyword: '',
  campaignKeyword: '',
  costTypes: [] as string[],
  countries: [] as string[],
  departments: [] as string[],
  entityStates: [] as string[],
  levels: [] as string[],
  lookupField: 'spu',
  lookupValue: '',
  page: 1,
  pageSize: 50,
  projectTags: [] as string[],
  responsible: '',
  search: '',
  selectedOnly: true,
  snapshotDate: '',
  serviceStatuses: [] as string[],
  severities: [] as string[],
  statuses: ['pending'] as string[],
  stores: [] as string[],
  sponsoredTypes: [] as string[],
  targetingTypes: [] as string[],
});
const activeAction = ref('');

const actionLabels: Record<string, string> = {
  adjust_bidding_strategy: '调整竞价策略与广告位',
  adjust_match_type: '调整匹配方式',
  audit_structure: '检查广告架构',
  check_bid: '检查竞价',
  check_data: '检查数据',
  close_ad_group: '关闭广告组',
  close_campaign: '关闭广告活动',
  close_color: '关闭颜色投放',
  close_target: '关闭投放内容',
  decrease_budget: '降低预算',
  fix_listing: '优化 Listing 承接',
  hold: '维持现状',
  improve_creative: '优化主图与广告素材',
  increase_bid: '提高竞价',
  increase_budget: '增加预算',
  lower_bid: '降低竞价',
  negative_asin: '否定 ASIN',
  negative_keyword: '否定关键词',
  observe: '继续观察',
  promote_search_term: '提升搜索词竞价',
};

function displayAction(row: AdCvrOptimizationSuggestion) {
  return (
    row.action_label ||
    row.actionLabel ||
    row.action ||
    actionLabels[row.action_type] ||
    row.action_type
  );
}

const actionTabs = computed(() =>
  [
    {
      label: '全部动作',
      value: '',
      count: data.value?.summary.byAction
        ? Object.values(data.value.summary.byAction).reduce(
            (sum, count) => sum + Number(count || 0),
            0,
          )
        : (data.value?.pagination.total ?? 0),
    },
    ...(data.value?.filters.actions ?? []).map((action) => ({
      label: action.label,
      value: action.value,
      count: Number(data.value?.summary.byAction?.[action.value] ?? 0),
    })),
  ].filter((tab) => !tab.value || tab.count > 0),
);

function setActionFilter(value: string) {
  if (activeAction.value === value) return;
  activeAction.value = value;
  query.actions = value ? [value] : [];
  selectedIds.value = [];
  void load(true);
}
const directExecutableActions = new Set([
  'adjust_match_type',
  'close_ad_group',
  'close_campaign',
  'close_color',
  'decrease_budget',
  'increase_bid',
  'increase_budget',
  'lower_bid',
]);
const budgetExecutableActions = new Set(['decrease_budget', 'increase_budget']);
const bidExecutableActions = new Set(['increase_bid', 'lower_bid']);
const maxDirectExecutionBatch = 20;
const completedExecutionStatuses = new Set(['succeeded']);
const levelLabels: Record<string, string> = {
  ad_group: '广告组',
  campaign: '广告活动',
  color: '颜色',
  search_term: '搜索词',
  target: '投放内容',
};

function levelLabel(row: { entity_name?: unknown; level?: string }) {
  if (
    row.level === 'color' &&
    /^\d+(?:[./-]\d+)?$/.test(String(row.entity_name || '').trim())
  ) {
    return '尺码';
  }
  return (row.level && levelLabels[row.level]) || row.level || '-';
}
const statusLabels: Record<string, string> = {
  approved: '已确认',
  dismissed: '已忽略',
  pending: '待判断',
};
const countryLabels: Record<string, string> = {
  ae: '阿联酋',
  au: '澳大利亚',
  be: '比利时',
  ca: '加拿大',
  de: '德国',
  es: '西班牙',
  fr: '法国',
  ie: '爱尔兰',
  it: '意大利',
  jp: '日本',
  mx: '墨西哥',
  nl: '荷兰',
  pl: '波兰',
  se: '瑞典',
  uk: '英国',
  us: '美国',
};
const sponsoredTypeLabels: Record<string, string> = {
  sb: 'SB（品牌推广）',
  sbv: 'SBV（品牌视频）',
  sd: 'SD（展示型推广）',
  sp: 'SP（商品推广）',
};
const targetingTypeLabels: Record<string, string> = {
  auto: '自动投放',
  audience: '受众投放',
  keyword: '关键词投放',
  manual: '手动投放',
  product: '商品投放',
  'audience-product': '受众与商品投放',
};
const stateLabels: Record<string, string> = {
  enabled: '启用',
  paused: '已暂停',
  archived: '已归档',
};
const costTypeLabels: Record<string, string> = {
  cpc: 'CPC（按点击付费）',
  fixed_price: '固定价格',
  vcpm: 'VCPM（按千次可见展示付费）',
};
const serviceStatusLabels: Record<string, string> = {
  account_out_of_budget: '账户预算不足',
  ad_group_paused: '广告组已暂停',
  ad_group_status_enabled: '广告组已启用',
  advertiser_payment_failure: '广告主付款失败',
  campaign_archived: '广告活动已归档',
  campaign_incomplete: '广告活动信息不完整',
  campaign_out_of_budget: '广告活动预算不足',
  campaign_paused: '广告活动已暂停',
  campaign_pending: '广告活动待生效',
  campaign_status_enabled: '广告活动已启用',
  ended: '已结束',
  portfolio_out_of_budget: '广告组合预算不足',
  rejected: '广告被拒绝',
};
const lookupOptions = [
  { label: '按 MSKU 查询', value: 'msku' },
  { label: '按 ASIN 查询', value: 'asin' },
  { label: '按父 ASIN 查询', value: 'parent_asin' },
  { label: '按 SPU 查询', value: 'spu' },
  { label: '按分类查询', value: 'category' },
];
const metricHelp: Record<string, string> = {
  cvr: '近 30 天广告订单数 ÷ 广告点击数',
  natural_cvr: '自然订单 ÷ 自然点击；缺失时回退为销量 ÷ Sessions',
  target_cvr: '自然 CVR + 2.5 个百分点',
};

type OperatorSummaryDisplayRow = AdCvrOptimizationOperatorSummaryRow & {
  isTotal?: boolean;
};

const operatorSummaryColumns: TableColumnsType<OperatorSummaryDisplayRow> = [
  {
    dataIndex: 'department',
    fixed: 'left',
    key: 'department',
    title: '部门',
    width: 112,
  },
  {
    dataIndex: 'responsible',
    fixed: 'left',
    key: 'responsible',
    title: '运营负责人',
    width: 112,
  },
  {
    dataIndex: 'campaignCount',
    key: 'campaignCount',
    title: '广告活动',
    width: 92,
  },
  {
    dataIndex: 'adGroupCount',
    key: 'adGroupCount',
    title: '广告组',
    width: 84,
  },
  {
    dataIndex: 'optimizationGroupCount',
    key: 'optimizationGroupCount',
    title: '需要优化',
    width: 170,
  },
  { dataIndex: 'spend', key: 'spend', title: '近30天花费', width: 130 },
  {
    dataIndex: 'optimizationSpend',
    key: 'optimizationSpend',
    title: '涉及优化花费',
    width: 146,
  },
  {
    dataIndex: 'estimatedSavings',
    key: 'estimatedSavings',
    title: '预计节约',
    width: 138,
  },
  {
    dataIndex: 'estimatedAcosImprovementPp',
    key: 'estimatedAcosImprovementPp',
    title: '预计ACoS改善',
    width: 190,
  },
  {
    dataIndex: 'recentTrend',
    key: 'recentTrend',
    title: '近期变化（日均/比率）',
    width: 220,
  },
];

const columns: TableColumnsType<AdCvrOptimizationSuggestion> = [
  { key: 'select', fixed: 'left', title: '', width: 46 },
  { dataIndex: 'priority', key: 'priority', title: '优先级', width: 92 },
  { dataIndex: 'level', key: 'level', title: '层级', width: 92 },
  {
    dataIndex: 'entity_name',
    key: 'entity_name',
    title: '优化对象',
    width: 80,
  },
  {
    dataIndex: 'ad_hierarchy',
    key: 'ad_hierarchy',
    title: '广告活动 / 广告组',
    width: 280,
  },
  { dataIndex: 'store_name', key: 'store_name', title: '店铺', width: 130 },
  { dataIndex: 'responsible', key: 'responsible', title: '负责人', width: 90 },
  { dataIndex: 'action_type', key: 'action_type', title: '建议', width: 130 },
  { dataIndex: 'cvr', key: 'cvr', title: '广告CVR', width: 92 },
  { dataIndex: 'natural_cvr', key: 'natural_cvr', title: '自然CVR', width: 92 },
  { dataIndex: 'target_cvr', key: 'target_cvr', title: '合理CVR', width: 92 },
  { dataIndex: 'clicks', key: 'clicks', title: '点击', width: 76 },
  {
    dataIndex: 'qualified_clicks',
    key: 'qualified_clicks',
    title: '合格点击',
    width: 88,
  },
  { dataIndex: 'spend', key: 'spend', title: '花费', width: 92 },
  { dataIndex: 'cpcReference', key: 'cpcReference', title: 'CPC', width: 92 },
  {
    dataIndex: 'relevance_label',
    key: 'relevance_label',
    title: '相关度',
    width: 88,
  },
  { dataIndex: 'reason', key: 'reason', title: '判断依据', width: 380 },
  {
    dataIndex: 'decision_status',
    key: 'decision_status',
    title: '状态',
    width: 90,
  },
  { key: 'operation', fixed: 'right', title: '', width: 82 },
];

const pagination = computed(() => ({
  current: data.value?.pagination.page ?? query.page,
  pageSize: data.value?.pagination.pageSize ?? query.pageSize,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条建议`,
  total: data.value?.pagination.total ?? 0,
}));
function isSuggestionExecuted(row: AdCvrOptimizationSuggestion) {
  return completedExecutionStatuses.has(
    String(row.execution_status || '')
      .trim()
      .toLowerCase(),
  );
}

function isSuggestionSelectable(row: AdCvrOptimizationSuggestion) {
  return !isSuggestionExecuted(row);
}

const selectableCurrentRows = computed(
  () => data.value?.rows.filter((row) => isSuggestionSelectable(row)) ?? [],
);
const allCurrentSelected = computed(() => {
  const current = selectableCurrentRows.value;
  return (
    current.length > 0 &&
    current.every((row) => selectedIds.value.includes(row.suggestion_id))
  );
});
const selectedRows = computed(
  () =>
    data.value?.rows.filter(
      (row) =>
        isSuggestionSelectable(row) &&
        selectedIds.value.includes(row.suggestion_id),
    ) ?? [],
);
const selectedBudgetRows = computed(() =>
  selectedRows.value.filter((row) =>
    budgetExecutableActions.has(row.action_type),
  ),
);
const selectedDirectRows = computed(() =>
  selectedRows.value.filter(
    (row) =>
      !budgetExecutableActions.has(row.action_type) &&
      !bidExecutableActions.has(row.action_type) &&
      row.action_type !== 'adjust_match_type',
  ),
);
const selectedBidRows = computed(() =>
  selectedRows.value.filter((row) => bidExecutableActions.has(row.action_type)),
);
const selectedMatchRows = computed(() =>
  selectedRows.value.filter((row) => row.action_type === 'adjust_match_type'),
);

function referenceCpc(row: { clicks?: unknown; spend?: unknown }) {
  const clicks = Number(row.clicks);
  const spend = Number(row.spend);
  return clicks > 0 && Number.isFinite(spend) ? money(spend / clicks) : '-';
}

function projectedBid(row: AdCvrOptimizationSuggestion) {
  const current = currentBids.value[row.suggestion_id];
  const ratio = bidAdjustmentDrafts.value[row.suggestion_id];
  if (!current || !ratio) return '等待输入比例';
  return (
    current *
    (1 + (row.action_type === 'increase_bid' ? ratio : -ratio) / 100)
  ).toFixed(2);
}
const someCurrentSelected = computed(() => {
  const current = selectableCurrentRows.value;
  const selectedCount = current.filter((row) =>
    selectedIds.value.includes(row.suggestion_id),
  ).length;
  return selectedCount > 0 && selectedCount < current.length;
});
const hasActiveFilters = computed(
  () =>
    Boolean(query.search || query.responsible) ||
    Boolean(
      query.adGroupKeyword || query.campaignKeyword || query.lookupValue,
    ) ||
    query.stores.length > 0 ||
    query.countries.length > 0 ||
    query.departments.length > 0 ||
    query.sponsoredTypes.length > 0 ||
    query.targetingTypes.length > 0 ||
    query.costTypes.length > 0 ||
    query.entityStates.length > 0 ||
    query.serviceStatuses.length > 0 ||
    query.severities.length > 0 ||
    query.levels.length > 0 ||
    query.actions.length > 0 ||
    query.statuses.length !== 1 ||
    query.statuses[0] !== 'pending' ||
    !query.selectedOnly,
);
const snapshotRange = computed(() => {
  const snapshot = data.value?.snapshot;
  if (!snapshot?.range_start || !snapshot?.range_end) return '等待快照数据';
  return `${snapshot.range_start} 至 ${snapshot.range_end}`;
});
const snapshotDateOptions = computed(() =>
  (data.value?.availableSnapshotDates ?? []).map((value) => ({
    label: value,
    value,
  })),
);
function normalizeCountry(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function storeCountry(store: unknown) {
  const match = String(store || '')
    .trim()
    .match(/-([a-z]{2})$/i);
  return match ? normalizeCountry(match[1]) : '';
}

function countryName(value: unknown) {
  const normalized = normalizeCountry(value);
  return countryLabels[normalized] || String(value || '').toUpperCase();
}

const storeOptions = computed(() => {
  const selectedCountries = new Set(
    query.countries.map((country) => normalizeCountry(country)),
  );
  const stores = data.value?.filters.stores ?? [];
  const visibleStores =
    selectedCountries.size > 0
      ? stores.filter((store) => selectedCountries.has(storeCountry(store)))
      : stores;

  return visibleStores.map((value) => ({
    label: value,
    searchLabel: `${value} ${countryName(storeCountry(value))}`,
    site: countryName(storeCountry(value)),
    tone: storeCountry(value) || 'other',
    value,
  }));
});

const countryOptions = computed(() =>
  (data.value?.filters.countries ?? []).map((value) => ({
    code: String(value).toUpperCase(),
    label: countryName(value),
    searchLabel: `${String(value)} ${countryName(value)}`,
    value,
  })),
);

watch(
  () => [...query.countries],
  () => {
    const allowedStores = new Set(
      storeOptions.value.map((option) => option.value),
    );
    query.stores = query.stores.filter((store) => allowedStores.has(store));
  },
);

watch(adCvrExecutionRevision, () => {
  selectedIds.value = [];
  void load();
});

function uniqueOptionValues(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = String(value).trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function labeledOptions(values: string[], labels: Record<string, string> = {}) {
  return uniqueOptionValues(values).map((value) => ({
    label: labels[value.toLowerCase()] || value,
    value,
  }));
}
const summaryItems = computed(() => [
  {
    label: '高优先级待处理',
    note: highPriorityGroupNote(),
    tone: 'danger',
    value: `${integer(data.value?.dashboard?.highPriorityGroupCount)} 组`,
  },
  {
    label: '低CVR异常花费',
    note: '近30天，按广告组去重',
    tone: 'warning',
    value: money(data.value?.operatorSummary?.total.optimizationSpend ?? 0),
  },
  {
    label: '异常点击',
    note: `${integer(data.value?.dashboard?.qualifiedSuggestionCount)} 条建议达到有效点击门槛`,
    tone: 'primary',
    value: integer(data.value?.dashboard?.qualifiedSuggestionClicks),
  },
  {
    label: '预计可节省',
    note: `预计降幅 ${rate(data.value?.operatorSummary?.total.estimatedSpendReductionPct)}`,
    tone: 'success',
    value: money(data.value?.operatorSummary?.total.estimatedSavings ?? 0),
  },
  {
    label: '待人工复核',
    note: '置信度不足，系统不自动执行',
    tone: 'neutral',
    value: `${integer(data.value?.dashboard?.lowConfidenceGroupCount)} 组`,
  },
]);

const highPriorityCount = computed(
  () => data.value?.dashboard?.highPriorityGroupCount ?? 0,
);

const priorityQueue = computed(() =>
  [...(data.value?.rows ?? [])]
    .filter((row) => row.decision_status === 'pending')
    .toSorted((left, right) => Number(right.priority) - Number(left.priority))
    .slice(0, 3),
);

const operatorSummaryRows = computed<OperatorSummaryDisplayRow[]>(() => {
  const summary = data.value?.operatorSummary;
  if (!summary) return [];
  return [...summary.rows, { ...summary.total, isTotal: true }];
});

const operatorSummaryHeadline = computed(() => {
  const total = data.value?.operatorSummary?.total;
  if (!total) return '等待汇总数据';
  return `${total.campaignCount.toLocaleString('zh-CN')} 个广告活动 · ${total.adGroupCount.toLocaleString('zh-CN')} 个广告组 · ${total.optimizationGroupCount.toLocaleString('zh-CN')} 组需要优化`;
});

function options(values: string[], labels: Record<string, string> = {}) {
  return uniqueOptionValues(values).map((value) => ({
    label: labels[value.toLowerCase()] || value,
    value,
  }));
}

function percent(value: null | number | string) {
  if (value === null || value === undefined || value === '') return '-';
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function money(value: number | string) {
  return `$${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function integer(value: null | number | string | undefined) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.round(number).toLocaleString('zh-CN')
    : '0';
}

function highPriorityGroupNote() {
  const dashboard = data.value?.dashboard;
  if (
    !dashboard?.previousSnapshotDate ||
    dashboard.highPriorityGroupChange === null
  ) {
    return '首个快照，暂无日环比';
  }
  const change = dashboard.highPriorityGroupChange;
  const sign = change > 0 ? '+' : '';
  return `较 ${dashboard.previousSnapshotDate} ${sign}${change} 组`;
}

function rate(value: null | number | string | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  return `${Number(value).toFixed(2)}%`;
}

function signedChange(value: null | number, suffix = '%') {
  if (value === null || !Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}${suffix}`;
}

function trendClass(value: null | number, lowerIsBetter = false) {
  if (value === null || value === 0 || !Number.isFinite(value))
    return 'trend-neutral';
  const favorable = lowerIsBetter ? value < 0 : value > 0;
  return favorable ? 'trend-positive' : 'trend-negative';
}

function optimizationCoverage(row: AdCvrOptimizationOperatorSummaryRow) {
  if (!row.spend) return '0.00%';
  return `${((row.optimizationSpend / row.spend) * 100).toFixed(2)}%`;
}

function filterByResponsible(row: OperatorSummaryDisplayRow) {
  if (row.isTotal || row.responsible === '未分配') return;
  query.responsible = row.responsible;
  void load(true);
}

function operatorSummaryRowClassName(row: OperatorSummaryDisplayRow) {
  return row.isTotal ? 'operator-total-row' : '';
}

function operatorSummaryRecord(record: Record<string, any>) {
  return record as OperatorSummaryDisplayRow;
}

function adjustmentText(record: AdCvrOptimizationSuggestion) {
  const metrics = record.metrics || {};
  const change = Number(metrics.recommended_change_pct);
  if (!Number.isFinite(change) || change === 0) return '-';
  const direction = change > 0 ? '提高' : '降低';
  const target = Number(metrics.recommended_value);
  const targetText = Number.isFinite(target)
    ? `，建议值 ${target.toFixed(2)}`
    : '';
  return `${direction} ${Math.abs(change).toFixed(0)}%${targetText}`;
}

function inventoryValue(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('zh-CN') : '-';
}

function inventoryText(record: AdCvrOptimizationSuggestion) {
  const metrics = record.metrics || {};
  return `可售 ${inventoryValue(metrics.advertised_inventory)} / 可用 ${inventoryValue(metrics.advertised_inventory_available_total)} / 总库存 ${inventoryValue(metrics.advertised_inventory_total_qty)}`;
}

function inventorySourceText(record: AdCvrOptimizationSuggestion) {
  const metrics = record.metrics || {};
  const sourceLabels: Record<string, string> = {
    fba_snapshot_exact: 'FBA 快照（SKU/MSKU 精确匹配）',
    fba_snapshot_spu_color: 'FBA 快照（SPU + 颜色匹配）',
    lingxing_ad_detail: '广告详情接口参考值',
  };
  const source =
    sourceLabels[String(metrics.advertised_inventory_source || '')] || '-';
  const age = Number(metrics.advertised_inventory_snapshot_age_hours);
  return Number.isFinite(age) ? `${source}，${age.toFixed(1)} 小时前` : source;
}

function severityColor(value: string) {
  if (value === 'high') return 'red';
  if (value === 'medium') return 'orange';
  return 'default';
}

function isPriorityFilterActive(severity?: string) {
  if (query.statuses.length !== 1 || query.statuses[0] !== 'pending')
    return false;
  if (!severity) return query.severities.length === 0;
  return query.severities.length === 1 && query.severities[0] === severity;
}

const allPendingPriorityCount = computed(() => {
  const counts = data.value?.summary.bySeverity;
  if (!counts) return data.value?.summary.pending ?? 0;
  return counts.high + counts.medium + counts.low;
});

function setPriorityFilter(severity?: string) {
  selectedIds.value = [];
  query.statuses = ['pending'];
  query.severities = severity ? [severity] : [];
  query.selectedOnly = true;
  void load(true, true);
}

function showApprovedSuggestions() {
  selectedIds.value = [];
  query.statuses = ['approved'];
  query.severities = [];
  query.selectedOnly = false;
  void load(true);
}

function priorityPreview(severity?: string) {
  if (loading.value || adCvrExecutionInProgress.value) return;
  void cachedOverview({
    ...structuredClone(toRaw(query)),
    page: 1,
    statuses: ['pending'],
    selectedOnly: true,
    severities: severity ? [severity] : [],
  }).catch(() => {});
}

function clearOverviewCache() {
  overviewCacheGeneration += 1;
  overviewCache.clear();
  overviewRequests.clear();
}

async function cachedOverview(params: typeof query) {
  const key = JSON.stringify(params);
  const cached = overviewCache.get(key);
  if (cached && cached.expires > Date.now())
    return structuredClone(cached.value);
  const existing = overviewRequests.get(key);
  if (existing) return existing;
  const generation = overviewCacheGeneration;
  const request = fetchAdCvrOptimizationOverview(params, apiScope.value).then(
    (value) => {
      if (generation === overviewCacheGeneration) {
        if (overviewCache.size >= 8) overviewCache.clear();
        overviewCache.set(key, {
          expires: Date.now() + 30_000,
          value: structuredClone(value),
        });
      }
      return value;
    },
  );
  overviewRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (overviewRequests.get(key) === request) overviewRequests.delete(key);
  }
}

function focusPending() {
  setPriorityFilter();
  requestAnimationFrame(() => {
    document
      .querySelector('.recommendation-card')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function priorityLabel(record: AdCvrOptimizationSuggestion) {
  let level = '低';
  if (record.severity === 'high') level = '高';
  else if (record.severity === 'medium') level = '中';
  return `${level} · ${Number(record.priority || 0)}`;
}

function queueImpact(record: AdCvrOptimizationSuggestion) {
  const change = Math.abs(Number(record.metrics?.recommended_change_pct));
  let ratio = 0;
  if (
    [
      'close_ad_group',
      'close_campaign',
      'close_color',
      'close_target',
      'negative_asin',
      'negative_keyword',
    ].includes(record.action_type)
  ) {
    ratio = 1;
  } else if (Number.isFinite(change) && change > 0) {
    ratio = Math.min(change, 100) / 100;
  }
  return ratio > 0
    ? `${money((Number(record.spend) * ratio) / 30)}/日`
    : '人工复核';
}

function cvrTone(record: AdCvrOptimizationSuggestion) {
  const cvr = Number(record.cvr);
  const natural = Number(record.natural_cvr);
  if (!Number.isFinite(cvr) || !Number.isFinite(natural))
    return 'metric-neutral';
  if (cvr <= natural) return 'metric-danger';
  if (cvr >= natural + 0.03) return 'metric-success';
  return 'metric-warning';
}

function suggestionRecord(record: Record<string, any>) {
  return record as AdCvrOptimizationSuggestion;
}

function metricValue(record: Record<string, any>, key: unknown) {
  return record[String(key || '')] as null | number | string;
}

function openDetail(record: Record<string, any>) {
  detail.value = suggestionRecord(record);
}

function openCampaignDetail(record: Record<string, any>) {
  const row = suggestionRecord(record);
  if (!row.campaign_id || !row.profile_id) {
    message.warning('当前建议缺少广告活动定位信息');
    return;
  }
  void router.push({
    name: 'KanbanAdCampaignDetail',
    params: { campaignId: row.campaign_id, profileId: row.profile_id },
    query: row.ad_group_id ? { adGroupId: row.ad_group_id } : undefined,
  });
}

async function copyName(value: unknown, label: string) {
  const text = String(value || '').trim();
  if (!text) {
    message.warning(`当前没有可复制的${label}`);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    message.success(`${label}已复制`);
  } catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    copied
      ? message.success(`${label}已复制`)
      : message.error(`${label}复制失败`);
  }
}

function patchOperationRows(
  target: AdCvrOptimizationSuggestion,
  values: { adGroupName?: string; campaignName?: string },
) {
  for (const row of data.value?.rows ?? []) {
    if (
      values.campaignName &&
      row.profile_id === target.profile_id &&
      row.campaign_id === target.campaign_id
    ) {
      row.campaign_name = values.campaignName;
      if (row.metrics?.optimization_object) {
        row.metrics.optimization_object.campaignName = values.campaignName;
      }
    }
    if (
      values.adGroupName &&
      row.profile_id === target.profile_id &&
      row.campaign_id === target.campaign_id &&
      row.ad_group_id === target.ad_group_id
    ) {
      row.ad_group_name = values.adGroupName;
      if (row.metrics?.optimization_object) {
        row.metrics.optimization_object.adGroupName = values.adGroupName;
      }
    }
  }
}

async function openOperation(record: Record<string, any>) {
  const row = suggestionRecord(record);
  if (!row.profile_id || !row.campaign_id) {
    message.warning('当前建议缺少广告活动定位信息');
    return;
  }
  const token = ++operationLoadToken;
  operationTarget.value = row;
  operationContext.value = null;
  operationOpen.value = true;
  operationLoading.value = true;
  try {
    const context = await fetchAdCvrOptimizationOperationContext(
      row.suggestion_id,
      apiScope.value,
    );
    if (token !== operationLoadToken) return;
    operationContext.value = context;
    campaignNameDraft.value = context.campaignName;
    adGroupNameDraft.value = context.adGroupName;
    dailyBudgetDraft.value = context.dailyBudget ?? undefined;
  } catch (error) {
    if (token === operationLoadToken) {
      message.error(
        `读取领星当前设置失败：${error instanceof Error ? error.message : error}`,
      );
    }
  } finally {
    if (token === operationLoadToken) operationLoading.value = false;
  }
}

function confirmOperation(
  title: string,
  content: string,
  saving: 'budget' | 'campaign' | 'group',
  submit: () => Promise<void>,
) {
  Modal.confirm({
    title,
    content,
    okText: '确认写入领星',
    cancelText: '取消',
    async onOk() {
      operationSaving.value = saving;
      try {
        await submit();
        clearOverviewCache();
      } catch (error) {
        message.error(
          `写入领星失败：${error instanceof Error ? error.message : error}`,
        );
        throw error;
      } finally {
        operationSaving.value = '';
      }
    },
  });
}

function closeOperation() {
  operationLoadToken += 1;
  operationOpen.value = false;
}

function saveCampaignName() {
  const context = operationContext.value;
  const target = operationTarget.value;
  const newName = campaignNameDraft.value.trim();
  if (!context || !target) return;
  if (!newName) {
    message.warning('广告活动名称不能为空');
    return;
  }
  if (newName === context.campaignName) {
    message.info('广告活动名称没有变化');
    return;
  }
  confirmOperation(
    '修改广告活动名称？',
    `“${context.campaignName}”将修改为“${newName}”。`,
    'campaign',
    async () => {
      const result = await updateAdCvrOptimizationCampaign(
        target.suggestion_id,
        {
          campaignName: newName,
          expectedCampaignName: context.campaignName,
        },
        apiScope.value,
      );
      context.campaignName = result.campaignName || newName;
      campaignNameDraft.value = context.campaignName;
      patchOperationRows(target, { campaignName: context.campaignName });
      message.success(result.message || '广告活动名称已更新');
    },
  );
}

function saveDailyBudget() {
  const context = operationContext.value;
  const target = operationTarget.value;
  const budget = dailyBudgetDraft.value;
  if (!context || !target) return;
  if (!context.budgetEditable) {
    message.warning(context.budgetBlockedReason || '当前预算不可在此修改');
    return;
  }
  if (!budget || budget <= 0) {
    message.warning('日预算必须大于 0');
    return;
  }
  if (budget === context.dailyBudget) {
    message.info('日预算没有变化');
    return;
  }
  confirmOperation(
    '修改广告活动日预算？',
    `日预算将从 ${context.dailyBudget ?? '-'} 修改为 ${budget}。`,
    'budget',
    async () => {
      const payload: {
        dailyBudget: number;
        expectedDailyBudget?: number;
      } = { dailyBudget: budget };
      if (context.dailyBudget !== null) {
        payload.expectedDailyBudget = context.dailyBudget;
      }
      const result = await updateAdCvrOptimizationCampaign(
        target.suggestion_id,
        payload,
        apiScope.value,
      );
      context.dailyBudget = result.dailyBudget ?? budget;
      dailyBudgetDraft.value = context.dailyBudget ?? undefined;
      message.success(result.message || '广告活动日预算已更新');
    },
  );
}

function saveAdGroupName() {
  const context = operationContext.value;
  const target = operationTarget.value;
  const newName = adGroupNameDraft.value.trim();
  if (!context || !target || !context.adGroupAvailable) return;
  if (!newName) {
    message.warning('广告组名称不能为空');
    return;
  }
  if (newName === context.adGroupName) {
    message.info('广告组名称没有变化');
    return;
  }
  confirmOperation(
    '修改广告组名称？',
    `“${context.adGroupName}”将修改为“${newName}”。`,
    'group',
    async () => {
      const result = await updateAdCvrOptimizationAdGroup(
        target.suggestion_id,
        {
          adGroupName: newName,
          expectedAdGroupName: context.adGroupName,
        },
        apiScope.value,
      );
      context.adGroupName = result.adGroupName || newName;
      adGroupNameDraft.value = context.adGroupName;
      patchOperationRows(target, { adGroupName: context.adGroupName });
      message.success(result.message || '广告组名称已更新');
    },
  );
}

async function load(reset = false, reuseCache = false) {
  if (reset) query.page = 1;
  if (!reuseCache) {
    clearOverviewCache();
  }
  const requestId = ++loadRequestSequence;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await cachedOverview(structuredClone(toRaw(query)));
    if (requestId !== loadRequestSequence) return;
    data.value = result;
    if (
      isDailyOptimization.value &&
      !query.snapshotDate &&
      result.snapshot?.snapshot_date
    ) {
      query.snapshotDate = String(result.snapshot.snapshot_date);
    }
    selectedIds.value = selectedIds.value.filter((id) =>
      data.value?.rows.some(
        (row) => row.suggestion_id === id && isSuggestionSelectable(row),
      ),
    );
  } catch (error) {
    if (requestId !== loadRequestSequence) return;
    loadError.value = error instanceof Error ? error.message : String(error);
    message.error(`加载广告优化建议失败：${loadError.value}`);
  } finally {
    if (requestId === loadRequestSequence) loading.value = false;
  }
}

function resetFilters() {
  activeAction.value = '';
  query.actions = [];
  query.adGroupKeyword = '';
  query.campaignKeyword = '';
  query.costTypes = [];
  query.countries = [];
  query.departments = [];
  query.entityStates = [];
  query.levels = [];
  query.lookupField = 'spu';
  query.lookupValue = '';
  query.responsible = '';
  query.search = '';
  query.selectedOnly = true;
  query.serviceStatuses = [];
  query.severities = [];
  query.statuses = ['pending'];
  query.stores = [];
  query.sponsoredTypes = [];
  query.targetingTypes = [];
  void load(true);
}

function toggle(row: AdCvrOptimizationSuggestion, checked: boolean) {
  if (checked && !isSuggestionSelectable(row)) return;
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, row.suggestion_id])]
    : selectedIds.value.filter((id) => id !== row.suggestion_id);
}

function toggleCurrent(checked: boolean) {
  const currentPageIds = data.value?.rows.map((row) => row.suggestion_id) ?? [];
  const selectableIds = selectableCurrentRows.value.map(
    (row) => row.suggestion_id,
  );
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, ...selectableIds])]
    : selectedIds.value.filter((id) => !currentPageIds.includes(id));
}

async function decide(status: 'dismissed' | 'pending') {
  if (selectedIds.value.length === 0) {
    message.warning('请先选择建议');
    return;
  }
  submitting.value = true;
  try {
    await updateAdCvrOptimizationDecisions(
      selectedIds.value,
      status,
      apiScope.value,
    );
    let successText = '已恢复为待判断';
    if (status === 'dismissed') {
      successText = '已忽略所选建议';
    }
    message.success(successText);
    selectedIds.value = [];
    await load();
  } catch (error) {
    message.error(
      `更新建议失败：${error instanceof Error ? error.message : error}`,
    );
  } finally {
    submitting.value = false;
  }
}

function snapshotBudget(row: AdCvrOptimizationSuggestion) {
  const value = Number(
    row.metrics?.daily_budget ??
      row.metrics?.dailyBudget ??
      row.metrics?.budget,
  );
  return Number.isFinite(value) && value > 0 ? value : null;
}

function projectedBudget(row: AdCvrOptimizationSuggestion) {
  const current = snapshotBudget(row);
  const percent = budgetAdjustmentDrafts.value[row.suggestion_id];
  if (!current || !percent || percent <= 0) return null;
  const direction = row.action_type === 'increase_budget' ? 1 : -1;
  return Math.round(current * (1 + (direction * percent) / 100) * 100) / 100;
}

function closeExecution() {
  executionOpen.value = false;
}

async function executeSelected() {
  if (bidLoading.value) return;
  if (adCvrExecutionInProgress.value) {
    message.info('已有广告优化任务正在执行，可继续使用其他页面');
    return;
  }
  if (selectedIds.value.length === 0) {
    message.warning('请先勾选要执行的建议');
    return;
  }
  if (selectedRows.value.length !== selectedIds.value.length) {
    selectedIds.value = selectedRows.value.map((row) => row.suggestion_id);
    message.warning('已执行成功的建议不能重复提交');
    return;
  }
  if (selectedIds.value.length > maxDirectExecutionBatch) {
    message.warning(
      `单次最多执行 ${maxDirectExecutionBatch} 条建议，请分批提交`,
    );
    return;
  }
  const dismissed = selectedRows.value.filter(
    (row) => row.decision_status === 'dismissed',
  );
  if (dismissed.length > 0) {
    message.warning('已忽略的建议请先恢复后再提交执行');
    return;
  }
  const unsupported = selectedRows.value.filter(
    (row) => !directExecutableActions.has(row.action_type),
  );
  if (unsupported.length > 0) {
    const labels = [...new Set(unsupported.map((row) => displayAction(row)))];
    message.warning(
      `${labels.join('、')}暂未复现可安全执行的领星接口，只能人工处理`,
    );
    return;
  }
  if (
    selectedBidRows.value.some(
      (row) =>
        row.level !== 'ad_group' || row.sponsored_type.toLowerCase() !== 'sp',
    )
  ) {
    message.warning(
      '竞价调整目前仅支持 SP 广告组默认竞价，请排除颜色和投放内容等其他层级',
    );
    return;
  }
  bidAdjustmentDrafts.value = {};
  currentBids.value = {};
  bidLoadError.value = '';
  budgetAdjustmentDrafts.value = Object.fromEntries(
    selectedRows.value
      .filter((row) => budgetExecutableActions.has(row.action_type))
      .map((row) => [row.suggestion_id, undefined]),
  );
  matchTypeDrafts.value = {};
  matchGroupNameDrafts.value = {};
  matchCpcDrafts.value = {};
  matchContexts.value = {};
  executionOpen.value = true;
  bidLoading.value = true;
  try {
    for (const row of selectedBidRows.value) {
      const context = await fetchAdCvrOptimizationOperationContext(
        row.suggestion_id,
        apiScope.value,
      );
      if (!context.currentBid || context.currentBid <= 0)
        throw new Error('领星未返回有效当前竞价');
      currentBids.value[row.suggestion_id] = context.currentBid;
    }
    for (const row of selectedMatchRows.value) {
      const context = await fetchAdCvrOptimizationOperationContext(
        row.suggestion_id,
        apiScope.value,
      );
      if (!context.matchTypeEditable) {
        throw new Error(context.matchTypeBlockedReason || '当前建议无法创建匹配方式广告组');
      }
      matchContexts.value[row.suggestion_id] = context;
      matchGroupNameDrafts.value[row.suggestion_id] = `${context.adGroupName || '广告组'}-${context.keywordText || row.targeting_text}`;
      matchCpcDrafts.value[row.suggestion_id] = context.currentBid || undefined;
      let defaultMatchType: 'broad' | 'exact' | 'phrase' = 'broad';
      if (context.originalMatchType === 'broad') {
        defaultMatchType = 'phrase';
      } else if (context.originalMatchType === 'phrase') {
        defaultMatchType = 'exact';
      }
      matchTypeDrafts.value[row.suggestion_id] = defaultMatchType;
    }
  } catch (error) {
    bidLoadError.value = `读取当前竞价失败，请关闭弹窗重试：${String(error)}`;
  } finally {
    bidLoading.value = false;
  }
}

async function submitExecution() {
  if (bidLoading.value || bidLoadError.value) return;
  const bidAdjustments: Record<string, number> = {};
  for (const row of selectedBidRows.value) {
    const ratio = Number(bidAdjustmentDrafts.value[row.suggestion_id]);
    if (
      !currentBids.value[row.suggestion_id] ||
      !Number.isFinite(ratio) ||
      ratio <= 0 ||
      ratio > 100 ||
      (row.action_type === 'lower_bid' && ratio >= 100) ||
      Number(projectedBid(row)) <= 0
    ) {
      message.warning(
        '请填写有效竞价比例：大于 0 且不超过 100%，降低须小于 100%，调整后竞价须大于 0',
      );
      return;
    }
    bidAdjustments[row.suggestion_id] = ratio;
  }
  if (selectedRows.value.length !== selectedIds.value.length) {
    executionOpen.value = false;
    selectedIds.value = selectedRows.value.map((row) => row.suggestion_id);
    message.warning('所选建议的执行状态已变化，请重新选择');
    return;
  }
  const budgetAdjustments: Record<string, number> = {};
  for (const row of selectedBudgetRows.value) {
    const percent = Number(budgetAdjustmentDrafts.value[row.suggestion_id]);
    const isDecrease = row.action_type === 'decrease_budget';
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      message.warning(`请为“${row.entity_name}”填写 0–100 之间的预算调整比例`);
      return;
    }
    if (isDecrease && percent >= 100) {
      message.warning(`“${row.entity_name}”降低预算必须小于 100%`);
      return;
    }
    budgetAdjustments[row.suggestion_id] = percent;
  }
  const matchTypeAdjustments: Record<string, { cpc: number; groupName: string; matchType: 'broad' | 'exact' | 'phrase' }> = {};
  for (const row of selectedMatchRows.value) {
    const groupName = String(matchGroupNameDrafts.value[row.suggestion_id] || '').trim();
    const cpc = Number(matchCpcDrafts.value[row.suggestion_id]);
    const matchType = matchTypeDrafts.value[row.suggestion_id];
    if (
      !groupName ||
      groupName.length > 255 ||
      !matchType ||
      !Number.isFinite(cpc) ||
      cpc <= 0 ||
      (matchContexts.value[row.suggestion_id]?.originalMatchType === matchType)
    ) {
      message.warning(`请完整填写“${row.targeting_text || row.entity_name}”的新广告组名称、匹配方式和 CPC`);
      return;
    }
    matchTypeAdjustments[row.suggestion_id] = { groupName, cpc, matchType };
  }
  const suggestionIds = selectedRows.value.map((row) => row.suggestion_id);
  executionOpen.value = false;
  try {
    await runAdCvrExecutionTask(
      suggestionIds,
      budgetAdjustments,
      apiScope.value,
      bidAdjustments,
      matchTypeAdjustments,
    );
  } catch {
    // The persistent notification owns execution errors and recovery guidance.
  }
}

function tableChange(value: TablePaginationConfig) {
  query.page = Number(value.current || 1);
  query.pageSize = Number(value.pageSize || 50);
  void load();
}

function rowClassName(record: AdCvrOptimizationSuggestion) {
  return selectedIds.value.includes(record.suggestion_id)
    ? 'is-selected-row'
    : '';
}

onMounted(() => {
  const responsible = String(route.query.responsible || '').trim();
  if (responsible) query.responsible = responsible;
  const countries = route.query.countries;
  if (countries) {
    query.countries = Array.isArray(countries)
      ? countries.map(String)
      : [String(countries)];
  }
  const departments = route.query.departments;
  if (departments) {
    query.departments = Array.isArray(departments)
      ? departments.map(String)
      : [String(departments)];
  }
  const projectTags = route.query.projectTags;
  if (projectTags) {
    query.projectTags = Array.isArray(projectTags)
      ? projectTags.map(String)
      : [String(projectTags)];
  }
  if (isDailyOptimization.value && route.query.snapshotDate) {
    query.snapshotDate = String(route.query.snapshotDate);
  }
  void load();
});

watch(apiScope, () => {
  query.snapshotDate = '';
  selectedIds.value = [];
  data.value = null;
  clearOverviewCache();
  void load(true);
});
</script>

<template>
  <div class="optimization-page">
    <header class="page-head">
      <div>
        <h1>
          {{ isDailyOptimization ? '今日广告优化' : '广告低CVR智能优化台' }}
        </h1>
        <p v-if="data?.snapshot">
          统计区间：{{ data.snapshot.range_start }} 至
          {{ data.snapshot.range_end }} · 深层广告组
          {{ data.snapshot.deep_group_count }}/{{ data.snapshot.group_count }}
          <template v-if="data.snapshot.metadata_refreshed_at">
            · 数据更新：{{ data.snapshot.metadata_refreshed_at }}
          </template>
        </p>
      </div>
      <div class="page-head-actions">
        <Select
          v-if="isDailyOptimization"
          v-model:value="query.snapshotDate"
          :options="snapshotDateOptions"
          aria-label="选择广告优化快照日期"
          class="snapshot-date-select"
          placeholder="选择快照日期"
          @change="load(true)"
        />
        <Tooltip title="刷新当前数据">
          <Button aria-label="刷新当前数据" shape="circle" @click="load()">
            <RotateCw :class="{ spinning: loading }" :size="16" />
          </Button>
        </Tooltip>
        <Tag
          :color="data?.snapshot?.status === 'succeeded' ? 'green' : 'orange'"
        >
          {{
            data?.snapshot?.status === 'succeeded' ? '数据完整' : '持续补齐中'
          }}
        </Tag>
      </div>
    </header>

    <section class="priority-alert">
      <div class="priority-alert-main">
        <span class="priority-alert-icon"><Info :size="16" /></span>
        <div>
          <strong>今日有 {{ highPriorityCount }} 组高优先级问题</strong>
          <p>建议先处理高点击、低转化的广告对象；系统建议默认不会自动执行。</p>
        </div>
      </div>
      <Button type="primary" @click="focusPending">查看待处理</Button>
    </section>

    <Alert
      v-if="loadError"
      class="load-error"
      :message="`数据加载失败：${loadError}`"
      show-icon
      type="error"
    >
      <template #action>
        <Button size="small" @click="load()">重试</Button>
      </template>
    </Alert>

    <section class="summary-strip">
      <div
        v-for="item in summaryItems"
        :key="item.label"
        class="summary-item"
        :class="`tone-${item.tone}`"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.note }}</small>
      </div>
    </section>

    <section class="filter-band">
      <div class="filter-primary-row">
        <div class="priority-tabs" aria-label="处理优先级">
          <button
            class="priority-filter-option is-all"
            :class="{ active: isPriorityFilterActive() }"
            type="button"
            :aria-pressed="isPriorityFilterActive()"
            @click="setPriorityFilter()"
            @mouseenter="priorityPreview()"
            @focus="priorityPreview()"
          >
            全部
            <b>{{ allPendingPriorityCount }}</b>
          </button>
          <button
            class="priority-filter-option is-high"
            :class="{ active: isPriorityFilterActive('high') }"
            type="button"
            :aria-pressed="isPriorityFilterActive('high')"
            title="高风险或强证据项，建议优先止损或排查"
            @click="setPriorityFilter('high')"
            @mouseenter="priorityPreview('high')"
            @focus="priorityPreview('high')"
          >
            <i aria-hidden="true"></i>
            立即处理
            <b>{{ data?.summary.bySeverity?.high ?? 0 }}</b>
          </button>
          <button
            class="priority-filter-option is-medium"
            :class="{ active: isPriorityFilterActive('medium') }"
            type="button"
            :aria-pressed="isPriorityFilterActive('medium')"
            title="近期趋势恶化或效率未达标，建议尽快处理"
            @click="setPriorityFilter('medium')"
            @mouseenter="priorityPreview('medium')"
            @focus="priorityPreview('medium')"
          >
            <i aria-hidden="true"></i>
            尽快处理
            <b>{{ data?.summary.bySeverity?.medium ?? 0 }}</b>
          </button>
          <button
            class="priority-filter-option is-low"
            :class="{ active: isPriorityFilterActive('low') }"
            type="button"
            :aria-pressed="isPriorityFilterActive('low')"
            title="风险较低或仍需积累证据，可持续观察并排期跟进"
            @click="setPriorityFilter('low')"
            @mouseenter="priorityPreview('low')"
            @focus="priorityPreview('low')"
          >
            <i aria-hidden="true"></i>
            观察跟进
            <b>{{ data?.summary.bySeverity?.low ?? 0 }}</b>
          </button>
          <button
            class="priority-filter-option is-all"
            :class="{
              active:
                query.statuses.length === 1 && query.statuses[0] === 'approved',
            }"
            type="button"
            :aria-pressed="
              query.statuses.length === 1 && query.statuses[0] === 'approved'
            "
            title="查看历史已确认建议，可直接勾选提交执行"
            @click="showApprovedSuggestions()"
          >
            历史已确认
          </button>
        </div>
        <label class="filter-item compact-filter">
          <span>负责人</span>
          <Select
            v-model:value="query.responsible"
            :options="options(data?.filters.responsibles ?? [])"
            allow-clear
            aria-label="负责人"
            popup-class-name="ad-optimization-dropdown"
            placeholder="全部负责人"
            show-search
          />
        </label>
        <label class="filter-item compact-filter">
          <span>站点</span>
          <Select
            v-model:value="query.countries"
            :options="countryOptions"
            allow-clear
            aria-label="国家"
            max-tag-count="responsive"
            mode="multiple"
            option-filter-prop="searchLabel"
            popup-class-name="ad-optimization-dropdown ad-optimization-scope-dropdown"
            placeholder="全部站点"
            show-search
          >
            <template #option="{ label, code }">
              <div class="scope-option">
                <span class="scope-option-name">{{ label }}</span>
                <span class="scope-code">{{ code }}</span>
              </div>
            </template>
          </Select>
        </label>
        <Input
          v-model:value="query.search"
          allow-clear
          aria-label="搜索广告对象"
          class="primary-search"
          placeholder="搜索广告活动、广告组、ASIN 或投放对象"
          @press-enter="load(true)"
        />
        <Button @click="filtersExpanded = !filtersExpanded">
          {{ filtersExpanded ? '收起筛选' : '更多筛选' }}
        </Button>
        <Button type="primary" @click="load(true)">
          <Search :size="15" />
          查询
        </Button>
      </div>

      <div v-show="filtersExpanded" class="filter-panel">
        <label class="filter-item filter-date-range">
          <span>统计区间</span>
          <strong class="snapshot-range">{{ snapshotRange }}</strong>
        </label>
        <label class="filter-item">
          <span>店铺</span>
          <Select
            v-model:value="query.stores"
            :options="storeOptions"
            allow-clear
            aria-label="店铺"
            max-tag-count="responsive"
            mode="multiple"
            option-filter-prop="searchLabel"
            popup-class-name="ad-optimization-dropdown ad-optimization-scope-dropdown"
            placeholder="全部店铺"
            show-search
          >
            <template #option="{ label, site, tone }">
              <div class="scope-option">
                <span class="scope-option-name">{{ label }}</span>
                <span class="scope-site-badge" :class="`is-${tone}`">
                  {{ site || '其他' }}
                </span>
              </div>
            </template>
          </Select>
        </label>
        <label class="filter-item">
          <span>广告类型</span>
          <Select
            v-model:value="query.sponsoredTypes"
            :options="
              labeledOptions(
                data?.filters.sponsoredTypes ?? [],
                sponsoredTypeLabels,
              )
            "
            allow-clear
            aria-label="广告类型"
            mode="multiple"
            popup-class-name="ad-optimization-dropdown"
            placeholder="全部广告类型"
          />
        </label>
        <label class="filter-item">
          <span>投放类型</span>
          <Select
            v-model:value="query.targetingTypes"
            :options="
              labeledOptions(
                data?.filters.targetingTypes ?? [],
                targetingTypeLabels,
              )
            "
            allow-clear
            aria-label="投放类型"
            mode="multiple"
            popup-class-name="ad-optimization-dropdown"
            placeholder="全部投放类型"
          />
        </label>
        <label class="filter-item">
          <span>广告活动</span>
          <Input
            v-model:value="query.campaignKeyword"
            allow-clear
            aria-label="广告活动名称"
            placeholder="输入广告活动名称"
            @press-enter="load(true)"
          />
        </label>
        <label class="filter-item">
          <span>成本类型</span>
          <Select
            v-model:value="query.costTypes"
            :options="options(data?.filters.costTypes ?? [], costTypeLabels)"
            allow-clear
            aria-label="成本类型"
            mode="multiple"
            popup-class-name="ad-optimization-dropdown"
            placeholder="全部成本类型"
          />
        </label>
        <label class="filter-item">
          <span>广告状态</span>
          <Select
            v-model:value="query.entityStates"
            :options="
              labeledOptions(data?.filters.entityStates ?? [], stateLabels)
            "
            allow-clear
            aria-label="广告活动状态"
            mode="multiple"
            popup-class-name="ad-optimization-dropdown"
            placeholder="全部状态"
          />
        </label>
        <label class="filter-item">
          <span>服务状态</span>
          <Select
            v-model:value="query.serviceStatuses"
            :options="
              options(data?.filters.serviceStatuses ?? [], serviceStatusLabels)
            "
            allow-clear
            aria-label="服务状态"
            mode="multiple"
            popup-class-name="ad-optimization-dropdown"
            placeholder="全部服务状态"
            show-search
          />
        </label>
        <label class="filter-item lookup-field">
          <span>查询维度</span>
          <Select
            v-model:value="query.lookupField"
            :options="lookupOptions"
            aria-label="查询维度"
            popup-class-name="ad-optimization-dropdown"
          />
        </label>
        <label class="filter-item lookup-value">
          <span>查询值</span>
          <Input
            v-model:value="query.lookupValue"
            allow-clear
            aria-label="按所选维度查询"
            placeholder="MSKU、ASIN、父 ASIN、SPU 或分类"
            @press-enter="load(true)"
          />
        </label>
        <label class="filter-item">
          <span>广告组</span>
          <Input
            v-model:value="query.adGroupKeyword"
            allow-clear
            aria-label="广告组名称"
            placeholder="输入广告组名称"
            @press-enter="load(true)"
          />
        </label>
        <label class="filter-item">
          <span>判断层级</span>
          <Select
            v-model:value="query.levels"
            :options="data?.filters.levels ?? []"
            allow-clear
            aria-label="判断层级"
            mode="multiple"
            popup-class-name="ad-optimization-dropdown"
            placeholder="全部层级"
          />
        </label>
        <div class="filter-actions">
          <Checkbox v-model:checked="query.selectedOnly">
            只看待采取行动
          </Checkbox>
          <Button :disabled="!hasActiveFilters" @click="resetFilters">
            <RotateCw :size="15" />
            重置
          </Button>
        </div>
      </div>
    </section>

    <section class="overview-grid">
      <section class="operator-summary-band">
        <header class="operator-summary-head">
          <div>
            <h2>建议广告优化</h2>
            <p>{{ operatorSummaryHeadline }}</p>
          </div>
          <Tooltip
            :title="
              [
                data?.operatorSummary?.methodology.baseline,
                data?.operatorSummary?.methodology.estimatedSavings,
                data?.operatorSummary?.methodology.estimatedAcosImprovement,
                data?.operatorSummary?.methodology.recentTrend,
                data?.operatorSummary?.methodology.filterScope,
              ]
                .filter(Boolean)
                .join('；')
            "
          >
            <span class="methodology-help"><Info :size="14" />估算口径</span>
          </Tooltip>
        </header>
        <Table
          :columns="operatorSummaryColumns"
          :data-source="operatorSummaryRows"
          :loading="loading"
          :pagination="false"
          :row-class-name="operatorSummaryRowClassName"
          :row-key="
            (row) =>
              `${row.department}-${row.responsible}-${row.isTotal ? 'total' : 'operator'}`
          "
          :scroll="{ x: 1394, y: 292 }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <strong v-if="column.dataIndex === 'department'">
              {{ record.department }}
            </strong>
            <button
              v-else-if="
                column.dataIndex === 'responsible' &&
                !record.isTotal &&
                record.responsible !== '未分配'
              "
              class="operator-filter-link"
              type="button"
              @click="filterByResponsible(operatorSummaryRecord(record))"
            >
              {{ record.responsible }}
            </button>
            <strong v-else-if="column.dataIndex === 'responsible'">
              {{ record.responsible }}
            </strong>
            <span
              v-else-if="
                ['campaignCount', 'adGroupCount'].includes(
                  String(column.dataIndex),
                )
              "
              class="count-value"
            >
              {{
                Number(record[String(column.dataIndex)] || 0).toLocaleString(
                  'zh-CN',
                )
              }}
            </span>
            <div
              v-else-if="column.dataIndex === 'optimizationGroupCount'"
              class="optimization-count-cell"
            >
              <strong>{{
                  record.optimizationGroupCount.toLocaleString('zh-CN')
                }}
                组</strong>
              <span>{{
                  record.actionableSuggestionCount.toLocaleString('zh-CN')
                }}
                条建议</span>
              <Tag v-if="record.highPriorityCount" color="red">
                高优先 {{ record.highPriorityCount.toLocaleString('zh-CN') }}
              </Tag>
            </div>
            <strong
              v-else-if="column.dataIndex === 'spend'"
              class="money-value"
            >
              {{ money(record.spend) }}
            </strong>
            <div
              v-else-if="column.dataIndex === 'optimizationSpend'"
              class="metric-stack"
            >
              <strong>{{ money(record.optimizationSpend) }}</strong>
              <span>覆盖
                {{ optimizationCoverage(operatorSummaryRecord(record)) }}</span>
            </div>
            <div
              v-else-if="column.dataIndex === 'estimatedSavings'"
              class="metric-stack saving-value"
            >
              <strong>{{ money(record.estimatedSavings) }}</strong>
              <span>预计降幅 {{ rate(record.estimatedSpendReductionPct) }}</span>
            </div>
            <div
              v-else-if="column.dataIndex === 'estimatedAcosImprovementPp'"
              class="acos-improvement-cell"
            >
              <strong>{{ rate(record.currentAcos) }} →
                {{ rate(record.estimatedAcos) }}</strong>
              <span v-if="record.estimatedAcosImprovementPp !== null">
                改善 {{ record.estimatedAcosImprovementPp.toFixed(2) }}pp
              </span>
              <span v-else>销售额为 0，暂不估算</span>
            </div>
            <div
              v-else-if="column.dataIndex === 'recentTrend'"
              class="recent-trend-cell"
            >
              <span>
                <small>花费</small>
                <b :class="trendClass(record.spendChangePct, true)">
                  {{ signedChange(record.spendChangePct) }}
                </b>
              </span>
              <span>
                <small>销售额</small>
                <b :class="trendClass(record.salesChangePct)">
                  {{ signedChange(record.salesChangePct) }}
                </b>
              </span>
              <span>
                <small>ACoS</small>
                <b :class="trendClass(record.acosChangePp, true)">
                  {{ signedChange(record.acosChangePp, 'pp') }}
                </b>
              </span>
              <span>
                <small>CVR</small>
                <b :class="trendClass(record.cvrChangePp)">
                  {{ signedChange(record.cvrChangePp, 'pp') }}
                </b>
              </span>
            </div>
          </template>
          <template #emptyText>
            <Empty description="当前范围没有运营汇总数据" />
          </template>
        </Table>
      </section>

      <aside class="priority-queue">
        <header class="queue-head">
          <div>
            <h2>今日处置顺序</h2>
            <p>按优先级与当前样本证据排序</p>
          </div>
        </header>
        <div v-if="priorityQueue.length > 0" class="queue-list">
          <button
            v-for="(record, index) in priorityQueue"
            :key="record.suggestion_id"
            class="queue-item"
            type="button"
            @click="openDetail(record)"
          >
            <span class="queue-rank">{{ index + 1 }}</span>
            <span class="queue-content">
              <strong>{{
                record.entity_name || record.campaign_name || '-'
              }}</strong>
              <small>
                {{ Number(record.clicks || 0).toLocaleString('zh-CN') }} 点击 ·
                {{ displayAction(record) }}
              </small>
            </span>
            <span class="queue-impact">{{ queueImpact(record) }}</span>
          </button>
        </div>
        <Empty
          v-else
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
          description="暂无待处置建议"
        />
      </aside>
    </section>

    <section class="recommendation-card">
      <header class="recommendation-head">
        <div>
          <h2>低CVR建议清单</h2>
          <p>
            {{ data?.pagination.total ?? 0 }} 条建议 ·
            点击行可查看完整诊断证据与执行影响
          </p>
        </div>
        <Tooltip
          title="广告 CVR 低于合理 CVR，且达到有效点击门槛后进入建议清单。"
        >
          <span class="methodology-help"><Info :size="14" />判定口径</span>
        </Tooltip>
      </header>
      <div class="action-tabs" role="tablist" aria-label="建议动作">
        <button
          v-for="tab in actionTabs"
          :key="tab.value || 'all'"
          class="action-tab"
          :class="{ active: activeAction === tab.value }"
          type="button"
          role="tab"
          :aria-selected="activeAction === tab.value"
          @click="setActionFilter(tab.value)"
        >
          {{ tab.label }} <b>{{ tab.count.toLocaleString('zh-CN') }}</b>
        </button>
      </div>
      <div class="action-bar">
        <div class="selection-status">
          <Checkbox
            :checked="allCurrentSelected"
            :disabled="selectableCurrentRows.length === 0"
            :indeterminate="someCurrentSelected"
            @change="toggleCurrent($event.target.checked)"
          >
            选择当前页
          </Checkbox>
          <span>已选 <b>{{ selectedIds.length }}</b> 条</span>
        </div>
        <Space class="batch-actions" wrap>
          <Button
            :disabled="selectedIds.length === 0"
            :loading="submitting"
            @click="decide('dismissed')"
          >
            <CircleX :size="15" />
            忽略
          </Button>
          <Button
            :disabled="selectedIds.length === 0 || adCvrExecutionInProgress"
            :loading="adCvrExecutionInProgress"
            danger
            type="primary"
            @click="executeSelected"
          >
            <ExternalLink :size="15" />
            {{ adCvrExecutionInProgress ? '执行中' : '提交执行' }}
          </Button>
        </Space>
      </div>

      <div class="table-band">
        <Spin :spinning="loading">
          <Table
            v-if="data?.rows.length"
            :columns="columns"
            :data-source="data.rows"
            :pagination="pagination"
            :row-class-name="rowClassName"
            :row-key="(row) => row.suggestion_id"
            :scroll="{ x: 2410, y: 'calc(100vh - 440px)' }"
            size="small"
            @change="tableChange"
          >
            <template #headerCell="{ column }">
              <span
                v-if="metricHelp[String(column.dataIndex || '')]"
                class="metric-heading"
              >
                {{ column.title }}
                <Tooltip :title="metricHelp[String(column.dataIndex || '')]">
                  <Info :size="13" />
                </Tooltip>
              </span>
            </template>
            <template #bodyCell="{ column, record }">
              <Tooltip
                v-if="column.key === 'select'"
                :title="
                  isSuggestionExecuted(suggestionRecord(record))
                    ? '已执行成功，不可重复选择'
                    : undefined
                "
              >
                <span class="row-selection-control">
                  <Checkbox
                    :aria-label="
                      isSuggestionExecuted(suggestionRecord(record))
                        ? '该建议已执行成功，不可选择'
                        : '选择该建议'
                    "
                    :checked="selectedIds.includes(record.suggestion_id)"
                    :disabled="
                      !isSuggestionSelectable(suggestionRecord(record))
                    "
                    @change="
                      toggle(suggestionRecord(record), $event.target.checked)
                    "
                  />
                </span>
              </Tooltip>
              <Tag
                v-else-if="column.dataIndex === 'priority'"
                :color="severityColor(record.severity)"
              >
                {{ priorityLabel(suggestionRecord(record)) }}
              </Tag>
              <Tag v-else-if="column.dataIndex === 'level'">
                {{ levelLabel(record) }}
              </Tag>
              <div
                v-else-if="column.dataIndex === 'entity_name'"
                class="entity-cell"
              >
                <strong>{{ record.entity_name || '-' }}</strong>
              </div>
              <div
                v-else-if="column.dataIndex === 'ad_hierarchy'"
                class="hierarchy-cell"
              >
                <div class="hierarchy-line">
                  <em>活动</em>
                  <Tooltip
                    :title="`广告活动 ID：${record.campaign_id || '-'}`"
                    placement="topLeft"
                  >
                    <button
                      class="hierarchy-link"
                      type="button"
                      @click="openCampaignDetail(record)"
                    >
                      <strong>{{
                        record.campaign_name || record.campaign_id || '-'
                      }}</strong>
                      <ExternalLink :size="12" />
                    </button>
                  </Tooltip>
                  <Tooltip title="复制广告活动名称">
                    <Button
                      aria-label="复制广告活动名称"
                      shape="circle"
                      size="small"
                      type="text"
                      @click="copyName(record.campaign_name, '广告活动名称')"
                    >
                      <Copy :size="13" />
                    </Button>
                  </Tooltip>
                </div>
                <div class="hierarchy-line">
                  <em>广告组</em>
                  <Tooltip
                    :title="`广告组 ID：${record.ad_group_id || '-'}`"
                    placement="topLeft"
                  >
                    <button
                      class="hierarchy-link"
                      type="button"
                      @click="openCampaignDetail(record)"
                    >
                      <strong>{{
                        record.ad_group_name || record.ad_group_id || '-'
                      }}</strong>
                      <ExternalLink :size="12" />
                    </button>
                  </Tooltip>
                  <Tooltip title="复制广告组名称">
                    <Button
                      aria-label="复制广告组名称"
                      :disabled="!record.ad_group_name"
                      shape="circle"
                      size="small"
                      type="text"
                      @click="copyName(record.ad_group_name, '广告组名称')"
                    >
                      <Copy :size="13" />
                    </Button>
                  </Tooltip>
                </div>
                <small>{{ record.campaign_id || '-' }} ·
                  {{ record.ad_group_id || '-' }}</small>
              </div>
              <Tag
                v-else-if="column.dataIndex === 'action_type'"
                :color="severityColor(record.severity)"
              >
                {{ displayAction(suggestionRecord(record)) }}
              </Tag>
              <strong
                v-else-if="column.dataIndex === 'cvr'"
                class="metric-value"
                :class="cvrTone(suggestionRecord(record))"
              >
                {{ percent(record.cvr) }}
              </strong>
              <span
                v-else-if="
                  ['natural_cvr', 'target_cvr'].includes(
                    String(column.dataIndex),
                  )
                "
                class="metric-value metric-neutral"
              >
                {{ percent(metricValue(record, column.dataIndex)) }}
              </span>
              <strong v-else-if="column.dataIndex === 'cpcReference'">{{
                referenceCpc(record)
              }}</strong>
              <strong
                v-else-if="column.dataIndex === 'spend'"
                class="money-value"
                >{{ money(record.spend) }}</strong>
              <Tag
                v-else-if="column.dataIndex === 'relevance_label'"
                :color="
                  record.relevance_label === '低相关'
                    ? 'orange'
                    : record.relevance_label === '待确认'
                      ? 'default'
                      : 'green'
                "
              >
                {{ record.relevance_label || '-' }}
              </Tag>
              <Tag
                v-else-if="column.dataIndex === 'decision_status'"
                :color="
                  record.decision_status === 'approved'
                    ? 'green'
                    : record.decision_status === 'dismissed'
                      ? 'default'
                      : 'blue'
                "
              >
                {{
                  statusLabels[record.decision_status] || record.decision_status
                }}
              </Tag>
              <Space v-else-if="column.key === 'operation'" :size="0">
                <Tooltip title="修改领星广告设置">
                  <Button
                    aria-label="修改领星广告设置"
                    shape="circle"
                    size="small"
                    type="text"
                    @click="openOperation(record)"
                  >
                    <Settings :size="15" />
                  </Button>
                </Tooltip>
                <Tooltip title="查看建议明细">
                  <Button
                    aria-label="查看建议明细"
                    shape="circle"
                    size="small"
                    type="text"
                    @click="openDetail(record)"
                  >
                    <Eye :size="15" />
                  </Button>
                </Tooltip>
              </Space>
            </template>
          </Table>
          <Empty v-else description="当前筛选没有优化建议">
            <Button v-if="hasActiveFilters" @click="resetFilters">
              清除筛选
            </Button>
          </Empty>
        </Spin>
      </div>
    </section>

    <Modal
      :footer="null"
      :open="operationOpen"
      destroy-on-close
      title="修改领星广告设置"
      width="720px"
      @cancel="closeOperation"
    >
      <Spin :spinning="operationLoading">
        <Alert
          class="operation-alert"
          message="当前值来自当天优化快照；保存前会重新读取领星实时值并校验，确认后立即写入广告账户。"
          show-icon
          type="warning"
        />
        <template v-if="operationContext">
          <div class="operation-meta">
            <span>{{ operationContext.storeName || '-' }}</span>
            <Tag color="blue">{{ operationContext.adType.toUpperCase() }}</Tag>
            <span>活动 ID {{ operationContext.campaignId }}</span>
            <span v-if="operationContext.adGroupId">
              广告组 ID {{ operationContext.adGroupId }}
            </span>
          </div>

          <div class="operation-form">
            <div class="operation-row">
              <label for="campaign-name-input">
                <strong>广告活动名称</strong>
                <span>对应领星活动列表中的修改名称</span>
              </label>
              <Input
                id="campaign-name-input"
                v-model:value="campaignNameDraft"
                :maxlength="255"
                show-count
              />
              <Button
                :loading="operationSaving === 'campaign'"
                type="primary"
                @click="saveCampaignName"
              >
                保存名称
              </Button>
            </div>

            <div class="operation-row">
              <label for="daily-budget-input">
                <strong>广告活动日预算</strong>
                <span>快照预算 {{ operationContext.dailyBudget ?? '-' }}</span>
              </label>
              <InputNumber
                id="daily-budget-input"
                v-model:value="dailyBudgetDraft"
                :disabled="!operationContext.budgetEditable"
                :min="0.01"
                :precision="2"
                :step="1"
                class="operation-number"
              />
              <Button
                :disabled="!operationContext.budgetEditable"
                :loading="operationSaving === 'budget'"
                type="primary"
                @click="saveDailyBudget"
              >
                保存预算
              </Button>
              <Alert
                v-if="operationContext.budgetBlockedReason"
                :message="operationContext.budgetBlockedReason"
                class="operation-row-message"
                show-icon
                type="info"
              />
            </div>

            <div v-if="operationContext.adGroupId" class="operation-row">
              <label for="ad-group-name-input">
                <strong>广告组名称</strong>
                <span>只修改当前广告组，不影响活动名称</span>
              </label>
              <Input
                id="ad-group-name-input"
                v-model:value="adGroupNameDraft"
                :disabled="!operationContext.adGroupAvailable"
                :maxlength="255"
                show-count
              />
              <Button
                :disabled="!operationContext.adGroupAvailable"
                :loading="operationSaving === 'group'"
                type="primary"
                @click="saveAdGroupName"
              >
                保存名称
              </Button>
              <Alert
                v-if="operationContext.adGroupError"
                :message="`广告组实时设置读取失败：${operationContext.adGroupError}`"
                class="operation-row-message"
                show-icon
                type="error"
              />
            </div>
          </div>
        </template>
        <Empty
          v-else-if="!operationLoading"
          description="未能读取领星当前设置"
        />
      </Spin>
    </Modal>

    <Modal
      :confirm-loading="adCvrExecutionInProgress"
      :open="executionOpen"
      :width="760"
      cancel-text="返回检查"
      ok-text="确认写入领星"
      title="确认执行广告优化"
      :ok-button-props="{ disabled: bidLoading || Boolean(bidLoadError) }"
      @cancel="closeExecution"
      @ok="submitExecution"
    >
      <Alert
        class="execution-alert"
        message="将直接修改领星广告账户。关闭类操作会暂停投放；预算和竞价按写入时领星实时值计算。CPC 仅作参考，不是竞价基数。"
        show-icon
        type="warning"
      />
      <div v-if="selectedDirectRows.length > 0" class="execution-section">
        <strong>直接执行</strong>
        <div class="execution-list">
          <div
            v-for="row in selectedDirectRows"
            :key="row.suggestion_id"
            class="execution-item"
          >
            <div>
              <b>{{ displayAction(row) }}</b>
              <span>{{ row.entity_name }} ·
                {{ row.campaign_name || row.campaign_id }}</span>
            </div>
            <Tag color="red">暂停投放</Tag>
          </div>
        </div>
      </div>
      <div v-if="selectedBidRows.length > 0" class="execution-section">
        <strong>广告组竞价调整</strong>
        <p v-if="bidLoading">正在读取领星当前竞价…</p>
        <Alert
          v-if="bidLoadError"
          :message="bidLoadError"
          type="error"
          show-icon
        />
        <div
          v-for="row in selectedBidRows"
          :key="row.suggestion_id"
          class="execution-item execution-budget-item"
        >
          <div class="execution-budget-copy">
            <b>{{ displayAction(row) }}：{{ row.entity_name }}</b>
            <span>当前竞价 {{ currentBids[row.suggestion_id] ?? '读取中' }} · CPC
              {{ referenceCpc(row) }} · 调整后 {{ projectedBid(row) }}</span>
          </div>
          <span class="execution-percent-control">
            <InputNumber
              v-model:value="bidAdjustmentDrafts[row.suggestion_id]"
              :min="0.01"
              :max="row.action_type === 'lower_bid' ? 99.99 : 100"
              :precision="2"
              placeholder="例如 10"
              :aria-label="`${displayAction(row)}比例`"
            />
            <em>%</em>
          </span>
        </div>
        <p>
          当前值来自领星，提交时会再次读取；期间竞价变化时，以写入前的实时值为准。
        </p>
      </div>
      <div v-if="selectedMatchRows.length > 0" class="execution-section">
        <strong>调整匹配方式</strong>
        <p>将在当前广告活动下新建广告组，不修改原广告组；复制原广告组有效商品广告，并添加当前同词关键词。</p>
        <div
          v-for="row in selectedMatchRows"
          :key="row.suggestion_id"
          class="execution-item execution-budget-item"
        >
          <div class="execution-budget-copy">
            <b>{{ row.targeting_text || row.entity_name }}</b>
            <span>
              原广告组 {{ row.ad_group_name || row.ad_group_id }} · 原匹配
              {{ matchContexts[row.suggestion_id]?.originalMatchType || '未知' }}
            </span>
            <Input
              v-model:value="matchGroupNameDrafts[row.suggestion_id]"
              :maxlength="255"
              placeholder="新广告组名称"
              aria-label="新广告组名称"
            />
          </div>
          <div class="execution-match-controls">
            <Select
              v-model:value="matchTypeDrafts[row.suggestion_id]"
              :options="[
                { label: '广泛匹配', value: 'broad' },
                { label: '词组匹配', value: 'phrase' },
                { label: '精确匹配', value: 'exact' },
              ]"
              aria-label="新匹配方式"
              placeholder="新匹配方式"
            />
            <InputNumber
              v-model:value="matchCpcDrafts[row.suggestion_id]"
              :min="0.01"
              :precision="2"
              placeholder="CPC"
              aria-label="CPC"
            />
            <span>CPC</span>
          </div>
        </div>
      </div>
      <div v-if="selectedBudgetRows.length > 0" class="execution-section">
        <strong>预算调整比例</strong>
        <p>请输入百分比；系统会在写入前读取领星实时日预算，再按该比例增减。</p>
        <div class="execution-list">
          <div
            v-for="row in selectedBudgetRows"
            :key="row.suggestion_id"
            class="execution-item execution-budget-item"
          >
            <div class="execution-budget-copy">
              <b>{{ displayAction(row) }}：{{ row.entity_name }}</b>
              <span>
                快照日预算 {{ snapshotBudget(row) ?? '未提供' }}； 预估调整后
                {{ projectedBudget(row) ?? '等待输入比例' }}
              </span>
            </div>
            <span class="execution-percent-control">
              <InputNumber
                v-model:value="budgetAdjustmentDrafts[row.suggestion_id]"
                :max="100"
                :min="0.01"
                :precision="2"
                :status="
                  budgetAdjustmentDrafts[row.suggestion_id]
                    ? undefined
                    : 'error'
                "
                class="execution-percent-input"
                placeholder="例如 10"
              />
              <em>%</em>
            </span>
          </div>
        </div>
      </div>
    </Modal>

    <Drawer
      :open="Boolean(detail)"
      :title="detail?.entity_name || '建议明细'"
      width="520"
      @close="detail = null"
    >
      <template v-if="detail">
        <div class="detail-metrics">
          <div>
            <span>广告 CVR</span><strong :class="cvrTone(detail)">{{ percent(detail.cvr) }}</strong>
          </div>
          <div>
            <span>自然 CVR</span><strong>{{ percent(detail.natural_cvr) }}</strong>
          </div>
          <div>
            <span>合理 CVR</span><strong>{{ percent(detail.target_cvr) }}</strong>
          </div>
        </div>
        <div class="detail-grid">
          <span>层级</span><b>{{ levelLabel(detail) }}</b> <span>建议</span><b>{{ displayAction(detail) }}</b> <span>问题类型</span><b>{{ detail.diagnosis_label || '-' }}</b> <span>判断置信度</span><b>{{ detail.confidence_label || '-' }}</b> <span>建议调整</span><b>{{ adjustmentText(detail) }}</b> <span>调整依据</span><b>{{ detail.metrics?.recommendation_basis || '-' }}</b>
          <span>店铺 / 负责人</span><b>{{ detail.store_name }} / {{ detail.responsible || '-' }}</b>
          <span>广告活动</span><b>{{ detail.campaign_name || '-' }}</b>
          <span>广告活动 ID</span><b>{{ detail.campaign_id || '-' }}</b>
          <span>广告组</span><b>{{ detail.ad_group_name || '-' }}</b>
          <span>广告组 ID</span><b>{{ detail.ad_group_id || '-' }}</b>
          <span>SPU / 父ASIN</span><b>{{ detail.spu || '-' }} / {{ detail.parent_asin || '-' }}</b>
          <span>订单 / 点击</span><b>{{ detail.orders }} / {{ detail.clicks }}</b> <span>合格点击</span><b>{{ detail.qualified_clicks ?? '-' }}</b> <span>花费 / 销售额</span><b>{{ money(detail.spend) }} / {{ money(detail.sales) }}</b>
          <span>库存（可售 / 可用 / 总）</span><b>{{ inventoryText(detail) }}</b> <span>库存快照</span><b>{{ inventorySourceText(detail) }}</b> <span>投放内容</span><b>{{ detail.targeting_text || '-' }}</b> <span>搜索词</span><b>{{ detail.search_term || '-' }}</b> <span>相关度</span><b>{{ detail.relevance_label || '-' }}</b> <span>执行方式</span><b>{{
            directExecutableActions.has(detail.action_type)
              ? '确认后可直接写入领星'
              : '人工处理'
          }}</b>
        </div>
        <h3>判断依据</h3>
        <p class="reason">{{ detail.reason }}</p>
      </template>
    </Drawer>
  </div>
</template>

<style scoped>
.optimization-page {
  --opt-border: hsl(var(--border));
  --opt-muted: hsl(var(--muted-foreground));
  --opt-page: hsl(var(--background-deep));
  --opt-panel: hsl(var(--card));
  --opt-subtle: hsl(var(--muted));
  --opt-text: hsl(var(--foreground));

  max-width: 1680px;
  min-height: 100%;
  padding: 24px;
  margin: 0 auto;
  color: var(--opt-text);
  background: var(--opt-page);
}

.page-head,
.page-head-actions,
.filter-actions,
.action-bar,
.selection-status,
.metric-heading {
  display: flex;
  align-items: center;
}

.page-head {
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-head h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: var(--opt-text);
  letter-spacing: -0.02em;
}

.page-head p {
  margin: 4px 0 0;
  margin-top: 7px;
  font-size: 13px;
  color: var(--opt-muted);
}

.page-head-actions {
  gap: 10px;
}

.snapshot-date-select {
  width: 142px;
}

.page-head-actions :deep(.ant-tag) {
  padding: 5px 10px;
  margin: 0;
  font-weight: 700;
  border: 0;
  border-radius: 999px;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

.policy-alert,
.load-error {
  margin-bottom: 12px;
  border-radius: 6px;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(160px, 1fr));
  gap: 12px;
  overflow: visible;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.summary-item {
  position: relative;
  min-height: 116px;
  padding: 16px 17px 15px;
  overflow: hidden;
  background: var(--opt-panel);
  border: 1px solid var(--opt-border);
  border-right: 1px solid var(--opt-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgb(16 24 40 / 2%);
}

.summary-item:last-child {
  border-right: 0;
}

.summary-item::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  content: '';
  background: #98a2b3;
  border-radius: 2px;
  opacity: 1;
}

.summary-item span,
.summary-item strong {
  display: block;
}

.summary-item span {
  font-size: 12px;
  font-weight: 650;
  color: var(--opt-muted);
}

.summary-item.tone-primary::after {
  background: #2563eb;
}

.summary-item.tone-danger strong {
  color: #d92d20;
}

.summary-item.tone-danger::after {
  background: #d92d20;
}

.summary-item.tone-warning strong {
  color: #b54708;
}

.summary-item.tone-warning::after {
  background: #f79009;
}

.summary-item.tone-success strong {
  color: #067647;
}

.summary-item.tone-success::after {
  background: #12b76a;
}

.summary-item.tone-money strong {
  color: #175cd3;
}

.summary-item.tone-money::after {
  background: #528bff;
}

.filter-band {
  position: relative;
  display: block;
  grid-template-columns: repeat(6, minmax(148px, 1fr));
  gap: 10px;
  padding: 12px;
  margin-top: 14px;
  background: var(--opt-panel);
  border: 1px solid var(--opt-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgb(16 24 40 / 4%);
}

.filter-item {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.filter-item > span {
  display: flex;
  align-items: center;
  min-height: 16px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  color: #344054;
}

.filter-item > span::before {
  width: 3px;
  height: 12px;
  margin-right: 6px;
  content: '';
  background: #84adff;
  border-radius: 2px;
}

.filter-item :deep(.ant-select),
.filter-item :deep(.ant-input-affix-wrapper) {
  width: 100%;
}

.filter-item :deep(.ant-select-selector),
.filter-item :deep(.ant-input-affix-wrapper) {
  min-height: 32px;
  border-color: #cbd5e1;
  border-radius: 4px;
  box-shadow: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.filter-item :deep(.ant-select-selector) {
  padding: 0 8px !important;
  background: #fff;
}

.filter-item :deep(.ant-select-single .ant-select-selector) {
  align-items: center;
}

.filter-item :deep(.ant-select-selection-placeholder),
.filter-item :deep(.ant-input::placeholder) {
  color: #98a2b3;
}

.filter-item :deep(.ant-select-selection-item),
.filter-item :deep(.ant-select-selection-search-input),
.filter-item :deep(.ant-input) {
  font-size: 13px;
}

.filter-item :deep(.ant-select-selection-item) {
  color: #1d2939;
}

.filter-item :deep(.ant-select-multiple .ant-select-selection-item) {
  height: 22px;
  padding: 1px 6px;
  margin-top: 4px;
  margin-bottom: 4px;
  line-height: 19px;
  color: #175cd3;
  background: #eff8ff;
  border: 1px solid #b2ddff;
  border-radius: 3px;
}

.filter-item :deep(.ant-select-selection-item-remove) {
  color: #528bff;
}

.filter-item :deep(.ant-select-selection-item-remove:hover) {
  color: #175cd3;
}

.scope-option {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
}

.scope-option::before {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  content: '';
  border: 1px solid #cbd5e1;
  border-radius: 3px;
}

:global(
  .ad-optimization-scope-dropdown
    .ant-select-item-option-selected:not(.ant-select-item-option-disabled)
    .scope-option::before
) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  content: '✓';
  background: #2563eb;
  border-color: #2563eb;
}

.scope-option-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-code,
.scope-site-badge {
  flex: 0 0 auto;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  color: #667085;
  background: #f2f4f7;
  border: 1px solid #eaecf0;
  border-radius: 3px;
}

.scope-site-badge.is-us,
.scope-site-badge.is-ca {
  color: #175cd3;
  background: #eff8ff;
  border-color: #b2ddff;
}

.scope-site-badge.is-uk,
.scope-site-badge.is-de,
.scope-site-badge.is-fr,
.scope-site-badge.is-it,
.scope-site-badge.is-es {
  color: #6941c6;
  background: #f9f5ff;
  border-color: #d9d6fe;
}

.scope-site-badge.is-au,
.scope-site-badge.is-ae {
  color: #b54708;
  background: #fffaeb;
  border-color: #fedf89;
}

.filter-item :deep(.ant-select-arrow),
.filter-item :deep(.ant-select-clear) {
  color: #667085;
}

.filter-item :deep(.ant-input-affix-wrapper:hover),
.filter-item
  :deep(.ant-select:not(.ant-select-disabled):hover .ant-select-selector) {
  border-color: #84adff;
}

.filter-item :deep(.ant-input-affix-wrapper-focused),
.filter-item :deep(.ant-input-affix-wrapper:focus),
.filter-item :deep(.ant-select-focused .ant-select-selector) {
  border-color: #528bff;
  box-shadow: 0 0 0 2px rgb(82 139 255 / 14%);
}

.filter-item :deep(.ant-input-affix-wrapper-focused .ant-input),
.filter-item :deep(.ant-input-affix-wrapper:focus .ant-input) {
  background: #fff;
}

.filter-date-range {
  align-content: end;
}

.snapshot-range {
  display: flex;
  align-items: center;
  min-height: 32px;
  padding: 0 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
  color: #175cd3;
  white-space: nowrap;
  background: #eff8ff;
  border: 1px solid #b2ddff;
  border-radius: 4px;
}

.lookup-value {
  grid-column: span 2;
}

.filter-actions {
  grid-column: 1 / -1;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 11px;
  margin-top: 1px;
  border-top: 1px solid #eef2f6;
}

.filter-actions :deep(.ant-checkbox-wrapper) {
  margin-right: auto;
  font-size: 12px;
  font-weight: 600;
  color: #475467;
}

.filter-actions :deep(.ant-checkbox-checked .ant-checkbox-inner),
.filter-actions :deep(.ant-checkbox-indeterminate .ant-checkbox-inner::after) {
  background: #2563eb;
  border-color: #2563eb;
}

.filter-actions :deep(.ant-btn) {
  min-width: 78px;
  height: 32px;
  font-size: 13px;
  font-weight: 650;
  border-radius: 4px;
}

.filter-actions :deep(.ant-btn:not(.ant-btn-primary)) {
  color: #344054;
  background: #fff;
  border-color: #cbd5e1;
}

.filter-actions :deep(.ant-btn:not(.ant-btn-primary):hover) {
  color: #175cd3;
  border-color: #84adff;
}

.filter-actions :deep(.ant-btn-primary) {
  background: #2563eb;
  border-color: #2563eb;
  box-shadow: 0 1px 2px rgb(37 99 235 / 20%);
}

.filter-actions :deep(.ant-btn-primary:hover) {
  background: #175cd3;
  border-color: #175cd3;
}

:global(.ad-optimization-dropdown) {
  padding: 4px;
  border: 1px solid #d0d5dd;
  border-radius: 5px;
  box-shadow: 0 8px 24px rgb(16 24 40 / 14%);
}

:global(.ad-optimization-dropdown .ant-select-item) {
  min-height: 32px;
  padding: 5px 9px;

  /* Keep the virtual-list item height in sync so the last option is not clipped. */
  margin: 0;
  color: #344054;
  border-radius: 3px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

:global(
  .ad-optimization-dropdown
    .ant-select-item-option-active:not(.ant-select-item-option-disabled)
) {
  color: #175cd3;
  background: #f5f9ff;
}

:global(
  .ad-optimization-dropdown
    .ant-select-item-option-selected:not(.ant-select-item-option-disabled)
) {
  font-weight: 700;
  color: #175cd3;
  background: #eff8ff;
}

:global(
  .ad-optimization-dropdown
    .ant-select-item-option-selected:not(
      .ant-select-item-option-disabled
    ).ant-select-item-option-active
) {
  background: #e6f4ff;
}

:global(.ad-optimization-dropdown .ant-select-item-option-state) {
  color: #2563eb;
}

:global(
  .ad-optimization-scope-dropdown
    .ant-select-item-option-selected:not(.ant-select-item-option-disabled)
    .scope-code
),
:global(
  .ad-optimization-scope-dropdown
    .ant-select-item-option-selected:not(.ant-select-item-option-disabled)
    .scope-site-badge
) {
  color: #175cd3;
  background: #dff1ff;
  border-color: #84adff;
}

:global(.ad-optimization-scope-dropdown .ant-select-item-option-state) {
  display: none;
}

:global(.ad-optimization-dropdown .ant-empty) {
  margin: 8px 0;
}

.operator-summary-band {
  margin-top: 0;
  overflow: hidden;
  background: var(--opt-panel);
  border: 1px solid var(--opt-border);
  border-radius: 6px;
}

.operator-summary-head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--opt-border);
}

.operator-summary-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--opt-text);
}

.operator-summary-head p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--opt-muted);
}

.methodology-help {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 5px;
  align-items: center;
  min-height: 28px;
  font-size: 12px;
  font-weight: 700;
  color: #175cd3;
  cursor: help;
}

.operator-summary-band :deep(.ant-table) {
  font-size: 13px;
}

.operator-summary-band :deep(.ant-table-thead > tr > th) {
  padding: 9px 10px;
  font-size: 12px;
  font-weight: 750;
  color: #344054;
  text-align: center;
  background: #f8fafc;
  border-color: var(--opt-border);
}

.operator-summary-band :deep(.ant-table-tbody > tr > td) {
  padding: 8px 10px;
  text-align: center;
  border-color: var(--opt-border);
}

.operator-summary-band
  :deep(.ant-table-tbody > tr:nth-child(even):not(.operator-total-row) > td) {
  background: #fbfdff;
}

.operator-summary-band
  :deep(.ant-table-tbody > tr:hover:not(.operator-total-row) > td) {
  background: #f0f7ff;
}

.operator-summary-band :deep(.ant-table-tbody > tr.operator-total-row > td) {
  position: sticky;
  bottom: 0;
  z-index: 2;
  font-weight: 750;
  background: #eef4ff;
  border-top: 1px solid #b2ccff;
}

.operator-filter-link {
  padding: 0;
  font: inherit;
  font-weight: 750;
  color: #175cd3;
  text-underline-offset: 3px;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.operator-filter-link:hover,
.operator-filter-link:focus-visible {
  text-decoration: underline;
}

.operator-filter-link:focus-visible {
  outline: 2px solid #84adff;
  outline-offset: 3px;
}

.count-value,
.optimization-count-cell strong,
.metric-stack strong,
.acos-improvement-cell strong {
  font-variant-numeric: tabular-nums;
  color: var(--opt-text);
}

.optimization-count-cell,
.metric-stack,
.acos-improvement-cell {
  display: grid;
  gap: 2px;
  justify-items: center;
}

.optimization-count-cell span,
.metric-stack span,
.acos-improvement-cell span {
  font-size: 11px;
  color: var(--opt-muted);
}

.optimization-count-cell :deep(.ant-tag) {
  margin: 3px 0 0;
  font-size: 10px;
  line-height: 18px;
}

.saving-value strong,
.acos-improvement-cell span {
  color: #067647;
}

.recent-trend-cell {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
  text-align: left;
}

.recent-trend-cell span {
  display: flex;
  gap: 6px;
  align-items: baseline;
  justify-content: space-between;
  min-width: 0;
}

.recent-trend-cell small {
  font-size: 11px;
  color: var(--opt-muted);
  white-space: nowrap;
}

.recent-trend-cell b {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.trend-positive {
  color: #067647;
}

.trend-negative {
  color: #d92d20;
}

.trend-neutral {
  color: var(--opt-muted);
}

.action-bar {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  min-height: 54px;
  padding: 9px 16px;
  margin: 0;
  margin-top: 12px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--opt-border);
  border-radius: 0;
}

.action-tabs {
  display: flex;
  flex: 1 1 auto;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.action-tab {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 650;
  color: var(--opt-muted);
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
}

.action-tab:hover {
  color: #175cd3;
  background: #f5f9ff;
}

.action-tab.active {
  color: #175cd3;
  background: #eff8ff;
  border-color: #b2ddff;
}

.action-tab b {
  min-width: 18px;
  padding: 1px 5px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  color: inherit;
  text-align: center;
  background: rgb(255 255 255 / 72%);
  border-radius: 5px;
}

.selection-status {
  gap: 16px;
  color: var(--opt-muted);
}

.selection-status b {
  font-variant-numeric: tabular-nums;
  color: #175cd3;
}

.batch-actions :deep(.ant-btn),
.filter-actions :deep(.ant-btn) {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.table-band {
  min-height: 240px;
  padding: 0 12px 12px;
  overflow: hidden;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.table-band :deep(.ant-table) {
  color: var(--opt-text);
  background: var(--opt-panel);
}

.table-band :deep(.ant-table-thead > tr > th) {
  padding: 10px 8px !important;
  font-size: 12px;
  font-weight: 800;
  color: var(--opt-text);
  background: hsl(var(--muted) / 58%);
  border-bottom-color: var(--opt-border);
}

.table-band :deep(.ant-table-tbody > tr > td) {
  padding: 9px 8px !important;
  font-size: 13px;
  border-bottom-color: var(--opt-border);
}

.row-selection-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.table-band :deep(.ant-table-tbody > tr:nth-child(even) > td) {
  background: hsl(var(--muted) / 42%);
}

.table-band :deep(.ant-table-tbody > tr:hover > td),
.table-band :deep(.ant-table-tbody > tr.is-selected-row > td) {
  background: hsl(var(--primary) / 8%) !important;
}

.table-band :deep(.ant-table-tbody > tr.is-selected-row > td:first-child) {
  box-shadow: inset 2px 0 0 hsl(var(--primary));
}

.table-band :deep(.ant-empty) {
  padding: 54px 0;
}

.table-band :deep(.ant-tag) {
  margin-inline-end: 0;
  font-weight: 650;
}

.metric-heading {
  gap: 4px;
}

.metric-heading svg {
  color: var(--opt-muted);
  cursor: help;
}

.entity-cell {
  min-width: 0;
}

.entity-cell strong,
.entity-cell span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-cell strong {
  color: var(--opt-text);
}

.entity-cell span {
  margin-top: 3px;
  font-size: 11px;
  color: var(--opt-muted);
}

.hierarchy-cell {
  width: 100%;
  color: inherit;
  text-align: left;
}

.hierarchy-line {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 26px;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.hierarchy-line + .hierarchy-line {
  margin-top: 4px;
}

.hierarchy-cell em {
  font-size: 11px;
  font-style: normal;
  color: var(--opt-muted);
}

.hierarchy-cell small {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  color: var(--opt-muted);
  white-space: nowrap;
}

.hierarchy-link {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
  padding: 0;
  color: #175cd3;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.hierarchy-link strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-link:hover strong {
  text-decoration: underline;
}

.operation-alert {
  margin-bottom: 16px;
}

.operation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
  padding: 0 0 14px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.operation-form {
  display: grid;
}

.operation-row {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) 96px;
  gap: 12px;
  align-items: center;
  padding: 18px 0;
  border-bottom: 1px solid hsl(var(--border));
}

.operation-row:last-child {
  border-bottom: 0;
}

.operation-row label strong,
.operation-row label span {
  display: block;
}

.operation-row label span {
  margin-top: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.operation-number {
  width: 100%;
}

.operation-row-message {
  grid-column: 2 / 4;
}

.execution-alert {
  margin-bottom: 16px;
}

.execution-section + .execution-section {
  margin-top: 20px;
}

.execution-section > strong {
  display: block;
  font-size: 14px;
  color: #1d2939;
}

.execution-section > p {
  margin: 5px 0 10px;
  font-size: 12px;
  color: #667085;
}

.execution-list {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.execution-item {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 12px 14px;
  background: hsl(var(--card));
}

.execution-item + .execution-item {
  border-top: 1px solid hsl(var(--border));
}

.execution-item > div,
.execution-budget-copy {
  min-width: 0;
}

.execution-item b,
.execution-item span {
  display: block;
}

.execution-item b {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: #1d2939;
  white-space: nowrap;
}

.execution-item span {
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: #667085;
  white-space: nowrap;
}

.execution-percent-control {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 7px;
  align-items: center;
}

.execution-percent-input {
  width: 124px;
}

.execution-percent-control em {
  font-style: normal;
  font-variant-numeric: tabular-nums;
  color: #475467;
}

.metric-value,
.money-value {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.metric-danger {
  color: #d92d20 !important;
}

.metric-warning {
  color: #b54708 !important;
}

.metric-success {
  color: #067647 !important;
}

.metric-neutral {
  color: var(--opt-text);
}

.money-value {
  color: #175cd3;
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 22px;
  overflow: hidden;
  background: hsl(var(--muted) / 60%);
  border: 1px solid var(--opt-border);
  border-radius: 6px;
}

.detail-metrics > div {
  padding: 12px;
  border-right: 1px solid var(--opt-border);
}

.detail-metrics > div:last-child {
  border-right: 0;
}

.detail-metrics span,
.detail-metrics strong {
  display: block;
}

.detail-metrics span {
  font-size: 11px;
  color: var(--opt-muted);
}

.detail-metrics strong {
  margin-top: 4px;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.detail-grid {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 11px 14px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--opt-border);
}

.detail-grid span {
  color: var(--opt-muted);
}

.detail-grid b {
  color: var(--opt-text);
  overflow-wrap: anywhere;
}

.reason {
  padding: 12px;
  line-height: 1.7;
  color: #7c2d12;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
}

::selection {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}

.priority-alert {
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: space-between;
  padding: 13px 16px;
  margin-bottom: 14px;
  background: #fff7f7;
  border: 1px solid #ffd6d9;
  border-radius: 12px;
}

.priority-alert-main {
  display: flex;
  gap: 11px;
  align-items: center;
  min-width: 0;
}

.priority-alert-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 30px;
  height: 30px;
  color: #d92d20;
  background: #fff0f1;
  border-radius: 8px;
}

.priority-alert strong,
.priority-alert p {
  display: block;
}

.priority-alert strong {
  color: #7a1d27;
}

.priority-alert p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #9b5360;
}

.priority-alert :deep(.ant-btn) {
  flex: 0 0 auto;
  height: 34px;
  padding-inline: 15px;
  font-weight: 700;
  border-radius: 8px;
}

.summary-item:not(:last-child) {
  border-right: 1px solid var(--opt-border);
}

.summary-item strong {
  margin: 10px 0 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 27px;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  color: var(--opt-text);
  letter-spacing: -0.03em;
  white-space: nowrap;
}

.summary-item small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--opt-muted);
  white-space: nowrap;
}

.filter-primary-row {
  display: grid;
  grid-template-columns:
    auto minmax(142px, 0.6fr) minmax(132px, 0.55fr) minmax(260px, 1fr)
    auto auto;
  gap: 9px;
  align-items: end;
}

.priority-tabs {
  display: inline-flex;
  gap: 2px;
  align-self: end;
  min-height: 34px;
  padding: 3px;
  overflow-x: auto;
  scrollbar-width: thin;
  background: var(--opt-subtle);
  border-radius: 9px;
}

.priority-filter-option {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 7px;
  align-items: center;
  min-height: 28px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 650;
  color: #475467;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.priority-filter-option:hover {
  color: #175cd3;
  background: #f5f9ff;
}

.priority-filter-option:focus-visible {
  outline: 2px solid #84adff;
  outline-offset: 2px;
}

.priority-filter-option i {
  width: 7px;
  height: 7px;
  background: #98a2b3;
  border-radius: 50%;
}

.priority-filter-option b {
  min-width: 18px;
  padding: 1px 5px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  color: inherit;
  text-align: center;
  background: rgb(255 255 255 / 72%);
  border-radius: 5px;
}

.priority-filter-option.is-all.active {
  color: #175cd3;
  background: #eff8ff;
  border-color: #b2ddff;
}

.priority-filter-option.is-high i {
  background: #d92d20;
}

.priority-filter-option.is-high.active {
  color: #b42318;
  background: #fef3f2;
  border-color: #fecdca;
}

.priority-filter-option.is-medium i {
  background: #f79009;
}

.priority-filter-option.is-medium.active {
  color: #b54708;
  background: #fffaeb;
  border-color: #fedf89;
}

.priority-filter-option.is-low i {
  background: #667085;
}

.priority-filter-option.is-low.active {
  color: #344054;
  background: #f2f4f7;
  border-color: #d0d5dd;
}

.compact-filter {
  gap: 4px;
}

.compact-filter > span {
  min-height: 14px;
  font-size: 11px;
}

.primary-search {
  align-self: end;
  min-width: 0;
}

.primary-search :deep(.ant-input) {
  font-size: 13px;
}

.filter-primary-row > :deep(.ant-btn) {
  height: 34px;
  padding-inline: 13px;
  font-weight: 650;
  border-radius: 8px;
}

.filter-panel {
  display: grid;
  grid-template-columns: repeat(5, minmax(150px, 1fr));
  gap: 12px;
  padding-top: 14px;
  margin-top: 14px;
  border-top: 1px solid var(--opt-border);
}

.filter-panel .filter-actions {
  grid-column: span 2;
  justify-content: flex-end;
  padding-top: 20px;
  margin: 0;
  border: 0;
}

.filter-panel .filter-actions :deep(.ant-checkbox-wrapper) {
  margin-right: auto;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(310px, 0.75fr);
  gap: 14px;
  margin-top: 14px;
}

.operator-summary-band,
.priority-queue,
.recommendation-card {
  overflow: hidden;
  background: var(--opt-panel);
  border: 1px solid var(--opt-border);
  border-radius: 14px;
}

.operator-summary-head,
.queue-head,
.recommendation-head {
  padding: 16px 17px 13px;
}

.operator-summary-head h2,
.queue-head h2,
.recommendation-head h2 {
  font-size: 16px;
}

.operator-summary-head p,
.queue-head p,
.recommendation-head p {
  margin-top: 4px;
}

.priority-queue {
  min-width: 0;
}

.queue-head {
  border-bottom: 1px solid var(--opt-border);
}

.queue-list {
  padding: 8px 13px 12px;
}

.queue-item {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 11px 5px;
  color: var(--opt-text);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--opt-border);
}

.queue-item:last-child {
  border-bottom: 0;
}

.queue-item:hover {
  background: hsl(var(--primary) / 5%);
}

.queue-item:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: -2px;
}

.queue-rank {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  font-size: 12px;
  font-weight: 800;
  color: #d92d20;
  background: #fff0f1;
  border-radius: 8px;
}

.queue-content {
  min-width: 0;
}

.queue-content strong,
.queue-content small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-content strong {
  font-size: 13px;
}

.queue-content small {
  margin-top: 3px;
  font-size: 11px;
  color: var(--opt-muted);
}

.queue-impact {
  font-size: 12px;
  font-weight: 750;
  color: #d92d20;
  white-space: nowrap;
}

.recommendation-card {
  margin-top: 14px;
}

.recommendation-head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--opt-border);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1400px) {
  .summary-strip {
    grid-template-columns: repeat(3, minmax(120px, 1fr));
  }

  .summary-item:nth-child(3) {
    border-right: 0;
  }

  .summary-item:nth-child(-n + 3) {
    border-bottom: 1px solid var(--opt-border);
  }

  .filter-band {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .optimization-page {
    padding: 10px;
  }

  .page-head {
    gap: 12px;
    align-items: flex-start;
  }

  .operator-summary-head {
    align-items: flex-start;
  }

  .execution-budget-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .execution-percent-control,
  .execution-percent-input {
    width: 100%;
  }

  .summary-strip,
  .filter-band {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-item,
  .summary-item:nth-child(3) {
    border-right: 1px solid var(--opt-border);
    border-bottom: 1px solid var(--opt-border);
  }

  .summary-item:nth-child(even) {
    border-right: 0;
  }

  .summary-item:nth-last-child(-n + 2) {
    border-bottom: 0;
  }

  .search-filter,
  .lookup-value,
  .filter-actions {
    grid-column: 1 / -1;
  }

  .action-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .batch-actions {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .page-head p {
    max-width: 48ch;
  }

  .filter-band {
    grid-template-columns: 1fr;
  }

  .filter-item,
  .search-filter,
  .lookup-value,
  .filter-actions {
    grid-column: 1;
  }

  .filter-actions {
    flex-wrap: wrap;
    align-items: stretch;
  }

  .filter-actions :deep(.ant-checkbox-wrapper) {
    width: 100%;
    margin-bottom: 4px;
  }

  .filter-actions :deep(.ant-btn) {
    flex: 1;
  }

  .selection-status {
    justify-content: space-between;
    width: 100%;
  }

  .batch-actions :deep(.ant-btn) {
    flex: 1;
    min-width: 104px;
  }

  .detail-metrics {
    grid-template-columns: 1fr;
  }

  .detail-metrics > div {
    border-right: 0;
    border-bottom: 1px solid var(--opt-border);
  }

  .detail-metrics > div:last-child {
    border-bottom: 0;
  }

  .detail-grid {
    grid-template-columns: 96px minmax(0, 1fr);
  }
}

@media (max-width: 1400px) {
  .summary-strip {
    grid-template-columns: repeat(5, minmax(150px, 1fr));
  }

  .summary-item,
  .summary-item:nth-child(3) {
    border-bottom: 1px solid var(--opt-border);
  }

  .filter-primary-row {
    grid-template-columns: auto minmax(150px, 1fr) minmax(150px, 1fr) auto;
  }

  .primary-search {
    grid-column: span 2;
  }
}

@media (max-width: 1000px) {
  .summary-strip {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
  }

  .summary-item:nth-child(3) {
    border-right: 1px solid var(--opt-border);
  }

  .summary-item:nth-child(-n + 3) {
    border-bottom: 1px solid var(--opt-border);
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .optimization-page {
    padding: 14px;
  }

  .priority-alert {
    align-items: flex-start;
  }

  .filter-primary-row {
    grid-template-columns: 1fr 1fr;
  }

  .priority-tabs,
  .primary-search {
    grid-column: 1 / -1;
  }

  .filter-primary-row > :deep(.ant-btn) {
    width: 100%;
  }

  .filter-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-panel .filter-actions {
    grid-column: 1 / -1;
    padding-top: 0;
  }
}

@media (max-width: 560px) {
  .page-head,
  .priority-alert,
  .recommendation-head {
    flex-direction: column;
  }

  .page-head-actions,
  .priority-alert :deep(.ant-btn) {
    align-self: stretch;
  }

  .snapshot-date-select {
    flex: 1;
    width: auto;
    min-width: 0;
  }

  .summary-strip,
  .filter-primary-row,
  .filter-panel {
    grid-template-columns: 1fr;
  }

  .summary-item,
  .summary-item:nth-child(3),
  .summary-item:nth-child(even) {
    border-right: 1px solid var(--opt-border);
  }

  .summary-item:last-child {
    border-bottom: 0;
  }

  .compact-filter,
  .priority-tabs,
  .primary-search {
    grid-column: 1;
  }

  .priority-tabs {
    width: 100%;
  }

  .filter-panel .filter-actions {
    grid-column: 1;
  }

  .queue-item {
    grid-template-columns: 30px minmax(0, 1fr);
  }

  .queue-impact {
    grid-column: 2;
  }
}

:global(.dark) .priority-alert {
  background: #351b22;
  border-color: #7a313d;
}

:global(.dark) .priority-alert strong {
  color: #fecdd3;
}

:global(.dark) .priority-alert p {
  color: #fda4af;
}

:global(.dark) .priority-alert-icon,
:global(.dark) .queue-rank {
  color: #fda4af;
  background: #54212d;
}

:global(.dark) .queue-impact {
  color: #fda4af;
}

:global(.dark) .summary-item.tone-danger strong,
:global(.dark) .metric-danger {
  color: #f97066 !important;
}

:global(.dark) .summary-item.tone-warning strong,
:global(.dark) .metric-warning,
:global(.dark) .reason {
  color: #fec84b !important;
}

:global(.dark) .summary-item.tone-success strong,
:global(.dark) .metric-success {
  color: #6ce9a6 !important;
}

:global(.dark) .summary-item.tone-money strong,
:global(.dark) .money-value,
:global(.dark) .selection-status b {
  color: #84adff;
}

:global(.dark) .reason {
  background: #3b2614;
  border-color: #854a0e;
}

:global(.dark) .filter-item > span {
  color: #cbd5e1;
}

:global(.dark) .filter-item :deep(.ant-select-selector),
:global(.dark) .filter-item :deep(.ant-input-affix-wrapper),
:global(.dark) .filter-actions :deep(.ant-btn:not(.ant-btn-primary)) {
  color: #e2e8f0;
  background: #182230;
  border-color: #475467;
}

:global(.dark) .operator-summary-band :deep(.ant-table-thead > tr > th) {
  color: #cbd5e1;
  background: #182230;
}

:global(.dark)
  .operator-summary-band
  :deep(.ant-table-tbody > tr:nth-child(even):not(.operator-total-row) > td) {
  background: #101828;
}

:global(.dark)
  .operator-summary-band
  :deep(.ant-table-tbody > tr:hover:not(.operator-total-row) > td) {
  background: #1d2939;
}

:global(.dark)
  .operator-summary-band
  :deep(.ant-table-tbody > tr.operator-total-row > td) {
  background: #25304a;
  border-top-color: #475467;
}

:global(.dark) .filter-item :deep(.ant-select-selection-item) {
  color: #b2ccff;
}

:global(.dark) .priority-filter-option {
  color: #cbd5e1;
}

:global(.dark) .priority-filter-option:hover,
:global(.dark) .priority-filter-option.is-all.active {
  color: #b2ccff;
  background: #203451;
  border-color: #315b9d;
}

:global(.dark) .priority-filter-option.is-high.active {
  color: #fda29b;
  background: #4a1f24;
  border-color: #7a313d;
}

:global(.dark) .priority-filter-option.is-medium.active {
  color: #fec84b;
  background: #3b2614;
  border-color: #854a0e;
}

:global(.dark) .priority-filter-option.is-low.active {
  color: #e2e8f0;
  background: #273548;
  border-color: #475467;
}

:global(.dark) .priority-filter-option b {
  background: rgb(16 24 40 / 56%);
}

:global(.dark)
  .filter-item
  :deep(.ant-select-multiple .ant-select-selection-item) {
  color: #b2ccff;
  background: #19345d;
  border-color: #315b9d;
}

:global(.dark) .scope-code,
:global(.dark) .scope-site-badge {
  color: #cbd5e1;
  background: #273548;
  border-color: #475467;
}

:global(.dark) .scope-option::before {
  border-color: #64748b;
}

:global(.dark) .filter-actions {
  border-top-color: #344054;
}

:global(.dark) .filter-actions :deep(.ant-checkbox-wrapper),
:global(.dark) .filter-actions :deep(.ant-btn:not(.ant-btn-primary)) {
  color: #cbd5e1;
}

:global(.dark .ad-optimization-dropdown) {
  background: #182230;
  border-color: #475467;
}

:global(.dark .ad-optimization-dropdown .ant-select-item) {
  color: #cbd5e1;
}

:global(
  .dark
    .ad-optimization-dropdown
    .ant-select-item-option-active:not(.ant-select-item-option-disabled)
) {
  color: #b2ccff;
  background: #203451;
}

:global(
  .dark
    .ad-optimization-dropdown
    .ant-select-item-option-selected:not(.ant-select-item-option-disabled)
) {
  color: #b2ccff;
  background: #19345d;
}
</style>
