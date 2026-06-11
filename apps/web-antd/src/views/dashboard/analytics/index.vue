<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  AnalyticsOperationGroup,
  AnalyticsOverview,
  AnalyticsReportColumn,
  AnalyticsReportOverview,
  AnalyticsReportRow,
} from '#/api/kanban/types';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import VChart from 'vue-echarts';

import {
  Button,
  DatePicker,
  Empty,
  Select,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import { GaugeChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import { fetchAnalyticsOverview, fetchAnalyticsReport } from '#/api/kanban';

use([CanvasRenderer, GaugeChart, TooltipComponent]);

interface ResponsibleCard {
  completionRate: number;
  dailyTargetProfit: number;
  dailyTargetSales: number;
  dailyTargetUnits: number;
  grossProfit: number;
  inventoryQty: number;
  name: string;
  salesAmount: number;
  salesQty: number;
  turnoverMonths: number;
}

type AnalyticsGranularity = 'day' | 'month';
type ReportDateRangeType =
  | 'currentMonth'
  | 'custom'
  | 'last7'
  | 'last30'
  | 'lastMonth'
  | 'today'
  | 'year'
  | 'yesterday';
type ReportSortOrder = 'ascend' | 'descend';

const fixedReportColumnKeys = new Set([
  'imageUrl',
  'parentAsin',
  'productType',
  'responsible',
  'spu',
]);
const sortableReportFields = new Set([
  'acos',
  'adOrders',
  'adSales',
  'adSpend',
  'avgSales7',
  'cpc',
  'cpo',
  'ctr',
  'cvr',
  'orderQty',
  'refundQty',
  'salesAmount',
  'salesQty',
  'settlementProfit',
  'tacos',
]);

const loading = ref(false);
const reportLoading = ref(false);
const reportDownloading = ref(false);
const overview = ref<AnalyticsOverview | null>(null);
const report = ref<AnalyticsReportOverview | null>(null);
const reportSummaryScroll = ref<HTMLElement | null>(null);
const groupUnitsScroll = ref<HTMLElement | null>(null);
const groupSalesScroll = ref<HTMLElement | null>(null);
const selectedReportColumns = ref<string[]>([]);
const reportColumnsInitialized = ref(false);
let reportBodyScrollElement: HTMLElement | null = null;
let reportScrollSyncing = false;
let groupScrollSyncing = false;
let dashboardAutoReloadReady = false;
let dashboardAutoReloadTimer: null | ReturnType<typeof setTimeout> = null;
let syncingDashboardQuery = false;
const query = reactive({
  departments: [] as string[],
  granularity: 'day' as AnalyticsGranularity,
  operationGroupIds: [] as number[],
  responsibles: [] as string[],
  startDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  endDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  siteDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  sites: [] as string[],
  transactionStatuses: ['已发放'] as string[],
});
const reportQuery = reactive({
  dateRangeType: 'last30' as ReportDateRangeType,
  endDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  page: 1,
  pageSize: 50,
  productTypes: [] as string[],
  responsibles: [] as string[],
  sortField: 'salesQty',
  sortOrder: 'descend' as ReportSortOrder,
  startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
});

const operations = computed(() => overview.value?.operations);
const latest = computed(() => operations.value?.latest);
const previous = computed(() => operations.value?.previous);
const weekBefore = computed(() => operations.value?.weekBefore);
const advertising = computed(() => overview.value?.advertising);
const targets = computed(() => overview.value?.targets);
const period = computed(() => overview.value?.period);
const source = computed(() => overview.value?.source);
const granularityOptions = [
  { label: '日', value: 'day' },
  { label: '月', value: 'month' },
];
const isMonthMode = computed(() => query.granularity === 'month');
const periodDays = computed(() => period.value?.days ?? 1);
const monthValue = computed({
  get() {
    return dayjs(query.siteDate).format('YYYY-MM');
  },
  set(value: string) {
    query.siteDate = `${value}-01`;
  },
});
const dateRangeValue = computed({
  get(): [string, string] {
    return [query.startDate, query.endDate];
  },
  set(value: [string, string] | null) {
    if (!value?.[0] || !value?.[1]) return;
    query.startDate = value[0];
    query.endDate = value[1];
    query.siteDate = value[1];
  },
});
const targetLabel = computed(() => period.value?.targetLabel ?? '区间目标');
const previousLabel = computed(() => period.value?.previousLabel ?? '前一周期');
const secondaryLabel = computed(
  () => period.value?.secondaryLabel ?? '上周同期',
);
const targetHint = computed(() =>
  isMonthMode.value ? '按所选月份汇总月目标' : '按所选日期范围累加日目标',
);
const metricPrefix = computed(() => {
  if (isMonthMode.value) return '月度';
  if (source.value?.mode === 'live_api' && source.value.status === 'ok') {
    return '实时';
  }
  return periodDays.value > 1 ? '区间' : '站点日';
});

const currentPeriodLabel = computed(() =>
  periodRangeLabel(period.value?.startDate, period.value?.endDate),
);
const previousPeriodLabel = computed(() => {
  const start = period.value?.startDate;
  const end = period.value?.endDate;
  if (!start || !end) return '-';
  if (isMonthMode.value) {
    const value = dayjs(start).subtract(1, 'month');
    return value.isValid() ? value.format('YYYY-MM') : '-';
  }
  const days = Math.max(1, period.value?.days ?? 1);
  const previousEnd = dayjs(start).subtract(1, 'day');
  const previousStart = previousEnd.subtract(days - 1, 'day');
  return periodRangeLabel(
    previousStart.format('YYYY-MM-DD'),
    previousEnd.format('YYYY-MM-DD'),
  );
});
const secondaryPeriodLabel = computed(() => {
  const start = period.value?.startDate;
  const end = period.value?.endDate;
  if (!start || !end) return '-';
  if (isMonthMode.value) {
    const value = dayjs(start).subtract(1, 'year');
    return value.isValid() ? value.format('YYYY-MM') : '-';
  }
  return periodRangeLabel(
    dayjs(start).subtract(7, 'day').format('YYYY-MM-DD'),
    dayjs(end).subtract(7, 'day').format('YYYY-MM-DD'),
  );
});
const dateLabel = computed(() =>
  isMonthMode.value ? '统计月份' : '统计日期范围',
);
const departmentOptions = computed(() =>
  (overview.value?.filters.departments ?? []).map((value) => ({
    label: value,
    value,
  })),
);
const siteOptions = computed(() =>
  (overview.value?.filters.sites ?? []).map((value) => ({
    label: value,
    value,
  })),
);
const responsibleOptions = computed(() =>
  (overview.value?.filters.responsibles ?? []).map((value) => ({
    label: value,
    value,
  })),
);
const operationGroupOptions = computed(() =>
  (overview.value?.filters.operationGroups ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  })),
);
const transactionStatusOptions = computed(() =>
  (
    overview.value?.filters.transactionStatuses ?? ['已发放', '已发放含预算']
  ).map((value) => ({
    label: value,
    value,
  })),
);
const reportDateRangeOptions = [
  { label: '今日', value: 'today' },
  { label: '昨日', value: 'yesterday' },
  { label: '最近7天', value: 'last7' },
  { label: '最近30天', value: 'last30' },
  { label: '本月', value: 'currentMonth' },
  { label: '上月', value: 'lastMonth' },
  { label: '今年', value: 'year' },
  { label: '自定义', value: 'custom' },
];
const reportDateRangeValue = computed({
  get(): [string, string] {
    return [reportQuery.startDate, reportQuery.endDate];
  },
  set(value: [string, string] | null) {
    if (!value?.[0] || !value?.[1]) return;
    reportQuery.startDate = value[0];
    reportQuery.endDate = value[1];
    reportQuery.dateRangeType = 'custom';
  },
});
const reportRows = computed(() => report.value?.rows ?? []);
const reportProductTypeOptions = computed(() => [
  { label: '新品', value: 'new' },
  { label: '老品', value: 'old' },
]);
const reportResponsibleOptions = computed(() => {
  const values =
    report.value?.filters.responsibles ??
    responsibleOptions.value.map((item) => item.value);
  return values.map((value) => ({ label: value, value }));
});
const reportColumnMap = computed(() => {
  const map = new Map<string, AnalyticsReportColumn>();
  for (const column of report.value?.columns ?? []) {
    map.set(column.key, column);
  }
  return map;
});
const reportColumnOptions = computed(() =>
  (report.value?.columns ?? []).map((column) => ({
    label: column.label,
    value: column.key,
  })),
);
const selectedReportColumnMetas = computed(() => {
  const selected = new Set(selectedReportColumns.value);
  const columns: AnalyticsReportColumn[] = [];
  for (const column of report.value?.columns ?? []) {
    if (selected.has(column.key)) {
      columns.push(column);
    }
  }
  return columns;
});
const reportTableColumns = computed<TableColumnsType<AnalyticsReportRow>>(
  () => {
    const columns: TableColumnsType<AnalyticsReportRow> = [];
    for (const column of selectedReportColumnMetas.value) {
      columns.push({
        align: reportColumnAlign(column.kind),
        dataIndex: column.key,
        fixed: fixedReportColumnKeys.has(column.key) ? 'left' : undefined,
        key: column.key,
        sorter: sortableReportFields.has(column.key),
        title: column.label,
        width: reportColumnWidth(column.key),
      });
    }
    return columns;
  },
);
const reportPaginationConfig = computed<TablePaginationConfig>(() => ({
  current: report.value?.pagination.page ?? reportQuery.page,
  pageSize: report.value?.pagination.pageSize ?? reportQuery.pageSize,
  pageSizeOptions: ['20', '50', '100', '200'],
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
  total: report.value?.pagination.total ?? 0,
}));
const reportScrollX = computed(() => {
  let width = 0;
  for (const column of reportTableColumns.value) {
    width += Number(column.width || 110);
  }
  return Math.max(width, 1500);
});

