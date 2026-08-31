<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  AdCvrOptimizationOverview,
  AdCvrOptimizationSuggestion,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import {
  Check,
  CircleX,
  ExternalLink,
  Eye,
  Info,
  RotateCw,
  Search,
} from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Input,
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
  executeAdCvrOptimizationSuggestions,
  fetchAdCvrOptimizationOverview,
  updateAdCvrOptimizationDecisions,
} from '#/api/kanban/ad-cvr-optimization';

defineOptions({ name: 'KanbanAdCvrOptimization' });

const loading = ref(false);
const router = useRouter();
const submitting = ref(false);
const loadError = ref('');
const data = ref<AdCvrOptimizationOverview | null>(null);
const selectedIds = ref<string[]>([]);
const detail = ref<AdCvrOptimizationSuggestion | null>(null);
const query = reactive({
  actions: [] as string[],
  adGroupKeyword: '',
  campaignKeyword: '',
  costTypes: [] as string[],
  countries: [] as string[],
  entityStates: [] as string[],
  levels: [] as string[],
  lookupField: 'spu',
  lookupValue: '',
  page: 1,
  pageSize: 50,
  responsible: '',
  search: '',
  selectedOnly: true,
  serviceStatuses: [] as string[],
  statuses: ['pending'] as string[],
  stores: [] as string[],
  sponsoredTypes: [] as string[],
  targetingTypes: [] as string[],
});

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
const rpaExecutableActions = new Set([
  'close_ad_group',
  'close_campaign',
  'close_color',
  'close_target',
  'negative_asin',
  'negative_keyword',
]);
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

const columns: TableColumnsType<AdCvrOptimizationSuggestion> = [
  { key: 'select', fixed: 'left', title: '', width: 46 },
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
    width: 230,
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
  { key: 'operation', fixed: 'right', title: '', width: 72 },
];

