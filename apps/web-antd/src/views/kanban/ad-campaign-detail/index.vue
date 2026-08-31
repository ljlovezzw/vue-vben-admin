<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';

import type {
  AdCampaignDetailField,
  AdCampaignDetailMeta,
  AdCampaignDetailMetricRow,
  AdCampaignDetailSection,
  AdCampaignDetailSectionResult,
} from '#/api/kanban/types';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import VChart from 'vue-echarts';
import { useRoute, useRouter } from 'vue-router';

import { ArrowLeft, ExternalLink, RotateCw, Settings } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Input,
  message,
  Popover,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import {
  fetchAdCampaignDetailMeta,
  fetchAdCampaignDetailSection,
  fetchAdCampaignDetailTrend,
} from '#/api/kanban/ad-cvr-optimization';

defineOptions({ name: 'KanbanAdCampaignDetail' });

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
]);

interface ChartTooltipItem {
  axisValue: string;
  data: number;
  marker: string;
  seriesName: string;
}

const route = useRoute();
const router = useRouter();
const profileId = computed(() => String(route.params.profileId || ''));
const campaignId = computed(() => String(route.params.campaignId || ''));
const meta = ref<AdCampaignDetailMeta | null>(null);
const detail = ref<AdCampaignDetailSectionResult | null>(null);
const campaignTrend = ref<AdCampaignDetailSectionResult['trend']>([]);
const metaLoading = ref(false);
const sectionLoading = ref(false);
const activeSection = ref<AdCampaignDetailSection>('ad_groups');
const adGroupId = ref(String(route.query.adGroupId || ''));
const search = ref('');
const selectedFieldKeys = ref<string[]>([]);
const fieldPreferenceSection = ref('');
const dateRange = ref<[Dayjs, Dayjs]>([
  dayjs().subtract(30, 'day'),
  dayjs().subtract(1, 'day'),
]);
const page = ref(1);
const pageSize = ref(50);
let controller: AbortController | null = null;
let trendController: AbortController | null = null;

const sectionOptions: Array<{ key: AdCampaignDetailSection; label: string }> = [
  { key: 'ad_groups', label: '广告组' },
  { key: 'ads', label: '广告' },
  { key: 'placements', label: '广告位' },
  { key: 'targets', label: '投放' },
  { key: 'negative_targets', label: '否定投放' },
  { key: 'search_terms', label: '用户搜索词' },
];

const groupOptions = computed(() => [
  { label: `全部广告组（${meta.value?.groups.length || 0}）`, value: '' },
  ...(meta.value?.groups || []).map((group) => ({
    label: group.name || group.id,
    value: group.id,
  })),
]);

function coreFieldKey(dataIndex: string) {
  return `core:${dataIndex}`;
}

function coreEntityLabel(section: AdCampaignDetailSection) {
  if (section === 'ad_groups') return '广告组';
  if (section === 'search_terms') return '用户搜索词';
  if (section === 'placements') return '广告位';
  return '投放内容';
}

function coreFieldOptionsForSection(section: AdCampaignDetailSection) {
  const fields: Array<{ dataIndex: string; label: string }> = [];
  if (section !== 'ad_groups')
    fields.push({ dataIndex: 'adGroupName', label: '广告组' });
  fields.push({
    dataIndex: 'name',
    label: coreEntityLabel(section),
  });
  if (section === 'ads') {
    fields.push(
      { dataIndex: 'sku', label: 'MSKU' },
      { dataIndex: 'asin', label: 'ASIN' },
    );
  }
  if (['negative_targets', 'search_terms', 'targets'].includes(section)) {
    fields.push(
      { dataIndex: 'type', label: '类型' },
      { dataIndex: 'matchType', label: '匹配方式' },
    );
  }
  if (section === 'targets') fields.push({ dataIndex: 'bid', label: '竞价' });
  if (section === 'negative_targets') {
    fields.push({ dataIndex: 'createdAt', label: '创建时间' });
  } else {
    fields.push(
      { dataIndex: 'impressions', label: '曝光' },
      { dataIndex: 'clicks', label: '点击' },
      { dataIndex: 'ctr', label: 'CTR' },
      { dataIndex: 'cpc', label: 'CPC' },
      { dataIndex: 'spend', label: '花费' },
      { dataIndex: 'sales', label: '广告销售额' },
      { dataIndex: 'orders', label: '广告订单' },
      { dataIndex: 'cvr', label: 'CVR' },
      { dataIndex: 'acos', label: 'ACoS' },
      { dataIndex: 'roas', label: 'ROAS' },
      { dataIndex: 'status', label: '状态' },
    );
  }
  return fields.map<AdCampaignDetailField>((field) => ({
    key: coreFieldKey(field.dataIndex),
    label: field.label,
    sourceKey: field.dataIndex,
  }));
}

