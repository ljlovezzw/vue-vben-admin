<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  AlertLevel,
  KanbanProductDetailColumn,
  KanbanProductDetailOverview,
} from '#/api/kanban';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Table,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { fetchKanbanProductDetail } from '#/api/kanban';

type ProductDetailDateRangeType =
  | 'currentMonth'
  | 'custom'
  | 'last30'
  | 'last7'
  | 'lastMonth'
  | 'today'
  | 'year'
  | 'yesterday';

interface BaseProductDetailParams {
  alertLevels?: AlertLevel[];
  categories?: string[];
  responsibles?: string[];
  sites?: string[];
  statuses?: string[];
}

const props = withDefaults(
  defineProps<{
    baseParams?: BaseProductDetailParams;
    responsibleOptions?: string[];
  }>(),
  {
    baseParams: () => ({}),
    responsibleOptions: () => [],
  },
);

const productDetail = ref<KanbanProductDetailOverview | null>(null);
const productDetailLoading = ref(false);
const selectedProductCountries = ref<string[]>([]);
const selectedProductColumns = ref<string[]>([]);
const productColumnsInitialized = ref(false);
const productCountryDropdownOpen = ref(false);
const productCountryDraft = ref<string[]>([]);
const productColumnConfigOpen = ref(false);
const productColumnDraft = ref<string[]>([]);
const productColumnSearch = ref('');
const pinnedProductColumnKeys = ref<string[]>([]);
const draggingProductColumnKey = ref('');
const PRODUCT_DETAIL_SORTABLE_LABELS = new Set([
  '上线天数',
  '销量',
  '目标销量',
  '销量完成率',
  '销售额',
]);

