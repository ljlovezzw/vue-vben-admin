<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  NetProfitDetailRow,
  NetProfitDetails,
  NetProfitGroupRow,
  NetProfitOverview,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  Button,
  Drawer,
  Empty,
  Select,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import { fetchNetProfitDetails, fetchNetProfitOverview } from '#/api/kanban';

interface MoneyFlowStep {
  components?: Array<{
    label: string;
    value: number;
  }>;
  detailSortField: string;
  detailSortOrder?: string;
  formula: string;
  key: string;
  label: string;
  note: string;
  rateLabel: string;
  role: string;
  value: number;
}

const loading = ref(false);
const detailLoading = ref(false);
const overview = ref<NetProfitOverview | null>(null);
const detailResult = ref<NetProfitDetails | null>(null);
const drawerOpen = ref(false);

const query = reactive({
  brands: [] as string[],
  countries: [] as string[],
  departments: [] as string[],
  dimension: 'department',
  operators: [] as string[],
  period: '',
});

const drill = reactive({
  dimension: '',
  metric: '',
  title: '全部明细',
  value: '',
});

const detailState = reactive({
  page: 1,
  pageSize: 50,
  sortField: 'netProfit',
  sortOrder: 'descend',
  total: 0,
});

const detailRows = ref<NetProfitDetailRow[]>([]);

const fallbackDimensions = [
  { key: 'department', label: '部门' },
  { key: 'operator', label: '运营' },
  { key: 'country', label: '国家' },
  { key: 'brand', label: '品牌' },
  { key: 'account', label: '账号' },
  { key: 'parentAsin', label: '父ASIN' },
];

const groupColumns: TableColumnsType<NetProfitGroupRow> = [
  { title: '排名', dataIndex: 'rank', key: 'rank', width: 64, align: 'center' },
  { title: '维度', dataIndex: 'name', key: 'name', width: 210 },
  {
    title: '本期纯利',
    dataIndex: 'netProfit',
    key: 'netProfit',
    align: 'right',
    width: 180,
  },
  {
    title: '贡献度',
    dataIndex: 'contribution',
    key: 'contribution',
    align: 'right',
    width: 120,
  },
  {
    title: 'YTD纯利',
    dataIndex: 'ytdNetProfit',
    key: 'ytdNetProfit',
    align: 'right',
    width: 160,
  },
  {
    title: '亏损率',
    dataIndex: 'negativeRate',
    key: 'negativeRate',
    align: 'right',
    width: 110,
  },
  { title: '规模', dataIndex: 'scale', key: 'scale', width: 160 },
];

const fallbackDetailColumns: TableColumnsType<NetProfitDetailRow> = [
  {
    title: '月份',
    dataIndex: 'period',
    key: 'period',
    width: 90,
    sorter: true,
  },
  { title: '店铺', dataIndex: 'shop', key: 'shop', width: 130, sorter: true },
  { title: 'MSKU', dataIndex: 'msku', key: 'msku', width: 150, sorter: true },
  { title: 'SPU', dataIndex: 'spu', key: 'spu', width: 110, sorter: true },
  {
    title: '父ASIN',
    dataIndex: 'parentAsin',
    key: 'parentAsin',
    width: 120,
    sorter: true,
  },
  {
    title: '运营',
    dataIndex: 'operator',
    key: 'operator',
    width: 100,
    sorter: true,
  },
  {
    title: '回款收入',
    dataIndex: 'cashIncome',
    key: 'cashIncome',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '毛利润',
    dataIndex: 'grossProfit',
    key: 'grossProfit',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '采购成本',
    dataIndex: 'purchaseCost',
    key: 'purchaseCost',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '头程成本',
    dataIndex: 'firstLegCost',
    key: 'firstLegCost',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '头程费用',
    dataIndex: 'firstLegFee',
    key: 'firstLegFee',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '包材费用',
    dataIndex: 'packageCost',
    key: 'packageCost',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '平台费用',
    dataIndex: 'standardFee',
    key: 'standardFee',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '营销费用',
    dataIndex: 'marketingFee',
    key: 'marketingFee',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '自定义费用',
    dataIndex: 'customCost',
    key: 'customCost',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '其他费用',
    dataIndex: 'otherFee',
    key: 'otherFee',
    align: 'right',
    width: 120,
    sorter: true,
  },
  {
    title: '纯利',
    dataIndex: 'netProfit',
    key: 'netProfit',
    align: 'right',
    width: 130,
    sorter: true,
  },
  { title: '品名', dataIndex: 'productName', key: 'productName', width: 260 },
];

const detailColumnWidths: Record<string, number> = {
  amount: 120,
  cashIncome: 130,
  country: 80,
  customCost: 120,
  department: 100,
  firstLegCost: 120,
  firstLegFee: 120,
  focusShare: 130,
  focusValue: 140,
  grossProfit: 120,
  marketingFee: 150,
  msku: 150,
  netProfit: 130,
  operator: 100,
  otherFee: 130,
  packageCost: 120,
  parentAsin: 120,
  period: 90,
  productName: 240,
  purchaseCost: 120,
  purchaseQty: 100,
  shop: 130,
  sku: 150,
  spu: 110,
  standardFee: 130,
};

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

const sortableDetailKeys = new Set([
  ...detailMoneyKeys,
  'asin',
  'brand',
  'country',
  'msku',
  'operator',
  'parentAsin',
  'period',
  'purchaseQty',
  'shop',
  'sku',
  'spu',
]);

const detailColumns = computed<TableColumnsType<NetProfitDetailRow>>(() => {
  const columns = detailResult.value?.columns;
  if (!columns?.length) return fallbackDetailColumns;
  return columns.map((column) => ({
    align:
      detailMoneyKeys.has(column.key) ||
      ['focusShare', 'purchaseQty'].includes(column.key)
        ? 'right'
        : undefined,
    className: column.role === 'focus' ? 'focus-detail-column' : '',
    dataIndex: column.key,
    key: column.key,
    sorter: sortableDetailKeys.has(column.key),
    title: column.label,
    width: detailColumnWidths[column.key] ?? 120,
  }));
});

const detailScrollX = computed(() =>
  detailColumns.value.reduce(
    (total, column) => total + Number(column.width || 120),
    0,
  ),
);