const qtyCompletion = computed(() =>
  nullableRatio(latest.value?.salesQty, targets.value?.dailyTargetUnits),
);
const salesCompletion = computed(() =>
  nullableRatio(latest.value?.salesAmount, targets.value?.dailyTargetSales),
);
const promotionRate = computed(() =>
  ratio(
    advertising.value?.summary.totalSpend,
    advertising.value?.summary.totalSales,
  ),
);
const adAcos = computed(() =>
  ratio(
    advertising.value?.summary.totalSpend,
    advertising.value?.summary.adSales,
  ),
);

const allResponsibleCards = computed<ResponsibleCard[]>(() => {
  return (operations.value?.responsibleRows ?? [])
    .map((row) => ({
      completionRate: ratio(row.salesQty, row.dailyTargetUnits),
      dailyTargetProfit: row.dailyTargetProfit ?? 0,
      dailyTargetSales: row.dailyTargetSales ?? 0,
      dailyTargetUnits: row.dailyTargetUnits ?? 0,
      grossProfit: row.grossProfit,
      inventoryQty: row.inventoryQty,
      name: row.responsible,
      salesAmount: row.salesAmount,
      salesQty: row.salesQty,
      turnoverMonths: row.turnoverMonths,
    }))
    .toSorted((a, b) => {
      const aHasSales = a.salesQty > 0 ? 1 : 0;
      const bHasSales = b.salesQty > 0 ? 1 : 0;
      return (
        bHasSales - aHasSales ||
        a.completionRate - b.completionRate ||
        b.salesQty - a.salesQty
      );
    });
});

const responsibleCards = computed(() => allResponsibleCards.value);
const activeResponsibleCount = computed(
  () => allResponsibleCards.value.filter((item) => item.salesQty > 0).length,
);

const groupCards = computed(() =>
  (overview.value?.filters.operationGroups ?? []).map((group) =>
    buildGroupCard(group, allResponsibleCards.value),
  ),
);

function gaugeOption(rate: null | number, color: string) {
  const percentage = rate === null ? 0 : Math.min(Math.max(rate * 100, 0), 200);
  return {
    series: [
      {
        anchor: {
          itemStyle: { color: '#111827' },
          show: false,
          size: 7,
        },
        axisLabel: {
          color: '#94a3b8',
          distance: -37,
          fontSize: 10,
        },
        axisLine: {
          lineStyle: {
            color: [
              [Math.min(percentage / 200, 1), color],
              [1, '#eef2f7'],
            ],
            width: 10,
          },
        },
        axisTick: { show: false },
        detail: {
          show: false,
        },
        data: [{ value: percentage }],
        endAngle: -40,
        max: 200,
        min: 0,
        pointer: {
          icon: 'path://M2 0 L-2 0 L-1 58 L1 58 Z',
          itemStyle: { color: '#111827' },
          length: '62%',
          show: false,
          width: 4,
        },
        progress: { show: false },
        radius: '92%',
        splitLine: { show: false },
        splitNumber: 4,
        startAngle: 220,
        type: 'gauge',
      },
    ],
  };
}

async function loadData() {
  loading.value = true;
  try {
    overview.value = await fetchAnalyticsOverview({
      departments: query.departments,
      granularity: query.granularity,
      endDate: isMonthMode.value ? undefined : query.endDate,
      operationGroupIds: query.operationGroupIds,
      responsibles: query.responsibles,
      siteDate: query.siteDate,
      sites: query.sites,
      startDate: isMonthMode.value ? undefined : query.startDate,
      transactionStatuses: query.transactionStatuses,
    });
    syncingDashboardQuery = true;
    query.departments = overview.value.query.departments;
    query.granularity = overview.value.query.granularity;
    query.siteDate = overview.value.query.siteDate;
    query.startDate = overview.value.query.startDate;
    query.endDate = overview.value.query.endDate;
    query.transactionStatuses = overview.value.query.transactionStatuses;
    void nextTick(() => {
      syncingDashboardQuery = false;
    });
  } finally {
    loading.value = false;
  }
}

