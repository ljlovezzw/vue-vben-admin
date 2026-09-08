<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  AdCvrOptimizationOperatorSummaryRow,
  AdCvrOptimizationOverview,
} from '#/api/kanban/types';

import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Info } from '@vben/icons';

import { Table, Tag, Tooltip } from 'ant-design-vue';

import { fetchAdCvrOptimizationOverview } from '#/api/kanban/ad-cvr-optimization';

const props = withDefaults(
  defineProps<{
    countries?: string[];
    departments?: string[];
    projectTags?: string[];
    refreshKey?: number;
    responsibles?: string[];
  }>(),
  {
    countries: () => [],
    departments: () => [],
    projectTags: () => [],
    refreshKey: 0,
    responsibles: () => [],
  },
);
const router = useRouter();

type DisplayRow = AdCvrOptimizationOperatorSummaryRow & { isTotal?: boolean };

const loading = ref(false);
const data = ref<AdCvrOptimizationOverview | null>(null);
const loadError = ref('');

const columns: TableColumnsType<DisplayRow> = [
  {
    dataIndex: 'department',
    fixed: 'left',
    key: 'department',
    title: '部门',
    width: 112,
  },
  {
    dataIndex: 'responsible',
    fixed: 'left',
    key: 'responsible',
    title: '运营负责人',
    width: 112,
  },
  {
    dataIndex: 'campaignCount',
    key: 'campaignCount',
    title: '广告活动',
    width: 92,
  },
  {
    dataIndex: 'adGroupCount',
    key: 'adGroupCount',
    title: '广告组',
    width: 84,
  },
  {
    dataIndex: 'optimizationGroupCount',
    key: 'optimizationGroupCount',
    title: '需要优化',
    width: 170,
  },
  { dataIndex: 'spend', key: 'spend', title: '近30天花费', width: 130 },
  {
    dataIndex: 'optimizationSpend',
    key: 'optimizationSpend',
    title: '涉及优化花费',
    width: 146,
  },
  {
    dataIndex: 'estimatedSavings',
    key: 'estimatedSavings',
    title: '预计节约',
    width: 138,
  },
  {
    dataIndex: 'estimatedAcosImprovementPp',
    key: 'estimatedAcosImprovementPp',
    title: '预计ACoS改善',
    width: 190,
  },
  {
    dataIndex: 'recentTrend',
    key: 'recentTrend',
    title: '近期变化（日均/比率）',
    width: 220,
  },
];

const rows = computed<DisplayRow[]>(() => {
  const summary = data.value?.operatorSummary;
  return summary ? [...summary.rows, { ...summary.total, isTotal: true }] : [];
});
const headline = computed(() => {
  const total = data.value?.operatorSummary?.total;
  return total
    ? `${total.campaignCount.toLocaleString('zh-CN')} 个广告活动 · ${total.adGroupCount.toLocaleString('zh-CN')} 个广告组 · ${total.optimizationGroupCount.toLocaleString('zh-CN')} 组需要优化`
    : '等待汇总数据';
});