const summary = computed(() => overview.value?.summary);
const filters = computed(
  () =>
    overview.value?.filters ?? {
      brands: [],
      countries: [],
      departments: [],
      operators: [],
    },
);
const dimensionOptions = computed(
  () => overview.value?.dimensions ?? fallbackDimensions,
);
const periodOptions = computed(() => [
  ...(overview.value?.periods ?? []),
  { key: 'ytd', label: '年累计' },
]);
const maxTrendAbs = computed(() =>
  Math.max(
    ...(overview.value?.trend ?? []).map((item) => Math.abs(item.netProfit)),
    1,
  ),
);
const maxBreakdownAbs = computed(() =>
  Math.max(
    ...(overview.value?.breakdown.items ?? []).map((item) =>
      Math.abs(item.value),
    ),
    1,
  ),
);
const groupMaxAbs = computed(() =>
  Math.max(
    ...(overview.value?.groups ?? []).map((item) => Math.abs(item.netProfit)),
    1,
  ),
);
const costItems = computed(() =>
  (overview.value?.breakdown.items ?? []).filter(
    (item) => item.type === 'cost',
  ),
);
const cashIncome = computed(
  () =>
    overview.value?.breakdown.items.find((item) => item.key === 'cashIncome')
      ?.value ?? 0,
);
const grossProfit = computed(
  () =>
    overview.value?.breakdown.items.find((item) => item.key === 'grossProfit')
      ?.value ?? 0,
);
function breakdownValue(key: string) {
  return (
    overview.value?.breakdown.items.find((item) => item.key === key)?.value ?? 0
  );
}

const purchaseCost = computed(() => Math.abs(breakdownValue('purchaseCost')));
const platformCost = computed(() => Math.abs(breakdownValue('standardFee')));
const marketingCost = computed(() => Math.abs(breakdownValue('marketingFee')));
const asinOtherCost = computed(() => Math.abs(breakdownValue('otherFee')));
const customCost = computed(() => Math.abs(breakdownValue('customCost')));
const directDeductionCost = computed(
  () => platformCost.value + marketingCost.value + asinOtherCost.value,
);
const totalCost = computed(() =>
  costItems.value.reduce((total, item) => total + Math.abs(item.value), 0),
);
const topCostItem = computed(
  () =>
    costItems.value.toSorted(
      (a, b) => Math.abs(b.value) - Math.abs(a.value),
    )[0],
);
const bestGroup = computed(() => overview.value?.groups?.[0]);
const riskGroups = computed(() => overview.value?.risks ?? []);
const worstGroup = computed(() => riskGroups.value[0]);
const netMargin = computed(() =>
  ratio(overview.value?.breakdown.netProfit ?? 0, cashIncome.value),
);
const grossMargin = computed(() => ratio(grossProfit.value, cashIncome.value));
const costRate = computed(() =>
  ratio(totalCost.value, Math.abs(cashIncome.value)),
);
const avgProfitPerParentAsin = computed(() =>
  ratio(
    summary.value?.selectedNetProfit ?? 0,
    summary.value?.parentAsinCount ?? 0,
  ),
);
const profitBridge = computed(() => [
  {
    key: 'cash',
    label: '回款收入',
    sub: '收入基础',
    tone: 'income',
    value: cashIncome.value,
  },
  {
    key: 'gross',
    label: '毛利润',
    sub: `毛利率 ${formatPercent(grossMargin.value)}`,
    tone: 'gross',
    value: grossProfit.value,
  },
  {
    key: 'cost',
    label: '费用消耗',
    sub: `费用率 ${formatPercent(costRate.value)}`,
    tone: 'cost',
    value: -totalCost.value,
  },
  {
    key: 'net',
    label: '最终纯利',
    sub: `纯利率 ${formatPercent(netMargin.value)}`,
    tone: (overview.value?.breakdown.netProfit ?? 0) >= 0 ? 'net' : 'loss',
    value: overview.value?.breakdown.netProfit ?? 0,
  },
]);
const bridgeMaxAbs = computed(() =>
  Math.max(...profitBridge.value.map((item) => Math.abs(item.value)), 1),
);
const moneyFlowSteps = computed<MoneyFlowStep[]>(() => [
  {
    components: [
      { label: '领星毛利', value: grossProfit.value },
      { label: '采购成本', value: purchaseCost.value },
      { label: '头程成本', value: Math.abs(breakdownValue('firstLegCost')) },
      { label: '自定义费用', value: customCost.value },
    ],
    detailSortField: 'cashIncome',
    formula: '领星毛利 + 采购成本 + 头程成本 + 自定义费用',
    key: 'cash',
    label: '回款收入',
    note: '收入计算口径',
    rateLabel: '100.0%',
    role: 'start',
    value: cashIncome.value,
  },
  {
    detailSortField: 'standardFee',
    formula: '采购单价 + 包装单价 + 头程单价',
    key: 'platform',
    label: 'ASIN标准费用',
    note: 'ASIN标准费用',
    rateLabel: formatPercent(
      ratio(platformCost.value, Math.abs(cashIncome.value)),
    ),
    role: 'cost',
    value: -platformCost.value,
  },
  {
    detailSortField: 'marketingFee',
    formula: '线下推广费用',
    key: 'marketing',
    label: 'ASIN营销相关费用',
    note: '推广费用扣减',
    rateLabel: formatPercent(
      ratio(marketingCost.value, Math.abs(cashIncome.value)),
    ),
    role: 'cost-strong',
    value: -marketingCost.value,
  },
  {
    detailSortField: 'otherFee',
    formula: 'ASIN其他费用',
    key: 'other',
    label: 'ASIN其他费用',
    note: '其他费用扣减',
    rateLabel: formatPercent(
      ratio(asinOtherCost.value, Math.abs(cashIncome.value)),
    ),
    role: 'cost',
    value: -asinOtherCost.value,
  },
  {
    detailSortField: 'netProfit',
    detailSortOrder:
      (overview.value?.breakdown.netProfit ?? 0) >= 0 ? 'descend' : 'ascend',
    formula: '回款收入 - ASIN标准费用 - ASIN营销相关费用 - ASIN其他费用',
    key: 'net',
    label: '纯利',
    note: `纯利率 ${formatPercent(netMargin.value)}`,
    rateLabel: formatPercent(netMargin.value),
    role: (overview.value?.breakdown.netProfit ?? 0) >= 0 ? 'end' : 'loss',
    value: overview.value?.breakdown.netProfit ?? 0,
  },
]);
const fallbackMoneyFlowStep: MoneyFlowStep = {
  detailSortField: 'netProfit',
  formula: '',
  key: 'fallback',
  label: '-',
  note: '',
  rateLabel: '-',
  role: 'end',
  value: 0,
};
const incomeFlowStep = computed<MoneyFlowStep>(
  () => moneyFlowSteps.value[0] ?? fallbackMoneyFlowStep,
);
const deductionFlowSteps = computed(() => moneyFlowSteps.value.slice(1, -1));
const netProfitFlowStep = computed<MoneyFlowStep>(
  () =>
    moneyFlowSteps.value[moneyFlowSteps.value.length - 1] ??
    fallbackMoneyFlowStep,
);
const moneyFlowMaxAbs = computed(() =>
  Math.max(...moneyFlowSteps.value.map((item) => Math.abs(item.value)), 1),
);
const biggestMoneyOut = computed(
  () =>
    moneyFlowSteps.value
      .filter((item) => item.value < 0)
      .toSorted((a, b) => Math.abs(b.value) - Math.abs(a.value))[0],
);
const moneyFlowConclusion = computed(() => {
  const netProfit = overview.value?.breakdown.netProfit ?? 0;
  const drag = biggestMoneyOut.value;
  if (!drag) return '当前筛选下暂未识别主要费用消耗。';
  const action = netProfit >= 0 ? '利润主要被' : '亏损主要受';
  return `${action}${drag.label}压缩，占回款 ${drag.rateLabel}。`;
});
const executiveCards = computed(() => [
  {
    key: 'status',
    label: '经营状态',
    title:
      (summary.value?.selectedNetProfit ?? 0) >= 0 ? '本期盈利' : '本期亏损',
    value: formatMoneyWan(summary.value?.selectedNetProfit ?? 0),
    note: `纯利率 ${formatPercent(netMargin.value)} · 单父ASIN ${formatMoney(avgProfitPerParentAsin.value)}`,
    tone: (summary.value?.selectedNetProfit ?? 0) >= 0 ? 'good' : 'bad',
  },
  {
    key: 'source',
    label: '主要利润来源',
    title: bestGroup.value?.name ?? '-',
    value: formatMoneyWan(bestGroup.value?.netProfit ?? 0),
    note: `${bestGroup.value?.dimensionLabel ?? '维度'}贡献 ${formatPercent(contribution(bestGroup.value?.netProfit ?? 0))}`,
    tone: 'focus',
  },
  {
    key: 'drag',
    label: '主要拖累项',
    title: worstGroup.value?.name ?? '暂无亏损分组',
    value: worstGroup.value ? formatMoneyWan(worstGroup.value.netProfit) : '无',
    note: worstGroup.value
      ? `${worstGroup.value.dimensionLabel} · 亏损项 ${formatInteger(worstGroup.value.negativeCount)}`
      : '当前筛选下没有分组级亏损',
    tone: worstGroup.value ? 'bad' : 'good',
  },
  {
    key: 'cost',
    label: '费用压力',
    title: topCostItem.value?.label ?? '-',
    value: formatMoneyWan(topCostItem.value?.value ?? 0),
    note: `总费用 ${formatMoneyWan(totalCost.value)} · 费用率 ${formatPercent(costRate.value)}`,
    tone: 'warning',
  },
]);