async function loadReportData() {
  reportLoading.value = true;
  try {
    const data = await fetchAnalyticsReport(buildReportParams());
    report.value = data;
    reportQuery.dateRangeType = data.query.dateRangeType as ReportDateRangeType;
    reportQuery.startDate = data.query.startDate;
    reportQuery.endDate = data.query.endDate;
    reportQuery.page = data.pagination.page;
    reportQuery.pageSize = data.pagination.pageSize;
    reportQuery.productTypes = data.query.productTypes;
    reportQuery.responsibles = data.query.responsibles;
    reportQuery.sortField = data.query.sortField || 'salesQty';
    reportQuery.sortOrder = (data.query.sortOrder ||
      'descend') as ReportSortOrder;
    if (!reportColumnsInitialized.value) {
      selectedReportColumns.value = [...data.defaultColumns];
      reportColumnsInitialized.value = true;
    }
  } finally {
    reportLoading.value = false;
  }
}

async function reloadAll(resetReportPage = true) {
  if (resetReportPage) {
    reportQuery.page = 1;
  }
  await loadData();
  await loadReportData();
}

function scheduleDashboardReload(options: { reloadReport?: boolean } = {}) {
  if (!dashboardAutoReloadReady || syncingDashboardQuery) return;
  if (dashboardAutoReloadTimer) {
    clearTimeout(dashboardAutoReloadTimer);
  }
  dashboardAutoReloadTimer = setTimeout(() => {
    dashboardAutoReloadTimer = null;
    void (async () => {
      await loadData();
      if (options.reloadReport) {
        reportQuery.page = 1;
        await loadReportData();
      }
    })();
  }, 250);
}

function resetFilters() {
  query.departments = [];
  query.granularity = 'day';
  query.operationGroupIds = [];
  query.responsibles = [];
  query.startDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  query.endDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  query.siteDate = query.endDate;
  query.sites = [];
  query.transactionStatuses = ['已发放'];
  reportQuery.dateRangeType = 'last30';
  reportQuery.startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  reportQuery.endDate = query.endDate;
  reportQuery.page = 1;
  reportQuery.pageSize = 50;
  reportQuery.productTypes = [];
  reportQuery.responsibles = [];
  reportQuery.sortField = 'salesQty';
  reportQuery.sortOrder = 'descend';
  void reloadAll(false);
}

function disabledFutureDate(value: ReturnType<typeof dayjs>) {
  return value.isAfter(dayjs(), isMonthMode.value ? 'month' : 'day');
}

function ratio(numerator?: null | number, denominator?: null | number) {
  return Number(denominator || 0) > 0
    ? Number(numerator || 0) / Number(denominator)
    : 0;
}

function nullableRatio(numerator?: null | number, denominator?: null | number) {
  return Number(denominator || 0) > 0
    ? Number(numerator || 0) / Number(denominator)
    : null;
}

function change(current?: null | number, before?: null | number) {
  return before ? (Number(current || 0) - before) / Math.abs(before) : null;
}

function difference(current?: null | number, before?: null | number) {
  if (
    current === null ||
    current === undefined ||
    before === null ||
    before === undefined
  ) {
    return null;
  }
  return Number(current || 0) - Number(before || 0);
}

function formatInteger(value?: null | number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  });
}

function formatSignedInteger(value?: null | number) {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${value >= 0 ? '+' : ''}${formatInteger(value)}`;
}

function formatMoney(value?: null | number, fractionDigits = 0) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })}`;
}

function formatSignedMoney(value?: null | number, fractionDigits = 0) {
  if (value === null || value === undefined) {
    return '-';
  }
  const absolute = `¥${Math.abs(Number(value || 0)).toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })}`;
  return `${value >= 0 ? '+' : '-'}${absolute}`;
}

function formatSalesMoney(value?: null | number) {
  return formatMoney(value, isMonthMode.value ? 2 : 0);
}

function formatSignedSalesMoney(value?: null | number) {
  return formatSignedMoney(value, isMonthMode.value ? 2 : 0);
}

function formatUsd(value?: null | number) {
  return `$${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  })}`;
}

