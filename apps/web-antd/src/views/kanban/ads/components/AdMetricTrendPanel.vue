<script setup lang="ts">
import type { AdMonitorOverviewParams } from '#/api/kanban';
import type {
  AdMonitorTrend,
  AdTrendMetrics,
  AdTrendPoint,
} from '#/api/kanban/types';

import { computed, onBeforeUnmount, ref, watch } from 'vue';
import VChart from 'vue-echarts';

import { Button, Empty, Spin, Tooltip } from 'ant-design-vue';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import { fetchAdMonitorTrend } from '#/api/kanban';

type MetricKey = keyof AdTrendMetrics;
type MetricKind = 'count' | 'decimal' | 'money' | 'percent';

interface MetricDefinition {
  aggregation: '平均' | '总和';
  key: MetricKey;
  kind: MetricKind;
  label: string;
}

interface TooltipItem {
  axisValue: string;
  color: string;
  data: number;
  marker: string;
  seriesName: string;
}

const props = withDefaults(
  defineProps<{
    compact?: boolean;
    params: AdMonitorOverviewParams;
  }>(),
  {
    compact: false,
  },
);

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

const defaultMetricDefinition: MetricDefinition = {
  aggregation: '总和',
  key: 'impressions',
  kind: 'count',
  label: '曝光量',
};
const metricDefinitions: MetricDefinition[] = [
  defaultMetricDefinition,
  { aggregation: '总和', key: 'clicks', kind: 'count', label: '点击' },
  { aggregation: '平均', key: 'ctr', kind: 'percent', label: 'CTR' },
  { aggregation: '平均', key: 'cpc', kind: 'money', label: 'CPC' },
  { aggregation: '总和', key: 'spend', kind: 'money', label: '花费' },
  { aggregation: '总和', key: 'adSales', kind: 'money', label: '广告销售额' },
  { aggregation: '总和', key: 'acos', kind: 'percent', label: 'ACoS' },
  { aggregation: '总和', key: 'roas', kind: 'decimal', label: 'ROAS' },
  { aggregation: '总和', key: 'adOrders', kind: 'count', label: '广告订单' },
  {
    aggregation: '总和',
    key: 'directOrders',
    kind: 'count',
    label: '直接订单',
  },
  { aggregation: '平均', key: 'cpa', kind: 'money', label: 'CPA' },
  { aggregation: '平均', key: 'cvr', kind: 'percent', label: 'CVR' },
  {
    aggregation: '平均',
    key: 'adUnitPrice',
    kind: 'money',
    label: '广告笔单价',
  },
  { aggregation: '总和', key: 'adUnits', kind: 'count', label: '广告销量' },
  {
    aggregation: '总和',
    key: 'indirectOrders',
    kind: 'count',
    label: '间接单量',
  },
  {
    aggregation: '总和',
    key: 'indirectUnits',
    kind: 'count',
    label: '间接销量',
  },
];

const metricMap = new Map(
  metricDefinitions.map((definition) => [definition.key, definition]),
);
const defaultChartColor = '#0f91e8';
const chartColors = [
  defaultChartColor,
  '#f5b700',
  '#17a673',
  '#e05d44',
  '#7656d6',
  '#00a3a3',
  '#d85892',
  '#62748a',
  '#5f8f29',
  '#c67324',
  '#4169b1',
  '#b4483f',
  '#6d7f20',
  '#267a84',
  '#9255a6',
  '#8a6650',
];
const loading = ref(false);
const trend = ref<AdMonitorTrend | null>(null);
const chartUpdateOptions = { notMerge: true };
const selectedMetrics = ref<MetricKey[]>([
  'clicks',
  'spend',
  'adOrders',
  'adSales',
]);
const visibleMetrics = ref<MetricKey[]>([...selectedMetrics.value]);
const metricCatalogOpen = ref(false);
let controller: AbortController | null = null;

function definitionFor(key: MetricKey) {
  return metricMap.get(key) ?? defaultMetricDefinition;
}

