<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  AdCampaignRow,
  AdCategoryRow,
  AdMonitorKpi,
  AdMonitorOverview,
  AdResponsibleRow,
  AdTypeRow,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';
import VChart from 'vue-echarts';

import {
  Button,
  Card,
  DatePicker,
  Select,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import { fetchAdMonitorOverview } from '#/api/kanban';

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

interface AdCampaignViewRow extends AdCampaignRow {
  clicksShare: number;
  ordersShare: number;
  salesShare: number;
  spendShare: number;
}

type RangePreset = '7d' | '30d' | 'custom' | 'month' | 'today' | 'yesterday';

const loading = ref(false);
const overview = ref<AdMonitorOverview | null>(null);
const rangePreset = ref<RangePreset>('7d');
const customRange = ref<[string, string]>();

const query = reactive({
  categories: [] as string[],
  responsibles: [] as string[],
  shops: [] as string[],
  sites: [] as string[],
});

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

  if (rangePreset.value === 'custom') {
    const [start, end] = customRange.value ?? [];
    if (start && end) {
      return { endDate: end, startDate: start };
    }
    return {};
  }

  return {
    endDate: today.format('YYYY-MM-DD'),
    startDate: today.subtract(29, 'day').format('YYYY-MM-DD'),
  };
}

function selectRangePreset(value: RangePreset) {
  rangePreset.value = value;
  if (value !== 'custom') {
    loadData();
  }
}

function handleCustomRangeChange() {
  if (
    rangePreset.value === 'custom' &&
    customRange.value?.[0] &&
    customRange.value?.[1]
  ) {
    loadData();
  }
}

