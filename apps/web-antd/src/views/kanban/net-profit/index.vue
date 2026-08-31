<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  NetProfitDetails,
  NetProfitGroupRow,
  NetProfitOverview,
} from '#/api/kanban/types';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { ChevronRight, Info, Plus, RotateCw, X } from '@vben/icons';

import {
  Button,
  DatePicker,
  Drawer,
  Empty,
  message,
  Segmented,
  Select,
  Spin,
  Table,
  Tooltip,
} from 'ant-design-vue';

import {
  fetchNetProfitBreakEven,
  fetchNetProfitDetails,
  fetchNetProfitOverview,
  fetchNetProfitPivot,
} from '#/api/kanban';

interface ProfitQuery {
  brands: string[];
  category1: string[];
  category2: string[];
  category3: string[];
  countries: string[];
  departments: string[];
  developers: string[];
  dimension: string;
  operators: string[];
  periodFrom: string;
  periodTo: string;
  pivotColumn: string;
  pivotRow: string;
  productTypes: string[];
  suppliers: string[];
}

interface ProfitTab {
  breakEven: NetProfitOverview['breakEven'];
  dirty: boolean;
  key: string;
  label: string;
  overview: NetProfitOverview | null;
  panel: ProfitPanel;
  pivot: NetProfitOverview['pivot'];
  query: ProfitQuery;
}

type ProfitPanel = 'breakEven' | 'pivot' | 'ranking';
type RankingMode = 'loss' | 'profit' | 'roi';
type ProfitFacetKey =
  | 'brands'
  | 'category1'
  | 'category2'
  | 'category3'
  | 'countries'
  | 'departments'
  | 'developers'
  | 'operators'
  | 'productTypes'
  | 'suppliers';

function createQuery(): ProfitQuery {
  return {
    brands: [],
    category1: [],
    category2: [],
    category3: [],
    countries: [],
    departments: [],
    developers: [],
    dimension: 'department',
    operators: [],
    periodFrom: '',
    periodTo: '',
    pivotColumn: 'category2',
    pivotRow: 'country',
    productTypes: [],
    suppliers: [],
  };
}

function cloneQuery(source: ProfitQuery): ProfitQuery {
  return {
    ...source,
    brands: [...source.brands],
    category1: [...source.category1],
    category2: [...source.category2],
    category3: [...source.category3],
    countries: [...source.countries],
    departments: [...source.departments],
    developers: [...source.developers],
    operators: [...source.operators],
    productTypes: [...source.productTypes],
    suppliers: [...source.suppliers],
  };
}

const loading = ref(false);
const breakEvenLoading = ref(false);
const pivotLoading = ref(false);
const overview = ref<NetProfitOverview | null>(null);
const detailLoading = ref(false);
const detailOpen = ref(false);
const detailResult = ref<NetProfitDetails | null>(null);
const detailTitle = ref('纯利明细');
const rankingMode = ref<RankingMode>('profit');
function emptyPivot(): NetProfitOverview['pivot'] {
  return {
    columnDimension: 'category2',
    columnLabel: '',
    columns: [],
    rowDimension: 'country',
    rowLabel: '',
    rows: [],
  };
}

function emptyBreakEven(): NetProfitOverview['breakEven'] {
  return {
    avgDaysToBreakEven: 0,
    pendingCount: 0,
    rows: [],
    total: 0,
  };
}

const pivot = ref<NetProfitOverview['pivot']>(emptyPivot());
const breakEven = ref<NetProfitOverview['breakEven']>(emptyBreakEven());
const activeTabKey = ref('profit-1');
const panel = ref<ProfitPanel>('ranking');
const tabs = ref<ProfitTab[]>([
  {
    breakEven: emptyBreakEven(),
    dirty: false,
    key: 'profit-1',
    label: '分析视图 1',
    overview: null,
    panel: 'ranking',
    pivot: emptyPivot(),
    query: createQuery(),
  },
]);
const query = reactive<ProfitQuery>(createQuery());
let overviewRequestSequence = 0;
let pivotRequestSequence = 0;
let breakEvenRequestSequence = 0;
let filterLoadTimer: ReturnType<typeof setTimeout> | undefined;
let pendingFacetKey: null | ProfitFacetKey = null;

const facetKeys: ProfitFacetKey[] = [
  'countries',
  'brands',
  'departments',
  'operators',
  'suppliers',
  'developers',
  'category1',
  'category2',
  'category3',
  'productTypes',
];

const facetLabels: Record<ProfitFacetKey, string> = {
  brands: '品牌',
  category1: '一级分类',
  category2: '二级分类',
  category3: '产品线',
  countries: '国家',
  departments: '部门',
  developers: '开发负责人',
  operators: '运营',
  productTypes: '新老品',
  suppliers: '供应商',
};

const fallbackDimensions = [
  { key: 'department', label: '部门' },
  { key: 'operator', label: '运营' },
  { key: 'country', label: '国家' },
  { key: 'brand', label: '品牌' },
  { key: 'supplier', label: '供应商' },
  { key: 'developer', label: '开发负责人' },
  { key: 'productType', label: '新老品' },
  { key: 'category1', label: '一级分类' },
  { key: 'category2', label: '二级分类' },
  { key: 'category3', label: '产品线' },
  { key: 'account', label: '账号' },
  { key: 'parentAsin', label: '父ASIN' },
];

const groupColumns: TableColumnsType<NetProfitGroupRow> = [
  { title: '排名', key: 'rank', width: 64, align: 'center' },
  { title: '维度', dataIndex: 'name', key: 'name', width: 220 },
  {
    title: '纯利',
    dataIndex: 'netProfit',
    key: 'netProfit',
    align: 'right',
    width: 170,
  },
  {
    title: '投入',
    dataIndex: 'investment',
    key: 'investment',
    align: 'right',
    width: 170,
  },
  { title: 'ROI', dataIndex: 'roi', key: 'roi', align: 'right', width: 110 },
  { title: '贡献度', key: 'contribution', align: 'right', width: 120 },
  { title: '规模', key: 'scale', width: 180 },
];

