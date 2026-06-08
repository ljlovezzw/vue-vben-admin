<script lang="ts" setup>
import type {
  AnalyticsOperationGroup,
  AnalyticsOverview,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';
import VChart from 'vue-echarts';

import { Button, DatePicker, Empty, Select, Spin, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import { GaugeChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import { fetchAnalyticsOverview } from '#/api/kanban';

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

const loading = ref(false);
const overview = ref<AnalyticsOverview | null>(null);
const query = reactive({
  granularity: 'day' as AnalyticsGranularity,
  operationGroupIds: [] as number[],
  responsibles: [] as string[],
  siteDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  sites: [] as string[],
  transactionStatuses: ['已发放'] as string[],
});

const screenTabs = [
  { index: '01', label: '完成率', state: 'active' },
  { index: '02', label: '评分监控', state: 'pending' },
  { index: '03', label: '排行榜', state: 'pending' },
  { index: '04', label: '新品', state: 'pending' },
  { index: '05', label: '关键指标', state: 'pending' },
];
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
const calendarValue = computed({
  get() {
    return isMonthMode.value
      ? dayjs(query.siteDate).format('YYYY-MM')
      : query.siteDate;
  },
  set(value: string) {
    query.siteDate = isMonthMode.value ? `${value}-01` : value;
  },
});
const targetLabel = computed(() => period.value?.targetLabel ?? '日目标');
const previousLabel = computed(() => period.value?.previousLabel ?? '前一天');
const secondaryLabel = computed(() => period.value?.secondaryLabel ?? '上周同日');
const targetHint = computed(() =>
  isMonthMode.value ? '按所选月份汇总月目标' : '当月目标折算日目标',
);
const metricPrefix = computed(() =>
  isMonthMode.value
    ? '月度'
    : source.value?.mode === 'live_api' && source.value.status === 'ok'
      ? '实时'
      : '站点日',
);
const advertisingPrefix = computed(() =>
  isMonthMode.value ? '所选月份' : '近 30 天',
);
const dateLabel = computed(() => (isMonthMode.value ? '统计月份' : '站点日期(day)'));
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
  (overview.value?.filters.transactionStatuses ?? [
    '已发放',
    '已发放含预算',
  ]).map((value) => ({
    label: value,
    value,
  })),
);

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
    .toSorted(
      (a, b) => a.completionRate - b.completionRate || b.salesQty - a.salesQty,
    );
});

const responsibleCards = computed(() => allResponsibleCards.value.slice(0, 12));

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
      granularity: query.granularity,
      operationGroupIds: query.operationGroupIds,
      responsibles: query.responsibles,
      siteDate: query.siteDate,
      sites: query.sites,
      transactionStatuses: query.transactionStatuses,
    });
    query.granularity = overview.value.query.granularity;
    query.siteDate = overview.value.query.siteDate;
    query.transactionStatuses = overview.value.query.transactionStatuses;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  query.granularity = 'day';
  query.operationGroupIds = [];
  query.responsibles = [];
  query.siteDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  query.sites = [];
  query.transactionStatuses = ['已发放'];
  void loadData();
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
  const salesQty = members.reduce((sum, row) => sum + row.salesQty, 0);
  const dailyTargetUnits = members.reduce(
    (sum, row) => sum + row.dailyTargetUnits,
    0,
  );
  const grossProfit = members.reduce((sum, row) => sum + row.grossProfit, 0);
  const dailyTargetProfit = members.reduce(
    (sum, row) => sum + row.dailyTargetProfit,
    0,
  );
  const salesAmount = members.reduce((sum, row) => sum + row.salesAmount, 0);
  const dailyTargetSales = members.reduce(
    (sum, row) => sum + row.dailyTargetSales,
    0,
  );
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

onMounted(loadData);
</script>

<template>
  <Spin :spinning="loading">
    <div class="completion-screen">
      <header class="screen-tabs">
        <div
          v-for="tab in screenTabs"
          :key="tab.index"
          class="screen-tab"
          :class="{ active: tab.state === 'active' }"
        >
          <b>{{ tab.index }}</b>
          <strong>{{ tab.label }}</strong>
          <em v-if="tab.state === 'pending'">待完善</em>
        </div>
      </header>

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
          v-model:value="calendarValue"
          :disabled-date="disabledFutureDate"
          :picker="isMonthMode ? 'month' : 'date'"
          size="small"
          :value-format="isMonthMode ? 'YYYY-MM' : 'YYYY-MM-DD'"
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
        <Button size="small" type="primary" @click="loadData">查询</Button>
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
                  <strong>{{ formatSalesMoney(weekBefore?.salesAmount) }}</strong>
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
            <div v-if="groupCards.length > 0" class="group-placeholder">
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
            <div v-if="groupCards.length > 0" class="group-placeholder">
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
                <em>{{ advertisingPrefix }}广告花费绝对值 / 总销售额</em>
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
                  <strong>{{ advertising?.startDate }} ~
                    {{ advertising?.endDate }}</strong>
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
                <em>周转库存 / 销售速度 / 30</em>
              </div>
              <div class="comparison-card blue-detail">
                <div>
                  <span>{{ previousLabel }}周转</span>
                  <strong>{{ turnover(previous?.turnoverMonths) }}</strong>
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
                  <span>{{ secondaryLabel }}</span>
                  <strong>{{ turnover(weekBefore?.turnoverMonths) }}</strong>
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
              <span>{{ responsibleCards.length }} 人</span>
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
                  {{ metricPrefix }}销量 <b>{{ formatInteger(item.salesQty) }}</b>
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
                  {{ metricPrefix }}毛利 <b>{{ formatMoney(item.grossProfit) }}</b>
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

      <footer class="screen-note">
        当前已接入：日/月维度、利润表经营数据、目标完成率、推广占比、库存快照、运营组配置和负责人完成率。
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

.screen-tabs,
.screen-toolbar,
.top-board,
.yellow-grid,
.blue-grid,
.group-placeholder,
.responsible-grid {
  display: grid;
  gap: 8px;
}

.screen-tabs {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding: 5px 8px;
  margin-bottom: 8px;
  background: #f8fafc;
  border-top: 3px solid #374151;
}

.screen-tab {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  color: #94a3b8;
  background: #fff;
}

.screen-tab.active {
  color: #1e293b;
  box-shadow: inset 0 -2px #2563eb;
}

.screen-tab b {
  font-size: 18px;
  font-weight: 500;
  color: #cbd5e1;
}

.screen-tab strong {
  font-size: 13px;
}

.screen-tab em {
  margin-left: auto;
  font-size: 10px;
  font-style: normal;
  color: #cbd5e1;
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
.comparison-card strong {
  display: block;
}

.comparison-card strong {
  margin-top: 5px;
  font-size: 17px;
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
  min-height: 123px;
}

.group-placeholder {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 9px;
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
  min-height: 270px;
}

.responsible-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 8px;
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

  .screen-tabs {
    grid-template-columns: 1fr;
  }
}
</style>
