<script setup lang="ts">
import type { KanbanTrendPoint } from '#/api/kanban/types';

import { computed } from 'vue';
import { Card } from 'ant-design-vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

const props = defineProps<{
  trend: KanbanTrendPoint[];
}>();

const option = computed(() => ({
  color: ['#2563eb', '#16a34a', '#d97706'],
  tooltip: {
    trigger: 'axis',
    valueFormatter: (value: number) => Number(value).toLocaleString(),
  },
  legend: {
    right: 10,
    top: 2,
    data: ['销售额', '销量', '广告花费'],
  },
  grid: {
    bottom: 34,
    left: 48,
    right: 24,
    top: 48,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.trend.map((item) => item.date.slice(5)),
  },
  yAxis: [
    {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => `${Math.round(value / 1000)}k`,
      },
    },
    {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => `${value}`,
      },
    },
  ],
  series: [
    {
      name: '销售额',
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: props.trend.map((item) => item.salesAmount),
    },
    {
      name: '销量',
      type: 'line',
      smooth: true,
      symbol: 'none',
      yAxisIndex: 1,
      data: props.trend.map((item) => item.salesQty),
    },
    {
      name: '广告花费',
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: props.trend.map((item) => item.adSpend),
    },
  ],
}));
</script>

<template>
  <Card title="近30天核心趋势" :body-style="{ padding: '14px 16px 10px' }">
    <VChart :option="option" autoresize style="height: 318px" />
  </Card>
</template>