function formatValue(value: number, kind: MetricKind, compact = false) {
  const normalized = Number(value || 0);
  if (kind === 'percent') return `${(normalized * 100).toFixed(2)}%`;
  if (kind === 'money') {
    return `$${normalized.toLocaleString('en-US', {
      maximumFractionDigits: compact ? 0 : 2,
    })}`;
  }
  if (kind === 'decimal') return normalized.toFixed(2);
  return normalized.toLocaleString('en-US', {
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  });
}

function axisValue(value: number, kind: MetricKind) {
  if (kind === 'percent') return `${(Number(value || 0) * 100).toFixed(0)}%`;
  if (kind === 'money') {
    return `$${Number(value || 0).toLocaleString('en-US', {
      maximumFractionDigits: 0,
      notation: 'compact',
    })}`;
  }
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 1,
    notation: 'compact',
  });
}

function metricColor(key: MetricKey) {
  const index = metricDefinitions.findIndex(
    (definition) => definition.key === key,
  );
  return (
    chartColors[Math.max(index, 0) % chartColors.length] ?? defaultChartColor
  );
}

function isMetricSelected(key: MetricKey) {
  return selectedMetrics.value.includes(key);
}

function isMetricVisible(key: MetricKey) {
  return visibleMetrics.value.includes(key);
}

function addMetric(key: MetricKey) {
  if (!isMetricSelected(key)) selectedMetrics.value.push(key);
  if (!isMetricVisible(key)) visibleMetrics.value.push(key);
}

function toggleMetricVisibility(key: MetricKey) {
  const index = visibleMetrics.value.indexOf(key);
  if (index === -1) {
    visibleMetrics.value.push(key);
  } else {
    visibleMetrics.value.splice(index, 1);
  }
}

function removeMetric(index: number) {
  if (selectedMetrics.value.length <= 1) return;
  const [removed] = selectedMetrics.value.splice(index, 1);
  if (!removed) return;
  const visibleIndex = visibleMetrics.value.indexOf(removed);
  if (visibleIndex !== -1) visibleMetrics.value.splice(visibleIndex, 1);
}

async function loadTrend() {
  controller?.abort();
  const nextController = new AbortController();
  controller = nextController;
  loading.value = true;
  try {
    trend.value = await fetchAdMonitorTrend(
      props.params,
      nextController.signal,
    );
  } catch {
    if (!nextController.signal.aborted) trend.value = null;
  } finally {
    if (controller === nextController) {
      controller = null;
      loading.value = false;
    }
  }
}

const hasData = computed(() =>
  visibleMetrics.value.some(
    (key) => Number(trend.value?.summary[key] || 0) !== 0,
  ),
);