const productDetailPagination = reactive<TablePaginationConfig>({
  current: 1,
  pageSize: 15,
  pageSizeOptions: ['15', '30', '50', '100'],
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条新品详情`,
  onChange: (page, pageSize) => {
    productDetailPagination.current = page;
    productDetailPagination.pageSize = pageSize;
  },
  onShowSizeChange: (_current, size) => {
    productDetailPagination.current = 1;
    productDetailPagination.pageSize = size;
  },
});

const productDetailDateRangeLabels: Record<string, string> = {
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

const productDetailDateRangeOptions = [
  { label: '今日', value: 'today' },
  { label: '昨日', value: 'yesterday' },
  { label: '最近7天', value: 'last7' },
  { label: '最近30天', value: 'last30' },
  { label: '本月', value: 'currentMonth' },
  { label: '上月', value: 'lastMonth' },
  { label: '今年', value: 'year' },
  { label: '自定义', value: 'custom' },
];

const productDetailQuery = reactive({
  dateRangeType: 'yesterday' as ProductDetailDateRangeType,
  endDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  responsibles: [] as string[],
  startDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
});

const productDetailRows = computed(() => productDetail.value?.rows ?? []);
const productDetailColumnDefs = computed(
  () => productDetail.value?.columns ?? [],
);
const productCountryOptions = computed(() => {
  const values = new Set<string>(selectedProductCountries.value);
  for (const country of productDetail.value?.countries ?? []) values.add(country);
  return [...values].filter(Boolean).map((value) => ({ label: value, value }));
});
const productCountryFilterLabel = computed(() => {
  if (selectedProductCountries.value.length === 0) return '国家';
  if (selectedProductCountries.value.length === 1)
    return selectedProductCountries.value[0] ?? '国家';
  return `国家(${selectedProductCountries.value.length})`;
});
const productColumnMap = computed(() => {
  const map = new Map<string, KanbanProductDetailColumn>();
  for (const column of productDetailColumnDefs.value) map.set(column.key, column);
  return map;
});
const productVisibleColumns = computed(() => {
  const columns: KanbanProductDetailColumn[] = [];
  for (const key of selectedProductColumns.value) {
    const column = productColumnMap.value.get(key);
    if (column) columns.push(column);
  }
  return columns;
});
const selectedProductColumnDraftMetas = computed<KanbanProductDetailColumn[]>(
  () =>
    productColumnDraft.value
      .map((key) => productColumnMap.value.get(key))
      .filter((column): column is KanbanProductDetailColumn => Boolean(column)),
);
const productColumnGroups = computed(() => {
  const groups: Array<{
    columns: KanbanProductDetailColumn[];
    key: string;
    title: string;
  }> = [
    { columns: [], key: 'base', title: '基础信息' },
    { columns: [], key: 'sales', title: '销售数据' },
    { columns: [], key: 'ad', title: '广告数据' },
    { columns: [], key: 'inventory', title: '库存价格' },
    { columns: [], key: 'profit', title: '利润退款' },
    { columns: [], key: 'other', title: '其他字段' },
  ];
  const groupMap = new Map(groups.map((group) => [group.key, group]));
  const keyword = productColumnSearch.value.trim().toLowerCase();
  for (const column of productDetailColumnDefs.value) {
    if (
      keyword &&
      !column.key.toLowerCase().includes(keyword) &&
      !column.label.toLowerCase().includes(keyword) &&
      !column.source.toLowerCase().includes(keyword)
    ) {
      continue;
    }
    const groupKey = productColumnGroupKey(column);
    (groupMap.get(groupKey) ?? groupMap.get('other'))?.columns.push(column);
  }
  return groups.filter((group) => group.columns.length > 0);
});
const productHiddenColumnCount = computed(() =>
  Math.max(
    productDetailColumnDefs.value.length - selectedProductColumns.value.length,
    0,
  ),
);
const productDetailColumns = computed<TableColumnsType<Record<string, any>>>(
  () => {
    const fixedKeys = new Set(pinnedProductColumnKeys.value);
    return [
      {
        align: 'center',
        className: 'product-no-column',
        dataIndex: '__no__',
        fixed: 'left',
        title: 'No.',
        width: 52,
      },
      ...productVisibleColumns.value.map((column) =>
        buildProductDetailColumn(column, fixedKeys.has(column.key)),
      ),
    ];
  },
);
const productDetailScrollX = computed(() =>
  Math.max(
    1320,
    52 +
      productVisibleColumns.value.reduce(
        (total, column) => total + productColumnWidth(column),
        0,
      ),
  ),
);
const productDetailDateRangeValue = computed({
  get(): [string, string] {
    return [productDetailQuery.startDate, productDetailQuery.endDate];
  },
  set(value: [string, string] | null) {
    if (!value?.[0] || !value?.[1]) return;
    productDetailQuery.startDate = value[0];
    productDetailQuery.endDate = value[1];
    productDetailQuery.dateRangeType = 'custom';
  },
});
const productDetailResponsibleOptions = computed(() =>
  props.responsibleOptions.map((value) => ({ label: value, value })),
);

function resetProductDetailPagination() {
  productDetailPagination.current = 1;
}

function productDetailDateRangeLabel(value: unknown) {
  const rawValue = String(value || 'yesterday');
  return (
    productDetailDateRangeLabels[rawValue] ??
    productDetailDateRangeLabels[rawValue.toLowerCase()] ??
    rawValue
  );
}

function disabledFutureDate(value: ReturnType<typeof dayjs>) {
  return value.isAfter(dayjs(), 'day');
}

function applyProductDetailDateRangeType(value: ProductDetailDateRangeType) {
  const today = dayjs();
  const yesterday = today.subtract(1, 'day');
  if (value === 'custom') return;
  if (value === 'today') {
    productDetailQuery.startDate = today.format('YYYY-MM-DD');
    productDetailQuery.endDate = productDetailQuery.startDate;
    return;
  }
  if (value === 'yesterday') {
    productDetailQuery.startDate = yesterday.format('YYYY-MM-DD');
    productDetailQuery.endDate = productDetailQuery.startDate;
    return;
  }
  if (value === 'last7') {
    productDetailQuery.endDate = yesterday.format('YYYY-MM-DD');
    productDetailQuery.startDate = yesterday.subtract(6, 'day').format('YYYY-MM-DD');
    return;
  }
  if (value === 'last30') {
    productDetailQuery.endDate = yesterday.format('YYYY-MM-DD');
    productDetailQuery.startDate = yesterday.subtract(29, 'day').format('YYYY-MM-DD');
    return;
  }
  if (value === 'currentMonth') {
    productDetailQuery.startDate = today.startOf('month').format('YYYY-MM-DD');
    productDetailQuery.endDate = yesterday.format('YYYY-MM-DD');
    return;
  }
  if (value === 'lastMonth') {
    const lastMonth = today.subtract(1, 'month');
    productDetailQuery.startDate = lastMonth.startOf('month').format('YYYY-MM-DD');
    productDetailQuery.endDate = lastMonth.endOf('month').format('YYYY-MM-DD');
    return;
  }
  productDetailQuery.startDate = today.startOf('year').format('YYYY-MM-DD');
  productDetailQuery.endDate = yesterday.format('YYYY-MM-DD');
}

async function loadProductDetailData() {
  productDetailLoading.value = true;
  try {
    const detailResult = await fetchKanbanProductDetail({
      ...props.baseParams,
      countries: selectedProductCountries.value,
      dateRangeType: productDetailQuery.dateRangeType,
      endDate: productDetailQuery.endDate,
      responsibles: productDetailQuery.responsibles.length
        ? productDetailQuery.responsibles
        : props.baseParams.responsibles,
      startDate: productDetailQuery.startDate,
    });
    productDetail.value = detailResult;
    ensureProductColumnsInitialized(detailResult);
    const availableKeys = new Set(
      detailResult.columns.map((column) => column.key),
    );
    selectedProductColumns.value = selectedProductColumns.value.filter((key) =>
      availableKeys.has(key),
    );
    pinnedProductColumnKeys.value = pinnedProductColumnKeys.value.filter(
      (key) =>
        availableKeys.has(key) && selectedProductColumns.value.includes(key),
    );
  } finally {
    productDetailLoading.value = false;
  }
}

async function applyProductDetailFilters() {
  resetProductDetailPagination();
  await loadProductDetailData();
}

function ensureProductColumnsInitialized(detail: KanbanProductDetailOverview) {
  if (productColumnsInitialized.value) return;
  selectedProductColumns.value = detail.columns
    .filter((column) => column.defaultVisible)
    .map((column) => column.key);
  productColumnsInitialized.value = true;
}

function handleProductCountryDropdownOpen(open: boolean) {
  productCountryDropdownOpen.value = open;
  if (open) productCountryDraft.value = [...selectedProductCountries.value];
}

function isProductCountryDraftChecked(value: string) {
  return productCountryDraft.value.includes(value);
}

function toggleProductCountryDraftValue(value: string) {
  productCountryDraft.value = isProductCountryDraftChecked(value)
    ? productCountryDraft.value.filter((item) => item !== value)
    : [...productCountryDraft.value, value];
}

function isProductCountryDraftAllSelected() {
  return (
    productCountryOptions.value.length > 0 &&
    productCountryOptions.value.every((option) =>
      productCountryDraft.value.includes(option.value),
    )
  );
}

function toggleProductCountryDraftAll() {
  productCountryDraft.value = isProductCountryDraftAllSelected()
    ? []
    : productCountryOptions.value.map((option) => option.value);
}

function cancelProductCountryFilter() {
  productCountryDraft.value = [...selectedProductCountries.value];
  productCountryDropdownOpen.value = false;
}

function applyProductCountryFilter() {
  selectedProductCountries.value = [...productCountryDraft.value];
  productCountryDropdownOpen.value = false;
  void applyProductDetailFilters();
}

function openProductColumnConfig() {
  productColumnDraft.value = selectedProductColumns.value.filter((key) =>
    productColumnMap.value.has(key),
  );
  pinnedProductColumnKeys.value = pinnedProductColumnKeys.value.filter((key) =>
    productColumnDraft.value.includes(key),
  );
  productColumnSearch.value = '';
  productColumnConfigOpen.value = true;
}

function isProductColumnDraftChecked(key: string) {
  return productColumnDraft.value.includes(key);
}

function toggleProductColumnDraft(key: string) {
  if (isProductColumnDraftChecked(key)) {
    productColumnDraft.value = productColumnDraft.value.filter(
      (item) => item !== key,
    );
    pinnedProductColumnKeys.value = pinnedProductColumnKeys.value.filter(
      (item) => item !== key,
    );
    return;
  }
  productColumnDraft.value = [...productColumnDraft.value, key];
}

function isProductColumnGroupAllSelected(columns: KanbanProductDetailColumn[]) {
  return (
    columns.length > 0 &&
    columns.every((column) => productColumnDraft.value.includes(column.key))
  );
}

function toggleProductColumnGroup(columns: KanbanProductDetailColumn[]) {
  if (isProductColumnGroupAllSelected(columns)) {
    const groupKeys = new Set(columns.map((column) => column.key));
    productColumnDraft.value = productColumnDraft.value.filter(
      (key) => !groupKeys.has(key),
    );
    pinnedProductColumnKeys.value = pinnedProductColumnKeys.value.filter(
      (key) => !groupKeys.has(key),
    );
    return;
  }
  const next = [...productColumnDraft.value];
  for (const column of columns) {
    if (!next.includes(column.key)) next.push(column.key);
  }
  productColumnDraft.value = next;
}

function removeProductColumnDraft(key: string) {
  productColumnDraft.value = productColumnDraft.value.filter(
    (item) => item !== key,
  );
  pinnedProductColumnKeys.value = pinnedProductColumnKeys.value.filter(
    (item) => item !== key,
  );
}

function moveProductColumnDraft(key: string, direction: -1 | 1) {
  const currentIndex = productColumnDraft.value.indexOf(key);
  const nextIndex = currentIndex + direction;
  if (
    currentIndex < 0 ||
    nextIndex < 0 ||
    nextIndex >= productColumnDraft.value.length
  ) {
    return;
  }
  const next = [...productColumnDraft.value];
  const [item] = next.splice(currentIndex, 1);
  if (item) next.splice(nextIndex, 0, item);
  productColumnDraft.value = next;
}

function handleProductColumnDragStart(key: string) {
  draggingProductColumnKey.value = key;
}

function handleProductColumnDrop(targetKey: string) {
  const sourceKey = draggingProductColumnKey.value;
  draggingProductColumnKey.value = '';
  if (!sourceKey || sourceKey === targetKey) return;
  const next = [...productColumnDraft.value];
  const sourceIndex = next.indexOf(sourceKey);
  const targetIndex = next.indexOf(targetKey);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const [item] = next.splice(sourceIndex, 1);
  if (item) next.splice(targetIndex, 0, item);
  productColumnDraft.value = next;
}

function isProductColumnPinned(key: string) {
  return pinnedProductColumnKeys.value.includes(key);
}

function toggleProductColumnPinned(key: string) {
  if (!productColumnDraft.value.includes(key)) return;
  if (isProductColumnPinned(key)) {
    pinnedProductColumnKeys.value = pinnedProductColumnKeys.value.filter(
      (item) => item !== key,
    );
    return;
  }
  if (pinnedProductColumnKeys.value.length >= 7) return;
  pinnedProductColumnKeys.value = [...pinnedProductColumnKeys.value, key];
}

function applyProductColumnConfig() {
  selectedProductColumns.value = [...productColumnDraft.value];
  pinnedProductColumnKeys.value = pinnedProductColumnKeys.value.filter((key) =>
    selectedProductColumns.value.includes(key),
  );
  productColumnConfigOpen.value = false;
  resetProductDetailPagination();
}

function resetProductColumns() {
  selectedProductColumns.value = productDetailColumnDefs.value
    .filter((column) => column.defaultVisible)
    .map((column) => column.key);
  pinnedProductColumnKeys.value = [];
  if (productColumnConfigOpen.value) {
    productColumnDraft.value = [...selectedProductColumns.value];
  }
  resetProductDetailPagination();
}

function buildProductDetailColumn(column: KanbanProductDetailColumn, fixed: boolean) {
  return {
    align: column.kind === 'text' ? ('left' as const) : ('right' as const),
    className: `product-detail-column product-detail-column-${column.kind}`,
    dataIndex: column.key,
    ellipsis: column.kind !== 'image',
    fixed: fixed ? ('left' as const) : undefined,
    sorter: isProductDetailSortableColumn(column)
      ? (left: Record<string, any>, right: Record<string, any>) =>
          compareProductDetailSortableValue(left[column.key], right[column.key])
      : undefined,
    title: column.label,
    width: productColumnWidth(column),
  };
}

function isProductDetailSortableColumn(column: KanbanProductDetailColumn) {
  return PRODUCT_DETAIL_SORTABLE_LABELS.has(column.label.trim());
}

function compareProductDetailSortableValue(left: any, right: any) {
  const leftNumber = productMetricNumber(left);
  const rightNumber = productMetricNumber(right);
  if (leftNumber === null && rightNumber === null) return 0;
  if (leftNumber === null) return 1;
  if (rightNumber === null) return -1;
  return leftNumber - rightNumber;
}

function productColumnWidth(column: KanbanProductDetailColumn) {
  if (column.kind === 'image') return 72;
  if (column.label === 'SPU') return 136;
  if (column.label === '运营负责人') return 104;
  if (column.label.includes('ASIN')) return 126;
  if (column.label.includes('类目') || column.label.includes('分类')) return 112;
  if (column.label.includes('库存')) return 96;
  if (column.label.includes('占比') || column.label.includes('完成率')) return 126;
  if (column.label.length <= 3) return 88;
  return Math.max(98, Math.min(column.label.length * 15 + 36, 156));
}

function productDetailRowKey(row: Record<string, any>) {
  return `${row.key}-${row.site}-${row.country}`;
}

function productColumnKind(key: string) {
  return productColumnMap.value.get(key)?.kind ?? 'text';
}

function productColumnLabel(key: string) {
  return productColumnMap.value.get(key)?.label ?? '';
}

function isParentAsinColumn(key: string) {
  return productColumnLabel(key) === '父ASIN';
}

function amazonDomain(row: Record<string, any>) {
  const site = String(row.site || '').toUpperCase();
  const country = String(row.country || '').trim();
  const domains: Record<string, string> = {
    AE: 'www.amazon.ae',
    AU: 'www.amazon.com.au',
    BE: 'www.amazon.com.be',
    BR: 'www.amazon.com.br',
    CA: 'www.amazon.ca',
    DE: 'www.amazon.de',
    ES: 'www.amazon.es',
    FR: 'www.amazon.fr',
    IE: 'www.amazon.ie',
    IT: 'www.amazon.it',
    JP: 'www.amazon.co.jp',
    MX: 'www.amazon.com.mx',
    NL: 'www.amazon.nl',
    PL: 'www.amazon.pl',
    SE: 'www.amazon.se',
    TR: 'www.amazon.com.tr',
    UK: 'www.amazon.co.uk',
    US: 'www.amazon.com',
  };
  const countryDomains: Record<string, string> = {
    美国: 'www.amazon.com',
    英国: 'www.amazon.co.uk',
    德国: 'www.amazon.de',
    法国: 'www.amazon.fr',
    意大利: 'www.amazon.it',
    西班牙: 'www.amazon.es',
    加拿大: 'www.amazon.ca',
    墨西哥: 'www.amazon.com.mx',
    巴西: 'www.amazon.com.br',
    澳洲: 'www.amazon.com.au',
    阿联酋: 'www.amazon.ae',
    比利时: 'www.amazon.com.be',
    爱尔兰: 'www.amazon.ie',
    荷兰: 'www.amazon.nl',
    波兰: 'www.amazon.pl',
    瑞典: 'www.amazon.se',
    土耳其: 'www.amazon.com.tr',
  };
  return domains[site] ?? countryDomains[country] ?? 'www.amazon.com';
}

function amazonParentAsinUrl(row: Record<string, any>, value: any) {
  const parentAsin = String(productMetricRawValue(value) || '').trim();
  if (!parentAsin) return '';
  return `https://${amazonDomain(row)}/dp/${encodeURIComponent(parentAsin)}`;
}

function productColumnGroupKey(column: KanbanProductDetailColumn) {
  const label = column.label;
  const source = column.source.toLowerCase();
  if (
    [
      'SPU',
      'ASIN',
      '父ASIN',
      '主图',
      '店铺',
      '运营负责人',
      '一级类目',
      '二级分类',
      '国家',
      '站点',
      '上线天数',
    ].some((flag) => label.includes(flag))
  ) {
    return 'base';
  }
  if (
    [
      '广告',
      'ACOS',
      'ACOAS',
      'TACOS',
      'ROAS',
      'ROI',
      'CPC',
      'CPM',
      'CPO',
      'CPU',
      'CVR',
      'CTR',
      '点击',
      '展示',
    ].some((flag) => label.includes(flag)) ||
    source.includes('ad')
  ) {
    return 'ad';
  }
  if (['库存', 'FBA', '评分', '评论', '价格', '均价'].some((flag) => label.includes(flag))) {
    return 'inventory';
  }
  if (['利润', '毛利', '退款', '退货', '结算'].some((flag) => label.includes(flag))) {
    return 'profit';
  }
  if (['销量', '销售', '订单', '目标', '完成率', '自然'].some((flag) => label.includes(flag))) {
    return 'sales';
  }
  return 'other';
}

function isProductMetricKind(kind: string) {
  return kind === 'number' || kind === 'percent' || kind === 'decimal';
}

function isProductMetricColumn(key: string) {
  return isProductMetricKind(productColumnKind(key));
}

function isProductMetricCell(value: any) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.prototype.hasOwnProperty.call(value, 'value'),
  );
}

