<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  Asin360AsinAllRow,
  Asin360BriefLogRow,
  Asin360Item,
  Asin360Overview,
  Asin360Product,
} from '#/api/kanban/types';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import VChart from 'vue-echarts';

import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Input,
  Popover,
  Radio,
  Segmented,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import { BarChart, LineChart, PieChart, SankeyChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import { fetchAsin360Overview, fetchAsin360Section } from '#/api/kanban';

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  SankeyChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

type DetailTab = 'ads' | 'daily' | 'inventory' | 'logs' | 'profit';
type ModuleTab =
  | 'ad'
  | 'afterSale'
  | 'child'
  | 'inventory'
  | 'order'
  | 'overview'
  | 'profit';
type RangePreset = '7d' | '30d' | 'custom' | 'month' | 'today' | 'yesterday';
type TimeDim = 'day' | 'hour' | 'month' | 'total' | 'week';

interface MetricCard {
  key: string;
  label: string;
  sub?: string;
  value: string;
}

interface CompareMetricDef {
  key: string;
  label: string;
  money?: boolean;
  percentValue?: boolean;
  ratioChain?: keyof Asin360AsinAllRow;
  ratioYoy?: keyof Asin360AsinAllRow;
  valueKey: keyof Asin360AsinAllRow;
}

type OverviewDailyFormat = 'decimal' | 'integer' | 'money' | 'percent' | 'text';

type OverviewDailySummary = 'avg' | 'last' | 'none' | 'sum';

interface OverviewDailyColumnConfig {
  align?: 'left' | 'right';
  dataIndex: keyof Asin360AsinAllRow;
  fixed?: 'left' | 'right';
  format: OverviewDailyFormat;
  key: keyof Asin360AsinAllRow;
  summary: OverviewDailySummary;
  title: string;
  width: number;
}

const loading = ref(false);
const afterSaleLoading = ref(false);
const overview = ref<Asin360Overview | null>(null);
const afterSaleRemoteAnalysis = ref<null | Record<string, any>>(null);
const parentAsinInput = ref('B0GS9P9NJ1');
const sidInput = ref('1039');
const rangePreset = ref<RangePreset>('30d');
const customRange = ref<[string, string]>();
const detailTab = ref<DetailTab>('daily');
const moduleTab = ref<ModuleTab>('overview');
const overviewTimeDim = ref<TimeDim>('day');
const overviewChartMode = ref<'compare' | 'trend'>('trend');
const overviewCompareMode = ref<'metric' | 'time'>('metric');
const orderMetric = ref<'orders' | 'salesAmount' | 'totalSalesQty'>(
  'salesAmount',
);
const orderChannel = ref<'ad' | 'promo'>('ad');
const orderTimeDim = ref<TimeDim>('day');
const orderRegionWindow = ref<'7d' | '14d' | '28d'>('7d');
const adEfficiencyMetric = ref<'acos' | 'roas'>('acos');
const adTimeDim = ref<Exclude<TimeDim, 'hour' | 'total'>>('day');
const adTrafficTimeDim = ref<Exclude<TimeDim, 'hour' | 'total'>>('day');
const childMetric = ref<'adSpend' | 'salesAmount' | 'salesVolume'>(
  'salesVolume',
);
const childDimension = ref<'category' | 'variant'>('variant');
const childView = ref<'chart' | 'table'>('chart');
const inventoryUnit = ref<'amount' | 'quantity'>('quantity');
const profitView = ref<'bar' | 'flow'>('flow');
const afterSaleKind = ref<'refund' | 'return'>('return');
const afterSaleDateKind = ref<'order' | 'return'>('return');
const afterSaleTimeDim = ref<Exclude<TimeDim, 'hour' | 'total'>>('day');
const overviewCache = new Map<
  string,
  { data: Asin360Overview; expiresAt: number }
>();
const sectionCache = new Map<
  string,
  { data: Record<string, any>; expiresAt: number }
>();

let activeRequestController: AbortController | null = null;
let activeRequestKey = '';
let activeAfterSaleController: AbortController | null = null;
let activeAfterSaleKey = '';
let activeSectionController: AbortController | null = null;
let activeSectionKey = '';
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let requestVersion = 0;
let afterSaleRequestVersion = 0;
let sectionRequestVersion = 0;

const OVERVIEW_CACHE_TTL = 3 * 60 * 1000;
const LOAD_DEBOUNCE_MS = 260;

const tablePagination = reactive<TablePaginationConfig>({
  current: 1,
  onChange: (page, pageSize) => {
    tablePagination.current = page;
    tablePagination.pageSize = pageSize;
  },
  onShowSizeChange: (_current, size) => {
    tablePagination.current = 1;
    tablePagination.pageSize = size;
  },
  pageSize: 20,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
});

const rangeOptions = [
  { label: '今日', value: 'today' },
  { label: '昨日', value: 'yesterday' },
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '本月', value: 'month' },
  { label: '自定义', value: 'custom' },
] as const;

const detailTabs = [
  { label: '每日明细', value: 'daily' },
  { label: '广告活动', value: 'ads' },
  { label: '库存明细', value: 'inventory' },
  { label: '利润费用', value: 'profit' },
  { label: '运营日志', value: 'logs' },
];

const moduleTabs = [
  { label: '概览', value: 'overview' },
  { label: '订单', value: 'order' },
  { label: '广告', value: 'ad' },
  { label: '子体对比', value: 'child' },
  { label: '库存', value: 'inventory' },
  { label: '利润', value: 'profit' },
  { label: '售后', value: 'afterSale' },
];

const dayWeekMonthOptions = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
];

const hourDayWeekMonthOptions = [
  { label: '小时', value: 'hour' },
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
];

const orderTimeOptions = [
  { label: '天', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '总', value: 'total' },
];

function rangeParams() {
  const today = dayjs();
  if (rangePreset.value === 'today') {
    const date = today.format('YYYY-MM-DD');
    return { endDate: date, startDate: date };
  }
  if (rangePreset.value === 'yesterday') {
    const date = today.subtract(1, 'day').format('YYYY-MM-DD');
    return { endDate: date, startDate: date };
  }
  if (rangePreset.value === '7d') {
    return {
      endDate: today.format('YYYY-MM-DD'),
      startDate: today.subtract(6, 'day').format('YYYY-MM-DD'),
    };
  }
  if (rangePreset.value === 'month') {
    return {
      endDate: today.format('YYYY-MM-DD'),
      startDate: today.startOf('month').format('YYYY-MM-DD'),
    };
  }
  if (rangePreset.value === 'custom' && customRange.value) {
    return {
      endDate: customRange.value[1],
      startDate: customRange.value[0],
    };
  }
  return {
    endDate: today.format('YYYY-MM-DD'),
    startDate: today.subtract(29, 'day').format('YYYY-MM-DD'),
  };
}

function parseList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function overviewParams() {
  return {
    ...rangeParams(),
    parent_ASIN: parseList(parentAsinInput.value).join(','),
    sids: parseList(sidInput.value),
  };
}

function overviewRequestKey(params: ReturnType<typeof overviewParams>) {
  return JSON.stringify({
    endDate: params.endDate,
    parent_ASIN: params.parent_ASIN,
    sids: [...params.sids].toSorted(),
    startDate: params.startDate,
  });
}

function afterSaleDateSummaryType() {
  const map: Record<string, string> = {
    day: '1',
    month: '3',
    week: '2',
  };
  return map[afterSaleTimeDim.value] ?? '1';
}

function afterSaleParams() {
  return {
    ...rangeParams(),
    dateSummaryType: afterSaleDateSummaryType(),
    dateType: afterSaleDateKind.value === 'order' ? 'purchase' : 'return',
    kind: afterSaleKind.value,
    parent_ASIN: parseList(parentAsinInput.value).join(','),
    section: 'after-sale',
    sids: parseList(sidInput.value),
  };
}

function afterSaleRequestKey(params: ReturnType<typeof afterSaleParams>) {
  return JSON.stringify({
    dateSummaryType: params.dateSummaryType,
    dateType: params.dateType,
    endDate: params.endDate,
    kind: params.kind,
    parent_ASIN: params.parent_ASIN,
    sids: [...params.sids].toSorted(),
    startDate: params.startDate,
  });
}

function sectionForModule(name: DetailTab | ModuleTab) {
  const map: Partial<Record<DetailTab | ModuleTab, string>> = {
    ad: 'ad',
    ads: 'ad',
    child: 'sub-asin',
    inventory: 'inventory',
    logs: 'logs',
    order: 'order-analysis',
    profit: 'profit',
  };
  return map[name];
}

function sectionParams(section: string) {
  return {
    ...overviewParams(),
    section,
  };
}

function sectionRequestKey(params: ReturnType<typeof sectionParams>) {
  return JSON.stringify({
    endDate: params.endDate,
    parent_ASIN: params.parent_ASIN,
    section: params.section,
    sids: [...params.sids].toSorted(),
    startDate: params.startDate,
  });
}

function scheduleActiveDataLoad() {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = setTimeout(() => {
    if (moduleTab.value === 'afterSale' && currentItem.value) {
      void loadAfterSaleData();
      return;
    }
    void refreshData();
  }, LOAD_DEBOUNCE_MS);
}

function isAbortError(error: unknown) {
  const err = error as { code?: string; message?: string; name?: string };
  return (
    err?.code === 'ERR_CANCELED' ||
    err?.name === 'AbortError' ||
    err?.name === 'CanceledError' ||
    String(err?.message || '')
      .toLowerCase()
      .includes('canceled')
  );
}

async function loadData(options?: { force?: boolean }) {
  const parents = parseList(parentAsinInput.value);
  if (parents.length === 0) return;
  const params = overviewParams();
  const requestKey = overviewRequestKey(params);
  const cached = overviewCache.get(requestKey);
  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    overview.value = cached.data;
    tablePagination.current = 1;
    return;
  }
  if (activeRequestKey === requestKey && loading.value) return;

  activeRequestController?.abort();
  activeRequestController = new AbortController();
  activeRequestKey = requestKey;
  const currentVersion = ++requestVersion;
  loading.value = true;
  tablePagination.current = 1;
  try {
    const data = await fetchAsin360Overview(
      params,
      activeRequestController.signal,
    );
    if (currentVersion !== requestVersion) return;
    overview.value = data;
    afterSaleRemoteAnalysis.value = null;
    overviewCache.set(requestKey, {
      data,
      expiresAt: Date.now() + OVERVIEW_CACHE_TTL,
    });
  } catch (error) {
    if (!isAbortError(error)) {
      console.error(error);
    }
  } finally {
    if (currentVersion === requestVersion) {
      loading.value = false;
      activeRequestController = null;
      activeRequestKey = '';
    }
  }
}

async function refreshData() {
  if (moduleTab.value === 'afterSale' && currentItem.value) {
    await loadAfterSaleData();
    return;
  }
  await loadData({ force: true });
  await loadModuleData(moduleTab.value, { force: true });
}

async function loadModuleData(
  name: DetailTab | ModuleTab,
  options?: { force?: boolean },
) {
  const section = sectionForModule(name);
  if (!section || !currentItem.value) return;
  const params = sectionParams(section);
  if (!params.parent_ASIN) return;
  const requestKey = sectionRequestKey(params);
  const cached = sectionCache.get(requestKey);
  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    Object.assign(currentItem.value, cached.data);
    return;
  }
  if (activeSectionKey === requestKey) return;

  activeSectionController?.abort();
  activeSectionController = new AbortController();
  activeSectionKey = requestKey;
  const currentVersion = ++sectionRequestVersion;
  try {
    const data = await fetchAsin360Section(
      params,
      activeSectionController.signal,
    );
    if (currentVersion !== sectionRequestVersion) return;
    const firstItem = Array.isArray(data.items) ? data.items[0] : null;
    const patch = firstItem?.data ?? {};
    Object.assign(currentItem.value, patch);
    sectionCache.set(requestKey, {
      data: patch,
      expiresAt: Date.now() + OVERVIEW_CACHE_TTL,
    });
  } catch (error) {
    if (!isAbortError(error)) {
      console.error(error);
    }
  } finally {
    if (currentVersion === sectionRequestVersion) {
      activeSectionController = null;
      activeSectionKey = '';
    }
  }
}

