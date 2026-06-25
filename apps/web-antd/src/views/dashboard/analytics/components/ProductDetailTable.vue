<script setup lang="ts">
import type { Spin ,TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  AlertLevel,
  KanbanFbaInventorySkuBreakdown,
  KanbanFbaInventorySkuRow,
  KanbanProductDetailColumn,
  KanbanProductDetailOverview,
  KanbanProductDetailRow,
} from '#/api/kanban';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Dropdown,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Table,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  fetchKanbanProductDetailFbaInventory,
  fetchKanbanProductDetailMeta,
  fetchKanbanProductDetailRows,
} from '#/api/kanban';

type ProductDetailDateRangeType =
  | 'currentMonth'
  | 'custom'
  | 'last7'
  | 'last30'
  | 'lastMonth'
  | 'today'
  | 'year'
  | 'yesterday';

interface BaseProductDetailParams {
  alertLevels?: AlertLevel[];
  categories?: string[];
  countries?: string[];
  dateRangeType?: ProductDetailDateRangeType | string;
  endDate?: string;
  projectTags?: string[];
  responsibles?: string[];
  sites?: string[];
  startDate?: string;
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
const productDetailPageRows = ref<KanbanProductDetailRow[]>([]);
const productDetailSummary = ref<Record<string, any>>({});
const productDetailLoading = ref(false);
const productDetailRowsLoading = ref(false);
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
const productColumnWidths = reactive<Record<string, number>>({});
const resizingProductColumn = ref<null | {
  key: string;
  startWidth: number;
  startX: number;
}>(null);
const productDetailTableRef = ref<any>(null);
const productSummaryScrollRef = ref<HTMLElement | null>(null);
const productDetailMetaInFlight = ref('');
const productDetailRowsInFlight = ref('');
const fbaInventoryCache = reactive<
  Record<string, KanbanFbaInventorySkuBreakdown>
>({});
const fbaInventoryLoadingKey = ref('');
let productTableBodyScrollElement: HTMLElement | null = null;
let productSummaryScrollElement: HTMLElement | null = null;
let productHeaderEventRoot: HTMLElement | null = null;
let productResizeHoverCell: HTMLElement | null = null;
let productScrollSyncing = false;
let productResizeSuppressClickUntil = 0;
let productResizeSuppressSortUntil = 0;
let productResizeMoved = false;
const productDetailSort = reactive<{
  field: string;
  order: '' | 'ascend' | 'descend';
}>({
  field: '',
  order: '',
});
const productDetailPagination = reactive<TablePaginationConfig>({
  current: 1,
  pageSize: 15,
  pageSizeOptions: ['15', '30', '50', '100'],
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条新品详情`,
  onChange: (page, pageSize) => {
    productDetailPagination.current = page;
    productDetailPagination.pageSize = pageSize;
    void loadProductDetailRows();
  },
  onShowSizeChange: (_current, size) => {
    productDetailPagination.current = 1;
    productDetailPagination.pageSize = size;
    void loadProductDetailRows();
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

const productDetailRows = computed(() => productDetailPageRows.value);
const effectiveProductCountries = computed(() => {
  const baseCountries = [...(props.baseParams.countries ?? [])].filter(Boolean);
  if (baseCountries.length === 0) return selectedProductCountries.value;
  if (selectedProductCountries.value.length === 0) return baseCountries;
  const allowed = new Set(baseCountries);
  return selectedProductCountries.value.filter((country) =>
    allowed.has(country),
  );
});
const effectiveProductResponsibles = computed(() => {
  const baseResponsibles = [...(props.baseParams.responsibles ?? [])].filter(
    Boolean,
  );
  const selectedResponsibles = productDetailQuery.responsibles.filter(Boolean);
  if (baseResponsibles.length === 0) return selectedResponsibles;
  if (baseResponsibles.includes('__NO_ACCESS__')) return ['__NO_ACCESS__'];
  if (selectedResponsibles.length === 0) return baseResponsibles;
  const allowed = new Set(baseResponsibles);
  const narrowed = selectedResponsibles.filter((name) => allowed.has(name));
  return narrowed.length > 0 ? narrowed : ['__NO_ACCESS__'];
});
const productDetailColumnDefs = computed(
  () => productDetail.value?.columns ?? [],
);
const defaultPinnedProductColumnCount = 4;
const productCountryOptions = computed(() => {
  const values = new Set<string>(selectedProductCountries.value);
  for (const country of productDetail.value?.countries ?? [])
    values.add(country);
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
  for (const column of productDetailColumnDefs.value)
    map.set(column.key, column);
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
      .filter(
        (column): column is KanbanProductDetailColumn => column !== undefined,
      ),
);
const productColumnGroups = computed(() => {
  const configuredGroups: Array<{
    columns: KanbanProductDetailColumn[];
    key: string;
    title: string;
  }> = [];
  const configuredGroupMap = new Map<
    string,
    (typeof configuredGroups)[number]
  >();
  const groups: Array<{
    columns: KanbanProductDetailColumn[];
    key: string;
    title: string;
  }> = [
    { columns: [], key: 'base', title: '基础信息' },
    { columns: [], key: 'sales', title: '销售' },
    { columns: [], key: 'profit', title: '利润费用' },
    { columns: [], key: 'ad', title: '广告' },
    { columns: [], key: 'performance', title: '表现' },
    { columns: [], key: 'inventory', title: '库存' },
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
    if (column.group?.trim()) {
      const title = column.group.trim();
      const key = `xlsx:${title}`;
      let group = configuredGroupMap.get(key);
      if (!group) {
        group = { columns: [], key, title };
        configuredGroups.push(group);
        configuredGroupMap.set(key, group);
      }
      group.columns.push(column);
      continue;
    }
    (groupMap.get(groupKey) ?? groupMap.get('other'))?.columns.push(column);
  }
  return [
    ...groups.filter((group) => group.columns.length > 0),
    ...configuredGroups.filter((group) => group.columns.length > 0),
  ];
});
const productColumnGroupTitles: Record<string, string> = {
  ad: '广告',
  base: '基础信息',
  inventory: '库存',
  performance: '表现',
  profit: '利润费用',
  sales: '销售',
};
const productColumnTableGroupOrder = [
  'base',
  'sales',
  'profit',
  'ad',
  'performance',
  'inventory',
  'other',
] as const;
const productBasicInfoLabels = new Set([
  'SPU',
  '一级类目',
  '上线天数',
  '主图',
  '二级分类',
  '创建时间',
  '店铺',
  '开售时间',
  '父ASIN',
  '等级',
  '运营负责人',
  '销售均价',
]);
const productDisplayColumns = computed(() =>
  productVisibleColumns.value.some((column) => column.group?.trim())
    ? productVisibleColumns.value
    : sortProductColumnsByTableGroup(productVisibleColumns.value),
);
const productVisibleColumnsTotalWidth = computed(() => {
  let total = 0;
  for (const column of productDisplayColumns.value) {
    total += productColumnDisplayWidth(column);
  }
  return total;
});
const productDetailColumns = computed<TableColumnsType<Record<string, any>>>(
  () => {
    const fixedKeys = new Set(pinnedProductColumnKeys.value);
    const groups: Array<{
      children: TableColumnsType<Record<string, any>>;
      fixed: boolean;
      groupKey: string;
      key: string;
      title: string;
    }> = [];
    for (const column of productDisplayColumns.value) {
      const groupKey = productColumnTableGroupKey(column);
      const title = productColumnTableGroupTitle(column, groupKey);
      const fixed = fixedKeys.has(column.key);
      const segmentKey = `${groupKey}:${fixed ? 'fixed' : 'scroll'}`;
      const current = groups.at(-1);
      if (current?.key === segmentKey) {
        current.children.push(buildProductDetailColumn(column, fixed));
        continue;
      }
      groups.push({
        children: [buildProductDetailColumn(column, fixed)],
        fixed,
        groupKey,
        key: segmentKey,
        title,
      });
    }
    return groups.map((group, index) => ({
      align: 'center',
      children: group.children,
      className: `product-detail-group product-detail-group-${group.groupKey}`,
      fixed: group.fixed ? ('left' as const) : undefined,
      key: `group-${group.key}-${index}`,
      title: group.title,
    }));
  },
);
const productDetailScrollX = computed(() =>
  Math.max(1320, productVisibleColumnsTotalWidth.value),
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
const productDetailBaseParamsSignature = computed(() =>
  productDetailParamsSignature(props.baseParams),
);

function resetProductDetailPagination() {
  productDetailPagination.current = 1;
}

function normalizeProductParamValues(values?: string[]) {
  return [...(values ?? [])].filter(Boolean).toSorted();
}

function productDetailParamsSignature(params?: BaseProductDetailParams) {
  return JSON.stringify({
    alertLevels: normalizeProductParamValues(params?.alertLevels),
    categories: normalizeProductParamValues(params?.categories),
    countries: normalizeProductParamValues(params?.countries),
    dateRangeType: params?.dateRangeType ?? '',
    endDate: params?.endDate ?? '',
    projectTags: normalizeProductParamValues(params?.projectTags),
    responsibles: normalizeProductParamValues(params?.responsibles),
    sites: normalizeProductParamValues(params?.sites),
    startDate: params?.startDate ?? '',
    statuses: normalizeProductParamValues(params?.statuses),
  });
}

function syncProductDetailDateFromBaseParams() {
  const startDate = props.baseParams.startDate;
  const endDate = props.baseParams.endDate;
  if (!startDate || !endDate) return;
  productDetailQuery.dateRangeType =
    (props.baseParams.dateRangeType as ProductDetailDateRangeType) || 'custom';
  productDetailQuery.startDate = startDate;
  productDetailQuery.endDate = endDate;
}

function syncProductDetailResponsiblesWithOptions() {
  const allowed = new Set(props.responsibleOptions);
  if (allowed.size === 0) {
    productDetailQuery.responsibles = [];
    return;
  }
  productDetailQuery.responsibles = productDetailQuery.responsibles.filter(
    (name) => allowed.has(name),
  );
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
    productDetailQuery.startDate = yesterday
      .subtract(6, 'day')
      .format('YYYY-MM-DD');
    return;
  }
  if (value === 'last30') {
    productDetailQuery.endDate = yesterday.format('YYYY-MM-DD');
    productDetailQuery.startDate = yesterday
      .subtract(29, 'day')
      .format('YYYY-MM-DD');
    return;
  }
  if (value === 'currentMonth') {
    productDetailQuery.startDate = today.startOf('month').format('YYYY-MM-DD');
    productDetailQuery.endDate = yesterday.format('YYYY-MM-DD');
    return;
  }
  if (value === 'lastMonth') {
    const lastMonth = today.subtract(1, 'month');
    productDetailQuery.startDate = lastMonth
      .startOf('month')
      .format('YYYY-MM-DD');
    productDetailQuery.endDate = lastMonth.endOf('month').format('YYYY-MM-DD');
    return;
  }
  productDetailQuery.startDate = today.startOf('year').format('YYYY-MM-DD');
  productDetailQuery.endDate = yesterday.format('YYYY-MM-DD');
}

async function loadProductDetailData() {
  const metaRequestKey = JSON.stringify(productDetailRequestParams());
  if (productDetailMetaInFlight.value === metaRequestKey) {
    return;
  }
  productDetailMetaInFlight.value = metaRequestKey;
  productDetailLoading.value = true;
  try {
    const detailMeta = await fetchKanbanProductDetailMeta({
      ...props.baseParams,
      countries: effectiveProductCountries.value,
      dateRangeType: productDetailQuery.dateRangeType,
      endDate: productDetailQuery.endDate,
      responsibles: effectiveProductResponsibles.value,
      startDate: productDetailQuery.startDate,
    });
    productDetailPagination.total = detailMeta.totalRows;
    productDetail.value = {
      ...detailMeta,
      page: productDetailPagination.current ?? 1,
      pageSize: productDetailPagination.pageSize ?? 15,
      rows: [],
      summary: productDetailSummary.value,
    };
    ensureProductColumnsInitialized(productDetail.value);
    const availableKeys = new Set(
      detailMeta.columns.map((column) => column.key),
    );
    selectedProductColumns.value = selectedProductColumns.value.filter((key) =>
      availableKeys.has(key),
    );
    pinnedProductColumnKeys.value = pinnedProductColumnKeys.value.filter(
      (key) =>
        availableKeys.has(key) && selectedProductColumns.value.includes(key),
    );
    await loadProductDetailRows();
  } finally {
    if (productDetailMetaInFlight.value === metaRequestKey)
      productDetailMetaInFlight.value = '';
    productDetailLoading.value = false;
  }
}

function productDetailRequestParams() {
  return {
    ...props.baseParams,
    countries: effectiveProductCountries.value,
    dateRangeType: productDetailQuery.dateRangeType,
    endDate: productDetailQuery.endDate,
    responsibles: effectiveProductResponsibles.value,
    startDate: productDetailQuery.startDate,
  };
}

async function loadProductDetailRows() {
  const rowsRequestKey = JSON.stringify({
    ...productDetailRequestParams(),
    page: productDetailPagination.current ?? 1,
    pageSize: productDetailPagination.pageSize ?? 15,
    sortField: productDetailSort.field || undefined,
    sortOrder: productDetailSort.order || undefined,
  });
  if (productDetailRowsInFlight.value === rowsRequestKey) {
    return;
  }
  productDetailRowsInFlight.value = rowsRequestKey;
  productDetailRowsLoading.value = true;
  try {
    const rowsResult = await fetchKanbanProductDetailRows({
      ...productDetailRequestParams(),
      page: productDetailPagination.current ?? 1,
      pageSize: productDetailPagination.pageSize ?? 15,
      sortField: productDetailSort.field || undefined,
      sortOrder: productDetailSort.order || undefined,
    });
    productDetailPageRows.value = rowsResult.rows;
    productDetailSummary.value = rowsResult.summary ?? {};
    productDetailPagination.current = rowsResult.page;
    productDetailPagination.pageSize = rowsResult.pageSize;
    productDetailPagination.total = rowsResult.totalRows;
    if (productDetail.value) {
      productDetail.value = {
        ...productDetail.value,
        page: rowsResult.page,
        pageSize: rowsResult.pageSize,
        query: rowsResult.query,
        rows: rowsResult.rows,
        summary: rowsResult.summary ?? {},
        totalRows: rowsResult.totalRows,
      };
    }
    void refreshProductScrollSync();
  } finally {
    if (productDetailRowsInFlight.value === rowsRequestKey)
      productDetailRowsInFlight.value = '';
    productDetailRowsLoading.value = false;
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
  pinnedProductColumnKeys.value = defaultPinnedProductColumnKeys(
    selectedProductColumns.value,
  );
  productColumnsInitialized.value = true;
}

function defaultPinnedProductColumnKeys(keys: string[]) {
  return keys
    .filter((key) => productColumnMap.value.has(key))
    .slice(0, defaultPinnedProductColumnCount);
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
  if (productDetail.value) void loadProductDetailRows();
}

function resetProductColumns() {
  selectedProductColumns.value = productDetailColumnDefs.value
    .filter((column) => column.defaultVisible)
    .map((column) => column.key);
  pinnedProductColumnKeys.value = defaultPinnedProductColumnKeys(
    selectedProductColumns.value,
  );
  if (productColumnConfigOpen.value) {
    productColumnDraft.value = [...selectedProductColumns.value];
  }
  resetProductDetailPagination();
  if (productDetail.value) void loadProductDetailRows();
}

function buildProductDetailColumn(
  column: KanbanProductDetailColumn,
  fixed: boolean,
) {
  return {
    align: 'center' as const,
    className: `product-detail-column product-detail-column-${column.kind}`,
    dataIndex: column.key,
    ellipsis: column.kind !== 'image',
    fixed: fixed ? ('left' as const) : undefined,
    key: column.key,
    sorter: true,
    sortOrder:
      productDetailSort.field === column.key && productDetailSort.order
        ? productDetailSort.order
        : undefined,
    title: column.label,
    width: productColumnDisplayWidth(column),
  };
}

function handleProductDetailTableChange(
  _pagination: unknown,
  _filters: unknown,
  sorter: unknown,
) {
  if (Date.now() <= productResizeSuppressSortUntil) return;
  const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  const item = (activeSorter ?? {}) as {
    columnKey?: string;
    field?: string;
    order?: 'ascend' | 'descend' | null;
  };
  const nextOrder =
    item.order === 'ascend' || item.order === 'descend' ? item.order : '';
  const nextField = nextOrder ? String(item.field ?? item.columnKey ?? '') : '';
  if (
    productDetailSort.field === nextField &&
    productDetailSort.order === nextOrder
  ) {
    return;
  }
  productDetailSort.field = nextField;
  productDetailSort.order = nextOrder;
  resetProductDetailPagination();
  void loadProductDetailRows();
}

function productColumnWidth(column: KanbanProductDetailColumn) {
  if (column.kind === 'image') return 72;
  if (column.label === 'SPU') return 136;
  if (column.label === '运营负责人') return 104;
  if (column.label.includes('ASIN')) return 126;
  if (column.label.includes('类目') || column.label.includes('分类'))
    return 112;
  if (column.label.includes('库存')) return 96;
  if (column.label.includes('占比') || column.label.includes('完成率'))
    return 126;
  if (column.label.length <= 3) return 88;
  return Math.max(98, Math.min(column.label.length * 15 + 36, 156));
}

function normalizeProductColumnWidth(value: number | string | undefined) {
  const width = Number(value || 0);
  if (!Number.isFinite(width) || width <= 0) return 98;
  return Math.min(Math.max(Math.round(width), 56), 360);
}

function productColumnDisplayWidth(column: KanbanProductDetailColumn) {
  return normalizeProductColumnWidth(
    productColumnWidths[column.key] ?? productColumnWidth(column),
  );
}

function productColumnResizeKey(column: unknown) {
  if (!column || typeof column !== 'object') return '';
  const item = column as {
    children?: unknown;
    dataIndex?: unknown;
    key?: unknown;
  };
  if (Array.isArray(item.children)) return '';
  const key = item.dataIndex ?? item.key;
  return key ? String(key) : '';
}

function isProductNumberColumn(column: unknown) {
  const key = productColumnResizeKey(column);
  if (!key) return false;
  const kind = productColumnKind(key);
  return kind !== 'image' && kind !== 'text';
}

function startProductColumnResize(key: string, event: MouseEvent) {
  if (!key) return;
  event.preventDefault();
  event.stopPropagation();
  const column = productColumnMap.value.get(key);
  resizingProductColumn.value = {
    key,
    startWidth: normalizeProductColumnWidth(
      productColumnWidths[key] ?? (column ? productColumnWidth(column) : 98),
    ),
    startX: event.clientX,
  };
  productResizeMoved = false;
  productResizeSuppressClickUntil = Date.now() + 500;
  productResizeSuppressSortUntil = Date.now() + 500;
  document.body.classList.add('product-column-resizing');
  window.addEventListener('mousemove', handleProductColumnResizeMove);
  window.addEventListener('mouseup', stopProductColumnResize);
}

function productResizableHeaderCells(row: HTMLElement | null) {
  return [
    ...(row?.querySelectorAll<HTMLTableCellElement>(
      'th:not([colspan]), th[colspan="1"]',
    ) ?? []),
  ].filter((item) => item.querySelector('.product-resizable-header'));
}

function productColumnKeyFromHeaderCell(th: HTMLTableCellElement) {
  const handle = th.querySelector<HTMLElement>('.product-column-resize-handle');
  const handleKey = handle?.dataset.columnKey;
  if (handleKey) return handleKey;
  const leafHeaders = productResizableHeaderCells(th.parentElement);
  const index = leafHeaders.indexOf(th);
  return productDisplayColumns.value[index]?.key ?? '';
}

function productResizeHit(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const th = target?.closest<HTMLTableCellElement>('th');
  if (!th || !productDetailTableRoot()?.contains(th)) return;
  if (!th.querySelector('.product-resizable-header')) return;
  const rect = th.getBoundingClientRect();
  const resizeHotZone = 8;
  if (Math.abs(rect.right - event.clientX) <= resizeHotZone) {
    const key = productColumnKeyFromHeaderCell(th);
    return key ? { hoverTh: th, key, resizeTh: th } : undefined;
  }
  if (Math.abs(event.clientX - rect.left) <= resizeHotZone) {
    const leafHeaders = productResizableHeaderCells(th.parentElement);
    const index = leafHeaders.indexOf(th);
    const previous = index > 0 ? leafHeaders[index - 1] : null;
    if (previous) {
      const key = productColumnKeyFromHeaderCell(previous);
      return key ? { hoverTh: th, key, resizeTh: previous } : undefined;
    }
  }
}

function setProductResizeHoverCell(th: HTMLElement | null) {
  if (productResizeHoverCell === th) return;
  productResizeHoverCell?.classList.remove('product-header-resize-hover');
  productResizeHoverCell = th;
  productResizeHoverCell?.classList.add('product-header-resize-hover');
}

function handleProductHeaderMouseMove(event: MouseEvent) {
  const hit = productResizeHit(event);
  setProductResizeHoverCell(hit?.hoverTh ?? null);
}

function handleProductHeaderMouseLeave() {
  setProductResizeHoverCell(null);
}

function handleProductHeaderMouseDownCapture(event: MouseEvent) {
  if (event.button !== 0) return;
  const hit = productResizeHit(event);
  if (!hit) return;
  const key = hit.key;
  if (!key) return;
  startProductColumnResize(key, event);
}

function handleProductHeaderClickCapture(event: MouseEvent) {
  if (Date.now() > productResizeSuppressClickUntil) return;
  event.preventDefault();
  event.stopPropagation();
}

function handleProductColumnResizeMove(event: MouseEvent) {
  const state = resizingProductColumn.value;
  if (!state) return;
  if (Math.abs(event.clientX - state.startX) >= 3) {
    productResizeMoved = true;
    productResizeSuppressClickUntil = Date.now() + 1000;
    productResizeSuppressSortUntil = Date.now() + 1000;
  }
  productColumnWidths[state.key] = normalizeProductColumnWidth(
    state.startWidth + event.clientX - state.startX,
  );
}

function stopProductColumnResize() {
  if (productResizeMoved) {
    productResizeSuppressClickUntil = Date.now() + 1000;
    productResizeSuppressSortUntil = Date.now() + 1000;
  }
  resizingProductColumn.value = null;
  productResizeMoved = false;
  document.body.classList.remove('product-column-resizing');
  window.removeEventListener('mousemove', handleProductColumnResizeMove);
  window.removeEventListener('mouseup', stopProductColumnResize);
}

function productDetailTableRoot() {
  const table = productDetailTableRef.value;
  const root = table?.$el ?? table;
  return root instanceof HTMLElement ? root : null;
}

function productDetailTableBodyScroll() {
  return productDetailTableRoot()?.querySelector(
    '.ant-table-body',
  ) as HTMLElement | null;
}

function syncProductScrollLeft(
  source: HTMLElement,
  target: HTMLElement | null,
) {
  if (!target || Math.abs(target.scrollLeft - source.scrollLeft) < 1) return;
  productScrollSyncing = true;
  target.scrollLeft = source.scrollLeft;
  window.requestAnimationFrame(() => {
    productScrollSyncing = false;
  });
}

function handleProductTableBodyScroll(event: Event) {
  if (productScrollSyncing) return;
  syncProductScrollLeft(
    event.currentTarget as HTMLElement,
    productSummaryScrollElement,
  );
}

function handleProductSummaryScroll(event: Event) {
  if (productScrollSyncing) return;
  syncProductScrollLeft(
    event.currentTarget as HTMLElement,
    productTableBodyScrollElement,
  );
}

function bindProductScrollSync() {
  const tableBody = productDetailTableBodyScroll();
  const summaryScroll = productSummaryScrollRef.value;

  if (productTableBodyScrollElement !== tableBody) {
    productTableBodyScrollElement?.removeEventListener(
      'scroll',
      handleProductTableBodyScroll,
    );
    productTableBodyScrollElement = tableBody;
    productTableBodyScrollElement?.addEventListener(
      'scroll',
      handleProductTableBodyScroll,
      { passive: true },
    );
  }

  if (productSummaryScrollElement !== summaryScroll) {
    productSummaryScrollElement?.removeEventListener(
      'scroll',
      handleProductSummaryScroll,
    );
    productSummaryScrollElement = summaryScroll;
    productSummaryScrollElement?.addEventListener(
      'scroll',
      handleProductSummaryScroll,
      { passive: true },
    );
  }

  if (productTableBodyScrollElement && productSummaryScrollElement) {
    productSummaryScrollElement.scrollLeft =
      productTableBodyScrollElement.scrollLeft;
  }
}

function unbindProductScrollSync() {
  productTableBodyScrollElement?.removeEventListener(
    'scroll',
    handleProductTableBodyScroll,
  );
  productSummaryScrollElement?.removeEventListener(
    'scroll',
    handleProductSummaryScroll,
  );
  productHeaderEventRoot?.removeEventListener(
    'mousemove',
    handleProductHeaderMouseMove,
    true,
  );
  productHeaderEventRoot?.removeEventListener(
    'mouseleave',
    handleProductHeaderMouseLeave,
    true,
  );
  productHeaderEventRoot?.removeEventListener(
    'mousedown',
    handleProductHeaderMouseDownCapture,
    true,
  );
  productHeaderEventRoot?.removeEventListener(
    'click',
    handleProductHeaderClickCapture,
    true,
  );
  setProductResizeHoverCell(null);
  productTableBodyScrollElement = null;
  productSummaryScrollElement = null;
  productHeaderEventRoot = null;
}

async function refreshProductScrollSync() {
  await nextTick();
  bindProductScrollSync();
  const root = productDetailTableRoot();
  if (productHeaderEventRoot === root) return;
  unbindProductScrollSync();
  bindProductScrollSync();
  productHeaderEventRoot = root;
  productHeaderEventRoot?.addEventListener(
    'mousemove',
    handleProductHeaderMouseMove,
    true,
  );
  productHeaderEventRoot?.addEventListener(
    'mouseleave',
    handleProductHeaderMouseLeave,
    true,
  );
  productHeaderEventRoot?.addEventListener(
    'mousedown',
    handleProductHeaderMouseDownCapture,
    true,
  );
  productHeaderEventRoot?.addEventListener(
    'click',
    handleProductHeaderClickCapture,
    true,
  );
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
  if (column.group?.trim()) return `xlsx:${column.group.trim()}`;
  const label = column.label;
  const source = column.source.toLowerCase();
  if (productBasicInfoLabels.has(label.trim())) return 'base';
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
    ].some((flag) => label.includes(flag))
  ) {
    return 'base';
  }
  if (
    ['上线天数', '评分', '评论', '星级', '访客', '浏览', '会话', '转化'].some(
      (flag) => label.includes(flag),
    )
  ) {
    return 'performance';
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
  if (['库存', 'FBA', '价格'].some((flag) => label.includes(flag))) {
    return 'inventory';
  }
  if (
    ['利润', '毛利', '退款', '退货', '结算'].some((flag) =>
      label.includes(flag),
    )
  ) {
    return 'profit';
  }
  if (
    ['销量', '销售', '订单', '目标', '完成率', '自然'].some((flag) =>
      label.includes(flag),
    )
  ) {
    return 'sales';
  }
  return 'other';
}

function productColumnTableGroupKey(column: KanbanProductDetailColumn) {
  if (column.group?.trim()) return `xlsx:${column.group.trim()}`;
  const groupKey = productColumnGroupKey(column);
  if (groupKey === 'other') return 'performance';
  return groupKey;
}

function productColumnTableGroupTitle(
  column: KanbanProductDetailColumn,
  groupKey: string,
) {
  return column.group?.trim() || productColumnGroupTitles[groupKey] || '其他';
}

function sortProductColumnsByTableGroup(columns: KanbanProductDetailColumn[]) {
  const order = new Map<string, number>(
    productColumnTableGroupOrder.map((groupKey, index) => [groupKey, index]),
  );
  return [...columns].toSorted((left, right) => {
    const leftOrder = order.get(productColumnTableGroupKey(left)) ?? 999;
    const rightOrder = order.get(productColumnTableGroupKey(right)) ?? 999;
    return leftOrder - rightOrder;
  });
}

function isProductMetricKind(kind: string) {
  return kind === 'number' || kind === 'percent' || kind === 'decimal';
}

function isProductMetricColumn(key: string) {
  return isProductMetricKind(productColumnKind(key));
}

const fbaInventoryColumnLabels = new Set([
  'FBA可售',
  'FBA在途',
  'FBA库存',
  'FBA调仓中',
  '总库存',
]);

function isFbaInventoryColumn(key: string) {
  const label = productColumnLabel(key).trim();
  return (
    fbaInventoryColumnLabels.has(label) || fbaInventoryColumnLabels.has(key)
  );
}

function productRowTextByLabels(record: Record<string, any>, labels: string[]) {
  for (const column of productDetailColumnDefs.value) {
    if (!labels.includes(column.label)) continue;
    const value = productMetricRawValue(record[column.key]);
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function productRowSpu(record: Record<string, any>) {
  return (
    String(
      productMetricRawValue(record.SPU ?? record.spu ?? '') || '',
    ).trim() || productRowTextByLabels(record, ['SPU'])
  );
}

function productRowSite(record: Record<string, any>) {
  return (
    String(productMetricRawValue(record.site ?? record['站点'] ?? '') || '')
      .trim()
      .toUpperCase() || productRowTextByLabels(record, ['站点']).toUpperCase()
  );
}

function fbaInventoryKey(spu: string, site: string) {
  return `${String(spu || '')
    .trim()
    .toUpperCase()}__${String(site || '')
    .trim()
    .toUpperCase()}`;
}

function fbaInventoryFor(record: Record<string, any>) {
  return fbaInventoryCache[
    fbaInventoryKey(productRowSpu(record), productRowSite(record))
  ];
}

function fbaInventoryRows(
  record: Record<string, any>,
): KanbanFbaInventorySkuRow[] {
  const detail = fbaInventoryFor(record);
  if (!detail) return [];
  return [...detail.rows, detail.summary];
}

function isFbaInventoryLoading(record: Record<string, any>) {
  return (
    fbaInventoryLoadingKey.value ===
    fbaInventoryKey(productRowSpu(record), productRowSite(record))
  );
}

async function loadFbaInventory(record: Record<string, any>) {
  const spu = productRowSpu(record);
  const site = productRowSite(record);
  const key = fbaInventoryKey(spu, site);
  if (
    !spu ||
    !site ||
    fbaInventoryCache[key] ||
    fbaInventoryLoadingKey.value === key
  ) {
    return;
  }
  fbaInventoryLoadingKey.value = key;
  try {
    fbaInventoryCache[key] = await fetchKanbanProductDetailFbaInventory({
      site,
      spu,
    });
  } finally {
    if (fbaInventoryLoadingKey.value === key) {
      fbaInventoryLoadingKey.value = '';
    }
  }
}

function handleFbaInventoryOpen(open: boolean, record: Record<string, any>) {
  if (open) void loadFbaInventory(record);
}

function formatInventoryQty(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  });
}

function isProductMetricCell(value: any) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, 'value'),
  );
}

interface ProductMetricFillInfo {
  full: boolean;
  tone: 'blue' | 'green' | 'orange' | 'red';
  width: string;
}

function productMetricRawValue(value: any) {
  return isProductMetricCell(value) ? value.value : value;
}

function productMetricNumber(value: any) {
  const numeric = Number(productMetricRawValue(value));
  return Number.isFinite(numeric) ? numeric : null;
}

function productMetricDeltaClass(value: any) {
  if (!isProductMetricCell(value)) return '';
  const delta = Number(value.delta || 0);
  if (delta > 0) return 'delta-up';
  if (delta < 0) return 'delta-down';
  return 'delta-flat';
}

function isLaunchDaysColumn(key: string) {
  return productColumnLabel(key).includes('上线天数');
}

function launchDaysDotSize(value: any) {
  const days = Math.max(0, Number(productMetricRawValue(value) || 0));
  return `${Math.min(16, Math.max(6, 6 + days / 12))}px`;
}

function findProductRowNumber(
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

function productRowNumberByLabels(
  record: Record<string, any>,
  labels: string[],
) {
  return findProductRowNumber(record, (label) => labels.includes(label));
}

function productPositiveRatio(
  numerator: null | number,
  denominator: null | number,
) {
  if (numerator === null || denominator === null || denominator <= 0)
    return null;
  return Math.max(0, numerator / denominator);
}

function productMetricFillInfo(
  key: string,
  record: Record<string, any>,
  value: any,
): null | ProductMetricFillInfo {
  const label = productColumnLabel(key).trim();
  const numeric = productMetricNumber(value);
  if (numeric === null) return null;

  if (label === '销量完成率') {
    let tone: 'blue' | 'green' | 'orange' | 'red' = 'red';

    if (numeric > 1.2) {
      tone = 'blue';
    } else if (numeric > 1) {
      tone = 'green';
    } else if (numeric > 0.8) {
      tone = 'orange';
    }
    return { full: true, tone, width: '100%' };
  }

  const salesQty = productRowNumberByLabels(record, ['销量', '总销量']);
  const targetUnits = productRowNumberByLabels(record, ['目标销量']);
  if (label === '销量' || label === '目标销量') {
    const ratio = productPositiveRatio(salesQty, targetUnits);
    if (ratio === null) return null;
    return {
      full: false,
      tone: label === '目标销量' ? 'blue' : 'green',
      width: productMetricFillWidth(ratio),
    };
  }

  if (['广告直接订单', '广告订单', '自然订单'].includes(label)) {
    const ratio = productPositiveRatio(numeric, salesQty);
    if (ratio === null) return null;
    return { full: false, tone: 'green', width: productMetricFillWidth(ratio) };
  }

  if (['广告直接订单占比', '广告订单占比'].includes(label)) {
    return { full: false, tone: 'red', width: productMetricFillWidth(numeric) };
  }

  if (isProductMoneyColumn(key)) {
    const salesAmount = productRowNumberByLabels(record, [
      '销售额',
      '总销售额',
    ]);
    const ratio = productPositiveRatio(Math.abs(numeric), salesAmount);
    if (ratio === null) return null;
    return {
      full: false,
      tone: productMoneyFillTone(label, numeric),
      width: productMetricFillWidth(ratio),
    };
  }

  return null;
}

function productMetricFillWidth(ratio: number) {
  return `${Math.min(100, Math.max(0, ratio * 100))}%`;
}

function productMoneyFillTone(label: string, value: number) {
  if (
    value < 0 ||
    ['花费', '退款', '退货', '运费', '差异分摊'].some((flag) =>
      label.includes(flag),
    )
  ) {
    return 'red';
  }
  return 'green';
}

function productMetricFillCellClass(
  key: string,
  record: Record<string, any>,
  value: any,
) {
  const info = productMetricFillInfo(key, record, value);
  if (!info) return '';
  return info.full ? 'has-metric-fill metric-fill-full' : 'has-metric-fill';
}

function productMetricFillStyle(
  key: string,
  record: Record<string, any>,
  value: any,
) {
  const info = productMetricFillInfo(key, record, value);
  return { width: info?.width ?? '0%' };
}

function productMetricFillToneClass(
  key: string,
  record: Record<string, any>,
  value: any,
) {
  const info = productMetricFillInfo(key, record, value);
  return info ? `metric-fill-${info.tone}` : '';
}

function productCurrencySymbol(record?: Record<string, any>) {
  const code = String(record?.currencyCode || '')
    .trim()
    .toUpperCase();
  const symbol = String(record?.currencySymbol || '').trim();
  if (code === 'AED' || /[\u0600-\u06FF]/.test(symbol)) return 'AED ';
  return symbol || code;
}

function productMetricDeltaText(
  value: any,
  kind: string,
  key = '',
  record?: Record<string, any>,
) {
  if (
    !isProductMetricCell(value) ||
    value.delta === null ||
    value.delta === undefined
  )
    return '';
  const delta = Number(value.delta || 0);
  if (!Number.isFinite(delta) || delta === 0) return '';
  if (kind === 'percent' || isProductPercentColumn(key))
    return `${delta > 0 ? '+' : ''}${formatCompactNumber(delta * 100)}pp`;
  const rate = Number(value.deltaRate);
  const deltaText = formatSignedMetricDelta(
    delta,
    isProductMoneyColumn(key) ? productCurrencySymbol(record) : '',
  );
  if (Number.isFinite(rate) && Math.abs(rate) > 0) {
    return `${deltaText} / ${formatPercent(rate)}`;
  }
  return deltaText;
}

function formatSignedMetricDelta(value: number, symbol = '') {
  const sign = value > 0 ? '+' : (value < 0 ? '-' : '');
  return `${sign}${symbol}${formatCompactNumber(Math.abs(value))}`;
}

function productTextClass(key: string) {
  const label = productColumnLabel(key);
  return label.includes('ASIN') || label === 'SPU' ? 'product-code-text' : '';
}

function isProductMoneyColumn(key: string) {
  const label = productColumnLabel(key);
  if (isProductPercentColumn(key)) return false;
  return [
    '金额',
    '均价',
    '毛利',
    '利润',
    '花费',
    '退款',
    '运费',
    '销售额',
    '净销售额',
  ].some((flag) => label.includes(flag));
}

function isProductPercentColumn(key: string) {
  const label = productColumnLabel(key).toUpperCase();
  return (
    ['率', '占比', '完成率'].some((flag) => label.includes(flag)) ||
    ['ACOS', 'ACOAS', 'TACOS', 'ROAS', 'ROI', 'CVR', 'CTR'].some((flag) =>
      label.includes(flag),
    )
  );
}

function formatProductDetailValue(
  value: any,
  kind: string,
  key = '',
  record?: Record<string, any>,
) {
  const rawValue = productMetricRawValue(value);
  if (rawValue === null || rawValue === undefined || rawValue === '')
    return '-';
  if (kind === 'percent' || isProductPercentColumn(key)) {
    return formatPercent(Number(rawValue || 0), 0);
  }
  if (isProductMoneyColumn(key)) {
    return formatProductMoney(
      rawValue,
      productMoneyFractionDigits(key),
      productCurrencySymbol(record),
    );
  }
  if (kind === 'decimal') return formatCompactNumber(rawValue, 2);
  if (kind === 'number') return formatCompactNumber(rawValue, 0);
  return String(rawValue);
}

function productMoneyFractionDigits(key: string) {
  const label = productColumnLabel(key);
  return label === 'CPC' || label.includes('均价') ? 2 : 0;
}

function formatProductMoney(value: any, fractionDigits = 0, symbol = '') {
  const numeric = parseProductNumber(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${symbol}${numeric.toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })}`;
}

function parseProductNumber(value: any) {
  const rawValue = productMetricRawValue(value);
  if (typeof rawValue === 'number') return rawValue;
  if (rawValue === null || rawValue === undefined || rawValue === '') return 0;
  const normalized = String(rawValue)
    .replaceAll(/[,\s]/g, '')
    .replaceAll(/[^\d.+-]/g, '');
  return Number(normalized || 0);
}

function productDetailSummaryValue(
  column: KanbanProductDetailColumn,
  index: number,
) {
  if (index === 0) return '合计';
  if (
    !productDetailSummary.value ||
    Object.keys(productDetailSummary.value).length === 0
  )
    return '';
  return formatProductDetailValue(
    productDetailSummary.value[column.key],
    column.kind,
    column.key,
    productDetailSummary.value,
  );
}

function productDetailSummaryCellClass(
  column: KanbanProductDetailColumn,
  index: number,
) {
  return {
    'product-summary-label': index === 0,
    'product-summary-number': column.kind !== 'text' && column.kind !== 'image',
  };
}

function formatCompactNumber(value: any, fractionDigits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '-';
  return numeric.toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatPercent(value: number, fractionDigits = 1) {
  return `${formatCompactNumber(Number(value || 0) * 100, fractionDigits)}%`;
}

watch(selectedProductColumns, () => {
  resetProductDetailPagination();
  void refreshProductScrollSync();
});

watch(productDetailBaseParamsSignature, () => {
  syncProductDetailDateFromBaseParams();
  syncProductDetailResponsiblesWithOptions();
  selectedProductCountries.value = [];
  productCountryDraft.value = [];
  void applyProductDetailFilters();
});

watch(
  () => props.responsibleOptions.join('|'),
  () => {
    syncProductDetailResponsiblesWithOptions();
  },
);

onMounted(() => {
  syncProductDetailDateFromBaseParams();
  syncProductDetailResponsiblesWithOptions();
  void loadProductDetailData();
  void refreshProductScrollSync();
});

onBeforeUnmount(() => {
  stopProductColumnResize();
  unbindProductScrollSync();
});
</script>

<template>
  <Card class="product-detail-card" :body-style="{ padding: 0 }">
    <template #title>
      <div class="product-detail-toolbar">
        <div class="product-detail-heading">
          <span class="product-title-dot"></span>
          <strong>2026年新品详情表</strong>
        </div>
        <Space class="product-detail-controls" wrap>
          <span class="product-detail-meta">
            {{
              productDetailDateRangeLabel(productDetail?.query.dateRangeType)
            }}：{{ productDetail?.query.startDate }} ~
            {{ productDetail?.query.endDate }}
          </span>
          <span class="product-detail-meta">
            共 {{ productDetail?.totalRows ?? productDetailRows.length }} 条
          </span>
          <label class="product-detail-label">时间</label>
          <Select
            v-model:value="productDetailQuery.dateRangeType"
            :options="productDetailDateRangeOptions"
            size="small"
            style="width: 104px"
            @change="
              () => {
                applyProductDetailDateRangeType(
                  productDetailQuery.dateRangeType,
                );
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
                  <Button
                    size="small"
                    type="primary"
                    @click="applyProductCountryFilter"
                  >
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
            :loading="productDetailLoading || productDetailRowsLoading"
            @click="applyProductDetailFilters"
          >
            应用
          </Button>
        </Space>
      </div>
    </template>

    <Table
      ref="productDetailTableRef"
      :columns="productDetailColumns"
      :data-source="productDetailRows"
      :bordered="true"
      :loading="productDetailLoading || productDetailRowsLoading"
      :pagination="productDetailPagination"
      :row-key="productDetailRowKey"
      :scroll="{ x: productDetailScrollX, y: 560 }"
      size="small"
      sticky
      @change="handleProductDetailTableChange"
    >
      <template #headerCell="{ column }">
        <div
          class="product-resizable-header"
          :class="{ numeric: isProductNumberColumn(column) }"
        >
          <span>{{ column.title }}</span>
          <button
            v-if="productColumnResizeKey(column)"
            aria-label="Resize column"
            class="product-column-resize-handle"
            :data-column-key="productColumnResizeKey(column)"
            type="button"
            @click.stop
            @pointerdown.stop
            @mousedown="
              (event) =>
                startProductColumnResize(productColumnResizeKey(column), event)
            "
          ></button>
        </div>
      </template>
      <template #bodyCell="{ column, record, text }">
        <template
          v-if="productColumnKind(String(column.dataIndex)) === 'image'"
        >
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
            v-if="isLaunchDaysColumn(String(column.dataIndex))"
            class="product-launch-days"
          >
            <b>
              {{
                formatProductDetailValue(
                  text,
                  productColumnKind(String(column.dataIndex)),
                  String(column.dataIndex),
                  record,
                )
              }}
            </b>
            <span
              class="product-launch-dot"
              :style="{ '--launch-dot-size': launchDaysDotSize(text) }"
            ></span>
          </div>
          <div
            v-else
            class="product-metric-cell"
            :class="
              productMetricFillCellClass(String(column.dataIndex), record, text)
            "
          >
            <span
              v-if="
                productMetricFillInfo(String(column.dataIndex), record, text)
              "
              class="product-metric-fill"
              :class="
                productMetricFillToneClass(
                  String(column.dataIndex),
                  record,
                  text,
                )
              "
              :style="
                productMetricFillStyle(String(column.dataIndex), record, text)
              "
            ></span>
            <Popover
              v-if="isFbaInventoryColumn(String(column.dataIndex))"
              overlay-class-name="fba-inventory-popover"
              placement="leftTop"
              trigger="hover"
              @open-change="(open) => handleFbaInventoryOpen(open, record)"
            >
              <template #content>
                <div class="fba-inventory-panel">
                  <div class="fba-inventory-title">
                    <strong>
                      {{ productRowSpu(record) }} · {{ productRowSite(record) }}
                    </strong>
                    <span>
                      {{ fbaInventoryFor(record)?.refreshedAt || '当前快照' }}
                    </span>
                  </div>
                  <Spin :spinning="isFbaInventoryLoading(record)" size="small">
                    <table class="fba-inventory-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>ASIN</th>
                          <th>MSKU</th>
                          <th>店铺</th>
                          <th>仓库</th>
                          <th>FBA库存</th>
                          <th>FBA可售</th>
                          <th>FBA预留</th>
                          <th>FBA在途</th>
                          <th>总库存</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="item in fbaInventoryRows(record)"
                          :key="`${item.sku}-${item.mskuList}-${item.warehouseNames}-${item.isSummary}`"
                          :class="{ summary: item.isSummary }"
                        >
                          <td>{{ item.sku || '-' }}</td>
                          <td>{{ item.asinList || '-' }}</td>
                          <td>{{ item.mskuList || '-' }}</td>
                          <td>{{ item.shopNames || '-' }}</td>
                          <td>{{ item.warehouseNames || '-' }}</td>
                          <td>{{ formatInventoryQty(item.fbaStockQty) }}</td>
                          <td>
                            {{ formatInventoryQty(item.fbaAvailableQty) }}
                          </td>
                          <td>
                            {{ formatInventoryQty(item.fbaReservedQty) }}
                          </td>
                          <td>{{ formatInventoryQty(item.fbaInboundQty) }}</td>
                          <td>{{ formatInventoryQty(item.totalQty) }}</td>
                        </tr>
                        <tr
                          v-if="
                            !isFbaInventoryLoading(record) &&
                            fbaInventoryRows(record).length === 0
                          "
                        >
                          <td class="empty" colspan="10">
                            暂无当前 FBA 库存明细
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Spin>
                </div>
              </template>
              <span class="product-metric-content inventory-hover">
                <span class="product-metric-value">
                  {{
                    formatProductDetailValue(
                      text,
                      productColumnKind(String(column.dataIndex)),
                      String(column.dataIndex),
                      record,
                    )
                  }}
                </span>
                <span
                  v-if="
                    productMetricDeltaText(
                      text,
                      productColumnKind(String(column.dataIndex)),
                      String(column.dataIndex),
                      record,
                    )
                  "
                  class="product-metric-delta"
                  :class="productMetricDeltaClass(text)"
                >
                  {{
                    productMetricDeltaText(
                      text,
                      productColumnKind(String(column.dataIndex)),
                      String(column.dataIndex),
                      record,
                    )
                  }}
                </span>
              </span>
            </Popover>
            <span v-else class="product-metric-content">
              <span class="product-metric-value">
                {{
                  formatProductDetailValue(
                    text,
                    productColumnKind(String(column.dataIndex)),
                    String(column.dataIndex),
                    record,
                  )
                }}
              </span>
              <span
                v-if="
                  productMetricDeltaText(
                    text,
                    productColumnKind(String(column.dataIndex)),
                    String(column.dataIndex),
                    record,
                  )
                "
                class="product-metric-delta"
                :class="productMetricDeltaClass(text)"
              >
                {{
                  productMetricDeltaText(
                    text,
                    productColumnKind(String(column.dataIndex)),
                    String(column.dataIndex),
                    record,
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
                record,
              )
            }}
          </span>
        </template>
      </template>
      <template #footer>
        <div ref="productSummaryScrollRef" class="product-summary-scroll">
          <div
            class="product-summary-grid"
            :style="{ minWidth: `${productDetailScrollX}px` }"
          >
            <div
              v-for="(column, index) in productDisplayColumns"
              :key="column.key"
              :class="productDetailSummaryCellClass(column, index)"
              :style="{ width: `${productColumnDisplayWidth(column)}px` }"
              :title="productDetailSummaryValue(column, index)"
            >
              {{ productDetailSummaryValue(column, index) }}
            </div>
          </div>
        </div>
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
              <button
                type="button"
                @click="toggleProductColumnGroup(group.columns)"
              >
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
              <button
                type="button"
                @click="removeProductColumnDraft(column.key)"
              >
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
  margin-bottom: 20px;
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

.inventory-hover {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: help;
}

:global(.fba-inventory-popover) {
  max-width: none;
}

:global(.fba-inventory-popover .ant-popover-inner) {
  background: #fff;
}

:global(.dark .fba-inventory-popover .ant-popover-inner) {
  background: #0f172a;
}

.fba-inventory-panel {
  width: min(920px, calc(100vw - 72px));
  max-height: 420px;
  overflow: auto;
}

.fba-inventory-title {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.fba-inventory-title strong {
  font-size: 13px;
  color: var(--product-heading, #334155);
}

.fba-inventory-title span {
  font-size: 12px;
  color: var(--product-subtle, #64748b);
}

.fba-inventory-table {
  width: 100%;
  min-width: 860px;
  font-size: 12px;
  border-collapse: collapse;
}

.fba-inventory-table th,
.fba-inventory-table td {
  max-width: 150px;
  padding: 6px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  white-space: nowrap;
  border: 1px solid var(--product-border, #e2e8f0);
}

.fba-inventory-table th {
  font-weight: 800;
  color: var(--product-heading, #334155);
  background: var(--product-panel-muted, #f8fafc);
}

.fba-inventory-table th:nth-child(-n + 5),
.fba-inventory-table td:nth-child(-n + 5) {
  text-align: left;
}

.fba-inventory-table tr.summary td {
  font-weight: 850;
  color: var(--product-heading, #334155);
  background: var(--product-hover, #eff6ff);
}

.fba-inventory-table td.empty {
  height: 58px;
  color: var(--product-muted, #94a3b8);
  text-align: center;
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
  text-align: center !important;
  white-space: nowrap;
}

.product-detail-card :deep(.ant-table-footer) {
  padding: 0;
  overflow: hidden;
  background: transparent;
}

.product-summary-scroll {
  overflow: hidden;
  border-top: 1px solid var(--product-border);
}

.product-summary-grid {
  display: flex;
  min-height: 34px;
  background: var(--product-header-bg);
}

.product-summary-grid > div {
  flex: 0 0 auto;
  padding: 8px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--product-text);
  text-align: center;
  white-space: nowrap;
  border-right: 1px solid var(--product-border);
}

.product-summary-grid > div:first-child {
  text-align: center;
}

.product-summary-label {
  color: var(--product-title);
}

.product-summary-number {
  font-variant-numeric: tabular-nums;
  direction: ltr;
  unicode-bidi: isolate;
}

.product-resizable-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 100%;
  padding-right: 8px;
}

.product-resizable-header span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
  white-space: pre-line;
}

.product-detail-card :deep(th.product-header-resize-hover),
.product-detail-card :deep(th.product-header-resize-hover *) {
  cursor: col-resize !important;
}

.product-column-resize-handle {
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

.product-column-resize-handle::after {
  position: absolute;
  top: 8px;
  right: 8px;
  bottom: 8px;
  width: 2px;
  content: '';
  background: transparent;
}

.product-column-resize-handle:hover::after {
  background: #2563eb;
}

:global(.product-column-resizing) {
  cursor: col-resize !important;
  user-select: none;
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

.product-detail-card :deep(.product-detail-group) {
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 850;
  text-align: center;
  letter-spacing: 0;
  background: var(--product-panel-muted) !important;
  border-top: 1px solid var(--product-border-strong) !important;
  border-bottom: 1px solid var(--product-border-strong) !important;
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
  text-align: center;
  border-radius: 4px;
}

.product-metric-fill {
  position: absolute;
  top: 3px;
  left: 6px;
  z-index: 0;
  height: 1.45em;
  border-radius: 4px;
  opacity: 1;
  transform: none;
}

.metric-fill-full .product-metric-fill {
  inset: 0;
  width: 100% !important;
  height: auto;
  border-radius: 4px;
  opacity: 1;
  transform: none;
}

.metric-fill-blue {
  background: #1a7dff;
  box-shadow: inset 0 0 0 1px rgb(26 125 255 / 26%);
}

.metric-fill-green {
  background: #32c97e;
  box-shadow: inset 0 0 0 1px rgb(50 201 126 / 26%);
}

.metric-fill-orange {
  background: #ffaf0f;
  box-shadow: inset 0 0 0 1px rgb(255 175 15 / 28%);
}

.metric-fill-red {
  background: #fc4756;
  box-shadow: inset 0 0 0 1px rgb(252 71 86 / 28%);
}

.product-metric-content {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 2px;
  justify-items: center;
}

.product-metric-value {
  font-weight: 700;
  color: var(--product-heading);
  direction: ltr;
  unicode-bidi: isolate;
}

.product-metric-delta {
  font-size: 11px;
  font-weight: 700;
  line-height: 1.1;
}

.product-launch-days {
  display: inline-grid;
  grid-template-columns: auto 18px;
  gap: 6px;
  align-items: center;
  justify-content: center;
  width: 100%;
  font-weight: 760;
  color: var(--product-heading);
}

.product-launch-dot {
  place-self: center;
  width: var(--launch-dot-size);
  height: var(--launch-dot-size);
  background: #ef4444;
  border-radius: 999px;
  box-shadow: 0 0 0 3px rgb(239 68 68 / 12%);
}

.delta-up {
  color: #047857;
}

.delta-down {
  color: #b91c1c;
}

.delta-flat {
  color: var(--product-muted);
}

@media (max-width: 1280px) {
  .product-detail-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .product-detail-controls {
    justify-content: flex-start;
  }
}
</style>