const pagination = computed(() => ({
  current: data.value?.pagination.page ?? query.page,
  pageSize: data.value?.pagination.pageSize ?? query.pageSize,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条建议`,
  total: data.value?.pagination.total ?? 0,
}));
const allCurrentSelected = computed(() => {
  const current = data.value?.rows ?? [];
  return (
    current.length > 0 &&
    current.every((row) => selectedIds.value.includes(row.suggestion_id))
  );
});
const selectedRows = computed(
  () =>
    data.value?.rows.filter((row) =>
      selectedIds.value.includes(row.suggestion_id),
    ) ?? [],
);
const someCurrentSelected = computed(() => {
  const current = data.value?.rows ?? [];
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
    query.sponsoredTypes.length > 0 ||
    query.targetingTypes.length > 0 ||
    query.costTypes.length > 0 ||
    query.entityStates.length > 0 ||
    query.serviceStatuses.length > 0 ||
    query.levels.length > 0 ||
    query.actions.length > 0 ||
    query.statuses.length !== 1 ||
    query.statuses[0] !== 'pending' ||
    !query.selectedOnly,
);
const statusOptions = computed(() =>
  (data.value?.filters.statuses ?? []).map((value) => ({
    label: statusLabels[value] || value,
    value,
  })),
);
const snapshotRange = computed(() => {
  const snapshot = data.value?.snapshot;
  if (!snapshot?.range_start || !snapshot?.range_end) return '等待快照数据';
  return `${snapshot.range_start} 至 ${snapshot.range_end}`;
});
function normalizeCountry(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function storeCountry(store: unknown) {
  const match = String(store || '').trim().match(/-([a-z]{2})$/i);
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
  const visibleStores = selectedCountries.size > 0
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
    const allowedStores = new Set(storeOptions.value.map((option) => option.value));
    query.stores = query.stores.filter((store) => allowedStores.has(store));
  },
);

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
    label: '今日待优化',
    tone: 'primary',
    value: String(data.value?.summary.pending ?? 0),
  },
  {
    label: '高优先关闭',
    tone: 'danger',
    value: String(
      (data.value?.summary.byAction.close_color ?? 0) +
        (data.value?.summary.byAction.close_ad_group ?? 0) +
        (data.value?.summary.byAction.close_campaign ?? 0),
    ),
  },
  {
    label: '无花费检查',
    tone: 'warning',
    value: String(data.value?.summary.byAction.check_bid ?? 0),
  },
  {
    label: '建议增投',
    tone: 'success',
    value: String(data.value?.summary.byAction.increase_budget ?? 0),
  },
  {
    label: '待人工检查',
    tone: 'neutral',
    value: String(data.value?.summary.review ?? 0),
  },
  {
    label: '涉及花费',
    tone: 'money',
    value: money(data.value?.summary.spend ?? 0),
  },
]);

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
  return value === 'high' ? 'red' : (value === 'medium' ? 'orange' : 'default');
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

async function load(reset = false) {
  if (reset) query.page = 1;
  loading.value = true;
  loadError.value = '';
  try {
    data.value = await fetchAdCvrOptimizationOverview({ ...query });
    selectedIds.value = selectedIds.value.filter((id) =>
      data.value?.rows.some((row) => row.suggestion_id === id),
    );
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
    message.error(`加载广告优化建议失败：${loadError.value}`);
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  query.actions = [];
  query.adGroupKeyword = '';
  query.campaignKeyword = '';
  query.costTypes = [];
  query.countries = [];
  query.entityStates = [];
  query.levels = [];
  query.lookupField = 'spu';
  query.lookupValue = '';
  query.responsible = '';
  query.search = '';
  query.selectedOnly = true;
  query.serviceStatuses = [];
  query.statuses = ['pending'];
  query.stores = [];
  query.sponsoredTypes = [];
  query.targetingTypes = [];
  void load(true);
}

function toggle(row: AdCvrOptimizationSuggestion, checked: boolean) {
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, row.suggestion_id])]
    : selectedIds.value.filter((id) => id !== row.suggestion_id);
}

function toggleCurrent(checked: boolean) {
  const current = data.value?.rows.map((row) => row.suggestion_id) ?? [];
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, ...current])]
    : selectedIds.value.filter((id) => !current.includes(id));
}

async function decide(status: 'approved' | 'dismissed' | 'pending') {
  if (selectedIds.value.length === 0) {
    message.warning('请先选择建议');
    return;
  }
  submitting.value = true;
  try {
    await updateAdCvrOptimizationDecisions(selectedIds.value, status);
    message.success(
      status === 'approved'
        ? '已确认所选建议'
        : (status === 'dismissed'
          ? '已忽略所选建议'
          : '已恢复为待判断'),
    );
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

function executeSelected() {
  if (selectedIds.value.length === 0) {
    message.warning('请先选择已确认建议');
    return;
  }
  const unapproved = selectedRows.value.filter(
    (row) => row.decision_status !== 'approved',
  );
  if (unapproved.length > 0) {
    message.warning('只能提交已确认的建议，请先确认所选建议');
    return;
  }
  const unsupported = selectedRows.value.filter(
    (row) => !rpaExecutableActions.has(row.action_type),
  );
  if (unsupported.length > 0) {
    const labels = [...new Set(unsupported.map((row) => displayAction(row)))];
    message.warning(`${labels.join('、')}缺少确定的自动执行参数，只能人工处理`);
    return;
  }
  Modal.confirm({
    title: `提交 ${selectedIds.value.length} 条建议到执行队列？`,
    content:
      '系统只会提交已确认建议。未配置 RPA 时仅生成审计队列，不会修改广告账户。',
    okText: '提交执行',
    async onOk() {
      submitting.value = true;
      try {
        const result = await executeAdCvrOptimizationSuggestions(
          selectedIds.value,
        );
        message.success(result.message || `执行批次 ${result.batchId} 已创建`);
        selectedIds.value = [];
        await load();
      } catch (error) {
        message.error(
          `提交执行失败：${error instanceof Error ? error.message : error}`,
        );
      } finally {
        submitting.value = false;
      }
    },
  });
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

onMounted(() => load());
</script>

<template>
  <div class="optimization-page">
    <header class="page-head">
      <div>
        <h1>广告 CVR 优化</h1>
        <p v-if="data?.snapshot">
          30 天判断区间 {{ data.snapshot.range_start }} ~
          {{ data.snapshot.range_end }} · 深层广告组
          {{ data.snapshot.deep_group_count }}/{{ data.snapshot.group_count }}
          <template v-if="data.snapshot.metadata_refreshed_at">
            · 活动筛选元数据 {{ data.snapshot.metadata_refreshed_at }}
          </template>
        </p>
      </div>
      <div class="page-head-actions">
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

    <Alert
      class="policy-alert"
      message="建议默认不会自动执行。颜色 → 投放内容 → 搜索词 → 广告组 → 广告活动按层级判断，命中上层动作后抑制下层关闭建议。"
      show-icon
      type="info"
    />

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
      </div>
    </section>

    <section class="filter-band">
      <label class="filter-item filter-date-range">
        <span>统计区间</span>
        <strong class="snapshot-range">{{ snapshotRange }}</strong>
      </label>
      <label class="filter-item">
        <span>国家</span>
        <Select
          v-model:value="query.countries"
          :options="countryOptions"
          allow-clear
          aria-label="国家"
          max-tag-count="responsive"
          mode="multiple"
          option-filter-prop="searchLabel"
          popup-class-name="ad-optimization-dropdown ad-optimization-scope-dropdown"
          placeholder="全部国家"
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
        <span>状态</span>
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
      <label class="filter-item">
        <span>建议动作</span>
        <Select
          v-model:value="query.actions"
          :options="data?.filters.actions ?? []"
          allow-clear
          aria-label="建议动作"
          mode="multiple"
          popup-class-name="ad-optimization-dropdown"
          placeholder="全部动作"
        />
      </label>
      <label class="filter-item">
        <span>处理状态</span>
        <Select
          v-model:value="query.statuses"
          :options="statusOptions"
          allow-clear
          aria-label="处理状态"
          mode="multiple"
          popup-class-name="ad-optimization-dropdown"
          placeholder="全部状态"
        />
      </label>
      <label class="filter-item search-filter">
        <span>快捷检索</span>
        <Input
          v-model:value="query.search"
          allow-clear
          aria-label="搜索广告对象"
          placeholder="对象、活动 ID、广告组 ID、SPU、父 ASIN"
          @press-enter="load(true)"
        />
      </label>
      <div class="filter-actions">
        <Checkbox v-model:checked="query.selectedOnly">只看待采取行动</Checkbox>
        <Button :disabled="!hasActiveFilters" @click="resetFilters">
          <RotateCw :size="15" />
          重置
        </Button>
        <Button type="primary" @click="load(true)">
          <Search :size="15" />
          查询
        </Button>
      </div>
    </section>

    <section class="action-bar">
      <div class="selection-status">
        <Checkbox
          :checked="allCurrentSelected"
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
          :disabled="selectedIds.length === 0"
          :loading="submitting"
          type="primary"
          @click="decide('approved')"
        >
          <Check :size="15" />
          确认建议
        </Button>
        <Button
          :disabled="selectedIds.length === 0"
          :loading="submitting"
          danger
          @click="executeSelected"
        >
          <ExternalLink :size="15" />
          提交执行
        </Button>
      </Space>
    </section>

    <section class="table-band">
      <Spin :spinning="loading">
        <Table
          v-if="data?.rows.length"
          :columns="columns"
          :data-source="data.rows"
          :pagination="pagination"
          :row-class-name="rowClassName"
          :row-key="(row) => row.suggestion_id"
          :scroll="{ x: 2350, y: 'calc(100vh - 440px)' }"
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
            <Checkbox
              v-if="column.key === 'select'"
              :checked="selectedIds.includes(record.suggestion_id)"
              @change="toggle(suggestionRecord(record), $event.target.checked)"
            />
            <Tag v-else-if="column.dataIndex === 'level'">
              {{ levelLabel(record) }}
            </Tag>
            <div
              v-else-if="column.dataIndex === 'entity_name'"
              class="entity-cell"
            >
              <strong>{{ record.entity_name || '-' }}</strong>
            </div>
            <button
              v-else-if="column.dataIndex === 'ad_hierarchy'"
              class="hierarchy-cell"
              type="button"
              @click="openCampaignDetail(record)"
            >
              <Tooltip
                :title="`广告活动 ID：${record.campaign_id || '-'}`"
                placement="topLeft"
              >
                <span>
                  <em>活动</em>
                  <strong>{{
                    record.campaign_name || record.campaign_id || '-'
                  }}</strong>
                </span>
              </Tooltip>
              <Tooltip
                :title="`广告组 ID：${record.ad_group_id || '-'}`"
                placement="topLeft"
              >
                <span>
                  <em>广告组</em>
                  <strong>{{
                    record.ad_group_name || record.ad_group_id || '-'
                  }}</strong>
                </span>
              </Tooltip>
              <small>{{ record.campaign_id || '-' }} ·
                {{ record.ad_group_id || '-' }}</small>
              <ExternalLink :size="13" />
            </button>
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
                ['natural_cvr', 'target_cvr'].includes(String(column.dataIndex))
              "
              class="metric-value metric-neutral"
            >
              {{ percent(metricValue(record, column.dataIndex)) }}
            </span>
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
            <Tooltip
              v-else-if="column.key === 'operation'"
              title="查看建议明细"
            >
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
          </template>
        </Table>
        <Empty v-else description="当前筛选没有优化建议">
          <Button v-if="hasActiveFilters" @click="resetFilters">
            清除筛选
          </Button>
        </Empty>
      </Spin>
    </section>

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
            rpaExecutableActions.has(detail.action_type)
              ? '确认后可提交 RPA'
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

  min-height: 100%;
  padding: 16px;
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
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-head h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--opt-text);
  letter-spacing: 0;
}

.page-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--opt-muted);
}

.page-head-actions {
  gap: 10px;
}

.page-head-actions :deep(.ant-tag) {
  margin: 0;
  font-weight: 700;
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
  grid-template-columns: repeat(6, minmax(120px, 1fr));
  overflow: hidden;
  background: var(--opt-panel);
  border: 1px solid var(--opt-border);
  border-radius: 6px;
}

.summary-item {
  position: relative;
  min-height: 88px;
  padding: 15px 16px 13px;
  border-right: 1px solid var(--opt-border);
}

.summary-item:last-child {
  border-right: 0;
}

.summary-item::after {
  position: absolute;
  right: 16px;
  bottom: 12px;
  left: 16px;
  height: 2px;
  content: '';
  background: #98a2b3;
  border-radius: 2px;
  opacity: 0.65;
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

.summary-item strong {
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  color: var(--opt-text);
  white-space: nowrap;
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
  display: grid;
  grid-template-columns: repeat(6, minmax(148px, 1fr));
  gap: 10px;
  padding: 14px;
  margin-top: 12px;
  background: var(--opt-panel);
  border: 1px solid var(--opt-border);
  border-radius: 6px;
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

:global(.ad-optimization-scope-dropdown .ant-select-item-option-selected:not(.ant-select-item-option-disabled) .scope-option::before) {
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
.filter-item :deep(.ant-select:not(.ant-select-disabled):hover .ant-select-selector) {
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
  margin: 1px 0;
  color: #344054;
  border-radius: 3px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

:global(.ad-optimization-dropdown .ant-select-item-option-active:not(.ant-select-item-option-disabled)) {
  color: #175cd3;
  background: #f5f9ff;
}

:global(.ad-optimization-dropdown .ant-select-item-option-selected:not(.ant-select-item-option-disabled)) {
  font-weight: 700;
  color: #175cd3;
  background: #eff8ff;
}

:global(.ad-optimization-dropdown .ant-select-item-option-selected:not(.ant-select-item-option-disabled).ant-select-item-option-active) {
  background: #e6f4ff;
}

:global(.ad-optimization-dropdown .ant-select-item-option-state) {
  color: #2563eb;
}

:global(.ad-optimization-scope-dropdown .ant-select-item-option-selected:not(.ant-select-item-option-disabled) .scope-code),
:global(.ad-optimization-scope-dropdown .ant-select-item-option-selected:not(.ant-select-item-option-disabled) .scope-site-badge) {
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

.action-bar {
  gap: 16px;
  justify-content: space-between;
  min-height: 54px;
  padding: 9px 12px;
  margin-top: 12px;
  background: var(--opt-panel);
  border: 1px solid var(--opt-border);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
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
  background: var(--opt-panel);
  border: 1px solid var(--opt-border);
  border-radius: 0 0 6px 6px;
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
  background: var(--opt-subtle);
  border-bottom-color: var(--opt-border);
}

.table-band :deep(.ant-table-tbody > tr > td) {
  padding: 9px 8px !important;
  font-size: 13px;
  border-bottom-color: var(--opt-border);
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
  padding: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.hierarchy-cell > span {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.hierarchy-cell > span + span {
  margin-top: 4px;
}

.hierarchy-cell em {
  font-size: 11px;
  font-style: normal;
  color: var(--opt-muted);
}

.hierarchy-cell strong,
.hierarchy-cell small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hierarchy-cell strong {
  color: #175cd3;
}

.hierarchy-cell small {
  margin-top: 4px;
  font-size: 10px;
  color: var(--opt-muted);
}

.hierarchy-cell:hover strong {
  text-decoration: underline;
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

:global(.dark) .filter-item :deep(.ant-select-selection-item) {
  color: #b2ccff;
}

:global(.dark) .filter-item :deep(.ant-select-multiple .ant-select-selection-item) {
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

:global(.dark .ad-optimization-dropdown .ant-select-item-option-active:not(.ant-select-item-option-disabled)) {
  color: #b2ccff;
  background: #203451;
}

:global(.dark .ad-optimization-dropdown .ant-select-item-option-selected:not(.ant-select-item-option-disabled)) {
  color: #b2ccff;
  background: #19345d;
}
</style>