async function loadAfterSaleData() {
  if (!currentItem.value) return;
  const params = afterSaleParams();
  if (!params.parent_ASIN) return;
  const requestKey = afterSaleRequestKey(params);
  if (activeAfterSaleKey === requestKey && afterSaleLoading.value) return;

  activeAfterSaleController?.abort();
  activeAfterSaleController = new AbortController();
  activeAfterSaleKey = requestKey;
  const currentVersion = ++afterSaleRequestVersion;
  afterSaleLoading.value = true;
  try {
    const data = await fetchAsin360Section(
      params,
      activeAfterSaleController.signal,
    );
    if (currentVersion !== afterSaleRequestVersion) return;
    const firstItem = Array.isArray(data.items) ? data.items[0] : null;
    afterSaleRemoteAnalysis.value = {
      ...afterSaleAnalysis.value,
      ...firstItem?.data,
    };
  } catch (error) {
    if (!isAbortError(error)) {
      console.error(error);
    }
  } finally {
    if (currentVersion === afterSaleRequestVersion) {
      afterSaleLoading.value = false;
      activeAfterSaleController = null;
      activeAfterSaleKey = '';
    }
  }
}

const items = computed(() => overview.value?.items ?? []);
const currentItem = computed<Asin360Item | null>(() => items.value[0] ?? null);
const product = computed<Asin360Product | null>(
  () => currentItem.value?.product ?? null,
);
const latestRows = computed(() => currentItem.value?.asinAllRows ?? []);
const overviewDailyRows = computed(() =>
  [...latestRows.value].toSorted(
    (a, b) =>
      String(b.metricDate || '').localeCompare(String(a.metricDate || '')) ||
      String(a.asin || '').localeCompare(String(b.asin || '')),
  ),
);
const logRows = computed(() => currentItem.value?.briefLogRows ?? []);
const errors = computed(() => currentItem.value?.errors ?? []);
const orderAnalysis = computed(() => currentItem.value?.orderAnalysis ?? {});
const inventoryAnalysis = computed(
  () => currentItem.value?.inventoryAnalysis ?? {},
);
const profitAnalysis = computed(() => currentItem.value?.profitAnalysis ?? {});
const afterSaleAnalysis = computed(
  () =>
    afterSaleRemoteAnalysis.value ?? currentItem.value?.afterSaleAnalysis ?? {},
);
const subAsinRows = computed(() => currentItem.value?.subAsinRows ?? []);

const productTitle = computed(() => {
  const detail = product.value;
  return (
    detail?.title || detail?.productNames?.[0] || detail?.itemNames?.[0] || '-'
  );
});

const shopText = computed(() => {
  const detail = product.value;
  const countries = detail?.countryCodes?.join('/') || '美国';
  return `${detail?.realnames?.[0] || 'RSLOVE-US'}(${countries})`;
});

const metricCards = computed<MetricCard[]>(() => {
  const rows = latestRows.value;
  const sum = (key: keyof Asin360AsinAllRow) =>
    rows.reduce((total, row) => total + Number(row[key] || 0), 0);
  const avg = (key: keyof Asin360AsinAllRow) =>
    rows.length > 0
      ? rows.reduce((total, row) => total + Number(row[key] || 0), 0) /
        rows.length
      : 0;
  const stock = inventoryAnalysis.value?.stocks?.summary ?? {};
  const profit = profitAnalysis.value?.summary ?? {};
  const afterSale = afterSaleAnalysis.value?.summary ?? {};

  return [
    {
      key: 'salesQty',
      label: '销量',
      sub: '按日期汇总',
      value: formatInteger(sum('totalSalesQty')),
    },
    {
      key: 'salesAmount',
      label: '销售额',
      sub: '订单销售',
      value: formatMoney(sum('salesAmount')),
    },
    {
      key: 'adSpend',
      label: '广告花费',
      sub: 'SP/SB/SD',
      value: formatMoney(sum('adSpend')),
    },
    {
      key: 'acos',
      label: 'ACOS',
      sub: '算术平均',
      value: formatPercent(avg('acos')),
    },
    {
      key: 'cvr',
      label: 'CVR',
      sub: '算术平均',
      value: formatPercent(avg('cvr')),
    },
    {
      key: 'fbaStock',
      label: 'FBA可售',
      sub: '库存模块',
      value: formatInteger(stock.fbaAvailable ?? product.value?.fbaStock),
    },
    {
      key: 'profit',
      label: '毛利',
      sub: '利润模块',
      value: formatMoney(profit.grossProfit),
    },
    {
      key: 'return',
      label: '退货量',
      sub: '售后模块',
      value: formatInteger(
        (afterSale.usableReturnVolume || 0) +
          (afterSale.unusableReturnVolume || 0),
      ),
    },
  ];
});

function showModule(name: ModuleTab) {
  return moduleTab.value === name;
}