const coreFieldOptions = computed(() =>
  coreFieldOptionsForSection(activeSection.value),
);

const fieldOptions = computed<AdCampaignDetailField[]>(() => [
  ...coreFieldOptions.value,
  ...(detail.value?.availableFields || []),
]);

const fieldCheckboxOptions = computed(() =>
  fieldOptions.value.map((field) => ({
    label: field.label,
    value: field.key,
  })),
);

const visibleExtraFields = computed(() => {
  const selected = new Set(selectedFieldKeys.value);
  return fieldOptions.value.filter(
    (field) => field.key.startsWith('raw:') && selected.has(field.key),
  );
});

const entityTitle = computed(() => {
  const labels: Partial<Record<AdCampaignDetailSection, string>> = {
    ad_groups: '广告组',
    ads: '广告',
    placements: '广告位',
    search_terms: '用户搜索词',
  };
  return labels[activeSection.value] || '投放内容';
});

const summaryItems = computed(() => {
  const value = detail.value?.summary;
  return [
    { key: 'spend', label: '广告花费', value: money(value?.spend) },
    { key: 'sales', label: '广告销售额', value: money(value?.sales) },
    { key: 'orders', label: '广告订单', value: integer(value?.orders) },
    { key: 'clicks', label: '点击', value: integer(value?.clicks) },
    { key: 'cvr', label: '广告 CVR', value: percent(value?.cvr) },
    { key: 'acos', label: 'ACoS', value: percent(value?.acos) },
    { key: 'roas', label: 'ROAS', value: decimal(value?.roas) },
  ];
});

function textCompare(left?: string, right?: string) {
  return String(left || '').localeCompare(String(right || ''), 'zh-CN', {
    numeric: true,
  });
}

function numberCompare(left?: null | number, right?: null | number) {
  return Number(left || 0) - Number(right || 0);
}

