<script setup lang="ts">
import type { NetProfitTrendData } from '#/api/kanban/types';

import { computed } from 'vue';
import VChart from 'vue-echarts';

import { Empty, Spin } from 'ant-design-vue';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

type MetricKey = keyof NetProfitTrendData['metrics'];
type MetricKind = 'money' | 'multiple' | 'percent';

interface MetricDefinition {
  color: string;
  kind: MetricKind;
  label: string;
}

interface TooltipItem {
  axisValueLabel: string;
  data: null | number;
  marker: string;
  seriesName: string;
}

const props = withDefaults(
  defineProps<{
    data: NetProfitTrendData | null;
    height?: string;
    loading?: boolean;
    selectedMetrics?: string[];
  }>(),
  {
    height: '400px',
    loading: false,
    selectedMetrics: () => ['netProfit'],
  },
);

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
]);

const metricDefinitions: Record<MetricKey, MetricDefinition> = {
  cashIncome: { color: '#ca8a04', kind: 'money', label: '回款收入' },
  grossMarginRate: { color: '#c026d3', kind: 'percent', label: '毛利率' },
  grossProfit: { color: '#7c3aed', kind: 'money', label: '毛利润' },
  investment: { color: '#dc2626', kind: 'money', label: '投入' },
  marketingFeeRate: {
    color: '#0891b2',
    kind: 'percent',
    label: '营销费率',
  },
  netProfit: { color: '#2563eb', kind: 'money', label: '净利润' },
  otherFeeRate: { color: '#65a30d', kind: 'percent', label: '其他费率' },
  roi: { color: '#059669', kind: 'multiple', label: 'ROI' },
  standardFeeRate: {
    color: '#ea580c',
    kind: 'percent',
    label: '标准费率',
  },
};

const chartUpdateOptions = { notMerge: true };

function isMetricKey(value: string): value is MetricKey {
  return value in metricDefinitions;
}

function displayValue(value: null | number, kind: MetricKind) {
  if (value === null) return null;
  return kind === 'percent' ? value * 100 : value;
}

function formatValue(value: null | number, kind: MetricKind) {
  if (value === null) return '—';
  if (kind === 'percent') return `${(value * 100).toFixed(2)}%`;
  if (kind === 'multiple') return value.toFixed(2);
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

const selectedDefinitions = computed(() =>
  props.selectedMetrics
    .filter(isMetricKey)
    .map((key) => ({ key, ...metricDefinitions[key] })),
);

const hasData = computed(
  () =>
    Boolean(props.data?.periods.length) && selectedDefinitions.value.length > 0,
);

const option = computed(() => {
  const data = props.data;
  const definitions = selectedDefinitions.value;
  if (!data) return {};

  const series: Array<Record<string, unknown>> = definitions.map(
    (definition, index) => ({
      data: data.metrics[definition.key].map((value) =>
        displayValue(value, definition.kind),
      ),
      emphasis: { focus: 'series' },
      itemStyle: { color: definition.color },
      lineStyle: { width: 2 },
      name: definition.label,
      showSymbol: data.periods.length <= 12,
      smooth: 0.2,
      symbol: 'circle',
      symbolSize: 5,
      type: 'line',
      yAxisIndex: index,
    }),
  );

  if (definitions.some(({ key }) => key === 'netProfit')) {
    series.push(
      {
        data: data.movingAverage.ma3,
        emphasis: { focus: 'series' },
        itemStyle: { color: '#60a5fa' },
        lineStyle: { type: 'dashed', width: 1 },
        name: '净利润 MA3',
        showSymbol: false,
        smooth: 0.2,
        symbol: 'none',
        symbolSize: 0,
        type: 'line',
        yAxisIndex: 0,
      },
      {
        data: data.movingAverage.ma6,
        emphasis: { focus: 'series' },
        itemStyle: { color: '#93c5fd' },
        lineStyle: { type: 'dotted', width: 1 },
        name: '净利润 MA6',
        showSymbol: false,
        smooth: 0.2,
        symbol: 'none',
        symbolSize: 0,
        type: 'line',
        yAxisIndex: 0,
      },
    );
  }

  return {
    animationDuration: 300,
    grid: {
      bottom: 36,
      left: 14,
      outerBoundsContain: 'axisLabel',
      outerBoundsMode: 'same',
      right: 14,
      top: 48,
    },
    legend: { itemHeight: 8, itemWidth: 18, top: 4 },
    series,
    tooltip: {
      confine: true,
      formatter: (items: TooltipItem[]) => {
        const title = items[0]?.axisValueLabel ?? '';
        const lines = items.map((item) => {
          const definition = definitions.find(
            ({ label }) => label === item.seriesName,
          );
          const kind = definition?.kind ?? 'money';
          const rawValue =
            kind === 'percent' && item.data !== null
              ? item.data / 100
              : item.data;
          return `${item.marker}${item.seriesName}  ${formatValue(rawValue, kind)}`;
        });
        return [title, ...lines].join('\n');
      },
      renderMode: 'richText',
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: '#64748b', hideOverlap: true },
      axisLine: { lineStyle: { color: '#dbe3ee' } },
      boundaryGap: false,
      data: data.periodLabels,
      type: 'category',
    },
    yAxis: definitions.map((definition, index) => ({
      axisLabel: {
        color: '#64748b',
        formatter: (value: number) => {
          if (definition.kind === 'percent') return `${value.toFixed(0)}%`;
          if (definition.kind === 'multiple') return value.toFixed(1);
          return Number(value).toLocaleString('zh-CN', {
            maximumFractionDigits: 1,
            notation: 'compact',
          });
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      position: index % 2 === 0 ? 'left' : 'right',
      show: index < 2,
      splitLine: {
        lineStyle: { color: '#e8edf4', type: 'dashed' },
        show: index === 0,
      },
      type: 'value',
    })),
  };
});
</script>

<template>
  <div class="trend-chart-wrapper">
    <Spin :spinning="loading">
      <div v-if="hasData" class="chart" :style="{ height }">
        <VChart
          :option="option"
          :update-options="chartUpdateOptions"
          autoresize
        />
      </div>
      <Empty
        v-else-if="!loading"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
        description="当前筛选范围暂无趋势数据"
      />
    </Spin>
  </div>
</template>

<style scoped>
.trend-chart-wrapper,
.chart,
.chart > div {
  width: 100%;
}

.chart > div {
  height: 100%;
}

.trend-chart-wrapper :deep(.ant-empty) {
  margin: 120px 0;
}
</style>