async function scrollToSection(id: string) {
  await nextTick();
  const target = document.querySelector<HTMLElement>(`#${id}`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openModuleSection(name: ModuleTab, sectionId?: string) {
  moduleTab.value = name;
  if (name === 'afterSale') {
    if (!afterSaleRemoteAnalysis.value && currentItem.value) {
      await loadAfterSaleData();
    }
  } else {
    await loadModuleData(name, { force: false });
  }
  if (sectionId) {
    await scrollToSection(sectionId);
  }
}

async function openDetailSection(tab: DetailTab = 'daily') {
  detailTab.value = tab;
  await loadModuleData(tab, { force: false });
  await scrollToSection('detail');
}

function metricLabel(key: string) {
  const labels: Record<string, string> = {
    acos: 'ACOS',
    adSpend: '广告花费',
    clicks: '点击',
    cvr: 'CVR',
    impressions: '曝光',
    orders: '订单量',
    profit: '利润',
    roas: 'ROAS',
    salesAmount: '销售额',
    totalSalesQty: '销量',
  };
  return labels[key] ?? key;
}

function metricValue(row: Record<string, any>, key: string) {
  if (key === 'orders') return Number(row.orders ?? row.totalSalesQty ?? 0);
  if (key === 'roas') return Number(row.roas ?? 0);
  return Number(row[key] ?? 0);
}

function metricField(key: string) {
  if (key === 'orders') return 'volume';
  if (key === 'totalSalesQty') return 'volume';
  return 'amount';
}

function bucketLabel(dateText: string, dim: TimeDim) {
  const d = dayjs(dateText);
  if (!d.isValid()) return dateText || '-';
  if (dim === 'month') return d.format('YYYY-MM');
  if (dim === 'week') return `${d.startOf('week').format('MM-DD')}周`;
  if (dim === 'total') return '总计';
  return d.format('YYYY-MM-DD');
}

function aggregateDailyRows(
  rows: Asin360AsinAllRow[],
  dim: TimeDim,
): Array<Record<string, any>> {
  if (dim === 'hour') {
    return rows.map((row) => ({ ...row, label: row.metricDate }));
  }
  const buckets = new Map<string, Record<string, any>>();
  for (const row of rows) {
    const label = bucketLabel(row.metricDate, dim);
    const target = buckets.get(label) ?? {
      acos: 0,
      adSpend: 0,
      clicks: 0,
      cvr: 0,
      impressions: 0,
      label,
      profit: 0,
      roas: 0,
      salesAmount: 0,
      totalSalesQty: 0,
      count: 0,
    };
    target.totalSalesQty += Number(row.totalSalesQty || 0);
    target.salesAmount += Number(row.salesAmount || 0);
    target.adSpend += Number(row.adSpend || 0);
    target.profit += Number(row.profit || 0);
    target.impressions += Number(row.impressions || 0);
    target.clicks += Number(row.clicks || 0);
    target.acos += Number(row.acos || 0);
    target.cvr += Number(row.cvr || 0);
    target.roas += Number(row.roas || 0);
    target.count += 1;
    buckets.set(label, target);
  }
  return [...buckets.values()].map((row) => ({
    ...row,
    acos: row.count ? row.acos / row.count : 0,
    cvr: row.count ? row.cvr / row.count : 0,
    roas: row.count ? row.roas / row.count : 0,
  }));
}

function lineBarOption(
  labels: string[],
  series: Array<{
    data: number[];
    name: string;
    type?: 'bar' | 'line';
    yAxisIndex?: number;
  }>,
  colors = ['#2878ff', '#12a150', '#f59e0b'],
) {
  return {
    color: colors,
    grid: { bottom: 28, left: 46, right: 38, top: 36 },
    legend: { top: 0 },
    series: series.map((item) => ({
      barMaxWidth: 24,
      smooth: item.type !== 'bar',
      type: item.type ?? 'line',
      ...item,
    })),
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { interval: 0, rotate: labels.length > 10 ? 30 : 0 },
      axisTick: { show: false },
      data: labels,
      type: 'category',
    },
    yAxis: [
      { splitLine: { lineStyle: { color: '#eef1f5' } }, type: 'value' },
      {
        axisLabel: { formatter: '{value}%' },
        splitLine: { show: false },
        type: 'value',
      },
    ],
  };
}

const trendOption = computed(() => {
  const rows = aggregateDailyRows(
    [...latestRows.value].toReversed(),
    overviewTimeDim.value,
  );
  const labels = rows.map((row) => row.label);
  if (overviewChartMode.value === 'compare') {
    return lineBarOption(labels, [
      {
        data: rows.map((row) => metricValue(row, 'totalSalesQty')),
        name: '销量',
        type: 'bar',
      },
      {
        data: rows.map((row) => metricValue(row, 'salesAmount')),
        name: '销售额',
        type: 'bar',
      },
      {
        data: rows.map((row) => metricValue(row, 'adSpend')),
        name: '广告花费',
        type: 'bar',
      },
    ]);
  }
  const timeName = overviewCompareMode.value === 'time' ? '本期' : '';
  return lineBarOption(labels, [
    {
      data: rows.map((row) => metricValue(row, 'totalSalesQty')),
      name: `${timeName}销量`,
    },
    {
      data: rows.map((row) => metricValue(row, 'salesAmount')),
      name: `${timeName}销售额`,
    },
    {
      data: rows.map((row) => Number(row.acos || 0) * 100),
      name: `${timeName}ACOS`,
      yAxisIndex: 1,
    },
  ]);
});

const comparePeriodLabels = computed(() => {
  const start = dayjs(overview.value?.query.startDate);
  const end = dayjs(overview.value?.query.endDate);
  if (!start.isValid() || !end.isValid()) {
    return {
      current: '本期',
      previous: '环比期',
      yoy: '同比期',
    };
  }
  const days = Math.max(end.diff(start, 'day') + 1, 1);
  const previousEnd = start.subtract(1, 'day');
  const previousStart = previousEnd.subtract(days - 1, 'day');
  return {
    current: `本期(${start.format('YYYY-MM-DD')}~${end.format('YYYY-MM-DD')})`,
    previous: `环比(${previousStart.format('YYYY-MM-DD')}~${previousEnd.format('YYYY-MM-DD')})`,
    yoy: `同比(${start.subtract(1, 'year').format('YYYY-MM-DD')}~${end.subtract(1, 'year').format('YYYY-MM-DD')})`,
  };
});

function previousByRatio(value: number, ratio?: number) {
  const r = Number(ratio ?? 0);
  if (!Number.isFinite(r) || r <= -0.9999) return 0;
  return value / (1 + r);
}

function periodValue(
  rows: Asin360AsinAllRow[],
  valueKey: keyof Asin360AsinAllRow,
  ratioKey: keyof Asin360AsinAllRow,
) {
  let total = 0;
  for (const row of rows) {
    const value = Number(row[valueKey] || 0);
    total += previousByRatio(value, Number(row[ratioKey] ?? 0));
  }
  return total;
}

function compareRate(current: number, base: number) {
  if (!base) return 0;
  return (current - base) / base;
}

const overviewCompareRows = computed(() => {
  const rows = latestRows.value;
  const defs: CompareMetricDef[] = [
    {
      key: 'volume',
      label: '销量',
      money: false,
      ratioChain: 'volumeChainRatio',
      ratioYoy: 'volumeYoyRatio',
      valueKey: 'totalSalesQty',
    },
    {
      key: 'orders',
      label: '订单量',
      money: false,
      ratioChain: 'orderChainRatio',
      ratioYoy: 'orderYoyRatio',
      valueKey: 'orderQty',
    },
    {
      key: 'sales',
      label: '销售额',
      money: true,
      ratioChain: 'amountChainRatio',
      ratioYoy: 'amountYoyRatio',
      valueKey: 'salesAmount',
    },
    {
      key: 'adSales',
      label: '广告销售额',
      money: true,
      valueKey: 'adSalesAmount',
    },
    {
      key: 'adSpend',
      label: '广告花费',
      money: true,
      valueKey: 'adSpend',
    },
    {
      key: 'profit',
      label: '利润',
      money: true,
      valueKey: 'profit',
    },
    {
      key: 'acos',
      label: 'ACOS',
      percentValue: true,
      valueKey: 'acos',
    },
  ];

  return defs.map((def) => {
    const current =
      def.key === 'acos'
        ? (rows.length > 0
          ? rows.reduce((sum, row) => sum + Number(row.acos || 0), 0) /
            rows.length
          : 0)
        : rows.reduce((sum, row) => sum + Number(row[def.valueKey] || 0), 0);
    const previous = def.ratioChain
      ? periodValue(rows, def.valueKey, def.ratioChain)
      : 0;
    const yoy = def.ratioYoy
      ? periodValue(rows, def.valueKey, def.ratioYoy)
      : 0;
    return {
      current,
      growth: compareRate(current, previous),
      label: def.label,
      money: def.money,
      percentValue: def.percentValue,
      previous,
      previousChange: current - previous,
      yoy,
      yoyChange: current - yoy,
      yoyGrowth: compareRate(current, yoy),
    };
  });
});

const adEffectOption = computed(() => {
  const rows = aggregateDailyRows(
    [...latestRows.value].toReversed(),
    adTimeDim.value,
  );
  const metric = adEfficiencyMetric.value;
  return lineBarOption(
    rows.map((row) => row.label),
    [
      { data: rows.map((row) => row.adSpend), name: '广告花费', type: 'bar' },
      { data: rows.map((row) => row.salesAmount), name: '销售额', type: 'bar' },
      {
        data: rows.map((row) =>
          metric === 'acos' ? row.acos * 100 : row.roas,
        ),
        name: metricLabel(metric),
        yAxisIndex: metric === 'acos' ? 1 : 0,
      },
    ],
    ['#50b7f5', '#8bd86b', '#ff8a4c'],
  );
});

const adTrafficOption = computed(() => {
  const rows = aggregateDailyRows(
    [...latestRows.value].toReversed(),
    adTrafficTimeDim.value,
  );
  return lineBarOption(
    rows.map((row) => row.label),
    [
      { data: rows.map((row) => row.impressions), name: '曝光', type: 'bar' },
      { data: rows.map((row) => row.clicks), name: '点击', type: 'bar' },
      {
        data: rows.map((row) =>
          row.clicks && row.impressions
            ? (row.clicks / row.impressions) * 100
            : 0,
        ),
        name: 'CTR',
        yAxisIndex: 1,
      },
    ],
    ['#50b7f5', '#8bd86b', '#ff8a4c'],
  );
});

const childDistributionOption = computed(() => {
  const rows = subAsinRows.value.slice(0, 12);
  return {
    color: [
      '#50b7f5',
      '#fb7f9d',
      '#8bd86b',
      '#a477f4',
      '#facc15',
      '#fb9a64',
      '#45d0ca',
    ],
    series: [
      {
        data: rows.map((row: any) => ({
          name: row.asin || row.name,
          value: Number(row[childMetric.value] || row.salesVolume || 0),
        })),
        label: { formatter: '{b}\n{d}%' },
        radius: ['48%', '72%'],
        type: 'pie',
      },
    ],
    tooltip: { trigger: 'item' },
  };
});

const afterSaleTrendOption = computed(() => {
  const rows =
    afterSaleKind.value === 'refund'
      ? (afterSaleAnalysis.value?.refundTrendRows ?? [])
      : (afterSaleAnalysis.value?.returnTrendRows ?? []);
  const normalized =
    rows.length > 0
      ? rows.map((row: any) => ({
          label: row.date || row.metricDate || row.day || row.time || '',
          qty: Number(
            row.return_volume ||
              row.refund_volume ||
              row.volume ||
              row.qty ||
              0,
          ),
          rate: Number(row.return_rate || row.refund_rate || row.rate || 0),
        }))
      : aggregateDailyRows(
          [...latestRows.value].toReversed(),
          afterSaleTimeDim.value,
        ).map((row) => ({
          label: row.label,
          qty: 0,
          rate: 0,
        }));
  return lineBarOption(
    normalized.map((row: any) => row.label),
    [
      {
        data: normalized.map((row: any) => row.qty),
        name: afterSaleKind.value === 'refund' ? '退款量' : '退货量',
        type: 'bar',
      },
      {
        data: normalized.map((row: any) => row.rate * 100),
        name: afterSaleKind.value === 'refund' ? '退款率' : '退货率',
        yAxisIndex: 1,
      },
    ],
    ['#50b7f5', '#fb7f9d'],
  );
});

const afterSaleAsinRows = computed(() => {
  const key =
    afterSaleKind.value === 'refund' ? 'refundAsinRows' : 'returnAsinRows';
  const rows =
    afterSaleAnalysis.value?.[key] ??
    afterSaleAnalysis.value?.asinDistributionRows ??
    [];
  if (rows.length > 0) return rows;
  const total = subAsinRows.value.reduce(
    (sum: number, row: any) => sum + Number(row.salesVolume || 0),
    0,
  );
  return subAsinRows.value.slice(0, 10).map((row: any) => ({
    asin: row.asin || row.name,
    imageUrl: row.imageUrl || row.smallImageUrl,
    productName: row.productName || row.name || '-',
    quantity: Number(row.salesVolume || 0),
    ratio: total ? Number(row.salesVolume || 0) / total : 0,
    sku: row.sku || row.localSku || '',
    variant: row.variant || row.variantAttribute || '-',
  }));
});

const afterSaleAsinOption = computed(() => ({
  color: [
    '#50b7f5',
    '#fb7f9d',
    '#8bd86b',
    '#a477f4',
    '#facc15',
    '#fb9a64',
    '#45d0ca',
  ],
  series: [
    {
      data: afterSaleAsinRows.value.slice(0, 12).map((row: any) => ({
        name: row.asin || row.name,
        value: Number(row.quantity || 0),
      })),
      label: { formatter: '{b}\n{d}%' },
      radius: ['48%', '72%'],
      type: 'pie',
    },
  ],
  tooltip: { trigger: 'item' },
}));

const hourlyOption = computed(() => {
  if (orderTimeDim.value === 'hour') {
    const rows = orderAnalysis.value?.hourlyRows ?? [];
    return basicBarOption(
      rows.map((row: any) => `${row.hour}:00`),
      rows.map((row: any) =>
        Number(row[metricField(orderMetric.value)] || row.volume || 0),
      ),
      `${orderChannel.value === 'ad' ? '广告' : '促销'}${metricLabel(orderMetric.value)}`,
    );
  }
  const rows = aggregateDailyRows(
    [...latestRows.value].toReversed(),
    orderTimeDim.value,
  );
  return basicBarOption(
    rows.map((row) => row.label),
    rows.map((row) => metricValue(row, orderMetric.value)),
    `${orderChannel.value === 'ad' ? '广告' : '促销'}${metricLabel(orderMetric.value)}`,
  );
});

const regionOption = computed(() => {
  const rows = orderAnalysis.value?.regionRows ?? [];
  const field = metricField(orderMetric.value);
  return basicBarOption(
    rows.slice(0, 10).map((row: any) => row.region),
    rows.slice(0, 10).map((row: any) => Number(row[field] || 0)),
    `区域${metricLabel(orderMetric.value)}`,
  );
});

const inventorySummaryCards = computed(() => {
  const summary = inventoryAnalysis.value?.stocks?.summary ?? {};
  if (inventoryUnit.value === 'amount') {
    const totalCost = Number(summary.totalCost || 0);
    const fbaRate = Number(summary.fbaNumRate || 0);
    const localRate = Number(summary.localNumRate || 0);
    return [
      { label: '总货值', value: formatMoney(totalCost) },
      { label: 'FBA货值', value: formatMoney(totalCost * fbaRate) },
      { label: '本地货值', value: formatMoney(totalCost * localRate) },
      { label: '币种', value: summary.currencyIcon || '$' },
    ];
  }
  return [
    { label: '总库存', value: formatInteger(summary.totalNum) },
    { label: 'FBA可售', value: formatInteger(summary.fbaAvailable) },
    { label: 'FBA在途', value: formatInteger(summary.fbaInbound) },
    { label: '本地库存', value: formatInteger(summary.localTotal) },
  ];
});

const storageAgeRows = computed(() => {
  const rows = inventoryAnalysis.value?.storageAge?.summaryRows ?? [];
  const byType = new Map(rows.map((row: any) => [row.type, row]));
  const fba = (byType.get('FBA库存') ?? {}) as Record<string, any>;
  const fbm = (byType.get('FBM库存') ?? {}) as Record<string, any>;
  const local = (byType.get('本地库存') ?? {}) as Record<string, any>;
  return [
    {
      key: 'age90',
      label: '0-90',
      fba: fba.age90,
      fbm: fbm.age90,
      local: local.age90,
    },
    {
      key: 'age180',
      label: '91-180',
      fba: fba.age180,
      fbm: fbm.age180,
      local: local.age180,
    },
    {
      key: 'age270',
      label: '181-270',
      fba: fba.age270,
      fbm: fbm.age270,
      local: local.age270,
    },
    {
      key: 'age365',
      label: '271-365',
      fba: fba.age365,
      fbm: fbm.age365,
      local: local.age365,
    },
    {
      key: 'age365plus',
      label: '365+',
      fba: fba.age365plus,
      fbm: fbm.age365plus,
      local: local.age365plus,
    },
  ].map((row) => ({
    ...row,
    total: Number(row.fba || 0) + Number(row.fbm || 0) + Number(row.local || 0),
  }));
});

const storageAgeOption = computed(() => {
  const rows = storageAgeRows.value;
  return lineBarOption(
    rows.map((row) => row.label),
    [
      {
        data: rows.map((row) => Number(row.fba || 0)),
        name: 'FBA仓',
        type: 'bar',
      },
      {
        data: rows.map((row) => Number(row.local || 0)),
        name: '本地仓',
        type: 'bar',
      },
      {
        data: rows.map((row) => Number(row.fbm || 0)),
        name: '海外仓',
        type: 'bar',
      },
    ],
    ['#4db3f5', '#f77f9a', '#8bd66d'],
  );
});

const shipmentRows = computed(
  () => inventoryAnalysis.value?.shipment?.rows ?? [],
);

const profitCostRows = computed(() => {
  const summary = profitAnalysis.value?.summary ?? {};
  const totalSales = Number(summary.totalSalesAmount || 0);
  const rows = [
    {
      name: '销售额',
      type: '收入',
      value: Number(summary.totalSalesAmount || 0),
    },
    { name: '平台收入', type: '收入', value: Number(summary.totalIncome || 0) },
    ...(profitAnalysis.value?.feeRows ?? []).map((row: any) => ({
      name: row.name,
      type: '成本费用',
      value: -Math.abs(Number(row.value || 0)),
    })),
    { name: '毛利', type: '结果', value: Number(summary.grossProfit || 0) },
  ].filter((row) => row.value !== 0);
  return rows.map((row) => ({
    ...row,
    ratio: totalSales ? row.value / totalSales : 0,
  }));
});

const profitCostOption = computed(() => {
  const summary = profitAnalysis.value?.summary ?? {};
  const sankeySummary = {
    grossProfit: Math.abs(Number(summary.grossProfit || 0)),
    totalExpense: Math.abs(Number(summary.totalExpense || 0)),
    totalIncome: Math.abs(Number(summary.totalIncome || 0)),
    totalSalesAmount: Math.abs(Number(summary.totalSalesAmount || 0)),
  };
  const feeRows = (profitAnalysis.value?.feeRows ?? [])
    .map((row: any) => ({
      name: row.name,
      value: Math.abs(Number(row.value || 0)),
    }))
    .filter((row: { name: string; value: number }) => row.value > 0);

  if (profitView.value === 'flow') {
    const feeTotal = feeRows.reduce(
      (total: number, row: { name: string; value: number }) =>
        total + row.value,
      0,
    );
    const settlementCut = Math.max(
      sankeySummary.totalSalesAmount - sankeySummary.totalIncome,
      0,
    );
    const remainingExpense = Math.max(sankeySummary.totalExpense - feeTotal, 0);
    const nodes = new Map<
      string,
      { itemStyle?: { color: string }; name: string }
    >();
    const links: Array<{ source: string; target: string; value: number }> = [];
    const palette: Record<string, string> = {
      销售额: '#2878ff',
      结算收入: '#0f9f6e',
      '平台扣减/退款': '#f59e0b',
      总费用: '#ef4444',
      毛利: '#16a34a',
      亏损: '#dc2626',
      其他费用: '#8b5cf6',
      FBA配送费: '#38bdf8',
      平台佣金: '#f97316',
      广告费: '#ef4444',
      采购成本: '#14b8a6',
      仓储费: '#a855f7',
      促销费: '#eab308',
    };
    const addNode = (name: string) => {
      if (!nodes.has(name)) {
        nodes.set(name, {
          itemStyle: { color: palette[name] ?? '#64748b' },
          name,
        });
      }
    };
    const addLink = (source: string, target: string, value: number) => {
      if (value > 0) {
        addNode(source);
        addNode(target);
        links.push({ source, target, value });
      }
    };

    addLink('销售额', '结算收入', sankeySummary.totalIncome);
    addLink('销售额', '平台扣减/退款', settlementCut);
    if (sankeySummary.totalIncome > 0) {
      addLink('结算收入', '总费用', sankeySummary.totalExpense);
      if (sankeySummary.grossProfit > 0) {
        addLink('结算收入', '毛利', sankeySummary.grossProfit);
      } else {
        addLink('结算收入', '亏损', Math.abs(Number(summary.grossProfit || 0)));
      }
    }
    if (sankeySummary.totalExpense > 0) {
      for (const row of feeRows) {
        addLink('总费用', row.name, row.value);
      }
      addLink('总费用', '其他费用', remainingExpense);
    }

    return {
      color: Object.values(palette),
      tooltip: {
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            return `${params.data.source} → ${params.data.target}<br/>${formatMoney(
              params.data.value,
            )}`;
          }
          return `${params.name}<br/>${formatMoney(params.value)}`;
        },
      },
      series: [
        {
          data: [...nodes.values()],
          emphasis: { focus: 'adjacency' },
          label: {
            color: '#334155',
            fontSize: 12,
          },
          lineStyle: {
            color: 'source',
            curveness: 0.5,
            opacity: 0.35,
          },
          links,
          nodeAlign: 'justify',
          nodeGap: 16,
          nodeWidth: 20,
          type: 'sankey',
        },
      ],
    };
  }

  const rows = profitCostRows.value.slice(0, 10);
  const chartRows = [...rows]
    .toSorted((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .map((row) => ({ ...row, value: Math.abs(row.value) }));
  return {
    color: ['#2878ff', '#16a34a', '#ef4444'],
    grid: { bottom: 42, left: 54, right: 16, top: 28 },
    series: [
      {
        barMaxWidth: 28,
        data: chartRows.map((row) => ({
          value: row.value,
          itemStyle: {
            color:
              row.type === '结果'
                ? '#16a34a'
                : (row.type === '成本费用'
                  ? '#ef4444'
                  : '#2878ff'),
          },
        })),
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { interval: 0, rotate: 26 },
      data: chartRows.map((row) => row.name),
      type: 'category',
    },
    yAxis: { splitLine: { lineStyle: { color: '#eef1f5' } }, type: 'value' },
  };
});

const profitBreakdownOption = computed(() => {
  const rows = (profitAnalysis.value?.feeRows ?? []).map((row: any) => ({
    name: row.name,
    value: Math.abs(Number(row.value || 0)),
  }));
  return {
    color: ['#2878ff', '#12a150', '#f59e0b', '#ef4444', '#7c3aed', '#0891b2'],
    legend: {
      bottom: 0,
      left: 'center',
      type: 'scroll',
    },
    series: [
      {
        data: rows,
        label: {
          formatter: '{b}\n{d}%',
        },
        radius: ['42%', '70%'],
        type: 'pie',
      },
    ],
    tooltip: {
      trigger: 'item',
      valueFormatter: (value: number) => formatMoney(value),
    },
  };
});

const afterSaleOption = computed(() => {
  const rows = afterSaleAnalysis.value?.reasonRows ?? [];
  return {
    color: ['#2878ff', '#12a150', '#f59e0b', '#ef4444', '#7c3aed', '#0891b2'],
    series: [
      {
        data: rows
          .slice(0, 8)
          .map((row: any) => ({ name: row.reason, value: row.ratio })),
        radius: ['45%', '72%'],
        type: 'pie',
      },
    ],
    tooltip: { trigger: 'item' },
  };
});

const afterSaleReasonTrendOption = computed(() => {
  const rows = afterSaleAnalysis.value?.reasonTrendRows ?? [];
  const labels = [
    ...new Set(
      rows.flatMap((row: any) =>
        (row.points ?? []).map((point: any) => point.date).filter(Boolean),
      ),
    ),
  ].toSorted();
  const topRows = [...rows]
    .toSorted(
      (a: any, b: any) => Number(b.totalRatio || 0) - Number(a.totalRatio || 0),
    )
    .slice(0, 7);
  return {
    color: [
      '#3ba7ff',
      '#fb7f9d',
      '#8bd86b',
      '#a477f4',
      '#facc15',
      '#fb9a64',
      '#45d0ca',
    ],
    grid: { bottom: 58, left: 46, right: 42, top: 28 },
    legend: { bottom: 0, type: 'scroll' },
    series: topRows.map((row: any) => {
      const pointMap = new Map(
        (row.points ?? []).map((point: any) => [
          point.date,
          Number(point.ratio || 0),
        ]),
      );
      return {
        data: labels.map((label) => Number(pointMap.get(label) || 0) * 100),
        name: row.reason || '-',
        smooth: true,
        type: 'line',
      };
    }),
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => `${Number(value || 0).toFixed(2)}%`,
    },
    xAxis: {
      axisLabel: { interval: 0, rotate: labels.length > 10 ? 30 : 0 },
      axisTick: { show: false },
      data: labels,
      type: 'category',
    },
    yAxis: {
      axisLabel: { formatter: '{value}%' },
      max: 100,
      splitLine: { lineStyle: { color: '#eef1f5' } },
      type: 'value',
    },
  };
});

const returnOrderFeedbackRows = computed(
  () => afterSaleAnalysis.value?.returnOrderFeedbackRows ?? [],
);

function basicBarOption(labels: string[], values: number[], name: string) {
  return {
    color: ['#2878ff'],
    grid: { bottom: 24, left: 40, right: 16, top: 20 },
    series: [{ barMaxWidth: 22, data: values, name, type: 'bar' }],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { interval: 0, rotate: labels.length > 8 ? 30 : 0 },
      axisTick: { show: false },
      data: labels,
      type: 'category',
    },
    yAxis: { splitLine: { lineStyle: { color: '#eef1f5' } }, type: 'value' },
  };
}