async function loadData() {
  loading.value = true;
  try {
    overview.value = await fetchAdMonitorOverview({
      ...rangeParams(),
      categories: query.categories,
      responsibles: query.responsibles,
      shops: query.shops,
      sites: query.sites,
    });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  query.categories = [];
  query.responsibles = [];
  query.shops = [];
  query.sites = [];
  rangePreset.value = '7d';
  customRange.value = undefined;
  loadData();
}

function drillCategory(record: AdCategoryRow) {
  query.categories = [record.category];
  loadData();
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function formatInteger(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function kpiValue(kpi: AdMonitorKpi) {
  if (kpi.unit === '$') {
    return formatMoney(kpi.value);
  }
  return `${Number(kpi.value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}${kpi.unit ?? ''}`;
}

function deltaClass(kpi: AdMonitorKpi) {
  const delta = kpi.delta ?? 0;
  const isGood = kpi.inverseDelta ? delta <= 0 : delta >= 0;
  return isGood ? 'good' : 'bad';
}

const filterOptions = computed(() => overview.value?.filters);

const campaignTotals = computed(() => {
  const rows = overview.value?.campaignRows ?? [];
  const totals = {
    clicks: 0,
    impressions: 0,
    orders: 0,
    sales: 0,
    spend: 0,
  };
  for (const row of rows) {
    totals.impressions += row.impressions || 0;
    totals.clicks += row.clicks || 0;
    totals.spend += row.spend || 0;
    totals.orders += row.adOrders || 0;
    totals.sales += row.adSales || 0;
  }

  return {
    ...totals,
    acos: totals.sales ? totals.spend / totals.sales : 0,
    cpc: totals.clicks ? totals.spend / totals.clicks : 0,
    ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
    cvr: totals.clicks ? totals.orders / totals.clicks : 0,
    roas: totals.spend ? totals.sales / totals.spend : 0,
  };
});

const campaignRows = computed<AdCampaignViewRow[]>(() => {
  const totals = campaignTotals.value;
  return (overview.value?.campaignRows ?? []).map((row) => ({
    ...row,
    clicksShare: totals.clicks ? row.clicks / totals.clicks : 0,
    ordersShare: totals.orders ? row.adOrders / totals.orders : 0,
    salesShare: totals.sales ? row.adSales / totals.sales : 0,
    spendShare: totals.spend ? row.spend / totals.spend : 0,
  }));
});

const moneyTrendOption = computed(() => ({
  color: ['#ea580c', '#2563eb', '#64748b'],
  grid: { bottom: 34, left: 58, right: 20, top: 42 },
  legend: { data: ['广告花费', '广告销售额', '总销售额'], right: 8, top: 0 },
  tooltip: {
    trigger: 'axis',
    valueFormatter: (value: number) => formatMoney(value),
  },
  xAxis: {
    boundaryGap: false,
    data: overview.value?.trend.map((item) => item.date.slice(5)) ?? [],
    type: 'category',
  },
  yAxis: {
    axisLabel: {
      formatter: (value: number) => `$${Math.round(value / 1000)}k`,
    },
    type: 'value',
  },
  series: [
    {
      data: overview.value?.trend.map((item) => item.spend) ?? [],
      name: '广告花费',
      smooth: true,
      symbol: 'none',
      type: 'line',
    },
    {
      data: overview.value?.trend.map((item) => item.adSales) ?? [],
      name: '广告销售额',
      smooth: true,
      symbol: 'none',
      type: 'line',
    },
    {
      data: overview.value?.trend.map((item) => item.totalSales) ?? [],
      name: '总销售额',
      smooth: true,
      symbol: 'none',
      type: 'line',
    },
  ],
}));

const efficiencyTrendOption = computed(() => ({
  color: ['#dc2626', '#7c3aed', '#16a34a'],
  grid: { bottom: 34, left: 48, right: 42, top: 42 },
  legend: { data: ['ACOS', 'TACOS', 'ROAS'], right: 8, top: 0 },
  tooltip: { trigger: 'axis' },
  xAxis: {
    boundaryGap: false,
    data: overview.value?.trend.map((item) => item.date.slice(5)) ?? [],
    type: 'category',
  },
  yAxis: [
    { axisLabel: { formatter: (value: number) => `${value}%` }, type: 'value' },
    { type: 'value' },
  ],
  series: [
    {
      data:
        overview.value?.trend.map((item) =>
          Number((item.acos * 100).toFixed(2)),
        ) ?? [],
      name: 'ACOS',
      smooth: true,
      symbol: 'none',
      type: 'line',
    },
    {
      data:
        overview.value?.trend.map((item) =>
          Number((item.tacos * 100).toFixed(2)),
        ) ?? [],
      name: 'TACOS',
      smooth: true,
      symbol: 'none',
      type: 'line',
    },
    {
      data:
        overview.value?.trend.map((item) => Number(item.roas.toFixed(2))) ?? [],
      name: 'ROAS',
      smooth: true,
      symbol: 'none',
      type: 'line',
      yAxisIndex: 1,
    },
  ],
}));

const typeOption = computed(() => ({
  color: ['#2563eb', '#16a34a', '#7c3aed', '#ea580c'],
  legend: { bottom: 0 },
  tooltip: {
    formatter: (item: { data: { name: string; value: number } }) =>
      `${item.data.name}: ${formatMoney(item.data.value)}`,
    trigger: 'item',
  },
  series: [
    {
      data:
        overview.value?.typeRows.map((item) => ({
          name: item.type,
          value: item.spend,
        })) ?? [],
      name: '广告类型',
      radius: ['48%', '72%'],
      type: 'pie',
    },
  ],
}));

const categoryColumns: TableColumnsType<AdCategoryRow> = [
  { dataIndex: 'category', fixed: 'left', title: '类目', width: 140 },
  {
    dataIndex: 'spend',
    sorter: (a, b) => a.spend - b.spend,
    title: '花费',
    width: 110,
  },
  { dataIndex: 'adSales', title: '广告销售额', width: 120 },
  { dataIndex: 'totalSales', title: '总销售额', width: 120 },
  {
    dataIndex: 'acos',
    sorter: (a, b) => a.acos - b.acos,
    title: 'ACOS',
    width: 90,
  },
  {
    dataIndex: 'tacos',
    sorter: (a, b) => a.tacos - b.tacos,
    title: 'TACOS',
    width: 90,
  },
  { dataIndex: 'roas', title: 'ROAS', width: 90 },
  { dataIndex: 'cpa', title: 'CPA', width: 90 },
  { dataIndex: 'spuCount', title: 'SPU', width: 80 },
  { dataIndex: 'action', fixed: 'right', title: '操作', width: 88 },
];

const responsibleColumns: TableColumnsType<AdResponsibleRow> = [
  { dataIndex: 'responsible', fixed: 'left', title: '负责人', width: 120 },
  {
    dataIndex: 'spend',
    sorter: (a, b) => a.spend - b.spend,
    title: '花费',
    width: 110,
  },
  { dataIndex: 'adSales', title: '广告销售额', width: 120 },
  {
    dataIndex: 'acos',
    sorter: (a, b) => a.acos - b.acos,
    title: 'ACOS',
    width: 90,
  },
  { dataIndex: 'tacos', title: 'TACOS', width: 90 },
  { dataIndex: 'roas', title: 'ROAS', width: 90 },
  { dataIndex: 'cpa', title: 'CPA', width: 90 },
  { dataIndex: 'spuCount', title: 'SPU', width: 80 },
];

const typeColumns: TableColumnsType<AdTypeRow> = [
  { dataIndex: 'type', title: '类型', width: 80 },
  { dataIndex: 'spend', title: '花费', width: 110 },
  { dataIndex: 'spendShare', title: '占比', width: 90 },
  { dataIndex: 'sales', title: '销售额', width: 110 },
  { dataIndex: 'acos', title: 'ACOS', width: 90 },
  { dataIndex: 'roas', title: 'ROAS', width: 90 },
];

const metricCell = () => ({ class: 'metric-cell' });
const metricHeaderCell = () => ({ class: 'metric-header-cell' });
const shareCell = () => ({ class: 'metric-cell share-cell' });
const shareHeaderCell = () => ({
  class: 'metric-header-cell share-header-cell',
});

const campaignColumns: TableColumnsType<AdCampaignViewRow> = [
  { dataIndex: 'campaignName', fixed: 'left', title: 'Campaign', width: 300 },
  {
    children: [
      { dataIndex: 'shopName', title: '店铺', width: 120 },
      { dataIndex: 'site', title: '站点', width: 70 },
      { dataIndex: 'campaignType', title: '类型', width: 80 },
      { dataIndex: 'spu', title: 'SPU', width: 110 },
      { dataIndex: 'category', title: '类目', width: 120 },
      { dataIndex: 'responsible', title: '负责人', width: 100 },
    ],
    title: '基础信息',
  },
  {
    children: [
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'impressions',
        sorter: (a, b) => a.impressions - b.impressions,
        title: 'Impression',
        width: 112,
      },
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'clicks',
        sorter: (a, b) => a.clicks - b.clicks,
        title: 'Clicks',
        width: 92,
      },
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'ctr',
        sorter: (a, b) => a.ctr - b.ctr,
        title: 'CTR',
        width: 86,
      },
    ],
    title: '流量',
  },
  {
    children: [
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'spend',
        sorter: (a, b) => a.spend - b.spend,
        title: 'Spend',
        width: 110,
      },
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'cpc',
        sorter: (a, b) => a.cpc - b.cpc,
        title: 'CPC',
        width: 86,
      },
    ],
    title: '成本',
  },
  {
    children: [
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'adOrders',
        sorter: (a, b) => a.adOrders - b.adOrders,
        title: 'Orders',
        width: 92,
      },
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'adSales',
        sorter: (a, b) => a.adSales - b.adSales,
        title: 'Sales',
        width: 110,
      },
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'cvr',
        sorter: (a, b) => a.cvr - b.cvr,
        title: 'CVR',
        width: 86,
      },
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'acos',
        sorter: (a, b) => a.acos - b.acos,
        title: 'ACOS',
        width: 90,
      },
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'roas',
        sorter: (a, b) => a.roas - b.roas,
        title: 'ROAS',
        width: 86,
      },
    ],
    title: '转化',
  },
  {
    children: [
      {
        customCell: shareCell,
        customHeaderCell: shareHeaderCell,
        dataIndex: 'spendShare',
        sorter: (a, b) => a.spendShare - b.spendShare,
        title: 'Spend Share',
        width: 112,
      },
      {
        customCell: shareCell,
        customHeaderCell: shareHeaderCell,
        dataIndex: 'clicksShare',
        sorter: (a, b) => a.clicksShare - b.clicksShare,
        title: 'Clicks Share',
        width: 112,
      },
      {
        customCell: shareCell,
        customHeaderCell: shareHeaderCell,
        dataIndex: 'ordersShare',
        sorter: (a, b) => a.ordersShare - b.ordersShare,
        title: 'Orders Share',
        width: 112,
      },
      {
        customCell: shareCell,
        customHeaderCell: shareHeaderCell,
        dataIndex: 'salesShare',
        sorter: (a, b) => a.salesShare - b.salesShare,
        title: 'Sales Share',
        width: 112,
      },
    ],
    title: '份额',
  },
  {
    children: [
      {
        customCell: metricCell,
        customHeaderCell: metricHeaderCell,
        dataIndex: 'budgetUtilization',
        sorter: (a, b) => a.budgetUtilization - b.budgetUtilization,
        title: '预算消耗',
        width: 104,
      },
    ],
    title: '预算',
  },
];

