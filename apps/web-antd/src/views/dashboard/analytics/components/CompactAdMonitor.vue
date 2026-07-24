<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { AdMonitorFollowSummary } from './compact-ad-monitor-summary';

import type {
  AdMonitorOverview,
  AdMonitorStatus,
  AdMonitorSummary,
  AdResponsibleRow,
} from '#/api/kanban/types';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { ExternalLink } from '@vben/icons';

import {
  Button,
  DatePicker,
  Empty,
  Progress,
  Segmented,
  Select,
  Spin,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { fetchAdMonitorOverview } from '#/api/kanban';

import { mergeAdMonitorFollowSummary } from './compact-ad-monitor-summary';

type PeriodMode = '7d' | '30d' | 'follow' | 'month' | 'range';

const props = withDefaults(
  defineProps<{
    countries?: string[];
    departments?: string[];
    endDate?: string;
    followSummary?: AdMonitorFollowSummary | null;
    responsibles?: string[];
    startDate?: string;
  }>(),
  {
    countries: () => [],
    departments: () => [],
    endDate: '',
    followSummary: null,
    responsibles: () => [],
    startDate: '',
  },
);

const loading = ref(false);
const overview = ref<AdMonitorOverview | null>(null);
const periodMode = ref<PeriodMode>('follow');
const dateRange = ref<[string, string]>([
  props.startDate || dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
  props.endDate || dayjs().format('YYYY-MM-DD'),
]);
const query = reactive({
  shops: [] as string[],
});
let loadController: AbortController | null = null;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let activeLoadKey = '';
let activeLoadPromise: null | Promise<void> = null;

const periodOptions = [
  { label: '跟随总览', value: 'follow' },
  { label: '近7天', value: '7d' },
  { label: '近30天', value: '30d' },
  { label: '本月', value: 'month' },
];

const columns: TableColumnsType<AdResponsibleRow> = [
  { dataIndex: 'responsible', fixed: 'left', title: '负责人', width: 108 },
  {
    dataIndex: 'adSpend',
    sorter: (a, b) => a.adSpend - b.adSpend,
    title: '广告花费',
    width: 92,
  },
  {
    dataIndex: 'orders',
    sorter: (a, b) =>
      a.adOrders - b.adOrders || a.totalSalesQty - b.totalSalesQty,
    title: '广告/总销量',
    width: 108,
  },
  {
    dataIndex: 'adCvr',
    sorter: (a, b) => a.adCvr - b.adCvr,
    title: '广告CVR',
    width: 112,
  },
  {
    dataIndex: 'acoas',
    sorter: (a, b) => a.acoas - b.acoas,
    title: 'ACoAS',
    width: 104,
  },
  {
    dataIndex: 'excessContribution',
    sorter: (a, b) => a.excessContribution - b.excessContribution,
    title: '超标影响',
    width: 132,
  },
  {
    dataIndex: 'status',
    fixed: 'right',
    title: '转换率变化状态',
    width: 132,
  },
];

const statusMeta: Record<
  AdMonitorStatus,
  { color: string; label: string; symbol: string }
> = {
  flat: { color: 'default', label: '持平', symbol: '−' },
  high_risk: { color: 'red', label: '高风险', symbol: '↓' },
  rising: { color: 'green', label: '上升', symbol: '↑' },
  warning: { color: 'orange', label: '预警', symbol: '↓' },
  watch: { color: 'gold', label: '关注', symbol: '↓' },
};

const summary = computed<AdMonitorSummary | undefined>(() => {
  const current = overview.value?.summary;
  if (!current || periodMode.value !== 'follow' || !props.followSummary) {
    return current;
  }
  return mergeAdMonitorFollowSummary(current, props.followSummary);
});
const periodText = computed(() => {
  const period = overview.value?.period;
  return period ? `${period.startDate} ~ ${period.endDate}` : '等待查询';
});
const departmentText = computed(() =>
  props.departments.length > 0 ? props.departments.join('、') : '全部部门',
);
const countryText = computed(() =>
  props.countries.length > 0 ? props.countries.join('、') : '全部国家',
);
const shopOptions = computed(() =>
  (overview.value?.filters.shops ?? []).map((shop) => ({
    label: shop,
    value: shop,
  })),
);

function requestPeriodParams() {
  if (periodMode.value === 'follow') {
    return {
      endDate: props.endDate || undefined,
      startDate: props.startDate || undefined,
    };
  }
  if (periodMode.value === 'range') {
    return {
      endDate: dateRange.value[1],
      rangePreset: '30d' as const,
      startDate: dateRange.value[0],
    };
  }
  return { rangePreset: periodMode.value };
}

function disabledFutureDate(value: ReturnType<typeof dayjs>) {
  return value.isAfter(dayjs(), 'day');
}

async function loadData() {
  if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = undefined;
  }
  const periodParams = requestPeriodParams();
  const loadKey = JSON.stringify({
    countries: props.countries.toSorted(),
    departments: props.departments.toSorted(),
    ...periodParams,
    responsibles: props.responsibles.toSorted(),
    shops: query.shops.toSorted(),
  });
  if (loadController && activeLoadKey === loadKey && activeLoadPromise) {
    return activeLoadPromise;
  }
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  activeLoadKey = loadKey;
  loading.value = true;
  const promise = (async () => {
    try {
      const result = await fetchAdMonitorOverview(
        {
          countries: [...props.countries],
          departments: [...props.departments],
          ...periodParams,
          responsibles: [...props.responsibles],
          shops: [...query.shops],
        },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        overview.value = result;
        dateRange.value = [result.period.startDate, result.period.endDate];
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      if (loadController === controller) {
        loadController = null;
        activeLoadKey = '';
        activeLoadPromise = null;
        loading.value = false;
      }
    }
  })();
  activeLoadPromise = promise;
  return promise;
}

function scheduleLoadData() {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = setTimeout(loadData, 180);
}

function handlePeriodModeChange() {
  if (periodMode.value === 'follow') {
    dateRange.value = [
      props.startDate || dateRange.value[0],
      props.endDate || dateRange.value[1],
    ];
  }
  scheduleLoadData();
}

function handleDateChange() {
  if (dateRange.value.length === 2) {
    periodMode.value = 'range';
    scheduleLoadData();
  }
}

function resetShops() {
  query.shops = [];
  void loadData();
}

function formatMoney(value?: number) {
  return `$${Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;
}

function formatInteger(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  });
}

function formatPercent(value?: number, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function formatSignedPercent(value?: number) {
  const normalized = Number(value || 0) * 100;
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(1)}%`;
}

function formatSignedPp(value?: number) {
  const normalized = Number(value || 0);
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(2)}pp`;
}

function deltaClass(value?: number, inverse = false) {
  const normalized = Number(value || 0);
  if (Math.abs(normalized) < 0.000_001) return 'is-neutral';
  const positive = inverse ? normalized < 0 : normalized > 0;
  return positive ? 'is-positive' : 'is-negative';
}

function contributionStroke(row: { excessSeverity?: number }) {
  const severity = Number(row.excessSeverity || 0);
  if (severity >= 1.5) return '#dc2626';
  if (severity >= 1.2) return '#f97316';
  return '#eab308';
}

function statusFor(row: { status?: AdMonitorStatus }) {
  return statusMeta[row.status ?? 'flat'];
}

watch(
  () => [
    props.countries.join('|'),
    props.departments.join('|'),
    props.responsibles.join('|'),
  ],
  () => {
    query.shops = [];
    scheduleLoadData();
  },
);

watch(
  () => [props.endDate, props.startDate],
  () => {
    if (periodMode.value === 'follow') {
      scheduleLoadData();
    }
  },
);

onMounted(loadData);
onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer);
  loadController?.abort();
});
</script>

<template>
  <section class="compact-ad-monitor">
    <header class="compact-head">
      <div class="compact-title">
        <div>
          <h2>广告监控</h2>
          <span>{{ periodText }}</span>
        </div>
        <div class="scope-text">
          <span :title="departmentText">{{ departmentText }}</span>
          <span :title="countryText">{{ countryText }}</span>
        </div>
        <div class="period-control">
          <Segmented
            v-model:value="periodMode"
            :options="periodOptions"
            size="small"
            @change="handlePeriodModeChange"
          />
          <DatePicker.RangePicker
            v-model:value="dateRange"
            :allow-clear="false"
            :disabled-date="disabledFutureDate"
            class="custom-date-range"
            size="small"
            value-format="YYYY-MM-DD"
            @change="handleDateChange"
          />
        </div>
      </div>
      <div class="compact-actions">
        <Button
          class="video-guide-button"
          href="https://lx7tto3sgdg.feishu.cn/minutes/obcnzxk19sde1y6141b9ctkn"
          rel="noopener noreferrer"
          size="small"
          target="_blank"
          type="primary"
        >
          <ExternalLink :size="14" aria-hidden="true" />
          <span>视频讲解</span>
        </Button>
        <Select
          v-model:value="query.shops"
          allow-clear
          class="shop-select"
          max-tag-count="responsive"
          mode="multiple"
          placeholder="全部店铺"
          show-search
          size="small"
          :options="shopOptions"
          @change="scheduleLoadData"
        />
        <Button v-if="query.shops.length > 0" size="small" @click="resetShops">
          重置
        </Button>
        <Button :loading="loading" size="small" @click="loadData">刷新</Button>
      </div>
    </header>

    <Spin :spinning="loading">
      <div class="metric-strip">
        <div class="metric-cell">
          <span>广告总花费</span>
          <strong>{{ formatMoney(summary?.totalSpend) }}</strong>
          <small>
            环比
            <b :class="deltaClass(summary?.spendChangeRate, true)">
              {{ formatSignedPercent(summary?.spendChangeRate) }}
            </b>
          </small>
        </div>
        <div class="metric-cell">
          <span>广告销量 / 总销量</span>
          <strong>
            {{ formatInteger(summary?.adOrders) }}
            <i>/</i>
            {{ formatInteger(summary?.totalSalesQty) }}
          </strong>
          <small>广告订单占比 {{ formatPercent(summary?.adOrderShare) }}</small>
        </div>
        <div class="metric-cell">
          <span>广告 CVR</span>
          <strong>{{ formatPercent(summary?.adCvr) }}</strong>
          <small>
            上一周期 {{ formatPercent(summary?.previousAdCvr) }}
            <b :class="deltaClass(summary?.cvrChangePp)">
              {{ formatSignedPp(summary?.cvrChangePp) }}
            </b>
          </small>
        </div>
        <div class="metric-cell emphasis">
          <span>广告占比 ACoAS</span>
          <strong>{{ formatPercent(summary?.acoas) }}</strong>
          <small>
            目标 {{ formatPercent(summary?.targetAcoas) }} · 超标
            <b :class="deltaClass(summary?.overTargetPp, true)">
              {{ formatSignedPp(summary?.overTargetPp) }}
            </b>
          </small>
        </div>
      </div>

      <div class="compact-content">
        <div class="responsible-table">
          <div class="content-head">
            <strong>负责人广告表现</strong>
            <span>
              目标覆盖 {{ formatPercent(summary?.targetCoverage) }} · 有效超标
              {{ formatMoney(summary?.totalExcessSpend) }}
            </span>
          </div>
          <Table
            bordered
            :columns="columns"
            :data-source="overview?.responsibleRows ?? []"
            :pagination="false"
            row-key="responsible"
            :scroll="{ x: 734, y: 214 }"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'responsible'">
                <div class="owner-cell">
                  <b>{{ record.responsible }}</b>
                  <span>{{ record.department }}</span>
                </div>
              </template>
              <template v-else-if="column.dataIndex === 'adSpend'">
                <b class="money-value">{{ formatMoney(record.adSpend) }}</b>
              </template>
              <template v-else-if="column.dataIndex === 'orders'">
                <b>
                  {{ formatInteger(record.adOrders) }}
                  /
                  {{ formatInteger(record.totalSalesQty) }}
                </b>
                <small>{{ formatPercent(record.adOrderShare) }}</small>
              </template>
              <template v-else-if="column.dataIndex === 'adCvr'">
                <b>{{ formatPercent(record.adCvr) }}</b>
                <small :class="deltaClass(record.cvrChangePp)">
                  {{ formatSignedPp(record.cvrChangePp) }}
                </small>
              </template>
              <template v-else-if="column.dataIndex === 'acoas'">
                <b>{{ formatPercent(record.acoas) }}</b>
                <small v-if="record.targetConfigured">
                  目标 {{ formatPercent(record.targetAcoas) }}
                </small>
                <small v-else class="is-warning">未配置目标</small>
              </template>
              <template v-else-if="column.dataIndex === 'excessContribution'">
                <Tooltip
                  :title="`有效超标 ${formatMoney(record.effectiveExcessSpend)}`"
                >
                  <div class="contribution-cell">
                    <Progress
                      :percent="record.excessContribution * 100"
                      :show-info="false"
                      size="small"
                      :stroke-color="contributionStroke(record)"
                    />
                    <b>{{ formatPercent(record.excessContribution) }}</b>
                  </div>
                </Tooltip>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <Tag :color="statusFor(record).color">
                  {{ statusFor(record).symbol }} {{ statusFor(record).label }}
                </Tag>
              </template>
            </template>
            <template #emptyText>
              <Empty
                :image="Empty.PRESENTED_IMAGE_SIMPLE"
                description="当前范围暂无广告数据"
              />
            </template>
          </Table>
        </div>

        <aside class="impact-panel">
          <div class="content-head">
            <strong>超标影响</strong>
            <span>按有效超标金额</span>
          </div>
          <div v-if="overview?.impactRows.length" class="impact-list">
            <div
              v-for="(row, index) in overview.impactRows.slice(0, 6)"
              :key="row.responsible"
              class="impact-row"
            >
              <span class="rank" :class="{ top: index < 3 }">{{
                index + 1
              }}</span>
              <div>
                <b>{{ row.responsible }}</b>
                <small>ACoAS {{ formatPercent(row.acoas) }}</small>
              </div>
              <div class="impact-value">
                <b>{{ formatMoney(row.effectiveExcessSpend) }}</b>
                <small>{{ formatPercent(row.excessContribution) }}</small>
              </div>
            </div>
          </div>
          <Empty
            v-else
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            description="暂无超标数据"
          />
        </aside>
      </div>
    </Spin>
  </section>
</template>

<style scoped>
.compact-ad-monitor {
  margin-bottom: 8px;
  overflow: hidden;
  color: var(--analytics-text, #334155);
  background: var(--analytics-panel, #fff);
  border: 1px solid var(--analytics-border, #e2e8f0);
  border-radius: 4px;
}

.compact-head,
.compact-title,
.compact-actions,
.content-head,
.contribution-cell,
.impact-row {
  display: flex;
  align-items: center;
}

.compact-head {
  gap: 12px;
  justify-content: space-between;
  min-height: 48px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--analytics-border, #e2e8f0);
}

.compact-title {
  gap: 14px;
  min-width: 0;
}

.compact-title > div:first-child {
  display: flex;
  gap: 9px;
  align-items: baseline;
  white-space: nowrap;
}

.compact-title h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--analytics-heading, #334155);
}

.compact-title span,
.content-head span {
  font-size: 11px;
  color: var(--analytics-subtle, #64748b);
}

.scope-text {
  display: flex;
  gap: 5px;
  min-width: 0;
}

.scope-text span {
  max-width: 150px;
  padding: 2px 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--analytics-panel-muted, #f8fafc);
  border: 1px solid var(--analytics-border, #e2e8f0);
}

.period-control {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
}

.period-control :deep(.ant-segmented) {
  white-space: nowrap;
}

.custom-date-range {
  width: 220px;
}

.compact-actions {
  flex: 0 1 auto;
  gap: 6px;
  min-width: 0;
}

.video-guide-button {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
}

.shop-select {
  width: clamp(170px, 20vw, 290px);
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  min-height: 84px;
  background: var(--analytics-panel-muted, #f8fafc);
  border-bottom: 1px solid var(--analytics-border, #e2e8f0);
}

.metric-cell {
  display: grid;
  align-content: center;
  min-width: 0;
  padding: 9px 14px;
  border-right: 1px solid var(--analytics-border, #e2e8f0);
}

.metric-cell:last-child {
  border-right: 0;
}

.metric-cell > span {
  font-size: 11px;
  color: var(--analytics-subtle, #64748b);
}

.metric-cell > strong {
  margin: 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 24px;
  line-height: 1.2;
  color: var(--analytics-strong, #111827);
  white-space: nowrap;
}

.metric-cell > strong i {
  margin: 0 3px;
  font-size: 15px;
  font-style: normal;
  color: var(--analytics-muted, #94a3b8);
}

.metric-cell small {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: var(--analytics-subtle, #64748b);
  white-space: nowrap;
}

.metric-cell.emphasis {
  box-shadow: inset 3px 0 #2563eb;
}

.metric-cell.emphasis > strong {
  color: #1d4ed8;
}

.compact-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  min-height: 260px;
}

.responsible-table,
.impact-panel {
  min-width: 0;
}

.impact-panel {
  border-left: 1px solid var(--analytics-border, #e2e8f0);
}

.content-head {
  gap: 10px;
  justify-content: space-between;
  min-height: 36px;
  padding: 6px 10px;
  background: var(--analytics-panel, #fff);
  border-bottom: 1px solid var(--analytics-border, #e2e8f0);
}

.content-head strong {
  font-size: 13px;
  color: var(--analytics-heading, #334155);
}

.responsible-table :deep(.ant-table-cell) {
  padding: 5px 7px !important;
  font-size: 12px;
  text-align: center;
}

.responsible-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 700;
  color: var(--analytics-heading, #334155);
  background: var(--analytics-panel-muted, #f8fafc);
}

.responsible-table :deep(.ant-table-tbody > tr:nth-child(even) > td) {
  background: var(--analytics-panel-muted, #f8fafc);
}

.responsible-table :deep(.ant-tag) {
  margin-inline-end: 0;
  font-size: 11px;
}

.owner-cell,
.responsible-table small {
  display: grid;
  gap: 1px;
}

.owner-cell span,
.responsible-table small {
  font-size: 10px;
  color: var(--analytics-subtle, #64748b);
}

.money-value {
  color: #1d4ed8;
}

.contribution-cell {
  gap: 6px;
}

.contribution-cell :deep(.ant-progress) {
  flex: 1;
  min-width: 42px;
}

.contribution-cell b {
  width: 38px;
  font-size: 11px;
  text-align: right;
}

.impact-list {
  max-height: 224px;
  padding: 0 10px;
  overflow-y: auto;
}

.impact-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 8px;
  min-height: 37px;
  border-bottom: 1px solid var(--analytics-border, #e2e8f0);
}

.impact-row > div {
  display: grid;
  min-width: 0;
}

.impact-row b {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: var(--analytics-heading, #334155);
  white-space: nowrap;
}

.impact-row small {
  font-size: 10px;
  color: var(--analytics-subtle, #64748b);
}

.rank {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  font-size: 10px;
  color: var(--analytics-subtle, #64748b);
  background: var(--analytics-panel-muted, #f8fafc);
  border: 1px solid var(--analytics-border, #e2e8f0);
}

.rank.top {
  color: #fff;
  background: #f97316;
  border-color: #f97316;
}

.impact-value {
  justify-items: end;
}

.impact-value b {
  color: #b42318;
}

.impact-panel > :deep(.ant-empty) {
  margin: 54px 0 0;
}

.is-positive {
  color: #059669 !important;
}

.is-negative {
  color: #dc2626 !important;
}

.is-neutral {
  color: var(--analytics-subtle, #64748b) !important;
}

.is-warning {
  color: #b45309 !important;
}

@media (width <= 1100px) {
  .compact-head {
    align-items: flex-start;
  }

  .compact-title {
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }

  .compact-content {
    grid-template-columns: minmax(0, 1fr) 250px;
  }
}

@media (width <= 820px) {
  .compact-head,
  .compact-actions {
    flex-wrap: wrap;
  }

  .compact-actions {
    width: 100%;
  }

  .period-control {
    flex-wrap: wrap;
    max-width: 100%;
  }

  .shop-select {
    flex: 1;
    width: auto;
    min-width: 160px;
  }

  .custom-date-range {
    width: 220px;
  }

  .metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-cell:nth-child(2) {
    border-right: 0;
  }

  .metric-cell:nth-child(-n + 2) {
    border-bottom: 1px solid var(--analytics-border, #e2e8f0);
  }

  .compact-content {
    grid-template-columns: 1fr;
  }

  .impact-panel {
    border-top: 1px solid var(--analytics-border, #e2e8f0);
    border-left: 0;
  }
}
</style>