function formatPercent(value?: null | number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function periodRangeLabel(start?: string, end?: string) {
  if (!start || !end) return '-';
  const startValue = dayjs(start);
  const endValue = dayjs(end);
  if (!startValue.isValid() || !endValue.isValid()) return '-';
  if (startValue.isSame(endValue, 'day')) {
    return startValue.format('YYYY-MM-DD');
  }
  if (startValue.isSame(endValue, 'month')) {
    return `${startValue.format('YYYY-MM-DD')} ~ ${endValue.format('DD')}`;
  }
  return `${startValue.format('YYYY-MM-DD')} ~ ${endValue.format('YYYY-MM-DD')}`;
}

function comparisonText(current?: null | number, before?: null | number) {
  const value = change(current, before);
  if (value === null) return '-';
  return `${value >= 0 ? '+' : ''}${formatPercent(value)}`;
}

function completionText(rate: null | number) {
  return rate === null ? '--' : `${(rate * 100).toFixed(1)}%`;
}

function comparisonDeltaText(
  current: null | number | undefined,
  before: null | number | undefined,
  formatter: (value?: null | number) => string,
) {
  return formatter(difference(current, before));
}

function comparisonClass(
  current?: null | number,
  before?: null | number,
  inverse = false,
) {
  const value = change(current, before);
  if (value === null) return 'neutral';
  const good = inverse ? value <= 0 : value >= 0;
  return good ? 'good' : 'bad';
}

function turnover(value?: null | number) {
  return value ? value.toFixed(2) : '0.00';
}

function buildGroupCard(
  group: AnalyticsOperationGroup,
  rows: ResponsibleCard[],
) {
  const names = new Set(group.memberNames);
  const members = rows.filter((row) => names.has(row.name));
  let salesQty = 0;
  let dailyTargetUnits = 0;
  let grossProfit = 0;
  let dailyTargetProfit = 0;
  let salesAmount = 0;
  let dailyTargetSales = 0;
  for (const row of members) {
    salesQty += row.salesQty;
    dailyTargetUnits += row.dailyTargetUnits;
    grossProfit += row.grossProfit;
    dailyTargetProfit += row.dailyTargetProfit;
    salesAmount += row.salesAmount;
    dailyTargetSales += row.dailyTargetSales;
  }
  return {
    completionRate: ratio(salesQty, dailyTargetUnits),
    dailyTargetProfit,
    dailyTargetSales,
    dailyTargetUnits,
    grossProfit,
    memberCount: group.memberNames.length,
    name: group.name,
    profitCompletionRate: ratio(grossProfit, dailyTargetProfit),
    salesAmount,
    salesCompletionRate: ratio(salesAmount, dailyTargetSales),
    salesQty,
  };
}

function completionColor(value: number) {
  if (value >= 1) return 'success';
  if (value >= 0.8) return 'warning';
  return 'error';
}

function reportColumnAlign(
  kind: AnalyticsReportColumn['kind'],
): 'left' | 'right' {
  return ['decimal', 'money', 'number', 'percent'].includes(kind)
    ? 'right'
    : 'left';
}

function reportColumnKey(column: unknown) {
  if (!column || typeof column !== 'object') return '';
  const value = (column as { dataIndex?: unknown }).dataIndex;
  return String(value ?? '');
}

function isReportNumberColumn(column: unknown) {
  const kind =
    reportColumnMap.value.get(reportColumnKey(column))?.kind ?? 'text';
  return reportColumnAlign(kind) === 'right';
}

function reportColumnWidth(key: string) {
  const widthMap: Record<string, number> = {
    asinList: 170,
    category1: 116,
    category2: 116,
    country: 84,
    imageUrl: 70,
    parentAsin: 122,
    productType: 88,
    responsible: 96,
    salesTrend: 148,
    shopName: 132,
    spu: 108,
  };
  return widthMap[key] ?? 104;
}

function reportResponsiblesForRequest() {
  if (query.responsibles.length > 0 && reportQuery.responsibles.length > 0) {
    const base = new Set(query.responsibles);
    return reportQuery.responsibles.filter((item) => base.has(item));
  }
  return reportQuery.responsibles.length > 0
    ? reportQuery.responsibles
    : query.responsibles;
}

function buildReportParams(overrides: Record<string, any> = {}) {
  return {
    dateRangeType: reportQuery.dateRangeType,
    departments: query.departments,
    endDate: reportQuery.endDate,
    operationGroupIds: query.operationGroupIds,
    page: reportQuery.page,
    pageSize: reportQuery.pageSize,
    productTypes: reportQuery.productTypes,
    responsibles: reportResponsiblesForRequest(),
    siteDate: reportQuery.endDate,
    sites: query.sites,
    sortField: reportQuery.sortField,
    sortOrder: reportQuery.sortOrder,
    startDate: reportQuery.startDate,
    ...overrides,
  };
}

function formatReportValue(key: string, value: any) {
  const column = reportColumnMap.value.get(key);
  if (!column) return value ?? '-';
  if (value === null || value === undefined || value === '') return '-';
  if (column.kind === 'percent') return formatPercent(Number(value));
  if (column.kind === 'money') return formatMoney(Number(value), 2);
  if (column.kind === 'decimal') {
    return Number(value).toLocaleString('zh-CN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  if (column.kind === 'number') {
    const numberValue = Number(value);
    return numberValue.toLocaleString('zh-CN', {
      maximumFractionDigits: Number.isInteger(numberValue) ? 0 : 2,
    });
  }
  if (key === 'productType') return value === 'new' ? '新品' : '老品';
  return String(value);
}

function reportSummaryValue(key: string, index: number) {
  if (index === 0) return '合计';
  return formatReportValue(key, report.value?.summary?.[key]);
}

function reportSummaryCellClass(column: AnalyticsReportColumn, index: number) {
  return {
    'report-number': reportColumnAlign(column.kind) === 'right',
    'report-summary-label': index === 0,
  };
}

function sparklinePoints(points: AnalyticsReportRow['salesTrend']) {
  if (!points || points.length === 0) return '';
  let max = 0;
  for (const point of points) {
    max = Math.max(max, Number(point.sales || 0));
  }
  const width = 118;
  const height = 34;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords: string[] = [];
  points.forEach((point, index) => {
    const y =
      max > 0 ? height - (Number(point.sales || 0) / max) * height : height;
    coords.push(`${Math.round(index * step)},${Math.max(2, Math.round(y))}`);
  });
  return coords.join(' ');
}

function reportTrendTitle(points: AnalyticsReportRow['salesTrend']) {
  if (!points || points.length === 0) return '无趋势数据';
  let total = 0;
  for (const point of points) {
    total += Number(point.sales || 0);
  }
  return `${points[0]?.date} ~ ${points.at(-1)?.date}，销量 ${formatInteger(
    total,
  )}`;
}

function syncReportSummaryScroll(left: number, source: 'body' | 'summary') {
  if (reportScrollSyncing) return;
  reportScrollSyncing = true;
  if (source === 'body' && reportSummaryScroll.value) {
    reportSummaryScroll.value.scrollLeft = left;
  }
  if (source === 'summary' && reportBodyScrollElement) {
    reportBodyScrollElement.scrollLeft = left;
  }
  requestAnimationFrame(() => {
    reportScrollSyncing = false;
  });
}

function handleReportBodyScroll(event: Event) {
  syncReportSummaryScroll((event.target as HTMLElement).scrollLeft, 'body');
}

function handleReportSummaryScroll(event: Event) {
  syncReportSummaryScroll((event.target as HTMLElement).scrollLeft, 'summary');
}

function syncGroupCompletionScroll(source: 'sales' | 'units', top: number) {
  if (groupScrollSyncing) return;
  const target = source === 'units' ? groupSalesScroll.value : groupUnitsScroll.value;
  if (!target) return;
  groupScrollSyncing = true;
  target.scrollTop = top;
  requestAnimationFrame(() => {
    groupScrollSyncing = false;
  });
}

function handleGroupUnitsScroll(event: Event) {
  syncGroupCompletionScroll('units', (event.target as HTMLElement).scrollTop);
}

function handleGroupSalesScroll(event: Event) {
  syncGroupCompletionScroll('sales', (event.target as HTMLElement).scrollTop);
}

function bindReportBodyScroll() {
  const root = reportSummaryScroll.value?.closest('.report-panel');
  const nextBody = root?.querySelector('.ant-table-body') as HTMLElement | null;
  if (reportBodyScrollElement === nextBody) return;
  if (reportBodyScrollElement) {
    reportBodyScrollElement.removeEventListener(
      'scroll',
      handleReportBodyScroll,
    );
  }
  reportBodyScrollElement = nextBody;
  if (reportBodyScrollElement) {
    reportBodyScrollElement.addEventListener('scroll', handleReportBodyScroll, {
      passive: true,
    });
  }
}

function handleReportTableReady() {
  void nextTick(() => {
    bindReportBodyScroll();
  });
}

function handleReportTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: any,
) {
  reportQuery.page = Number(pagination.current || 1);
  reportQuery.pageSize = Number(pagination.pageSize || 50);
  const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  if (activeSorter?.field && activeSorter.order) {
    reportQuery.sortField = String(activeSorter.field);
    reportQuery.sortOrder = activeSorter.order;
  } else {
    reportQuery.sortField = 'salesQty';
    reportQuery.sortOrder = 'descend';
  }
  void loadReportData();
}

function csvCell(value: any) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

async function downloadReportCsv() {
  if (reportDownloading.value) return;
  reportDownloading.value = true;
  try {
    const rows: AnalyticsReportRow[] = [];
    let page = 1;
    let total = 0;
    do {
      const data = await fetchAnalyticsReport(
        buildReportParams({ page, pageSize: 200 }),
      );
      total = data.pagination.total;
      for (const row of data.rows) {
        rows.push(row);
      }
      page += 1;
    } while (rows.length < total);

    const headers: string[] = [];
    const keys: string[] = [];
    for (const column of selectedReportColumnMetas.value) {
      headers.push(column.label);
      keys.push(column.key);
    }
    const lines = [headers.map((value) => csvCell(value)).join(',')];
    for (const row of rows) {
      const cells: string[] = [];
      for (const key of keys) {
        const value =
          key === 'salesTrend'
            ? reportTrendTitle(row.salesTrend)
            : formatReportValue(key, row[key]);
        cells.push(csvCell(value));
      }
      lines.push(cells.join(','));
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-report-${reportQuery.startDate}-${reportQuery.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    reportDownloading.value = false;
  }
}

watch(
  () => [reportTableColumns.value.length, reportRows.value.length],
  () => {
    handleReportTableReady();
  },
);

watch(
  () => [
    query.departments.join('|'),
    query.operationGroupIds.join('|'),
    query.responsibles.join('|'),
    query.sites.join('|'),
  ],
  () => scheduleDashboardReload({ reloadReport: true }),
);

watch(
  () => [
    query.endDate,
    query.granularity,
    query.siteDate,
    query.startDate,
    query.transactionStatuses.join('|'),
  ],
  () => scheduleDashboardReload(),
);

onMounted(() => {
  void (async () => {
    await reloadAll(false);
    dashboardAutoReloadReady = true;
  })();
});

onBeforeUnmount(() => {
  if (dashboardAutoReloadTimer) {
    clearTimeout(dashboardAutoReloadTimer);
  }
  if (reportBodyScrollElement) {
    reportBodyScrollElement.removeEventListener(
      'scroll',
      handleReportBodyScroll,
    );
  }
});
</script>

<template>
  <Spin :spinning="loading">
    <div class="completion-screen">
      <section class="screen-toolbar">
        <span class="toolbar-flag">▼</span>
        <label>维度</label>
        <Select
          v-model:value="query.granularity"
          :options="granularityOptions"
          size="small"
          style="width: 74px"
        />
        <label>{{ dateLabel }}</label>
        <DatePicker
          v-if="isMonthMode"
          v-model:value="monthValue"
          :allow-clear="false"
          :disabled-date="disabledFutureDate"
          picker="month"
          size="small"
          value-format="YYYY-MM"
        />
        <DatePicker.RangePicker
          v-else
          v-model:value="dateRangeValue"
          :allow-clear="false"
          :disabled-date="disabledFutureDate"
          size="small"
          value-format="YYYY-MM-DD"
        />
        <label>站点</label>
        <Select
          v-model:value="query.sites"
          :options="siteOptions"
          allow-clear
          mode="multiple"
          placeholder="全部"
          size="small"
          style="min-width: 110px"
        />
        <label>交易状态</label>
        <Select
          v-model:value="query.transactionStatuses"
          :options="transactionStatusOptions"
          allow-clear
          mode="multiple"
          placeholder="已发放"
          size="small"
          style="min-width: 150px"
        />
        <label>部门</label>
        <Select
          v-model:value="query.departments"
          :options="departmentOptions"
          allow-clear
          mode="multiple"
          placeholder="全部"
          size="small"
          style="min-width: 130px"
        />
        <label>运营组</label>
        <Select
          v-model:value="query.operationGroupIds"
          :options="operationGroupOptions"
          allow-clear
          mode="multiple"
          placeholder="全部"
          size="small"
          style="min-width: 140px"
        />
        <label>负责人</label>
        <Select
          v-model:value="query.responsibles"
          :options="responsibleOptions"
          allow-clear
          mode="multiple"
          placeholder="全部"
          size="small"
          style="min-width: 140px"
        />
        <Button size="small" @click="resetFilters">重置</Button>

        <Tag :color="source?.status === 'ok' ? 'green' : 'orange'">
          {{ source?.message || '等待查询' }}
        </Tag>
      </section>

      <section class="top-board">
        <aside class="gauge-column">
          <div class="white-panel gauge-panel">
            <div class="panel-heading">
              <h2>销量完成率</h2>
              <span>{{ targetHint }}</span>
            </div>
            <div class="gauge-visual">
              <VChart
                autoresize
                class="gauge-chart"
                :option="gaugeOption(qtyCompletion, '#facc15')"
              />
              <div class="gauge-center">
                <strong>{{ formatInteger(latest?.salesQty) }}</strong>
                <span>{{ completionText(qtyCompletion) }}</span>
              </div>
            </div>
            <p>
              实际 {{ formatInteger(latest?.salesQty) }} / 目标
              {{ formatInteger(targets?.dailyTargetUnits) }}
            </p>
          </div>

          <div class="white-panel gauge-panel">
            <div class="panel-heading">
              <h2>销售额完成率</h2>
              <span>{{ targetHint }}</span>
            </div>
            <div class="gauge-visual">
              <VChart
                autoresize
                class="gauge-chart"
                :option="gaugeOption(salesCompletion, '#facc15')"
              />
              <div class="gauge-center">
                <strong>{{ formatSalesMoney(latest?.salesAmount) }}</strong>
                <span>{{ completionText(salesCompletion) }}</span>
              </div>
            </div>
            <p>
              实际 {{ formatSalesMoney(latest?.salesAmount) }} / 目标
              {{ formatSalesMoney(targets?.dailyTargetSales) }}
            </p>
          </div>
        </aside>

        <main class="sales-column">
          <div class="yellow-grid">
            <div class="metric-stack yellow-stack">
              <div class="hero-card yellow-card">
                <span>{{ metricPrefix }}销量</span>
                <strong>{{ formatInteger(latest?.salesQty) }}</strong>
                <em>SALES VOLUME · 最新快照</em>
              </div>
              <div class="comparison-card metric-comparison-card yellow-detail">
                <div>
                  <span>{{ previousLabel }}销量</span>
                  <strong>{{ formatInteger(previous?.salesQty) }}</strong>
                </div>
                <div>
                  <span>{{ previousLabel }}差值</span>
                  <strong
                    :class="
                      comparisonClass(latest?.salesQty, previous?.salesQty)
                    "
                  >
                    {{
                      comparisonDeltaText(
                        latest?.salesQty,
                        previous?.salesQty,
                        formatSignedInteger,
                      )
                    }}
                  </strong>
                </div>
                <div>
                  <span>{{ previousLabel }}差异</span>
                  <strong
                    :class="
                      comparisonClass(latest?.salesQty, previous?.salesQty)
                    "
                  >
                    {{ comparisonText(latest?.salesQty, previous?.salesQty) }}
                  </strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}</span>
                  <strong>{{ formatInteger(weekBefore?.salesQty) }}</strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}差值</span>
                  <strong
                    :class="
                      comparisonClass(latest?.salesQty, weekBefore?.salesQty)
                    "
                  >
                    {{
                      comparisonDeltaText(
                        latest?.salesQty,
                        weekBefore?.salesQty,
                        formatSignedInteger,
                      )
                    }}
                  </strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}差异</span>
                  <strong
                    :class="
                      comparisonClass(latest?.salesQty, weekBefore?.salesQty)
                    "
                  >
                    {{ comparisonText(latest?.salesQty, weekBefore?.salesQty) }}
                  </strong>
                </div>
              </div>
            </div>

            <div class="metric-stack yellow-stack">
              <div class="hero-card yellow-card">
                <span>{{ metricPrefix }}销售额</span>
                <strong>{{ formatSalesMoney(latest?.salesAmount) }}</strong>
                <em>SALES REVENUE · 最新快照</em>
              </div>
              <div class="comparison-card metric-comparison-card yellow-detail">
                <div>
                  <span>{{ previousLabel }}销售额</span>
                  <strong>{{ formatSalesMoney(previous?.salesAmount) }}</strong>
                </div>
                <div>
                  <span>{{ previousLabel }}差值</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.salesAmount,
                        previous?.salesAmount,
                      )
                    "
                  >
                    {{
                      comparisonDeltaText(
                        latest?.salesAmount,
                        previous?.salesAmount,
                        formatSignedSalesMoney,
                      )
                    }}
                  </strong>
                </div>
                <div>
                  <span>{{ previousLabel }}差异</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.salesAmount,
                        previous?.salesAmount,
                      )
                    "
                  >
                    {{
                      comparisonText(latest?.salesAmount, previous?.salesAmount)
                    }}
                  </strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}</span>
                  <strong>{{
                    formatSalesMoney(weekBefore?.salesAmount)
                  }}</strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}差值</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.salesAmount,
                        weekBefore?.salesAmount,
                      )
                    "
                  >
                    {{
                      comparisonDeltaText(
                        latest?.salesAmount,
                        weekBefore?.salesAmount,
                        formatSignedSalesMoney,
                      )
                    }}
                  </strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}差异</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.salesAmount,
                        weekBefore?.salesAmount,
                      )
                    "
                  >
                    {{
                      comparisonText(
                        latest?.salesAmount,
                        weekBefore?.salesAmount,
                      )
                    }}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div class="white-panel group-panel">
            <div class="panel-heading">
              <h2>{{ metricPrefix }}销量完成率 - 运营组维度</h2>
              <span>{{ targetHint }}</span>
            </div>
            <div
              v-if="groupCards.length > 0"
              ref="groupUnitsScroll"
              class="group-placeholder group-scroll"
              @scroll="handleGroupUnitsScroll"
            >
              <div v-for="item in groupCards" :key="item.name">
                <b>{{ item.name }}</b>
                <strong>{{ formatPercent(item.completionRate) }}</strong>
                <span>
                  销量 {{ formatInteger(item.salesQty) }} / {{ targetLabel }}
                  {{ formatInteger(item.dailyTargetUnits) }}
                </span>
              </div>
            </div>
            <p v-else class="pending-text">请先在配置中心维护运营组</p>
          </div>

          <div class="white-panel group-panel">
            <div class="panel-heading">
              <h2>{{ metricPrefix }}销售额完成率 - 运营组维度</h2>
              <span>{{ targetHint }}</span>
            </div>
            <div
              v-if="groupCards.length > 0"
              ref="groupSalesScroll"
              class="group-placeholder group-scroll"
              @scroll="handleGroupSalesScroll"
            >
              <div v-for="item in groupCards" :key="item.name">
                <b>{{ item.name }}</b>
                <strong>{{ formatPercent(item.salesCompletionRate) }}</strong>
                <span>
                  销售额 {{ formatSalesMoney(item.salesAmount) }} /
                  {{ targetLabel }}
                  {{ formatSalesMoney(item.dailyTargetSales) }}
                </span>
              </div>
            </div>
            <p v-else class="pending-text">请先在配置中心维护运营组</p>
          </div>
        </main>

        <aside class="tracking-column">
          <div class="blue-grid">
            <div class="metric-stack">
              <div class="hero-card blue-card">
                <span>推广占比</span>
                <strong>{{ formatPercent(promotionRate) }}</strong>
                <em>{{ currentPeriodLabel }} 内广告花费绝对值 / 总销售额</em>
              </div>
              <div class="comparison-card blue-detail">
                <div>
                  <span>广告花费</span>
                  <strong>{{
                    formatUsd(advertising?.summary.totalSpend)
                  }}</strong>
                </div>
                <div>
                  <span>广告 ACOS</span>
                  <strong>{{ formatPercent(adAcos) }}</strong>
                </div>
                <div>
                  <span>统计区间</span>
                  <strong class="period-value">{{ currentPeriodLabel }}</strong>
                </div>
                <div>
                  <span>总销售额</span>
                  <strong>{{
                    formatSalesMoney(advertising?.summary.totalSales)
                  }}</strong>
                </div>
              </div>
            </div>

            <div class="metric-stack">
              <div class="hero-card blue-card">
                <span>周转周期(月)</span>
                <strong>{{ turnover(latest?.turnoverMonths) }}</strong>
                <em>{{ currentPeriodLabel }} 内周转库存 / 销售速度 / 30</em>
              </div>
              <div class="comparison-card blue-detail">
                <div>
                  <span>{{ previousLabel }}周转</span>
                  <strong>{{ turnover(previous?.turnoverMonths) }}</strong>
                  <small>{{ previousPeriodLabel }}</small>
                </div>
                <div>
                  <span>{{ previousLabel }}差异</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.turnoverMonths,
                        previous?.turnoverMonths,
                        true,
                      )
                    "
                  >
                    {{
                      comparisonText(
                        latest?.turnoverMonths,
                        previous?.turnoverMonths,
                      )
                    }}
                  </strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}周转</span>
                  <strong>{{ turnover(weekBefore?.turnoverMonths) }}</strong>
                  <small>{{ secondaryPeriodLabel }}</small>
                </div>
                <div>
                  <span>{{ secondaryLabel }}差异</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.turnoverMonths,
                        weekBefore?.turnoverMonths,
                        true,
                      )
                    "
                  >
                    {{
                      comparisonText(
                        latest?.turnoverMonths,
                        weekBefore?.turnoverMonths,
                      )
                    }}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div class="white-panel responsible-panel">
            <div class="panel-heading">
              <h2>{{ metricPrefix }}销量完成率 - 运营负责人维度</h2>
              <span>
                展示 {{ responsibleCards.length }} 人， 有销量
                {{ activeResponsibleCount }} 人
              </span>
            </div>
            <div v-if="responsibleCards.length > 0" class="responsible-grid">
              <article v-for="item in responsibleCards" :key="item.name">
                <div>
                  <strong>{{ item.name }}</strong>
                  <Tag :color="completionColor(item.completionRate)">
                    {{ formatPercent(item.completionRate) }}
                  </Tag>
                </div>
                <p>
                  {{ metricPrefix }}销量
                  <b>{{ formatInteger(item.salesQty) }}</b>
                </p>
                <p>
                  {{ targetLabel }}销量
                  <b>{{ formatInteger(item.dailyTargetUnits) }}</b>
                </p>
                <p>
                  {{ targetLabel }}毛利
                  <b>{{ formatMoney(item.dailyTargetProfit) }}</b>
                </p>
                <p>
                  {{ targetLabel }}销售额
                  <b>{{ formatSalesMoney(item.dailyTargetSales) }}</b>
                </p>
                <p>
                  {{ metricPrefix }}毛利
                  <b>{{ formatMoney(item.grossProfit) }}</b>
                </p>
                <p>
                  {{ metricPrefix }}销售额
                  <b>{{ formatSalesMoney(item.salesAmount) }}</b>
                </p>
                <p>
                  库存周转(月) <b>{{ turnover(item.turnoverMonths) }}</b>
                </p>
                <p>
                  库存数量 <b>{{ formatInteger(item.inventoryQty) }}</b>
                </p>
              </article>
            </div>
            <Empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" />
          </div>
        </aside>
      </section>

      <section class="white-panel report-panel">
        <div class="report-heading">
          <div>
            <h2>商品维度明细报表</h2>
            <span>
              {{ report?.query.startDate }} ~ {{ report?.query.endDate }}，共
              {{ formatInteger(report?.pagination.total) }} 条
            </span>
          </div>
          <div class="report-actions">
            <label>时间</label>
            <Select
              v-model:value="reportQuery.dateRangeType"
              :options="reportDateRangeOptions"
              size="small"
              style="width: 104px"
              @change="
                () => {
                  reportQuery.page = 1;
                  loadReportData();
                }
              "
            />
            <DatePicker.RangePicker
              v-if="reportQuery.dateRangeType === 'custom'"
              v-model:value="reportDateRangeValue"
              :allow-clear="false"
              :disabled-date="disabledFutureDate"
              size="small"
              value-format="YYYY-MM-DD"
              @change="
                () => {
                  reportQuery.page = 1;
                  loadReportData();
                }
              "
            />
            <label>新品/老品</label>
            <Select
              v-model:value="reportQuery.productTypes"
              :options="reportProductTypeOptions"
              allow-clear
              mode="multiple"
              placeholder="全部"
              size="small"
              style="min-width: 118px"
              @change="
                () => {
                  reportQuery.page = 1;
                  loadReportData();
                }
              "
            />
            <label>负责人</label>
            <Select
              v-model:value="reportQuery.responsibles"
              :options="reportResponsibleOptions"
              allow-clear
              mode="multiple"
              placeholder="继承主筛选"
              size="small"
              style="min-width: 150px"
              @change="
                () => {
                  reportQuery.page = 1;
                  loadReportData();
                }
              "
            />
            <label>列</label>
            <Select
              v-model:value="selectedReportColumns"
              :max-tag-count="2"
              :options="reportColumnOptions"
              mode="multiple"
              placeholder="选择展示列"
              size="small"
              style="min-width: 230px"
            />
            <Button
              :loading="reportDownloading"
              size="small"
              @click="downloadReportCsv"
            >
              下载
            </Button>
          </div>
        </div>
        <Table
          bordered
          class="report-table"
          :columns="reportTableColumns"
          :data-source="reportRows"
          :loading="reportLoading"
          :pagination="reportPaginationConfig"
          row-key="key"
          :scroll="{ x: reportScrollX, y: 430 }"
          size="small"
          @change="handleReportTableChange"
        >
          <template #bodyCell="{ column, record, text }">
            <template v-if="column.dataIndex === 'imageUrl'">
              <img
                v-if="text"
                :alt="record.parentAsin"
                class="report-image"
                :src="text"
              />
              <span v-else class="report-empty">-</span>
            </template>
            <template v-else-if="column.dataIndex === 'productType'">
              <Tag :color="record.productType === 'new' ? 'green' : 'blue'">
                {{ record.productType === 'new' ? '新品' : '老品' }}
              </Tag>
            </template>
            <template v-else-if="column.dataIndex === 'salesTrend'">
              <svg
                class="report-sparkline"
                preserveAspectRatio="none"
                :title="reportTrendTitle(record.salesTrend)"
                viewBox="0 0 118 38"
              >
                <polyline
                  fill="none"
                  :points="sparklinePoints(record.salesTrend)"
                  stroke="#2563eb"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </template>
            <template v-else>
              <span
                :class="{ 'report-number': isReportNumberColumn(column) }"
                :title="formatReportValue(reportColumnKey(column), text)"
              >
                {{ formatReportValue(reportColumnKey(column), text) }}
              </span>
            </template>
          </template>
          <template #footer>
            <div
              ref="reportSummaryScroll"
              class="report-summary-scroll"
              @scroll="handleReportSummaryScroll"
            >
              <div
                class="report-summary-grid"
                :style="{ minWidth: `${reportScrollX}px` }"
              >
                <div
                  v-for="(column, index) in selectedReportColumnMetas"
                  :key="column.key"
                  :class="reportSummaryCellClass(column, index)"
                  :style="{ width: `${reportColumnWidth(column.key)}px` }"
                  :title="reportSummaryValue(column.key, index)"
                >
                  {{ reportSummaryValue(column.key, index) }}
                </div>
              </div>
            </div>
          </template>
        </Table>
      </section>

      <footer class="screen-note">
        当前已接入：日/月维度、利润表经营数据、目标完成率、推广占比、库存快照、运营组配置、负责人完成率和商品维度明细报表。
      </footer>
    </div>
  </Spin>
