<script setup lang="ts">
import type { NetProfitCostDriverData } from '#/api/kanban/types';

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
    data: NetProfitCostDriverData | null;
    height?: string;
    loading?: boolean;
  }>(),
  {
    height: '330px',
    loading: false,
  },
);

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent]);

const chartUpdateOptions = { notMerge: true };
const drivers = computed(() =>
  (props.data?.drivers ?? []).toSorted(
    (left, right) => Math.abs(right.change) - Math.abs(left.change),
  ),
);
const hasData = computed(() => drivers.value.length > 0);

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

const option = computed(() => ({
  animationDuration: 300,
  grid: {
    bottom: 18,
    left: 14,
    outerBoundsContain: 'axisLabel',
    outerBoundsMode: 'same',
    right: 54,
    top: 18,
  },
  series: [
    {
      data: drivers.value.map((driver) => ({
        itemStyle: { color: driver.change >= 0 ? '#059669' : '#dc2626' },
        value: driver.change,
      })),
      label: {
        color: '#475569',
        formatter: ({ dataIndex }: { dataIndex: number }) => {
          const driver = drivers.value[dataIndex];
          if (!driver) return '';
          return `${formatMoney(driver.change)} / ${(driver.contribution * 100).toFixed(1)}%`;
        },
        position: 'right',
        show: true,
      },
      type: 'bar',
    },
  ],
  tooltip: {
    confine: true,
    formatter: (items: TooltipItem[]) => {
      const driver = drivers.value[items[0]?.dataIndex ?? 0];
      if (!driver) return '';
      return [
        driver.name,
        `本期：${formatMoney(driver.currentValue)}`,
        `上期：${formatMoney(driver.previousValue)}`,
        `原始变化：${formatMoney(driver.rawChange)}`,
        `纯利影响：${formatMoney(driver.change)}`,
        `变动贡献：${(driver.contribution * 100).toFixed(2)}%`,
      ].join('\n');
    },
    renderMode: 'richText',
    trigger: 'axis',
  },
  xAxis: {
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
  yAxis: {
    axisLabel: { color: '#475569' },
    axisLine: { show: false },
    axisTick: { show: false },
    data: drivers.value.map((driver) => driver.name),
    inverse: true,
    type: 'category',
  },
}));
</script>

<template>
  <div class="cost-driver-wrapper">
    <div v-if="data" class="comparison-summary">
      <span>{{ data.previousPeriod }} → {{ data.currentPeriod }}</span>
      <strong :class="data.totalChange >= 0 ? 'is-positive' : 'is-negative'">
        纯利变动 {{ formatMoney(data.totalChange) }}
      </strong>
    </div>
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
        description="暂无可比较的上期数据"
      />
    </Spin>
  </div>
</template>

<style scoped>
.cost-driver-wrapper,
.chart,
.chart > div {
  width: 100%;
}

.chart > div {
  height: 100%;
}

.comparison-summary {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: #64748b;
}

.comparison-summary strong {
  font-weight: 700;
}

.is-positive {
  color: #047857;
}

.is-negative {
  color: #b91c1c;
}

.cost-driver-wrapper :deep(.ant-empty) {
  margin: 90px 0;
}

@media (width <= 640px) {
  .comparison-summary {
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
  }
}
</style>
