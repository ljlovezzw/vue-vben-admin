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

import { usePreferences } from '@vben/preferences';

import {
  Button,
  Checkbox,
  DatePicker,
  Dropdown,
  Empty,
  Input,
  Modal,
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

import ProductDetailTable from './components/ProductDetailTable.vue';

use([CanvasRenderer, GaugeChart, TooltipComponent]);

const { isDark } = usePreferences();

interface ResponsibleCard {
  adAcoas: number;
  completionRate: number;
  dailyTargetProfit: number;
  dailyTargetSales: number;
  dailyTargetUnits: number;
  department: string;
  fbaAvailableQty: number;
  grossMarginCompletionRate: number;
  grossMarginRate: number;
  grossProfit: number;
  grossProfitCompletionRate: number;
  inventoryQty: number;
  name: string;
  promotionRate: number;
  salesAmount: number;
  salesQty: number;
  targetGrossMarginRate: number;
  turnoverFbaAvailableMonths: number;
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
type ReportFilterKey =
  | 'countries'
  | 'operationGroupIds'
  | 'productTypes'
  | 'responsibles'
  | 'spus';

const defaultPinnedReportColumnKeys = [
  'imageUrl',
  'parentAsin',
  'responsible',
] as const;
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
const selectedReportColumns = ref<string[]>([]);
const pinnedReportColumnKeys = ref<string[]>([
  ...defaultPinnedReportColumnKeys,
]);
const reportColumnsInitialized = ref(false);
const reportColumnConfigOpen = ref(false);
const reportColumnDraft = ref<string[]>([]);
const reportColumnWidths = reactive<Record<string, number>>({});
const reportColumnSearch = ref('');
const draggingReportColumnKey = ref('');
const resizingReportColumn = ref<null | {
  key: string;
  startWidth: number;
  startX: number;
}>(null);
const reportFilterDropdownOpen = reactive<Record<ReportFilterKey, boolean>>({
  countries: false,
  operationGroupIds: false,
  productTypes: false,
  responsibles: false,
  spus: false,
});
const reportFilterDrafts = reactive<Record<ReportFilterKey, string[]>>({
  countries: [],
  operationGroupIds: [],
  productTypes: [],
  responsibles: [],
  spus: [],
});
const dashboardCountryDropdownOpen = ref(false);
const dashboardCountryDraft = ref<string[]>([]);
const dashboardOwnerDropdownOpen = ref(false);
const dashboardOwnerDraftGroups = ref<string[]>([]);
const dashboardOwnerDraftResponsibles = ref<string[]>([]);
const activeDashboardOwnerGroupId = ref('');
const responsibleOwnerDropdownOpen = ref(false);
const responsibleOwnerDraftGroups = ref<string[]>([]);
const responsibleOwnerDraftResponsibles = ref<string[]>([]);
const activeResponsibleOwnerGroupId = ref('');
let reportBodyScrollElement: HTMLElement | null = null;
let reportScrollSyncing = false;
let reportResizeSuppressClickUntil = 0;
let dashboardAutoReloadReady = false;
let dashboardAutoReloadTimer: null | ReturnType<typeof setTimeout> = null;
let syncingDashboardQuery = false;
const query = reactive({
  departments: [] as string[],
  granularity: 'day' as AnalyticsGranularity,
  operationGroupIds: [] as number[],
  projectTags: [] as string[],
  responsibles: [] as string[],
  startDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  endDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  siteDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  sites: [] as string[],
});
const reportQuery = reactive({
  countries: [] as string[],
  dateRangeType: 'last30' as ReportDateRangeType,
  endDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  page: 1,
  operationGroupIds: [] as number[],
  pageSize: 50,
  productTypes: [] as string[],
  responsibles: [] as string[],
  spus: [] as string[],
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
const sourceMessage = computed(() =>
  (source.value?.message || '等待查询').replaceAll(
    'profitstatement',
    '利润报表',
  ),
);
const granularityOptions = [
  { label: '按天', value: 'day' },
  { label: '按月', value: 'month' },
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
const previousLabel = computed(() => period.value?.previousLabel ?? '前一周期');
const secondaryLabel = computed(
  () => period.value?.secondaryLabel ?? '上周同期',
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
const departmentOptions = computed(() =>
  (overview.value?.filters.departments ?? []).map((value) => ({
    label: value,
    value,
  })),
);
const projectTagOptions = computed(() =>
  (overview.value?.filters.projectTags ?? []).map((value) => ({
    label: value,
    value,
  })),
);
const availableSiteSet = computed(
  () =>
    new Set(
      (overview.value?.filters.sites ?? []).map((site) => site.toUpperCase()),
    ),
);
const responsibleOptions = computed(() =>
  (overview.value?.filters.responsibles ?? []).map((value) => ({
    label: value,
    value,
  })),
);
const dashboardOperationGroups = computed(
  () => overview.value?.filters.operationGroups ?? [],
);
const dashboardCountryOptionDefs = [
  {
    label: '泛欧',
    sites: ['BE', 'DE', 'ES', 'FR', 'IE', 'IT', 'NL', 'PL', 'SE'],
    value: 'PAN_EU',
  },
  { label: '美国', sites: ['US'], value: 'US' },
  { label: '英国', sites: ['UK'], value: 'UK' },
  { label: '加拿大', sites: ['CA'], value: 'CA' },
  { label: '墨西哥', sites: ['MX'], value: 'MX' },
  { label: '巴西', sites: ['BR'], value: 'BR' },
  { label: '澳洲', sites: ['AU'], value: 'AU' },
  { label: '阿联酋', sites: ['AE'], value: 'AE' },
];
const dashboardCountryOptions = computed(() =>
  dashboardCountryOptionDefs
    .map((option) => ({
      ...option,
      sites: option.sites.filter((site) => availableSiteSet.value.has(site)),
    }))
    .filter((option) => option.sites.length > 0),
);
const reportOperationGroupOptions = computed(() =>
  (overview.value?.filters.operationGroups ?? []).map((item) => ({
    group: item,
    label: item.name,
    value: String(item.id),
  })),
);
const reportDateRangeLabels: Record<string, string> = {
  currentmonth: '本月',
  currentMonth: '本月',
  custom: '自定义',
  last7: '最近7天',
  last30: '最近30天',
  lastmonth: '上月',
  lastMonth: '上月',
  today: '今日',
  year: '今年',
  yesterday: '昨日',
};
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
const reportCountryOptions = computed(() =>
  (report.value?.filters.countries ?? []).map((country) => ({
    label: country,
    value: country,
  })),
);
const reportProductTypeOptions = computed(() => [
  { label: '新品', value: 'new' },
  { label: '老品', value: 'old' },
]);
const dashboardResponsibleOptionsForChildren = computed(() => {
  const scopedNames = dashboardResponsibleScopeForTables().filter(
    (name) => name !== '__NO_ACCESS__',
  );
  if (dashboardResponsibleScopeActive()) return scopedNames;
  return overview.value?.filters.responsibles ?? [];
});
const reportResponsibleOptions = computed(() => {
  const values = dashboardResponsibleScopeActive()
    ? dashboardResponsibleOptionsForChildren.value
    : (report.value?.filters.responsibles ??
      responsibleOptions.value.map((item) => item.value));
  return values.map((value) => ({ label: value, value }));
});
const reportSpuOptions = computed(() =>
  (report.value?.filters.spus ?? []).map((value) => ({ label: value, value })),
);
const reportColumnMap = computed(() => {
  const map = new Map<string, AnalyticsReportColumn>();
  for (const column of report.value?.columns ?? []) {
    map.set(column.key, column);
  }
  return map;
});
function defaultReportColumnKeys(data: AnalyticsReportOverview) {
  const available = new Set(data.columns.map((column) => column.key));
  const keys = data.defaultColumns.filter((key) => available.has(key));
  if (!available.has('country')) return keys;
  const withoutCountry = keys.filter((key) => key !== 'country');
  const fbaIndex = withoutCountry.indexOf('fbaAvailable');
  if (fbaIndex !== -1) {
    withoutCountry.splice(fbaIndex + 1, 0, 'country');
    return withoutCountry;
  }
  return [...withoutCountry, 'country'];
}
const selectedReportColumnMetas = computed(() => {
  const columns: AnalyticsReportColumn[] = [];
  for (const key of selectedReportColumns.value) {
    const column = reportColumnMap.value.get(key);
    if (column) {
      columns.push(column);
    }
  }
  return columns;
});
const reportColumnGroups = computed(() => {
  const groups = [
    {
      key: 'base',
      title: '基础信息',
      columns: [
        'imageUrl',
        'parentAsin',
        'responsible',
        'productType',
        'spu',
        'site',
        'country',
        'shopName',
        'category1',
        'category2',
        'asinList',
      ],
    },
    {
      key: 'sales',
      title: '销售数据',
      columns: [
        'salesTrend',
        'targetUnits',
        'salesQty',
        'orderQty',
        'salesAmount',
        'netSalesAmount',
        'avgSales7',
      ],
    },
    {
      key: 'ad',
      title: '广告数据',
      columns: [
        'adSpend',
        'adOrders',
        'adSales',
        'acos',
        'tacos',
        'roas',
        'cpc',
        'cpo',
        'ctr',
        'cvr',
        'adCvr',
        'impressions',
        'clicks',
      ],
    },
    {
      key: 'inventory',
      title: '库存价格',
      columns: ['fbaAvailable', 'sessions', 'pv', 'rating', 'reviewCount'],
    },
    {
      key: 'profit',
      title: '利润退款',
      columns: ['orderProfit', 'settlementProfit', 'refundQty', 'refundRate'],
    },
  ];
  const known = new Set(groups.flatMap((group) => group.columns));
  const extraColumns = (report.value?.columns ?? [])
    .map((column) => column.key)
    .filter((key) => !known.has(key));
  if (extraColumns.length > 0) {
    groups.push({
      key: 'other',
      title: '其他字段',
      columns: extraColumns,
    });
  }
  const keyword = reportColumnSearch.value.trim().toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      columns: group.columns
        .map((key) => reportColumnMap.value.get(key))
        .filter((column): column is AnalyticsReportColumn => {
          if (!column) return false;
          if (!keyword) return true;
          return (
            column.key.toLowerCase().includes(keyword) ||
            column.label.toLowerCase().includes(keyword)
          );
        }),
    }))
    .filter((group) => group.columns.length > 0);
});
const selectedReportColumnDraftMetas = computed<AnalyticsReportColumn[]>(() =>
  reportColumnDraft.value
    .map((key) => reportColumnMap.value.get(key))
    .filter((column): column is AnalyticsReportColumn => column !== undefined),
);
const reportTableColumns = computed<TableColumnsType<AnalyticsReportRow>>(
  () => {
    const columns: TableColumnsType<AnalyticsReportRow> = [];
    const fixedKeys = new Set(pinnedReportColumnKeys.value);
    for (const column of selectedReportColumnMetas.value) {
      columns.push({
        align: reportColumnAlign(column.kind),
        dataIndex: column.key,
        fixed: fixedKeys.has(column.key) ? 'left' : undefined,
        key: column.key,
        sorter: sortableReportFields.has(column.key),
        title: column.label,
        width: reportColumnDisplayWidth(column.key),
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
const grossProfitCompletion = computed(() =>
  nullableRatio(latest.value?.grossProfit, targets.value?.dailyTargetProfit),
);
const promotionRate = computed(() => latest.value?.promotionRate ?? 0);
const adAcoas = computed(() => latest.value?.adAcoas ?? 0);
const previousPromotionRate = computed(
  () => previous.value?.promotionRate ?? 0,
);
const weekBeforePromotionRate = computed(
  () => weekBefore.value?.promotionRate ?? 0,
);
const previousCompareLabel = computed(() =>
  periodDays.value > 1 ? previousLabel.value : '前一天',
);
const weekCompareLabel = computed(() =>
  periodDays.value > 1 ? secondaryLabel.value : '上周这一天',
);

const allResponsibleCards = computed<ResponsibleCard[]>(() => {
  return (operations.value?.responsibleRows ?? [])
    .map((row) => ({
      adAcoas: row.adAcoas ?? 0,
      completionRate: ratio(row.salesQty, row.dailyTargetUnits),
      dailyTargetProfit: row.dailyTargetProfit ?? 0,
      dailyTargetSales: row.dailyTargetSales ?? 0,
      dailyTargetUnits: row.dailyTargetUnits ?? 0,
      department: row.department || '未配置部门',
      fbaAvailableQty: row.fbaAvailableQty ?? 0,
      grossMarginCompletionRate:
        row.grossMarginCompletionRate ??
        ratio(row.grossMarginRate ?? 0, row.targetGrossMarginRate ?? 0),
      grossMarginRate: row.grossMarginRate ?? 0,
      grossProfitCompletionRate: ratio(row.grossProfit, row.dailyTargetProfit),
      grossProfit: row.grossProfit,
      inventoryQty: row.inventoryQty,
      name: row.responsible,
      promotionRate: row.promotionRate ?? 0,
      salesAmount: row.salesAmount,
      salesQty: row.salesQty,
      targetGrossMarginRate: row.targetGrossMarginRate ?? 0,
      turnoverFbaAvailableMonths: row.turnoverFbaAvailableMonths ?? 0,
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

const departmentCards = computed(() =>
  (operations.value?.departmentRows ?? [])
    .map((row) => ({
      adAcoas: row.adAcoas ?? 0,
      completionRate: ratio(row.salesQty, row.dailyTargetUnits),
      dailyTargetProfit: row.dailyTargetProfit ?? 0,
      dailyTargetSales: row.dailyTargetSales ?? 0,
      dailyTargetUnits: row.dailyTargetUnits ?? 0,
      fbaAvailableQty: row.fbaAvailableQty ?? 0,
      grossProfit: row.grossProfit,
      grossMarginCompletionRate:
        row.grossMarginCompletionRate ??
        ratio(row.grossMarginRate ?? 0, row.targetGrossMarginRate ?? 0),
      grossMarginRate: row.grossMarginRate ?? 0,
      grossProfitCompletionRate: ratio(row.grossProfit, row.dailyTargetProfit),
      inventoryQty: row.inventoryQty,
      name: row.department || '未配置部门',
      promotionRate: row.promotionRate ?? 0,
      salesAmount: row.salesAmount,
      salesCompletionRate: ratio(row.salesAmount, row.dailyTargetSales),
      salesQty: row.salesQty,
      targetGrossMarginRate: row.targetGrossMarginRate ?? 0,
      turnoverFbaAvailableMonths: row.turnoverFbaAvailableMonths ?? 0,
      turnoverMonths: row.turnoverMonths,
    }))
    .toSorted((a, b) => b.salesQty - a.salesQty),
);
const productDetailBaseParams = computed(() => {
  const dateRange = dashboardDateRangeForTables();
  return {
    countries: dashboardCountryLabelsFromSites(query.sites),
    dateRangeType: 'custom',
    endDate: dateRange.endDate,
    projectTags: [...query.projectTags],
    responsibles: dashboardResponsibleScopeForTables(),
    sites: [...query.sites],
    startDate: dateRange.startDate,
  };
});

function gaugeOption(rate: null | number, color: string) {
  const percentage = rate === null ? 0 : Math.min(Math.max(rate * 100, 0), 100);
  const axisTextColor = isDark.value ? '#94a3b8' : '#94a3b8';
  const pointerColor = isDark.value ? '#e5e7eb' : '#111827';
  const trackColor = isDark.value ? '#1e293b' : '#eef2f7';
  return {
    series: [
      {
        anchor: {
          itemStyle: { color: pointerColor },
          show: false,
          size: 7,
        },
        axisLabel: {
          color: axisTextColor,
          distance: -37,
          fontSize: 10,
        },
        axisLine: {
          lineStyle: {
            color: [
              [Math.min(percentage / 100, 1), color],
              [1, trackColor],
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
        max: 100,
        min: 0,
        pointer: {
          icon: 'path://M2 0 L-2 0 L-1 58 L1 58 Z',
          itemStyle: { color: pointerColor },
          length: '62%',
          show: false,
          width: 4,
        },
        progress: { show: false },
        center: ['50%', '55%'],
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
      projectTags: query.projectTags,
      responsibles: query.responsibles,
      siteDate: query.siteDate,
      sites: query.sites,
      startDate: isMonthMode.value ? undefined : query.startDate,
    });
    syncingDashboardQuery = true;
    query.departments = overview.value.query.departments;
    query.granularity = overview.value.query.granularity;
    query.siteDate = overview.value.query.siteDate;
    query.startDate = overview.value.query.startDate;
    query.endDate = overview.value.query.endDate;
    query.projectTags = overview.value.query.projectTags ?? [];
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
    reportQuery.countries = data.query.countries ?? [];
    reportQuery.dateRangeType = normalizeReportDateRangeType(
      data.query.dateRangeType,
    );
    reportQuery.startDate = data.query.startDate;
    reportQuery.endDate = data.query.endDate;
    reportQuery.page = data.pagination.page;
    reportQuery.operationGroupIds = data.query.operationGroupIds ?? [];
    reportQuery.pageSize = data.pagination.pageSize;
    reportQuery.productTypes = data.query.productTypes;
    reportQuery.responsibles = reportResponsiblesForDisplay(
      data.query.responsibles,
    );
    reportQuery.spus = data.query.spus ?? [];
    reportQuery.sortField = data.query.sortField || 'salesQty';
    reportQuery.sortOrder = (data.query.sortOrder ||
      'descend') as ReportSortOrder;
    if (!reportColumnsInitialized.value) {
      selectedReportColumns.value = defaultReportColumnKeys(data);
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
  }, 1000);
}

function dashboardCountryValuesFromSites(sites: string[]) {
  if (sites.length === 0) return [];
  const siteSet = new Set(sites.map((site) => site.toUpperCase()));
  return dashboardCountryOptions.value
    .filter((option) => option.sites.every((site) => siteSet.has(site)))
    .map((option) => option.value);
}

function dashboardCountryLabelsFromSites(sites: string[]) {
  if (sites.length === 0) return [];
  const siteSet = new Set(sites.map((site) => site.toUpperCase()));
  return dashboardCountryOptions.value
    .filter((option) => option.sites.every((site) => siteSet.has(site)))
    .map((option) => option.label);
}

function dashboardDateRangeForTables() {
  if (isMonthMode.value) {
    const month = dayjs(query.siteDate);
    const today = dayjs();
    const end = month.endOf('month').isAfter(today, 'day')
      ? today
      : month.endOf('month');
    return {
      endDate: end.format('YYYY-MM-DD'),
      startDate: month.startOf('month').format('YYYY-MM-DD'),
    };
  }
  return {
    endDate: query.endDate,
    startDate: query.startDate,
  };
}

function dashboardSitesFromCountryValues(values: string[]) {
  const selected = new Set(values);
  return [
    ...new Set(
      dashboardCountryOptions.value
        .filter((option) => selected.has(option.value))
        .flatMap((option) => option.sites),
    ),
  ];
}

const dashboardCountryButtonText = computed(() => {
  if (query.sites.length === 0) return '全部';
  const selected = dashboardCountryValuesFromSites(query.sites);
  if (selected.length === 1) {
    return (
      dashboardCountryOptions.value.find(
        (option) => option.value === selected[0],
      )?.label ?? '已选1项'
    );
  }
  return `已选${selected.length || query.sites.length}项`;
});

function syncDashboardCountryDraft() {
  dashboardCountryDraft.value = dashboardCountryValuesFromSites(query.sites);
}

function handleDashboardCountryOpenChange(open: boolean) {
  dashboardCountryDropdownOpen.value = open;
  if (!open) return;
  syncDashboardCountryDraft();
}

function isDashboardCountryDraftChecked(value: string) {
  return dashboardCountryDraft.value.includes(value);
}

function toggleDashboardCountryDraftValue(value: string) {
  dashboardCountryDraft.value = dashboardCountryDraft.value.includes(value)
    ? dashboardCountryDraft.value.filter((item) => item !== value)
    : [...dashboardCountryDraft.value, value];
}

function isDashboardCountryDraftAllSelected() {
  return (
    dashboardCountryOptions.value.length > 0 &&
    dashboardCountryOptions.value.every((option) =>
      dashboardCountryDraft.value.includes(option.value),
    )
  );
}

function toggleDashboardCountryDraftAll() {
  dashboardCountryDraft.value = isDashboardCountryDraftAllSelected()
    ? []
    : dashboardCountryOptions.value.map((option) => option.value);
}

function applyDashboardCountryFilter() {
  query.sites = isDashboardCountryDraftAllSelected()
    ? []
    : dashboardSitesFromCountryValues(dashboardCountryDraft.value);
  dashboardCountryDropdownOpen.value = false;
}

function cancelDashboardCountryFilter() {
  syncDashboardCountryDraft();
  dashboardCountryDropdownOpen.value = false;
}

const dashboardOwnerButtonText = computed(() => {
  const selectedGroupCount = query.operationGroupIds.length;
  const selectedResponsibleCount = query.responsibles.length;
  if (selectedGroupCount === 0 && selectedResponsibleCount === 0) return '全部';
  if (selectedGroupCount === 1 && selectedResponsibleCount === 0) {
    return (
      dashboardOperationGroups.value.find(
        (group) => group.id === query.operationGroupIds[0],
      )?.name ?? '已选1组'
    );
  }
  if (selectedGroupCount === 0 && selectedResponsibleCount === 1) {
    return query.responsibles[0] ?? '已选1人';
  }
  return `已选${selectedGroupCount}组/${selectedResponsibleCount}人`;
});

const activeDashboardOwnerGroup = computed(
  () =>
    dashboardOperationGroups.value.find(
      (group) => String(group.id) === activeDashboardOwnerGroupId.value,
    ) ?? dashboardOperationGroups.value[0],
);

function syncDashboardOwnerDraft() {
  dashboardOwnerDraftGroups.value = query.operationGroupIds.map(String);
  dashboardOwnerDraftResponsibles.value = [...query.responsibles];
}

function handleDashboardOwnerOpenChange(open: boolean) {
  dashboardOwnerDropdownOpen.value = open;
  if (!open) return;
  syncDashboardOwnerDraft();
  activeDashboardOwnerGroupId.value = String(
    dashboardOperationGroups.value[0]?.id ?? '',
  );
}

function isDashboardOwnerGroupChecked(group: AnalyticsOperationGroup) {
  return dashboardOwnerDraftGroups.value.includes(String(group.id));
}

function isDashboardResponsibleChecked(name: string) {
  return dashboardOwnerDraftResponsibles.value.includes(name);
}

function toggleDashboardOwnerGroup(group: AnalyticsOperationGroup) {
  const groupId = String(group.id);
  const checked = isDashboardOwnerGroupChecked(group);
  dashboardOwnerDraftGroups.value = checked
    ? dashboardOwnerDraftGroups.value.filter((item) => item !== groupId)
    : [...dashboardOwnerDraftGroups.value, groupId];
  const members = new Set(group.memberNames);
  dashboardOwnerDraftResponsibles.value = checked
    ? dashboardOwnerDraftResponsibles.value.filter((name) => !members.has(name))
    : [
        ...new Set([
          ...dashboardOwnerDraftResponsibles.value,
          ...group.memberNames,
        ]),
      ];
}

function toggleDashboardResponsible(name: string) {
  dashboardOwnerDraftResponsibles.value = isDashboardResponsibleChecked(name)
    ? dashboardOwnerDraftResponsibles.value.filter((item) => item !== name)
    : [...dashboardOwnerDraftResponsibles.value, name];
}

function isDashboardOwnerDraftAllSelected() {
  const allGroups = dashboardOperationGroups.value.map((group) =>
    String(group.id),
  );
  const allResponsibles = responsibleOptions.value.map(
    (option) => option.value,
  );
  return (
    allGroups.length > 0 &&
    allGroups.every((id) => dashboardOwnerDraftGroups.value.includes(id)) &&
    allResponsibles.every((name) =>
      dashboardOwnerDraftResponsibles.value.includes(name),
    )
  );
}

function toggleDashboardOwnerDraftAll() {
  if (isDashboardOwnerDraftAllSelected()) {
    dashboardOwnerDraftGroups.value = [];
    dashboardOwnerDraftResponsibles.value = [];
    return;
  }
  dashboardOwnerDraftGroups.value = dashboardOperationGroups.value.map(
    (group) => String(group.id),
  );
  dashboardOwnerDraftResponsibles.value = responsibleOptions.value.map(
    (option) => option.value,
  );
}

function applyDashboardOwnerFilter() {
  query.operationGroupIds = isDashboardOwnerDraftAllSelected()
    ? []
    : dashboardOwnerDraftGroups.value
        .map(Number)
        .filter((value) => Number.isFinite(value));
  query.responsibles = isDashboardOwnerDraftAllSelected()
    ? []
    : [...dashboardOwnerDraftResponsibles.value];
  dashboardOwnerDropdownOpen.value = false;
}

function cancelDashboardOwnerFilter() {
  syncDashboardOwnerDraft();
  dashboardOwnerDropdownOpen.value = false;
}

const responsibleOwnerButtonText = computed(() => {
  const selectedGroupCount = query.operationGroupIds.length;
  const selectedResponsibleCount = query.responsibles.length;
  if (selectedGroupCount === 0 && selectedResponsibleCount === 0) return '全部';
  if (selectedGroupCount === 1 && selectedResponsibleCount === 0) {
    return (
      dashboardOperationGroups.value.find(
        (group) => group.id === query.operationGroupIds[0],
      )?.name ?? '已选1组'
    );
  }
  if (selectedGroupCount === 0 && selectedResponsibleCount === 1) {
    return query.responsibles[0] ?? '已选1人';
  }
  return `已选${selectedGroupCount}组/${selectedResponsibleCount}人`;
});

const activeResponsibleOwnerGroup = computed(
  () =>
    dashboardOperationGroups.value.find(
      (group) => String(group.id) === activeResponsibleOwnerGroupId.value,
    ) ?? dashboardOperationGroups.value[0],
);

const activeResponsibleOwnerMembers = computed(
  () => activeResponsibleOwnerGroup.value?.memberNames ?? [],
);

function syncResponsibleOwnerDraft() {
  responsibleOwnerDraftGroups.value = query.operationGroupIds.map(String);
  responsibleOwnerDraftResponsibles.value = [...query.responsibles];
}

function handleResponsibleOwnerOpenChange(open: boolean) {
  responsibleOwnerDropdownOpen.value = open;
  if (!open) return;
  syncResponsibleOwnerDraft();
  activeResponsibleOwnerGroupId.value = String(
    dashboardOperationGroups.value[0]?.id ?? '',
  );
}

function isResponsibleOwnerGroupChecked(group: AnalyticsOperationGroup) {
  return responsibleOwnerDraftGroups.value.includes(String(group.id));
}

function isResponsibleOwnerChecked(name: string) {
  return responsibleOwnerDraftResponsibles.value.includes(name);
}

function toggleResponsibleOwnerGroup(group: AnalyticsOperationGroup) {
  const groupId = String(group.id);
  const checked = isResponsibleOwnerGroupChecked(group);
  responsibleOwnerDraftGroups.value = checked
    ? responsibleOwnerDraftGroups.value.filter((item) => item !== groupId)
    : [...responsibleOwnerDraftGroups.value, groupId];
  const members = new Set(group.memberNames);
  responsibleOwnerDraftResponsibles.value = checked
    ? responsibleOwnerDraftResponsibles.value.filter(
        (name) => !members.has(name),
      )
    : [
        ...new Set([
          ...responsibleOwnerDraftResponsibles.value,
          ...group.memberNames,
        ]),
      ];
}

function toggleResponsibleOwner(name: string) {
  responsibleOwnerDraftResponsibles.value = isResponsibleOwnerChecked(name)
    ? responsibleOwnerDraftResponsibles.value.filter((item) => item !== name)
    : [...responsibleOwnerDraftResponsibles.value, name];
}

function isResponsibleOwnerDraftAllSelected() {
  const allGroups = dashboardOperationGroups.value.map((group) =>
    String(group.id),
  );
  const allResponsibles = responsibleOptions.value.map(
    (option) => option.value,
  );
  return (
    allGroups.length > 0 &&
    allGroups.every((id) => responsibleOwnerDraftGroups.value.includes(id)) &&
    allResponsibles.every((name) =>
      responsibleOwnerDraftResponsibles.value.includes(name),
    )
  );
}

function toggleResponsibleOwnerDraftAll() {
  if (isResponsibleOwnerDraftAllSelected()) {
    responsibleOwnerDraftGroups.value = [];
    responsibleOwnerDraftResponsibles.value = [];
    return;
  }
  responsibleOwnerDraftGroups.value = dashboardOperationGroups.value.map(
    (group) => String(group.id),
  );
  responsibleOwnerDraftResponsibles.value = responsibleOptions.value.map(
    (option) => option.value,
  );
}

function applyResponsibleOwnerFilter() {
  query.operationGroupIds = isResponsibleOwnerDraftAllSelected()
    ? []
    : responsibleOwnerDraftGroups.value
        .map(Number)
        .filter((value) => Number.isFinite(value));
  query.responsibles = isResponsibleOwnerDraftAllSelected()
    ? []
    : [...responsibleOwnerDraftResponsibles.value];
  responsibleOwnerDropdownOpen.value = false;
}

function cancelResponsibleOwnerFilter() {
  syncResponsibleOwnerDraft();
  responsibleOwnerDropdownOpen.value = false;
}

function ownerDropdownPopupContainer() {
  return document.body;
}

function reportFilterValues(key: ReportFilterKey) {
  if (key === 'operationGroupIds') {
    return reportQuery.operationGroupIds.map(String);
  }
  return reportQuery[key];
}

function setReportFilterValues(key: ReportFilterKey, values: string[]) {
  if (key === 'operationGroupIds') {
    reportQuery.operationGroupIds = values
      .map(Number)
      .filter((value) => Number.isFinite(value));
    return;
  }
  reportQuery[key] = values;
}

function reportFilterButtonText(
  key: ReportFilterKey,
  placeholder: string,
  options: Array<{ label: string; value: string }>,
) {
  const values = reportFilterValues(key);
  if (values.length === 0) return placeholder;
  if (values.length === 1) {
    return (
      options.find((option) => option.value === values[0])?.label ??
      values[0] ??
      placeholder
    );
  }
  return `已选${values.length}项`;
}

function syncReportFilterDraft(key: ReportFilterKey) {
  reportFilterDrafts[key] = [...reportFilterValues(key)];
}

function handleReportFilterOpenChange(key: ReportFilterKey, open: boolean) {
  reportFilterDropdownOpen[key] = open;
  if (open) {
    syncReportFilterDraft(key);
  }
}

function isReportFilterDraftChecked(key: ReportFilterKey, value: string) {
  return reportFilterDrafts[key].includes(value);
}

function toggleReportFilterDraftValue(key: ReportFilterKey, value: string) {
  const values = reportFilterDrafts[key];
  reportFilterDrafts[key] = values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function isReportFilterDraftAllSelected(
  key: ReportFilterKey,
  options: Array<{ label: string; value: string }>,
) {
  return (
    options.length > 0 &&
    options.every((option) => reportFilterDrafts[key].includes(option.value))
  );
}

function toggleReportFilterDraftAll(
  key: ReportFilterKey,
  options: Array<{ label: string; value: string }>,
) {
  reportFilterDrafts[key] = isReportFilterDraftAllSelected(key, options)
    ? []
    : options.map((option) => option.value);
}

function cancelReportFilter(key: ReportFilterKey) {
  syncReportFilterDraft(key);
  reportFilterDropdownOpen[key] = false;
}

function applyReportFilter(key: ReportFilterKey) {
  setReportFilterValues(key, [...reportFilterDrafts[key]]);
  reportFilterDropdownOpen[key] = false;
  reportQuery.page = 1;
  void loadReportData();
}

function drillReportOperationGroup(group: AnalyticsOperationGroup) {
  reportFilterDropdownOpen.operationGroupIds = false;
  reportQuery.operationGroupIds = [group.id];
  reportQuery.responsibles = [...group.memberNames];
  reportQuery.page = 1;
  void loadReportData();
}

function openReportColumnConfig() {
  reportColumnDraft.value = selectedReportColumns.value.filter((key) =>
    reportColumnMap.value.has(key),
  );
  pinnedReportColumnKeys.value = pinnedReportColumnKeys.value.filter((key) =>
    reportColumnDraft.value.includes(key),
  );
  reportColumnSearch.value = '';
  reportColumnConfigOpen.value = true;
}

function isReportColumnDraftChecked(key: string) {
  return reportColumnDraft.value.includes(key);
}

function toggleReportColumnDraft(key: string) {
  if (isReportColumnDraftChecked(key)) {
    reportColumnDraft.value = reportColumnDraft.value.filter(
      (item) => item !== key,
    );
    pinnedReportColumnKeys.value = pinnedReportColumnKeys.value.filter(
      (item) => item !== key,
    );
    return;
  }
  reportColumnDraft.value = [...reportColumnDraft.value, key];
}

function isReportColumnGroupAllSelected(columns: AnalyticsReportColumn[]) {
  return (
    columns.length > 0 &&
    columns.every((column) => reportColumnDraft.value.includes(column.key))
  );
}

function toggleReportColumnGroup(columns: AnalyticsReportColumn[]) {
  if (isReportColumnGroupAllSelected(columns)) {
    const groupKeys = new Set(columns.map((column) => column.key));
    reportColumnDraft.value = reportColumnDraft.value.filter(
      (key) => !groupKeys.has(key),
    );
    pinnedReportColumnKeys.value = pinnedReportColumnKeys.value.filter(
      (key) => !groupKeys.has(key),
    );
    return;
  }
  const next = [...reportColumnDraft.value];
  for (const column of columns) {
    if (!next.includes(column.key)) {
      next.push(column.key);
    }
  }
  reportColumnDraft.value = next;
}

function removeReportColumnDraft(key: string) {
  reportColumnDraft.value = reportColumnDraft.value.filter(
    (item) => item !== key,
  );
  pinnedReportColumnKeys.value = pinnedReportColumnKeys.value.filter(
    (item) => item !== key,
  );
}

function moveReportColumnDraft(key: string, direction: -1 | 1) {
  const currentIndex = reportColumnDraft.value.indexOf(key);
  const nextIndex = currentIndex + direction;
  if (
    currentIndex < 0 ||
    nextIndex < 0 ||
    nextIndex >= reportColumnDraft.value.length
  ) {
    return;
  }
  const next = [...reportColumnDraft.value];
  const [item] = next.splice(currentIndex, 1);
  if (item) {
    next.splice(nextIndex, 0, item);
  }
  reportColumnDraft.value = next;
}

function handleReportColumnDragStart(key: string) {
  draggingReportColumnKey.value = key;
}

function handleReportColumnDrop(targetKey: string) {
  const sourceKey = draggingReportColumnKey.value;
  draggingReportColumnKey.value = '';
  if (!sourceKey || sourceKey === targetKey) return;
  const next = [...reportColumnDraft.value];
  const sourceIndex = next.indexOf(sourceKey);
  const targetIndex = next.indexOf(targetKey);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const [item] = next.splice(sourceIndex, 1);
  if (item) {
    next.splice(targetIndex, 0, item);
  }
  reportColumnDraft.value = next;
}

function isReportColumnPinned(key: string) {
  return pinnedReportColumnKeys.value.includes(key);
}

function toggleReportColumnPinned(key: string) {
  if (!reportColumnDraft.value.includes(key)) return;
  if (isReportColumnPinned(key)) {
    pinnedReportColumnKeys.value = pinnedReportColumnKeys.value.filter(
      (item) => item !== key,
    );
    return;
  }
  if (pinnedReportColumnKeys.value.length >= 7) return;
  pinnedReportColumnKeys.value = [...pinnedReportColumnKeys.value, key];
}

function applyReportColumnConfig() {
  selectedReportColumns.value = [...reportColumnDraft.value];
  pinnedReportColumnKeys.value = pinnedReportColumnKeys.value.filter((key) =>
    selectedReportColumns.value.includes(key),
  );
  reportColumnConfigOpen.value = false;
}

function resetFilters() {
  query.departments = [];
  query.granularity = 'day';
  query.operationGroupIds = [];
  query.projectTags = [];
  query.responsibles = [];
  query.startDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  query.endDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  query.siteDate = query.endDate;
  query.sites = [];
  reportQuery.countries = [];
  reportQuery.dateRangeType = 'last30';
  reportQuery.startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  reportQuery.endDate = query.endDate;
  reportQuery.page = 1;
  reportQuery.operationGroupIds = [];
  reportQuery.pageSize = 50;
  reportQuery.productTypes = [];
  reportQuery.responsibles = [];
  reportQuery.spus = [];
  reportQuery.sortField = 'salesQty';
  reportQuery.sortOrder = 'descend';
  void reloadAll(false);
}

function disabledFutureDate(value: ReturnType<typeof dayjs>) {
  return value.isAfter(dayjs(), isMonthMode.value ? 'month' : 'day');
}

function applyReportDateRangeType(value: ReportDateRangeType) {
  const today = dayjs();
  const yesterday = today.subtract(1, 'day');
  if (value === 'custom') return;
  if (value === 'today') {
    reportQuery.startDate = today.format('YYYY-MM-DD');
    reportQuery.endDate = reportQuery.startDate;
    return;
  }
  if (value === 'yesterday') {
    reportQuery.startDate = yesterday.format('YYYY-MM-DD');
    reportQuery.endDate = reportQuery.startDate;
    return;
  }
  if (value === 'last7') {
    reportQuery.endDate = yesterday.format('YYYY-MM-DD');
    reportQuery.startDate = yesterday.subtract(6, 'day').format('YYYY-MM-DD');
    return;
  }
  if (value === 'last30') {
    reportQuery.endDate = yesterday.format('YYYY-MM-DD');
    reportQuery.startDate = yesterday.subtract(29, 'day').format('YYYY-MM-DD');
    return;
  }
  if (value === 'currentMonth') {
    reportQuery.startDate = today.startOf('month').format('YYYY-MM-DD');
    reportQuery.endDate = yesterday.format('YYYY-MM-DD');
    return;
  }
  if (value === 'lastMonth') {
    const lastMonth = today.subtract(1, 'month');
    reportQuery.startDate = lastMonth.startOf('month').format('YYYY-MM-DD');
    reportQuery.endDate = lastMonth.endOf('month').format('YYYY-MM-DD');
    return;
  }
  reportQuery.startDate = today.startOf('year').format('YYYY-MM-DD');
  reportQuery.endDate = yesterday.format('YYYY-MM-DD');
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
  return `$${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })}`;
}

function formatSignedMoney(value?: null | number, fractionDigits = 0) {
  if (value === null || value === undefined) {
    return '-';
  }
  const absolute = `$${Math.abs(Number(value || 0)).toLocaleString('zh-CN', {
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

function formatCny(value?: null | number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: isMonthMode.value ? 2 : 0,
    minimumFractionDigits: isMonthMode.value ? 2 : 0,
  })}`;
}

function formatSignedCny(value?: null | number) {
  if (value === null || value === undefined) {
    return '-';
  }
  const absolute = `¥${Math.abs(Number(value || 0)).toLocaleString('zh-CN', {
    maximumFractionDigits: isMonthMode.value ? 2 : 0,
    minimumFractionDigits: isMonthMode.value ? 2 : 0,
  })}`;
  return `${value >= 0 ? '+' : '-'}${absolute}`;
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
  if (value === null || value === undefined) return '-';
  return Number(value).toFixed(2);
}

function groupAccent(index: number) {
  return ['#facc15', '#0f5fb8', '#60a5fa'][index % 3] ?? '#60a5fa';
}

function groupGap(current: number, target: number) {
  return current - target;
}

function completionTextClass(value: number) {
  if (value >= 1) return 'good';
  if (value >= 0.8) return 'warning';
  return 'bad';
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
  const record = column as { dataIndex?: unknown; key?: unknown };
  const value = record.dataIndex ?? record.key;
  return String(value ?? '');
}

function isReportNumberColumn(column: unknown) {
  const kind =
    reportColumnMap.value.get(reportColumnKey(column))?.kind ?? 'text';
  return reportColumnAlign(kind) === 'right';
}

function reportColumnDefaultWidth(key: string) {
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

function normalizeReportColumnWidth(value: number | string | undefined) {
  const width = Number(value || 0);
  if (!Number.isFinite(width) || width <= 0) return 104;
  return Math.min(Math.max(Math.round(width), 56), 360);
}

function reportColumnDisplayWidth(key: string) {
  return normalizeReportColumnWidth(
    reportColumnWidths[key] ?? reportColumnDefaultWidth(key),
  );
}

function startReportColumnResize(key: string, event: MouseEvent) {
  if (!key) return;
  event.preventDefault();
  event.stopPropagation();
  resizingReportColumn.value = {
    key,
    startWidth: reportColumnDisplayWidth(key),
    startX: event.clientX,
  };
  reportResizeSuppressClickUntil = Date.now() + 500;
  document.body.classList.add('report-column-resizing');
  window.addEventListener('mousemove', handleReportColumnResizeMove);
  window.addEventListener('mouseup', stopReportColumnResize);
}

function reportColumnKeyFromHeaderCell(th: HTMLTableCellElement) {
  const handle = th.querySelector<HTMLElement>('.report-column-resize-handle');
  const handleKey = handle?.dataset.columnKey;
  if (handleKey) return handleKey;
  const leafHeaders = [
    ...(th.parentElement?.querySelectorAll<HTMLTableCellElement>(
      'th:not([colspan]), th[colspan="1"]',
    ) ?? []),
  ].filter((item) => item.querySelector('.report-resizable-header'));
  const index = leafHeaders.indexOf(th);
  return selectedReportColumnMetas.value[index]?.key ?? '';
}

function handleReportHeaderMouseDownCapture(event: MouseEvent) {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement | null;
  const th = target?.closest<HTMLTableCellElement>('th');
  const root = reportSummaryScroll.value?.closest('.report-panel');
  if (!th || !root?.contains(th)) return;
  if (!th.querySelector('.report-resizable-header')) return;
  const rect = th.getBoundingClientRect();
  const resizeHotZone = 14;
  if (rect.right - event.clientX > resizeHotZone) return;
  const key = reportColumnKeyFromHeaderCell(th);
  if (!key) return;
  startReportColumnResize(key, event);
}

function handleReportHeaderClickCapture(event: MouseEvent) {
  if (Date.now() > reportResizeSuppressClickUntil) return;
  event.preventDefault();
  event.stopPropagation();
}

function handleReportColumnResizeMove(event: MouseEvent) {
  const state = resizingReportColumn.value;
  if (!state) return;
  reportColumnWidths[state.key] = normalizeReportColumnWidth(
    state.startWidth + event.clientX - state.startX,
  );
}

function stopReportColumnResize() {
  resizingReportColumn.value = null;
  document.body.classList.remove('report-column-resizing');
  window.removeEventListener('mousemove', handleReportColumnResizeMove);
  window.removeEventListener('mouseup', stopReportColumnResize);
}

function reportOperationGroupIdsForRequest() {
  return reportQuery.operationGroupIds;
}

function reportResponsiblesForRequest() {
  const dashboardScope = dashboardResponsibleScopeForTables();
  if (!dashboardResponsibleScopeActive()) return reportQuery.responsibles;
  if (dashboardScope.includes('__NO_ACCESS__')) return ['__NO_ACCESS__'];
  if (reportQuery.responsibles.length === 0) return dashboardScope;
  const allowed = new Set(dashboardScope);
  const narrowed = reportQuery.responsibles.filter((name) => allowed.has(name));
  return narrowed.length > 0 ? narrowed : ['__NO_ACCESS__'];
}

function reportCountriesForRequest() {
  const dashboardCountries = dashboardCountryLabelsFromSites(query.sites);
  return dashboardCountries.length > 0
    ? dashboardCountries
    : reportQuery.countries;
}

function syncReportFiltersFromDashboard() {
  const dateRange = dashboardDateRangeForTables();
  const allowedResponsibles = new Set(
    dashboardResponsibleOptionsForChildren.value,
  );
  reportQuery.operationGroupIds = [...query.operationGroupIds];
  reportQuery.responsibles =
    allowedResponsibles.size > 0
      ? reportQuery.responsibles.filter((name) => allowedResponsibles.has(name))
      : [];
  reportQuery.countries = dashboardCountryLabelsFromSites(query.sites);
  reportQuery.dateRangeType = 'custom';
  reportQuery.startDate = dateRange.startDate;
  reportQuery.endDate = dateRange.endDate;
}

function buildReportParams(overrides: Record<string, any> = {}) {
  return {
    countries: reportCountriesForRequest(),
    dateRangeType: reportQuery.dateRangeType,
    departments: query.departments,
    endDate: reportQuery.endDate,
    operationGroupIds: reportOperationGroupIdsForRequest(),
    page: reportQuery.page,
    pageSize: reportQuery.pageSize,
    productTypes: reportQuery.productTypes,
    projectTags: query.projectTags,
    responsibles: reportResponsiblesForRequest(),
    spus: reportQuery.spus,
    siteDate: reportQuery.endDate,
    sites: query.sites,
    sortField: reportQuery.sortField,
    sortOrder: reportQuery.sortOrder,
    startDate: reportQuery.startDate,
    ...overrides,
  };
}

function dashboardResponsibleScopeActive() {
  return (
    query.departments.length > 0 ||
    query.operationGroupIds.length > 0 ||
    query.responsibles.length > 0
  );
}

function dashboardOverviewOwnerScopeMatches() {
  const overviewQuery = overview.value?.query;
  if (!overviewQuery) return false;
  return (
    sameStringSet(overviewQuery.departments ?? [], query.departments) &&
    sameNumberSet(
      overviewQuery.operationGroupIds ?? [],
      query.operationGroupIds,
    )
  );
}

function dashboardResponsibleScopeForTables() {
  if (!dashboardResponsibleScopeActive()) return [];
  const overviewResponsibles = overview.value?.query.responsibles ?? [];
  if (overviewResponsibles.length > 0) return [...overviewResponsibles];
  if (query.departments.length > 0 || query.operationGroupIds.length > 0) {
    return dashboardOverviewOwnerScopeMatches() ? ['__NO_ACCESS__'] : [];
  }
  return [...query.responsibles];
}

function reportResponsiblesForDisplay(responsibles: string[] | undefined) {
  const values = [...(responsibles ?? [])].filter(
    (name) => name !== '__NO_ACCESS__',
  );
  if (!dashboardResponsibleScopeActive()) return values;
  const scope = dashboardResponsibleOptionsForChildren.value;
  if (scope.length === 0) return [];
  return sameStringSet(values, scope) ? [] : values;
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const values = new Set(left);
  return right.every((value) => values.has(value));
}

function sameNumberSet(left: number[], right: number[]) {
  if (left.length !== right.length) return false;
  const values = new Set(left.map(Number));
  return right.every((value) => values.has(Number(value)));
}

function normalizeReportDateRangeType(value: unknown): ReportDateRangeType {
  const rawValue = String(value || 'last30').trim();
  const normalized = rawValue.toLowerCase();
  if (normalized === 'currentmonth' || normalized === 'thismonth') {
    return 'currentMonth';
  }
  if (normalized === 'lastmonth') return 'lastMonth';
  if (normalized === 'today') return 'today';
  if (normalized === 'yesterday') return 'yesterday';
  if (
    normalized === 'last7' ||
    normalized === '7' ||
    normalized === 'recent7'
  ) {
    return 'last7';
  }
  if (
    normalized === 'last30' ||
    normalized === '30' ||
    normalized === 'recent30'
  ) {
    return 'last30';
  }
  if (normalized === 'year' || normalized === 'thisyear') return 'year';
  if (normalized === 'custom') return 'custom';
  return 'last30';
}

function reportDateRangeLabel(value: unknown) {
  const rawValue = String(value || '').trim();
  return (
    reportDateRangeLabels[rawValue] ??
    reportDateRangeLabels[rawValue.toLowerCase()] ??
    rawValue
  );
}

function reportCurrencySymbol(record?: Record<string, any>) {
  const code = String(record?.currencyCode || '')
    .trim()
    .toUpperCase();
  const symbol = String(record?.currencySymbol || '').trim();
  if (code === 'AED' || /[\u0600-\u06FF]/.test(symbol)) return 'AED ';
  return symbol || code;
}

function reportSummaryCurrencySymbol() {
  const symbols = new Set(
    reportRows.value.map((row) => reportCurrencySymbol(row)).filter(Boolean),
  );
  return symbols.size === 1 ? [...symbols][0] : '';
}

function formatReportMoneyValue(
  value: any,
  fractionDigits = 0,
  record?: Record<string, any>,
) {
  const symbol = record
    ? reportCurrencySymbol(record)
    : reportSummaryCurrencySymbol();
  const numeric = parseReportNumber(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${symbol}${numeric.toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })}`;
}

function parseReportNumber(value: any) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value)
    .replaceAll(/[,\s]/g, '')
    .replaceAll(/[^\d.+-]/g, '');
  return Number(normalized || 0);
}

function formatReportValue(
  key: string,
  value: any,
  record?: Record<string, any>,
) {
  const column = reportColumnMap.value.get(key);
  if (!column) return value ?? '-';
  if (value === null || value === undefined || value === '') return '-';
  if (column.kind === 'percent') return formatPercent(Number(value));
  if (column.kind === 'money') {
    const fractionDigits = ['cpc', 'cpo'].includes(key) ? 2 : 0;
    return formatReportMoneyValue(value, fractionDigits, record);
  }
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

function bindReportBodyScroll() {
  const root = reportSummaryScroll.value?.closest('.report-panel');
  const nextBody = root?.querySelector('.ant-table-body') as HTMLElement | null;
  if (reportBodyScrollElement === nextBody) return;
  stopReportColumnResize();
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
    query.projectTags.join('|'),
    query.responsibles.join('|'),
    query.sites.join('|'),
  ],
  () => {
    syncReportFiltersFromDashboard();
    scheduleDashboardReload({ reloadReport: true });
  },
);

watch(
  () => [query.endDate, query.granularity, query.siteDate, query.startDate],
  () => {
    syncReportFiltersFromDashboard();
    scheduleDashboardReload({ reloadReport: true });
  },
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
  stopReportColumnResize();
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
        <div class="toolbar-combo time-combo">
          <Select
            v-model:value="query.granularity"
            :options="granularityOptions"
            class="time-granularity-select"
            size="small"
          />
          <DatePicker
            v-if="isMonthMode"
            v-model:value="monthValue"
            :allow-clear="false"
            :disabled-date="disabledFutureDate"
            class="time-picker-merged"
            picker="month"
            size="small"
            value-format="YYYY-MM"
          />
          <DatePicker.RangePicker
            v-else
            v-model:value="dateRangeValue"
            :allow-clear="false"
            :disabled-date="disabledFutureDate"
            class="time-picker-merged"
            size="small"
            value-format="YYYY-MM-DD"
          />
        </div>
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
        <label>项目标签</label>
        <Select
          v-model:value="query.projectTags"
          :options="projectTagOptions"
          allow-clear
          mode="multiple"
          placeholder="全部"
          size="small"
          style="min-width: 150px"
        />
        <label>国家</label>
        <Dropdown
          v-model:open="dashboardCountryDropdownOpen"
          :trigger="['click']"
          @open-change="handleDashboardCountryOpenChange"
        >
          <Button class="toolbar-filter-trigger" size="small">
            {{ dashboardCountryButtonText }}
          </Button>
          <template #overlay>
            <div class="report-filter-menu dashboard-country-menu" @click.stop>
              <Checkbox
                :checked="isDashboardCountryDraftAllSelected()"
                @change="toggleDashboardCountryDraftAll"
              >
                全选
              </Checkbox>
              <div class="report-filter-scroll dashboard-country-scroll">
                <Checkbox
                  v-for="option in dashboardCountryOptions"
                  :key="option.value"
                  :checked="isDashboardCountryDraftChecked(option.value)"
                  @change="toggleDashboardCountryDraftValue(option.value)"
                >
                  {{ option.label }}
                </Checkbox>
              </div>
              <div class="report-filter-footer">
                <Button size="small" @click="cancelDashboardCountryFilter">
                  取消
                </Button>
                <Button
                  size="small"
                  type="primary"
                  @click="applyDashboardCountryFilter"
                >
                  确定
                </Button>
              </div>
            </div>
          </template>
        </Dropdown>

        <label>运营</label>
        <Dropdown
          v-model:open="dashboardOwnerDropdownOpen"
          :trigger="['click']"
          @open-change="handleDashboardOwnerOpenChange"
        >
          <Button
            class="toolbar-filter-trigger toolbar-filter-trigger-wide"
            size="small"
          >
            {{ dashboardOwnerButtonText }}
          </Button>
          <template #overlay>
            <div class="cascade-filter-menu owner-filter-menu" @click.stop>
              <div class="cascade-filter-left">
                <Checkbox
                  :checked="isDashboardOwnerDraftAllSelected()"
                  class="cascade-all-check"
                  @change="toggleDashboardOwnerDraftAll"
                >
                  全选
                </Checkbox>
                <div
                  v-for="group in dashboardOperationGroups"
                  :key="group.id"
                  class="cascade-filter-row owner-group-row"
                  :class="{
                    active: activeDashboardOwnerGroupId === String(group.id),
                  }"
                  @mouseenter="activeDashboardOwnerGroupId = String(group.id)"
                  @click="activeDashboardOwnerGroupId = String(group.id)"
                >
                  <Checkbox
                    :checked="isDashboardOwnerGroupChecked(group)"
                    @click.stop
                    @change="toggleDashboardOwnerGroup(group)"
                  >
                    <span class="cascade-name">{{ group.name }}</span>
                  </Checkbox>
                  <b>›</b>
                </div>
              </div>
              <div class="cascade-filter-right">
                <Checkbox
                  v-for="name in activeDashboardOwnerGroup?.memberNames ?? []"
                  :key="name"
                  :checked="isDashboardResponsibleChecked(name)"
                  @change="toggleDashboardResponsible(name)"
                >
                  {{ name }}
                </Checkbox>
              </div>
              <div class="cascade-filter-footer">
                <Button size="small" @click="cancelDashboardOwnerFilter">
                  取消
                </Button>
                <Button
                  size="small"
                  type="primary"
                  @click="applyDashboardOwnerFilter"
                >
                  确定
                </Button>
              </div>
            </div>
          </template>
        </Dropdown>
        <Button size="small" @click="resetFilters">重置</Button>

        <Tag :color="source?.status === 'ok' ? 'green' : 'orange'">
          {{ sourceMessage }}
        </Tag>
      </section>

      <section class="top-board">
        <aside class="gauge-column">
          <div class="white-panel gauge-panel">
            <div class="panel-heading">
              <h2>销量完成率</h2>
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

          <div class="white-panel gauge-panel">
            <div class="panel-heading">
              <h2>毛利润完成率</h2>
            </div>
            <div class="gauge-visual">
              <VChart
                autoresize
                class="gauge-chart"
                :option="gaugeOption(grossProfitCompletion, '#facc15')"
              />
              <div class="gauge-center">
                <strong>{{ formatCny(latest?.grossProfit) }}</strong>
                <span>{{ completionText(grossProfitCompletion) }}</span>
              </div>
            </div>
            <p>
              实际 {{ formatCny(latest?.grossProfit) }} / 目标
              {{ formatCny(targets?.dailyTargetProfit) }}
            </p>
          </div>
        </aside>

        <main class="sales-column">
          <div class="yellow-grid">
            <div class="metric-stack yellow-stack">
              <div class="hero-card yellow-card yellow-kpi-card">
                <div class="yellow-kpi-glass">
                  <span class="yellow-kpi-dot" aria-hidden="true"></span>
                  <div class="yellow-kpi-heading">
                    <span>{{ metricPrefix }}销量</span>
                    <em>SALES VOLUME</em>
                  </div>
                  <strong :title="formatInteger(latest?.salesQty)">
                    {{ formatInteger(latest?.salesQty) }}
                  </strong>
                </div>
              </div>
              <div
                class="comparison-card metric-comparison-card yellow-detail yellow-comparison-card"
              >
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
              <div class="hero-card yellow-card yellow-kpi-card">
                <div class="yellow-kpi-glass">
                  <span class="yellow-kpi-dot" aria-hidden="true"></span>
                  <div class="yellow-kpi-heading">
                    <span>{{ metricPrefix }}销售额</span>
                    <em>SALES REVENUE</em>
                  </div>
                  <strong :title="formatSalesMoney(latest?.salesAmount)">
                    {{ formatSalesMoney(latest?.salesAmount) }}
                  </strong>
                </div>
              </div>
              <div
                class="comparison-card metric-comparison-card yellow-detail yellow-comparison-card"
              >
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

            <div class="metric-stack yellow-stack">
              <div class="hero-card yellow-card yellow-kpi-card">
                <div class="yellow-kpi-glass">
                  <span class="yellow-kpi-dot" aria-hidden="true"></span>
                  <div class="yellow-kpi-heading">
                    <span>{{ metricPrefix }}毛利润</span>
                    <em>GROSS PROFIT</em>
                  </div>
                  <strong :title="formatCny(latest?.grossProfit)">
                    {{ formatCny(latest?.grossProfit) }}
                  </strong>
                  <!-- <small>
                    完成率 {{ completionText(grossProfitCompletion) }}
                  </small> -->
                </div>
              </div>
              <div
                class="comparison-card metric-comparison-card yellow-detail yellow-comparison-card"
              >
                <div>
                  <span>{{ previousLabel }}毛利</span>
                  <strong>{{ formatCny(previous?.grossProfit) }}</strong>
                </div>
                <div>
                  <span>{{ previousLabel }}差值</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.grossProfit,
                        previous?.grossProfit,
                      )
                    "
                  >
                    {{
                      comparisonDeltaText(
                        latest?.grossProfit,
                        previous?.grossProfit,
                        formatSignedCny,
                      )
                    }}
                  </strong>
                </div>
                <div>
                  <span>{{ previousLabel }}差异</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.grossProfit,
                        previous?.grossProfit,
                      )
                    "
                  >
                    {{
                      comparisonText(latest?.grossProfit, previous?.grossProfit)
                    }}
                  </strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}</span>
                  <strong>{{ formatCny(weekBefore?.grossProfit) }}</strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}差值</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.grossProfit,
                        weekBefore?.grossProfit,
                      )
                    "
                  >
                    {{
                      comparisonDeltaText(
                        latest?.grossProfit,
                        weekBefore?.grossProfit,
                        formatSignedCny,
                      )
                    }}
                  </strong>
                </div>
                <div>
                  <span>{{ secondaryLabel }}差异</span>
                  <strong
                    :class="
                      comparisonClass(
                        latest?.grossProfit,
                        weekBefore?.grossProfit,
                      )
                    "
                  >
                    {{
                      comparisonText(
                        latest?.grossProfit,
                        weekBefore?.grossProfit,
                      )
                    }}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div class="white-panel group-panel">
            <section class="group-track-section">
              <div class="panel-heading track-heading">
                <h2>
                  {{ metricPrefix }}销量完成率 - 部门维度 --数据来自产品表现
                </h2>
              </div>
              <div v-if="departmentCards.length > 0" class="group-track-grid">
                <article
                  v-for="(item, index) in departmentCards"
                  :key="item.name"
                  class="group-track-card"
                >
                  <div
                    class="group-track-icon"
                    :style="{ '--track-accent': groupAccent(index) }"
                  >
                    {{ index + 1 }}
                  </div>
                  <div class="group-track-body">
                    <button type="button">{{ item.name }} &gt;</button>
                    <strong>{{ formatPercent(item.completionRate) }}</strong>
                    <p>
                      目标销量
                      <b
                        :class="
                          comparisonClass(item.salesQty, item.dailyTargetUnits)
                        "
                        :title="
                          formatSignedInteger(
                            groupGap(item.salesQty, item.dailyTargetUnits),
                          )
                        "
                      >
                        {{
                          formatSignedInteger(
                            groupGap(item.salesQty, item.dailyTargetUnits),
                          )
                        }}
                      </b>
                    </p>
                  </div>
                </article>
              </div>
              <p v-else class="pending-text">请先在配置中心维护用户部门</p>
            </section>

            <section class="group-track-section">
              <div class="panel-heading track-heading">
                <h2>
                  {{ metricPrefix }}销售额完成率 - 部门维度 --数据来自产品表现
                </h2>
              </div>
              <div v-if="departmentCards.length > 0" class="group-track-grid">
                <article
                  v-for="(item, index) in departmentCards"
                  :key="`${item.name}-sales`"
                  class="group-track-card"
                >
                  <div
                    class="group-track-icon"
                    :style="{ '--track-accent': groupAccent(index) }"
                  >
                    {{ index + 1 }}
                  </div>
                  <div class="group-track-body">
                    <button type="button">{{ item.name }} &gt;</button>
                    <strong>{{
                      formatPercent(item.salesCompletionRate)
                    }}</strong>
                    <p>
                      目标销售额
                      <b
                        :class="
                          comparisonClass(
                            item.salesAmount,
                            item.dailyTargetSales,
                          )
                        "
                        :title="
                          formatSignedSalesMoney(
                            groupGap(item.salesAmount, item.dailyTargetSales),
                          )
                        "
                      >
                        {{
                          formatSignedSalesMoney(
                            groupGap(item.salesAmount, item.dailyTargetSales),
                          )
                        }}
                      </b>
                    </p>
                  </div>
                </article>
              </div>
              <p v-else class="pending-text">请先在配置中心维护用户部门</p>
            </section>

            <section class="group-track-section">
              <div class="panel-heading track-heading">
                <h2>
                  {{ metricPrefix }}毛利润完成率 - 部门维度
                  --数据取自利润表(已发放)
                </h2>
              </div>
              <div v-if="departmentCards.length > 0" class="group-track-grid">
                <article
                  v-for="(item, index) in departmentCards"
                  :key="`${item.name}-gross-profit`"
                  class="group-track-card"
                >
                  <div
                    class="group-track-icon"
                    :style="{ '--track-accent': groupAccent(index) }"
                  >
                    {{ index + 1 }}
                  </div>
                  <div class="group-track-body">
                    <button type="button">{{ item.name }} &gt;</button>
                    <strong>{{
                      formatPercent(item.grossProfitCompletionRate)
                    }}</strong>
                    <p>
                      目标毛利
                      <b
                        :class="
                          comparisonClass(
                            item.grossProfit,
                            item.dailyTargetProfit,
                          )
                        "
                        :title="
                          formatSignedCny(
                            groupGap(item.grossProfit, item.dailyTargetProfit),
                          )
                        "
                      >
                        {{
                          formatSignedCny(
                            groupGap(item.grossProfit, item.dailyTargetProfit),
                          )
                        }}
                      </b>
                    </p>
                  </div>
                </article>
              </div>
              <p v-else class="pending-text">请先在配置中心维护用户部门</p>
            </section>
          </div>
        </main>

        <aside class="tracking-column">
          <div class="blue-grid">
            <div class="metric-stack">
              <div
                class="hero-card blue-card blue-kpi-card"
                :title="`${currentPeriodLabel} 内广告花费绝对值 / 总销售额`"
              >
                <div class="blue-kpi-glass">
                  <span class="blue-kpi-dot" aria-hidden="true"></span>
                  <div class="blue-kpi-heading">
                    <span>推广费用占比</span>
                  </div>
                  <strong>{{ formatPercent(promotionRate) }}</strong>
                </div>
              </div>
              <div
                class="comparison-card blue-detail blue-detail-six blue-comparison-card"
              >
                <div>
                  <span>广告费</span>
                  <strong>{{
                    formatUsd(advertising?.summary.totalSpend)
                  }}</strong>
                </div>
                <div>
                  <span>ACoAS</span>
                  <strong>{{ formatPercent(adAcoas) }}</strong>
                </div>
                <div>
                  <span>{{ previousCompareLabel }}推广费占比</span>
                  <strong>{{ formatPercent(previousPromotionRate) }}</strong>
                  <small>{{ previousPeriodLabel }}</small>
                </div>
                <div>
                  <span>环比</span>
                  <strong
                    :class="
                      comparisonClass(
                        promotionRate,
                        previousPromotionRate,
                        true,
                      )
                    "
                  >
                    {{ comparisonText(promotionRate, previousPromotionRate) }}
                  </strong>
                </div>
                <div>
                  <span>{{ weekCompareLabel }}推广费占比</span>
                  <strong>{{ formatPercent(weekBeforePromotionRate) }}</strong>
                  <small>{{ secondaryPeriodLabel }}</small>
                </div>
                <div>
                  <span>周同比</span>
                  <strong
                    :class="
                      comparisonClass(
                        promotionRate,
                        weekBeforePromotionRate,
                        true,
                      )
                    "
                  >
                    {{ comparisonText(promotionRate, weekBeforePromotionRate) }}
                  </strong>
                </div>
              </div>
            </div>

            <div class="metric-stack">
              <div
                class="hero-card blue-card blue-kpi-card"
                :title="`${currentPeriodLabel} 内周转库存 / 销售速度 / 30`"
              >
                <div class="blue-kpi-glass">
                  <span class="blue-kpi-dot" aria-hidden="true"></span>
                  <div class="blue-kpi-heading">
                    <span>周转周期(月)</span>
                  </div>
                  <strong>
                    {{ turnover(latest?.turnoverMonths) }}
                    <i class="blue-kpi-status" aria-hidden="true"></i>
                  </strong>
                </div>
              </div>
              <div class="comparison-card blue-detail blue-comparison-card">
                <div>
                  <span>{{ previousCompareLabel }}周转</span>
                  <strong>{{ turnover(previous?.turnoverMonths) }}</strong>
                  <small>{{ previousPeriodLabel }}</small>
                </div>
                <div>
                  <span>环比</span>
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
                  <span>{{ weekCompareLabel }}周转</span>
                  <strong>{{ turnover(weekBefore?.turnoverMonths) }}</strong>
                  <small>{{ secondaryPeriodLabel }}</small>
                </div>
                <div>
                  <span>周同比</span>
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
            <div class="panel-heading responsible-heading">
              <h2>
                {{ metricPrefix }}销量完成率 -
                运营负责人维度--毛利润数据来自利润表(已发放)
              </h2>
              <div class="responsible-heading-actions">
                <span>
                  展示 {{ responsibleCards.length }} 人， 有销量
                  {{ activeResponsibleCount }} 人
                </span>
                <Dropdown
                  v-model:open="responsibleOwnerDropdownOpen"
                  :get-popup-container="ownerDropdownPopupContainer"
                  :trigger="['click']"
                  @open-change="handleResponsibleOwnerOpenChange"
                >
                  <Button class="responsible-owner-trigger" size="small">
                    {{ responsibleOwnerButtonText }}
                  </Button>
                  <template #overlay>
                    <div
                      class="dashboard-owner-menu responsible-owner-menu"
                      @click.stop
                    >
                      <div class="cascade-filter-header">
                        <Checkbox
                          :checked="isResponsibleOwnerDraftAllSelected()"
                          @change="toggleResponsibleOwnerDraftAll"
                        >
                          全部运营组 / 负责人
                        </Checkbox>
                      </div>
                      <div class="dashboard-owner-cascade">
                        <div class="dashboard-owner-groups">
                          <button
                            v-for="group in dashboardOperationGroups"
                            :key="group.id"
                            class="cascade-filter-row owner-group-row"
                            :class="{
                              active:
                                activeResponsibleOwnerGroupId ===
                                String(group.id),
                            }"
                            type="button"
                            @mouseenter="
                              activeResponsibleOwnerGroupId = String(group.id)
                            "
                            @click="
                              activeResponsibleOwnerGroupId = String(group.id)
                            "
                          >
                            <Checkbox
                              :checked="isResponsibleOwnerGroupChecked(group)"
                              @click.stop
                              @change="toggleResponsibleOwnerGroup(group)"
                            />
                            <span class="cascade-name">{{ group.name }}</span>
                            <span class="cascade-count">
                              {{ group.memberNames.length }}
                            </span>
                          </button>
                        </div>
                        <div class="dashboard-owner-members">
                          <Checkbox
                            v-for="name in activeResponsibleOwnerMembers"
                            :key="name"
                            :checked="isResponsibleOwnerChecked(name)"
                            @change="toggleResponsibleOwner(name)"
                          >
                            {{ name }}
                          </Checkbox>
                        </div>
                      </div>
                      <div class="report-filter-footer">
                        <Button
                          size="small"
                          @click="cancelResponsibleOwnerFilter"
                        >
                          取消
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          @click="applyResponsibleOwnerFilter"
                        >
                          确定
                        </Button>
                      </div>
                    </div>
                  </template>
                </Dropdown>
              </div>
            </div>
            <div v-if="responsibleCards.length > 0" class="responsible-grid">
              <article v-for="item in responsibleCards" :key="item.name">
                <button
                  class="responsible-card-name"
                  :title="item.name"
                  type="button"
                >
                  {{ item.name }} &gt;
                </button>
                <p>
                  销售额完成率
                  <b
                    :class="
                      completionTextClass(
                        ratio(item.salesAmount, item.dailyTargetSales),
                      )
                    "
                  >
                    {{
                      formatPercent(
                        ratio(item.salesAmount, item.dailyTargetSales),
                      )
                    }}
                  </b>
                </p>
                <p>
                  目标销售额
                  <b :title="formatSalesMoney(item.dailyTargetSales)">
                    {{ formatSalesMoney(item.dailyTargetSales) }}
                  </b>
                </p>
                <p>
                  销量完成率
                  <b :class="completionTextClass(item.completionRate)">
                    {{ formatPercent(item.completionRate) }}
                  </b>
                </p>
                <p>
                  目标销量
                  <b :title="formatInteger(item.dailyTargetUnits)">
                    {{ formatInteger(item.dailyTargetUnits) }}
                  </b>
                </p>
                <p>
                  毛利润
                  <b :title="formatCny(item.grossProfit)">
                    {{ formatCny(item.grossProfit) }}
                  </b>
                </p>
                <p>
                  目标毛利
                  <b :title="formatCny(item.dailyTargetProfit)">
                    {{ formatCny(item.dailyTargetProfit) }}
                  </b>
                </p>
                <p>
                  毛利完成率
                  <b
                    :class="completionTextClass(item.grossProfitCompletionRate)"
                  >
                    {{ formatPercent(item.grossProfitCompletionRate) }}
                  </b>
                </p>
                <p>
                  毛利率
                  <b>{{ formatPercent(item.grossMarginRate) }}</b>
                </p>
                <p>
                  目标毛利率
                  <b>{{ formatPercent(item.targetGrossMarginRate) }}</b>
                </p>
                <p>
                  毛利率完成率
                  <b
                    :class="completionTextClass(item.grossMarginCompletionRate)"
                  >
                    {{ formatPercent(item.grossMarginCompletionRate) }}
                  </b>
                </p>
                <p>
                  FBA可售
                  <b>{{ formatInteger(item.fbaAvailableQty) }}</b>
                </p>
                <p>
                  周转周期(月)
                  <b>{{ turnover(item.turnoverMonths) }}</b>
                </p>
                <p>
                  广告ACoAS
                  <b>{{ formatPercent(item.adAcoas) }}</b>
                </p>
                <p>
                  推广费占比
                  <b>{{ formatPercent(item.promotionRate) }}</b>
                </p>
              </article>
            </div>
            <Empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" />
          </div>
        </aside>
      </section>

      <ProductDetailTable
        :base-params="productDetailBaseParams"
        :responsible-options="dashboardResponsibleOptionsForChildren"
      />

      <section class="white-panel report-panel">
        <div class="report-heading">
          <div>
            <h2>商品维度明细报表</h2>
            <span>
              {{ reportDateRangeLabel(report?.query.dateRangeType) }}：{{
                report?.query.startDate
              }}
              ~ {{ report?.query.endDate }}，共
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
                  applyReportDateRangeType(reportQuery.dateRangeType);
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
            <label>国家</label>
            <Dropdown
              v-model:open="reportFilterDropdownOpen.countries"
              :trigger="['click']"
              @open-change="
                (open) => handleReportFilterOpenChange('countries', open)
              "
            >
              <Button class="report-filter-trigger" size="small">
                {{
                  reportFilterButtonText(
                    'countries',
                    '全部',
                    reportCountryOptions,
                  )
                }}
              </Button>
              <template #overlay>
                <div class="report-filter-menu" @click.stop>
                  <Checkbox
                    :checked="
                      isReportFilterDraftAllSelected(
                        'countries',
                        reportCountryOptions,
                      )
                    "
                    @change="
                      () =>
                        toggleReportFilterDraftAll(
                          'countries',
                          reportCountryOptions,
                        )
                    "
                  >
                    全选
                  </Checkbox>
                  <div class="report-filter-scroll">
                    <Checkbox
                      v-for="option in reportCountryOptions"
                      :key="option.value"
                      :checked="
                        isReportFilterDraftChecked('countries', option.value)
                      "
                      @change="
                        () =>
                          toggleReportFilterDraftValue(
                            'countries',
                            option.value,
                          )
                      "
                    >
                      {{ option.label }}
                    </Checkbox>
                  </div>
                  <div class="report-filter-footer">
                    <Button
                      size="small"
                      @click="cancelReportFilter('countries')"
                    >
                      取消
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      @click="applyReportFilter('countries')"
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </template>
            </Dropdown>
            <label>新品/老品</label>
            <Dropdown
              v-model:open="reportFilterDropdownOpen.productTypes"
              :trigger="['click']"
              @open-change="
                (open) => handleReportFilterOpenChange('productTypes', open)
              "
            >
              <Button class="report-filter-trigger" size="small">
                {{
                  reportFilterButtonText(
                    'productTypes',
                    '全部',
                    reportProductTypeOptions,
                  )
                }}
              </Button>
              <template #overlay>
                <div
                  class="report-filter-menu report-filter-menu-compact"
                  @click.stop
                >
                  <Checkbox
                    :checked="
                      isReportFilterDraftAllSelected(
                        'productTypes',
                        reportProductTypeOptions,
                      )
                    "
                    @change="
                      () =>
                        toggleReportFilterDraftAll(
                          'productTypes',
                          reportProductTypeOptions,
                        )
                    "
                  >
                    全选
                  </Checkbox>
                  <div class="report-filter-scroll">
                    <Checkbox
                      v-for="option in reportProductTypeOptions"
                      :key="option.value"
                      :checked="
                        isReportFilterDraftChecked('productTypes', option.value)
                      "
                      @change="
                        () =>
                          toggleReportFilterDraftValue(
                            'productTypes',
                            option.value,
                          )
                      "
                    >
                      {{ option.label }}
                    </Checkbox>
                  </div>
                  <div class="report-filter-footer">
                    <Button
                      size="small"
                      @click="cancelReportFilter('productTypes')"
                    >
                      取消
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      @click="applyReportFilter('productTypes')"
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </template>
            </Dropdown>
            <label>运营组</label>
            <Dropdown
              v-model:open="reportFilterDropdownOpen.operationGroupIds"
              :trigger="['click']"
              @open-change="
                (open) =>
                  handleReportFilterOpenChange('operationGroupIds', open)
              "
            >
              <Button
                class="report-filter-trigger report-filter-trigger-wide"
                size="small"
              >
                {{
                  reportFilterButtonText(
                    'operationGroupIds',
                    '继承主筛选',
                    reportOperationGroupOptions,
                  )
                }}
              </Button>
              <template #overlay>
                <div
                  class="report-filter-menu report-filter-menu-wide"
                  @click.stop
                >
                  <Checkbox
                    :checked="
                      isReportFilterDraftAllSelected(
                        'operationGroupIds',
                        reportOperationGroupOptions,
                      )
                    "
                    @change="
                      () =>
                        toggleReportFilterDraftAll(
                          'operationGroupIds',
                          reportOperationGroupOptions,
                        )
                    "
                  >
                    全选
                  </Checkbox>
                  <div class="report-filter-scroll">
                    <div
                      v-for="option in reportOperationGroupOptions"
                      :key="option.value"
                      class="report-group-option"
                    >
                      <Checkbox
                        :checked="
                          isReportFilterDraftChecked(
                            'operationGroupIds',
                            option.value,
                          )
                        "
                        @change="
                          () =>
                            toggleReportFilterDraftValue(
                              'operationGroupIds',
                              option.value,
                            )
                        "
                      >
                        <span class="report-group-name">{{
                          option.label
                        }}</span>
                        <span class="report-group-count">
                          {{ option.group.memberNames.length }}人
                        </span>
                      </Checkbox>
                      <Button
                        size="small"
                        type="link"
                        @click.stop="drillReportOperationGroup(option.group)"
                      >
                        下钻
                      </Button>
                    </div>
                  </div>
                  <div class="report-filter-footer">
                    <Button
                      size="small"
                      @click="cancelReportFilter('operationGroupIds')"
                    >
                      取消
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      @click="applyReportFilter('operationGroupIds')"
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </template>
            </Dropdown>
            <label>SPU</label>
            <Dropdown
              v-model:open="reportFilterDropdownOpen.spus"
              :trigger="['click']"
              @open-change="
                (open) => handleReportFilterOpenChange('spus', open)
              "
            >
              <Button
                class="report-filter-trigger report-filter-trigger-wide"
                size="small"
              >
                {{ reportFilterButtonText('spus', '全部', reportSpuOptions) }}
              </Button>
              <template #overlay>
                <div
                  class="report-filter-menu report-filter-menu-wide"
                  @click.stop
                >
                  <Checkbox
                    :checked="
                      isReportFilterDraftAllSelected('spus', reportSpuOptions)
                    "
                    @change="
                      () => toggleReportFilterDraftAll('spus', reportSpuOptions)
                    "
                  >
                    全选
                  </Checkbox>
                  <div class="report-filter-scroll">
                    <Checkbox
                      v-for="option in reportSpuOptions"
                      :key="option.value"
                      :checked="
                        isReportFilterDraftChecked('spus', option.value)
                      "
                      @change="
                        () => toggleReportFilterDraftValue('spus', option.value)
                      "
                    >
                      {{ option.label }}
                    </Checkbox>
                  </div>
                  <div class="report-filter-footer">
                    <Button size="small" @click="cancelReportFilter('spus')">
                      取消
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      @click="applyReportFilter('spus')"
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </template>
            </Dropdown>
            <label>负责人</label>
            <Dropdown
              v-model:open="reportFilterDropdownOpen.responsibles"
              :trigger="['click']"
              @open-change="
                (open) => handleReportFilterOpenChange('responsibles', open)
              "
            >
              <Button
                class="report-filter-trigger report-filter-trigger-wide"
                size="small"
              >
                {{
                  reportFilterButtonText(
                    'responsibles',
                    '继承主筛选',
                    reportResponsibleOptions,
                  )
                }}
              </Button>
              <template #overlay>
                <div
                  class="report-filter-menu report-filter-menu-wide"
                  @click.stop
                >
                  <Checkbox
                    :checked="
                      isReportFilterDraftAllSelected(
                        'responsibles',
                        reportResponsibleOptions,
                      )
                    "
                    @change="
                      () =>
                        toggleReportFilterDraftAll(
                          'responsibles',
                          reportResponsibleOptions,
                        )
                    "
                  >
                    全选
                  </Checkbox>
                  <div class="report-filter-scroll">
                    <Checkbox
                      v-for="option in reportResponsibleOptions"
                      :key="option.value"
                      :checked="
                        isReportFilterDraftChecked('responsibles', option.value)
                      "
                      @change="
                        () =>
                          toggleReportFilterDraftValue(
                            'responsibles',
                            option.value,
                          )
                      "
                    >
                      {{ option.label }}
                    </Checkbox>
                  </div>
                  <div class="report-filter-footer">
                    <Button
                      size="small"
                      @click="cancelReportFilter('responsibles')"
                    >
                      取消
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      @click="applyReportFilter('responsibles')"
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </template>
            </Dropdown>
            <label>列</label>
            <Button size="small" @click="openReportColumnConfig">
              列配置（{{ selectedReportColumns.length }}）
            </Button>
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
          :scroll="{ x: reportScrollX, y: 520 }"
          size="small"
          @change="handleReportTableChange"
          @click.capture="handleReportHeaderClickCapture"
          @mousedown.capture="handleReportHeaderMouseDownCapture"
        >
          <template #headerCell="{ column }">
            <div class="report-resizable-header">
              <span>{{ column.title }}</span>
              <button
                aria-label="Resize column"
                class="report-column-resize-handle"
                :data-column-key="reportColumnKey(column)"
                type="button"
                @click.stop
                @pointerdown.stop
                @mousedown="
                  (event) =>
                    startReportColumnResize(reportColumnKey(column), event)
                "
              ></button>
            </div>
          </template>
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
                :title="
                  formatReportValue(reportColumnKey(column), text, record)
                "
              >
                {{ formatReportValue(reportColumnKey(column), text, record) }}
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
                  :style="{
                    width: `${reportColumnDisplayWidth(column.key)}px`,
                  }"
                  :title="reportSummaryValue(column.key, index)"
                >
                  {{ reportSummaryValue(column.key, index) }}
                </div>
              </div>
            </div>
          </template>
        </Table>
      </section>

      <Modal
        v-model:open="reportColumnConfigOpen"
        :footer="null"
        title="展示列配置"
        width="920px"
        wrap-class-name="report-column-modal-wrap"
      >
        <div class="report-column-config">
          <section class="report-column-pool">
            <div class="report-column-config-bar">
              <Input
                v-model:value="reportColumnSearch"
                allow-clear
                placeholder="搜索字段"
                size="small"
              />
            </div>
            <div class="report-column-groups">
              <article
                v-for="group in reportColumnGroups"
                :key="group.key"
                class="report-column-group"
              >
                <header>
                  <span>{{ group.title }}</span>
                  <button
                    type="button"
                    @click="toggleReportColumnGroup(group.columns)"
                  >
                    {{
                      isReportColumnGroupAllSelected(group.columns)
                        ? '取消全选'
                        : '全选'
                    }}
                  </button>
                </header>
                <div class="report-column-check-grid">
                  <Checkbox
                    v-for="column in group.columns"
                    :key="column.key"
                    :checked="isReportColumnDraftChecked(column.key)"
                    @change="() => toggleReportColumnDraft(column.key)"
                  >
                    {{ column.label }}
                  </Checkbox>
                </div>
              </article>
            </div>
          </section>
          <aside class="report-column-selected">
            <header>
              <strong>已选({{ reportColumnDraft.length }})</strong>
              <span>最多可固定7项，拖拽可调整顺序</span>
            </header>
            <ol class="report-column-selected-list">
              <li
                v-for="(column, index) in selectedReportColumnDraftMetas"
                :key="column.key"
                draggable="true"
                @dragover.prevent
                @dragstart="handleReportColumnDragStart(column.key)"
                @drop="handleReportColumnDrop(column.key)"
              >
                <span class="report-column-drag">::</span>
                <span class="report-column-order">{{ index + 1 }}</span>
                <b>{{ column.label }}</b>
                <div>
                  <button
                    :disabled="index === 0"
                    type="button"
                    @click="moveReportColumnDraft(column.key, -1)"
                  >
                    ↑
                  </button>
                  <button
                    :disabled="index === reportColumnDraft.length - 1"
                    type="button"
                    @click="moveReportColumnDraft(column.key, 1)"
                  >
                    ↓
                  </button>
                  <button
                    :class="{ active: isReportColumnPinned(column.key) }"
                    type="button"
                    @click="toggleReportColumnPinned(column.key)"
                  >
                    固定
                  </button>
                  <button
                    type="button"
                    @click="removeReportColumnDraft(column.key)"
                  >
                    移除
                  </button>
                </div>
              </li>
            </ol>
          </aside>
        </div>
        <div class="report-column-config-footer">
          <Button @click="reportColumnConfigOpen = false">取消</Button>
          <Button type="primary" @click="applyReportColumnConfig">确定</Button>
        </div>
      </Modal>

      <footer class="screen-note">
        当前已接入：日/月维度、利润表经营数据、目标完成率、推广占比、库存快照、运营组配置、负责人完成率和商品维度明细报表。
      </footer>
    </div>
  </Spin>
</template>

<style scoped>
.completion-screen {
  --analytics-bg: #eef2f7;
  --analytics-panel: #fff;
  --analytics-panel-muted: #f8fafc;
  --analytics-text: #334155;
  --analytics-heading: #334155;
  --analytics-strong: #111827;
  --analytics-muted: #94a3b8;
  --analytics-subtle: #64748b;
  --analytics-border: #e2e8f0;
  --analytics-border-strong: #cbd5e1;
  --analytics-hover: #eff6ff;
  --analytics-summary-bg: #fff7ed;
  --analytics-sparkline-bg: linear-gradient(180deg, #f8fafc, #fff);
  --analytics-note-border: #cbd5e1;
  --analytics-accent-label: #1d4ed8;

  min-height: calc(100vh - 92px);
  padding: 10px;
  color: var(--analytics-text);
  background: var(--analytics-bg);
}

:global(.dark) .completion-screen {
  --analytics-bg: #020617;
  --analytics-panel: #0f172a;
  --analytics-panel-muted: #111827;
  --analytics-text: #cbd5e1;
  --analytics-heading: #e5e7eb;
  --analytics-strong: #f8fafc;
  --analytics-muted: #94a3b8;
  --analytics-subtle: #a3b2c7;
  --analytics-border: #1e293b;
  --analytics-border-strong: #334155;
  --analytics-hover: #172554;
  --analytics-summary-bg: #251a10;
  --analytics-sparkline-bg: linear-gradient(180deg, #111827, #0f172a);
  --analytics-note-border: #334155;
  --analytics-accent-label: #93c5fd;
}

.screen-toolbar,
.top-board,
.yellow-grid,
.blue-grid,
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
  background: var(--analytics-panel);
  border: 1px solid var(--analytics-border);
}

.toolbar-flag {
  color: #ef4444;
}

.screen-toolbar label {
  color: var(--analytics-accent-label);
}

.toolbar-combo {
  display: inline-flex;
  align-items: center;
}

.time-combo :deep(.ant-select-selector) {
  border-start-end-radius: 0 !important;
  border-end-end-radius: 0 !important;
}

.time-granularity-select {
  width: 76px;
}

.time-picker-merged {
  min-width: 205px;
  margin-left: -1px;
}

.time-picker-merged :deep(.ant-picker) {
  border-start-start-radius: 0 !important;
  border-end-start-radius: 0 !important;
}

.toolbar-filter-trigger {
  min-width: 112px;
  text-align: left;
}

.toolbar-filter-trigger-wide {
  min-width: 150px;
}

.cascade-filter-menu {
  position: relative;
  z-index: 1100;
  display: grid;
  grid-template-rows: minmax(238px, auto) auto;
  grid-template-columns: 228px 180px;
  overflow: hidden;
  background: var(--analytics-panel, #fff);
  border: 1px solid var(--analytics-border);
  border-radius: 4px;
  box-shadow: 0 12px 30px rgb(15 23 42 / 24%);
}

:global(.dark) .cascade-filter-menu {
  background: #0f172a;
}

.owner-filter-menu {
  grid-template-columns: 250px 180px;
}

.cascade-filter-left,
.cascade-filter-right {
  display: grid;
  align-content: start;
  max-height: 288px;
  overflow-y: auto;
}

.cascade-filter-left {
  border-right: 1px solid var(--analytics-border);
}

.cascade-filter-right {
  padding-top: 8px;
}

.cascade-all-check,
.cascade-filter-right .ant-checkbox-wrapper {
  display: flex;
  min-height: 30px;
  padding: 6px 12px;
  margin-inline-start: 0;
  color: var(--analytics-text);
}

.cascade-filter-right .ant-checkbox-wrapper:hover,
.cascade-filter-row:hover,
.cascade-filter-row.active {
  background: var(--analytics-panel-muted);
}

.cascade-filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 32px;
  padding: 6px 10px 6px 12px;
  color: var(--analytics-text);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.cascade-filter-row b {
  color: var(--analytics-muted);
}

.owner-group-row {
  grid-template-columns: 18px minmax(0, 1fr) auto;
  padding-top: 4px;
  padding-bottom: 4px;
}

.owner-group-row .ant-checkbox-wrapper {
  min-width: 0;
  margin-inline-start: 0;
  color: var(--analytics-text);
}

.cascade-name {
  display: inline-block;
  max-width: 176px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.cascade-filter-footer {
  display: flex;
  grid-column: 1 / -1;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 10px;
  background: var(--analytics-panel-muted);
  border-top: 1px solid var(--analytics-border);
}

.top-board {
  grid-template-rows: minmax(190px, auto) repeat(2, minmax(128px, 1fr));
  grid-template-columns: 226px minmax(380px, 0.72fr) minmax(0, 0.94fr) 500px;
  align-items: stretch;
}

.gauge-column,
.metric-stack {
  display: grid;
  gap: 6px;
  align-content: stretch;
}

.gauge-column {
  grid-template-rows: repeat(3, minmax(0, 1fr));
  grid-row: 1 / 4;
  height: 100%;
}

.gauge-column p {
  font-size: 13px;
}

.sales-column,
.tracking-column {
  display: contents;
}

.sales-column > .yellow-grid {
  grid-row: 1;
  grid-column: 2 / 4;
}

.tracking-column > .blue-grid {
  grid-row: 1;
  grid-column: 4;
}

.sales-column > .group-panel:nth-of-type(2) {
  grid-row: 2 / 4;
  grid-column: 2;
}

.tracking-column > .responsible-panel {
  grid-row: 2 / 4;
  grid-column: 3 / 5;
}

.white-panel,
.hero-card,
.comparison-card {
  background: var(--analytics-panel);
  border: 1px solid var(--analytics-border);
  border-radius: 5px;
}

.white-panel {
  padding: 8px;
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
  color: var(--analytics-heading);
}

.panel-heading span,
.gauge-panel p,
.hero-card span,
.hero-card em,
.comparison-card span,
.screen-note {
  font-size: 11px;
  font-style: normal;
  color: var(--analytics-muted);
}

.gauge-panel {
  display: grid;
  grid-template-rows: auto minmax(88px, 1fr) auto;
  gap: 2px;
  min-height: 0;
}

.gauge-visual {
  position: relative;
  align-self: stretch;
  min-height: 88px;
}

.gauge-chart {
  height: 100%;
}

.gauge-center {
  position: absolute;
  top: 55%;
  left: 50%;
  display: grid;
  gap: 1px;
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
  font-size: 15px;
  font-weight: 850;
  line-height: 1.1;
  color: var(--analytics-strong);
  white-space: nowrap;
}

.gauge-center span {
  font-size: 11px;
  font-weight: 800;
  color: var(--analytics-subtle);
}

.gauge-panel p {
  margin: 0;
  text-align: center;
}

.pending-text {
  color: #f59e0b !important;
}

.yellow-grid,
.blue-grid {
  align-self: stretch;
  height: 100%;
}

.yellow-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.blue-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.yellow-grid > .metric-stack,
.blue-grid > .metric-stack {
  grid-template-rows: minmax(120px, 1fr) minmax(118px, auto);
  min-height: 0;
}

.yellow-grid > .metric-stack {
  grid-template-rows: 138px minmax(0, 1fr);
}

.blue-grid > .metric-stack {
  grid-template-rows: 138px minmax(0, 1fr);
}

.hero-card {
  position: relative;
  min-height: 112px;
  padding: 14px 16px;
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
  margin: 5px 0 3px;
  font-size: 32px;
  color: #fff;
  letter-spacing: 1px;
}

.yellow-card {
  background:
    radial-gradient(
      circle at 84% -18%,
      rgb(255 255 255 / 46%),
      transparent 32%
    ),
    linear-gradient(142deg, #ea580c 0%, #d97706 42%, #eab308 100%);
  border-color: rgb(251 191 36 / 70%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 38%),
    0 12px 24px rgb(180 83 9 / 16%);
}

.yellow-grid .hero-card {
  min-height: 0;
  padding: 12px 16px;
}

.yellow-kpi-card::before {
  position: absolute;
  inset: 0;
  content: '';
  background:
    repeating-linear-gradient(
      -24deg,
      rgb(255 255 255 / 0%) 0,
      rgb(255 255 255 / 0%) 18px,
      rgb(255 255 255 / 12%) 19px,
      rgb(255 255 255 / 12%) 21px
    ),
    radial-gradient(ellipse at 18% 0, rgb(255 255 255 / 22%), transparent 48%);
  opacity: 0.42;
}

.yellow-kpi-card::after {
  right: -42px;
  bottom: -76px;
  width: 178px;
  height: 178px;
  border-color: rgb(255 255 255 / 14%);
  border-width: 22px;
}

.yellow-kpi-glass {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 6px;
  align-content: center;
  width: min(82%, 340px);
  height: 100%;
  min-height: 108px;
  padding: 14px 18px 12px;
  margin: 0 auto;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 30%), rgb(255 255 255 / 9%)),
    linear-gradient(180deg, rgb(255 214 102 / 28%), rgb(249 115 22 / 12%));
  border: 1px solid rgb(255 255 255 / 38%);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 34%),
    0 10px 22px rgb(146 64 14 / 18%);
  backdrop-filter: blur(6px);
}

.yellow-kpi-glass::after {
  position: absolute;
  right: -28px;
  bottom: -34px;
  width: 92px;
  height: 92px;
  content: '';
  border: 12px solid rgb(255 255 255 / 10%);
  border-radius: 999px;
}

.yellow-kpi-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.yellow-kpi-heading span,
.yellow-kpi-heading em {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
  color: #fff;
  white-space: nowrap;
}

.yellow-kpi-heading span {
  justify-self: center;
  padding-left: 18px;
  font-size: 15px;
  font-weight: 850;
}

.yellow-kpi-heading em {
  font-size: 10px;
  font-weight: 800;
  color: rgb(255 255 255 / 72%);
}

.yellow-kpi-dot {
  position: absolute;
  top: 13px;
  left: 13px;
  width: 15px;
  height: 15px;
  background-image: radial-gradient(
    circle,
    rgb(255 255 255 / 78%) 1.3px,
    transparent 1.7px
  );
  background-size: 5px 5px;
}

.yellow-grid .yellow-kpi-glass strong {
  position: relative;
  z-index: 1;
  place-self: center;
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 40px;
  font-weight: 900;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 2px 10px rgb(146 64 14 / 22%);
}

.yellow-grid .yellow-kpi-glass small {
  position: relative;
  z-index: 1;
  place-self: center;
  font-size: 12px;
  font-weight: 800;
  color: rgb(255 255 255 / 82%);
}

.yellow-grid .hero-card span,
.yellow-grid .hero-card em {
  line-height: 1.2;
}

.blue-card {
  background:
    radial-gradient(circle at 104% 0, rgb(255 255 255 / 30%), transparent 24%),
    linear-gradient(146deg, #2638f0 0%, #4b45f5 48%, #2368f4 100%);
  border-color: rgb(96 165 250 / 78%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 28%),
    0 12px 24px rgb(37 99 235 / 18%);
}

.blue-kpi-card::before {
  position: absolute;
  inset: 0;
  content: '';
  background:
    radial-gradient(
      circle at 5px 5px,
      rgb(255 255 255 / 48%) 1px,
      transparent 1.6px
    ),
    linear-gradient(
      108deg,
      rgb(15 23 42 / 0%) 0 38%,
      rgb(30 64 175 / 28%) 39% 59%,
      rgb(15 23 42 / 0%) 60%
    );
  background-size:
    6px 6px,
    100% 100%;
  opacity: 0.38;
  mask-image: linear-gradient(90deg, transparent 0 8%, #000 78% 100%);
}

.blue-kpi-card::after {
  right: -46px;
  bottom: -78px;
  width: 184px;
  height: 184px;
  border-color: rgb(255 255 255 / 11%);
  border-width: 22px;
}

.blue-grid .hero-card {
  min-height: 0;
  padding: 12px 16px;
}

.blue-kpi-glass {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  align-content: center;
  width: min(86%, 236px);
  height: 100%;
  min-height: 108px;
  padding: 14px 18px 12px;
  margin: 0 auto;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 28%), rgb(255 255 255 / 8%)),
    linear-gradient(180deg, rgb(96 165 250 / 22%), rgb(49 46 129 / 14%));
  border: 1px solid rgb(255 255 255 / 32%);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 26%),
    0 10px 22px rgb(30 64 175 / 24%);
  backdrop-filter: blur(6px);
}

.blue-kpi-glass::after {
  position: absolute;
  right: -30px;
  bottom: -36px;
  width: 92px;
  height: 92px;
  content: '';
  border: 12px solid rgb(255 255 255 / 8%);
  border-radius: 999px;
}

.blue-kpi-heading {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  min-height: 20px;
}

.blue-kpi-heading span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 15px;
  font-weight: 850;
  line-height: 1.15;
  color: #fff;
  white-space: nowrap;
}

.blue-kpi-dot {
  position: absolute;
  top: 17px;
  left: 18px;
  z-index: 2;
  width: 14px;
  height: 14px;
  background-image: radial-gradient(
    circle,
    rgb(255 255 255 / 78%) 1.2px,
    transparent 1.7px
  );
  background-size: 5px 5px;
}

.blue-grid .blue-kpi-glass strong {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 42px;
  font-weight: 900;
  line-height: 1;
  color: #fde047;
  white-space: nowrap;
  text-shadow: 0 2px 12px rgb(15 23 42 / 24%);
}

.blue-kpi-status {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  background: #22c55e;
  border-radius: 999px;
  box-shadow: 0 0 0 5px rgb(34 197 94 / 18%);
}

.blue-kpi-status::before {
  position: absolute;
  width: 8px;
  height: 5px;
  content: '';
  border-bottom: 2px solid #2563eb;
  border-left: 2px solid #2563eb;
  transform: translate(7px, 7px) rotate(-45deg);
}

.blue-grid .comparison-card {
  min-height: 0;
}

.comparison-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: 118px;
  overflow: hidden;
}

.metric-comparison-card {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.comparison-card div {
  padding: 10px 12px;
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
  margin-top: 4px;
  font-size: 15px;
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
  align-content: center;
  color: #fff;
  background:
    radial-gradient(
      circle at 88% -12%,
      rgb(255 255 255 / 32%),
      transparent 30%
    ),
    linear-gradient(
      142deg,
      rgb(249 115 22 / 96%) 0%,
      rgb(245 158 11 / 94%) 46%,
      rgb(250 204 21 / 92%) 100%
    );
  border-color: rgb(251 191 36 / 62%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 28%),
    0 10px 20px rgb(180 83 9 / 12%);
}

.yellow-comparison-card {
  position: relative;
  overflow: visible;
}

.yellow-comparison-card::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background:
    linear-gradient(135deg, rgb(255 255 255 / 16%), rgb(255 255 255 / 0%) 42%),
    repeating-linear-gradient(
      -24deg,
      rgb(255 255 255 / 0%) 0,
      rgb(255 255 255 / 0%) 22px,
      rgb(255 255 255 / 10%) 23px,
      rgb(255 255 255 / 10%) 24px
    );
  opacity: 0.34;
}

.yellow-detail div {
  position: relative;
  z-index: 1;
  display: grid;
  align-content: center;
  justify-items: center;
  min-height: 62px;
  padding: 10px 12px;
  text-align: center;
}

.yellow-detail span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 760;
  line-height: 1.35;
  color: rgb(17 24 39 / 82%);
  white-space: nowrap;
}

.yellow-detail strong {
  max-width: 100%;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 17px;
  font-weight: 850;
  line-height: 1.25;
  color: #fff;
  white-space: nowrap;
}

.yellow-detail strong:hover {
  position: relative;
  z-index: 8;
  min-width: max-content;
  max-width: none;
  padding: 2px 8px;
  margin-inline: -8px;
  overflow: visible;
  color: #111827;
  cursor: default;
  background: rgb(255 247 237 / 96%);
  border-radius: 6px;
  box-shadow: 0 8px 18px rgb(120 53 15 / 18%);
}

.yellow-detail strong.good {
  color: #047857 !important;
}

.yellow-detail strong.good::after {
  margin-left: 4px;
  font-size: 10px;
  content: '▲';
}

.yellow-detail strong.bad {
  color: #b91c1c !important;
}

.yellow-detail strong.bad::after {
  margin-left: 4px;
  font-size: 10px;
  content: '▼';
}

.yellow-detail strong.neutral {
  color: rgb(17 24 39 / 88%) !important;
}

.blue-detail {
  position: relative;
  color: #fff;
  background:
    radial-gradient(circle at 104% 0, rgb(255 255 255 / 22%), transparent 24%),
    linear-gradient(146deg, #2638f0 0%, #4b45f5 48%, #2368f4 100%);
  border-color: rgb(96 165 250 / 72%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 20%),
    0 10px 20px rgb(37 99 235 / 13%);
}

.blue-comparison-card::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background:
    radial-gradient(
      circle at 5px 5px,
      rgb(255 255 255 / 35%) 1px,
      transparent 1.5px
    ),
    linear-gradient(
      108deg,
      rgb(15 23 42 / 0%) 0 36%,
      rgb(30 64 175 / 26%) 37% 58%,
      rgb(15 23 42 / 0%) 59%
    );
  background-size:
    6px 6px,
    100% 100%;
  opacity: 0.2;
}

.blue-detail div {
  position: relative;
  z-index: 1;
  display: grid;
  align-content: center;
  justify-items: center;
  min-height: 58px;
  text-align: center;
}

.blue-detail span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 720;
  line-height: 1.25;
  color: rgb(255 255 255 / 82%);
  white-space: nowrap;
}

.blue-detail strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.15;
  color: #fde047;
  white-space: nowrap;
}

.blue-detail small {
  color: rgb(255 255 255 / 70%);
}

.blue-detail strong.good {
  color: #22c55e !important;
}

.blue-detail strong.good::after {
  margin-left: 4px;
  font-size: 9px;
  content: '▼';
}

.blue-detail strong.bad {
  color: #ff4d6d !important;
}

.blue-detail strong.bad::after {
  margin-left: 4px;
  font-size: 9px;
  content: '▲';
}

.blue-detail strong.neutral {
  color: #fde047 !important;
}

.blue-detail-six div:nth-child(-n + 4) {
  border-bottom: 1px solid rgb(255 255 255 / 18%);
}

.group-panel {
  display: grid;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 6px;
  min-height: 0;
}

.group-track-section {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
}

.track-heading {
  min-height: 20px;
}

.group-track-grid {
  display: grid;
  grid-auto-columns: minmax(150px, 1fr);
  grid-auto-flow: column;
  min-height: 0;
  padding: 1px 1px 4px;
  margin-top: 4px;
  overflow: auto hidden;
  scrollbar-gutter: stable;
  background: transparent;
}

.group-track-card {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 5px;
  align-items: center;
  min-width: 150px;
  min-height: 52px;
  padding: 6px 8px;
  background: var(--analytics-panel);
  border: 1px solid var(--analytics-border);
  border-radius: 5px;
}

.group-track-icon {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  font-size: 10px;
  font-weight: 850;
  color: #fff;
  background: var(--track-accent);
  border-radius: 999px;
}

.group-track-body {
  min-width: 0;
}

.group-track-body button,
.responsible-grid article > button {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.25;
  color: var(--analytics-heading);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.group-track-body strong {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.05;
  color: #0b63ce;
  white-space: nowrap;
}

.group-track-body p {
  display: flex;
  gap: 4px;
  align-items: center;
  margin: 4px 0 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.2;
  color: var(--analytics-subtle);
  white-space: nowrap;
}

.group-track-body b {
  min-width: 0;
  max-width: 92px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 850;
}

.responsible-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
}

.responsible-heading {
  min-height: 24px;
}

.responsible-heading-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.responsible-heading-actions span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.responsible-owner-menu {
  width: 438px;
}

.responsible-owner-trigger {
  min-width: 96px;
  max-width: 138px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  white-space: nowrap;
}

:global(.responsible-owner-menu) {
  position: relative;
  z-index: 1500;
  width: min(520px, calc(100vw - 32px));
  overflow: hidden;
  background: #fff;
  border: 1px solid #d8e1ee;
  border-radius: 6px;
  box-shadow: 0 18px 42px rgb(15 23 42 / 28%);
  opacity: 1;
}

:global(.dark .responsible-owner-menu) {
  background: #0f172a;
  border-color: #334155;
}

:global(.responsible-owner-menu .dashboard-owner-cascade) {
  display: grid;
  grid-template-columns: minmax(180px, 0.95fr) minmax(180px, 1fr);
  max-height: 320px;
  overflow: hidden;
  background: inherit;
}

:global(.responsible-owner-menu .dashboard-owner-groups) {
  max-height: 320px;
  overflow-y: auto;
  background: inherit;
  border-right: 1px solid #d8e1ee;
}

:global(.dark .responsible-owner-menu .dashboard-owner-groups) {
  border-right-color: #334155;
}

:global(.responsible-owner-menu .dashboard-owner-members) {
  max-height: 320px;
  overflow-y: auto;
  background: inherit;
}

:global(
  .responsible-owner-menu .dashboard-owner-members .ant-checkbox-wrapper
) {
  display: flex;
  min-height: 30px;
  padding: 6px 12px;
  margin-inline-start: 0;
  color: #334155;
  background: transparent;
}

:global(
  .dark .responsible-owner-menu .dashboard-owner-members .ant-checkbox-wrapper
) {
  color: #cbd5e1;
}

:global(.responsible-owner-menu .cascade-filter-header),
:global(.responsible-owner-menu .report-filter-footer) {
  background: #f8fafc;
}

:global(.dark .responsible-owner-menu .cascade-filter-header),
:global(.dark .responsible-owner-menu .report-filter-footer) {
  background: #111827;
}

.responsible-grid {
  grid-template-columns: repeat(auto-fit, minmax(184px, 1fr));
  gap: 8px;
  min-height: 0;
  max-height: 348px;
  padding-right: 4px;
  margin-top: 8px;
  overflow-y: auto;
}

.responsible-grid article {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  min-height: 344px;
  padding: 10px 12px;
  background: var(--analytics-panel);
  border: 1px solid var(--analytics-border);
  border-radius: 5px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
}

.responsible-grid article > button {
  margin: 0 0 7px;
  font-size: 12px;
  text-align: left;
}

.responsible-grid .responsible-card-name {
  width: 100%;
  min-height: 24px;
  padding-bottom: 7px;
  margin-bottom: 7px;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
  color: var(--analytics-heading);
  text-align: center;
  border-bottom: 1px solid var(--analytics-border);
}

.responsible-grid p {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-height: 19px;
  padding: 2px 4px;
  margin: 1px 0;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.25;
  color: var(--analytics-subtle);
  white-space: nowrap;
  border-radius: 3px;
}

.responsible-grid p:nth-child(2n) {
  background: var(--analytics-panel-muted);
}

.responsible-grid b {
  flex: 0 0 auto;
  min-width: 0;
  max-width: 128px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 850;
  color: #0b63ce;
  text-align: right;
}

.group-track-body b:hover,
.responsible-grid b:hover {
  overflow: visible;
}

.good {
  color: #16a34a !important;
}

.warning {
  color: #f59e0b !important;
}

.bad {
  color: #ef4444 !important;
}

.neutral {
  color: var(--analytics-muted) !important;
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
  color: var(--analytics-subtle);
}

.report-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.report-filter-trigger {
  min-width: 118px;
  text-align: left;
}

.report-filter-trigger-wide {
  min-width: 150px;
}

.report-filter-menu {
  position: relative;
  z-index: 1100;
  width: 238px;
  padding-top: 8px;
  overflow: hidden;
  background: var(--analytics-panel, #fff);
  border: 1px solid var(--analytics-border);
  border-radius: 4px;
  box-shadow: 0 12px 30px rgb(15 23 42 / 24%);
  opacity: 1;
}

:global(.dark) .report-filter-menu {
  background: #0f172a;
}

.report-filter-menu-compact {
  width: 180px;
}

.report-filter-menu-wide {
  width: 280px;
}

.dashboard-country-menu {
  width: 228px;
}

.dashboard-country-scroll {
  max-height: 218px;
}

.report-filter-menu > .ant-checkbox-wrapper {
  display: flex;
  padding: 5px 12px;
  margin-inline-start: 0;
  color: var(--analytics-text);
}

.report-filter-scroll {
  display: grid;
  max-height: 230px;
  overflow-y: auto;
}

.report-filter-scroll .ant-checkbox-wrapper {
  display: flex;
  min-height: 28px;
  padding: 5px 12px;
  margin-inline-start: 0;
  color: var(--analytics-text);
}

.report-filter-scroll .ant-checkbox-wrapper:hover {
  background: var(--analytics-panel-muted);
}

.report-group-option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  min-height: 30px;
  padding-right: 6px;
}

.report-group-option:hover {
  background: var(--analytics-panel-muted);
}

.report-group-option .ant-checkbox-wrapper {
  min-width: 0;
}

.report-group-name {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.report-group-count {
  margin-left: 6px;
  font-size: 11px;
  color: var(--analytics-muted);
}

.report-filter-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 10px;
  background: var(--analytics-panel-muted);
  border-top: 1px solid var(--analytics-border);
}

.report-column-config {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  min-height: 580px;
  overflow: hidden;
  border: 1px solid var(--analytics-border);
}

.report-column-pool {
  min-width: 0;
  padding: 14px;
  background: var(--analytics-panel);
  border-right: 1px solid var(--analytics-border);
}

.report-column-config-bar {
  margin-bottom: 12px;
}

.report-column-groups {
  display: grid;
  gap: 16px;
  max-height: 520px;
  padding-right: 6px;
  overflow-y: auto;
}

.report-column-group header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.report-column-group header::before {
  width: 4px;
  height: 4px;
  content: '';
  background: var(--analytics-muted);
  border-radius: 50%;
}

.report-column-group header span {
  font-weight: 700;
  color: var(--analytics-heading);
}

.report-column-group header button,
.report-column-selected button {
  padding: 0;
  color: #2563eb;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.report-column-check-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 18px;
}

.report-column-check-grid .ant-checkbox-wrapper {
  margin-inline-start: 0;
  color: var(--analytics-text);
}

.report-column-selected {
  min-width: 0;
  padding: 14px 12px;
  background: var(--analytics-panel-muted);
}

.report-column-selected header {
  display: grid;
  gap: 4px;
  margin-bottom: 10px;
}

.report-column-selected header strong {
  color: var(--analytics-heading);
}

.report-column-selected header span {
  font-size: 11px;
  color: var(--analytics-subtle);
}

.report-column-selected-list {
  display: grid;
  gap: 2px;
  max-height: 522px;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  list-style: none;
}

.report-column-selected-list li {
  display: grid;
  grid-template-columns: 18px 28px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  min-height: 30px;
  padding: 4px 6px;
  color: var(--analytics-text);
  cursor: grab;
  background: var(--analytics-panel);
  border: 1px solid transparent;
}

.report-column-selected-list li:hover {
  border-color: var(--analytics-border-strong);
}

.report-column-drag,
.report-column-order {
  font-size: 11px;
  color: var(--analytics-muted);
}

.report-column-selected-list b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-column-selected-list li > div {
  display: flex;
  gap: 6px;
}

.report-column-selected button:disabled {
  color: var(--analytics-muted);
  cursor: not-allowed;
}

.report-column-selected button.active {
  font-weight: 700;
  color: #2563eb;
}

.report-column-config-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 12px;
}

.report-table :deep(.ant-table) {
  color: var(--analytics-text);
  background: var(--analytics-panel);
  border-color: var(--analytics-border-strong);
}

.report-table :deep(.ant-table-container),
.report-table :deep(.ant-table-content),
.report-table :deep(.ant-table-body),
.report-table :deep(.ant-table-placeholder),
.report-table :deep(.ant-table-cell-fix-left),
.report-table :deep(.ant-table-cell-fix-right) {
  background: var(--analytics-panel);
}

.report-table :deep(.ant-table-thead > tr > th),
.report-table :deep(.ant-table-tbody > tr > td),
.report-table :deep(.ant-table-summary > tr > td) {
  border-color: var(--analytics-border-strong) !important;
}

.report-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 700;
  color: var(--analytics-heading);
  background: var(--analytics-panel-muted);
}

.report-resizable-header {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 100%;
  padding-right: 8px;
}

.report-resizable-header span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-column-resize-handle {
  position: absolute;
  top: -10px;
  right: -12px;
  bottom: -10px;
  z-index: 30;
  width: 18px;
  pointer-events: auto;
  cursor: col-resize;
  background: transparent;
  border: 0;
}

.report-column-resize-handle::after {
  position: absolute;
  top: 8px;
  right: 8px;
  bottom: 8px;
  width: 2px;
  content: '';
  background: transparent;
}

.report-column-resize-handle:hover::after {
  background: #2563eb;
}

:global(.report-column-resizing) {
  cursor: col-resize !important;
  user-select: none;
}

.report-table :deep(.ant-table-tbody > tr > td) {
  font-size: 12px;
  color: var(--analytics-text);
  background: var(--analytics-panel);
}

.report-table :deep(.ant-table-tbody > tr:hover > td) {
  background: var(--analytics-hover);
}

.report-table :deep(.ant-table-tbody > tr:hover > td.ant-table-cell-fix-left),
.report-table :deep(.ant-table-tbody > tr:hover > td.ant-table-cell-fix-right) {
  background: var(--analytics-hover);
}

.report-table :deep(.ant-table-footer) {
  padding: 0;
  overflow: hidden;
  background: var(--analytics-summary-bg);
  border-top: 2px solid var(--analytics-border-strong);
}

.report-table :deep(.ant-pagination),
.report-table :deep(.ant-table-title) {
  color: var(--analytics-text);
  background: var(--analytics-panel);
}

.report-image {
  display: block;
  width: 42px;
  height: 42px;
  object-fit: cover;
  border: 1px solid var(--analytics-border);
  border-radius: 4px;
}

.report-number {
  display: block;
  font-variant-numeric: tabular-nums;
  text-align: right;
  direction: ltr;
  unicode-bidi: isolate;
}

.report-sparkline {
  display: block;
  width: 118px;
  height: 38px;
  background: var(--analytics-sparkline-bg);
  border: 1px solid var(--analytics-border);
  border-radius: 4px;
}

.report-summary-scroll {
  width: 100%;
  overflow: hidden;
}

.report-summary-grid {
  display: flex;
  min-height: 38px;
  font-size: 12px;
  font-weight: 800;
  color: var(--analytics-strong);
  background: var(--analytics-summary-bg);
}

.report-summary-grid > div {
  flex: 0 0 auto;
  min-width: 0;
  padding: 9px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid var(--analytics-border-strong);
}

.report-summary-grid > div:first-child {
  border-left: 0;
}

.report-summary-grid .report-number {
  text-align: right;
}

.report-summary-label {
  color: var(--analytics-strong);
}

.screen-note {
  padding: 8px 10px;
  margin-top: 8px;
  color: var(--analytics-subtle);
  background: var(--analytics-panel);
  border: 1px dashed var(--analytics-note-border);
}

@media (width <= 1420px) {
  .top-board {
    grid-template-columns: 210px minmax(350px, 0.7fr) minmax(0, 0.94fr) 470px;
  }

  .yellow-kpi-glass {
    width: min(88%, 320px);
  }

  .yellow-grid .yellow-kpi-glass strong {
    font-size: 34px;
  }

  .responsible-grid {
    grid-template-columns: repeat(3, minmax(168px, 1fr));
  }
}

@media (width <= 1150px) {
  .top-board {
    grid-template-columns: 1fr;
  }

  .gauge-column,
  .sales-column,
  .tracking-column {
    display: grid;
    grid-row: auto;
    grid-column: auto;
    gap: 8px;
  }

  .gauge-column {
    grid-template-rows: auto;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sales-column > .yellow-grid,
  .tracking-column > .blue-grid,
  .sales-column > .group-panel:nth-of-type(2),
  .tracking-column > .responsible-panel {
    grid-row: auto;
    grid-column: auto;
  }

  .screen-toolbar {
    display: flex;
    flex-wrap: wrap;
  }

  .group-track-grid {
    overflow-x: auto;
  }

  .responsible-grid {
    grid-template-columns: repeat(2, minmax(176px, 1fr));
  }
}

@media (width <= 640px) {
  .yellow-grid,
  .blue-grid,
  .gauge-column,
  .responsible-grid,
  .group-track-grid {
    grid-template-columns: 1fr;
  }

  .yellow-kpi-glass {
    width: min(94%, 360px);
  }

  .yellow-grid .yellow-kpi-glass strong {
    font-size: 32px;
  }
}
</style>