</template>

<style scoped>
.completion-screen {
  min-height: calc(100vh - 92px);
  padding: 10px;
  color: #334155;
  background: #eef2f7;
}

.screen-toolbar,
.top-board,
.yellow-grid,
.blue-grid,
.group-placeholder,
.responsible-grid {
  display: grid;
  gap: 8px;
}

.screen-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
  min-height: 40px;
  padding: 5px 9px;
  margin-bottom: 8px;
  font-size: 11px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.toolbar-flag {
  color: #ef4444;
}

.screen-toolbar label {
  color: #1d4ed8;
}

.top-board {
  grid-template-columns: 242px minmax(530px, 1fr) 490px;
}

.gauge-column,
.sales-column,
.tracking-column,
.metric-stack {
  display: grid;
  gap: 8px;
  align-content: start;
}

.white-panel,
.hero-card,
.comparison-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
}

.white-panel {
  padding: 10px;
}

.panel-heading {
  display: flex;
  gap: 6px;
  align-items: baseline;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 13px;
  color: #334155;
}

.panel-heading span,
.gauge-panel p,
.hero-card span,
.hero-card em,
.comparison-card span,
.group-placeholder span,
.screen-note {
  font-size: 11px;
  font-style: normal;
  color: #94a3b8;
}

.gauge-panel {
  min-height: 241px;
}