const breakEvenColumns: TableColumnsType<any> = [
  { title: 'SPU', dataIndex: 'spu', key: 'spu', width: 120 },
  { title: '店铺', dataIndex: 'shop', key: 'shop', width: 130 },
  { title: '父ASIN', dataIndex: 'parentAsin', key: 'parentAsin', width: 130 },
  {
    title: '开发日期',
    dataIndex: 'developmentDate',
    key: 'developmentDate',
    width: 120,
  },
  {
    title: '首次累计转正月份',
    dataIndex: 'breakEvenMonth',
    key: 'breakEvenMonth',
    width: 120,
  },
  {
    title: '转正周期（月末口径）',
    dataIndex: 'daysToBreakEven',
    key: 'daysToBreakEven',
    width: 150,
  },
  {
    title: '全周期纯利',
    dataIndex: 'lifetimeNetProfit',
    key: 'lifetimeNetProfit',
    align: 'right',
    width: 140,
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
];

const activeTab = computed(() =>
  tabs.value.find((item) => item.key === activeTabKey.value),
);
const filters = computed(
  () =>
    overview.value?.filters ?? {
      brands: [],
      category1: [],
      category2: [],
      category3: [],
      countries: [],
      departments: [],
      developers: [],
      operators: [],
      productTypes: [],
      suppliers: [],
    },
);
const dimensions = computed(() =>
  overview.value?.dimensions?.length
    ? overview.value.dimensions
    : fallbackDimensions,
);
const periodRange = computed<[string, string] | undefined>({
  get(): [string, string] | undefined {
    return query.periodFrom && query.periodTo
      ? ([query.periodFrom, query.periodTo] as [string, string])
      : undefined;
  },
  set(value: [string, string] | undefined) {
    query.periodFrom = value?.[0] || '';
    query.periodTo = value?.[1] || '';
  },
});
const summary = computed(() => overview.value?.summary);
const breakdownMap = computed(() =>
  Object.fromEntries(
    (overview.value?.breakdown?.items ?? []).map((item) => [
      item.key,
      Number(item.value || 0),
    ]),
  ),
);
const cashIncome = computed(() => breakdownMap.value.cashIncome || 0);
const standardFee = computed(() => breakdownMap.value.standardFee || 0);
const marketingFee = computed(() => breakdownMap.value.marketingFee || 0);
const otherFee = computed(() => breakdownMap.value.otherFee || 0);
const netMargin = computed(() =>
  cashIncome.value
    ? Number(summary.value?.selectedNetProfit || 0) / cashIncome.value
    : 0,
);
const expenseRate = computed(() =>
  cashIncome.value
    ? Number(summary.value?.investment || 0) / cashIncome.value
    : 0,
);
const formulaVariance = computed(
  () =>
    cashIncome.value -
    standardFee.value -
    marketingFee.value -
    otherFee.value -
    Number(summary.value?.selectedNetProfit || 0),
);
const roiPlainText = computed(() => {
  const roi = Number(summary.value?.roi || 0);
  const verb = roi >= 0 ? '净赚' : '亏损';
  return `每投入 ¥1.00，${verb} ¥${Math.abs(roi).toFixed(2)}`;
});
const rankingRows = computed(() => {
  const rows = [...(overview.value?.groups ?? [])];
  if (rankingMode.value === 'roi') {
    return rows
      .filter((item) => item.investment > 0)
      .toSorted((left, right) => right.roi - left.roi);
  }
  if (rankingMode.value === 'loss') {
    return rows
      .filter((item) => item.netProfit < 0)
      .toSorted((left, right) => left.netProfit - right.netProfit);
  }
  return rows.toSorted((left, right) => right.netProfit - left.netProfit);
});
const expenseStructure = computed(() => {
  const total = Number(summary.value?.investment || 0);
  return [
    { key: 'standardFee', label: '标准费用', value: standardFee.value },
    { key: 'marketingFee', label: '营销费用', value: marketingFee.value },
    { key: 'otherFee', label: '其他费用', value: otherFee.value },
  ].map((item) => ({
    ...item,
    share: total ? item.value / total : 0,
  }));
});
const panelOptions = [
  { label: '纯利与 ROI', value: 'ranking' },
  { label: '二维数据透视', value: 'pivot' },
  { label: '全周期盈亏平衡', value: 'breakEven' },
];
const rankingOptions = [
  { label: '纯利贡献', value: 'profit' },
  { label: 'ROI 效率', value: 'roi' },
  { label: '亏损拖累', value: 'loss' },
];

const detailColumns = computed<TableColumnsType<any>>(() =>
  (detailResult.value?.columns ?? []).map((column) => ({
    dataIndex: column.key,
    key: column.key,
    title: column.label,
    width: 130,
  })),
);
const detailMoneyKeys = new Set([
  'amount',
  'cashIncome',
  'customCost',
  'firstLegCost',
  'firstLegFee',
  'focusValue',
  'grossProfit',
  'marketingFee',
  'netProfit',
  'otherFee',
  'packageCost',
  'purchaseCost',
  'standardFee',
]);

function optionList(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

function removeInvalidFacetSelections(
  available: NetProfitOverview['filters'],
  protectedKey: null | ProfitFacetKey,
) {
  const removed: ProfitFacetKey[] = [];
  for (const key of facetKeys) {
    if (key === protectedKey || query[key].length === 0) continue;
    const allowed = new Set(available[key]);
    const next = query[key].filter((value) => allowed.has(value));
    if (next.length === query[key].length) continue;
    query[key] = next;
    removed.push(key);
  }
  return removed;
}

function formatInteger(value: null | number | undefined) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  });
}