const option = computed(() => {
  const rows = trend.value?.rows ?? [];
  const selected = visibleMetrics.value.map((key) => definitionFor(key));
  let chartTop = 42;
  if (selected.length > 8) {
    chartTop = 82;
  } else if (selected.length > 4) {
    chartTop = 60;
  }
  return {
    animationDuration: 380,
    color: selected.map((metric) => metricColor(metric.key)),
    grid: {
      bottom: 38,
      containLabel: true,
      left: 12,
      right: 12,
      top: chartTop,
    },
    legend: {
      data: selected.map((metric) => metric.label),
      itemHeight: 8,
      itemWidth: 18,
      top: 4,
    },
    series: selected.map((metric, index) => ({
      data: rows.map((row: AdTrendPoint) => Number(row[metric.key] || 0)),
      emphasis: { focus: 'series' },
      lineStyle: { width: 2 },
      name: metric.label,
      showSymbol: rows.length <= 14,
      smooth: 0.25,
      symbol: 'circle',
      symbolSize: 5,
      type: 'line',
      yAxisIndex: index,
    })),
    tooltip: {
      borderColor: '#d8e1ec',
      confine: true,
      formatter: (items: TooltipItem[]) => {
        const title = items[0]?.axisValue ?? '';
        const lines = items.map((item, index) => {
          const metric = selected[index];
          return `${item.marker}${item.seriesName}&nbsp;<b>${formatValue(
            item.data,
            metric?.kind ?? 'decimal',
          )}</b>`;
        });
        return [title, ...lines].join('<br/>');
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: '#708197', hideOverlap: true },
      axisLine: { lineStyle: { color: '#d7e0eb' } },
      boundaryGap: false,
      data: rows.map((row: AdTrendPoint) => row.date.slice(5)),
      type: 'category',
    },
    yAxis: selected.map((metric, index) => ({
      axisLabel: {
        color: '#708197',
        formatter: (value: number) => axisValue(value, metric.kind),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      min: 0,
      position: index % 2 === 0 ? 'left' : 'right',
      show: index < 2,
      splitLine: {
        lineStyle: { color: '#e5edf6', type: 'dashed' },
        show: index === 0,
      },
      type: 'value',
    })),
  };
});

watch(
  () => JSON.stringify(props.params),
  () => {
    void loadTrend();
  },
  { immediate: true },
);

onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <section class="ad-trend-panel" :class="{ 'is-compact': props.compact }">
    <header v-if="!props.compact" class="trend-head">
      <div>
        <h3>广告趋势</h3>
        <span v-if="trend">
          {{ trend.period.startDate }} 至 {{ trend.period.endDate }}
        </span>
      </div>
      <span v-if="trend?.dataUpdatedAt" class="updated-at">
        数据更新 {{ trend.dataUpdatedAt }}
      </span>
    </header>

    <Spin :spinning="loading">
      <div class="metric-selector">
        <article
          v-for="(key, index) in selectedMetrics"
          :key="`${key}-${index}`"
          :aria-pressed="isMetricVisible(key)"
          class="selected-metric"
          :class="{ 'is-hidden': !isMetricVisible(key) }"
          role="button"
          :style="{
            '--metric-color': metricColor(key),
          }"
          tabindex="0"
          @click="toggleMetricVisibility(key)"
          @keydown.enter="toggleMetricVisibility(key)"
          @keydown.space.prevent="toggleMetricVisibility(key)"
        >
          <span class="metric-name">
            {{ definitionFor(key).label }}（{{
              definitionFor(key).aggregation
            }}）
          </span>
          <strong>
            {{
              formatValue(
                Number(trend?.summary[key] || 0),
                definitionFor(key).kind,
              )
            }}
          </strong>
          <Tooltip v-if="selectedMetrics.length > 1" title="移除指标">
            <button
              aria-label="移除指标"
              class="remove-metric"
              type="button"
              @click.stop="removeMetric(index)"
            >
              ×
            </button>
          </Tooltip>
        </article>

        <Button
          class="add-metric"
          type="dashed"
          @click="metricCatalogOpen = !metricCatalogOpen"
        >
          <span aria-hidden="true">＋</span>
          添加指标
        </Button>

        <div v-if="metricCatalogOpen" class="metric-catalog">
          <button
            v-for="definition in metricDefinitions"
            :key="definition.key"
            :class="{ 'is-selected': isMetricSelected(definition.key) }"
            type="button"
            @click="addMetric(definition.key)"
          >
            <i
              aria-hidden="true"
              :style="{ backgroundColor: metricColor(definition.key) }"
            ></i>
            <span>
              {{ definition.label }}（{{ definition.aggregation }}）
            </span>
            <b>{{ isMetricSelected(definition.key) ? '已添加' : '添加' }}</b>
          </button>
        </div>
      </div>

      <div
        v-if="trend && visibleMetrics.length > 0 && hasData"
        class="chart-wrap"
      >
        <VChart
          :option="option"
          :update-options="chartUpdateOptions"
          autoresize
        />
      </div>
      <Empty
        v-else-if="!loading"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
        :description="
          visibleMetrics.length === 0
            ? '当前未展示指标'
            : '当前筛选范围暂无广告趋势数据'
        "
      />
    </Spin>
  </section>
</template>

<style scoped>
.ad-trend-panel {
  overflow: hidden;
  color: #27364a;
  background: #fff;
  border: 1px solid #d8e1ec;
  border-radius: 6px;
}

.trend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 7px 12px;
  border-bottom: 1px solid #e2e8f0;
}