.gauge-visual {
  position: relative;
  height: 181px;
}

.gauge-chart {
  height: 100%;
}

.gauge-center {
  position: absolute;
  top: 51%;
  left: 50%;
  display: grid;
  gap: 3px;
  width: 150px;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.gauge-center strong,
.gauge-center span {
  display: block;
  text-align: center;
}

.gauge-center strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 850;
  line-height: 1.1;
  color: #111827;
  white-space: nowrap;
}

.gauge-center span {
  font-size: 12px;
  font-weight: 800;
  color: #64748b;
}

.gauge-panel p {
  margin: -5px 0 0;
  text-align: center;
}

.pending-text {
  color: #f59e0b !important;
}

.yellow-grid,
.blue-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.hero-card {
  position: relative;
  min-height: 126px;
  padding: 17px 20px;
  overflow: hidden;
}

.hero-card::after {
  position: absolute;
  right: -20px;
  bottom: -62px;
  width: 150px;
  height: 150px;
  content: '';
  border: 17px solid rgb(255 255 255 / 15%);
  border-radius: 50%;
}

.hero-card span,
.hero-card em {
  display: block;
  color: rgb(255 255 255 / 80%);
}

.hero-card strong {
  display: block;
  margin: 7px 0 4px;
  font-size: 38px;
  color: #fff;
  letter-spacing: 1px;
}