function formatMoney(value: null | number | undefined) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? '-' : '';
  return `${sign}¥${Math.abs(amount).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function formatMoneyWan(value: null | number | undefined) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? '-' : '';
  return `${sign}¥${(Math.abs(amount) / 10_000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`;
}

function formatPercent(value: null | number | undefined) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatRoi(value: null | number | undefined) {
  return `${Number(value || 0).toFixed(2)}x`;
}

function moneyClass(value: number) {
  return { positive: value > 0, negative: value < 0 };
}

function formatDetailValue(key: string, value: unknown) {
  if (key === 'focusShare') return formatPercent(Number(value || 0));
  if (key === 'purchaseQty') return formatInteger(Number(value || 0));
  if (detailMoneyKeys.has(key)) return formatMoney(Number(value || 0));
  return value || '-';
}

function saveActiveTab() {
  const current = activeTab.value;
  if (!current) return;
  current.query = cloneQuery(query);
  current.overview = overview.value;
  current.panel = panel.value;
  current.pivot = pivot.value;
  current.breakEven = breakEven.value;
}

function invalidatePendingLoads() {
  overviewRequestSequence += 1;
  pivotRequestSequence += 1;
  breakEvenRequestSequence += 1;
  clearTimeout(filterLoadTimer);
  loading.value = false;
  pivotLoading.value = false;
  breakEvenLoading.value = false;
}

function applyTab(tab: ProfitTab) {
  Object.assign(query, cloneQuery(tab.query));
  overview.value = tab.overview;
  panel.value = tab.panel;
  pivot.value = tab.pivot;
  breakEven.value = tab.breakEven;
}

function switchTab(key: string) {
  saveActiveTab();
  invalidatePendingLoads();
  pendingFacetKey = null;
  const target = tabs.value.find((item) => item.key === key);
  if (!target) return;
  activeTabKey.value = key;
  applyTab(target);
  if (!target.overview || target.dirty) {
    void loadOverview();
  } else if (target.panel === 'pivot' && target.pivot.rows.length === 0) {
    void loadPivot();
  } else if (
    target.panel === 'breakEven' &&
    target.breakEven.rows.length === 0
  ) {
    void loadBreakEven();
  }
}

function addTab() {
  saveActiveTab();
  invalidatePendingLoads();
  pendingFacetKey = null;
  const key = `profit-${Date.now()}`;
  const tab = {
    breakEven: emptyBreakEven(),
    dirty: true,
    key,
    label: `分析视图 ${tabs.value.length + 1}`,
    overview: null,
    panel: 'ranking' as ProfitPanel,
    pivot: emptyPivot(),
    query: cloneQuery(query),
  };
  tabs.value.push(tab);
  activeTabKey.value = key;
  applyTab(tab);
  void loadOverview();
}

function closeTab(key: string) {
  if (tabs.value.length === 1) return;
  const index = tabs.value.findIndex((item) => item.key === key);
  tabs.value = tabs.value.filter((item) => item.key !== key);
  if (activeTabKey.value === key) {
    const next = tabs.value[Math.max(0, index - 1)];
    if (next) switchTab(next.key);
  }
}

function overviewParams() {
  return {
    ...query,
    limit: 100,
    periodFrom: query.periodFrom || undefined,
    periodTo: query.periodTo || undefined,
  };
}

async function loadOverview() {
  clearTimeout(filterLoadTimer);
  const requestId = ++overviewRequestSequence;
  const protectedFacet = pendingFacetKey;
  const params = overviewParams();
  loading.value = true;
  try {
    const data = await fetchNetProfitOverview(params);
    if (requestId !== overviewRequestSequence) return;
    const removedFacets = removeInvalidFacetSelections(
      data.filters,
      protectedFacet,
    );
    if (removedFacets.length > 0) {
      message.info(
        `已清除不匹配的${removedFacets.map((key) => facetLabels[key]).join('、')}筛选`,
      );
      await loadOverview();
      return;
    }
    pendingFacetKey = null;
    overview.value = data;
    query.periodFrom = data.periodFrom || data.period || '';
    query.periodTo = data.periodTo || data.period || '';
    const current = activeTab.value;
    if (current) {
      current.dirty = false;
      current.query = cloneQuery(query);
      current.overview = data;
      current.pivot = emptyPivot();
      current.breakEven = emptyBreakEven();
    }
    pivot.value = emptyPivot();
    breakEven.value = emptyBreakEven();
    if (panel.value === 'pivot') await loadPivot();
    if (panel.value === 'breakEven') await loadBreakEven();
  } catch (error) {
    message.error('纯利数据加载失败，请稍后重试');
    console.error('load net profit overview failed', error);
  } finally {
    if (requestId === overviewRequestSequence) loading.value = false;
  }
}

async function loadBreakEven() {
  const requestId = ++breakEvenRequestSequence;
  breakEvenLoading.value = true;
  try {
    const data = await fetchNetProfitBreakEven(overviewParams());
    if (requestId !== breakEvenRequestSequence) return;
    breakEven.value = data;
    const current = activeTab.value;
    if (current) current.breakEven = breakEven.value;
  } finally {
    if (requestId === breakEvenRequestSequence) breakEvenLoading.value = false;
  }
}

async function loadPivot() {
  const requestId = ++pivotRequestSequence;
  pivotLoading.value = true;
  try {
    const data = await fetchNetProfitPivot(overviewParams());
    if (requestId !== pivotRequestSequence) return;
    pivot.value = data;
    const current = activeTab.value;
    if (current) current.pivot = pivot.value;
  } finally {
    if (requestId === pivotRequestSequence) pivotLoading.value = false;
  }
}

function scheduleOverviewLoad(changedFacet?: null | ProfitFacetKey) {
  if (changedFacet !== undefined) pendingFacetKey = changedFacet;
  const current = activeTab.value;
  if (current) {
    current.breakEven = emptyBreakEven();
    current.dirty = true;
    current.pivot = emptyPivot();
  }
  // Invalidate in-flight responses as soon as the visible filter state changes.
  invalidatePendingLoads();
  pivot.value = emptyPivot();
  breakEven.value = emptyBreakEven();
  loading.value = true;
  filterLoadTimer = setTimeout(() => void loadOverview(), 450);
}

function resetFilters() {
  pendingFacetKey = null;
  invalidatePendingLoads();
  Object.assign(query, createQuery());
  const current = activeTab.value;
  if (current) current.dirty = true;
  void loadOverview();
}

function selectPanel(value: ProfitPanel) {
  panel.value = value;
  const current = activeTab.value;
  if (current) current.panel = value;
  if (value === 'pivot') void loadPivot();
  if (value === 'breakEven' && breakEven.value.rows.length === 0)
    void loadBreakEven();
}

function handlePanelChange(value: unknown) {
  const next = String(value || '') as ProfitPanel;
  if (['breakEven', 'pivot', 'ranking'].includes(next)) selectPanel(next);
}

function groupContribution(value: number) {
  const total = summary.value?.selectedNetProfit ?? 0;
  return total ? value / total : 0;
}

async function openGroupDetails(
  record: NetProfitGroupRow | Record<string, any>,
) {
  const group = record as NetProfitGroupRow;
  detailTitle.value = `${group.dimensionLabel || '维度'}：${group.name}`;
  detailOpen.value = true;
  detailLoading.value = true;
  detailResult.value = null;
  try {
    detailResult.value = await fetchNetProfitDetails({
      ...overviewParams(),
      dimension: group.dimension,
      page: 1,
      pageSize: 200,
      value: group.name,
    });
  } catch (error) {
    message.error('纯利明细加载失败，请稍后重试');
    console.error('load net profit group details failed', error);
  } finally {
    detailLoading.value = false;
  }
}

async function openMetricDetails(metric: string, label: string) {
  detailTitle.value = `${label}明细`;
  detailOpen.value = true;
  detailLoading.value = true;
  detailResult.value = null;
  try {
    detailResult.value = await fetchNetProfitDetails({
      ...overviewParams(),
      metric,
      page: 1,
      pageSize: 200,
    });
  } catch (error) {
    message.error(`${label}明细加载失败，请稍后重试`);
    console.error('load net profit metric details failed', error);
  } finally {
    detailLoading.value = false;
  }
}

function breakEvenRows() {
  return (breakEven.value?.rows ?? []).map((row) => ({
    ...row,
    breakEvenMonth: row.breakEvenMonth
      ? `${row.breakEvenMonth.slice(0, 4)}-${row.breakEvenMonth.slice(4, 6)}`
      : '-',
    daysToBreakEven: row.daysToBreakEven ?? '-',
    lifetimeNetProfit: formatMoney(row.lifetimeNetProfit),
  }));
}

onMounted(loadOverview);
onBeforeUnmount(() => clearTimeout(filterLoadTimer));
</script>

<template>
  <div class="net-profit-page">
    <div class="page-head">
      <div>
        <h1>纯利与回报</h1>
        <p>看清净赚金额、资金回报效率，以及利润被哪类费用消耗。</p>
      </div>
      <Button type="primary" :loading="loading" @click="loadOverview">
        <template #icon><RotateCw :size="15" /></template>
        刷新数据
      </Button>
    </div>

    <div class="view-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="view-tab"
        :class="{ active: tab.key === activeTabKey }"
        type="button"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
        <span
          v-if="tabs.length > 1"
          class="tab-close"
          role="button"
          tabindex="0"
          :title="`关闭${tab.label}`"
          @click.stop="closeTab(tab.key)"
          @keydown.enter.stop="closeTab(tab.key)"
        >
          <X :size="13" />
        </span>
      </button>
      <button
        class="add-tab"
        type="button"
        title="新增对比视图"
        @click="addTab"
      >
        <Plus :size="16" />
      </button>
    </div>

    <div class="filter-bar">
      <div class="filter-section period-section">
        <label>利润月份区间</label>
        <DatePicker.RangePicker
          v-model:value="periodRange"
          :allow-clear="false"
          class="period-range"
          format="YYYY年M月"
          picker="month"
          value-format="YYYYMM"
          @change="scheduleOverviewLoad(null)"
        />
      </div>
      <div class="filter-section dimension-section">
        <label>排行维度</label>
        <Select
          v-model:value="query.dimension"
          class="filter-control"
          :options="
            dimensions.map((item) => ({ label: item.label, value: item.key }))
          "
          @change="scheduleOverviewLoad()"
        />
      </div>
      <div class="filter-divider"></div>
      <div class="filter-group organization-filter-group">
        <span class="filter-group-label">组织范围</span>
        <div class="filter-group-controls">
          <Select
            v-model:value="query.countries"
            class="filter-control wide"
            mode="multiple"
            placeholder="国家"
            :max-tag-count="1"
            :options="optionList(filters.countries)"
            @change="scheduleOverviewLoad('countries')"
          />
          <Select
            v-model:value="query.brands"
            class="filter-control wide"
            mode="multiple"
            placeholder="品牌"
            :max-tag-count="1"
            :options="optionList(filters.brands)"
            @change="scheduleOverviewLoad('brands')"
          />
          <Select
            v-model:value="query.departments"
            class="filter-control wide"
            mode="multiple"
            placeholder="部门"
            :max-tag-count="1"
            :options="optionList(filters.departments)"
            @change="scheduleOverviewLoad('departments')"
          />
          <Select
            v-model:value="query.operators"
            class="filter-control wide"
            mode="multiple"
            placeholder="运营"
            :max-tag-count="1"
            :options="optionList(filters.operators)"
            @change="scheduleOverviewLoad('operators')"
          />
        </div>
      </div>
      <div class="filter-group product-filter-group">
        <span class="filter-group-label">商品维度</span>
        <div class="filter-group-controls">
          <Select
            v-model:value="query.suppliers"
            class="filter-control wide"
            mode="multiple"
            placeholder="供应商"
            :max-tag-count="1"
            :options="optionList(filters.suppliers)"
            @change="scheduleOverviewLoad('suppliers')"
          />
          <Select
            v-model:value="query.developers"
            class="filter-control wide"
            mode="multiple"
            placeholder="开发负责人"
            :max-tag-count="1"
            :options="optionList(filters.developers)"
            @change="scheduleOverviewLoad('developers')"
          />
          <Select
            v-model:value="query.category1"
            class="filter-control wide"
            mode="multiple"
            placeholder="一级分类"
            :max-tag-count="1"
            :options="optionList(filters.category1)"
            @change="scheduleOverviewLoad('category1')"
          />
          <Select
            v-model:value="query.category2"
            class="filter-control wide"
            mode="multiple"
            placeholder="二级分类"
            :max-tag-count="1"
            :options="optionList(filters.category2)"
            @change="scheduleOverviewLoad('category2')"
          />
          <Select
            v-model:value="query.category3"
            class="filter-control wide"
            mode="multiple"
            placeholder="产品线"
            :max-tag-count="1"
            :options="optionList(filters.category3)"
            @change="scheduleOverviewLoad('category3')"
          />
          <Select
            v-model:value="query.productTypes"
            class="filter-control"
            mode="multiple"
            placeholder="新老品"
            :max-tag-count="1"
            :options="optionList(filters.productTypes)"
            @change="scheduleOverviewLoad('productTypes')"
          />
        </div>
      </div>
      <div class="filter-actions">
        <Button type="primary" :loading="loading" @click="loadOverview">
          应用筛选
        </Button>
        <Button @click="resetFilters">重置</Button>
      </div>
    </div>

    <Spin :spinning="loading">
      <template v-if="overview">
        <section class="executive-strip">
          <div class="profit-result">
            <div class="metric-label">
              {{ summary?.profitLabel || '区间纯利' }}
              <span>{{ overview.periodLabel }}</span>
            </div>
            <strong
              :class="moneyClass(Number(summary?.selectedNetProfit || 0))"
            >
              {{ formatMoneyWan(summary?.selectedNetProfit) }}
            </strong>
            <p>
              纯利率 {{ formatPercent(netMargin) }}，来自
              {{ formatMoneyWan(cashIncome) }} 回款收入
            </p>
          </div>
          <div class="roi-result">
            <div class="metric-label">
              投资回报 ROI
              <Tooltip
                title="ROI = 纯利 ÷ 总投入。这里的总投入等于 ASIN 标准费用、营销费用和其他费用之和。"
              >
                <Info :size="15" />
              </Tooltip>
            </div>
            <strong :class="moneyClass(Number(summary?.roi || 0))">
              {{ formatRoi(summary?.roi) }}
            </strong>
            <p>{{ roiPlainText }}</p>
          </div>
          <div class="supporting-metrics">
            <div>
              <span>总投入</span>
              <strong>{{ formatMoneyWan(summary?.investment) }}</strong>
              <small>费用率 {{ formatPercent(expenseRate) }}</small>
            </div>
            <div>
              <span>亏损明细占比</span>
              <strong>{{ formatPercent(summary?.negativeRate) }}</strong>
              <small>{{ formatInteger(summary?.negativeCount) }} 条亏损明细</small>
            </div>
            <div>
              <span>统计范围</span>
              <strong>{{ formatInteger(summary?.parentAsinCount) }} 个</strong>
              <small>{{ formatInteger(summary?.accountCount) }} 个账号</small>
            </div>
          </div>
        </section>

        <section class="profit-equation-section">
          <div class="section-heading">
            <div>
              <h2>纯利形成</h2>
              <p>
                每个金额都可点击下钻；采购、头程等基础成本已归入标准费用，不在这里重复扣减。
              </p>
            </div>
            <span v-if="Math.abs(formulaVariance) > 1" class="formula-warning">
              公式差额 {{ formatMoney(formulaVariance) }}
            </span>
          </div>
          <div class="profit-equation">
            <button
              type="button"
              @click="openMetricDetails('cashIncome', '回款收入')"
            >
              <span>回款收入</span>
              <strong>{{ formatMoneyWan(cashIncome) }}</strong>
              <small>纯利计算起点</small>
            </button>
            <div class="equation-operator">−</div>
            <button
              type="button"
              @click="openMetricDetails('standardFee', 'ASIN 标准费用')"
            >
              <span>ASIN 标准费用</span>
              <strong>{{ formatMoneyWan(standardFee) }}</strong>
              <small>{{
                  formatPercent(cashIncome ? standardFee / cashIncome : 0)
                }}
                回款占比</small>
            </button>
            <div class="equation-operator">−</div>
            <button
              type="button"
              @click="openMetricDetails('marketingFee', '营销费用')"
            >
              <span>营销费用</span>
              <strong>{{ formatMoneyWan(marketingFee) }}</strong>
              <small>{{
                  formatPercent(cashIncome ? marketingFee / cashIncome : 0)
                }}
                回款占比</small>
            </button>
            <div class="equation-operator">−</div>
            <button
              type="button"
              @click="openMetricDetails('otherFee', '其他费用')"
            >
              <span>其他费用</span>
              <strong>{{ formatMoneyWan(otherFee) }}</strong>
              <small>{{
                  formatPercent(cashIncome ? otherFee / cashIncome : 0)
                }}
                回款占比</small>
            </button>
            <div class="equation-operator result-operator">=</div>
            <button
              class="equation-result"
              type="button"
              @click="openMetricDetails('netProfit', '纯利')"
            >
              <span>纯利</span>
              <strong>{{ formatMoneyWan(summary?.selectedNetProfit) }}</strong>
              <small>纯利率 {{ formatPercent(netMargin) }}</small>
            </button>
          </div>
          <div class="return-quality">
            <div class="quality-copy">
              <span>投入结构</span>
              <strong>{{ formatMoneyWan(summary?.investment) }}</strong>
              <small>ROI 的分母，由以下三类费用构成</small>
            </div>
            <div class="expense-bars">
              <div
                v-for="item in expenseStructure"
                :key="item.key"
                class="expense-row"
              >
                <span>{{ item.label }}</span>
                <div>
                  <i
                    :style="{
                      width: `${Math.max(0, Math.min(item.share * 100, 100))}%`,
                    }"
                  ></i>
                </div>
                <strong>{{ formatPercent(item.share) }}</strong>
              </div>
            </div>
          </div>
        </section>

        <div class="analysis-toolbar">
          <Segmented
            :options="panelOptions"
            :value="panel"
            @change="handlePanelChange"
          />
          <span>{{ overview.periodLabel }}</span>
        </div>

        <section v-if="panel === 'ranking'" class="panel">
          <div class="panel-title">
            <div>
              <h2>
                {{
                  rankingMode === 'profit'
                    ? '纯利贡献'
                    : rankingMode === 'roi'
                      ? 'ROI 效率'
                      : '亏损拖累'
                }}
              </h2>
              <p>
                当前按
                {{
                  dimensions.find((item) => item.key === query.dimension)
                    ?.label || '维度'
                }}
                聚合，点击名称查看对应 MSKU 级利润和费用明细。
              </p>
            </div>
            <Segmented v-model:value="rankingMode" :options="rankingOptions" />
          </div>
          <Table
            :columns="groupColumns"
            :data-source="rankingRows"
            :pagination="false"
            row-key="name"
            size="middle"
          >
            <template #bodyCell="{ column, record, text, index }">
              <span v-if="column.key === 'rank'" class="rank-badge">{{
                index + 1
              }}</span>
              <button
                v-else-if="column.key === 'name'"
                class="group-name"
                type="button"
                @click="openGroupDetails(record)"
              >
                {{ text }} <ChevronRight :size="14" />
              </button>
              <span
                v-else-if="column.key === 'netProfit'"
                :class="moneyClass(record.netProfit)"
                >{{ formatMoney(record.netProfit) }}</span>
              <span v-else-if="column.key === 'investment'">{{
                formatMoney(record.investment)
              }}</span>
              <span
                v-else-if="column.key === 'roi'"
                :class="moneyClass(record.roi)"
                >{{ formatRoi(record.roi) }}</span>
              <span v-else-if="column.key === 'contribution'">{{
                formatPercent(groupContribution(record.netProfit))
              }}</span>
              <span v-else-if="column.key === 'scale'">{{ formatInteger(record.parentAsinCount) }} 父ASIN ·
                {{ formatInteger(record.accountCount) }} 账号</span>
              <span v-else>{{ text || '-' }}</span>
            </template>
          </Table>
        </section>

        <section v-else-if="panel === 'pivot'" class="panel">
          <div class="panel-title">
            <div>
              <h2>
                {{ pivot.rowLabel || '维度 A' }} ×
                {{ pivot.columnLabel || '维度 B' }}
              </h2>
              <p>
                任选两个维度交叉展开，单元格同时显示纯利、投入、ROI 和父ASIN数。
              </p>
            </div>
            <div class="pivot-selects">
              <div>
                <label>行维度</label>
                <Select
                  v-model:value="query.pivotRow"
                  :options="
                    dimensions.map((item) => ({
                      label: item.label,
                      value: item.key,
                    }))
                  "
                  @change="loadPivot"
                />
              </div>
              <span>×</span>
              <div>
                <label>列维度</label>
                <Select
                  v-model:value="query.pivotColumn"
                  :options="
                    dimensions.map((item) => ({
                      label: item.label,
                      value: item.key,
                    }))
                  "
                  @change="loadPivot"
                />
              </div>
            </div>
          </div>
          <Spin :spinning="pivotLoading">
            <div v-if="pivot?.rows.length" class="pivot-table-wrap">
              <table class="pivot-table">
                <thead>
                  <tr>
                    <th>{{ pivot.rowLabel }}</th>
                    <th>合计</th>
                    <th v-for="column in pivot.columns" :key="column">
                      {{ column }}
                    </th>
                  </tr>
                  <tr v-if="pivot.columnTotals?.length" class="pivot-total-row">
                    <th>列合计</th>
                    <td></td>
                    <td
                      v-for="(cell, index) in pivot.columnTotals"
                      :key="`column-total-${index}`"
                    >
                      <strong>{{ formatMoney(cell.netProfit) }}</strong><small>投入 {{ formatMoney(cell.investment) }} · ROI
                        {{ formatRoi(cell.roi) }}</small>
                    </td>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in pivot.rows" :key="row.name">
                    <th>{{ row.name }}</th>
                    <td class="pivot-row-total">
                      <strong>{{ formatMoney(row.total?.netProfit) }}</strong><small>投入 {{ formatMoney(row.total?.investment) }} · ROI
                        {{ formatRoi(row.total?.roi) }}</small>
                    </td>
                    <td
                      v-for="(cell, index) in row.cells"
                      :key="`${row.name}-${index}`"
                    >
                      <strong>{{ formatMoney(cell.netProfit) }}</strong><small>投入 {{ formatMoney(cell.investment) }} · ROI
                        {{ formatRoi(cell.roi) }} ·
                        {{ formatInteger(cell.parentAsinCount) }} 父ASIN</small>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Empty v-else description="当前筛选没有可透视的数据" />
          </Spin>
        </section>

        <section v-else class="panel">
          <div class="panel-title">
            <div>
              <h2>全周期盈亏平衡</h2>
              <p>
                从开发日期开始累计月度纯利，追踪首次累计转正月份；周期按该月月末计算。
              </p>
            </div>
            <span>共 {{ formatInteger(breakEven?.total) }} 个父ASIN</span>
          </div>
          <div class="break-even-summary">
            <span>平均转正周期
              <strong>{{
                  Number(breakEven?.avgDaysToBreakEven || 0).toFixed(0)
                }}
                天</strong></span><span>尚未转正
              <strong>{{
                formatInteger(breakEven?.pendingCount)
              }}</strong></span>
          </div>
          <Spin :spinning="breakEvenLoading">
            <Table
              :columns="breakEvenColumns"
              :data-source="breakEvenRows()"
              :pagination="{ pageSize: 50, showSizeChanger: true }"
              row-key="parentAsin"
              size="middle"
            />
          </Spin>
        </section>
      </template>
      <Empty v-else description="暂无纯利数据" />
    </Spin>

    <Drawer
      v-model:open="detailOpen"
      width="88vw"
      :title="detailTitle"
      destroy-on-close
    >
      <Table
        :columns="detailColumns"
        :data-source="detailResult?.rows ?? []"
        :loading="detailLoading"
        :pagination="{ pageSize: 50, showSizeChanger: true }"
        row-key="key"
        size="small"
        :scroll="{ x: 1600 }"
      >
        <template #bodyCell="{ column, text }">
          <span
            :class="
              ['netProfit', 'focusValue'].includes(String(column.key || ''))
                ? moneyClass(Number(text || 0))
                : undefined
            "
          >
            {{ formatDetailValue(String(column.key || ''), text) }}
          </span>
        </template>
      </Table>
    </Drawer>
  </div>
</template>

<style scoped>
.net-profit-page {
  min-height: 100%;
  padding: 18px;
  color: #172033;
  background: #eef3f8;
}

.page-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.page-head h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 750;
}

.page-head p {
  margin: 6px 0 0;
  color: #607089;
}

.view-tabs {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 12px;
}

.view-tab,
.add-tab {
  color: #50627b;
  cursor: pointer;
  background: #fff;
  border: 1px solid #cfdae7;
}

.view-tab {
  padding: 8px 12px;
  border-radius: 7px 7px 0 0;
}

.view-tab.active {
  color: #1558c0;
  background: #eaf3ff;
  border-color: #8bb7ee;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  vertical-align: middle;
  color: #8a98aa;
}

.add-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 18px;
  border-radius: 6px;
}

.filter-bar {
  display: grid;
  grid-template-columns: 250px 142px 1px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: flex-end;
  padding: 12px;
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
}

.filter-section {
  display: grid;
  gap: 5px;
}

.filter-section label {
  font-size: 12px;
  color: #687990;
}

.filter-group {
  display: grid;
  gap: 5px;
}

.filter-group-label {
  font-size: 12px;
  color: #687990;
}

.filter-group-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.product-filter-group {
  grid-row: 2;
  grid-column: 1 / 5;
}

.organization-filter-group {
  grid-column: 4 / 6;
}

.filter-actions {
  display: flex;
  grid-row: 2;
  grid-column: 5;
  gap: 8px;
  align-items: center;
}

.period-range {
  width: 250px;
}

.filter-divider {
  width: 1px;
  height: 34px;
  margin: 0 2px;
  background: #dce4ed;
}

.filter-control {
  width: 142px;
}

.filter-control.wide {
  width: 170px;
}

.executive-strip {
  display: grid;
  grid-template-columns: minmax(280px, 1.25fr) minmax(250px, 0.9fr) minmax(
      420px,
      1.4fr
    );
  min-height: 154px;
  margin-bottom: 14px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
}

.profit-result,
.roi-result,
.supporting-metrics {
  padding: 20px 22px;
}

.profit-result,
.roi-result {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-right: 1px solid #e1e7ef;
}

.profit-result {
  background: #effaf6;
}

.roi-result {
  background: #f3f7fe;
}

.metric-label {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  font-weight: 650;
  color: #42536a;
}

.metric-label span {
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 500;
  color: #55708d;
  background: rgb(255 255 255 / 72%);
  border: 1px solid #d3e0ea;
  border-radius: 999px;
}

.profit-result > strong,
.roi-result > strong {
  margin-top: 10px;
  font-size: clamp(30px, 2.4vw, 42px);
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}

.profit-result p,
.roi-result p {
  margin: 9px 0 0;
  font-size: 13px;
  color: #5e6f84;
}

.supporting-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
}

.supporting-metrics > div {
  min-width: 0;
  padding: 4px 18px;
}

.supporting-metrics > div + div {
  border-left: 1px solid #e3e8ef;
}

.supporting-metrics span,
.supporting-metrics small,
.supporting-metrics strong {
  display: block;
}

.supporting-metrics span,
.supporting-metrics small {
  color: #687990;
}

.supporting-metrics span {
  font-size: 12px;
}

.supporting-metrics strong {
  margin: 9px 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  color: #182338;
  white-space: nowrap;
}

.supporting-metrics small {
  font-size: 11px;
}

.profit-equation-section {
  padding: 18px 20px;
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
}

.section-heading {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-heading h2 {
  margin: 0;
  font-size: 17px;
}

.section-heading p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6a7b91;
}

.formula-warning {
  color: #ad4e00;
}

.profit-equation {
  display: grid;
  grid-template-columns:
    minmax(170px, 1.2fr) 30px repeat(3, minmax(150px, 1fr) 30px)
    minmax(170px, 1.2fr);
  align-items: stretch;
}

.profit-equation button {
  display: grid;
  gap: 7px;
  min-height: 100px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  background: #f7f9fc;
  border: 1px solid #dbe3ed;
  border-radius: 6px;
  transition:
    border-color 160ms ease-out,
    box-shadow 160ms ease-out,
    transform 160ms ease-out;
}

.profit-equation button:hover {
  border-color: #7ba7df;
  box-shadow: 0 8px 18px rgb(45 89 140 / 10%);
  transform: translateY(-1px);
}

.profit-equation button:focus-visible,
.view-tab:focus-visible,
.add-tab:focus-visible,
.group-name:focus-visible {
  outline: 3px solid rgb(22 119 255 / 24%);
  outline-offset: 2px;
}

.profit-equation button span,
.profit-equation button small {
  color: #66788e;
}

.profit-equation button span {
  font-size: 12px;
  font-weight: 650;
}

.profit-equation button strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  color: #1c2a3d;
}

.profit-equation button small {
  font-size: 11px;
}

.profit-equation .equation-result {
  background: #eaf8f2;
  border-color: #9bd8c1;
}

.profit-equation .equation-result strong {
  color: #007f5f;
}

.equation-operator {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: #8796a9;
}

.result-operator {
  color: #087f65;
}

.return-quality {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid #e5eaf0;
}

.quality-copy span,
.quality-copy small,
.quality-copy strong {
  display: block;
}

.quality-copy span,
.quality-copy small {
  color: #6b7b8f;
}

.quality-copy span {
  font-size: 12px;
}

.quality-copy strong {
  margin: 5px 0;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.quality-copy small {
  font-size: 11px;
}

.expense-bars {
  display: grid;
  gap: 9px;
}

.expense-row {
  display: grid;
  grid-template-columns: 86px minmax(120px, 1fr) 64px;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: #5d6f84;
}

.expense-row > div {
  height: 7px;
  overflow: hidden;
  background: #e8edf3;
  border-radius: 999px;
}

.expense-row i {
  display: block;
  height: 100%;
  background: #e1a12b;
  border-radius: inherit;
}

.expense-row strong {
  font-variant-numeric: tabular-nums;
  color: #34465e;
  text-align: right;
}

.analysis-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
  margin-bottom: 12px;
  background: #e8eef5;
  border-radius: 7px;
}

.analysis-toolbar > span {
  padding-right: 8px;
  font-size: 12px;
  color: #687990;
}

.panel {
  padding: 16px;
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
}

.panel-title {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.panel-title h2 {
  margin: 0;
  font-size: 18px;
}

.panel-title p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #708099;
}

.panel-title > span {
  color: #708099;
  white-space: nowrap;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #fff;
  background: #2869d7;
  border-radius: 50%;
}

.group-name {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 0;
  font-weight: 650;
  color: #1558c0;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.positive {
  color: #00875a;
}

.negative {
  color: #d4380d;
}

.pivot-selects {
  display: flex;
  gap: 6px;
  align-items: flex-end;
}

.pivot-selects > div {
  display: grid;
  gap: 4px;
}

.pivot-selects label {
  font-size: 11px;
  color: #708099;
}

.pivot-selects .ant-select {
  width: 130px;
}

.pivot-table-wrap {
  overflow: auto;
}

.pivot-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}

.pivot-table th,
.pivot-table td {
  padding: 10px 12px;
  text-align: right;
  border: 1px solid #e1e7ef;
}

.pivot-table th:first-child,
.pivot-table td:first-child {
  text-align: left;
}

.pivot-table th:first-child,
.pivot-table tbody th:first-child {
  position: sticky;
  left: 0;
  z-index: 3;
  min-width: 120px;
  background: #f5f8fb;
}

.pivot-table th:nth-child(2),
.pivot-table td:nth-child(2) {
  position: sticky;
  left: 120px;
  z-index: 2;
  min-width: 170px;
  background: #edf4ff;
}

.pivot-table thead th {
  color: #49617f;
  background: #f5f8fb;
}

.pivot-total-row td,
.pivot-total-row th,
.pivot-row-total {
  font-weight: 650;
  background: #edf4ff;
}

.pivot-table td strong,
.pivot-table td small {
  display: block;
}

.pivot-table td small {
  margin-top: 5px;
  font-size: 11px;
  color: #7b8ba0;
}

.break-even-summary {
  display: flex;
  gap: 26px;
  padding: 12px 14px;
  margin-bottom: 12px;
  color: #65758a;
  background: #f5f8fb;
  border-radius: 6px;
}

.break-even-summary strong {
  margin-left: 6px;
  font-size: 18px;
  color: #172033;
}

@media (max-width: 1100px) {
  .executive-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .supporting-metrics {
    grid-column: 1 / -1;
    border-top: 1px solid #e1e7ef;
  }

  .roi-result {
    border-right: 0;
  }

  .profit-equation {
    grid-template-columns: repeat(4, minmax(150px, 1fr));
    gap: 8px;
  }

  .equation-operator {
    display: none;
  }

  .profit-equation .equation-result {
    grid-column: 1 / -1;
  }

  .filter-control.wide {
    width: 150px;
  }

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
  }

  .organization-filter-group,
  .product-filter-group {
    flex: 1 1 100%;
  }
}

@media (max-width: 640px) {
  .net-profit-page {
    padding: 10px;
  }

  .page-head {
    flex-direction: column;
  }

  .executive-strip,
  .profit-equation,
  .return-quality,
  .supporting-metrics {
    grid-template-columns: 1fr;
  }

  .profit-result,
  .roi-result {
    border-right: 0;
    border-bottom: 1px solid #e1e7ef;
  }

  .supporting-metrics {
    padding: 10px 16px;
  }

  .supporting-metrics > div {
    padding: 10px 4px;
  }

  .supporting-metrics > div + div {
    border-top: 1px solid #e3e8ef;
    border-left: 0;
  }

  .profit-equation .equation-result {
    grid-column: auto;
  }

  .return-quality {
    gap: 14px;
  }

  .filter-control,
  .filter-control.wide {
    width: 100%;
  }

  .filter-bar {
    align-items: stretch;
  }

  .filter-section,
  .filter-group,
  .filter-group-controls,
  .period-range {
    width: 100%;
  }

  .filter-actions {
    width: 100%;
  }

  .filter-actions .ant-btn {
    flex: 1;
  }

  .filter-divider {
    display: none;
  }

  .analysis-toolbar {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
}
</style>
