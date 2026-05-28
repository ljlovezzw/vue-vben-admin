<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  TargetTrackerAlert,
  TargetTrackerMonthRow,
  TargetTrackerOperatorRow,
  TargetTrackerOverview,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';
import VChart from 'vue-echarts';

import {
  Button,
  Input,
  InputNumber,
  Select,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import { fetchTargetTrackerOverview } from '#/api/kanban';

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

const loading = ref(false);
const overview = ref<null | TargetTrackerOverview>(null);

const query = reactive({
  operatorName: '',
  site: 'US',
  store: 'RSLOVE-US',
  year: 2026,
});

const siteOptions = [
  { label: 'US', value: 'US' },
  { label: '全部站点', value: 'ALL' },
  { label: 'DE', value: 'DE' },
  { label: 'UK', value: 'UK' },
  { label: 'CA', value: 'CA' },
  { label: '泛欧', value: '泛欧' },
];

async function loadData() {
  loading.value = true;
  try {
    overview.value = await fetchTargetTrackerOverview({
      operatorName: query.operatorName || undefined,
      site: query.site,
      store: query.store || undefined,
      year: query.year,
    });
  } finally {
    loading.value = false;
  }
}

function formatWan(value: number) {
  return `${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 1,
  })}万`;
}

function formatMoneyWan(value: number) {
  return `¥${formatWan(Number(value || 0) / 10_000)}`;
}

function formatInteger(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function progressWidth(value: number) {
  return `${Math.min(Math.max(Number(value || 0) * 100, 0), 120)}%`;
}

function toneByRate(rate: number) {
  if (rate >= summary.value.timeProgress) return 'green';
  if (summary.value.timeProgress - rate >= 0.2) return 'red';
  return 'amber';
}

function statusColor(status: string) {
  if (status === 'normal') return 'success';
  if (status === 'danger') return 'error';
  return 'warning';
}

const summary = computed(
  () =>
    overview.value?.summary ?? {
      actualProfit: 0,
      actualUnits: 0,
      asOfDate: '',
      challengeCompletionRate: 0,
      challengeProfit: 0,
      completedMonths: 0,
      currentMonthActualProfit: 0,
      currentMonthCompletionRate: 0,
      currentMonthTargetProfit: 0,
      gapProfit: 0,
      monthlyRequiredProfit: 0,
      operatorCount: 0,
      runRateCompletionRate: 0,
      runRateProfit: 0,
      targetCompletionRate: 0,
      targetProfit: 0,
      targetUnits: 0,
      timeProgress: 0,
      year: query.year,
    },
);

const kpiCards = computed(() => [
  {
    key: 'actual',
    label: '累计实际完成（毛利）',
    sub: `年度目标 ${formatMoneyWan(summary.value.targetProfit)} · 挑战目标 ${formatMoneyWan(summary.value.challengeProfit)}`,
    tone: 'blue',
    value: formatMoneyWan(summary.value.actualProfit),
  },
  {
    key: 'runRate',
    label: '年度 Run Rate 预测',
    sub: `预测达成率 ${formatPercent(summary.value.runRateCompletionRate)} · 缺口 ${formatMoneyWan(summary.value.targetProfit - summary.value.actualProfit)}`,
    tone: summary.value.runRateCompletionRate >= 0.8 ? 'green' : 'red',
    value: formatMoneyWan(summary.value.runRateProfit),
  },
  {
    key: 'month',
    label: '当月完成率',
    sub: `目标 ${formatMoneyWan(summary.value.currentMonthTargetProfit)} · 实际 ${formatMoneyWan(summary.value.currentMonthActualProfit)}`,
    tone: toneByRate(summary.value.currentMonthCompletionRate),
    value: formatPercent(summary.value.currentMonthCompletionRate),
  },
  {
    key: 'warnings',
    label: '负责人预警分布',
    sub: `负责人 ${summary.value.operatorCount} 人 · 时间进度 ${formatPercent(summary.value.timeProgress)}`,
    tone: 'amber',
    value: `${(overview.value?.operatorRows ?? []).filter((row) => row.status === 'danger').length} 人`,
  },
]);

const ringSegments = computed(() => [
  {
    name: '已完成',
    value: Math.max(summary.value.actualProfit, 0),
  },
  {
    name: '目标缺口',
    value: Math.max(summary.value.targetProfit - summary.value.actualProfit, 0),
  },
]);

const ringOption = computed(() => ({
  color: ['#2563eb', '#dbeafe'],
  series: [
    {
      center: ['50%', '50%'],
      data: ringSegments.value,
      label: { show: false },
      radius: ['72%', '88%'],
      silent: true,
      type: 'pie',
    },
    {
      center: ['50%', '50%'],
      data: [
        { name: '时间进度', value: summary.value.timeProgress },
        {
          name: '剩余时间',
          value: Math.max(1 - summary.value.timeProgress, 0),
        },
      ],
      label: { show: false },
      radius: ['54%', '64%'],
      silent: true,
      type: 'pie',
    },
  ],
  tooltip: { show: false },
}));

const monthOption = computed(() => {
  const rows = overview.value?.monthRows ?? [];
  return {
    color: ['#93c5fd', '#2563eb', '#10b981'],
    grid: { bottom: 28, left: 54, right: 26, top: 34 },
    legend: { top: 0 },
    series: [
      {
        barMaxWidth: 26,
        data: rows.map((row) => Number((row.targetProfit / 10_000).toFixed(2))),
        name: '月度目标',
        type: 'bar',
      },
      {
        barMaxWidth: 26,
        data: rows.map((row) =>
          row.actualProfit
            ? Number((row.actualProfit / 10_000).toFixed(2))
            : null,
        ),
        name: '实际完成',
        type: 'bar',
      },
      {
        data: rows.map((row) =>
          row.runRateProfit
            ? Number((row.runRateProfit / 10_000).toFixed(2))
            : null,
        ),
        lineStyle: { type: 'dashed' },
        name: 'Run Rate预测',
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => `${Number(value || 0).toFixed(1)}万`,
    },
    xAxis: {
      axisTick: { show: false },
      data: rows.map((row) => row.label),
      type: 'category',
    },
    yAxis: {
      axisLabel: { formatter: '{value}万' },
      splitLine: { lineStyle: { color: '#e5edf6' } },
      type: 'value',
    },
  };
});

const monthRateOption = computed(() => {
  const rows = (overview.value?.monthRows ?? []).filter(
    (row) => row.actualProfit,
  );
  return {
    color: ['#2563eb'],
    grid: { bottom: 22, left: 34, right: 12, top: 12 },
    series: [
      {
        areaStyle: { color: 'rgba(37, 99, 235, 0.08)' },
        data: rows.map((row) => Number((row.completionRate * 100).toFixed(1))),
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => `${Number(value || 0).toFixed(1)}%`,
    },
    xAxis: {
      axisTick: { show: false },
      data: rows.map((row) => row.label),
      type: 'category',
    },
    yAxis: {
      axisLabel: { formatter: '{value}%' },
      max: 100,
      splitLine: { lineStyle: { color: '#eef2f7' } },
      type: 'value',
    },
  };
});

const operatorColumns: TableColumnsType<TargetTrackerOperatorRow> = [
  { dataIndex: 'operatorName', fixed: 'left', title: '负责人', width: 110 },
  { dataIndex: 'targetProfit', title: '目标毛利', width: 120 },
  { dataIndex: 'actualProfit', title: '实际毛利', width: 120 },
  { dataIndex: 'completionRate', title: '完成率', width: 100 },
  { dataIndex: 'gapProfit', title: '毛利差额', width: 120 },
  { dataIndex: 'spuCount', title: 'SPU数', width: 88 },
  { dataIndex: 'statusText', title: '状态', width: 104 },
  { dataIndex: 'progress', title: '进度', width: 220 },
];

const monthColumns: TableColumnsType<TargetTrackerMonthRow> = [
  { dataIndex: 'label', fixed: 'left', title: '月份', width: 80 },
  { dataIndex: 'targetProfit', title: '目标毛利', width: 120 },
  { dataIndex: 'challengeProfit', title: '挑战目标', width: 120 },
  { dataIndex: 'actualProfit', title: '实际毛利', width: 120 },
  { dataIndex: 'completionRate', title: '完成率', width: 100 },
  { dataIndex: 'gapProfit', title: '差额', width: 120 },
];

function cellText(record: Record<string, any>, key: string) {
  const value = record[key];
  if (
    ['actualProfit', 'challengeProfit', 'gapProfit', 'targetProfit'].includes(
      key,
    )
  ) {
    return formatMoneyWan(value);
  }
  if (['actualUnits', 'spuCount', 'targetUnits'].includes(key)) {
    return formatInteger(value);
  }
  if (key === 'completionRate') {
    return formatPercent(value);
  }
  return value || '-';
}

function alertColor(alert: TargetTrackerAlert) {
  return alert.level === 'danger' ? 'error' : 'warning';
}

onMounted(loadData);
</script>

<template>
  <div class="target-page">
    <Spin :spinning="loading">
      <section class="query-band">
        <div>
          <Tag color="blue">目标跟踪</Tag>
          <h1>{{ summary.year }} 年度目标跟踪看板</h1>
          <p>
            数据来自目标表与 profitstatement 聚合逻辑，挑战目标按预定目标的 1.2
            倍计算。
          </p>
        </div>
        <div class="query-form">
          <InputNumber
            v-model:value="query.year"
            :min="2020"
            :max="2100"
            size="small"
          />
          <Select
            v-model:value="query.site"
            :options="siteOptions"
            size="small"
            style="width: 110px"
          />
          <Input
            v-model:value="query.store"
            placeholder="店铺"
            size="small"
            style="width: 150px"
            @press-enter="loadData"
          />
          <Input
            v-model:value="query.operatorName"
            placeholder="负责人"
            size="small"
            style="width: 120px"
            @press-enter="loadData"
          />
          <Button
            :loading="loading"
            size="small"
            type="primary"
            @click="loadData"
          >
            查询
          </Button>
        </div>
      </section>

      <section class="hero-grid">
        <div class="ring-card panel">
          <VChart class="ring-chart" :option="ringOption" autoresize />
          <div class="ring-center">
            <strong>{{ formatPercent(summary.targetCompletionRate) }}</strong>
            <span>年度完成率</span>
            <em>时间进度 {{ formatPercent(summary.timeProgress) }}</em>
          </div>
          <div class="ring-note">
            <Tag
              :color="
                summary.targetCompletionRate >= summary.timeProgress
                  ? 'success'
                  : 'error'
              "
            >
              {{
                summary.targetCompletionRate >= summary.timeProgress
                  ? '高于时间进度'
                  : `落后 ${((summary.timeProgress - summary.targetCompletionRate) * 100).toFixed(1)}pt`
              }}
            </Tag>
          </div>
        </div>

        <div class="kpi-grid panel">
          <div
            v-for="card in kpiCards"
            :key="card.key"
            class="kpi-cell"
            :class="`tone-${card.tone}`"
          >
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <em>{{ card.sub }}</em>
          </div>
        </div>
      </section>

      <section class="charts-grid">
        <div class="panel chart-panel">
          <div class="panel-head">
            <strong>月度目标 vs 实际</strong>
            <span>{{ overview?.query.site || 'US' }} ·
              {{ overview?.updatedAt || '-' }}</span>
          </div>
          <VChart class="main-chart" :option="monthOption" autoresize />
        </div>
        <div class="panel forecast-panel">
          <div class="panel-head">
            <strong>Run Rate 预测</strong>
          </div>
          <div class="forecast-card">
            <span>年底预测毛利</span>
            <strong>{{ formatMoneyWan(summary.runRateProfit) }}</strong>
            <em>目标达成 {{ formatPercent(summary.runRateCompletionRate) }}</em>
          </div>
          <div class="forecast-card">
            <span>剩余月均需完成</span>
            <strong>{{ formatMoneyWan(summary.monthlyRequiredProfit) }}</strong>
            <em>当前已完成 {{ summary.completedMonths }} 个月</em>
          </div>
          <div class="mini-bars">
            <div
              v-for="row in (overview?.operatorRows ?? []).slice(0, 5)"
              :key="row.operatorName"
              class="mini-bar"
            >
              <span>{{ row.operatorName }}</span>
              <b>{{ formatPercent(row.completionRate) }}</b>
              <div>
                <i
                  :class="`bar-${toneByRate(row.completionRate)}`"
                  :style="{ width: progressWidth(row.completionRate) }"
                ></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel table-panel">
        <div class="panel-head">
          <strong>负责人年度目标进度</strong>
          <span>按完成率排序</span>
        </div>
        <Table
          :columns="operatorColumns"
          :data-source="overview?.operatorRows ?? []"
          :pagination="{ pageSize: 8, showSizeChanger: true }"
          :scroll="{ x: 980 }"
          row-key="operatorName"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'statusText'">
              <Tag :color="statusColor(record.status)">
                {{ record.statusText }}
              </Tag>
            </template>
            <template v-else-if="column.dataIndex === 'progress'">
              <div class="progress-line">
                <div class="progress-track">
                  <i
                    :class="`bar-${toneByRate(record.completionRate)}`"
                    :style="{ width: progressWidth(record.completionRate) }"
                  ></i>
                  <b :style="{ left: progressWidth(summary.timeProgress) }"></b>
                </div>
                <span>{{ formatPercent(record.completionRate) }}</span>
              </div>
            </template>
            <template v-else>
              {{ cellText(record, String(column.dataIndex)) }}
            </template>
          </template>
        </Table>
      </section>

      <section class="bottom-grid">
        <div class="panel mini-panel">
          <div class="panel-head compact">
            <strong>Top 5 SPU 完成率</strong>
            <span>按实际毛利排序</span>
          </div>
          <div class="rank-list">
            <div
              v-for="row in overview?.topSpuRows ?? []"
              :key="`${row.spu}-${row.site}`"
              class="rank-row"
            >
              <span>{{ row.spu }}</span>
              <b :class="`text-${toneByRate(row.completionRate)}`">
                {{ formatPercent(row.completionRate) }}
              </b>
              <em>{{ formatMoneyWan(row.actualProfit) }}</em>
            </div>
          </div>
        </div>
        <div class="panel mini-panel">
          <div class="panel-head compact">
            <strong>严重亏损 SPU 预警</strong>
            <span>实际毛利最低</span>
          </div>
          <div class="rank-list">
            <div
              v-for="row in overview?.lossSpuRows ?? []"
              :key="`${row.spu}-${row.site}`"
              class="rank-row"
            >
              <span>{{ row.spu }}</span>
              <b class="text-red">{{ formatMoneyWan(row.actualProfit) }}</b>
              <em>{{ row.operatorName }}</em>
            </div>
          </div>
        </div>
        <div class="panel mini-panel">
          <div class="panel-head compact">
            <strong>月度完成率波动</strong>
            <span>已完成月份</span>
          </div>
          <VChart class="mini-chart" :option="monthRateOption" autoresize />
        </div>
      </section>

      <section class="detail-grid">
        <div class="panel alerts-panel">
          <div class="panel-head">
            <strong>当前预警事项</strong>
          </div>
          <div class="alert-list">
            <div
              v-for="alert in overview?.alerts ?? []"
              :key="alert.title"
              class="alert-item"
            >
              <Tag :color="alertColor(alert)">
                {{ alert.level === 'danger' ? '紧急' : '关注' }}
              </Tag>
              <div>
                <strong>{{ alert.title }}</strong>
                <p>{{ alert.description }}</p>
                <span>{{ alert.time }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="panel table-panel">
          <div class="panel-head">
            <strong>月度明细</strong>
            <span>目标 / 挑战 / 实际</span>
          </div>
          <Table
            :columns="monthColumns"
            :data-source="overview?.monthRows ?? []"
            :pagination="false"
            :scroll="{ x: 720, y: 320 }"
            row-key="month"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              {{ cellText(record, String(column.dataIndex)) }}
            </template>
          </Table>
        </div>
      </section>
    </Spin>
  </div>
</template>

<style scoped>
.target-page {
  min-height: 100%;
  padding: 18px;
  color: #102033;
  background: #f3f7fb;
}

.query-band {
  display: flex;
  gap: 18px;
  align-items: end;
  justify-content: space-between;
  padding: 20px 22px;
  margin-bottom: 16px;
  background:
    linear-gradient(135deg, rgb(239 246 255 / 92%), rgb(236 253 245 / 90%)),
    #fff;
  border: 1px solid #d9e6f5;
  border-radius: 8px;
}

.query-band h1 {
  margin: 10px 0 6px;
  font-size: 26px;
  font-weight: 800;
}

.query-band p {
  margin: 0;
  color: #64748b;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.panel {
  min-width: 0;
  padding: 16px;
  background: #fff;
  border: 1px solid #d8e4f1;
  border-radius: 8px;
  box-shadow: 0 10px 24px rgb(15 23 42 / 5%);
}

.hero-grid {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.ring-card {
  position: relative;
  display: grid;
  place-items: center;
}

.ring-chart {
  width: 190px;
  height: 190px;
}

.ring-center {
  position: absolute;
  top: 58px;
  display: grid;
  gap: 3px;
  width: 170px;
  text-align: center;
}

.ring-center strong {
  font-size: 30px;
  color: #dc2626;
}

.ring-center span,
.ring-center em {
  font-size: 12px;
  font-style: normal;
  color: #64748b;
}

.ring-note {
  margin-top: 8px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.kpi-cell {
  display: grid;
  gap: 7px;
  min-height: 142px;
  padding: 20px;
  border-right: 1px solid #dfe8f3;
}

.kpi-cell:last-child {
  border-right: 0;
}

.kpi-cell span {
  font-size: 12px;
  color: #64748b;
}

.kpi-cell strong {
  font-size: 24px;
  font-weight: 800;
}

.kpi-cell em {
  font-size: 12px;
  font-style: normal;
  color: #64748b;
}

.tone-blue strong {
  color: #2563eb;
}

.tone-green strong {
  color: #059669;
}

.tone-amber strong {
  color: #d97706;
}

.tone-red strong {
  color: #dc2626;
}

.charts-grid,
.detail-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.75fr) minmax(720px, 1.25fr);
  gap: 16px;
  margin-bottom: 16px;
}

.panel-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-head strong {
  font-size: 15px;
}

.panel-head span {
  font-size: 12px;
  color: #64748b;
}

.panel-head.compact {
  margin-bottom: 14px;
}

.main-chart {
  height: 280px;
}

.forecast-panel {
  display: grid;
  align-content: start;
}

.forecast-card {
  display: grid;
  gap: 6px;
  padding: 13px;
  margin-bottom: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.forecast-card span,
.forecast-card em {
  font-size: 12px;
  font-style: normal;
  color: #64748b;
}

.forecast-card strong {
  font-size: 22px;
}

.mini-bars {
  display: grid;
  gap: 10px;
  margin-top: 4px;
}

.mini-bar {
  display: grid;
  grid-template-columns: 72px 58px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  font-size: 12px;
}

.mini-bar div,
.progress-track {
  position: relative;
  height: 7px;
  overflow: hidden;
  background: #edf2f7;
  border-radius: 999px;
}

.mini-bar i,
.progress-track i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
}

.bar-green {
  background: #10b981;
}

.bar-amber {
  background: #f59e0b;
}

.bar-red {
  background: #ef4444;
}

.table-panel {
  margin-bottom: 16px;
}

.progress-line {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 52px;
  gap: 8px;
  align-items: center;
}

.progress-track b {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 13px;
  background: #64748b;
}

.bottom-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.rank-list {
  display: grid;
  gap: 9px;
}

.rank-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 86px 96px;
  gap: 10px;
  align-items: center;
  min-height: 28px;
  font-size: 12px;
}

.rank-row span,
.rank-row em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-row em {
  font-style: normal;
  color: #64748b;
}

.text-green {
  color: #059669;
}

.text-amber {
  color: #d97706;
}

.text-red {
  color: #dc2626;
}

.mini-chart {
  height: 172px;
}

.alert-list {
  display: grid;
  gap: 10px;
}

.alert-item {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.alert-item strong {
  display: block;
  margin-bottom: 3px;
}

.alert-item p {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.alert-item span {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  color: #94a3b8;
}

:deep(.ant-table-wrapper .ant-table-thead > tr > th) {
  font-weight: 700;
  background: #f6f9fc;
  border-color: #cbd8e8;
  border-right: 1px solid #cbd8e8;
}

:deep(.ant-table-wrapper .ant-table-tbody > tr > td) {
  border-color: #d6e0ec;
  border-right: 1px solid #d6e0ec;
}

:deep(.ant-btn),
:deep(.ant-input),
:deep(.ant-input-number),
:deep(.ant-select-selector) {
  border-radius: 6px;
}

@media (max-width: 1280px) {
  .hero-grid,
  .charts-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .kpi-grid,
  .bottom-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .query-band {
    display: grid;
  }

  .kpi-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }

  .kpi-cell {
    border-right: 0;
    border-bottom: 1px solid #dfe8f3;
  }
}
</style>
