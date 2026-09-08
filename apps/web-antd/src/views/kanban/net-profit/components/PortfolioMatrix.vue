<script setup lang="ts">
import type {
  NetProfitPortfolioData,
  NetProfitPortfolioItem,
} from '#/api/kanban/types';

import { computed } from 'vue';
import VChart from 'vue-echarts';

import { Empty, Spin } from 'ant-design-vue';
import { ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

interface QuadrantDefinition {
  color: string;
  key: NetProfitPortfolioItem['quadrant'];
  label: string;
}

interface TooltipItem {
  data: {
    item: NetProfitPortfolioItem;
  };
}

const props = withDefaults(
  defineProps<{
    data: NetProfitPortfolioData | null;
    height?: string;
    loading?: boolean;
  }>(),
  {
    height: '440px',
    loading: false,
  },
);

use([
  CanvasRenderer,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
]);

const unclassifiedQuadrant: QuadrantDefinition = {
  color: '#94a3b8',
  key: 'unclassified',
  label: '缺少比较期',
};

const quadrantDefinitions: QuadrantDefinition[] = [
  { color: '#059669', key: 'star', label: '高贡献·增长' },
  { color: '#2563eb', key: 'cashCow', label: '高贡献·承压' },
  { color: '#ca8a04', key: 'questionMark', label: '低贡献·增长' },
  { color: '#dc2626', key: 'dog', label: '低贡献·承压' },
  unclassifiedQuadrant,
];

const chartUpdateOptions = { notMerge: true };
const classifiedItems = computed(() =>
  (props.data?.items ?? []).filter(
    (item): item is NetProfitPortfolioItem & { growthRate: number } =>
      item.growthRate !== null && item.quadrant !== 'unclassified',
  ),
);
const unclassifiedItems = computed(() =>
  (props.data?.items ?? [])
    .filter((item) => item.quadrant === 'unclassified')
    .toSorted((left, right) => right.netProfit - left.netProfit),
);
const maxCashIncome = computed(() =>
  Math.max(
    ...classifiedItems.value.map((item) => Math.abs(item.cashIncome)),
    1,
  ),
);
const hasData = computed(() => Boolean(props.data?.items.length));
const hasClassifiedData = computed(() => classifiedItems.value.length > 0);

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function quadrantDefinition(key: NetProfitPortfolioItem['quadrant']) {
  return (
    quadrantDefinitions.find((definition) => definition.key === key) ??
    unclassifiedQuadrant
  );
}

function comparisonBasisLabel(
  basis: NetProfitPortfolioData['methodology']['comparisonBasis'] | undefined,
) {
  if (basis === 'yoy') return '同比';
  if (basis === 'sequential') return '环比';
  if (basis === 'custom') return '自定义基期';
  return '无可用基期';
}

const summary = computed(() =>
  quadrantDefinitions.map((definition) => ({
    ...definition,
    count: props.data?.quadrants[definition.key] ?? 0,
  })),
);

const option = computed(() => {
  const data = props.data;
  if (!data) return {};

  return {
    animationDuration: 300,
    grid: {
      bottom: 44,
      left: 16,
      outerBoundsContain: 'axisLabel',
      outerBoundsMode: 'same',
      right: 20,
      top: 54,
    },
    legend: { itemHeight: 9, itemWidth: 14, top: 4 },
    series: quadrantDefinitions
      .filter(({ key }) => key !== 'unclassified')
      .map((definition) => ({
        data: classifiedItems.value
          .filter((item) => item.quadrant === definition.key)
          .map((item) => ({
            item,
            name: item.name,
            value: [item.growthRate * 100, item.profitContribution * 100],
          })),
        itemStyle: { color: definition.color, opacity: 0.82 },
        label: {
          color: '#334155',
          formatter: '{b}',
          position: 'top',
          show: classifiedItems.value.length <= 20,
        },
        name: definition.label,
        symbolSize: (
          _value: unknown,
          { data: point }: { data: { item: NetProfitPortfolioItem } },
        ) =>
          14 +
          Math.sqrt(Math.abs(point.item.cashIncome) / maxCashIncome.value) * 42,
        type: 'scatter',
      })),
    tooltip: {
      confine: true,
      formatter: ({ data: tooltipData }: TooltipItem) => {
        const item = tooltipData.item;
        const definition = quadrantDefinition(item.quadrant);
        return [
          item.name,
          `经营分组：${definition.label}`,
          `纯利增长：${((item.growthRate ?? 0) * 100).toFixed(2)}%`,
          `正利润贡献：${(item.profitContribution * 100).toFixed(2)}%`,
          `回款收入：${formatMoney(item.cashIncome)}`,
          `净利润：${formatMoney(item.netProfit)}`,
          `ROI：${item.roi.toFixed(2)}`,
        ].join('\n');
      },
      renderMode: 'richText',
      trigger: 'item',
    },
    xAxis: {
      axisLabel: { color: '#64748b', formatter: '{value}%' },
      axisLine: { lineStyle: { color: '#94a3b8' }, onZero: true },
      name: '纯利增长率',
      nameLocation: 'middle',
      nameTextStyle: { color: '#475569', padding: 24 },
      splitLine: { lineStyle: { color: '#e8edf4', type: 'dashed' } },
      type: 'value',
    },
    yAxis: {
      axisLabel: { color: '#64748b', formatter: '{value}%' },
      axisLine: { lineStyle: { color: '#94a3b8' }, onZero: true },
      name: '正利润贡献',
      nameLocation: 'middle',
      nameTextStyle: { color: '#475569', padding: 30 },
      splitLine: { lineStyle: { color: '#e8edf4', type: 'dashed' } },
      type: 'value',
    },
  };
});
</script>

<template>
  <div class="portfolio-matrix-wrapper">
    <Spin :spinning="loading">
      <div v-if="hasData">
        <div class="quadrant-summary" aria-label="经营组合分类统计">
          <span v-for="item in summary" :key="item.key" class="quadrant-chip">
            <i :style="{ backgroundColor: item.color }"></i>
            {{ item.label }}
            <strong>{{ item.count }}</strong>
          </span>
        </div>
        <div v-if="hasClassifiedData" class="chart" :style="{ height }">
          <VChart
            :option="option"
            :update-options="chartUpdateOptions"
            autoresize
          />
        </div>
        <section v-else class="current-period-fallback">
          <header>
            <div>
              <strong>当前期经营结果</strong>
              <span>没有完整比较基期，暂不计算增长率和四象限分类。</span>
            </div>
            <b>{{ data?.currentPeriod }}</b>
          </header>
          <div class="fallback-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>对象</th>
                  <th>净利润</th>
                  <th>正利润贡献</th>
                  <th>ROI</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in unclassifiedItems" :key="item.name">
                  <td>{{ item.name }}</td>
                  <td
                    :class="item.netProfit >= 0 ? 'is-positive' : 'is-negative'"
                  >
                    {{ formatMoney(item.netProfit) }}
                  </td>
                  <td>{{ (item.profitContribution * 100).toFixed(2) }}%</td>
                  <td>{{ item.roi.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <div class="methodology-note">
          <span>
            比较方式：{{
              comparisonBasisLabel(data?.methodology.comparisonBasis)
            }}
            <template v-if="data?.comparePeriod !== '未选择'">
              · {{ data?.comparePeriod }} → {{ data?.currentPeriod }}
            </template>
          </span>
          <span v-if="data?.methodology.note">口径：{{ data.methodology.note }}</span>
        </div>
      </div>
      <Empty
        v-else-if="!loading"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
        description="当前筛选范围暂无组合数据"
      />
    </Spin>
  </div>
</template>

<style scoped>
.portfolio-matrix-wrapper,
.chart,
.chart > div {
  width: 100%;
}

.chart > div {
  height: 100%;
}

.quadrant-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.quadrant-chip {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  min-height: 30px;
  padding: 4px 9px;
  font-size: 12px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.quadrant-chip i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.quadrant-chip strong {
  color: #0f172a;
}

.methodology-note {
  display: grid;
  gap: 2px;
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.5;
  color: #64748b;
}

.current-period-fallback {
  min-height: 340px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
}

.current-period-fallback header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.current-period-fallback header div {
  display: grid;
  gap: 2px;
}

.current-period-fallback header strong {
  font-size: 13px;
  color: #172033;
}

.current-period-fallback header span,
.current-period-fallback header b {
  font-size: 11px;
  color: #64748b;
}

.fallback-table-wrap {
  max-height: 290px;
  overflow: auto;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.fallback-table-wrap table {
  width: 100%;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  border-collapse: collapse;
}

.fallback-table-wrap th,
.fallback-table-wrap td {
  padding: 8px 10px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid #edf1f5;
}

.fallback-table-wrap th:first-child,
.fallback-table-wrap td:first-child {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.fallback-table-wrap th {
  position: sticky;
  top: 0;
  z-index: 1;
  font-weight: 700;
  color: #475569;
  background: #f8fafc;
}

.is-positive {
  color: #047857;
}

.is-negative {
  color: #b91c1c;
}

@media (width <= 640px) {
  .current-period-fallback header {
    flex-direction: column;
    gap: 4px;
  }
}

.portfolio-matrix-wrapper :deep(.ant-empty) {
  margin: 130px 0;
}
</style>