const dailyColumns: TableColumnsType<Asin360AsinAllRow> = [
  { dataIndex: 'metricDate', fixed: 'left', title: '日期', width: 112 },
  { dataIndex: 'asin', fixed: 'left', title: 'ASIN', width: 140 },
  { dataIndex: 'totalSalesQty', title: '销量', width: 82 },
  { dataIndex: 'salesAmount', title: '销售额', width: 104 },
  { dataIndex: 'adSpend', title: '广告花费', width: 104 },
  { dataIndex: 'adSalesAmount', title: '广告销售额', width: 116 },
  { dataIndex: 'sessions', title: 'Sessions', width: 104 },
  { dataIndex: 'clicks', title: '点击', width: 88 },
  { dataIndex: 'cvr', title: 'CVR', width: 82 },
  { dataIndex: 'acos', title: 'ACOS', width: 86 },
  { dataIndex: 'tacos', title: 'TACOS', width: 86 },
  { dataIndex: 'roas', title: 'ROAS', width: 86 },
  { dataIndex: 'fbaStock', title: 'FBA可售', width: 98 },
  { dataIndex: 'inventoryDays', title: '库存天数', width: 104 },
];

const overviewDailyColumnConfigs: OverviewDailyColumnConfig[] = [
  {
    dataIndex: 'metricDate',
    fixed: 'left',
    format: 'text',
    key: 'metricDate',
    summary: 'none',
    title: '日期',
    width: 112,
  },
  {
    dataIndex: 'asin',
    fixed: 'left',
    format: 'text',
    key: 'asin',
    summary: 'none',
    title: 'ASIN',
    width: 140,
  },
  {
    align: 'right',
    dataIndex: 'totalSalesQty',
    format: 'integer',
    key: 'totalSalesQty',
    summary: 'sum',
    title: '销量',
    width: 92,
  },
  {
    align: 'right',
    dataIndex: 'orderQty',
    format: 'integer',
    key: 'orderQty',
    summary: 'sum',
    title: '订单量',
    width: 96,
  },
  {
    align: 'right',
    dataIndex: 'adSalesQty',
    format: 'integer',
    key: 'adSalesQty',
    summary: 'sum',
    title: '广告订单',
    width: 98,
  },
  {
    align: 'right',
    dataIndex: 'organicSalesQty',
    format: 'integer',
    key: 'organicSalesQty',
    summary: 'sum',
    title: '自然订单',
    width: 98,
  },
  {
    align: 'right',
    dataIndex: 'salesAmount',
    format: 'money',
    key: 'salesAmount',
    summary: 'sum',
    title: '销售额',
    width: 112,
  },
  {
    align: 'right',
    dataIndex: 'averageSellingPrice',
    format: 'money',
    key: 'averageSellingPrice',
    summary: 'avg',
    title: '客单价',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'adSpend',
    format: 'money',
    key: 'adSpend',
    summary: 'sum',
    title: '广告花费',
    width: 112,
  },
  {
    align: 'right',
    dataIndex: 'adSalesAmount',
    format: 'money',
    key: 'adSalesAmount',
    summary: 'sum',
    title: '广告销售额',
    width: 120,
  },
  {
    align: 'right',
    dataIndex: 'profit',
    format: 'money',
    key: 'profit',
    summary: 'sum',
    title: '毛利',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'sessions',
    format: 'integer',
    key: 'sessions',
    summary: 'sum',
    title: 'Sessions',
    width: 110,
  },
  {
    align: 'right',
    dataIndex: 'impressions',
    format: 'integer',
    key: 'impressions',
    summary: 'sum',
    title: '曝光',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'clicks',
    format: 'integer',
    key: 'clicks',
    summary: 'sum',
    title: '点击',
    width: 88,
  },
  {
    align: 'right',
    dataIndex: 'ctr',
    format: 'percent',
    key: 'ctr',
    summary: 'avg',
    title: 'CTR',
    width: 86,
  },
  {
    align: 'right',
    dataIndex: 'cvr',
    format: 'percent',
    key: 'cvr',
    summary: 'avg',
    title: 'CVR',
    width: 86,
  },
  {
    align: 'right',
    dataIndex: 'adCvr',
    format: 'percent',
    key: 'adCvr',
    summary: 'avg',
    title: '广告CVR',
    width: 96,
  },
  {
    align: 'right',
    dataIndex: 'acos',
    format: 'percent',
    key: 'acos',
    summary: 'avg',
    title: 'ACOS',
    width: 86,
  },
  {
    align: 'right',
    dataIndex: 'tacos',
    format: 'percent',
    key: 'tacos',
    summary: 'avg',
    title: 'TACOS',
    width: 86,
  },
  {
    align: 'right',
    dataIndex: 'roas',
    format: 'decimal',
    key: 'roas',
    summary: 'avg',
    title: 'ROAS',
    width: 86,
  },
  {
    align: 'right',
    dataIndex: 'cpc',
    format: 'money',
    key: 'cpc',
    summary: 'avg',
    title: 'CPC',
    width: 86,
  },
  {
    align: 'right',
    dataIndex: 'cpo',
    format: 'money',
    key: 'cpo',
    summary: 'avg',
    title: 'CPO',
    width: 86,
  },
  {
    align: 'right',
    dataIndex: 'cpu',
    format: 'money',
    key: 'cpu',
    summary: 'avg',
    title: 'CPU',
    width: 86,
  },
  {
    align: 'right',
    dataIndex: 'fbaStock',
    format: 'integer',
    key: 'fbaStock',
    summary: 'last',
    title: 'FBA可售',
    width: 100,
  },
  {
    align: 'right',
    dataIndex: 'fbaInbound',
    format: 'integer',
    key: 'fbaInbound',
    summary: 'sum',
    title: 'FBA在途',
    width: 100,
  },
  {
    align: 'right',
    dataIndex: 'inventoryDays',
    format: 'integer',
    key: 'inventoryDays',
    summary: 'last',
    title: '库存天数',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'budgetUtilization',
    format: 'percent',
    key: 'budgetUtilization',
    summary: 'avg',
    title: '预算占比',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'reviewCount',
    format: 'integer',
    key: 'reviewCount',
    summary: 'last',
    title: 'Review数',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'starRating',
    format: 'decimal',
    key: 'starRating',
    summary: 'last',
    title: '评分',
    width: 86,
  },
  {
    align: 'right',
    dataIndex: 'bsrMainRank',
    format: 'integer',
    key: 'bsrMainRank',
    summary: 'last',
    title: '主类排名',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'bsrSubRank',
    format: 'integer',
    key: 'bsrSubRank',
    summary: 'last',
    title: '子类排名',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'volumeChainRatio',
    format: 'percent',
    key: 'volumeChainRatio',
    summary: 'avg',
    title: '销量环比',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'volumeYoyRatio',
    format: 'percent',
    key: 'volumeYoyRatio',
    summary: 'avg',
    title: '销量同比',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'orderChainRatio',
    format: 'percent',
    key: 'orderChainRatio',
    summary: 'avg',
    title: '订单环比',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'orderYoyRatio',
    format: 'percent',
    key: 'orderYoyRatio',
    summary: 'avg',
    title: '订单同比',
    width: 104,
  },
  {
    align: 'right',
    dataIndex: 'amountChainRatio',
    format: 'percent',
    key: 'amountChainRatio',
    summary: 'avg',
    title: '销售额环比',
    width: 112,
  },
  {
    align: 'right',
    dataIndex: 'amountYoyRatio',
    format: 'percent',
    key: 'amountYoyRatio',
    summary: 'avg',
    title: '销售额同比',
    width: 112,
  },
];