const columns = computed<TableColumnsType<AdCampaignDetailMetricRow>>(() => {
  const isCoreVisible = (dataIndex: string) =>
    selectedFieldKeys.value.includes(coreFieldKey(dataIndex));
  const extraColumns = () =>
    visibleExtraFields.value.map((field) => ({
      dataIndex: field.key,
      key: field.key,
      sorter: (
        left: AdCampaignDetailMetricRow,
        right: AdCampaignDetailMetricRow,
      ) => textCompare(rawFieldValue(left, field), rawFieldValue(right, field)),
      title: field.label,
      width: 160,
    }));
  const identityColumns: TableColumnsType<AdCampaignDetailMetricRow> = [];
  if (activeSection.value !== 'ad_groups' && isCoreVisible('adGroupName')) {
    identityColumns.push({
      dataIndex: 'adGroupName',
      fixed: 'left',
      sorter: (left, right) => textCompare(left.adGroupName, right.adGroupName),
      title: '广告组',
      width: 220,
    });
  }
  if (isCoreVisible('name')) {
    identityColumns.push({
      dataIndex: 'name',
      fixed: 'left',
      sorter: (left, right) => textCompare(left.name, right.name),
      title: entityTitle.value,
      width: 260,
    });
  }
  if (activeSection.value === 'ads') {
    if (isCoreVisible('sku')) {
      identityColumns.push({ dataIndex: 'sku', title: 'MSKU', width: 160 });
    }
    if (isCoreVisible('asin')) {
      identityColumns.push({ dataIndex: 'asin', title: 'ASIN', width: 130 });
    }
  }
  if (
    ['negative_targets', 'search_terms', 'targets'].includes(
      activeSection.value,
    )
  ) {
    if (isCoreVisible('type')) {
      identityColumns.push({ dataIndex: 'type', title: '类型', width: 110 });
    }
    if (isCoreVisible('matchType')) {
      identityColumns.push({
        dataIndex: 'matchType',
        title: '匹配方式',
        width: 110,
      });
    }
  }
  if (activeSection.value === 'targets' && isCoreVisible('bid')) {
    identityColumns.push({ dataIndex: 'bid', title: '竞价', width: 100 });
  }
  if (activeSection.value === 'negative_targets') {
    if (isCoreVisible('createdAt')) {
      identityColumns.push({
        dataIndex: 'createdAt',
        title: '创建时间',
        width: 150,
      });
    }
    return [...identityColumns, ...extraColumns()];
  }
  const metricColumns: TableColumnsType<AdCampaignDetailMetricRow> = [];
  if (isCoreVisible('impressions')) {
    metricColumns.push({
      dataIndex: 'impressions',
      sorter: (left, right) => left.impressions - right.impressions,
      title: '曝光',
      width: 105,
    });
  }
  if (isCoreVisible('clicks')) {
    metricColumns.push({
      dataIndex: 'clicks',
      sorter: (left, right) => left.clicks - right.clicks,
      title: '点击',
      width: 90,
    });
  }
  for (const [dataIndex, title, width] of [
    ['ctr', 'CTR', 95],
    ['cpc', 'CPC', 95],
    ['spend', '花费', 110],
    ['sales', '广告销售额', 125],
    ['orders', '广告订单', 105],
    ['cvr', 'CVR', 95],
    ['acos', 'ACoS', 95],
    ['roas', 'ROAS', 95],
  ] as const) {
    if (!isCoreVisible(dataIndex)) continue;
    metricColumns.push({
      dataIndex,
      sorter: (left, right) =>
        numberCompare(
          left[dataIndex as keyof AdCampaignDetailMetricRow] as null | number,
          right[dataIndex as keyof AdCampaignDetailMetricRow] as null | number,
        ),
      title,
      width,
    });
  }
  if (isCoreVisible('status')) {
    metricColumns.push({ dataIndex: 'status', title: '状态', width: 110 });
  }
  metricColumns.unshift(...identityColumns);
  return [...metricColumns, ...extraColumns()];
});

// Ant Table cannot render rows while its columns are temporarily empty during
// a section switch or when the user clears every field. Keep one placeholder
// column so the table never enters that invalid intermediate state.
const tableColumns = computed<TableColumnsType<AdCampaignDetailMetricRow>>(() =>
  columns.value.length > 0
    ? columns.value
    : [
        {
          dataIndex: '__empty',
          key: '__empty',
          title: '暂无展示字段',
          width: 180,
        },
      ],
);