function productMetricRawValue(value: any) {
  return isProductMetricCell(value) ? value.value : value;
}

function productMetricProgress(value: any) {
  if (!isProductMetricCell(value)) return null;
  const progress = Number(value.progress);
  return Number.isFinite(progress) ? progress : null;
}

function productMetricNumber(value: any) {
  const numeric = Number(productMetricRawValue(value));
  return Number.isFinite(numeric) ? numeric : null;
}

function findProductRowValue(
  record: Record<string, any>,
  matcher: (label: string) => boolean,
) {
  for (const column of productDetailColumnDefs.value) {
    if (!matcher(column.label)) continue;
    const value = productMetricNumber(record[column.key]);
    if (value !== null) return value;
  }
  return null;
}

function productRowValueByLabels(record: Record<string, any>, labels: string[]) {
  return findProductRowValue(record, (label) => labels.includes(label));
}

function productRowValueByIncludes(
  record: Record<string, any>,
  includes: string[],
  excludes: string[] = [],
) {
  return findProductRowValue(
    record,
    (label) =>
      includes.every((flag) => label.includes(flag)) &&
      excludes.every((flag) => !label.includes(flag)),
  );
}

function productPositiveRatio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return Math.max(0, numerator / denominator);
}

function productMetricRatio(key: string, record: Record<string, any>, value: any) {
  const label = productColumnLabel(key);
  const numeric = productMetricNumber(value);
  const progress = productMetricProgress(value);

  if (label.includes('目标销量') || label.includes('完成率')) {
    return progress ?? numeric;
  }
  if (
    label.includes('占比') ||
    label.includes('率') ||
    label.includes('ACOS') ||
    label.includes('ACOAS') ||
    label.includes('TACOS') ||
    label.includes('CTR') ||
    label.includes('CVR') ||
    label.includes('ROAS') ||
    label.includes('ROI')
  ) {
    return numeric;
  }

  const totalOrders =
    productRowValueByLabels(record, ['订单量', '总订单', '总订单量']) ??
    productRowValueByIncludes(record, ['订单'], ['广告', '自然', '直接', 'B2B', '促销']);
  const totalSales =
    productRowValueByLabels(record, ['销售额', '总销售额']) ??
    productRowValueByIncludes(record, ['销售额'], ['广告', '直接', '自然', 'B2B', '促销']);
  const totalUnits =
    productRowValueByLabels(record, ['销量', '总销量']) ??
    productRowValueByIncludes(record, ['销量'], ['目标', '完成率', '广告', '自然', 'B2B']);
  const impressions = productRowValueByIncludes(record, ['展示']);
  const clicks = productRowValueByIncludes(record, ['点击']);

  if (label.includes('订单')) return productPositiveRatio(numeric, totalOrders);
  if (label.includes('广告销售额') || label.includes('直接成交销售额')) {
    return productPositiveRatio(numeric, totalSales);
  }
  if (
    label.includes('B2B销售额') ||
    label.includes('B2B 销售额') ||
    label.includes('促销销售额') ||
    label.includes('自然销售额')
  ) {
    return productPositiveRatio(numeric, totalSales);
  }
  if (label.includes('广告花费')) return productPositiveRatio(numeric, totalSales);
  if (label.includes('退款金额')) return productPositiveRatio(numeric, totalSales);
  if (label.includes('退货') || label.includes('退款量')) {
    return productPositiveRatio(numeric, totalOrders ?? totalUnits);
  }
  if (label.includes('点击')) return productPositiveRatio(numeric, impressions);
  if (label.includes('购买') || label.includes('转化')) {
    return productPositiveRatio(numeric, clicks);
  }
  return null;
}