.trend-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #172033;
  letter-spacing: 0;
}

.trend-head span {
  font-size: 11px;
  color: #718096;
}

.updated-at {
  white-space: nowrap;
}

.metric-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
  padding: 12px;
  background: #f8fbff;
  border-bottom: 1px solid #e2e8f0;
}

.selected-metric {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 68px;
  padding: 7px 12px 8px 14px;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dce4ee;
  border-radius: 5px;
  box-shadow: inset 4px 0 var(--metric-color);
  transition:
    opacity 160ms ease,
    background-color 160ms ease;
}

.selected-metric.is-hidden {
  background: #f3f6fa;
  box-shadow: inset 4px 0 #c7d0dc;
  opacity: 0.55;
}

.selected-metric:focus-visible {
  outline: 2px solid #84adff;
  outline-offset: 1px;
}

.metric-name {
  grid-column: 1 / 3;
  align-self: center;
  margin-right: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 700;
  color: #44546a;
  white-space: nowrap;
}

.selected-metric strong {
  grid-column: 1 / 3;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 20px;
  line-height: 1.15;
  color: #27364a;
  white-space: nowrap;
}

.remove-metric {
  position: absolute;
  top: 4px;
  right: 5px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 17px;
  line-height: 1;
  color: #8795a8;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.remove-metric:hover {
  color: #cf3d35;
}

.remove-metric:focus-visible {
  outline: 2px solid #84adff;
}

.add-metric {
  height: 68px;
  color: #175cd3;
  background: #f8fbff;
  border-color: #84adff;
}

.metric-catalog {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-column: 1 / -1;
  gap: 8px;
  padding: 10px;
  background: #fff;
  border: 1px solid #d7e0eb;
  border-radius: 5px;
}

.metric-catalog button {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 6px 9px;
  color: #344054;
  text-align: left;
  cursor: pointer;
  background: #f8fafc;
  border: 1px solid #e1e7ef;
  border-radius: 4px;
}

.metric-catalog button:hover {
  color: #175cd3;
  background: #f0f6ff;
  border-color: #84adff;
}

.metric-catalog button.is-selected {
  color: #667085;
  cursor: default;
  background: #f4f6f8;
  border-color: #e4e7ec;
}

.metric-catalog i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.metric-catalog span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-catalog b {
  font-size: 11px;
  font-weight: 600;
  color: #175cd3;
}

.metric-catalog button.is-selected b {
  color: #98a2b3;
}

.chart-wrap {
  height: 320px;
  padding: 2px 8px 4px;
}

.chart-wrap > div {
  height: 100%;
}

.ad-trend-panel > :deep(.ant-spin-nested-loading),
.ad-trend-panel > :deep(.ant-spin-container) {
  min-height: 240px;
}

.ad-trend-panel :deep(.ant-empty) {
  margin: 72px 0;
}

.ad-trend-panel.is-compact {
  border: 0;
  border-bottom: 1px solid var(--analytics-border, #e2e8f0);
  border-radius: 0;
}

.ad-trend-panel.is-compact .metric-selector {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  padding: 8px 10px;
}

.ad-trend-panel.is-compact .selected-metric {
  min-height: 56px;
  padding: 6px 10px 7px 12px;
}

.ad-trend-panel.is-compact .metric-name {
  font-size: 12px;
}

.ad-trend-panel.is-compact .selected-metric strong {
  font-size: 18px;
}

.ad-trend-panel.is-compact .add-metric {
  height: 56px;
}

.ad-trend-panel.is-compact .chart-wrap {
  height: 250px;
}

.ad-trend-panel.is-compact > :deep(.ant-spin-nested-loading),
.ad-trend-panel.is-compact > :deep(.ant-spin-container) {
  min-height: 190px;
}

.ad-trend-panel.is-compact :deep(.ant-empty) {
  margin: 48px 0;
}

@media (width <= 1180px) {
  .metric-selector {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .metric-catalog {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width <= 760px) {
  .trend-head {
    align-items: flex-start;
  }

  .metric-selector {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-catalog {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