function money(value?: null | number) {
  return `$${Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function integer(value?: null | number) {
  return Math.round(Number(value || 0)).toLocaleString('en-US');
}

function percent(value?: null | number) {
  return value === null || value === undefined
    ? '-'
    : `${(Number(value) * 100).toFixed(2)}%`;
}

function decimal(value?: null | number) {
  return value === null || value === undefined ? '-' : Number(value).toFixed(2);
}

function statusColor(value?: string) {
  const status = String(value || '').toLowerCase();
  if (status.includes('enable') || status.includes('投放')) return 'green';
  if (status.includes('pause') || status.includes('暂停')) return 'orange';
  if (status.includes('archive') || status.includes('归档')) return 'default';
  return 'blue';
}

function metricCell(record: AdCampaignDetailMetricRow, key: string) {
  const value = record[key as keyof AdCampaignDetailMetricRow] as null | number;
  if (['acos', 'ctr', 'cvr'].includes(key)) return percent(value);
  if (['cpc', 'sales', 'spend'].includes(key)) return money(value);
  if (key === 'roas') return decimal(value);
  return integer(value);
}

function detailRecord(record: Record<string, any>) {
  return record as AdCampaignDetailMetricRow;
}

function fieldStorageKey() {
  return `ad-campaign-detail-fields:${profileId.value}:${campaignId.value}:${activeSection.value}`;
}

function defaultFieldKeys() {
  return coreFieldOptions.value.map((field) => field.key);
}

function sameFieldKeys(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((key, index) => key === right[index])
  );
}

function normalizeFieldKeys(
  keys: string[],
  responseFields: AdCampaignDetailField[] = detail.value?.availableFields || [],
) {
  // Default columns are supplied by the page, not by Lingxing's availableFields.
  // Validate against both sources; otherwise saved core:* selections are discarded
  // after every reload and the table ends up with zero visible columns.
  const available = new Set(
    [...coreFieldOptions.value, ...responseFields].map((field) => field.key),
  );
  const validKeys = [...new Set(keys.filter((key) => available.has(key)))];
  const hasCoreField = validKeys.some((key) => key.startsWith('core:'));
  return hasCoreField
    ? validKeys
    : [
        ...defaultFieldKeys(),
        ...validKeys.filter((key) => key.startsWith('raw:')),
      ];
}

function syncFieldPreference(fields: AdCampaignDetailField[]) {
  if (fieldPreferenceSection.value === activeSection.value) {
    selectedFieldKeys.value = normalizeFieldKeys(
      selectedFieldKeys.value,
      fields,
    );
    return;
  }
  let stored: string[] = [];
  let hasStoredPreference = false;
  try {
    const value = localStorage.getItem(fieldStorageKey());
    hasStoredPreference = value !== null;
    const parsed = value ? JSON.parse(value) : [];
    if (Array.isArray(parsed))
      stored = parsed.filter((item) => typeof item === 'string');
  } catch {
    stored = [];
  }
  selectedFieldKeys.value = normalizeFieldKeys(
    hasStoredPreference ? stored : defaultFieldKeys(),
    fields,
  );
  fieldPreferenceSection.value = activeSection.value;
}

function persistFieldPreference() {
  const normalized = normalizeFieldKeys(selectedFieldKeys.value);
  if (!sameFieldKeys(selectedFieldKeys.value, normalized)) {
    selectedFieldKeys.value = normalized;
    return;
  }
  try {
    localStorage.setItem(fieldStorageKey(), JSON.stringify(normalized));
  } catch {
    // Local storage may be unavailable in private browsing; the table still works.
  }
}

function selectAllFields() {
  selectedFieldKeys.value = fieldOptions.value.map((field) => field.key);
}

function restoreDefaultFields() {
  selectedFieldKeys.value = defaultFieldKeys();
}

function rawFieldValue(
  record: AdCampaignDetailMetricRow,
  field: AdCampaignDetailField,
) {
  const value = record.rawFields?.[field.sourceKey];
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function rawFieldValueByKey(record: AdCampaignDetailMetricRow, key: string) {
  const field = fieldOptions.value.find((item) => item.key === key);
  if (field) return rawFieldValue(record, field);
  return rawFieldValue(record, {
    key,
    label: key,
    sourceKey: key.replace(/^raw:/, ''),
  });
}

const chartOption = computed(() => {
  const rows = campaignTrend.value;
  const series = [
    { color: '#2563eb', key: 'clicks', label: '点击' },
    { color: '#ef8a17', key: 'spend', label: '花费' },
    { color: '#0f9f7f', key: 'orders', label: '广告订单' },
    { color: '#d04f5f', key: 'sales', label: '广告销售额' },
  ];
  return {
    animationDuration: 320,
    color: series.map((item) => item.color),
    grid: {
      bottom: 32,
      left: 18,
      outerBoundsContain: 'axisLabel',
      right: 18,
      top: 42,
    },
    legend: { itemHeight: 8, itemWidth: 18, top: 4 },
    series: series.map((item, index) => ({
      data: rows.map((row) => Number(row[item.key as keyof typeof row] || 0)),
      lineStyle: { width: 2 },
      name: item.label,
      showSymbol: rows.length <= 14,
      smooth: 0.25,
      symbolSize: 5,
      type: 'line',
      yAxisIndex: index < 2 ? index : index % 2,
    })),
    tooltip: {
      borderColor: '#d8e1ec',
      confine: true,
      formatter: (items: ChartTooltipItem[]) =>
        [
          items[0]?.axisValue || '',
          ...items.map(
            (item) =>
              `${item.marker}${item.seriesName}&nbsp;<b>${
                ['广告销售额', '花费'].includes(item.seriesName)
                  ? money(item.data)
                  : integer(item.data)
              }</b>`,
          ),
        ].join('<br/>'),
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: '#75859a', hideOverlap: true },
      axisLine: { lineStyle: { color: '#d8e1ec' } },
      boundaryGap: false,
      data: rows.map((row) => row.date.slice(5)),
      type: 'category',
    },
    yAxis: [
      {
        axisLabel: { color: '#75859a' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#e5edf6', type: 'dashed' } },
        type: 'value',
      },
      {
        axisLabel: {
          color: '#75859a',
          formatter: (value: number) => `$${integer(value)}`,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        type: 'value',
      },
    ],
  };
});

const lingxingUrl = computed(() => {
  const map = encodeURIComponent(
    JSON.stringify({
      campaignId: campaignId.value,
      profileId: profileId.value,
    }),
  );
  return `https://ads.lingxing.com/amazon/campaign-detail?advertisingIdMap=${map}&ggType=${String(meta.value?.sponsoredType || 'sp').toLowerCase()}&name=advertisingList&k=${campaignId.value}`;
});

