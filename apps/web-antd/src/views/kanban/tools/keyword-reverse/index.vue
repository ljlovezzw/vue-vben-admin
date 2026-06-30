<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  KeywordReverseColumn,
  KeywordReverseResult,
} from '#/api/kanban/types';

import { computed, reactive, ref } from 'vue';
import VChart from 'vue-echarts';

import {
  Button,
  Card,
  Checkbox,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
  Space,
  Spin,
  Table,
} from 'ant-design-vue';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import { fetchKeywordReverse } from '#/api/kanban';

type SortDirection = 'ASC' | 'DESC';
type TrendMetric = 'rankT30' | 'searches';
type TrendPoint = {
  month: string;
  rankT30: null | number;
  searches: null | number;
};
type WordItem = {
  count: null | number | string;
  raw: unknown;
  text: string;
};

use([
  CanvasRenderer,
  GridComponent,
  LegendComponent,
  LineChart,
  TooltipComponent,
]);

const TREND_COLUMN_KEY = '__keywordTrend';
const TREND_FIELD_KEYS = new Set(['rankTrends', 'searchTrends', 'trends']);
const HIDDEN_TABLE_FIELD_KEYS = new Set(['keywordZh', 'marketPlaceId']);
const MARKETPLACE_OPTIONS = [
  { label: '美国', value: 1 },
  { label: '英国', value: 5 },
  { label: '德国', value: 6 },
  { label: '法国', value: 7 },
  { label: '意大利', value: 8 },
  { label: '西班牙', value: 9 },
];
const AMAZON_MARKETPLACE_DOMAINS: Record<number, string> = {
  1: 'www.amazon.com',
  5: 'www.amazon.co.uk',
  6: 'www.amazon.de',
  7: 'www.amazon.fr',
  8: 'www.amazon.it',
  9: 'www.amazon.es',
};

const fieldDescriptions: Record<string, string> = {
  abaEndTime: 'ABA 周期结束时间',
  abaStartTime: 'ABA 周期开始时间',
  abaWeek: 'ABA 周期描述',
  abaWeekRank: 'ABA 关键词周排名',
  adExposureT7: '当前 ASIN 近 7 天广告曝光',
  adPageNum: '广告排名所在页码',
  adPageSize: '广告排名采集页大小',
  adPosition: '广告排名所在位置',
  adRank: '广告排名',
  adTrafficRatio: '当前 ASIN 该关键词广告曝光占比',
  adUpdateTime: '广告排名采集更新时间',
  adsT30: '近 30 天投放广告的商品数',
  avgDaySearch: '日均搜索量',
  chinaSellerNumber: '中国卖家数量',
  chinaSellerProportion: '中国卖家占比',
  clickSalesRate: '点击成交转化率',
  clickT30: '近 30 天总点击量',
  crawlNum: '爬虫采集到的样本商品数',
  impression: '当前 ASIN 近 7 天总曝光',
  impressionsT30: '近 30 天市场总曝光量',
  keyword: '关键词',
  keywordZh: '关键词中文',
  marketAdExposure: '该关键词市场近 7 天广告总曝光',
  marketAdTrafficRatio: '市场广告曝光占比',
  marketNaExposure: '该关键词市场近 7 天自然总曝光',
  marketNaTrafficRatio: '市场自然曝光占比',
  marketTrafficRatio: '在市场关键词流量池中，该关键词贡献的占比',
  naExposureT7: '当前 ASIN 近 7 天自然曝光',
  naPageNum: '自然排名所在页码',
  naPageSize: '自然排名采集页大小',
  naPosition: '自然排名所在位置',
  naRank: '自然排名',
  naTrafficRatio: '当前 ASIN 该关键词自然曝光占比',
  naUpdateTime: '自然排名采集更新时间',
  parentAdExposureT7: '父体近 7 天广告曝光',
  parentAdTrafficRatio: '父体广告曝光占比',
  parentImpression: '父体近 7 天总曝光',
  parentNaExposureT7: '父体近 7 天自然曝光',
  parentNaTrafficRatio: '父体自然曝光占比',
  parentTrafficRatio: '当前父体的流量中，这个关键词贡献的占比',
  ppcBid: '建议 PPC 竞价',
  ppcBidMax: '建议最高竞价',
  ppcBidMin: '建议最低竞价',
  products: '竞争商品数',
  rankTrends: 'ABA 排名趋势，[年月编码, 排名, ...]',
  recent12mNewProducts: '近 12 个月新品数量',
  recent1mNewProducts: '近 1 个月新品数量',
  recent2mNewProducts: '近 2 个月新品数量',
  recent3mNewProducts: '近 3 个月新品数量',
  recent6mNewProducts: '近 6 个月新品数量',
  salableAdTrafficRatio: '当前可售 ASIN 广告曝光占比',
  salableAsinAdExposureT7: '当前可售 ASIN 近 7 天广告曝光量',
  salableAsinNaExposureT7: '当前可售 ASIN 近 7 天自然曝光量',
  salableImpression: '当前可售 ASIN 近 7 天曝光量',
  salableNaTrafficRatio: '当前可售 ASIN 自然曝光占比',
  salableTrafficRatio: '当前可售 ASIN 的流量中，这个关键词贡献的占比',
  salesRateT30: '近 30 天搜索转化率',
  salesT30: '近 30 天该关键词带来的市场总销量',
  searchConversionRateT30: '搜索转化率',
  searchHeat: '搜索热度',
  searchT30: '近 30 天搜索量',
  searchTrends: '搜索量趋势，[年月编码, 搜索量, ...]',
  searchUrl: '亚马逊前台搜索链接',
  supplyDemandRatio: '供需比',
  titleDensity: '标题密度',
  top10Asin: '该关键词下 Top 10 点击/销量/排名 ASIN',
  top3ClickRate: 'Top 3 ASIN 点击占比',
  top3ConversionRate: 'Top 3 ASIN 转化率',
  trafficRatio: '当前 ASIN 的流量中，这个关键词贡献的占比',
  trends: '趋势明细，包含月份、搜索量、ABA 排名和环比',
};