function negativeRateTone(rate: number) {
  if (rate >= 0.2) return 'red';
  if (rate >= 0.1) return 'amber';
  return 'green';
}

const kpis = computed(() => {
  const item = summary.value;
  if (!item) return [];
  return [
    {
      key: 'selected',
      label: `${item.profitLabel}`,
      sub: overview.value?.periodLabel ?? '',
      tone: item.selectedNetProfit >= 0 ? 'green' : 'red',
      value: formatMoneyWan(item.selectedNetProfit),
    },
    {
      key: 'ytd',
      label: '2026累计纯利',
      sub: `汇总 ${formatInteger(item.rowCount)} 行 · 父ASIN ${formatInteger(item.parentAsinCount)}`,
      tone: item.ytdNetProfit >= 0 ? 'blue' : 'red',
      value: formatMoneyWan(item.ytdNetProfit),
    },
    {
      key: 'negative',
      label: '亏损占比',
      sub: `亏损项 ${formatInteger(item.negativeCount)} · 盈利项 ${formatInteger(item.positiveCount)}`,
      tone: negativeRateTone(item.negativeRate),
      value: formatPercent(item.negativeRate),
    },
    {
      key: 'accounts',
      label: '覆盖账号',
      sub: `最近汇总 ${item.updatedAt || '-'}`,
      tone: 'purple',
      value: formatInteger(item.accountCount),
    },
  ];
});

function optionList(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

function formatInteger(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  });
}