async function loadMeta() {
  metaLoading.value = true;
  try {
    meta.value = await fetchAdCampaignDetailMeta(
      profileId.value,
      campaignId.value,
    );
  } catch (error) {
    message.error(
      `广告活动信息加载失败：${error instanceof Error ? error.message : error}`,
    );
  } finally {
    metaLoading.value = false;
  }
}

async function loadSection(refresh = false) {
  controller?.abort();
  const nextController = new AbortController();
  controller = nextController;
  sectionLoading.value = true;
  const requestedSection = activeSection.value;
  try {
    const result = await fetchAdCampaignDetailSection(
      profileId.value,
      campaignId.value,
      {
        adGroupId:
          requestedSection === 'search_terms'
            ? undefined
            : adGroupId.value || undefined,
        endDate: dateRange.value[1].format('YYYY-MM-DD'),
        keyword: search.value.trim() || undefined,
        page: page.value,
        pageSize: pageSize.value,
        refresh,
        section: requestedSection,
        startDate: dateRange.value[0].format('YYYY-MM-DD'),
      },
      nextController.signal,
    );
    if (controller !== nextController || nextController.signal.aborted) return;
    if (requestedSection === 'ad_groups') {
      campaignTrend.value = result.trend;
    }
    if (requestedSection !== activeSection.value) return;
    detail.value = result;
    syncFieldPreference(result.availableFields);
  } catch (error) {
    if (!nextController.signal.aborted) {
      detail.value = null;
      message.error(
        `领星实时数据加载失败：${error instanceof Error ? error.message : error}`,
      );
    }
  } finally {
    if (controller === nextController) {
      controller = null;
      sectionLoading.value = false;
    }
  }
}

async function loadCampaignTrend(refresh = false) {
  trendController?.abort();
  const nextController = new AbortController();
  trendController = nextController;
  try {
    const result = await fetchAdCampaignDetailTrend(
      profileId.value,
      campaignId.value,
      {
        endDate: dateRange.value[1].format('YYYY-MM-DD'),
        refresh,
        startDate: dateRange.value[0].format('YYYY-MM-DD'),
      },
      nextController.signal,
    );
    if (trendController !== nextController || nextController.signal.aborted)
      return;
    campaignTrend.value = result.trend;
  } catch (error) {
    if (!nextController.signal.aborted) {
      message.error(
        `广告活动趋势加载失败：${error instanceof Error ? error.message : error}`,
      );
    }
  } finally {
    if (trendController === nextController) trendController = null;
  }
}

function changePage(value: TablePaginationConfig) {
  page.value = Number(value.current || 1);
  pageSize.value = Number(value.pageSize || 50);
  void loadSection();
}

function applySearch() {
  page.value = 1;
  void loadSection();
}