const loading = ref(false);
const drawerOpen = ref(false);
const highFrequencyCollapsed = ref(false);
const selectedRow = ref<null | Record<string, any>>(null);
const result = ref<KeywordReverseResult | null>(null);
const asinInput = ref('B0GWQ7S8SR');
const keywordFilter = ref('');
const showTopProducts = ref(true);

const query = reactive({
  marketPlaceId: 1,
  monthStr: 'Last 30 Days',
  pageNo: 1,
  pageSize: 20,
  sortDirection: 'DESC' as SortDirection,
  sortField: 'trafficRatio',
});

const monthOptions = [
  { label: '近 7 天', value: 'Last 7 Days' },
  { label: '近 30 天', value: 'Last 30 Days' },
  { label: '近 90 天', value: 'Last 90 Days' },
];

const sortFieldOptions = [
  { label: '流量占比', value: 'trafficRatio' },
  { label: '近30天搜索量', value: 'searchT30' },
  { label: '日均搜索量', value: 'avgDaySearch' },
  { label: '自然排名', value: 'naRank' },
  { label: '广告排名', value: 'adRank' },
  { label: 'ABA周排名', value: 'abaWeekRank' },
  { label: '标题密度', value: 'titleDensity' },
  { label: '供需比', value: 'supplyDemandRatio' },
];

