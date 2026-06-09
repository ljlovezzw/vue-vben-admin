<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  TargetTrackerAlert,
  TargetTrackerOperatorPeriodRow,
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

import { useTablePagination } from '../shared/pagination';

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

type ViewMode = 'month' | 'quarter' | 'year';

interface PeriodRow {
  actualProfit: number;
  actualUnits: number;
  challengeProfit: number;
  completionRate: number;
  gapProfit: number;
  label: string;
  month?: number;
  period: number;
  quarter?: number;
  runRateProfit: null | number;
  targetProfit: number;
  targetUnits: number;
  timeProgress?: number;
}

const loading = ref(false);
const overview = ref<null | TargetTrackerOverview>(null);
const viewMode = ref<ViewMode>('year');
const selectedMonth = ref(new Date().getMonth() + 1);
const selectedQuarter = ref(Math.ceil((new Date().getMonth() + 1) / 3));
const operatorPagination = useTablePagination(8, ['8', '20', '50', '100']);

const query = reactive({
  operatorName: '',
  site: 'ALL',
  store: '',
  year: 2026,
});

const siteOptions = [
  { label: '全部站点', value: 'ALL' },
  { label: 'US', value: 'US' },
  { label: 'DE', value: 'DE' },
  { label: 'UK', value: 'UK' },
  { label: 'CA', value: 'CA' },
  { label: '泛欧', value: '泛欧' },
];

const viewModeOptions: Array<{ label: string; value: ViewMode }> = [
  { label: '年度视图', value: 'year' },
  { label: '季度视图', value: 'quarter' },
  { label: '月度视图', value: 'month' },
];

function setViewMode(mode: ViewMode) {
  viewMode.value = mode;
}