function clearSearch(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (!value) applySearch();
}

function handleDateChange() {
  page.value = 1;
  if (activeSection.value === 'ad_groups') {
    void loadSection();
    return;
  }
  void Promise.all([loadSection(), loadCampaignTrend()]);
}

function openLingxing() {
  window.open(lingxingUrl.value, '_blank', 'noopener,noreferrer');
}

watch(selectedFieldKeys, persistFieldPreference, { deep: true });

watch(activeSection, () => {
  page.value = 1;
  search.value = '';
  detail.value = null;
  if (activeSection.value === 'search_terms' && adGroupId.value) {
    adGroupId.value = '';
    return;
  }
  fieldPreferenceSection.value = '';
  void loadSection();
});

watch(adGroupId, () => {
  page.value = 1;
  detail.value = null;
  void loadSection();
});

onMounted(() => {
  void Promise.all([loadMeta(), loadSection()]);
});

onBeforeUnmount(() => {
  controller?.abort();
  trendController?.abort();
});
</script>

<template>
  <div class="campaign-detail-page">
    <Spin :spinning="metaLoading">
      <header class="page-head">
        <div class="head-main">
          <Tooltip title="返回广告优化">
            <Button
              aria-label="返回广告优化"
              shape="circle"
              @click="router.back()"
            >
              <ArrowLeft :size="17" />
            </Button>
          </Tooltip>
          <div class="title-block">
            <div class="title-row">
              <h1>{{ meta?.campaignName || campaignId }}</h1>
              <Tag color="blue">{{ meta?.sponsoredType || '-' }}</Tag>
              <Tag :color="statusColor(meta?.status)">
{{
                meta?.status || '-'
              }}
</Tag>
            </div>
            <p>
              {{ meta?.storeName || '-' }} · 活动 ID {{ campaignId }} ·
              {{ meta?.responsibles.join('、') || '未匹配负责人' }}
            </p>
          </div>
        </div>
        <div class="head-actions">
          <span v-if="detail?.fetchedAt" class="freshness">
            {{
              detail.source === 'database_ad_group_daily_metrics'
                ? '本地广告日表'
                : '领星实时接口'
            }}
            ·
            {{
              detail.stale
                ? '后台刷新中，展示最近数据'
                : detail.cacheHit
                  ? '短缓存'
                  : '刚刚刷新'
            }}
            ·
            {{ detail.fetchedAt.replace('T', ' ') }}
          </span>
          <Tooltip title="强制从领星重新获取当前页签">
            <Button
              :disabled="sectionLoading"
              shape="circle"
              @click="loadSection(true)"
            >
              <RotateCw :class="{ spinning: sectionLoading }" :size="17" />
            </Button>
          </Tooltip>
          <Button @click="openLingxing">
            <ExternalLink :size="16" />
            查看领星原页
          </Button>
        </div>
      </header>
    </Spin>

    <section class="metric-band">
      <div v-for="item in summaryItems" :key="item.key" class="metric-item">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <Alert
      v-if="detail?.warnings.length"
      class="warning-bar"
      :message="`部分数据未返回：${detail.warnings.slice(0, 2).join('；')}`"
      show-icon
      type="warning"
    />

    <section class="trend-section">
      <header class="section-head">
        <div>
          <h2>活动趋势</h2>
          <span>{{ dateRange[0].format('YYYY-MM-DD') }} 至
            {{ dateRange[1].format('YYYY-MM-DD') }}</span>
        </div>
      </header>
      <div v-if="campaignTrend.length > 0" class="trend-chart">
        <VChart :option="chartOption" autoresize />
      </div>
      <Empty v-else description="当前区间没有趋势数据" />
    </section>

    <section class="detail-section">
      <div class="detail-toolbar">
        <Tabs v-model:active-key="activeSection" class="detail-tabs">
          <Tabs.TabPane
            v-for="item in sectionOptions"
            :key="item.key"
            :tab="item.label"
          />
        </Tabs>
        <div class="filters">
          <DatePicker.RangePicker
            v-model:value="dateRange"
            :allow-clear="false"
            format="YYYY-MM-DD"
            @change="handleDateChange"
          />
          <Select
            v-model:value="adGroupId"
            :options="groupOptions"
            :disabled="activeSection === 'search_terms'"
            show-search
            option-filter-prop="label"
            style="width: 250px"
          />
          <span v-if="activeSection === 'search_terms'" class="section-note">
            用户搜索词为活动级数据
          </span>
          <Input.Search
            v-model:value="search"
            allow-clear
            placeholder="搜索后回车：广告组、投放、SKU 或 ASIN"
            style="width: 260px"
            @change="clearSearch"
            @search="applySearch"
          />
          <Popover placement="bottomRight" trigger="click">
            <template #content>
              <div class="field-picker">
                <div class="field-picker-head">
                  <strong>展示字段</strong>
                  <span>{{ selectedFieldKeys.length }}/{{
                      fieldOptions.length
                    }}</span>
                </div>
                <div class="field-picker-actions">
                  <Button size="small" type="link" @click="selectAllFields">