function hasProductMetricBar(key: string, record: Record<string, any>, value: any) {
  return productMetricRatio(key, record, value) !== null;
}

function productMetricBarWidth(key: string, record: Record<string, any>, value: any) {
  const ratio = productMetricRatio(key, record, value);
  if (ratio === null || !Number.isFinite(ratio)) return '0%';
  return `${Math.min(100, Math.max(0, ratio * 100))}%`;
}

function productMetricTone(key: string, record: Record<string, any>, value: any) {
  const label = productColumnLabel(key);
  const numeric = Number(productMetricRawValue(value) || 0);
  const ratio = productMetricRatio(key, record, value);
  if (ratio !== null) {
    if (label.includes('目标销量') || label.includes('完成率')) {
      if (ratio >= 1) return 'metric-good';
      if (ratio >= 0.5) return 'metric-warn';
      return 'metric-risk';
    }
    if (
      label.includes('ACOS') ||
      label.includes('ACOAS') ||
      label.includes('TACOS') ||
      label.includes('花费') ||
      label.includes('退款') ||
      label.includes('退货')
    ) {
      return 'metric-risk';
    }
    return 'metric-good';
  }
  if (isProductMetricCell(value) && Number(value.delta || 0) !== 0) {
    return Number(value.delta || 0) > 0 ? 'metric-good' : 'metric-risk';
  }
  return numeric < 0 ? 'metric-risk' : 'metric-plain';
}