onMounted(loadData);
</script>

<template>
  <div class="ads-page">
    <section class="page-head">
      <div>
        <h1>广告监控看板</h1>
        <p>数据范围过滤未匹配 product_life 的产品，关键词模块暂时保留入口。</p>
      </div>
      <div class="range-switch">
        <Button
          :type="rangePreset === 'today' ? 'primary' : 'default'"
          @click="selectRangePreset('today')"
        >
          今日
        </Button>
        <Button
          :type="rangePreset === 'yesterday' ? 'primary' : 'default'"
          @click="selectRangePreset('yesterday')"
        >
          昨日
        </Button>
        <Button
          :type="rangePreset === '7d' ? 'primary' : 'default'"
          @click="selectRangePreset('7d')"
        >
          最近7天
        </Button>
        <Button
          :type="rangePreset === '30d' ? 'primary' : 'default'"
          @click="selectRangePreset('30d')"
        >
          最近30天
        </Button>
        <Button
          :type="rangePreset === 'month' ? 'primary' : 'default'"
          @click="selectRangePreset('month')"
        >
          本月
        </Button>
        <Button
          :type="rangePreset === 'custom' ? 'primary' : 'default'"
          @click="selectRangePreset('custom')"
        >
          自定义
        </Button>
        <DatePicker.RangePicker
          v-if="rangePreset === 'custom'"
          v-model:value="customRange"
          class="custom-range-picker"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          @change="handleCustomRangeChange"
        />
      </div>
    </section>

    <Card class="filter-card" :body-style="{ padding: '14px 16px' }">
      <div class="filters">
        <Select
          v-model:value="query.sites"
          :options="
            filterOptions?.sites.map((value) => ({ label: value, value }))
          "
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="站点"
        />
        <Select
          v-model:value="query.shops"
          :options="
            filterOptions?.shops.map((value) => ({ label: value, value }))
          "
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="店铺"
        />
        <Select
          v-model:value="query.categories"
          :options="
            filterOptions?.categories.map((value) => ({ label: value, value }))
          "
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="类目"
        />
        <Select
          v-model:value="query.responsibles"
          :options="
            filterOptions?.responsibles.map((value) => ({
              label: value,
              value,
            }))
          "
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="负责人"
        />
        <div class="filter-actions">
          <Button @click="resetFilters">重置</Button>
          <Button :loading="loading" type="primary" @click="loadData">
            应用筛选
          </Button>
        </div>
      </div>
    </Card>

    <Spin :spinning="loading">
      <template v-if="overview">
        <div class="scope-line">
          <span>{{ overview.summary.startDate }} 至
            {{ overview.summary.endDate }}</span>
          <span>{{ overview.summary.shopCount }} 个店铺</span>
          <span>{{ overview.summary.spuCount }} 个 SPU</span>
          <span>{{ overview.summary.campaignCount }} 个 Campaign</span>
        </div>

        <div class="kpi-grid">
          <div
            v-for="kpi in overview.kpis"
            :key="kpi.key"
            class="kpi-card"
            :class="`tone-${kpi.tone}`"
          >
            <span>{{ kpi.label }}</span>
            <strong>{{ kpiValue(kpi) }}</strong>
            <em
              v-if="kpi.delta !== null && kpi.delta !== undefined"
              :class="deltaClass(kpi)"
            >
              {{ kpi.delta > 0 ? '+' : '' }}{{ kpi.delta }}%
            </em>
          </div>
        </div>

        <div class="chart-grid">
          <Card
            title="广告花费 vs 销售额"
            :body-style="{ padding: '12px 14px' }"
          >
            <VChart :option="moneyTrendOption" autoresize class="chart" />
          </Card>
          <Card title="效率趋势" :body-style="{ padding: '12px 14px' }">
            <VChart :option="efficiencyTrendOption" autoresize class="chart" />
          </Card>
        </div>

        <div class="middle-grid">
          <Card title="广告类型占比" :body-style="{ padding: '10px 12px' }">
            <VChart :option="typeOption" autoresize class="type-chart" />
            <Table
              :columns="typeColumns"
              :data-source="overview.typeRows"
              :pagination="false"
              row-key="type"
              size="small"
            >
              <template #bodyCell="{ column, text }">
                <template
                  v-if="['spend', 'sales'].includes(String(column.dataIndex))"
                >
                  {{ formatMoney(Number(text || 0)) }}
                </template>
                <template
                  v-else-if="
                    ['spendShare', 'acos'].includes(String(column.dataIndex))
                  "
                >
                  {{ formatPercent(Number(text || 0)) }}
                </template>
              </template>
            </Table>
          </Card>

          <Card title="类目效率" :body-style="{ padding: 0 }">
            <Table
              :columns="categoryColumns"
              :data-source="overview.categoryRows"
              :pagination="{ pageSize: 8, showSizeChanger: false }"
              :scroll="{ x: 1120 }"
              row-key="category"
              size="small"
            >
              <template #bodyCell="{ column, record, text }">
                <template
                  v-if="
                    ['spend', 'adSales', 'totalSales', 'cpa'].includes(
                      String(column.dataIndex),
                    )
                  "
                >
                  {{ formatMoney(Number(text || 0)) }}
                </template>
                <template
                  v-else-if="
                    ['acos', 'tacos'].includes(String(column.dataIndex))
                  "
                >
                  <span
                    :class="
                      column.dataIndex === 'acos' && record.acos > 0.28
                        ? 'risk'
                        : ''
                    "
                    >{{ formatPercent(Number(text || 0)) }}</span>
                </template>
                <template v-else-if="column.dataIndex === 'action'">
                  <Button
                    size="small"
                    type="link"
                    @click="drillCategory(record as AdCategoryRow)"
                  >
                    下钻
                  </Button>
                </template>
              </template>
            </Table>
          </Card>
        </div>

        <div class="table-grid">
          <Card title="负责人效率" :body-style="{ padding: 0 }">
            <Table
              :columns="responsibleColumns"
              :data-source="overview.responsibleRows"
              :pagination="{ pageSize: 8, showSizeChanger: false }"
              :scroll="{ x: 820 }"
              row-key="responsible"
              size="small"
            >
              <template #bodyCell="{ column, text }">
                <template
                  v-if="
                    ['spend', 'adSales', 'cpa'].includes(
                      String(column.dataIndex),
                    )
                  "
                >
                  {{ formatMoney(Number(text || 0)) }}
                </template>
                <template
                  v-else-if="
                    ['acos', 'tacos'].includes(String(column.dataIndex))
                  "
                >
                  {{ formatPercent(Number(text || 0)) }}
                </template>
              </template>
            </Table>
          </Card>

          <Card title="低效关键词" :body-style="{ padding: '18px' }">
            <div class="placeholder">
              <strong>暂未启用</strong>
              <p>
                关键词数据源需要重新确认。当前版本先保留模块位置，不参与
                Campaign 下钻和预警计算。
              </p>
            </div>
          </Card>
        </div>

        <Card
          class="campaign-card strategy-table-card"
          title="Campaign 经营分析"
          :body-style="{ padding: 0 }"
        >
          <Table
            :columns="campaignColumns"
            :data-source="campaignRows"
            :pagination="{
              pageSize: 15,
              pageSizeOptions: ['15', '30', '50', '100'],
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条 Campaign`,
            }"
            :scroll="{ x: 2360 }"
            row-key="campaignName"
            size="small"
            sticky
          >
            <template #bodyCell="{ column, record, text }">
              <template v-if="column.dataIndex === 'campaignName'">
                <span class="campaign-name">{{ text }}</span>
              </template>
              <template
                v-else-if="
                  ['impressions', 'clicks', 'adOrders'].includes(
                    String(column.dataIndex),
                  )
                "
              >
                {{ formatInteger(Number(text || 0)) }}
              </template>
              <template
                v-else-if="
                  ['spend', 'adSales', 'cpc'].includes(String(column.dataIndex))
                "
              >
                {{ formatMoney(Number(text || 0)) }}
              </template>
              <template
                v-else-if="
                  [
                    'ctr',
                    'cvr',
                    'acos',
                    'budgetUtilization',
                    'spendShare',
                    'clicksShare',
                    'ordersShare',
                    'salesShare',
                  ].includes(String(column.dataIndex))
                "
              >
                <span
                  :class="
                    column.dataIndex === 'acos' && record.acos > 0.35
                      ? 'risk'
                      : ''
                  "
                >
                  {{ formatPercent(Number(text || 0)) }}
                </span>
              </template>
              <template v-else-if="column.dataIndex === 'roas'">
                {{ formatNumber(Number(text || 0)) }}
              </template>
              <template v-else-if="column.dataIndex === 'campaignType'">
                <Tag>{{ String(text || '').toUpperCase() }}</Tag>
              </template>
            </template>
            <template #summary>
              <Table.Summary fixed>
                <Table.Summary.Row class="campaign-summary-row">
                  <Table.Summary.Cell :index="0">合计</Table.Summary.Cell>
                  <Table.Summary.Cell :col-span="6" :index="1">
                    当前筛选范围
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="7" class="metric-cell">
                    {{ formatInteger(campaignTotals.impressions) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="8" class="metric-cell">
                    {{ formatInteger(campaignTotals.clicks) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="9" class="metric-cell">
                    {{ formatPercent(campaignTotals.ctr) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="10" class="metric-cell">
                    {{ formatMoney(campaignTotals.spend) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="11" class="metric-cell">
                    {{ formatMoney(campaignTotals.cpc) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="12" class="metric-cell">
                    {{ formatInteger(campaignTotals.orders) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="13" class="metric-cell">
                    {{ formatMoney(campaignTotals.sales) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="14" class="metric-cell">
                    {{ formatPercent(campaignTotals.cvr) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="15" class="metric-cell">
                    {{ formatPercent(campaignTotals.acos) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="16" class="metric-cell">
                    {{ formatNumber(campaignTotals.roas) }}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell
                    :index="17"
                    class="metric-cell share-cell"
                  >
                    100.00%
                  </Table.Summary.Cell>
                  <Table.Summary.Cell
                    :index="18"
                    class="metric-cell share-cell"
                  >
                    100.00%
                  </Table.Summary.Cell>
                  <Table.Summary.Cell
                    :index="19"
                    class="metric-cell share-cell"
                  >
                    100.00%
                  </Table.Summary.Cell>
                  <Table.Summary.Cell
                    :index="20"
                    class="metric-cell share-cell"
                  >
                    100.00%
                  </Table.Summary.Cell>
                  <Table.Summary.Cell :index="21" class="metric-cell">
                    -
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            </template>
          </Table>
        </Card>
      </template>
    </Spin>
  </div>
</template>

<style scoped>
.ads-page {
  min-height: 100%;
  padding: 16px;
  background: #f6f8fb;
}

.page-head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-head h1 {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 850;
  color: #0f172a;
}

.page-head p {
  margin: 0;
  color: #64748b;
}

.range-switch,
.filter-actions {
  display: inline-flex;
  gap: 8px;
}

.range-switch {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.custom-range-picker {
  width: 248px;
}

.filter-card {
  margin-bottom: 12px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr)) auto;
  gap: 10px;
  align-items: center;
}

.scope-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.scope-line span {
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  background: #fff;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 999px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
}

.kpi-card {
  min-height: 104px;
  padding: 13px 14px;
  color: #fff;
  border-radius: 8px;
}

.kpi-card span {
  display: block;
  font-size: 12px;
  font-weight: 750;
  opacity: 0.84;
}

.kpi-card strong {
  display: block;
  margin-top: 14px;
  font-size: 23px;
  line-height: 1;
}

.kpi-card em {
  display: inline-block;
  margin-top: 12px;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.good {
  color: #dcfce7;
}

.bad {
  color: #fee2e2;
}

.tone-blue {
  background: #1d4ed8;
}

.tone-cyan {
  background: #0369a1;
}

.tone-green {
  background: #15803d;
}

.tone-amber {
  background: #b45309;
}

.tone-red {
  background: #b91c1c;
}

.tone-purple {
  background: #6d28d9;
}

.chart-grid,
.middle-grid,
.table-grid {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.chart-grid {
  grid-template-columns: 1.2fr 1fr;
}

.middle-grid {
  grid-template-columns: 0.86fr 1.4fr;
}

.table-grid {
  grid-template-columns: 1.3fr 0.7fr;
}

.chart {
  height: 310px;
}

.type-chart {
  height: 210px;
}

.campaign-card {
  margin-top: 12px;
}

.strategy-table-card :deep(.ant-table) {
  font-size: 12px;
  color: #172033;
}

.strategy-table-card :deep(.ant-table-thead > tr > th) {
  padding: 7px 8px;
  font-size: 12px;
  font-weight: 750;
  color: #f8fafc;
  background: #1f2a37;
  border-color: rgb(255 255 255 / 14%);
}

.strategy-table-card :deep(.ant-table-thead > tr > th.ant-table-cell-fix-left) {
  background: #1f2a37;
}

.strategy-table-card :deep(.ant-table-tbody > tr > td),
.strategy-table-card :deep(.ant-table-summary > tr > td) {
  padding: 6px 8px;
  border-color: #d8dee8;
}

.strategy-table-card :deep(.ant-table-tbody > tr:hover > td) {
  background: #fff7ed;
}

.strategy-table-card :deep(.metric-cell),
.strategy-table-card :deep(.metric-header-cell) {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.strategy-table-card :deep(.share-cell) {
  font-weight: 750;
  color: #7c4a03;
  background: #fff7d6;
}

.strategy-table-card :deep(.share-header-cell) {
  background: #263241;
}

.strategy-table-card :deep(.campaign-summary-row > td) {
  position: sticky;
  bottom: 0;
  z-index: 2;
  font-weight: 850;
  color: #0f172a;
  background: #eef2f7;
}

.strategy-table-card :deep(.campaign-summary-row .share-cell) {
  background: #fde68a;
}

.strategy-table-card :deep(.ant-pagination) {
  margin: 10px 12px;
}

.campaign-name {
  display: inline-block;
  max-width: 276px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
  vertical-align: bottom;
  color: #111827;
  white-space: nowrap;
}

.placeholder {
  display: grid;
  align-content: center;
  min-height: 188px;
  color: #475569;
  text-align: center;
}

.placeholder strong {
  font-size: 18px;
  color: #0f172a;
}

.placeholder p {
  max-width: 360px;
  margin: 8px auto 0;
  line-height: 1.7;
}

.risk {
  font-weight: 800;
  color: #dc2626;
}

@media (max-width: 1320px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .chart-grid,
  .middle-grid,
  .table-grid,
  .filters {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .range-switch {
    justify-content: flex-start;
    width: 100%;
  }

  .custom-range-picker {
    width: 100%;
  }

  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