全选
</Button>
                  <Button
                    size="small"
                    type="link"
                    @click="restoreDefaultFields"
                  >
                    恢复默认
                  </Button>
                </div>
                <Checkbox.Group
                  v-model:value="selectedFieldKeys"
                  :options="fieldCheckboxOptions"
                />
              </div>
            </template>
            <Button class="field-picker-trigger">
              <Settings :size="15" />
              字段
              <span class="field-count">{{ selectedFieldKeys.length }}</span>
            </Button>
          </Popover>
        </div>
      </div>

      <Spin :spinning="sectionLoading">
        <Table
          class="detail-table"
          :columns="tableColumns"
          :data-source="sectionLoading ? [] : detail?.rows || []"
          :pagination="{
            current: detail?.pagination.page || page,
            pageSize: detail?.pagination.pageSize || pageSize,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条`,
            total: detail?.pagination.total || 0,
          }"
          :row-key="
            (row: AdCampaignDetailMetricRow) =>
              `${activeSection}-${row.adGroupId}-${row.id}`
          "
          :scroll="{ x: 1500, y: 520 }"
          size="small"
          @change="changePage"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column?.dataIndex === 'name'">
              <div class="primary-cell">
                <strong>{{ record.name || '-' }}</strong>
                <span v-if="activeSection === 'ad_groups'">ID {{ record.adGroupId }}</span>
              </div>
            </template>
            <template v-else-if="column?.dataIndex === 'adGroupName'">
              <div class="primary-cell">
                <strong>{{ record.adGroupName || '-' }}</strong>
                <span>ID {{ record.adGroupId || '-' }}</span>
              </div>
            </template>
            <template v-else-if="column?.dataIndex === 'status'">
              <Tag :color="statusColor(record.status)">
{{
                record.status || '-'
              }}
</Tag>
            </template>
            <template v-else-if="column?.dataIndex === 'bid'">
              {{ money(record.bid) }}
            </template>
            <template
              v-else-if="
                [
                  'acos',
                  'clicks',
                  'cpc',
                  'ctr',
                  'cvr',
                  'impressions',
                  'orders',
                  'roas',
                  'sales',
                  'spend',
                ].includes(String(column?.dataIndex))
              "
            >
              <strong class="numeric-value">
                {{
                  metricCell(detailRecord(record), String(column?.dataIndex))
                }}
              </strong>
            </template>
            <template
              v-else-if="String(column?.dataIndex || '').startsWith('raw:')"
            >
              <span class="raw-field-value">
                {{
                  rawFieldValueByKey(
                    detailRecord(record),
                    String(column?.dataIndex),
                  )
                }}
              </span>
            </template>
          </template>
          <template #emptyText>
            <Empty description="当前筛选没有数据" />
          </template>
        </Table>
      </Spin>
    </section>
  </div>
</template>

<style scoped>
.campaign-detail-page {
  min-height: 100%;
  padding: 16px;
  color: #14233a;
  background: #eef3f8;
}

.page-head,
.metric-band,
.trend-section,
.detail-section {
  background: #fff;
  border: 1px solid #d6e0eb;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76px;
  padding: 14px 16px;
  border-radius: 6px 6px 0 0;
}

.head-main,
.head-actions,
.title-row,
.filters {
  display: flex;
  align-items: center;
}

.head-main {
  gap: 12px;
  min-width: 0;
}

.title-block {
  min-width: 0;
}

.title-row {
  gap: 8px;
}

.title-row h1 {
  max-width: 720px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 21px;
  font-weight: 750;
  letter-spacing: 0;
  white-space: nowrap;
}

.title-block p {
  margin: 5px 0 0;
  font-size: 13px;
  color: #64748b;
}

.head-actions {
  gap: 9px;
}

.freshness {
  font-size: 12px;
  color: #62748a;
}

.metric-band {
  display: grid;
  grid-template-columns: repeat(7, minmax(130px, 1fr));
  margin-top: 10px;
  border-radius: 6px;
}

.metric-item {
  min-width: 0;
  padding: 14px 16px;
  border-right: 1px solid #e2e8f0;
}

.metric-item:last-child {
  border-right: 0;
}

.metric-item span {
  display: block;
  font-size: 12px;
  color: #66788e;
}

.metric-item strong {
  display: block;
  margin-top: 4px;
  font-size: 21px;
  font-variant-numeric: tabular-nums;
  color: #102a4c;
  letter-spacing: 0;
}

.metric-item:nth-child(1) strong,
.metric-item:nth-child(6) strong {
  color: #db5c25;
}

.metric-item:nth-child(2) strong,
.metric-item:nth-child(5) strong {
  color: #087f68;
}

.warning-bar {
  margin-top: 10px;
}

.trend-section,
.detail-section {
  margin-top: 10px;
  border-radius: 6px;
}

.section-head {
  display: flex;
  align-items: center;
  min-height: 50px;
  padding: 10px 16px 0;
}

.section-head h2 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0;
}

.section-head span {
  font-size: 12px;
  color: #6b7d92;
}

.trend-chart {
  height: 250px;
  padding: 0 12px 8px;
}

.detail-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  min-height: 62px;
  padding: 0 14px;
  border-bottom: 1px solid #dce5ef;
}

.detail-tabs {
  min-width: 540px;
}

.detail-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.filters {
  gap: 8px;
  padding-bottom: 10px;
}

.section-note {
  font-size: 12px;
  color: #6b7d92;
  white-space: nowrap;
}

.field-picker-trigger {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.field-count {
  min-width: 18px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 18px;
  color: #2563eb;
  background: #edf4ff;
  border-radius: 9px;
}

.field-picker {
  width: 330px;
}

.field-picker-head,
.field-picker-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-picker-head {
  padding-bottom: 8px;
  color: #263b58;
  border-bottom: 1px solid #e2e8f0;
}

.field-picker-head span {
  font-size: 12px;
  color: #718198;
}

.field-picker-actions {
  gap: 8px;
  justify-content: flex-end;
  padding: 6px 0;
}

.field-picker :deep(.ant-checkbox-group) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  max-height: 360px;
  overflow-y: auto;
}

.field-picker :deep(.ant-checkbox-wrapper) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-table :deep(.ant-table-thead > tr > th) {
  font-size: 13px;
  font-weight: 700;
  color: #233955;
  text-align: center;
  background: #f3f7fb;
}

.detail-table :deep(.ant-table-tbody > tr > td) {
  font-size: 13px;
  color: #233955;
  text-align: center;
}

.primary-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
}

.primary-cell strong {
  overflow: hidden;
  text-overflow: ellipsis;
  color: #12315a;
  white-space: nowrap;
}

.primary-cell span {
  font-size: 11px;
  color: #73849a;
}

.numeric-value {
  font-variant-numeric: tabular-nums;
  color: #163a68;
}

.raw-field-value {
  display: inline-block;
  max-width: 145px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1280px) {
  .page-head,
  .detail-toolbar {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }

  .head-actions,
  .filters {
    flex-wrap: wrap;
  }

  .metric-band {
    grid-template-columns: repeat(4, minmax(130px, 1fr));
  }

  .metric-item:nth-child(4) {
    border-right: 0;
  }
}
</style>
