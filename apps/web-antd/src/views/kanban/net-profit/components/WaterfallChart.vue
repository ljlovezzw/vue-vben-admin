<script setup lang="ts">
import type { NetProfitWaterfallData } from '#/api/kanban/types';

import { computed } from 'vue';
import VChart from 'vue-echarts';

import { Empty, Spin } from 'ant-design-vue';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

interface TooltipItem {
  dataIndex: number;
}

const props = withDefaults(
  defineProps<{
    data: NetProfitWaterfallData | null;
    height?: string;
    loading?: boolean;
  }>(),
  {
    height: '400px',
    loading: false,
  },
);

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent]);

const chartUpdateOptions = { notMerge: true };
const hasData = computed(() => Boolean(props.data?.steps.length));

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function totalColor(value: number, isLast: boolean) {
  if (!isLast) return '#2563eb';
  return value >= 0 ? '#059669' : '#dc2626';
}

const option = computed(() => {
  const data = props.data;
  if (!data) return {};

  const assist: number[] = [];
  const decrease: Array<number | string> = [];
  const total: Array<number | string> = [];

  data.steps.forEach((step) => {
    if (step.type === 'decrease') {
      assist.push(Math.min(step.cumulative, step.cumulative - step.value));
      decrease.push(Math.abs(step.value));
      total.push('-');
      return;
    }
    assist.push(0);
    decrease.push('-');
    total.push(step.value);
  });

  return {
    animationDuration: 300,
    grid: {
      bottom: 42,
      left: 14,
      outerBoundsContain: 'axisLabel',
      outerBoundsMode: 'same',
      right: 14,
      top: 30,
    },
    series: [
      {
        data: assist,
        emphasis: { disabled: true },
        itemStyle: { borderColor: 'transparent', color: 'transparent' },
        stack: 'profit',
        tooltip: { show: false },
        type: 'bar',
      },
      {
        data: decrease,
        itemStyle: { color: '#dc2626' },
        label: {
          color: '#991b1b',
          formatter: ({ value }: { value: number | string }) =>
            value === '-' ? '' : `-${formatMoney(Number(value))}`,
          position: 'top',
          show: true,
        },
        name: '费用侵蚀',
        stack: 'profit',
        type: 'bar',
      },
      {
        data: total.map((value, index) => ({
          itemStyle: {
            color: totalColor(Number(value), index === data.steps.length - 1),
          },
          value,
        })),
        label: {
          color: '#334155',
          formatter: ({ value }: { value: number | string }) =>
            value === '-' ? '' : formatMoney(Number(value)),
          position: 'top',
          show: true,
        },
        name: '经营结果',
        stack: 'profit',
        type: 'bar',
      },
    ],
    tooltip: {
      confine: true,
      formatter: (items: TooltipItem[]) => {
        const step = data.steps[items[0]?.dataIndex ?? 0];
        if (!step) return '';
        return [
          step.label,
          `本项：${formatMoney(step.value)}`,
          `累计：${formatMoney(step.cumulative)}`,
          `占回款：${(step.percentage * 100).toFixed(2)}%`,
        ].join('\n');
      },
      renderMode: 'richText',
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: '#64748b', interval: 0 },
      axisLine: { lineStyle: { color: '#dbe3ee' } },
      data: data.steps.map((step) => step.label),
      type: 'category',
    },
    yAxis: {
      axisLabel: {
        color: '#64748b',
        formatter: (value: number) =>
          Number(value).toLocaleString('zh-CN', {
            maximumFractionDigits: 1,
            notation: 'compact',
          }),
      },
      splitLine: { lineStyle: { color: '#e8edf4', type: 'dashed' } },
      type: 'value',
    },
  };
});
</script>

<template>
  <div class="waterfall-chart-wrapper">
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
        description="当前筛选范围暂无利润桥数据"
      />
    </Spin>
  </div>
</template>

<style scoped>
.waterfall-chart-wrapper,
.chart,
.chart > div {
  width: 100%;
}

.chart > div {
  height: 100%;
}

.waterfall-chart-wrapper :deep(.ant-empty) {
  margin: 120px 0;
}
</style>