function money(value: unknown) {
  return `$${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}
function percent(value: unknown) {
  if (value === null || value === undefined) return '-';
  return `${(Number(value) * 100).toFixed(2)}%`;
}
function signed(value: unknown, suffix = '%') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return `${amount > 0 ? '+' : ''}${amount.toFixed(2)}${suffix}`;
}
function coverage(row: Pick<DisplayRow, 'optimizationSpend' | 'spend'>) {
  return row.spend
    ? `${((row.optimizationSpend / row.spend) * 100).toFixed(2)}%`
    : '0.00%';
}
function rowClassName(row: DisplayRow) {
  return row.isTotal ? 'operator-total-row' : '';
}
function canOpenResponsible(row: DisplayRow) {
  return (
    !row.isTotal && row.responsible !== '未分配' && Boolean(row.responsible)
  );
}
function openResponsible(row: DisplayRow) {
  if (!canOpenResponsible(row)) return;
  void router.push({
    name: 'KanbanAdCvrOptimization',
    query: {
      countries: props.countries.length > 0 ? props.countries : undefined,
      departments: props.departments.length > 0 ? props.departments : undefined,
      projectTags: props.projectTags.length > 0 ? props.projectTags : undefined,
      responsible: row.responsible,
    },
  });
}
function load() {
  loading.value = true;
  loadError.value = '';
  return fetchAdCvrOptimizationOverview({
    countries: props.countries,
    departments: props.departments,
    page: 1,
    pageSize: 1,
    projectTags: props.projectTags,
    responsibles: props.responsibles,
    selectedOnly: false,
    statuses: [],
  })
    .then((result) => {
      data.value = result;
    })
    .catch((error) => {
      loadError.value =
        error instanceof Error ? error.message : '建议广告优化加载失败';
    })
    .finally(() => {
      loading.value = false;
    });
}
watch(
  () => [
    props.refreshKey,
    props.countries.join('|'),
    props.departments.join('|'),
    props.projectTags.join('|'),
    props.responsibles.join('|'),
  ],
  load,
);
onMounted(load);
</script>

<template>
  <section class="ad-optimization-summary white-panel">
    <header class="ad-optimization-summary-head">
      <div>
        <h2>建议广告优化</h2>
        <p>{{ headline }}</p>
      </div>
      <Tooltip
        :title="
          [
            data?.operatorSummary?.methodology.baseline,
            data?.operatorSummary?.methodology.estimatedSavings,
            data?.operatorSummary?.methodology.estimatedAcosImprovement,
            data?.operatorSummary?.methodology.recentTrend,
            data?.operatorSummary?.methodology.filterScope,
          ]
            .filter(Boolean)
            .join('；')
        "
      >
        <span class="methodology-help"><Info :size="14" />估算口径</span>
      </Tooltip>
    </header>
    <p v-if="loadError" class="ad-optimization-summary-error">
      {{ loadError }}
    </p>
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      :row-class-name="rowClassName"
      :row-key="
        (row) =>
          `${row.department}-${row.responsible}-${row.isTotal ? 'total' : 'operator'}`
      "
      :scroll="{ x: 1394, y: 292 }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <strong v-if="column.dataIndex === 'department'">{{
          record.department
        }}</strong>
        <button
          v-else-if="
            column.dataIndex === 'responsible' &&
            canOpenResponsible(record as DisplayRow)
          "
          class="operator-filter-link"
          type="button"
          @click="openResponsible(record as DisplayRow)"
        >
          {{ record.responsible }}
        </button>
        <strong v-else-if="column.dataIndex === 'responsible'">{{
          record.responsible
        }}</strong>
        <span
          v-else-if="
            ['campaignCount', 'adGroupCount'].includes(String(column.dataIndex))
          "
          class="count-value"
        >
          {{
            Number(record[String(column.dataIndex)] || 0).toLocaleString(
              'zh-CN',
            )
          }}
        </span>
        <div
          v-else-if="column.dataIndex === 'optimizationGroupCount'"
          class="optimization-count-cell"
        >
          <strong>{{
              record.optimizationGroupCount.toLocaleString('zh-CN')
            }}
            组</strong>
          <span>{{
              record.actionableSuggestionCount.toLocaleString('zh-CN')
            }}
            条建议</span>
          <Tag v-if="record.highPriorityCount" color="red">
            高优先 {{ record.highPriorityCount }}
          </Tag>
        </div>
        <strong v-else-if="column.dataIndex === 'spend'">{{
          money(record.spend)
        }}</strong>
        <div
          v-else-if="column.dataIndex === 'optimizationSpend'"
          class="money-cell"
        >
          <strong>{{ money(record.optimizationSpend) }}</strong><span>覆盖 {{ coverage(record as DisplayRow) }}</span>
        </div>
        <div
          v-else-if="column.dataIndex === 'estimatedSavings'"
          class="money-cell"
        >
          <strong class="trend-positive">{{
            money(record.estimatedSavings)
          }}</strong><span>预计降幅
            {{ percent(record.estimatedSpendReductionPct / 100) }}</span>
        </div>
        <div
          v-else-if="column.dataIndex === 'estimatedAcosImprovementPp'"
          class="rate-cell"
        >
          <strong>{{ percent(record.currentAcos) }} →
            {{ percent(record.estimatedAcos) }}</strong><span class="trend-positive">改善 {{ signed(record.estimatedAcosImprovementPp, 'pp') }}</span>
        </div>
        <div v-else-if="column.dataIndex === 'recentTrend'" class="trend-grid">
          <span>花费
            <b
              :class="
                record.spendChangePct && record.spendChangePct > 0
                  ? 'trend-negative'
                  : 'trend-positive'
              "
              >{{ signed(record.spendChangePct) }}</b></span><span>销售额
            <b
              :class="
                record.salesChangePct && record.salesChangePct < 0
                  ? 'trend-negative'
                  : 'trend-positive'
              "
              >{{ signed(record.salesChangePct) }}</b></span><span>ACoS <b>{{ percent(record.recentAcos) }}</b></span><span>CVR <b>{{ signed(record.cvrChangePp, 'pp') }}</b></span>
        </div>
      </template>
      <template #emptyText>暂无建议广告优化数据</template>
    </Table>
  </section>
</template>

<style scoped>
.ad-optimization-summary {
  margin-top: 16px;
  overflow: hidden;
}

.ad-optimization-summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 16px 12px;
}

.ad-optimization-summary-head h2 {
  margin: 0;
}

.ad-optimization-summary-head p {
  margin: 6px 0 0;
  color: var(--analytics-subtle, #64748b);
}

.methodology-help {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--analytics-accent-label, #1d4ed8);
}

.ad-optimization-summary-error {
  padding: 0 16px 12px;
  color: #dc2626;
}

.ad-optimization-summary :deep(.ant-table) {
  border-top: 1px solid var(--analytics-border, #e2e8f0);
}

.operator-filter-link {
  padding: 0;
  font: inherit;
  font-weight: 750;
  color: #175cd3;
  text-underline-offset: 3px;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.operator-filter-link:hover,
.operator-filter-link:focus-visible {
  text-decoration: underline;
}

.operator-filter-link:focus-visible {
  outline: 2px solid #84adff;
  outline-offset: 3px;
}

.optimization-count-cell,
.money-cell,
.rate-cell,
.trend-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
}

.optimization-count-cell span,
.money-cell span,
.rate-cell span,
.trend-grid span {
  font-size: 12px;
  color: var(--analytics-subtle, #64748b);
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(100px, 1fr));
  align-items: flex-end;
  text-align: right;
}

.trend-positive {
  color: #047857;
}

.trend-negative {
  color: #dc2626;
}
</style>