function productMetricDeltaClass(value: any) {
  if (!isProductMetricCell(value)) return '';
  const delta = Number(value.delta || 0);
  if (delta > 0) return 'delta-up';
  if (delta < 0) return 'delta-down';
  return 'delta-flat';
}

function productMetricDeltaText(value: any, kind: string) {
  if (!isProductMetricCell(value) || value.delta === null || value.delta === undefined) return '';
  const delta = Number(value.delta || 0);
  if (!Number.isFinite(delta) || delta === 0) return '';
  if (kind === 'percent') return `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(2)}pp`;
  const rate = Number(value.deltaRate);
  const deltaText = formatSignedMetricDelta(delta);
  if (Number.isFinite(rate) && Math.abs(rate) > 0) {
    return `${deltaText} / ${formatPercent(rate)}`;
  }
  return deltaText;
}

function formatSignedMetricDelta(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function productTextClass(key: string) {
  const label = productColumnLabel(key);
  return label.includes('ASIN') || label === 'SPU' ? 'product-code-text' : '';
}

function isProductMoneyColumn(key: string) {
  const label = productColumnLabel(key);
  return ['金额', '毛利', '利润', '花费', '退款', '运费', '销售额', '净销售额'].some(
    (flag) => label.includes(flag),
  );
}

function formatProductDetailValue(value: any, kind: string, key = '') {
  const rawValue = productMetricRawValue(value);
  if (rawValue === null || rawValue === undefined || rawValue === '') return '-';
  if (isProductMoneyColumn(key)) {
    return Number(rawValue || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  if (kind === 'percent') return formatPercent(Number(rawValue || 0));
  if (kind === 'decimal') {
    return Number(rawValue || 0).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  }
  if (kind === 'number') {
    return Number(rawValue || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }
  return String(rawValue);
}

function formatPercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

watch(selectedProductColumns, () => {
  resetProductDetailPagination();
});

watch(
  () => props.baseParams,
  () => {
    selectedProductCountries.value = [];
    productCountryDraft.value = [];
    void applyProductDetailFilters();
  },
  { deep: true },
);

onMounted(() => {
  void loadProductDetailData();
});
</script>

<template>
  <Card class="product-detail-card" :body-style="{ padding: 0 }">
    <template #title>
      <div class="product-detail-toolbar">
        <div class="product-detail-heading">
          <span class="product-title-dot"></span>
          <strong>新品详情表</strong>
        </div>
        <Space class="product-detail-controls" wrap>
          <span class="product-detail-meta">
            {{ productDetailDateRangeLabel(productDetail?.query.dateRangeType) }}：{{
              productDetail?.query.startDate
            }}
            ~ {{ productDetail?.query.endDate }}
          </span>
          <span class="product-detail-meta">
            共 {{ productDetailRows.length }} 条
          </span>
          <span class="product-detail-meta">
            过滤({{ selectedProductCountries.length }})
          </span>
          <span class="product-detail-meta">
            已选字段({{ selectedProductColumns.length }})
          </span>
          <span class="product-detail-meta">
            隐藏({{ productHiddenColumnCount }})
          </span>
          <label class="product-detail-label">时间</label>
          <Select
            v-model:value="productDetailQuery.dateRangeType"
            :options="productDetailDateRangeOptions"
            size="small"
            style="width: 104px"
            @change="
              () => {
                applyProductDetailDateRangeType(productDetailQuery.dateRangeType);
                applyProductDetailFilters();
              }
            "
          />
          <DatePicker.RangePicker
            v-if="productDetailQuery.dateRangeType === 'custom'"
            v-model:value="productDetailDateRangeValue"
            :allow-clear="false"
            :disabled-date="disabledFutureDate"
            size="small"
            value-format="YYYY-MM-DD"
            @change="applyProductDetailFilters"
          />
          <label class="product-detail-label">负责人</label>
          <Select
            v-model:value="productDetailQuery.responsibles"
            :options="productDetailResponsibleOptions"
            allow-clear
            max-tag-count="responsive"
            mode="multiple"
            placeholder="继承主筛选"
            size="small"
            style="min-width: 180px"
            @change="applyProductDetailFilters"
          />
          <Dropdown
            v-model:open="productCountryDropdownOpen"
            :trigger="['click']"
            @open-change="handleProductCountryDropdownOpen"
          >
            <Button class="product-filter-trigger">
              {{ productCountryFilterLabel }}
            </Button>
            <template #overlay>
              <div class="product-filter-menu" @click.stop>
                <Checkbox
                  :checked="isProductCountryDraftAllSelected()"
                  @change="toggleProductCountryDraftAll"
                >
                  全选
                </Checkbox>
                <div class="product-filter-scroll">
                  <Checkbox
                    v-for="option in productCountryOptions"
                    :key="option.value"
                    :checked="isProductCountryDraftChecked(option.value)"
                    @change="() => toggleProductCountryDraftValue(option.value)"
                  >
                    {{ option.label }}
                  </Checkbox>
                </div>
                <div class="product-filter-footer">
                  <Button size="small" @click="cancelProductCountryFilter">
                    取消
                  </Button>
                  <Button size="small" type="primary" @click="applyProductCountryFilter">
                    确定
                  </Button>
                </div>
              </div>
            </template>
          </Dropdown>
          <Button @click="openProductColumnConfig">
            列配置（{{ selectedProductColumns.length }}）
          </Button>
          <Button @click="resetProductColumns">默认列</Button>
          <Button
            type="primary"
            :loading="productDetailLoading"
            @click="applyProductDetailFilters"
          >
            应用
          </Button>
        </Space>
      </div>
    </template>

    <Table
      :columns="productDetailColumns"
      :data-source="productDetailRows"
      :bordered="true"
      :loading="productDetailLoading"
      :pagination="productDetailPagination"
      :row-key="productDetailRowKey"
      :scroll="{ x: productDetailScrollX, y: 560 }"
      size="small"
      sticky
    >
      <template #bodyCell="{ column, index, record, text }">
        <template v-if="String(column.dataIndex) === '__no__'">
          <span class="product-row-no">{{ index + 1 }}</span>
        </template>
        <template v-else-if="productColumnKind(String(column.dataIndex)) === 'image'">
          <img
            v-if="text"
            :src="String(text)"
            alt="主图"
            class="product-thumb"
          />
          <span v-else>-</span>
        </template>
        <template v-else-if="isProductMetricColumn(String(column.dataIndex))">
          <div
            class="product-metric-cell"
            :class="productMetricTone(String(column.dataIndex), record, text)"
          >
            <span
              v-if="hasProductMetricBar(String(column.dataIndex), record, text)"
              class="product-metric-bar"
              :style="{
                width: productMetricBarWidth(String(column.dataIndex), record, text),
              }"
            ></span>
            <span class="product-metric-content">
              <span class="product-metric-value">
                {{
                  formatProductDetailValue(
                    text,
                    productColumnKind(String(column.dataIndex)),
                    String(column.dataIndex),
                  )
                }}
              </span>
              <span
                v-if="
                  productMetricDeltaText(
                    text,
                    productColumnKind(String(column.dataIndex)),
                  )
                "
                class="product-metric-delta"
                :class="productMetricDeltaClass(text)"
              >
                {{
                  productMetricDeltaText(
                    text,
                    productColumnKind(String(column.dataIndex)),
                  )
                }}
              </span>
            </span>
          </div>
        </template>
        <template v-else-if="isParentAsinColumn(String(column.dataIndex))">
          <a
            v-if="amazonParentAsinUrl(record, text)"
            class="product-code-link"
            :href="amazonParentAsinUrl(record, text)"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ formatProductDetailValue(text, 'text') }}
          </a>
          <span v-else>-</span>
        </template>
        <template v-else>
          <span :class="productTextClass(String(column.dataIndex))">
            {{
              formatProductDetailValue(
                text,
                productColumnKind(String(column.dataIndex)),
                String(column.dataIndex),
              )
            }}
          </span>
        </template>
      </template>
    </Table>
  </Card>

  <Modal
    v-model:open="productColumnConfigOpen"
    :footer="null"
    title="新品详情列配置"
    width="920px"
    wrap-class-name="product-column-modal-wrap"
  >
    <div class="product-column-config">
      <section class="product-column-pool">
        <div class="product-column-config-bar">
          <Input
            v-model:value="productColumnSearch"
            allow-clear
            placeholder="搜索字段"
            size="small"
          />
        </div>
        <div class="product-column-groups">
          <article
            v-for="group in productColumnGroups"
            :key="group.key"
            class="product-column-group"
          >
            <header>
              <span>{{ group.title }}</span>
              <button type="button" @click="toggleProductColumnGroup(group.columns)">
                {{
                  isProductColumnGroupAllSelected(group.columns)
                    ? '取消全选'
                    : '全选'
                }}
              </button>
            </header>
            <div class="product-column-check-grid">
              <Checkbox
                v-for="column in group.columns"
                :key="column.key"
                :checked="isProductColumnDraftChecked(column.key)"
                @change="() => toggleProductColumnDraft(column.key)"
              >
                {{ column.label }}
              </Checkbox>
            </div>
          </article>
        </div>
      </section>
      <aside class="product-column-selected">
        <header>
          <strong>已选({{ productColumnDraft.length }})</strong>
          <span>最多可固定7项，拖拽可调整顺序</span>
        </header>
        <ol class="product-column-selected-list">
          <li
            v-for="(column, index) in selectedProductColumnDraftMetas"
            :key="column.key"
            draggable="true"
            @dragover.prevent
            @dragstart="handleProductColumnDragStart(column.key)"
            @drop="handleProductColumnDrop(column.key)"
          >
            <span class="product-column-drag">::</span>
            <span class="product-column-order">{{ index + 1 }}</span>
            <b>{{ column.label }}</b>
            <div>
              <button
                :disabled="index === 0"
                type="button"
                @click="moveProductColumnDraft(column.key, -1)"
              >
                ↑
              </button>
              <button
                :disabled="index === productColumnDraft.length - 1"
                type="button"
                @click="moveProductColumnDraft(column.key, 1)"
              >
                ↓
              </button>
              <button
                :class="{ active: isProductColumnPinned(column.key) }"
                type="button"
                @click="toggleProductColumnPinned(column.key)"
              >
                固定
              </button>
              <button type="button" @click="removeProductColumnDraft(column.key)">
                移除
              </button>
            </div>
          </li>
        </ol>
      </aside>
    </div>
    <div class="product-column-config-footer">
      <Button @click="productColumnConfigOpen = false">取消</Button>
      <Button type="primary" @click="applyProductColumnConfig">确定</Button>
    </div>
  </Modal>
</template>

<style scoped>
.product-detail-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.product-detail-heading {
  display: inline-flex;
  flex: none;
  gap: 8px;
  align-items: center;
  min-width: 128px;
  font-size: 18px;
  color: var(--product-heading, #1f2937);
}

.product-title-dot {
  width: 13px;
  height: 13px;
  border: 2px solid #94a3b8;
  border-radius: 50%;
}

.product-detail-controls {
  justify-content: flex-end;
}

.product-detail-meta {
  font-size: 12px;
  font-weight: 700;
  color: var(--product-subtle, #475569);
}

.product-detail-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--product-subtle, #64748b);
}

.product-detail-card {
  --product-panel: #fff;
  --product-panel-muted: #f8fafc;
  --product-text: #334155;
  --product-heading: #334155;
  --product-muted: #94a3b8;
  --product-subtle: #64748b;
  --product-border: #e2e8f0;
  --product-border-strong: #cbd5e1;
  --product-hover: #eff6ff;

  margin-top: 8px;
  overflow: hidden;
  background: var(--product-panel);
  border: 1px solid var(--product-border);
}

:global(.dark) .product-detail-card {
  --product-panel: #0f172a;
  --product-panel-muted: #111827;
  --product-text: #cbd5e1;
  --product-heading: #e5e7eb;
  --product-muted: #94a3b8;
  --product-subtle: #a3b2c7;
  --product-border: #1e293b;
  --product-border-strong: #334155;
  --product-hover: #172554;
}

.product-detail-card :deep(.ant-card-head) {
  min-height: 48px;
  background: var(--product-panel);
  border-bottom: 1px solid var(--product-border);
}

.product-filter-trigger {
  min-width: 118px;
  text-align: left;
}

.product-filter-menu {
  position: relative;
  z-index: 1100;
  width: 238px;
  padding-top: 8px;
  overflow: hidden;
  background: var(--product-panel, #fff);
  border: 1px solid var(--product-border, #e2e8f0);
  border-radius: 4px;
  box-shadow: 0 12px 30px rgb(15 23 42 / 24%);
  opacity: 1;
}

:global(.dark) .product-filter-menu {
  background: #0f172a;
}

.product-filter-menu > .ant-checkbox-wrapper,
.product-filter-scroll .ant-checkbox-wrapper {
  display: flex;
  padding: 5px 12px;
  margin-inline-start: 0;
  color: var(--product-text, #334155);
}

.product-filter-scroll {
  display: grid;
  max-height: 230px;
  overflow-y: auto;
}

.product-filter-scroll .ant-checkbox-wrapper {
  min-height: 28px;
}

.product-filter-scroll .ant-checkbox-wrapper:hover {
  background: var(--product-panel-muted, #f8fafc);
}

.product-filter-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 10px;
  background: var(--product-panel-muted, #f8fafc);
  border-top: 1px solid var(--product-border, #e2e8f0);
}

.product-column-config {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  min-height: 580px;
  overflow: hidden;
  border: 1px solid var(--product-border, #e2e8f0);
}

.product-column-pool {
  min-width: 0;
  padding: 14px;
  background: var(--product-panel, #fff);
  border-right: 1px solid var(--product-border, #e2e8f0);
}

.product-column-config-bar {
  margin-bottom: 12px;
}

.product-column-groups {
  display: grid;
  gap: 16px;
  max-height: 520px;
  padding-right: 6px;
  overflow-y: auto;
}

.product-column-group header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.product-column-group header::before {
  width: 4px;
  height: 4px;
  content: '';
  background: var(--product-muted, #94a3b8);
  border-radius: 50%;
}

.product-column-group header span {
  font-weight: 700;
  color: var(--product-heading, #334155);
}

.product-column-group header button,
.product-column-selected button {
  padding: 0;
  color: #2563eb;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.product-column-check-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 18px;
}

.product-column-check-grid .ant-checkbox-wrapper {
  margin-inline-start: 0;
  color: var(--product-text, #334155);
}

.product-column-selected {
  min-width: 0;
  padding: 14px 12px;
  background: var(--product-panel-muted, #f8fafc);
}

.product-column-selected header {
  display: grid;
  gap: 4px;
  margin-bottom: 10px;
}

.product-column-selected header strong {
  color: var(--product-heading, #334155);
}

.product-column-selected header span {
  font-size: 11px;
  color: var(--product-subtle, #64748b);
}

.product-column-selected-list {
  display: grid;
  gap: 2px;
  max-height: 522px;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  list-style: none;
}

.product-column-selected-list li {
  display: grid;
  grid-template-columns: 18px 28px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  min-height: 30px;
  padding: 4px 6px;
  color: var(--product-text, #334155);
  cursor: grab;
  background: var(--product-panel, #fff);
  border: 1px solid transparent;
}

.product-column-selected-list li:hover {
  border-color: var(--product-border-strong, #cbd5e1);
}

.product-column-drag,
.product-column-order {
  font-size: 11px;
  color: var(--product-muted, #94a3b8);
}

.product-column-selected-list b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-column-selected-list li > div {
  display: flex;
  gap: 6px;
}

.product-column-selected button:disabled {
  color: var(--product-muted, #94a3b8);
  cursor: not-allowed;
}

.product-column-selected button.active {
  font-weight: 700;
  color: #2563eb;
}

.product-column-config-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 12px;
}

.product-detail-card :deep(.ant-table-cell) {
  white-space: nowrap;
}

.product-detail-card :deep(.ant-table) {
  font-size: 12px;
  color: var(--product-text);
  background: var(--product-panel);
  border-color: var(--product-border-strong);
}

.product-detail-card :deep(.ant-table-container),
.product-detail-card :deep(.ant-table-content),
.product-detail-card :deep(.ant-table-body),
.product-detail-card :deep(.ant-table-placeholder),
.product-detail-card :deep(.ant-table-cell-fix-left),
.product-detail-card :deep(.ant-table-cell-fix-right) {
  background: var(--product-panel);
}

.product-detail-card :deep(.ant-table-thead > tr > th) {
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 800;
  color: var(--product-heading);
  text-align: center;
  background: var(--product-panel-muted) !important;
  border-color: var(--product-border-strong) !important;
}

.product-detail-card :deep(.product-basic-group) {
  text-align: center;
}

.product-detail-card :deep(.ant-table-tbody > tr > td) {
  height: 56px;
  padding: 6px 10px;
  vertical-align: middle;
  border-color: var(--product-border-strong) !important;
}

.product-detail-card :deep(.ant-table-tbody > tr:nth-child(2n) > td) {
  background: var(--product-panel-muted);
}

.product-detail-card :deep(.ant-table-tbody > tr:hover > td) {
  background: var(--product-hover) !important;
}

.product-detail-card :deep(.ant-table-thead .ant-table-cell-fix-left) {
  z-index: 4;
  background: var(--product-panel-muted) !important;
}

.product-detail-card :deep(.ant-table-tbody > tr > .ant-table-cell-fix-left) {
  z-index: 3;
  background: var(--product-panel) !important;
}

.product-detail-card
  :deep(.ant-table-tbody > tr:nth-child(2n) > .ant-table-cell-fix-left) {
  background: var(--product-panel-muted) !important;
}

.product-detail-card
  :deep(.ant-table-tbody > tr:hover > .ant-table-cell-fix-left) {
  background: var(--product-hover) !important;
}

.product-detail-card :deep(.ant-table-cell-fix-left-last::after) {
  box-shadow: inset 8px 0 8px -8px rgb(15 23 42 / 18%);
}

.product-row-no {
  font-size: 12px;
  color: var(--product-muted);
}

.product-thumb {
  width: 42px;
  height: 42px;
  object-fit: contain;
  background: #fff;
  border: 1px solid var(--product-border);
  border-radius: 6px;
}

.product-code-text,
.product-code-link {
  font-weight: 700;
  color: #2563eb;
}

.product-code-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.product-metric-cell {
  position: relative;
  min-width: 78px;
  min-height: 34px;
  padding: 3px 6px;
  overflow: hidden;
  text-align: right;
  border-radius: 4px;
}

.product-metric-bar {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 0;
  min-width: 2px;
  opacity: 0.22;
}

.product-metric-content {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 2px;
}

.product-metric-value {
  font-weight: 700;
  color: var(--product-heading);
}

.product-metric-delta {
  font-size: 10px;
}

.metric-good {
  background: rgb(34 197 94 / 12%);
}

.metric-good .product-metric-bar {
  background: #22c55e;
}

.metric-warn {
  background: rgb(245 158 11 / 14%);
}

.metric-warn .product-metric-bar {
  background: #f59e0b;
}

.metric-risk {
  background: rgb(239 68 68 / 12%);
}

.metric-risk .product-metric-bar {
  background: #ef4444;
}

.metric-plain {
  background: transparent;
}

.delta-up {
  color: #16a34a;
}

.delta-down {
  color: #ef4444;
}

.delta-flat {
  color: var(--product-muted);
}

@media (max-width: 1280px) {
  .product-detail-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .product-detail-controls {
    justify-content: flex-start;
  }
}
</style>