const overviewDailyDefaultKeys = [
  'asin',
  'totalSalesQty',
  'salesAmount',
  'adSpend',
  'adSalesAmount',
  'sessions',
  'clicks',
  'cvr',
  'acos',
  'tacos',
  'roas',
  'fbaStock',
  'inventoryDays',
] as Array<keyof Asin360AsinAllRow>;
const overviewDailyVisibleKeys = ref<Array<keyof Asin360AsinAllRow>>([
  ...overviewDailyDefaultKeys,
]);
const overviewDailyColumnMap = new Map(
  overviewDailyColumnConfigs.map((item) => [item.key, item]),
);

const overviewDailyColumnOptions = computed(() =>
  overviewDailyColumnConfigs
    .filter((item) => item.key !== 'metricDate')
    .map((item) => ({ label: item.title, value: item.key })),
);

const overviewDailyColumns = computed<TableColumnsType<Asin360AsinAllRow>>(() =>
  overviewDailyColumnConfigs
    .filter(
      (item) =>
        item.key === 'metricDate' ||
        overviewDailyVisibleKeys.value.includes(item.key),
    )
    .map((item) => ({
      align: item.align,
      dataIndex: item.dataIndex,
      fixed: item.fixed,
      title: item.title,
      width: item.width,
    })),
);

const overviewDailyScrollX = computed(() =>
  Math.max(
    overviewDailyColumns.value.reduce(
      (total, column) => total + Number(column.width || 110),
      0,
    ),
    980,
  ),
);

const compareColumns = computed<TableColumnsType<any>>(() => [
  { dataIndex: 'label', fixed: 'left', title: '指标', width: 120 },
  {
    dataIndex: 'current',
    title: comparePeriodLabels.value.current,
    width: 170,
  },
  {
    dataIndex: 'previous',
    title: comparePeriodLabels.value.previous,
    width: 170,
  },
  { dataIndex: 'growth', title: '环比增长率', width: 120 },
  { dataIndex: 'previousChange', title: '环比变动值', width: 130 },
  { dataIndex: 'yoy', title: comparePeriodLabels.value.yoy, width: 170 },
  { dataIndex: 'yoyGrowth', title: '同比增长率', width: 120 },
  { dataIndex: 'yoyChange', title: '同比变动值', width: 130 },
]);

const adColumns: TableColumnsType<any> = [
  { dataIndex: 'name', fixed: 'left', title: '广告活动', width: 260 },
  { dataIndex: 'sponsored_type', title: '类型', width: 92 },
  { dataIndex: 'impressions', title: '曝光', width: 92 },
  { dataIndex: 'clicks', title: '点击', width: 82 },
  { dataIndex: 'spends', title: '花费', width: 96 },
  { dataIndex: 'sales', title: '销售额', width: 104 },
  { dataIndex: 'orders', title: '订单', width: 82 },
  { dataIndex: 'acos', title: 'ACOS', width: 86 },
  { dataIndex: 'roas', title: 'ROAS', width: 86 },
  { dataIndex: 'cvr', title: 'CVR', width: 86 },
];

const inventoryColumns: TableColumnsType<any> = [
  { dataIndex: 'msku', fixed: 'left', title: 'MSKU', width: 180 },
  { dataIndex: 'fnsku', title: 'FNSKU', width: 140 },
  { dataIndex: 'asin', title: 'ASIN', width: 140 },
  { dataIndex: 'quantity', title: '数量', width: 90 },
  { dataIndex: 'amount', title: '成本', width: 96 },
  { dataIndex: 'mname', title: '站点', width: 90 },
  { dataIndex: 'sname', title: '店铺', width: 130 },
];

const profitColumns: TableColumnsType<any> = [
  { dataIndex: 'name', title: '费用项', width: 180 },
  { dataIndex: 'value', title: '金额', width: 120 },
];

const storageAgeColumns: TableColumnsType<any> = [
  { dataIndex: 'label', title: '库龄', width: 110 },
  { dataIndex: 'fba', title: 'FBA仓', width: 110 },
  { dataIndex: 'local', title: '本地仓', width: 110 },
  { dataIndex: 'fbm', title: '海外仓', width: 110 },
  { dataIndex: 'total', title: '合计', width: 110 },
];

const storageAgeDetailColumns: TableColumnsType<any> = [
  { dataIndex: 'ageType', fixed: 'left', title: '库龄段', width: 130 },
  { dataIndex: 'asin', title: 'ASIN', width: 130 },
  { dataIndex: 'msku', title: 'MSKU', width: 180 },
  { dataIndex: 'fnsku', title: 'FNSKU', width: 130 },
  { dataIndex: 'quantity', title: '数量', width: 90 },
  { dataIndex: 'amount', title: '货值', width: 100 },
  { dataIndex: 'sname', title: '店铺', width: 130 },
];

const shipmentColumns: TableColumnsType<any> = [
  { dataIndex: 'shipment_number', title: '货件号', width: 150 },
  { dataIndex: 'msku', title: 'MSKU', width: 180 },
  { dataIndex: 'fnsku', title: 'FNSKU', width: 130 },
  { dataIndex: 'shipment_status', title: '状态', width: 110 },
  { dataIndex: 'init_quantity_shipped', title: '申报量', width: 100 },
  { dataIndex: 'quantity_shipped_local', title: '已发货量', width: 100 },
  { dataIndex: 'quantity_received', title: '接收量', width: 100 },
  { dataIndex: 'diff_received_shipped', title: '收发差异', width: 100 },
  { dataIndex: 'diff_in_transit', title: '在途差异', width: 100 },
];

const returnOrderFeedbackColumns: TableColumnsType<any> = [
  { dataIndex: 'orderId', fixed: 'left', title: '订单号', width: 180 },
  { dataIndex: 'imageUrl', title: '图片', width: 70 },
  { dataIndex: 'asin', title: 'ASIN', width: 130 },
  { dataIndex: 'sku', title: 'SKU', width: 170 },
  { dataIndex: 'reason', title: '退货原因', width: 190 },
  { dataIndex: 'buyerNote', title: '买家备注', width: 260 },
  { dataIndex: 'buyerFeedback', title: '买家之声反馈', width: 240 },
  { dataIndex: 'returnDate', title: '退货时间', width: 130 },
  { dataIndex: 'orderDate', title: '订购时间', width: 170 },
  { dataIndex: 'orderTags', title: '订单标签', width: 130 },
  { dataIndex: 'status', title: '状态', width: 190 },
  { dataIndex: 'disposition', title: '库存属性', width: 120 },
];

const logColumns: TableColumnsType<Asin360BriefLogRow> = [
  { dataIndex: 'operateTime', fixed: 'left', title: '时间', width: 170 },
  { dataIndex: 'operateType', title: '类型', width: 120 },
  { dataIndex: 'operateUser', title: '操作人', width: 120 },
  { dataIndex: 'operateDetail', title: '内容', width: 460 },
  { dataIndex: 'storeName', title: '店铺', width: 150 },
  { dataIndex: 'asin', title: 'ASIN', width: 140 },
];

const detailRows = computed<any[]>(() => {
  if (detailTab.value === 'ads')
    return currentItem.value?.topCampaignRows ?? [];
  if (detailTab.value === 'inventory') {
    return inventoryAnalysis.value?.stocks?.fbaRows ?? [];
  }
  if (detailTab.value === 'profit') return profitAnalysis.value?.feeRows ?? [];
  if (detailTab.value === 'logs') return logRows.value;
  return latestRows.value;
});

const detailColumns = computed<TableColumnsType<any>>(() => {
  if (detailTab.value === 'ads') return adColumns;
  if (detailTab.value === 'inventory') return inventoryColumns;
  if (detailTab.value === 'profit') return profitColumns;
  if (detailTab.value === 'logs') return logColumns;
  return dailyColumns;
});

function formatInteger(value: unknown) {
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });
}