const totalText = computed(() => result.value?.page.total ?? 0);
const highFrequencyWords = computed(() =>
  normalizeHighFrequencyWords(resolveHighFrequencyWords(result.value)),
);
const rows = computed(() => result.value?.rows ?? []);
const filteredRows = computed(() => {
  const keyword = keywordFilter.value.trim().toLowerCase();
  if (!keyword) return rows.value;
  return rows.value.filter((row) =>
    String(keywordText(row)).toLowerCase().includes(keyword),
  );
});

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: query.pageNo,
  pageSize: query.pageSize,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 个关键词`,
  total: result.value?.page.total ?? 0,
}));

const tableColumns = computed<TableColumnsType<Record<string, any>>>(() => {
  const columns = (result.value?.columns ?? [])
    .filter((column) => !isHiddenTableColumn(column.key))
    .filter((column) => !isTrendColumn(column.key))
    .filter((column) => showTopProducts.value || !isProductColumn(column.key))
    .map((column) => ({
      customHeaderCell: () => ({
        title: fieldDescriptions[column.key] || column.label,
      }),
      dataIndex: column.key,
      ellipsis: column.kind === 'text' && !isKeywordColumn(column.key),
      fixed: column.fixed === 'left' ? ('left' as const) : undefined,
      key: column.key,
      title: column.label,
      width: columnWidth(column),
    }));
  const hasTrendColumn = rows.value.some((row) => hasTrendData(row));
  if (hasTrendColumn) {
    const insertAt = Math.min(
      Math.max(
        columns.findIndex((column) => isProductColumn(column.key)) + 1,
        1,
      ),
      columns.length,
    );
    columns.splice(insertAt, 0, {
      customHeaderCell: () => ({
        title:
          '由 rankTrends、searchTrends 或 trends 绘制搜索量和 ABA 排名趋势',
      }),
      dataIndex: TREND_COLUMN_KEY,
      ellipsis: false,
      fixed: undefined,
      key: TREND_COLUMN_KEY,
      title: '趋势',
      width: 300,
    });
  }

  return [
    {
      dataIndex: '__index',
      fixed: 'left',
      key: '__index',
      title: '序号',
      width: 72,
    },
    ...columns,
  ];
});
const tableScrollX = computed(() =>
  Math.max(tableColumns.value.length * 130 + 120, 980),
);
const tableScrollY = 720;

function parseAsins() {
  return [
    ...new Set(
      asinInput.value
        .split(/[\s,;，；]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function normalizeHighFrequencyWords(value: unknown): WordItem[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, any>;
          return {
            count: record.count ?? record.num ?? record.value ?? null,
            raw: item,
            text: String(
              record.word ?? record.keyword ?? record.name ?? record.text ?? '',
            ).trim(),
          };
        }
        return { count: null, raw: item, text: String(item || '').trim() };
      })
      .filter((item) => item.text);
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([text, count]) => ({
        count: count as WordItem['count'],
        raw: { [text]: count },
        text: text.trim(),
      }))
      .filter((item) => item.text);
  }
  return [];
}

function resolveHighFrequencyWords(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, any>;
  return (
    record.highFrequencyWords ??
    record.high_frequency_words ??
    record.data?.highFrequencyWords ??
    record.data?.data?.highFrequencyWords ??
    record.rawSummary?.highFrequencyWords ??
    record.rawSummary?.high_frequency_words ??
    null
  );
}

function columnWidth(column: KeywordReverseColumn) {
  if (isProductColumn(column.key)) return 260;
  if (isTrendColumn(column.key)) return 300;
  if (column.key === 'searchUrl') return 220;
  if (column.fixed === 'left') return 220;
  if (column.kind === 'percent') return 118;
  if (column.kind === 'rank') return 104;
  if (column.kind === 'number') return 120;
  return 150;
}

function isTrendColumn(key: unknown) {
  return TREND_FIELD_KEYS.has(String(key || ''));
}

function isHiddenTableColumn(key: unknown) {
  return HIDDEN_TABLE_FIELD_KEYS.has(String(key || ''));
}

function isKeywordColumn(key: unknown) {
  return ['keyword', 'keywordText', 'searchKeyword', 'word'].includes(
    String(key || ''),
  );
}

function isProductColumn(key: unknown) {
  return [
    'first10Product',
    'first10Products',
    'imageList',
    'productList',
    'products',
    'top10Asin',
    'top10Product',
    'top10Products',
    'topProducts',
  ].includes(String(key || ''));
}

function keywordText(row: Record<string, any>) {
  return (
    row.keyword ??
    row.keywordText ??
    row.searchKeyword ??
    row.word ??
    row.keywords ??
    ''
  );
}

function cnKeywordText(row: Record<string, any>) {
  return (
    row.keywordZh ??
    row.cnKeyword ??
    row.keywordCn ??
    row.chinese ??
    row.translation ??
    ''
  );
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  return Number(value.replaceAll(',', '').replace('%', '').trim());
}

function formatNumber(value: number, digits = 0, minimumDigits = digits) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: minimumDigits,
  }).format(value);
}

function formatFlexibleNumber(value: number) {
  return Number.isInteger(value)
    ? formatNumber(value, 0)
    : formatNumber(value, 2, 0);
}

function formatMonthCode(value: unknown) {
  const text = String(value ?? '').trim();
  if (/^\d{4}$/.test(text)) {
    const year = 2000 + Number(text.slice(0, 2));
    return `${year}-${text.slice(2)}`;
  }
  if (/^\d{6}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4)}`;
  }
  return text;
}