function formatMoney(value: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  })}`;
}

function formatMoneyWan(value: number) {
  return `¥${(Number(value || 0) / 10_000).toLocaleString('zh-CN', {
    maximumFractionDigits: 1,
  })}万`;
}

function formatPercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function ratio(numerator: number, denominator: number) {
  const base = Number(denominator || 0);
  if (!base) return 0;
  return Number(numerator || 0) / base;
}

function contribution(value: number) {
  const base = summary.value?.selectedNetProfit ?? 0;
  if (!base) return 0;
  return Number(value || 0) / base;
}

function negativeRate(row: NetProfitGroupRow | Record<string, any>) {
  return ratio(Number(row.negativeCount || 0), Number(row.rowCount || 0));
}

function moneyClass(value: number) {
  return {
    negative: Number(value || 0) < 0,
    positive: Number(value || 0) > 0,
  };
}

function isMoneyDetailColumn(key: unknown) {
  return detailMoneyKeys.has(String(key || ''));
}

function monthLabel(period: string) {
  if (/^\d{6}$/.test(period)) {
    return `${period.slice(0, 4)}-${period.slice(4, 6)}`;
  }
  return period;
}

function barWidth(value: number, maxValue: number) {
  return `${Math.max(Math.abs(value) / maxValue, 0.02) * 100}%`;
}

function resetFilters() {
  query.brands = [];
  query.countries = [];
  query.departments = [];
  query.operators = [];
  void loadOverview();
}

function overviewParams() {
  return {
    brands: query.brands,
    countries: query.countries,
    departments: query.departments,
    dimension: query.dimension,
    operators: query.operators,
    period: query.period || undefined,
  };
}

async function loadOverview() {
  loading.value = true;
  try {
    const data = await fetchNetProfitOverview(overviewParams());
    overview.value = data;
    if (!query.period) {
      query.period = data.period;
    }
    query.dimension = data.dimension;
  } finally {
    loading.value = false;
  }
}

async function loadDetails() {
  detailLoading.value = true;
  try {
    const data = await fetchNetProfitDetails({
      ...overviewParams(),
      dimension: drill.dimension || undefined,
      metric: drill.metric || undefined,
      page: detailState.page,
      pageSize: detailState.pageSize,
      sortField: detailState.sortField,
      sortOrder: detailState.sortOrder,
      value: drill.value || undefined,
    });
    detailResult.value = data;
    detailRows.value = data.rows;
    detailState.total = data.total;
  } finally {
    detailLoading.value = false;
  }
}

function openAllDetails() {
  detailResult.value = null;
  drill.dimension = '';
  drill.metric = '';
  drill.value = '';
  drill.title = '全部纯利明细';
  detailState.page = 1;
  detailState.sortField = 'netProfit';
  detailState.sortOrder = 'descend';
  drawerOpen.value = true;
  void loadDetails();
}

function openMoneyFlowDetails(step: MoneyFlowStep) {
  detailResult.value = null;
  drill.dimension = '';
  drill.metric = step.key;
  drill.value = '';
  drill.title = `纯利形成路径：${step.label}`;
  detailState.page = 1;
  detailState.sortField = step.detailSortField;
  detailState.sortOrder = step.detailSortOrder ?? 'descend';
  drawerOpen.value = true;
  void loadDetails();
}

function openGroupDetails(row: NetProfitGroupRow | Record<string, any>) {
  detailResult.value = null;
  const group = row as NetProfitGroupRow;
  drill.dimension = group.dimension;
  drill.metric = '';
  drill.value = group.name;
  drill.title = `${group.dimensionLabel}：${group.name}`;
  detailState.page = 1;
  detailState.sortField = 'netProfit';
  detailState.sortOrder = 'descend';
  drawerOpen.value = true;
  void loadDetails();
}

function handleDetailChange(pagination: any, _filters: any, sorter: any) {
  detailState.page = Number(pagination?.current || 1);
  detailState.pageSize = Number(pagination?.pageSize || 50);
  const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  if (activeSorter?.field && activeSorter?.order) {
    detailState.sortField =
      activeSorter.field === 'focusValue'
        ? detailResult.value?.focus?.sortField || 'netProfit'
        : String(activeSorter.field);
    detailState.sortOrder = String(activeSorter.order);
  }
  void loadDetails();
}

onMounted(loadOverview);
</script>

<template>
  <div class="net-profit-page">
    <div class="page-head">
      <div>
        <h1>纯利计算</h1>
        <p>
          基于 net_profit_summary 汇总与 net_profit
          明细，展示本期纯利、年累计、费用构成和可下钻明细。
        </p>
      </div>
      <div class="head-actions">
        <Button @click="openAllDetails">查看明细</Button>
        <Button type="primary" :loading="loading" @click="loadOverview">
          刷新
        </Button>
      </div>
    </div>

    <div class="filter-bar">
      <Select
        v-model:value="query.period"
        class="filter-control"
        :options="
          periodOptions.map((item) => ({ label: item.label, value: item.key }))
        "
        @change="loadOverview"
      />
      <Select
        v-model:value="query.dimension"
        class="filter-control"
        :options="
          dimensionOptions.map((item) => ({
            label: item.label,
            value: item.key,
          }))
        "
        @change="loadOverview"
      />
      <Select
        v-model:value="query.departments"
        class="filter-control wide"
        mode="multiple"
        placeholder="部门"
        :max-tag-count="1"
        :options="optionList(filters.departments)"
      />
      <Select
        v-model:value="query.operators"
        class="filter-control wide"
        mode="multiple"
        placeholder="运营"
        :max-tag-count="1"
        :options="optionList(filters.operators)"
      />
      <Select
        v-model:value="query.countries"
        class="filter-control wide"
        mode="multiple"
        placeholder="国家"
        :max-tag-count="1"
        :options="optionList(filters.countries)"
      />
      <Select
        v-model:value="query.brands"
        class="filter-control wide"
        mode="multiple"
        placeholder="品牌"
        :max-tag-count="1"
        :options="optionList(filters.brands)"
      />
      <Button type="primary" :loading="loading" @click="loadOverview">
        查询
      </Button>
      <Button @click="resetFilters">重置</Button>
    </div>

    <Spin :spinning="loading">
      <template v-if="overview">
        <div class="executive-grid">
          <div
            v-for="item in executiveCards"
            :key="item.key"
            class="executive-card"
            :class="`exec-${item.tone}`"
          >
            <div class="exec-label">{{ item.label }}</div>
            <div class="exec-title">{{ item.title }}</div>
            <div class="exec-value">{{ item.value }}</div>
            <div class="exec-note">{{ item.note }}</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div
            v-for="item in kpis"
            :key="item.key"
            class="kpi-card"
            :class="`tone-${item.tone}`"
          >
            <div class="kpi-label">{{ item.label }}</div>
            <div class="kpi-value">{{ item.value }}</div>
            <div class="kpi-sub">{{ item.sub }}</div>
          </div>
        </div>

        <div class="operating-grid">
          <section class="panel money-flow-panel">
            <div class="money-flow-head">
              <div>
                <div class="panel-title compact money-title">
                  <h2>纯利形成路径</h2>
                  <Tag
                    :color="
                      (overview.breakdown.netProfit ?? 0) >= 0
                        ? 'success'
                        : 'error'
                    "
                  >
                    {{
                      (overview.breakdown.netProfit ?? 0) >= 0
                        ? '最终盈利'
                        : '最终亏损'
                    }}
                  </Tag>
                </div>
                <p class="money-flow-summary">
                  {{ moneyFlowConclusion }}
                </p>
              </div>
              <div
                class="money-flow-result"
                :class="
                  (overview.breakdown.netProfit ?? 0) >= 0 ? 'end' : 'loss'
                "
              >
                <span>最终纯利</span>
                <strong>{{
                  formatMoneyWan(overview.breakdown.netProfit)
                }}</strong>
                <em>纯利率 {{ formatPercent(netMargin) }}</em>
              </div>
            </div>

            <div class="money-formula-layout">
              <button
                class="money-income-card"
                type="button"
                @click="openMoneyFlowDetails(incomeFlowStep)"
              >
                <div class="formula-card-top">
                  <span>{{ incomeFlowStep.label }}</span>
                  <strong>{{ formatMoneyWan(incomeFlowStep.value) }}</strong>
                </div>
                <div class="formula-expression">
                  {{ incomeFlowStep.formula }}
                </div>
                <div class="income-components">
                  <div
                    v-for="component in incomeFlowStep.components"
                    :key="component.label"
                    class="income-component"
                  >
                    <span>{{ component.label }}</span>
                    <strong>{{ formatMoneyWan(component.value) }}</strong>
                  </div>
                </div>
                <div class="formula-card-foot">点击查看回款收入明细</div>
              </button>

              <div class="formula-operator">−</div>

              <div class="deduction-group">
                <div class="deduction-group-head">
                  <span>费用扣减</span>
                  <strong>{{ formatMoneyWan(-directDeductionCost) }}</strong>
                </div>
                <div class="deduction-stack">
                  <button
                    v-for="step in deductionFlowSteps"
                    :key="step.key"
                    class="deduction-card"
                    :class="step.role"
                    type="button"
                    @click="openMoneyFlowDetails(step)"
                  >
                    <div class="deduction-main">
                      <span>{{ step.label }}</span>
                      <strong>{{ formatMoneyWan(step.value) }}</strong>
                    </div>
                    <div class="deduction-formula">{{ step.formula }}</div>
                    <div class="deduction-track">
                      <div
                        class="deduction-bar"
                        :style="{
                          width: barWidth(step.value, moneyFlowMaxAbs),
                        }"
                      ></div>
                    </div>
                    <div class="deduction-foot">
                      <span>{{ step.note }}</span>
                      <em>{{ step.rateLabel }}</em>
                    </div>
                  </button>
                </div>
              </div>

              <div class="formula-operator">=</div>

              <button
                class="money-net-card"
                :class="netProfitFlowStep.role"
                type="button"
                @click="openMoneyFlowDetails(netProfitFlowStep)"
              >
                <span>{{ netProfitFlowStep.label }}</span>
                <strong :class="moneyClass(netProfitFlowStep.value)">
                  {{ formatMoneyWan(netProfitFlowStep.value) }}
                </strong>
                <p>{{ netProfitFlowStep.formula }}</p>
                <em>{{ netProfitFlowStep.note }}</em>
                <div class="formula-card-foot">点击查看纯利明细</div>
              </button>
            </div>
          </section>

          <section class="panel bridge-panel">
            <div class="panel-title">
              <h2>利润桥</h2>
              <span>{{ overview.periodLabel }}</span>
            </div>
            <div class="bridge-list">
              <div
                v-for="item in profitBridge"
                :key="item.key"
                class="bridge-item"
              >
                <div class="bridge-head">
                  <span>{{ item.label }}</span>
                  <strong :class="moneyClass(item.value)">{{
                    formatMoneyWan(item.value)
                  }}</strong>
                </div>
                <div class="bridge-track">
                  <div
                    class="bridge-bar"
                    :class="item.tone"
                    :style="{ width: barWidth(item.value, bridgeMaxAbs) }"
                  ></div>
                </div>
                <div class="bridge-sub">{{ item.sub }}</div>
              </div>
            </div>
          </section>
        </div>

        <div class="main-grid">
          <section class="panel trend-panel">
            <div class="panel-title">
              <h2>月度纯利趋势</h2>
              <span>2026 YTD</span>
            </div>
            <div class="trend-list">
              <div
                v-for="point in overview.trend"
                :key="point.period"
                class="trend-row"
              >
                <div class="trend-month">{{ point.label }}</div>
                <div class="trend-track">
                  <div
                    class="trend-bar"
                    :class="{ negative: point.netProfit < 0 }"
                    :style="{ width: barWidth(point.netProfit, maxTrendAbs) }"
                  ></div>
                </div>
                <div class="trend-value">
                  {{ formatMoneyWan(point.netProfit) }}
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-title">
              <h2>费用压力</h2>
              <span>按金额排序</span>
            </div>
            <div class="breakdown-list">
              <div
                v-for="item in costItems"
                :key="item.key"
                class="breakdown-row"
              >
                <div class="breakdown-name">{{ item.label }}</div>
                <div class="breakdown-track">
                  <div
                    class="breakdown-bar"
                    :class="item.type"
                    :style="{ width: barWidth(item.value, maxBreakdownAbs) }"
                  ></div>
                </div>
                <div class="breakdown-value">
                  {{ formatMoneyWan(item.value) }}
                </div>
              </div>
            </div>
          </section>

          <section class="panel risk-panel">
            <div class="panel-title">
              <h2>亏损预警</h2>
              <span>{{
                riskGroups.length > 0 ? '点击查看明细' : '当前维度无亏损分组'
              }}</span>
            </div>
            <div v-if="riskGroups.length > 0" class="risk-list">
              <button
                v-for="item in riskGroups"
                :key="item.name"
                class="risk-row"
                type="button"
                @click="openGroupDetails(item)"
              >
                <span class="risk-name">{{ item.name }}</span>
                <span class="risk-meta">
                  {{ item.dimensionLabel }} ·
                  {{ formatInteger(item.parentAsinCount) }} 父ASIN
                </span>
                <strong>{{ formatMoneyWan(item.netProfit) }}</strong>
              </button>
            </div>
            <Empty v-else description="没有亏损分组" />
          </section>
        </div>

        <section class="panel">
          <div class="panel-title">
            <h2>利润贡献排行</h2>
            <span>点击维度名称查看 MSKU 级明细</span>
          </div>
          <Table
            :columns="groupColumns"
            :data-source="overview.groups"
            :pagination="false"
            row-key="name"
            size="middle"
          >
            <template #bodyCell="{ column, record, text, index }">
              <span v-if="column.key === 'rank'" class="rank-badge">{{
                index + 1
              }}</span>
              <Button
                v-else-if="column.key === 'name'"
                type="link"
                class="link-button"
                @click="openGroupDetails(record)"
              >
                {{ text }}
              </Button>
              <div v-else-if="column.key === 'netProfit'" class="profit-cell">
                <strong :class="moneyClass(record.netProfit)">
                  {{ formatMoney(Number(record.netProfit || 0)) }}
                </strong>
                <div class="profit-track">
                  <div
                    class="profit-bar"
                    :class="{ negative: record.netProfit < 0 }"
                    :style="{ width: barWidth(record.netProfit, groupMaxAbs) }"
                  ></div>
                </div>
              </div>
              <span v-else-if="column.key === 'contribution'">
                {{ formatPercent(contribution(record.netProfit)) }}
              </span>
              <span
                v-else-if="column.key === 'ytdNetProfit'"
                :class="moneyClass(record.ytdNetProfit)"
              >
                {{ formatMoney(Number(record.ytdNetProfit || 0)) }}
              </span>
              <span v-else-if="column.key === 'negativeRate'">
                {{ formatPercent(negativeRate(record)) }}
              </span>
              <span v-else-if="column.key === 'scale'" class="scale-cell">
                {{ formatInteger(record.parentAsinCount) }} 父ASIN ·
                {{ formatInteger(record.accountCount) }} 账号
              </span>
              <span v-else>{{ formatInteger(Number(text || 0)) }}</span>
            </template>
          </Table>
        </section>
      </template>
      <Empty v-else description="暂无纯利数据" />
    </Spin>

    <Drawer
      v-model:open="drawerOpen"
      width="88vw"
      :title="drill.title"
      destroy-on-close
    >
      <div
        v-if="detailResult?.display?.mode === 'metric-focus'"
        class="detail-focus-banner"
      >
        <div class="detail-focus-copy">
          <span>当前下钻侧重点</span>
          <strong>{{ detailResult?.focus?.metricLabel || '当前指标' }}</strong>
          <p>{{ detailResult?.display?.note || '' }}</p>
        </div>
        <div class="detail-focus-stats">
          <div>
            <span>匹配明细</span>
            <strong>{{ formatInteger(detailState.total) }} 条</strong>
          </div>
          <div>
            <span>绝对金额合计</span>
            <strong>{{
              formatMoneyWan(detailResult?.focusAbsTotal ?? 0)
            }}</strong>
          </div>
        </div>
      </div>
      <Table
        class="detail-table"
        :columns="detailColumns"
        :data-source="detailRows"
        :loading="detailLoading"
        :pagination="{
          current: detailState.page,
          pageSize: detailState.pageSize,
          total: detailState.total,
          showSizeChanger: true,
          showTotal: (total: number) => `共 ${total} 条`,
        }"
        row-key="key"
        size="small"
        :scroll="{ x: detailScrollX }"
        @change="handleDetailChange"
      >
        <template #bodyCell="{ column, text }">
          <span v-if="column.key === 'focusShare'" class="focus-share">
            {{ formatPercent(Number(text || 0)) }}
          </span>
          <span
            v-else-if="isMoneyDetailColumn(column.key)"
            :class="[
              moneyClass(Number(text || 0)),
              { 'focus-value': column.key === 'focusValue' },
            ]"
          >
            {{ formatMoney(Number(text || 0)) }}
          </span>
          <span v-else-if="column.key === 'period'">{{
            monthLabel(String(text || ''))
          }}</span>
          <span v-else>{{ text || '-' }}</span>
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
  letter-spacing: 0;
}

.page-head p {
  margin: 6px 0 0;
  color: #607089;
}

.head-actions,
.filter-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-bar {
  flex-wrap: wrap;
  padding: 12px;
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
}

.filter-control {
  width: 150px;
}

.filter-control.wide {
  width: 190px;
}

.executive-grid {
  display: grid;
  grid-template-columns: 1.15fr repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.executive-card {
  position: relative;
  min-height: 142px;
  padding: 18px;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(135deg, #172033 0%, #26364f 100%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 8px;
  box-shadow: 0 14px 32px rgb(15 23 42 / 12%);
}

.executive-card::after {
  position: absolute;
  right: -42px;
  bottom: -54px;
  width: 132px;
  height: 132px;
  content: '';
  background: rgb(255 255 255 / 8%);
  border-radius: 50%;
}

.exec-good {
  background: linear-gradient(135deg, #0f766e 0%, #155e75 100%);
}

.exec-bad {
  background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%);
}

.exec-focus {
  background: linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%);
}

.exec-warning {
  background: linear-gradient(135deg, #92400e 0%, #9a3412 100%);
}

.exec-label {
  font-size: 12px;
  color: rgb(255 255 255 / 76%);
}

.exec-title {
  min-height: 28px;
  margin-top: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 760;
  white-space: nowrap;
}

.exec-value {
  margin-top: 14px;
  font-size: 28px;
  font-weight: 780;
  line-height: 1;
  letter-spacing: 0;
}

.exec-note {
  position: relative;
  z-index: 1;
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.5;
  color: rgb(255 255 255 / 78%);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.kpi-card {
  padding: 16px;
  background: #fff;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
}

.kpi-label {
  font-size: 13px;
  color: #607089;
}

.kpi-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 760;
  letter-spacing: 0;
}

.kpi-sub {
  margin-top: 8px;
  font-size: 12px;
  color: #75859b;
}

.tone-blue .kpi-value {
  color: #1d4ed8;
}

.tone-green .kpi-value {
  color: #047857;
}

.tone-red .kpi-value,
.negative {
  color: #dc2626;
}

.tone-amber .kpi-value {
  color: #b45309;
}

.tone-purple .kpi-value {
  color: #6d28d9;
}

.positive {
  color: #047857;
}

.panel {
  padding: 14px;
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
}

.panel-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 720;
}

.panel-title span {
  font-size: 12px;
  color: #75859b;
}

.detail-focus-banner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: center;
  padding: 14px 16px;
  margin-bottom: 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-left: 4px solid #2563eb;
  border-radius: 6px;
}

.detail-focus-copy {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 10px;
  align-items: baseline;
}

.detail-focus-copy > span {
  font-size: 12px;
  color: #64748b;
}

.detail-focus-copy > strong {
  font-size: 18px;
  color: #1d4ed8;
}

.detail-focus-copy p {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 13px;
  color: #475569;
}

.detail-focus-stats {
  display: flex;
  gap: 24px;
}

.detail-focus-stats > div {
  display: grid;
  gap: 3px;
  min-width: 112px;
}

.detail-focus-stats span {
  font-size: 12px;
  color: #64748b;
}

.detail-focus-stats strong {
  font-size: 16px;
  color: #172033;
  text-align: right;
}

.focus-value,
.focus-share {
  font-weight: 760;
  color: #1d4ed8;
}

:global(.detail-table .ant-table-thead > tr > th.focus-detail-column) {
  color: #1d4ed8;
  background: #dbeafe;
}

:global(.detail-table .ant-table-tbody > tr > td.focus-detail-column) {
  background: #f5f9ff;
}

.operating-grid {
  display: block;
}

.money-flow-panel {
  overflow: hidden;
}

.money-flow-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 18px;
  align-items: center;
  padding: 14px;
  margin: -2px -2px 14px;
  background: #f8fafc;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
}

.panel-title.compact {
  justify-content: flex-start;
  margin-bottom: 8px;
}

.money-title {
  gap: 8px;
}

.money-flow-summary {
  max-width: 720px;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #475569;
}

.money-flow-result {
  display: grid;
  gap: 6px;
  min-height: 96px;
  padding: 14px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
}

.money-flow-result.loss {
  background: #fef2f2;
  border-color: #fecaca;
}

.money-flow-result span,
.money-flow-result em {
  font-size: 12px;
  font-style: normal;
  color: #64748b;
}

.money-flow-result strong {
  font-size: 26px;
  line-height: 1;
  color: #047857;
}

.money-flow-result.loss strong {
  color: #dc2626;
}

.money-formula-layout {
  display: grid;
  grid-template-columns:
    minmax(280px, 1fr) 32px minmax(620px, 2.15fr) 32px
    minmax(230px, 0.82fr);
  gap: 10px;
  align-items: center;
}

.money-income-card,
.money-net-card,
.deduction-card {
  width: 100%;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.money-income-card:hover,
.money-income-card:focus-visible,
.money-net-card:hover,
.money-net-card:focus-visible,
.deduction-card:hover,
.deduction-card:focus-visible {
  border-color: #93c5fd;
  box-shadow: 0 10px 24px rgb(15 23 42 / 10%);
  transform: translateY(-1px);
}

.money-income-card:focus-visible,
.money-net-card:focus-visible,
.deduction-card:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.money-income-card {
  min-height: 194px;
  padding: 16px;
  background: #f0fdfa;
  border-color: #99f6e4;
}

.formula-card-top,
.deduction-main {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.formula-card-top span,
.deduction-main span,
.money-net-card span {
  font-weight: 760;
  color: #172033;
}

.formula-card-top strong {
  font-size: 24px;
  color: #0f766e;
  white-space: nowrap;
}

.formula-expression,
.deduction-formula {
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
}

.income-components {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.income-component {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 8px;
  font-size: 12px;
  background: rgb(255 255 255 / 70%);
  border: 1px solid #ccfbf1;
  border-radius: 6px;
}

.income-component span {
  color: #64748b;
}

.income-component strong {
  color: #0f766e;
  white-space: nowrap;
}

.formula-card-foot {
  margin-top: 10px;
  font-size: 12px;
  color: #2563eb;
}

.formula-operator {
  display: grid;
  place-items: center;
  align-self: center;
  width: 32px;
  height: 32px;
  font-size: 20px;
  font-weight: 780;
  color: #64748b;
  background: #eef3f8;
  border: 1px solid #dbe5f0;
  border-radius: 50%;
}

.deduction-stack {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.deduction-group {
  min-width: 0;
}

.deduction-group-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 22px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #64748b;
}

.deduction-group-head strong {
  font-size: 15px;
  color: #dc2626;
}

.deduction-card {
  display: flex;
  flex-direction: column;
  min-height: 164px;
  padding: 12px;
}

.deduction-main {
  display: grid;
  gap: 6px;
  align-items: start;
}

.deduction-main strong {
  font-size: 16px;
  color: #b45309;
  white-space: nowrap;
}

.deduction-card.cost-strong .deduction-main strong {
  color: #dc2626;
}

.deduction-track {
  height: 8px;
  margin: 10px 0;
  overflow: hidden;
  background: #e5eaf1;
  border-radius: 999px;
}

.deduction-bar {
  min-width: 4px;
  height: 100%;
  background: #f59e0b;
  border-radius: 999px;
}

.deduction-card.cost-strong .deduction-bar {
  background: #dc2626;
}

.deduction-foot {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
}

.deduction-card .deduction-track {
  margin-top: auto;
}

.deduction-foot em {
  font-style: normal;
  font-weight: 700;
}

.money-net-card {
  display: grid;
  gap: 10px;
  align-content: center;
  min-height: 194px;
  padding: 18px;
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.money-net-card.loss {
  background: #fef2f2;
  border-color: #fecaca;
}

.money-net-card strong {
  font-size: 28px;
  line-height: 1;
  color: #047857;
}

.money-net-card.loss strong {
  color: #dc2626;
}

.money-net-card p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
}

.money-net-card em {
  font-size: 13px;
  font-style: normal;
  font-weight: 720;
  color: #047857;
}

.money-net-card.loss em {
  color: #dc2626;
}

.progress-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.progress-step {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
  min-height: 96px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.step-dot {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  background: #f59e0b;
  border-radius: 50%;
}

.step-dot.complete {
  background: #10b981;
}

.step-title {
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: 650;
}

.progress-step p {
  margin: 8px 0;
  line-height: 1.55;
  color: #475569;
}

.progress-step span {
  font-size: 12px;
  color: #94a3b8;
}

.main-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.95fr 0.95fr;
  gap: 14px;
}

.bridge-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.bridge-item {
  min-height: 104px;
  padding: 13px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.bridge-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.bridge-track {
  height: 12px;
  margin-top: 10px;
  overflow: hidden;
  background: #e5eaf1;
  border-radius: 999px;
}

.bridge-bar {
  min-width: 4px;
  height: 100%;
  background: #2563eb;
  border-radius: 999px;
}

.bridge-bar.income {
  background: #14b8a6;
}

.bridge-bar.gross {
  background: #22c55e;
}

.bridge-bar.cost,
.bridge-bar.loss {
  background: #dc2626;
}

.bridge-bar.net {
  background: #1d4ed8;
}

.bridge-sub {
  margin-top: 8px;
  font-size: 12px;
  color: #75859b;
}

.trend-list,
.breakdown-list {
  display: grid;
  gap: 10px;
}

.trend-row,
.breakdown-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 96px;
  gap: 10px;
  align-items: center;
}

.breakdown-row {
  grid-template-columns: 128px minmax(0, 1fr) 96px;
}

.trend-month,
.breakdown-name {
  font-size: 13px;
  color: #475569;
}

.trend-track,
.breakdown-track {
  height: 10px;
  overflow: hidden;
  background: #e5eaf1;
  border-radius: 999px;
}

.trend-bar,
.breakdown-bar {
  min-width: 3px;
  height: 100%;
  background: #2563eb;
  border-radius: 999px;
}

.trend-bar.negative {
  background: #dc2626;
}

.breakdown-bar.income {
  background: #059669;
}

.breakdown-bar.cost {
  background: #f59e0b;
}

.trend-value,
.breakdown-value {
  font-variant-numeric: tabular-nums;
  color: #172033;
  text-align: right;
}

.risk-list {
  display: grid;
  gap: 10px;
}

.risk-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 10px;
  width: 100%;
  padding: 11px 12px;
  text-align: left;
  cursor: pointer;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
}

.risk-row strong {
  grid-row: span 2;
  align-self: center;
  color: #dc2626;
}

.risk-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 680;
  color: #7c2d12;
  white-space: nowrap;
}

.risk-meta {
  font-size: 12px;
  color: #9a3412;
}

.link-button {
  height: auto;
  padding: 0;
  font-weight: 650;
}

.rank-badge {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  font-size: 12px;
  font-weight: 760;
  color: #1f2937;
  background: #eef2ff;
  border-radius: 50%;
}

.profit-cell {
  display: grid;
  gap: 7px;
}

.profit-track {
  height: 6px;
  overflow: hidden;
  background: #e5eaf1;
  border-radius: 999px;
}

.profit-bar {
  min-width: 3px;
  height: 100%;
  background: #059669;
  border-radius: 999px;
}

.profit-bar.negative {
  background: #dc2626;
}

.scale-cell {
  color: #475569;
}

:global(.dark) .net-profit-page {
  color: #e5e7eb;
  background: #0f172a;
}

:global(.dark) .filter-bar,
:global(.dark) .kpi-card,
:global(.dark) .panel {
  background: #111827;
  border-color: #273449;
}

:global(.dark) .bridge-item,
:global(.dark) .money-flow-head,
:global(.dark) .money-income-card,
:global(.dark) .money-net-card,
:global(.dark) .deduction-card {
  background: #0f172a;
  border-color: #273449;
}

:global(.dark) .money-income-card {
  background: rgb(20 184 166 / 12%);
}

:global(.dark) .income-component {
  background: rgb(15 23 42 / 60%);
  border-color: #164e63;
}

:global(.dark) .formula-equals {
  color: #cbd5e1;
  background: #111827;
  border-color: #273449;
}

:global(.dark) .money-flow-result {
  background: rgb(6 78 59 / 28%);
  border-color: rgb(52 211 153 / 32%);
}

:global(.dark) .money-flow-result.loss {
  background: rgb(127 29 29 / 28%);
  border-color: rgb(248 113 113 / 34%);
}

:global(.dark) .detail-focus-banner {
  background: #172554;
  border-color: #1e40af;
  border-left-color: #60a5fa;
}

:global(.dark) .detail-focus-copy > strong,
:global(.dark) .focus-share,
:global(.dark) .focus-value {
  color: #93c5fd;
}

:global(.dark) .detail-focus-copy > span,
:global(.dark) .detail-focus-copy p,
:global(.dark) .detail-focus-stats span {
  color: #cbd5e1;
}

:global(.dark) .detail-focus-stats strong {
  color: #f8fafc;
}

:global(.dark .detail-table .ant-table-thead > tr > th.focus-detail-column) {
  color: #bfdbfe;
  background: #1e3a8a;
}

:global(.dark .detail-table .ant-table-tbody > tr > td.focus-detail-column) {
  background: #172554;
}

:global(.dark) .formula-card-top span,
:global(.dark) .deduction-main span,
:global(.dark) .money-net-card span,
:global(.dark) .income-component strong {
  color: #e5e7eb;
}

:global(.dark) .risk-row {
  background: rgb(127 29 29 / 28%);
  border-color: rgb(248 113 113 / 34%);
}

:global(.dark) .risk-name,
:global(.dark) .risk-row strong {
  color: #fca5a5;
}

:global(.dark) .risk-meta {
  color: #fecaca;
}

:global(.dark) .page-head p,
:global(.dark) .kpi-label,
:global(.dark) .kpi-sub,
:global(.dark) .panel-title span,
:global(.dark) .trend-month,
:global(.dark) .breakdown-name,
:global(.dark) .bridge-sub,
:global(.dark) .money-flow-summary,
:global(.dark) .money-flow-result span,
:global(.dark) .money-flow-result em,
:global(.dark) .formula-expression,
:global(.dark) .deduction-formula,
:global(.dark) .deduction-foot,
:global(.dark) .deduction-group-head,
:global(.dark) .money-net-card p,
:global(.dark) .income-component span {
  color: #94a3b8;
}

:global(.dark) .trend-value,
:global(.dark) .breakdown-value,
:global(.dark) .scale-cell {
  color: #e5e7eb;
}

@media (max-width: 1200px) {
  .executive-grid,
  .kpi-grid,
  .progress-grid,
  .main-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .money-formula-layout {
    grid-template-columns: 1fr;
  }

  .bridge-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .risk-panel {
    grid-column: 1 / -1;
  }

  .risk-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .formula-operator {
    margin: -2px auto;
  }
}

@media (max-width: 760px) {
  .page-head,
  .main-grid {
    grid-template-columns: 1fr;
  }

  .page-head {
    display: grid;
  }

  .kpi-grid,
  .progress-grid,
  .money-flow-head,
  .money-formula-layout,
  .executive-grid {
    grid-template-columns: 1fr;
  }

  .bridge-list,
  .deduction-stack,
  .income-components,
  .risk-list {
    grid-template-columns: 1fr;
  }

  .risk-panel {
    grid-column: auto;
  }

  .filter-control,
  .filter-control.wide {
    width: 100%;
  }

  .detail-focus-banner {
    grid-template-columns: 1fr;
  }

  .detail-focus-stats {
    justify-content: space-between;
  }
}
</style>