function syncSelectedPeriods(data: TargetTrackerOverview) {
  const asOfMonth = Number(data.summary.asOfDate?.slice(5, 7));
  const month =
    asOfMonth >= 1 && asOfMonth <= 12 ? asOfMonth : selectedMonth.value;
  selectedMonth.value = month;
  selectedQuarter.value = Math.ceil(month / 3);
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchTargetTrackerOverview({
      operatorName: query.operatorName || undefined,
      site: query.site === 'ALL' ? undefined : query.site,
      store: query.store || undefined,
      year: query.year,
    });
    overview.value = data;
    syncSelectedPeriods(data);
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

function periodTone(row?: { completionRate: number; timeProgress?: number }) {
  if (!row) return 'amber';
  const progress = row.timeProgress ?? summary.value.timeProgress;
  if (row.completionRate >= progress) return 'green';
  if (progress - row.completionRate >= 0.2) return 'red';
  return 'amber';
}

function periodState(row?: { completionRate: number; timeProgress?: number }) {
  const tone = periodTone(row);
  if (tone === 'green') return '进度正常';
  if (tone === 'red') return '明显落后';
  return '需要关注';
}

function completionText(value: null | number | undefined) {
  return value === null || value === undefined ? '-' : formatPercent(value);
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

const monthRows = computed<PeriodRow[]>(() =>
  (overview.value?.monthRows ?? []).map((row) => ({
    ...row,
    period: row.month,
  })),
);

const quarterRows = computed<PeriodRow[]>(() =>
  (overview.value?.quarterRows ?? []).map((row) => ({
    ...row,
    period: row.quarter,
  })),
);

const selectedPeriodRows = computed(() =>
  viewMode.value === 'quarter' ? quarterRows.value : monthRows.value,
);

const selectedMonthRow = computed(
  () =>
    monthRows.value.find((row) => row.month === selectedMonth.value) ??
    monthRows.value[0],
);

const selectedQuarterRow = computed(
  () =>
    quarterRows.value.find((row) => row.quarter === selectedQuarter.value) ??
    quarterRows.value[0],
);

const selectedMonthOperatorRows = computed(() =>
  (overview.value?.operatorMonthRows ?? [])
    .filter((row) => row.month === selectedMonth.value)
    .toSorted((a, b) => b.completionRate - a.completionRate),
);

const selectedQuarterOperatorRows = computed(() =>
  (overview.value?.operatorQuarterRows ?? [])
    .filter((row) => row.quarter === selectedQuarter.value)
    .toSorted((a, b) => b.completionRate - a.completionRate),
);

const periodLabel = computed(() =>
  viewMode.value === 'quarter' ? '季度' : '月度',
);

const periodPanelTitle = computed(() =>
  viewMode.value === 'year'
    ? '月度目标 vs 实际'
    : `${periodLabel.value}目标 vs 实际`,
);

const periodTableTitle = computed(() =>
  viewMode.value === 'quarter' ? '季度明细' : '月度明细',
);

const periodFirstColumnTitle = computed(() =>
  viewMode.value === 'quarter' ? '季度' : '月份',
);

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
  const rows = selectedPeriodRows.value;
  return {
    color: ['#93c5fd', '#2563eb', '#10b981'],
    grid: { bottom: 28, left: 54, right: 26, top: 34 },
    legend: { top: 0 },
    series: [
      {
        barMaxWidth: 26,
        data: rows.map((row) => Number((row.targetProfit / 10_000).toFixed(2))),
        name: `${periodLabel.value}目标`,
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

const monthKpiCards = computed(() => {
  const row = selectedMonthRow.value;
  return [
    {
      key: 'target',
      label: `${selectedMonth.value}月目标毛利`,
      sub: `挑战目标 ${formatMoneyWan(row?.challengeProfit ?? 0)}`,
      tone: 'blue',
      value: formatMoneyWan(row?.targetProfit ?? 0),
    },
    {
      key: 'actual',
      label: '实际完成毛利',
      sub: `销量 ${formatInteger(row?.actualUnits ?? 0)} / ${formatInteger(row?.targetUnits ?? 0)}`,
      tone: 'green',
      value: formatMoneyWan(row?.actualProfit ?? 0),
    },
    {
      key: 'rate',
      label: '月度完成率',
      sub: `时间进度 ${formatPercent(row?.timeProgress ?? 0)}`,
      tone: periodTone(row),
      value: formatPercent(row?.completionRate ?? 0),
    },
    {
      key: 'gap',
      label: '月度缺口',
      sub: periodState(row),
      tone: (row?.gapProfit ?? 0) >= 0 ? 'green' : 'red',
      value: formatMoneyWan(row?.gapProfit ?? 0),
    },
  ];
});

const monthPersonOption = computed(() => {
  const rows = selectedMonthOperatorRows.value.slice(0, 12);
  return {
    color: ['#93c5fd', '#2563eb'],
    grid: { bottom: 32, left: 58, right: 20, top: 36 },
    legend: { top: 0 },
    series: [
      {
        barMaxWidth: 22,
        data: rows.map((row) => Number((row.targetProfit / 10_000).toFixed(2))),
        name: '目标',
        type: 'bar',
      },
      {
        barMaxWidth: 22,
        data: rows.map((row) => Number((row.actualProfit / 10_000).toFixed(2))),
        name: '实际',
        type: 'bar',
      },
    ],
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => `${Number(value || 0).toFixed(1)}万`,
    },
    xAxis: {
      axisLabel: { interval: 0, rotate: rows.length > 7 ? 30 : 0 },
      axisTick: { show: false },
      data: rows.map((row) => row.operatorName),
      type: 'category',
    },
    yAxis: {
      axisLabel: { formatter: '{value}万' },
      splitLine: { lineStyle: { color: '#e5edf6' } },
      type: 'value',
    },
  };
});

const monthTrendOption = computed(() => {
  const rows = monthRows.value.filter(
    (row) => row.actualProfit || row.timeProgress,
  );
  return {
    color: ['#2563eb', '#f59e0b'],
    grid: { bottom: 28, left: 42, right: 16, top: 28 },
    legend: { top: 0 },
    series: [
      {
        data: rows.map((row) => Number((row.completionRate * 100).toFixed(1))),
        name: '完成率',
        smooth: true,
        type: 'line',
      },
      {
        data: rows.map((row) =>
          Number(((row.timeProgress ?? 0) * 100).toFixed(1)),
        ),
        lineStyle: { type: 'dashed' },
        name: '时间进度',
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
      splitLine: { lineStyle: { color: '#eef2f7' } },
      type: 'value',
    },
  };
});

const monthGapOption = computed(() => {
  const rows = monthRows.value;
  return {
    color: ['#ef4444'],
    grid: { bottom: 28, left: 58, right: 16, top: 12 },
    series: [
      {
        barMaxWidth: 24,
        data: rows.map((row) => Number((row.gapProfit / 10_000).toFixed(2))),
        itemStyle: {
          color: ({ value }: { value: number }) =>
            value >= 0 ? '#10b981' : '#ef4444',
        },
        type: 'bar',
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
      splitLine: { lineStyle: { color: '#eef2f7' } },
      type: 'value',
    },
  };
});

const weekRhythmRows = computed(() => {
  const row = selectedMonthRow.value;
  const target = row?.targetProfit ?? 0;
  const actual = row?.actualProfit ?? 0;
  const weeks = [
    { label: '第1周', ratio: 0.22 },
    { label: '第2周', ratio: 0.46 },
    { label: '第3周', ratio: 0.72 },
    { label: '第4周', ratio: 1 },
  ];
  return weeks.map((week) => {
    const checkpoint = target * week.ratio;
    return {
      ...week,
      actual,
      checkpoint,
      gap: actual - checkpoint,
      rate: checkpoint ? actual / checkpoint : 0,
    };
  });
});

const quarterKpiCards = computed(() =>
  quarterRows.value.map((row) => ({
    ...row,
    state: periodState(row),
    tone: periodTone(row),
  })),
);

const quarterTargetOption = computed(() => {
  const rows = quarterRows.value;
  return {
    color: ['#93c5fd', '#2563eb', '#10b981'],
    grid: { bottom: 28, left: 58, right: 22, top: 34 },
    legend: { top: 0 },
    series: [
      {
        barMaxWidth: 28,
        data: rows.map((row) => Number((row.targetProfit / 10_000).toFixed(2))),
        name: '季度目标',
        type: 'bar',
      },
      {
        barMaxWidth: 28,
        data: rows.map((row) => Number((row.actualProfit / 10_000).toFixed(2))),
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
        name: 'Run Rate',
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

const quarterRateOption = computed(() => {
  const rows = quarterRows.value;
  return {
    color: ['#2563eb', '#f59e0b'],
    grid: { bottom: 28, left: 42, right: 16, top: 34 },
    legend: { top: 0 },
    series: [
      {
        data: rows.map((row) => Number((row.completionRate * 100).toFixed(1))),
        name: '完成率',
        smooth: true,
        type: 'line',
      },
      {
        data: rows.map((row) =>
          Number(((row.timeProgress ?? 0) * 100).toFixed(1)),
        ),
        lineStyle: { type: 'dashed' },
        name: '时间进度',
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
      splitLine: { lineStyle: { color: '#eef2f7' } },
      type: 'value',
    },
  };
});

const quarterMatrixRows = computed(() => {
  const names = new Set<string>();
  for (const row of overview.value?.operatorRows ?? [])
    names.add(row.operatorName);
  for (const row of overview.value?.operatorQuarterRows ?? [])
    names.add(row.operatorName);

  return [...names].map((name) => {
    const yearRow = overview.value?.operatorRows.find(
      (row) => row.operatorName === name,
    );
    const quarterValues = [1, 2, 3, 4].map((quarter) =>
      overview.value?.operatorQuarterRows.find(
        (row) => row.operatorName === name && row.quarter === quarter,
      ),
    );
    return {
      name,
      q1: quarterValues[0]?.completionRate,
      q2: quarterValues[1]?.completionRate,
      q3: quarterValues[2]?.completionRate,
      q4: quarterValues[3]?.completionRate,
      year: yearRow?.completionRate,
    };
  });
});

const quarterReviewItems = computed(() => {
  const worst = [...quarterRows.value].toSorted(
    (a, b) => a.completionRate - b.completionRate,
  )[0];
  const best = [...quarterRows.value].toSorted(
    (a, b) => b.completionRate - a.completionRate,
  )[0];
  return [
    best
      ? `${best.label} 当前完成率最高，为 ${formatPercent(best.completionRate)}。`
      : '暂无季度完成数据。',
    worst
      ? `${worst.label} 缺口 ${formatMoneyWan(worst.gapProfit)}，需要重点复盘目标拆解和负责人推进。`
      : '暂无季度缺口数据。',
  ];
});

const quarterActionItems = computed(() => [
  `优先跟进 ${selectedQuarterRow.value?.label ?? '当前季度'} 中完成率低于时间进度的负责人。`,
  `结合月度视图拆到月份节奏，确保季度目标不会集中到最后一个月补差。`,
]);

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

const operatorPeriodColumns: TableColumnsType<TargetTrackerOperatorPeriodRow> =
  [
    { dataIndex: 'operatorName', fixed: 'left', title: '负责人', width: 110 },
    { dataIndex: 'targetProfit', title: '目标毛利', width: 120 },
    { dataIndex: 'actualProfit', title: '实际毛利', width: 120 },
    { dataIndex: 'completionRate', title: '完成率', width: 100 },
    { dataIndex: 'gapProfit', title: '差额', width: 120 },
    { dataIndex: 'spuCount', title: 'SPU数', width: 88 },
    { dataIndex: 'statusText', title: '状态', width: 104 },
  ];

const periodColumns = computed<TableColumnsType<PeriodRow>>(() => [
  {
    dataIndex: 'label',
    fixed: 'left',
    title: periodFirstColumnTitle.value,
    width: 80,
  },
  { dataIndex: 'targetProfit', title: '目标毛利', width: 120 },
  { dataIndex: 'challengeProfit', title: '挑战目标', width: 120 },
  { dataIndex: 'actualProfit', title: '实际毛利', width: 120 },
  { dataIndex: 'completionRate', title: '完成率', width: 100 },
  { dataIndex: 'gapProfit', title: '差额', width: 120 },
  { dataIndex: 'targetUnits', title: '目标销量', width: 100 },
  { dataIndex: 'actualUnits', title: '实际销量', width: 100 },
]);

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
          <div class="view-switch">
            <Button
              v-for="item in viewModeOptions"
              :key="item.value"
              :type="viewMode === item.value ? 'primary' : 'default'"
              size="small"
              @click="setViewMode(item.value)"
            >
              {{ item.label }}
            </Button>
          </div>
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

      <template v-if="viewMode === 'year'">
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
              <strong>{{ periodPanelTitle }}</strong>
              <span>{{ overview?.query.site || '全部站点' }} ·
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
              <strong>{{
                formatMoneyWan(summary.monthlyRequiredProfit)
              }}</strong>
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
            :pagination="operatorPagination"
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
                    <b
                      :style="{ left: progressWidth(summary.timeProgress) }"
                    ></b>
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
              <strong>{{ periodTableTitle }}</strong>
              <span>目标 / 挑战 / 实际</span>
            </div>
            <Table
              :columns="periodColumns"
              :data-source="selectedPeriodRows"
              :pagination="false"
              :scroll="{ x: 720, y: 320 }"
              row-key="period"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                {{ cellText(record, String(column.dataIndex)) }}
              </template>
            </Table>
          </div>
        </section>
      </template>

      <template v-else-if="viewMode === 'month'">
        <section class="month-picker panel">
          <Button
            v-for="row in monthRows"
            :key="row.month"
            :class="{
              active: selectedMonth === row.month,
              future: !row.actualProfit,
            }"
            :type="selectedMonth === row.month ? 'primary' : 'default'"
            size="small"
            @click="selectedMonth = row.month ?? 1"
          >
            {{ row.label }}
          </Button>
        </section>

        <section class="period-kpi-grid">
          <div
            v-for="card in monthKpiCards"
            :key="card.key"
            class="panel period-kpi"
            :class="`tone-${card.tone}`"
          >
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <em>{{ card.sub }}</em>
          </div>
        </section>

        <section class="period-split">
          <div class="panel chart-panel">
            <div class="panel-head">
              <strong>{{ selectedMonth }}月负责人完成情况</strong>
              <span>目标 / 实际毛利</span>
            </div>
            <VChart class="main-chart" :option="monthPersonOption" autoresize />
          </div>
          <div class="panel rhythm-panel">
            <div class="panel-head">
              <strong>周节奏检查</strong>
              <span>按月目标拆分</span>
            </div>
            <div class="rhythm-list">
              <div
                v-for="week in weekRhythmRows"
                :key="week.label"
                class="rhythm-row"
              >
                <span>{{ week.label }}</span>
                <b>{{ formatMoneyWan(week.checkpoint) }}</b>
                <em :class="week.gap >= 0 ? 'text-green' : 'text-red'">
                  {{ formatMoneyWan(week.gap) }}
                </em>
                <div>
                  <i :style="{ width: progressWidth(week.rate) }"></i>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="month-card-grid">
          <div
            v-for="row in monthRows"
            :key="row.month"
            class="panel month-status-card"
            :class="{ active: selectedMonth === row.month }"
            @click="selectedMonth = row.month ?? 1"
          >
            <span>{{ row.label }}</span>
            <strong :class="`text-${periodTone(row)}`">
              {{ formatPercent(row.completionRate) }}
            </strong>
            <em>{{ formatMoneyWan(row.gapProfit) }}</em>
          </div>
        </section>

        <section class="bottom-grid">
          <div class="panel mini-panel">
            <div class="panel-head compact">
              <strong>月度完成率趋势</strong>
              <span>完成率 / 时间进度</span>
            </div>
            <VChart class="mini-chart" :option="monthTrendOption" autoresize />
          </div>
          <div class="panel mini-panel">
            <div class="panel-head compact">
              <strong>月度差额走势</strong>
              <span>实际 - 目标</span>
            </div>
            <VChart class="mini-chart" :option="monthGapOption" autoresize />
          </div>
          <div class="panel mini-panel">
            <div class="panel-head compact">
              <strong>{{ selectedMonth }}月负责人排行</strong>
              <span>按完成率排序</span>
            </div>
            <div class="rank-list">
              <div
                v-for="row in selectedMonthOperatorRows.slice(0, 5)"
                :key="row.operatorName"
                class="rank-row"
              >
                <span>{{ row.operatorName }}</span>
                <b :class="`text-${periodTone(row)}`">
                  {{ formatPercent(row.completionRate) }}
                </b>
                <em>{{ formatMoneyWan(row.actualProfit) }}</em>
              </div>
            </div>
          </div>
        </section>

        <section class="panel table-panel">
          <div class="panel-head">
            <strong>{{ selectedMonth }}月负责人明细</strong>
            <span>真实按月聚合</span>
          </div>
          <Table
            :columns="operatorPeriodColumns"
            :data-source="selectedMonthOperatorRows"
            :pagination="operatorPagination"
            :scroll="{ x: 760 }"
            row-key="operatorName"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'statusText'">
                <Tag :color="statusColor(record.status)">
                  {{ record.statusText }}
                </Tag>
              </template>
              <template v-else>
                {{ cellText(record, String(column.dataIndex)) }}
              </template>
            </template>
          </Table>
        </section>
      </template>

      <template v-else>
        <section class="quarter-card-grid">
          <button
            v-for="row in quarterKpiCards"
            :key="row.quarter"
            class="panel quarter-status-card"
            :class="{ active: selectedQuarter === row.quarter }"
            type="button"
            @click="selectedQuarter = row.quarter ?? 1"
          >
            <span>{{ row.label }} {{ row.state }}</span>
            <strong :class="`text-${row.tone}`">
              {{ formatPercent(row.completionRate) }}
            </strong>
            <em>
              目标 {{ formatMoneyWan(row.targetProfit) }} · 缺口
              {{ formatMoneyWan(row.gapProfit) }}
            </em>
          </button>
        </section>

        <section class="period-split">
          <div class="panel chart-panel">
            <div class="panel-head">
              <strong>季度目标 / 实际 / Run Rate</strong>
              <span>{{ overview?.updatedAt || '-' }}</span>
            </div>
            <VChart
              class="main-chart"
              :option="quarterTargetOption"
              autoresize
            />
          </div>
          <div class="panel chart-panel">
            <div class="panel-head">
              <strong>季度完成率与时间进度</strong>
              <span>完成率 / 时间进度</span>
            </div>
            <VChart class="main-chart" :option="quarterRateOption" autoresize />
          </div>
        </section>

        <section class="panel quarter-matrix">
          <div class="panel-head">
            <strong>负责人季度矩阵</strong>
            <span>按季度完成率对比</span>
          </div>
          <div class="matrix-table">
            <div class="matrix-head">
              <span>负责人</span>
              <span>Q1</span>
              <span>Q2</span>
              <span>Q3</span>
              <span>Q4</span>
              <span>全年</span>
            </div>
            <div
              v-for="row in quarterMatrixRows"
              :key="row.name"
              class="matrix-row"
            >
              <span>{{ row.name }}</span>
              <b>{{ completionText(row.q1) }}</b>
              <b>{{ completionText(row.q2) }}</b>
              <b>{{ completionText(row.q3) }}</b>
              <b>{{ completionText(row.q4) }}</b>
              <b>{{ completionText(row.year) }}</b>
            </div>
          </div>
        </section>

        <section class="period-split">
          <div class="panel table-panel">
            <div class="panel-head">
              <strong>{{ selectedQuarterRow?.label }}负责人明细</strong>
              <span>真实按季度聚合</span>
            </div>
            <Table
              :columns="operatorPeriodColumns"
              :data-source="selectedQuarterOperatorRows"
              :pagination="operatorPagination"
              :scroll="{ x: 760 }"
              row-key="operatorName"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'statusText'">
                  <Tag :color="statusColor(record.status)">
                    {{ record.statusText }}
                  </Tag>
                </template>
                <template v-else>
                  {{ cellText(record, String(column.dataIndex)) }}
                </template>
              </template>
            </Table>
          </div>
          <div class="panel review-panel">
            <div class="panel-head">
              <strong>季度复盘与动作</strong>
              <span>自动生成</span>
            </div>
            <div class="review-list">
              <strong>复盘结论</strong>
              <p v-for="item in quarterReviewItems" :key="item">{{ item }}</p>
              <strong>动作建议</strong>
              <p v-for="item in quarterActionItems" :key="item">{{ item }}</p>
            </div>
          </div>
        </section>
      </template>
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

.view-switch {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  margin-top: 14px;
  background: #eef4fb;
  border: 1px solid #d8e4f1;
  border-radius: 8px;
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

.month-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.month-picker .future {
  border-style: dashed;
  opacity: 0.72;
}

.period-kpi-grid,
.quarter-card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.period-kpi {
  display: grid;
  gap: 7px;
  min-height: 124px;
}

.period-kpi span,
.period-kpi em,
.month-status-card span,
.month-status-card em,
.quarter-status-card span,
.quarter-status-card em {
  font-size: 12px;
  font-style: normal;
  color: #64748b;
}

.period-kpi strong {
  font-size: 24px;
  font-weight: 800;
}

.period-split {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(360px, 0.85fr);
  gap: 16px;
  margin-bottom: 16px;
}

.rhythm-panel {
  align-content: start;
}

.rhythm-list {
  display: grid;
  gap: 12px;
}

.rhythm-row {
  display: grid;
  grid-template-columns: 52px 92px 92px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.rhythm-row b,
.rhythm-row em {
  font-style: normal;
}

.rhythm-row div {
  position: relative;
  height: 7px;
  overflow: hidden;
  background: #edf2f7;
  border-radius: 999px;
}

.rhythm-row i {
  position: absolute;
  inset: 0 auto 0 0;
  background: #2563eb;
  border-radius: 999px;
}

.month-card-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.month-status-card {
  display: grid;
  gap: 5px;
  min-height: 86px;
  cursor: pointer;
}

.month-status-card.active,
.quarter-status-card.active {
  border-color: #2563eb;
  box-shadow: 0 10px 28px rgb(37 99 235 / 12%);
}

.month-status-card strong,
.quarter-status-card strong {
  font-size: 21px;
}

.quarter-status-card {
  display: grid;
  gap: 8px;
  min-height: 128px;
  text-align: left;
  appearance: none;
  cursor: pointer;
}

.quarter-status-card em {
  line-height: 1.6;
}

.quarter-matrix {
  margin-bottom: 16px;
  overflow: hidden;
}

.matrix-table {
  overflow-x: auto;
}

.matrix-head,
.matrix-row {
  display: grid;
  grid-template-columns: minmax(120px, 1.2fr) repeat(5, minmax(84px, 1fr));
  min-width: 650px;
}

.matrix-head span,
.matrix-row span,
.matrix-row b {
  padding: 10px 12px;
  font-size: 12px;
  border-right: 1px solid #d6e0ec;
  border-bottom: 1px solid #d6e0ec;
}

.matrix-head span {
  font-weight: 700;
  background: #f6f9fc;
}

.matrix-row b {
  font-weight: 700;
}

.review-panel {
  align-content: start;
}

.review-list {
  display: grid;
  gap: 8px;
}

.review-list strong {
  margin-top: 4px;
  color: #102033;
}

.review-list p {
  padding: 10px 12px;
  margin: 0;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
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
  .detail-grid,
  .period-split {
    grid-template-columns: 1fr;
  }

  .kpi-grid,
  .bottom-grid,
  .period-kpi-grid,
  .quarter-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .month-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .query-band {
    display: grid;
  }

  .kpi-grid,
  .bottom-grid,
  .month-card-grid,
  .period-kpi-grid,
  .quarter-card-grid {
    grid-template-columns: 1fr;
  }

  .kpi-cell {
    border-right: 0;
    border-bottom: 1px solid #dfe8f3;
  }

  .rhythm-row {
    grid-template-columns: 48px 1fr;
  }

  .rhythm-row div {
    grid-column: 1 / -1;
  }
}
</style>