function formatMoney(value: unknown) {
  return `$${Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatPercent(value: unknown) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function formatFixed(value: unknown, digits = 2) {
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatValue(key: string, value: unknown) {
  if (
    [
      'adSalesAmount',
      'adSpend',
      'amount',
      'averageSellingPrice',
      'grossProfit',
      'profit',
      'sales',
      'salesAmount',
      'spends',
      'value',
    ].includes(key)
  ) {
    return formatMoney(value);
  }
  if (
    [
      'acos',
      'adCvr',
      'budgetUtilization',
      'ctr',
      'cvr',
      'grossMargin',
      'ratio',
      'roas',
      'tacos',
    ].includes(key)
  ) {
    if (key === 'roas') return Number(value || 0).toFixed(2);
    return formatPercent(value);
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') return formatInteger(value);
  return value || '-';
}

function formatCompareValue(record: Record<string, any>, key: string) {
  if (['growth', 'yoyGrowth'].includes(key)) {
    return formatPercent(record[key]);
  }
  if (record.percentValue) {
    return formatPercent(record[key]);
  }
  if (record.money) {
    return formatMoney(record[key]);
  }
  return formatInteger(record[key]);
}

function compareTone(value: unknown) {
  const num = Number(value || 0);
  if (num > 0) return 'positive-text';
  if (num < 0) return 'negative-text';
  return '';
}

function dataIndexKey(dataIndex: unknown) {
  return Array.isArray(dataIndex)
    ? String(dataIndex[0] ?? '')
    : String(dataIndex ?? '');
}

function columnDataIndex(column: unknown) {
  return dataIndexKey((column as { dataIndex?: unknown })?.dataIndex);
}

function cellValue(
  record: Record<string, any>,
  dataIndex: unknown,
  fallback: unknown,
) {
  const key = dataIndexKey(dataIndex);
  return fallback ?? (key ? record[key] : undefined);
}

function formatOverviewDailyCell(key: string, value: unknown) {
  const config = overviewDailyColumnMap.get(key as keyof Asin360AsinAllRow);
  const format = config?.format ?? 'text';
  if (value === null || value === undefined || value === '') return '-';
  if (format === 'money') return formatMoney(value);
  if (format === 'percent') return formatPercent(value);
  if (format === 'integer') return formatInteger(value);
  if (format === 'decimal') return formatFixed(value);
  return String(value);
}

function overviewDailyNumericValue(
  row: Asin360AsinAllRow,
  key: keyof Asin360AsinAllRow,
) {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value || 0);
}

function overviewDailySummaryValue(rawKey: string) {
  const key = rawKey as keyof Asin360AsinAllRow;
  if (key === 'metricDate') return '汇总';
  const config = overviewDailyColumnMap.get(key);
  const rows = overviewDailyRows.value;
  if (!config || config.summary === 'none' || rows.length === 0) return '-';
  if (config.summary === 'last') {
    return formatOverviewDailyCell(key, rows[0]?.[key]);
  }
  const total = rows.reduce(
    (sum, row) => sum + overviewDailyNumericValue(row, key),
    0,
  );
  const value = config.summary === 'avg' ? total / rows.length : total;
  return formatOverviewDailyCell(key, value);
}

function overviewDailyRowKey(record: Record<string, any>, index?: number) {
  return (
    [record.metricDate, record.asin, index]
      .filter((item) => item !== undefined && item !== null && item !== '')
      .join('-') || String(index ?? 0)
  );
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadOverviewDailyRows() {
  const columns = overviewDailyColumns.value;
  const headers = columns.map((column) => String(column.title ?? ''));
  const lines = [
    headers.map((header) => csvCell(header)).join(','),
    ...overviewDailyRows.value.map((row) =>
      columns
        .map((column) => {
          const key = columnDataIndex(column) as keyof Asin360AsinAllRow;
          return csvCell(formatOverviewDailyCell(key, row[key]));
        })
        .join(','),
    ),
    columns
      .map((column) => {
        const key = columnDataIndex(column) as keyof Asin360AsinAllRow;
        return csvCell(overviewDailySummaryValue(key));
      })
      .join(','),
  ];
  const query = overview.value?.query ?? rangeParams();
  const parent =
    currentItem.value?.parentAsin || parentAsinInput.value || 'asin';
  const filename = `asin360_daily_${parent}_${query.startDate}_${query.endDate}.csv`;
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replaceAll(/[\\/:*?"<>|]/g, '_');
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function onRangeChange(_dates: any, dateStrings: [string, string]) {
  customRange.value = dateStrings;
  if (dateStrings[0] && dateStrings[1]) {
    scheduleActiveDataLoad();
  }
}

function onPresetChange() {
  if (rangePreset.value !== 'custom') {
    scheduleActiveDataLoad();
  }
}

function onModuleChange() {
  void openModuleSection(moduleTab.value);
}

function onDetailTabChange() {
  void openDetailSection(detailTab.value);
}

function detailRowKey(record: Record<string, any>, index?: number) {
  return (
    [
      record.metricDate,
      record.name,
      record.fnsku,
      record.msku,
      record.operateTime,
      record.asin,
      index,
    ]
      .filter((item) => item !== undefined && item !== null && item !== '')
      .join('-') || String(index ?? 0)
  );
}

onMounted(loadData);
</script>

<template>
  <div class="asin360-page">
    <Spin :spinning="loading">
      <section class="query-panel">
        <div class="query-title">
          <Tag color="blue">ASIN360</Tag>
          <h1>父 ASIN 经营分析</h1>
          <p>
            聚合领星商品详情、订单、广告、库存、利润与售后数据，用于新品和重点款日常复盘。
          </p>
        </div>

        <div class="query-form">
          <div class="field wide">
            <span>父 ASIN</span>
            <Input
              v-model:value="parentAsinInput"
              placeholder="B0GS9P9NJ1,B083DR58XJ"
              @press-enter="refreshData"
            />
          </div>
          <div class="field sid">
            <span>店铺 SID</span>
            <Input v-model:value="sidInput" @press-enter="refreshData" />
          </div>
          <Radio.Group
            v-model:value="rangePreset"
            class="range-pills"
            size="small"
            @change="onPresetChange"
          >
            <Radio.Button
              v-for="item in rangeOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </Radio.Button>
          </Radio.Group>
          <DatePicker.RangePicker
            v-if="rangePreset === 'custom'"
            size="small"
            value-format="YYYY-MM-DD"
            @change="onRangeChange"
          />
          <Button :loading="loading" type="primary" @click="refreshData">
            查询
          </Button>
        </div>
      </section>

      <Alert
        v-if="errors.length > 0"
        class="error-alert"
        show-icon
        type="warning"
        :message="`部分领星接口返回异常：${errors.map((item) => item.section).join('、')}`"
      />

      <template v-if="currentItem && product">
        <section class="product-summary">
          <div class="product-media">
            <img
              v-if="product.imageUrl"
              :src="product.imageUrl"
              alt="ASIN product"
            />
            <span v-else>无图</span>
          </div>
          <div class="product-info">
            <div class="product-kicker">
              <Tag color="processing">{{ currentItem.parentAsin }}</Tag>
              <span>{{ shopText }}</span>
              <span>{{ overview?.query.startDate }} -
                {{ overview?.query.endDate }}</span>
            </div>
            <h2>{{ productTitle }}</h2>
            <div class="product-meta">
              <span>子 ASIN：{{ product.asin || '-' }}</span>
              <span>类目：{{ product.category || '-' }}</span>
              <span>SPU：{{ product.spu || '-' }}</span>
              <span>FBA可售：{{ formatInteger(product.fbaStock) }}</span>
              <span>评分：{{ product.avgStar || '-' }}</span>
            </div>
          </div>
          <div class="summary-actions">
            <Button
              class="action-btn"
              size="small"
              type="primary"
              @click="openModuleSection('ad', 'ad')"
            >
              广告活动
            </Button>
            <Button
              class="action-btn"
              size="small"
              @click="openDetailSection('daily')"
            >
              明细下钻
            </Button>
          </div>
        </section>

        <div class="module-bar">
          <Radio.Group
            v-model:value="moduleTab"
            size="small"
            @change="onModuleChange"
          >
            <Radio.Button
              v-for="item in moduleTabs"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </Radio.Button>
          </Radio.Group>
          <div class="module-date">
            <span>{{ overview?.query.startDate }} -
              {{ overview?.query.endDate }}</span>
            <Button :loading="loading" size="small" @click="refreshData">
              刷新
            </Button>
          </div>
        </div>

        <section
          v-if="showModule('overview')"
          id="overview"
          class="section-block"
        >
          <div class="section-heading">
            <h3>概览</h3>
            <span>更新时间 {{ overview?.updatedAt || '-' }}</span>
          </div>
          <div class="overview-grid">
            <div class="white-panel chart-panel">
              <div class="panel-toolbar">
                <div class="panel-tabs">
                  <Button
                    :type="
                      overviewChartMode === 'trend' ? 'primary' : 'default'
                    "
                    size="small"
                    @click="overviewChartMode = 'trend'"
                  >
                    业绩走势
                  </Button>
                  <Button
                    :type="
                      overviewChartMode === 'compare' ? 'primary' : 'default'
                    "
                    size="small"
                    @click="overviewChartMode = 'compare'"
                  >
                    同环比分析
                  </Button>
                </div>
                <div class="panel-tabs">
                  <Button
                    :type="
                      overviewCompareMode === 'metric' ? 'primary' : 'default'
                    "
                    size="small"
                    @click="overviewCompareMode = 'metric'"
                  >
                    指标对比
                  </Button>
                  <Button
                    :type="
                      overviewCompareMode === 'time' ? 'primary' : 'default'
                    "
                    size="small"
                    @click="overviewCompareMode = 'time'"
                  >
                    时间对比
                  </Button>
                </div>
              </div>
              <div v-if="overviewChartMode === 'trend'" class="panel-subbar">
                <Radio.Group v-model:value="overviewTimeDim" size="small">
                  <Radio.Button
                    v-for="item in hourDayWeekMonthOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </Radio.Button>
                </Radio.Group>
              </div>
              <VChart
                v-if="overviewChartMode === 'trend'"
                class="main-chart"
                :option="trendOption"
                autoresize
              />
              <Table
                v-else
                class="compare-table"
                :columns="compareColumns"
                :data-source="overviewCompareRows"
                :pagination="false"
                :scroll="{ x: 1130, y: 320 }"
                row-key="label"
                size="small"
              >
                <template #bodyCell="{ column, record, text }">
                  <span
                    :class="
                      [
                        'growth',
                        'previousChange',
                        'yoyGrowth',
                        'yoyChange',
                      ].includes(dataIndexKey(column.dataIndex))
                        ? compareTone(text)
                        : ''
                    "
                  >
                    {{
                      dataIndexKey(column.dataIndex) === 'label'
                        ? text
                        : formatCompareValue(
                            record,
                            dataIndexKey(column.dataIndex),
                          )
                    }}
                  </span>
                </template>
              </Table>
            </div>
            <div class="metric-grid">
              <div v-for="card in metricCards" :key="card.key" class="kpi-card">
                <span>{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
                <em>{{ card.sub }}</em>
              </div>
            </div>
          </div>
        </section>

        <section v-if="showModule('overview')" class="white-panel table-panel">
          <div class="panel-toolbar daily-toolbar">
            <div class="daily-toolbar-title">
              <strong>最近每日表现</strong>
              <span>
                {{ overview?.query.startDate }} -
                {{ overview?.query.endDate }} ·
                {{ overviewDailyRows.length }} 行
              </span>
            </div>
            <div class="daily-toolbar-actions">
              <Popover placement="bottomRight" trigger="click">
                <template #content>
                  <div class="daily-column-config">
                    <div class="config-title">展示列</div>
                    <Checkbox.Group
                      v-model:value="overviewDailyVisibleKeys"
                      class="daily-column-checklist"
                      :options="overviewDailyColumnOptions"
                    />
                  </div>
                </template>
                <Button size="small">列配置</Button>
              </Popover>
              <Button size="small" @click="downloadOverviewDailyRows">
                下载
              </Button>
            </div>
          </div>
          <Table
            :columns="overviewDailyColumns"
            :data-source="overviewDailyRows"
            :pagination="false"
            :row-key="overviewDailyRowKey"
            :scroll="{ x: overviewDailyScrollX, y: 220 }"
            size="small"
          >
            <template #bodyCell="{ column, record, text }">
              <span>{{
                formatOverviewDailyCell(
                  dataIndexKey(column.dataIndex),
                  cellValue(record, column.dataIndex, text),
                )
              }}</span>
            </template>
            <template #summary>
              <Table.Summary fixed>
                <Table.Summary.Row class="daily-summary-row">
                  <Table.Summary.Cell
                    v-for="(column, index) in overviewDailyColumns"
                    :key="columnDataIndex(column)"
                    class="daily-summary-cell"
                    :index="index"
                  >
                    {{ overviewDailySummaryValue(columnDataIndex(column)) }}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            </template>
          </Table>
        </section>

        <section v-if="showModule('order')" id="order" class="section-block">
          <div class="section-heading">
            <h3>订单分析</h3>
          </div>
          <div class="two-col">
            <div class="white-panel">
              <div class="panel-toolbar">
                <strong>自然订单分析</strong>
                <div class="panel-tabs">
                  <Button
                    :type="orderChannel === 'ad' ? 'primary' : 'default'"
                    size="small"
                    @click="orderChannel = 'ad'"
                  >
                    广告
                  </Button>
                  <Button
                    :type="orderChannel === 'promo' ? 'primary' : 'default'"
                    size="small"
                    @click="orderChannel = 'promo'"
                  >
                    促销
                  </Button>
                  <Radio.Group v-model:value="orderTimeDim" size="small">
                    <Radio.Button
                      v-for="item in orderTimeOptions"
                      :key="item.value"
                      :value="item.value"
                    >
                      {{ item.label }}
                    </Radio.Button>
                  </Radio.Group>
                </div>
              </div>
              <VChart class="medium-chart" :option="hourlyOption" autoresize />
            </div>
            <div class="white-panel">
              <div class="panel-toolbar">
                <strong>地区订单分析</strong>
                <div class="panel-tabs">
                  <Radio.Group v-model:value="orderMetric" size="small">
                    <Radio.Button value="salesAmount">销售额</Radio.Button>
                    <Radio.Button value="totalSalesQty">销量</Radio.Button>
                    <Radio.Button value="orders">订单量</Radio.Button>
                  </Radio.Group>
                  <Radio.Group v-model:value="orderRegionWindow" size="small">
                    <Radio.Button value="7d">近7天</Radio.Button>
                    <Radio.Button value="14d">近14天</Radio.Button>
                    <Radio.Button value="28d">近28天</Radio.Button>
                  </Radio.Group>
                </div>
              </div>
              <VChart class="medium-chart" :option="regionOption" autoresize />
            </div>
          </div>
        </section>

        <section v-if="showModule('ad')" id="ad" class="section-block">
          <div class="section-heading">
            <h3>广告分析</h3>
          </div>
          <div class="two-col">
            <div class="white-panel">
              <div class="panel-toolbar">
                <strong>广告效果</strong>
                <div class="panel-tabs">
                  <Button
                    :type="
                      adEfficiencyMetric === 'acos' ? 'primary' : 'default'
                    "
                    size="small"
                    @click="adEfficiencyMetric = 'acos'"
                  >
                    ACOS
                  </Button>
                  <Button
                    :type="
                      adEfficiencyMetric === 'roas' ? 'primary' : 'default'
                    "
                    size="small"
                    @click="adEfficiencyMetric = 'roas'"
                  >
                    ROAS
                  </Button>
                  <Radio.Group v-model:value="adTimeDim" size="small">
                    <Radio.Button
                      v-for="item in dayWeekMonthOptions"
                      :key="item.value"
                      :value="item.value"
                    >
                      {{ item.label }}
                    </Radio.Button>
                  </Radio.Group>
                </div>
              </div>
              <div class="metric-cards compact">
                <div class="kpi-card">
                  <span>广告花费</span>
                  <strong>{{
                    formatMoney(currentItem.adSummary?.spends)
                  }}</strong>
                  <em>SP/SB/SD</em>
                </div>
                <div class="kpi-card">
                  <span>广告销售额</span>
                  <strong>{{
                    formatMoney(currentItem.adSummary?.sales)
                  }}</strong>
                  <em>广告归因销售</em>
                </div>
                <div class="kpi-card">
                  <span>ACOS</span>
                  <strong>{{
                    formatPercent(currentItem.adSummary?.acos)
                  }}</strong>
                  <em>花费 / 销售额</em>
                </div>
              </div>
              <VChart
                class="medium-chart low"
                :option="adEffectOption"
                autoresize
              />
            </div>
            <div class="white-panel table-card">
              <div class="panel-toolbar">
                <strong>曝光点击</strong>
                <Radio.Group v-model:value="adTrafficTimeDim" size="small">
                  <Radio.Button
                    v-for="item in dayWeekMonthOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </Radio.Button>
                </Radio.Group>
              </div>
              <VChart
                class="medium-chart low"
                :option="adTrafficOption"
                autoresize
              />
            </div>
          </div>
          <div class="two-col lower-grid">
            <div class="white-panel table-card">
              <div class="panel-toolbar">
                <strong>广告活动 TOP50</strong>
                <span>{{ currentItem.topCampaignRows?.length || 0 }} 条</span>
              </div>
              <Table
                :columns="adColumns"
                :data-source="currentItem.topCampaignRows"
                :pagination="{ pageSize: 8, showSizeChanger: false }"
                :scroll="{ x: 980, y: 330 }"
                row-key="name"
                size="small"
              >
                <template #bodyCell="{ column, record, text }">
                  <span>{{
                    formatValue(
                      dataIndexKey(column.dataIndex),
                      cellValue(record, column.dataIndex, text),
                    )
                  }}</span>
                </template>
              </Table>
            </div>
            <div class="white-panel table-card">
              <div class="panel-toolbar">
                <strong>用户搜索词 TOP200</strong>
                <span>{{ currentItem.topSearchTermRows?.length || 0 }} 条</span>
              </div>
              <Table
                :columns="adColumns"
                :data-source="currentItem.topSearchTermRows"
                :pagination="{ pageSize: 8, showSizeChanger: false }"
                :scroll="{ x: 980, y: 330 }"
                row-key="name"
                size="small"
              >
                <template #bodyCell="{ column, record, text }">
                  <span>{{
                    formatValue(
                      dataIndexKey(column.dataIndex),
                      cellValue(record, column.dataIndex, text),
                    )
                  }}</span>
                </template>
              </Table>
            </div>
          </div>
        </section>

        <section v-if="showModule('child')" id="child" class="section-block">
          <div class="section-heading">
            <h3>子体对比</h3>
            <div class="panel-tabs">
              <Radio.Group v-model:value="childMetric" size="small">
                <Radio.Button value="salesVolume">销量</Radio.Button>
                <Radio.Button value="salesAmount">销售额</Radio.Button>
                <Radio.Button value="adSpend">广告花费</Radio.Button>
              </Radio.Group>
              <Radio.Group v-model:value="childDimension" size="small">
                <Radio.Button value="variant">变体属性</Radio.Button>
                <Radio.Button value="category">子ASIN</Radio.Button>
              </Radio.Group>
              <Radio.Group v-model:value="childView" size="small">
                <Radio.Button value="chart">图</Radio.Button>
                <Radio.Button value="table">表</Radio.Button>
              </Radio.Group>
            </div>
          </div>
          <div class="white-panel child-panel">
            <div v-if="childView === 'chart'" class="child-chart">
              <VChart
                class="medium-chart"
                :option="childDistributionOption"
                autoresize
              />
            </div>
            <div v-else class="child-total">
              <span>子体总销量</span>
              <strong>{{
                formatInteger(
                  subAsinRows.reduce(
                    (sum: number, row: any) =>
                      sum + Number(row.salesVolume || 0),
                    0,
                  ),
                )
              }}</strong>
              <em>{{ subAsinRows.length }} 个子体</em>
            </div>
            <div class="rank-list">
              <div
                v-for="row in subAsinRows.slice(0, 10)"
                :key="row.name"
                class="rank-line"
              >
                <span>{{ row.name }}</span>
                <b>{{ formatInteger(row.salesVolume) }}</b>
                <em>{{ formatPercent(row.ratio) }}</em>
              </div>
            </div>
            <Table
              :columns="[
                { title: '排名', dataIndex: 'rank', width: 70 },
                { title: 'ASIN/属性', dataIndex: 'name', width: 180 },
                { title: '销量', dataIndex: 'salesVolume', width: 100 },
                { title: '销售额', dataIndex: 'salesAmount', width: 120 },
                { title: '广告利润', dataIndex: 'adProfit', width: 120 },
              ]"
              :data-source="
                subAsinRows.map((row, index) => ({ ...row, rank: index + 1 }))
              "
              :pagination="false"
              :scroll="{ x: 720, y: 360 }"
              row-key="name"
              size="small"
            >
              <template #bodyCell="{ column, record, text }">
                <span>{{
                  formatValue(
                    dataIndexKey(column.dataIndex),
                    cellValue(record, column.dataIndex, text),
                  )
                }}</span>
              </template>
            </Table>
          </div>
        </section>

        <section
          v-if="showModule('inventory')"
          id="inventory"
          class="section-block"
        >
          <div class="section-heading">
            <h3>库存分析</h3>
            <Radio.Group v-model:value="inventoryUnit" size="small">
              <Radio.Button value="quantity">数量</Radio.Button>
              <Radio.Button value="amount">货值</Radio.Button>
            </Radio.Group>
          </div>
          <div class="two-col">
            <div class="white-panel">
              <div class="panel-toolbar">
                <strong>库存概况</strong>
                <span>{{
                  inventoryUnit === 'quantity' ? '数量口径' : '货值口径'
                }}</span>
              </div>
              <div class="summary-pairs four">
                <div v-for="card in inventorySummaryCards" :key="card.label">
                  <label>{{ card.label }}</label>
                  <b>{{ card.value }}</b>
                </div>
              </div>
            </div>
            <div class="white-panel table-card">
              <div class="panel-toolbar">
                <strong>FBA货件</strong>
                <span>{{
                    inventoryAnalysis?.stocks?.fbaRows?.length || 0
                  }}
                  条</span>
              </div>
              <Table
                :columns="inventoryColumns"
                :data-source="inventoryAnalysis?.stocks?.fbaRows ?? []"
                :pagination="{ pageSize: 8, showSizeChanger: false }"
                :scroll="{ x: 820, y: 310 }"
                row-key="fnsku"
                size="small"
              >
                <template #bodyCell="{ column, record, text }">
                  <span>{{
                    formatValue(
                      dataIndexKey(column.dataIndex),
                      cellValue(record, column.dataIndex, text),
                    )
                  }}</span>
                </template>
              </Table>
            </div>
          </div>
          <div class="two-col inventory-extra">
            <div class="white-panel">
              <div class="panel-toolbar">
                <strong>库龄</strong>
                <span>{{ storageAgeRows.length }} 个区间</span>
              </div>
              <VChart
                class="medium-chart"
                :option="storageAgeOption"
                autoresize
              />
              <Table
                :columns="storageAgeColumns"
                :data-source="storageAgeRows"
                :pagination="false"
                row-key="key"
                size="small"
              >
                <template #bodyCell="{ column, text }">
                  <span>{{
                    dataIndexKey(column.dataIndex) === 'label'
                      ? text
                      : formatInteger(text)
                  }}</span>
                </template>
              </Table>
            </div>
            <div class="white-panel table-card">
              <div class="panel-toolbar">
                <strong>断货/货件分析</strong>
                <span>{{ shipmentRows.length }} 条</span>
              </div>
              <Table
                :columns="shipmentColumns"
                :data-source="shipmentRows"
                :pagination="{ pageSize: 6, showSizeChanger: false }"
                :scroll="{ x: 740, y: 320 }"
                row-key="shipment_id"
                size="small"
              >
                <template #bodyCell="{ column, record, text }">
                  <span>{{
                    formatValue(
                      dataIndexKey(column.dataIndex),
                      cellValue(record, column.dataIndex, text),
                    )
                  }}</span>
                </template>
              </Table>
            </div>
          </div>
          <section class="white-panel table-panel nested">
            <div class="panel-toolbar">
              <strong>库龄明细</strong>
              <span>{{
                  inventoryAnalysis?.storageAge?.detailRows?.length || 0
                }}
                条</span>
            </div>
            <Table
              :columns="storageAgeDetailColumns"
              :data-source="inventoryAnalysis?.storageAge?.detailRows ?? []"
              :pagination="{ pageSize: 8, showSizeChanger: false }"
              :scroll="{ x: 900, y: 320 }"
              row-key="fnsku"
              size="small"
            >
              <template #bodyCell="{ column, record, text }">
                <span>{{
                  formatValue(
                    dataIndexKey(column.dataIndex),
                    cellValue(record, column.dataIndex, text),
                  )
                }}</span>
              </template>
            </Table>
          </section>
        </section>

        <section v-if="showModule('profit')" id="profit" class="section-block">
          <div class="section-heading">
            <h3>利润</h3>
            <div class="panel-tabs">
              <Radio.Group v-model:value="profitView" size="small">
                <Radio.Button value="flow">桑基图</Radio.Button>
                <Radio.Button value="bar">柱图</Radio.Button>
              </Radio.Group>
            </div>
          </div>
          <div class="two-col profit-grid">
            <div class="white-panel chart-panel">
              <div class="panel-toolbar">
                <strong>{{
                  profitView === 'flow' ? '结算利润桑基图' : '结算利润柱图'
                }}</strong>
                <span>{{
                  overview?.query.startDate && overview?.query.endDate
                    ? `${overview.query.startDate} - ${overview.query.endDate}`
                    : '-'
                }}</span>
              </div>
              <VChart
                class="medium-chart"
                :option="profitCostOption"
                autoresize
              />
            </div>
            <div class="white-panel chart-panel">
              <div class="panel-toolbar">
                <strong>费用结构占比</strong>
                <span>{{ profitAnalysis?.feeRows?.length || 0 }} 项</span>
              </div>
              <VChart
                class="medium-chart"
                :option="profitBreakdownOption"
                autoresize
              />
            </div>
          </div>
        </section>

        <section
          v-if="showModule('afterSale')"
          id="after-sale"
          class="section-block"
        >
          <div class="section-heading">
            <h3>售后分析</h3>
            <div class="panel-tabs">
              <Radio.Group
                v-model:value="afterSaleKind"
                size="small"
                @change="loadAfterSaleData"
              >
                <Radio.Button value="return">退货</Radio.Button>
                <Radio.Button value="refund">退款</Radio.Button>
              </Radio.Group>
              <Radio.Group
                v-model:value="afterSaleDateKind"
                size="small"
                @change="loadAfterSaleData"
              >
                <Radio.Button value="return">退货时间</Radio.Button>
                <Radio.Button value="order">下单时间</Radio.Button>
              </Radio.Group>
            </div>
          </div>
          <div class="two-col">
            <div class="white-panel">
              <div class="panel-toolbar">
                <strong>{{ afterSaleKind === 'refund' ? '退款趋势' : '退货趋势' }} ·
                  {{
                    afterSaleDateKind === 'order' ? '下单时间' : '退货时间'
                  }}</strong>
                <Radio.Group
                  v-model:value="afterSaleTimeDim"
                  size="small"
                  @change="loadAfterSaleData"
                >
                  <Radio.Button
                    v-for="item in dayWeekMonthOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </Radio.Button>
                </Radio.Group>
              </div>
              <Spin :spinning="afterSaleLoading">
                <VChart
                  class="medium-chart"
                  :option="afterSaleTrendOption"
                  autoresize
                />
              </Spin>
            </div>
            <div class="white-panel table-card">
              <div class="panel-toolbar">
                <strong>退货原因分布</strong>
              </div>
              <VChart
                class="medium-chart"
                :option="afterSaleOption"
                autoresize
              />
            </div>
          </div>
          <section class="white-panel table-panel nested">
            <div class="panel-toolbar">
              <strong>ASIN分布</strong>
              <span>{{ afterSaleAsinRows.length }} 条</span>
            </div>
            <div class="asin-distribution">
              <VChart
                class="medium-chart low"
                :option="afterSaleAsinOption"
                autoresize
              />
              <Table
                :columns="[
                  { title: '图片', dataIndex: 'imageUrl', width: 70 },
                  { title: 'ASIN', dataIndex: 'asin', width: 140 },
                  { title: '变体属性', dataIndex: 'variant', width: 170 },
                  { title: '品名/SKU', dataIndex: 'productName', width: 230 },
                  {
                    title: afterSaleKind === 'refund' ? '退款量' : '退货量',
                    dataIndex: 'quantity',
                    width: 100,
                  },
                  {
                    title: afterSaleKind === 'refund' ? '退款占比' : '退货占比',
                    dataIndex: 'ratio',
                    width: 100,
                  },
                ]"
                :data-source="afterSaleAsinRows"
                :pagination="{ pageSize: 8, showSizeChanger: false }"
                :scroll="{ x: 820, y: 310 }"
                row-key="asin"
                size="small"
              >
                <template #bodyCell="{ column, record, text }">
                  <template
                    v-if="dataIndexKey(column.dataIndex) === 'imageUrl'"
                  >
                    <img
                      v-if="text"
                      class="table-thumb"
                      :src="text"
                      alt="ASIN"
                    />
                    <span v-else class="thumb-empty">无图</span>
                  </template>
                  <span v-else>{{
                    formatValue(
                      dataIndexKey(column.dataIndex),
                      cellValue(record, column.dataIndex, text),
                    )
                  }}</span>
                </template>
              </Table>
            </div>
          </section>
          <section class="white-panel nested">
            <div class="panel-toolbar">
              <strong>退货原因趋势</strong>
              <Radio.Group
                v-model:value="afterSaleTimeDim"
                size="small"
                @change="loadAfterSaleData"
              >
                <Radio.Button
                  v-for="item in dayWeekMonthOptions"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </Radio.Button>
              </Radio.Group>
            </div>
            <Spin :spinning="afterSaleLoading">
              <VChart
                class="medium-chart"
                :option="afterSaleReasonTrendOption"
                autoresize
              />
            </Spin>
          </section>
          <section class="white-panel table-panel nested">
            <div class="panel-toolbar">
              <strong>退货订单反馈</strong>
              <span>{{
                  afterSaleAnalysis?.returnOrderFeedbackTotal ||
                  returnOrderFeedbackRows.length
                }}
                条</span>
            </div>
            <Table
              :columns="returnOrderFeedbackColumns"
              :data-source="returnOrderFeedbackRows"
              :pagination="{ pageSize: 8, showSizeChanger: false }"
              :scroll="{ x: 1900, y: 360 }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record, text }">
                <template v-if="dataIndexKey(column.dataIndex) === 'imageUrl'">
                  <img v-if="text" class="table-thumb" :src="text" alt="ASIN" />
                  <span v-else class="thumb-empty">无图</span>
                </template>
                <span
                  v-else-if="
                    ['buyerNote', 'buyerFeedback', 'productName'].includes(
                      dataIndexKey(column.dataIndex),
                    )
                  "
                  class="feedback-text"
                >
                  {{ cellValue(record, column.dataIndex, text) || '-' }}
                </span>
                <span v-else-if="dataIndexKey(column.dataIndex) === 'reason'">
                  {{ record.reason || '-' }}
                  <em class="muted-line">{{ record.reasonText || '-' }}</em>
                </span>
                <span v-else>{{
                  formatValue(
                    dataIndexKey(column.dataIndex),
                    cellValue(record, column.dataIndex, text),
                  )
                }}</span>
              </template>
            </Table>
          </section>
          <section class="white-panel table-panel nested">
            <div class="panel-toolbar">
              <strong>退货地域排行</strong>
              <span>{{ afterSaleAnalysis?.refundRegionRows?.length || 0 }} 条</span>
            </div>
            <Table
              :columns="[
                { title: '地区', dataIndex: 'region', width: 150 },
                { title: '退货量', dataIndex: 'refund_volume', width: 120 },
                { title: '退货率', dataIndex: 'refund_rate', width: 120 },
              ]"
              :data-source="afterSaleAnalysis?.refundRegionRows ?? []"
              :pagination="{ pageSize: 8, showSizeChanger: false }"
              row-key="region"
              size="small"
            />
          </section>
        </section>

        <section id="detail" class="white-panel detail-drill">
          <div class="panel-toolbar">
            <strong>明细下钻</strong>
            <Segmented
              v-model:value="detailTab"
              :options="detailTabs"
              size="small"
              @change="onDetailTabChange"
            />
          </div>
          <Table
            :columns="detailColumns"
            :data-source="detailRows"
            :pagination="tablePagination"
            :row-key="detailRowKey"
            :scroll="{ x: 1480, y: 520 }"
            size="small"
          >
            <template #bodyCell="{ column, record, text }">
              <span>{{
                formatValue(
                  dataIndexKey(column.dataIndex),
                  cellValue(record, column.dataIndex, text),
                )
              }}</span>
            </template>
          </Table>
        </section>
      </template>

      <Empty
        v-else
        class="empty-state"
        description="输入父 ASIN 后查询 ASIN360 数据"
      />
    </Spin>
  </div>
</template>

<style scoped>
.asin360-page {
  min-height: calc(100vh - 96px);
  margin: -16px;
  color: #111827;
  background: #f4f7fb;
}

.query-panel {
  display: grid;
  grid-template-columns: minmax(300px, 0.8fr) minmax(520px, 1.4fr);
  gap: 24px;
  align-items: end;
  padding: 24px 28px 18px;
  background:
    linear-gradient(135deg, rgb(231 245 255 / 90%), rgb(240 253 250 / 92%)),
    #f8fafc;
  border-bottom: 1px solid #dbe7f3;
}

.query-title h1 {
  margin: 10px 0 8px;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.15;
}

.query-title p {
  max-width: 640px;
  margin: 0;
  color: #526273;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
  justify-content: flex-end;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  font-size: 12px;
  color: #64748b;
}

.field.wide {
  width: 300px;
}

.field.sid {
  width: 100px;
}

.range-pills {
  max-width: 100%;
}

.error-alert {
  margin: 14px 28px 0;
}

.product-summary {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 18px;
  margin: 18px 28px 0;
  background: #fff;
  border: 1px solid #dfe8f3;
  border-radius: 8px;
  box-shadow: 0 8px 22px rgb(15 23 42 / 6%);
}

.product-media {
  display: grid;
  place-items: center;
  width: 82px;
  height: 82px;
  overflow: hidden;
  color: #94a3b8;
  background: #f8fafc;
  border: 1px solid #e5edf6;
  border-radius: 8px;
}

.product-media img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.product-kicker,
.product-meta,
.summary-actions,
.module-bar,
.module-date,
.panel-tabs,
.panel-subbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.product-kicker {
  color: #64748b;
}

.product-info h2 {
  margin: 8px 0 10px;
  font-size: 20px;
  line-height: 1.35;
}

.product-meta {
  gap: 8px 20px;
  color: #536171;
}

.summary-actions .action-btn {
  min-width: 92px;
}

.module-bar {
  position: sticky;
  top: 0;
  z-index: 12;
  justify-content: space-between;
  padding: 10px 28px;
  margin-top: 14px;
  background: #fff;
  border-top: 1px solid #e5edf6;
  border-bottom: 1px solid #e5edf6;
}

.module-date {
  margin-left: auto;
  color: #64748b;
}

.panel-tabs {
  justify-content: flex-end;
}

.panel-subbar {
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-block {
  padding: 18px 28px 0;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-heading h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.section-heading span {
  color: #64748b;
}

.white-panel {
  position: relative;
  padding: 16px;
  background: #fff;
  border: 1px solid #dfe8f3;
  border-radius: 8px;
  box-shadow: 0 8px 22px rgb(15 23 42 / 5%);
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
}

.panel-toolbar strong {
  font-size: 16px;
}

.panel-toolbar span {
  color: #64748b;
}

.daily-toolbar {
  gap: 12px;
}

.daily-toolbar-title {
  display: grid;
  gap: 3px;
}

.daily-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.daily-column-config {
  width: 360px;
  max-height: 360px;
  overflow: auto;
}

.config-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}

.daily-column-checklist {
  display: grid;
  grid-template-columns: repeat(2, minmax(130px, 1fr));
  gap: 8px 12px;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(360px, 0.95fr);
  gap: 16px;
}

.metric-grid,
.metric-cards {
  display: grid;
  gap: 12px;
}

.metric-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.metric-cards.compact {
  grid-template-columns: repeat(3, minmax(150px, 1fr));
}

.kpi-card {
  min-height: 96px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e8eef6;
  border-radius: 8px;
}

.kpi-card:first-child {
  background: #f0fdfa;
  border-color: #99f6e4;
}

.kpi-card span,
.kpi-card em {
  display: block;
  font-size: 12px;
  font-style: normal;
  color: #5f6d80;
}

.kpi-card strong {
  display: block;
  margin-top: 6px;
  font-size: 22px;
  line-height: 1.1;
}

.kpi-card em {
  margin-top: 5px;
  color: #0f766e;
}

.main-chart {
  height: 338px;
}

.table-panel,
.detail-drill {
  margin: 18px 28px 0;
}

.table-panel.nested {
  margin: 14px 0 0;
}

.compare-table {
  margin-top: 10px;
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.profit-grid {
  align-items: start;
}

.chart-panel {
  min-width: 0;
}

.inventory-extra {
  margin-top: 14px;
}

.lower-grid {
  margin-top: 14px;
}

.medium-chart {
  height: 300px;
}

.profit-grid .medium-chart {
  height: 320px;
}

.medium-chart.low {
  height: 230px;
}

.table-card {
  min-width: 0;
}

.positive-text {
  color: #0f9f6e;
}

.negative-text {
  color: #e11d48;
}

.child-panel {
  display: grid;
  grid-template-columns: 220px 280px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.child-chart {
  min-height: 260px;
}

.asin-distribution {
  display: grid;
  grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.28fr);
  gap: 16px;
  align-items: center;
}

.table-thumb,
.thumb-empty {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  color: #94a3b8;
  object-fit: cover;
  background: #f8fafc;
  border: 1px solid #e5edf6;
  border-radius: 6px;
}

.thumb-empty {
  font-size: 12px;
}

.feedback-text {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-height: 1.45;
  -webkit-box-orient: vertical;
}

.muted-line {
  display: block;
  margin-top: 2px;
  font-style: normal;
  color: #7b8798;
}

.child-total {
  display: grid;
  place-items: center;
  min-height: 220px;
  padding: 20px;
  text-align: center;
  background: #f0fdfa;
  border: 1px solid #bde8dc;
  border-radius: 8px;
}

.child-total span,
.child-total em {
  font-style: normal;
  color: #64748b;
}

.child-total strong {
  font-size: 34px;
  font-weight: 800;
}

.rank-list {
  display: grid;
  gap: 4px;
}

.rank-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 74px 74px;
  gap: 8px;
  align-items: center;
  min-height: 30px;
  font-size: 13px;
}

.rank-line span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-line b,
.rank-line em {
  text-align: right;
}

.rank-line em {
  font-style: normal;
  color: #4b5563;
}

.summary-pairs {
  display: grid;
  gap: 12px 20px;
  font-size: 14px;
}

.summary-pairs.four {
  grid-template-columns: repeat(4, 1fr);
}

.summary-pairs div {
  display: grid;
  gap: 6px;
  min-height: 86px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e8eef6;
  border-radius: 8px;
}

.summary-pairs label {
  color: #64748b;
}

.summary-pairs b {
  font-size: 24px;
  color: #111827;
}

.empty-state {
  min-height: 420px;
  padding-top: 120px;
  margin: 18px 28px;
  background: #fff;
  border: 1px solid #e5edf6;
  border-radius: 8px;
}

:deep(.ant-table-wrapper .ant-table-thead > tr > th) {
  padding: 7px 8px;
  font-weight: 700;
  color: #111827;
  background: #f6f9fc;
  border-color: #c8d4e3;
  border-right: 1px solid #c8d4e3;
}

:deep(.ant-table-wrapper .ant-table-tbody > tr > td),
:deep(.ant-table-wrapper .ant-table-summary > tr > td) {
  padding: 7px 8px;
  border-color: #cfd9e7;
  border-right: 1px solid #cfd9e7;
}

:deep(.ant-table-wrapper .ant-table-thead > tr > th:last-child),
:deep(.ant-table-wrapper .ant-table-tbody > tr > td:last-child),
:deep(.ant-table-wrapper .ant-table-summary > tr > td:last-child) {
  border-right: 0;
}

:deep(.ant-table-wrapper .ant-table-container),
:deep(.ant-table-wrapper .ant-table-content),
:deep(.ant-table-wrapper .ant-table-body) {
  border-color: #c8d4e3;
}

:deep(.daily-summary-row > td) {
  position: sticky;
  bottom: 0;
  z-index: 2;
  font-weight: 800;
  color: #0f172a;
  background: #eef4fb;
}

:deep(.daily-summary-cell) {
  font-variant-numeric: tabular-nums;
}

:deep(.ant-btn),
:deep(.ant-input),
:deep(.ant-picker),
:deep(.ant-radio-button-wrapper) {
  border-radius: 6px;
}

@media (max-width: 1280px) {
  .query-panel,
  .product-summary,
  .overview-grid,
  .two-col,
  .child-panel,
  .asin-distribution {
    grid-template-columns: 1fr;
  }

  .query-form {
    justify-content: flex-start;
  }

  .metric-grid,
  .metric-cards.compact,
  .summary-pairs.four {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }
}

@media (max-width: 720px) {
  .query-panel,
  .section-block,
  .module-bar {
    padding-right: 16px;
    padding-left: 16px;
  }

  .product-summary,
  .table-panel,
  .detail-drill,
  .empty-state {
    margin-right: 16px;
    margin-left: 16px;
  }

  .field.wide,
  .field.sid {
    width: 100%;
  }

  .metric-grid,
  .metric-cards.compact,
  .summary-pairs.four {
    grid-template-columns: 1fr;
  }
}
</style>