.yellow-card {
  background: linear-gradient(135deg, #f59e0b, #facc15);
}

.blue-card {
  background: linear-gradient(135deg, #3730a3, #2563eb);
}

.blue-card strong {
  color: #fde047;
}

.comparison-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: 140px;
  overflow: hidden;
}

.metric-comparison-card {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.comparison-card div {
  padding: 13px 15px;
}

.comparison-card div:nth-child(odd) {
  border-right: 1px solid rgb(255 255 255 / 18%);
}

.comparison-card div:nth-child(-n + 2) {
  border-bottom: 1px solid rgb(255 255 255 / 18%);
}

.metric-comparison-card div:nth-child(odd) {
  border-right: 0;
}

.metric-comparison-card div {
  border-right: 1px solid rgb(255 255 255 / 18%);
}

.metric-comparison-card div:nth-child(3n) {
  border-right: 0;
}

.metric-comparison-card div:nth-child(-n + 3) {
  border-bottom: 1px solid rgb(255 255 255 / 18%);
}

.comparison-card span,
.comparison-card strong,
.comparison-card small {
  display: block;
}

.comparison-card strong {
  margin-top: 5px;
  font-size: 17px;
}

.comparison-card small {
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  line-height: 1.25;
  color: inherit;
  white-space: nowrap;
  opacity: 0.74;
}

.comparison-card .period-value {
  font-size: 15px;
  line-height: 1.35;
  white-space: normal;
}

.yellow-detail {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-color: #fde68a;
}

.yellow-detail span {
  color: #a16207;
}

.blue-detail {
  color: #fff;
  background: linear-gradient(135deg, #3730a3, #2563eb);
  border-color: #4f46e5;
}

.blue-detail span {
  color: #bfdbfe;
}

.group-panel {
  min-height: 0;
}

.group-placeholder {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 9px;
}

.group-scroll {
  max-height: 180px;
  padding-right: 4px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.group-placeholder div {
  padding: 10px;
  background: #f8fafc;
  border-left: 4px solid #cbd5e1;
}

.group-placeholder b,
.group-placeholder strong,
.group-placeholder span {
  display: block;
}

.group-placeholder strong {
  margin: 5px 0;
  font-size: 22px;
  color: #94a3b8;
}

.responsible-panel {
  min-height: 0;
}

.responsible-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  max-height: 490px;
  padding-right: 4px;
  margin-top: 8px;
  overflow-y: auto;
}

.responsible-grid article {
  min-height: 158px;
  padding: 9px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.responsible-grid article > div {
  display: flex;
  gap: 5px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
}

.responsible-grid p {
  display: flex;
  justify-content: space-between;
  margin: 4px 0;
  font-size: 10px;
  color: #64748b;
}

.responsible-grid b {
  color: #334155;
}

.good {
  color: #16a34a !important;
}

.bad {
  color: #ef4444 !important;
}

.neutral {
  color: #94a3b8 !important;
}

.report-panel {
  margin-top: 8px;
}

.report-heading,
.report-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.report-heading {
  justify-content: space-between;
  margin-bottom: 8px;
}

.report-heading span,
.report-actions label,
.report-empty {
  font-size: 11px;
  color: #64748b;
}

.report-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.report-table :deep(.ant-table) {
  border-color: #cbd5e1;
}

.report-table :deep(.ant-table-thead > tr > th),
.report-table :deep(.ant-table-tbody > tr > td),
.report-table :deep(.ant-table-summary > tr > td) {
  border-color: #cbd5e1 !important;
}

.report-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  background: #f8fafc;
}

.report-table :deep(.ant-table-tbody > tr > td) {
  font-size: 12px;
  color: #334155;
  background: #fff;
}

.report-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #eff6ff;
}

.report-table :deep(.ant-table-footer) {
  padding: 0;
  overflow: hidden;
  background: #fff7ed;
  border-top: 2px solid #94a3b8;
}

.report-image {
  display: block;
  width: 42px;
  height: 42px;
  object-fit: cover;
  border: 1px solid #dbe3ef;
  border-radius: 4px;
}

.report-number {
  display: block;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.report-sparkline {
  display: block;
  width: 118px;
  height: 38px;
  background: linear-gradient(180deg, #f8fafc, #fff);
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.report-summary-scroll {
  width: 100%;
  overflow: auto hidden;
}

.report-summary-grid {
  display: flex;
  min-height: 38px;
  font-size: 12px;
  font-weight: 800;
  color: #111827;
  background: #fff7ed;
}

.report-summary-grid > div {
  flex: 0 0 auto;
  min-width: 0;
  padding: 9px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid #cbd5e1;
}

.report-summary-grid > div:first-child {
  border-left: 0;
}

.report-summary-grid .report-number {
  text-align: right;
}

.report-summary-label {
  color: #0f172a;
}

.screen-note {
  padding: 8px 10px;
  margin-top: 8px;
  color: #64748b;
  background: #fff;
  border: 1px dashed #cbd5e1;
}

@media (width <= 1420px) {
  .top-board {
    grid-template-columns: 220px minmax(480px, 1fr) 430px;
  }

  .responsible-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 1150px) {
  .top-board {
    grid-template-columns: 1fr;
  }

  .gauge-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .screen-toolbar {
    display: flex;
    flex-wrap: wrap;
  }
}

@media (width <= 640px) {
  .yellow-grid,
  .blue-grid,
  .gauge-column,
  .responsible-grid {
    grid-template-columns: 1fr;
  }
}
</style>