function formatDateTime(value: unknown) {
  const numeric = numberValue(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return String(value);
  const date = new Date(numeric);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (item: number) => String(item).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isTimeColumn(key: unknown) {
  return /(?:updateTime|startTime|endTime)$/i.test(String(key || ''));
}

function formatCell(value: unknown, column?: KeywordReverseColumn) {
  if (value === null || value === undefined || value === '') return '-';
  if (!column) return String(value);
  if (isTimeColumn(column.key)) return formatDateTime(value);
  if (column.kind === 'percent') {
    if (typeof value === 'string' && value.includes('%')) return value;
    const numeric = numberValue(value);
    if (!Number.isFinite(numeric)) return String(value);
    const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
    return `${formatNumber(percent, 2)}%`;
  }
  if (column.kind === 'rank') {
    const numeric = numberValue(value);
    return Number.isFinite(numeric) ? formatNumber(numeric, 0) : String(value);
  }
  if (column.kind === 'number') {
    const numeric = numberValue(value);
    return Number.isFinite(numeric)
      ? formatFlexibleNumber(numeric)
      : String(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function cellClass(column?: KeywordReverseColumn) {
  if (!column) return '';
  if (
    column.kind === 'number' ||
    column.kind === 'percent' ||
    column.kind === 'rank'
  ) {
    return 'numeric-cell';
  }
  return '';
}

function rowKey(record: Record<string, any>, index?: number) {
  const keyword = keywordText(record);
  return `${keyword || 'row'}-${index ?? 0}`;
}

function parseJsonMaybe(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeProductItems(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseJsonMaybe(value);
    if (Array.isArray(parsed)) return parsed;
    return value
      .split(/[\s,;，；]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>);
  }
  return [];
}

function imageFromProduct(item: unknown) {
  if (typeof item === 'string') {
    return /^https?:\/\//.test(item) || item.startsWith('//') ? item : '';
  }
  if (!item || typeof item !== 'object') return '';
  const product = item as Record<string, any>;
  return (
    product.image ??
    product.img ??
    product.imageUrl ??
    product.image_url ??
    product.small_image_url ??
    product.mainImage ??
    product.main_image ??
    ''
  );
}

function labelFromProduct(item: unknown) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  const product = item as Record<string, any>;
  return String(
    product.asin ??
      product.parentAsin ??
      product.childAsin ??
      product.title ??
      product.name ??
      '',
  );
}

function asinFromProduct(item: unknown) {
  const value =
    typeof item === 'string'
      ? item
      : (item && typeof item === 'object'
        ? ((item as Record<string, any>).asin ??
          (item as Record<string, any>).parentAsin ??
          (item as Record<string, any>).childAsin ??
          (item as Record<string, any>).parent_asin ??
          (item as Record<string, any>).child_asin ??
          '')
        : '');
  const match = String(value || '')
    .toUpperCase()
    .match(/\bB[A-Z0-9]{9}\b/);
  return match?.[0] ?? '';
}

function amazonDomain(marketPlaceId: unknown) {
  const numeric = Number(marketPlaceId || query.marketPlaceId || 1);
  return AMAZON_MARKETPLACE_DOMAINS[numeric] ?? 'www.amazon.com';
}

function amazonProductUrl(asin: string, marketPlaceId: unknown) {
  if (!asin) return '';
  return `https://${amazonDomain(marketPlaceId)}/dp/${asin}`;
}

function productItems(value: unknown, record?: Record<string, any>) {
  const marketPlaceId = record?.marketPlaceId ?? query.marketPlaceId;
  return normalizeProductItems(value)
    .map((item, index) => {
      const asin = asinFromProduct(item);
      const image = imageFromProduct(item);
      const label = labelFromProduct(item);
      return {
        asin,
        domain: amazonDomain(marketPlaceId),
        image,
        key: `${asin || image || label || 'product'}-${index}`,
        label: asin || label,
        url: amazonProductUrl(asin, marketPlaceId),
      };
    })
    .filter((item) => item.image || item.label)
    .slice(0, 10);
}

function parseTrendValue(value: unknown) {
  if (!value) return [];
  if (typeof value === 'string') {
    const parsed = parseJsonMaybe(value);
    return Array.isArray(parsed) ? parsed : [];
  }
  return Array.isArray(value) ? value : [];
}

function readNullableNumber(value: unknown) {
  const numeric = numberValue(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mergeTrendPoint(
  map: Map<string, TrendPoint>,
  monthValue: unknown,
  metric: TrendMetric,
  metricValue: unknown,
) {
  const month = formatMonthCode(monthValue);
  if (!month) return;
  const nextValue = readNullableNumber(metricValue);
  if (nextValue === null) return;
  const point = map.get(month) ?? {
    month,
    rankT30: null,
    searches: null,
  };
  point[metric] = metric === 'rankT30' && nextValue <= 0 ? null : nextValue;
  map.set(month, point);
}

function applyPairTrend(
  map: Map<string, TrendPoint>,
  value: unknown,
  metric: TrendMetric,
) {
  const list = parseTrendValue(value);
  for (let index = 0; index < list.length - 1; index += 2) {
    mergeTrendPoint(map, list[index], metric, list[index + 1]);
  }
}

function rowTrendPoints(row: Record<string, any>): TrendPoint[] {
  const pointMap = new Map<string, TrendPoint>();
  for (const item of parseTrendValue(row.trends)) {
    if (!item || typeof item !== 'object') continue;
    const trend = item as Record<string, any>;
    const month = trend.month ?? trend.monthStr ?? trend.date;
    mergeTrendPoint(pointMap, month, 'searches', trend.searches);
    mergeTrendPoint(pointMap, month, 'rankT30', trend.rankT30);
  }
  applyPairTrend(pointMap, row.searchTrends, 'searches');
  applyPairTrend(pointMap, row.rankTrends, 'rankT30');
  return [...pointMap.values()].toSorted((left, right) =>
    left.month.localeCompare(right.month),
  );
}

function hasTrendData(row: Record<string, any>) {
  return rowTrendPoints(row).length > 0;
}

function trendChartOption(row: Record<string, any>) {
  const points = rowTrendPoints(row);
  const hasSearches = points.some((point) => point.searches !== null);
  const hasRank = points.some((point) => point.rankT30 !== null);
  return {
    animation: false,
    color: ['#2563eb', '#ea580c'],
    grid: {
      bottom: 18,
      left: 8,
      right: 8,
      top: 18,
    },
    legend: {
      bottom: 0,
      data: [
        ...(hasSearches ? ['搜索量'] : []),
        ...(hasRank ? ['ABA排名'] : []),
      ],
      itemHeight: 6,
      itemWidth: 10,
      textStyle: { color: '#64748b', fontSize: 10 },
    },
    series: [
      ...(hasSearches
        ? [
            {
              data: points.map((point) => point.searches),
              name: '搜索量',
              showSymbol: false,
              smooth: true,
              type: 'line',
              yAxisIndex: 0,
            },
          ]
        : []),
      ...(hasRank
        ? [
            {
              data: points.map((point) => point.rankT30),
              name: 'ABA排名',
              showSymbol: false,
              smooth: true,
              type: 'line',
              yAxisIndex: 1,
            },
          ]
        : []),
    ],
    tooltip: {
      confine: true,
      trigger: 'axis',
      valueFormatter: (value: unknown) => {
        const numeric = readNullableNumber(value);
        return numeric === null ? '-' : formatNumber(numeric, 0);
      },
    },
    xAxis: {
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisTick: { show: false },
      data: points.map((point) => point.month),
      type: 'category',
    },
    yAxis: [
      {
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: '#eef2f7' } },
        type: 'value',
      },
      {
        axisLabel: { show: false },
        inverse: true,
        splitLine: { show: false },
        type: 'value',
      },
    ],
  };
}

async function runQuery(resetPage = true) {
  const asins = parseAsins();
  if (asins.length === 0) {
    message.warning('请输入至少一个 ASIN');
    return;
  }
  if (asins.length > 10) {
    message.warning('单次最多查询 10 个 ASIN');
    return;
  }
  if (resetPage) {
    query.pageNo = 1;
  }

  loading.value = true;
  try {
    result.value = await fetchKeywordReverse({
      asins,
      expendMethod: 'current',
      marketPlaceId: query.marketPlaceId,
      monthStr: query.monthStr,
      pageNo: query.pageNo,
      pageSize: query.pageSize,
      searchType: 'keywordReverse',
      sortDirection: query.sortDirection,
      sortField: query.sortField,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    message.error(`关键词反查失败：${detail}`);
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  asinInput.value = '';
  query.marketPlaceId = 1;
  query.monthStr = 'Last 30 Days';
  query.pageNo = 1;
  query.pageSize = 20;
  query.sortDirection = 'DESC';
  query.sortField = 'trafficRatio';
  result.value = null;
}

function handleTableChange(pagination: TablePaginationConfig) {
  query.pageNo = Number(pagination.current || 1);
  query.pageSize = Number(pagination.pageSize || 20);
  runQuery(false);
}

function openRaw(record: Record<string, any>) {
  selectedRow.value = record;
  drawerOpen.value = true;
}

async function copyText(text: string, successText: string) {
  if (!text) {
    message.warning('当前没有可复制内容');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  message.success(successText);
}

function copyHighFrequencyWords() {
  copyText(
    highFrequencyWords.value.map((word) => word.text).join('\n'),
    '高频词已复制',
  );
}

function copyCurrentKeywords() {
  copyText(
    filteredRows.value
      .map((row) => String(keywordText(row) || ''))
      .filter(Boolean)
      .join('\n'),
    '当前页关键词已复制',
  );
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const columns = (result.value?.columns ?? []).filter(
    (column) =>
      !isHiddenTableColumn(column.key) &&
      !isTrendColumn(column.key) &&
      (showTopProducts.value || !isProductColumn(column.key)),
  );
  if (columns.length === 0 || filteredRows.value.length === 0) {
    message.warning('当前没有可导出的结果');
    return;
  }
  const lines = [
    columns.map((column) => escapeCsv(column.label)).join(','),
    ...filteredRows.value.map((row) =>
      columns.map((column) => escapeCsv(row[column.key])).join(','),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `keyword-reverse-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="keyword-reverse-page">
    <section class="page-head">
      <div>
        <h1>亚马逊关键词反查</h1>
        <p>输入竞品 ASIN，按流量占比、搜索量和排名维度反查关键词。</p>
      </div>
      <Space>
        <Button @click="resetQuery">重置</Button>
        <Button :disabled="rows.length === 0" @click="exportCsv">
          导出当前页
        </Button>
        <Button :loading="loading" type="primary" @click="runQuery(true)">
          查询
        </Button>
      </Space>
    </section>

    <Card class="query-card" :body-style="{ padding: '16px' }">
      <Form layout="vertical">
        <div class="query-grid">
          <Form.Item class="asin-field" label="ASIN">
            <Input.TextArea
              v-model:value="asinInput"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              placeholder="支持输入多个 ASIN，用换行、空格或逗号分隔"
            />
          </Form.Item>
          <Form.Item label="市场">
            <Select
              v-model:value="query.marketPlaceId"
              :options="MARKETPLACE_OPTIONS"
              class="full-control"
            />
          </Form.Item>
          <Form.Item label="时间范围">
            <Select v-model:value="query.monthStr" :options="monthOptions" />
          </Form.Item>
          <Form.Item label="排序字段">
            <Select
              v-model:value="query.sortField"
              :options="sortFieldOptions"
            />
          </Form.Item>
          <Form.Item label="排序方向">
            <Radio.Group
              v-model:value="query.sortDirection"
              button-style="solid"
              class="direction-group"
            >
              <Radio.Button value="DESC">降序</Radio.Button>
              <Radio.Button value="ASC">升序</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="每页条数">
            <InputNumber
              v-model:value="query.pageSize"
              :max="100"
              :min="1"
              :precision="0"
              class="full-control"
            />
          </Form.Item>
        </div>
      </Form>
    </Card>

    <div class="metric-grid">
      <div class="metric-item">
        <span class="metric-label">查询 ASIN</span>
        <strong>{{ parseAsins().length }}</strong>
      </div>
      <div class="metric-item">
        <span class="metric-label">命中关键词</span>
        <strong>{{ totalText }}</strong>
      </div>
      <div class="metric-item">
        <span class="metric-label">高频词</span>
        <strong>{{ highFrequencyWords.length }}</strong>
      </div>
      <div class="metric-item">
        <span class="metric-label">当前页</span>
        <strong>
          {{ result?.page.pageNo ?? query.pageNo }}/{{
            result?.page.pages ?? 0
          }}
        </strong>
      </div>
    </div>

    <Spin :spinning="loading">
      <section class="result-section frequency-section">
        <div class="panel-title compact-title">
          <div>
            <h2>高频词</h2>
          </div>
          <Space>
            <Button size="small" @click="copyHighFrequencyWords">
              复制到剪切板
            </Button>
            <Button
              size="small"
              type="link"
              @click="highFrequencyCollapsed = !highFrequencyCollapsed"
            >
              {{ highFrequencyCollapsed ? '展开高频词' : '收起高频词' }}
            </Button>
          </Space>
        </div>
        <div
          v-if="highFrequencyWords.length > 0 && !highFrequencyCollapsed"
          class="word-grid"
        >
          <button
            v-for="word in highFrequencyWords"
            :key="word.text"
            class="word-item"
            type="button"
            @click="keywordFilter = word.text"
          >
            <span>{{ word.text }}</span>
            <span v-if="word.count !== null && word.count !== undefined">
              ({{ word.count }})
            </span>
          </button>
        </div>
        <Empty
          v-else-if="!highFrequencyCollapsed"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
          description="暂无高频词"
        />
      </section>

      <section class="result-section table-section">
        <div class="result-toolbar">
          <Space wrap>
            <Button @click="copyCurrentKeywords">复制</Button>
            <Button @click="exportCsv">导出</Button>
            <span class="result-count">
              关键词反查结果数: {{ result?.page.total ?? 0 }}
            </span>
          </Space>
          <Space wrap>
            <Checkbox v-model:checked="showTopProducts">展示前10产品</Checkbox>
            <Select
              v-model:value="query.sortField"
              :options="sortFieldOptions"
              class="sort-select"
              size="small"
            />
            <Select
              v-model:value="query.sortDirection"
              class="direction-select"
              size="small"
            >
              <Select.Option value="DESC">降序</Select.Option>
              <Select.Option value="ASC">升序</Select.Option>
            </Select>
            <Button :loading="loading" size="small" @click="runQuery(true)">
              查询
            </Button>
          </Space>
        </div>

        <div class="keyword-filter-bar">
          <Select class="match-select" size="small" value="contains">
            <Select.Option value="contains">包含</Select.Option>
          </Select>
          <Input
            v-model:value="keywordFilter"
            allow-clear
            class="keyword-filter-input"
            placeholder="关键词，多个以英文逗号区分"
            size="small"
          />
          <Button size="small" type="primary">搜索</Button>
        </div>

        <Table
          :columns="[
            ...tableColumns,
            {
              dataIndex: 'action',
              fixed: 'right',
              key: 'action',
              title: '操作',
              width: 96,
            },
          ]"
          :data-source="filteredRows"
          :pagination="tablePagination"
          :row-key="rowKey"
          :scroll="{ x: tableScrollX, y: tableScrollY }"
          size="small"
          sticky
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, index, record, text }">
            <template v-if="column.dataIndex === '__index'">
              {{ (query.pageNo - 1) * query.pageSize + index + 1 }}
            </template>
            <template v-else-if="column.dataIndex === 'action'">
              <Button size="small" type="link" @click="openRaw(record)">
                原始字段
              </Button>
            </template>
            <template v-else-if="column.dataIndex === TREND_COLUMN_KEY">
              <div v-if="hasTrendData(record)" class="trend-cell">
                <VChart
                  :option="trendChartOption(record)"
                  autoresize
                  class="trend-chart"
                />
              </div>
              <span v-else>-</span>
            </template>
            <template v-else-if="isKeywordColumn(column.dataIndex)">
              <div class="keyword-cell">
                <div class="keyword-main">{{ keywordText(record) || '-' }}</div>
                <div v-if="cnKeywordText(record)" class="keyword-cn">
                  {{ cnKeywordText(record) }}
                </div>
                <div class="row-actions">
                  <Button
                    size="small"
                    @click="
                      copyText(String(keywordText(record)), '关键词已复制')
                    "
                  >
                    复制
                  </Button>
                  <Button
                    size="small"
                    @click="keywordFilter = String(keywordText(record) || '')"
                  >
                    筛选
                  </Button>
                </div>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'searchUrl' && text">
              <a :href="String(text)" rel="noreferrer" target="_blank">
                打开搜索页
              </a>
            </template>
            <template v-else-if="isProductColumn(column.dataIndex)">
              <div class="product-strip">
                <template v-if="productItems(text, record).length > 0">
                  <a
                    v-for="item in productItems(text, record)"
                    :key="item.key"
                    class="product-item"
                    :href="item.url || undefined"
                    rel="noreferrer"
                    target="_blank"
                    :title="
                      item.url ? `${item.label} · ${item.domain}` : item.label
                    "
                  >
                    <img v-if="item.image" :src="item.image" alt="" />
                    <span v-else class="product-token">
                      <span>{{ item.label }}</span>
                      <small v-if="item.url">{{ item.domain }}</small>
                    </span>
                  </a>
                </template>
                <span v-else>-</span>
              </div>
            </template>
            <template v-else>
              <span
                :class="
                  cellClass(
                    result?.columns.find(
                      (item) => item.key === column.dataIndex,
                    ),
                  )
                "
              >
                {{
                  formatCell(
                    text,
                    result?.columns.find(
                      (item) => item.key === column.dataIndex,
                    ),
                  )
                }}
              </span>
            </template>
          </template>
        </Table>

        <div v-if="!result && !loading" class="empty-start">
          <Empty
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            description="输入 ASIN 后点击查询"
          />
        </div>
      </section>
    </Spin>

    <Drawer v-model:open="drawerOpen" title="原始字段" width="720">
      <pre class="raw-json">{{ JSON.stringify(selectedRow, null, 2) }}</pre>
    </Drawer>
  </div>
</template>

<style scoped>
.keyword-reverse-page {
  min-height: calc(100vh - 112px);
  padding: 18px;
  background: #eef3f8;
}

.page-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.page-head h1,
.panel-title h2 {
  margin: 0;
  font-weight: 700;
  color: #12233f;
  letter-spacing: 0;
}

.page-head h1 {
  font-size: 24px;
  line-height: 32px;
}

.page-head p,
.panel-title p {
  margin: 4px 0 0;
  color: #64748b;
}

.query-card {
  margin-bottom: 14px;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.query-grid {
  display: grid;
  grid-template-columns: minmax(300px, 2fr) repeat(5, minmax(120px, 1fr));
  gap: 12px;
  align-items: end;
}

.asin-field {
  min-width: 0;
}

.full-control,
.direction-group {
  width: 100%;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.metric-item {
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.metric-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #64748b;
}

.metric-item strong {
  display: block;
  font-size: 24px;
  line-height: 30px;
  color: #0f766e;
}

.result-section {
  padding: 14px 16px;
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.frequency-section {
  padding-bottom: 18px;
}

.table-section {
  padding-bottom: 0;
}

.panel-title {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title h2 {
  font-size: 18px;
  line-height: 26px;
}

.compact-title {
  align-items: center;
  padding-bottom: 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid #edf2f7;
}

.word-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  max-height: 260px;
  padding: 8px 2px 2px;
  overflow: auto;
}

.word-item {
  padding: 0;
  color: #1f2937;
  text-align: left;
  white-space: normal;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.word-item:hover {
  color: #2563eb;
}

.word-item span {
  margin-left: 2px;
  color: #64748b;
}

.result-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid #edf2f7;
}

.result-count {
  font-weight: 600;
  color: #334155;
}

.sort-select {
  width: 140px;
}

.direction-select {
  width: 86px;
}

.keyword-filter-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 0;
}

.match-select {
  width: 86px;
}

.keyword-filter-input {
  max-width: 360px;
}

.keyword-cell {
  min-width: 200px;
}

.keyword-main {
  font-weight: 600;
  color: #111827;
}

.keyword-cn {
  margin-top: 4px;
  color: #64748b;
}

.row-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.product-strip {
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 48px;
  overflow: auto hidden;
}

.product-strip img {
  width: 38px;
  height: 38px;
  object-fit: contain;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.product-item {
  flex: 0 0 auto;
  color: inherit;
  text-decoration: none;
}

.product-token {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
  align-items: center;
  justify-content: center;
  min-width: 94px;
  max-width: 132px;
  min-height: 38px;
  padding: 0 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: #334155;
  white-space: nowrap;
  background: #f8fafc;
  border: 1px solid #dbe4ef;
  border-radius: 4px;
}

.product-token span,
.product-token small {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 15px;
  white-space: nowrap;
}

.product-token small {
  font-size: 10px;
  color: #64748b;
}

.product-item:hover .product-token {
  color: #1d4ed8;
  border-color: #93c5fd;
}

.trend-cell {
  width: 284px;
  min-height: 98px;
}

.trend-chart {
  width: 284px;
  height: 98px;
}

.numeric-cell {
  display: block;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.raw-json {
  padding: 12px;
  overflow: auto;
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.empty-start {
  padding: 28px 0 36px;
}

@media (max-width: 1200px) {
  .query-grid,
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .asin-field {
    grid-column: span 2;
  }
}

@media (max-width: 720px) {
  .keyword-reverse-page {
    padding: 12px;
  }

  .page-head {
    flex-direction: column;
  }

  .result-toolbar,
  .keyword-filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .keyword-filter-input,
  .match-select,
  .sort-select,
  .direction-select {
    width: 100%;
    max-width: none;
  }

  .query-grid,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .asin-field {
    grid-column: span 1;
  }
}
</style>
