<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { AdMonitorOverviewParams } from '#/api/kanban';
import type {
  AdCampaignDrilldown,
  AdCampaignDrilldownRow,
} from '#/api/kanban/types';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Empty, message, Modal, Spin, Table, Tag } from 'ant-design-vue';

import { fetchAdCampaignDrilldown } from '#/api/kanban';

const props = defineProps<{
  open: boolean;
  params: AdMonitorOverviewParams;
  responsible: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const loading = ref(false);
const detail = ref<AdCampaignDrilldown | null>(null);
let controller: AbortController | null = null;

const textCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function compareText(left?: string, right?: string) {
  return textCollator.compare(String(left || ''), String(right || ''));
}

function compareNullableNumber(
  left: null | number | undefined,
  right: null | number | undefined,
) {
  return (
    (left ?? Number.NEGATIVE_INFINITY) - (right ?? Number.NEGATIVE_INFINITY)
  );
}

function campaignFilterValue(row: AdCampaignDrilldownRow) {
  return JSON.stringify([row.campaignId, row.shop || row.country]);
}

function scopeFilterValue(row: AdCampaignDrilldownRow) {
  return JSON.stringify([
    row.shop || row.country || '未识别店铺',
    row.spu || '未识别',
    row.parentAsin || '未识别',
  ]);
}

function scopeFilterText(row: AdCampaignDrilldownRow) {
  return `${row.shop || row.country || '未识别店铺'} · SPU ${
    row.spu || '未识别'
  } · 父ASIN ${row.parentAsin || '未识别'}`;
}

const campaignFilters = computed(() => {
  const uniqueRows = new Map<string, AdCampaignDrilldownRow>();
  for (const row of detail.value?.rows || []) {
    uniqueRows.set(campaignFilterValue(row), row);
  }
  return [...uniqueRows.entries()]
    .sort(([, left], [, right]) => {
      const nameResult = compareText(left.campaignName, right.campaignName);
      return (
        nameResult ||
        compareText(left.shop || left.country, right.shop || right.country)
      );
    })
    .map(([value, row]) => ({
      text: `${row.campaignName} · ${
        row.shop || row.country || '未识别店铺'
      } · ID ${row.campaignId}`,
      value,
    }));
});

const scopeFilters = computed(() => {
  const uniqueRows = new Map<string, AdCampaignDrilldownRow>();
  for (const row of detail.value?.rows || []) {
    uniqueRows.set(scopeFilterValue(row), row);
  }
  return [...uniqueRows.entries()]
    .sort(([, left], [, right]) =>
      compareText(scopeFilterText(left), scopeFilterText(right)),
    )
    .map(([value, row]) => ({
      text: scopeFilterText(row),
      value,
    }));
});

const columns = computed<TableColumnsType<AdCampaignDrilldownRow>>(() => [
  {
    dataIndex: 'campaignName',
    filters: campaignFilters.value,
    filterSearch: true,
    fixed: 'left',
    onFilter: (value, row) => campaignFilterValue(row) === String(value),
    sorter: (left, right) => compareText(left.campaignName, right.campaignName),
    title: '广告活动',
    width: 250,
  },
  {
    dataIndex: 'scope',
    filters: scopeFilters.value,
    filterSearch: true,
    onFilter: (value, row) => scopeFilterValue(row) === String(value),
    sorter: (left, right) => {
      const shopResult = compareText(
        left.shop || left.country,
        right.shop || right.country,
      );
      const spuResult = compareText(left.spu, right.spu);
      return (
        shopResult ||
        spuResult ||
        compareText(left.parentAsin, right.parentAsin)
      );
    },
    title: '归属商品',
    width: 210,
  },
  {
    dataIndex: 'adSpend',
    sorter: (left, right) => left.adSpend - right.adSpend,
    title: '花费',
    width: 155,
  },
  {
    dataIndex: 'adSales',
    sorter: (left, right) => left.adSales - right.adSales,
    title: '广告销售额',
    width: 155,
  },
  {
    dataIndex: 'adUnits',
    sorter: (left, right) => left.adUnits - right.adUnits,
    title: '广告销量',
    width: 140,
  },
  {
    dataIndex: 'adCvr',
    sorter: (left, right) => left.adCvr - right.adCvr,
    title: '广告CVR',
    width: 125,
  },
  {
    dataIndex: 'acos',
    sorter: (left, right) => compareNullableNumber(left.acos, right.acos),
    title: 'ACOS',
    width: 125,
  },
  {
    dataIndex: 'acoas',
    sorter: (left, right) => compareNullableNumber(left.acoas, right.acoas),
    title: 'ACoAS',
    width: 135,
  },
  {
    dataIndex: 'allocatedExcessSpend',
    sorter: (left, right) =>
      left.allocatedExcessSpend - right.allocatedExcessSpend,
    title: '分摊超标',
    width: 135,
  },
  { dataIndex: 'poorReasons', title: '低效原因', width: 190 },
]);

const title = computed(() =>
  props.responsible ? `${props.responsible} · 超标广告活动` : '超标广告活动',
);

function formatMoney(value?: number) {
  return `$${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

function formatSignedMoney(value?: number) {
  const number = Math.round(Number(value || 0));
  let sign = '';
  if (number > 0) sign = '+';
  if (number < 0) sign = '-';
  return `${sign}$${Math.abs(number).toLocaleString('en-US')}`;
}

function formatInteger(value?: number) {
  return Math.round(Number(value || 0)).toLocaleString('en-US');
}

function formatSignedInteger(value?: number) {
  const number = Math.round(Number(value || 0));
  return `${number > 0 ? '+' : ''}${number.toLocaleString('en-US')}`;
}

function formatPercent(value?: number, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function formatNullablePercent(value: null | number, digits = 1) {
  return value === null ? '-' : formatPercent(value, digits);
}

function formatSignedRate(value?: number) {
  const number = Number(value || 0) * 100;
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}%`;
}

function formatSignedPp(value?: number) {
  const number = Number(value || 0);
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}pp`;
}

function deltaClass(value?: number, inverse = false) {
  const number = Number(value || 0);
  if (number > 0) return inverse ? 'is-negative' : 'is-positive';
  if (number < 0) return inverse ? 'is-positive' : 'is-negative';
  return 'is-neutral';
}

function typeColor(value: string) {
  if (value === 'SP') return 'blue';
  if (value === 'SD') return 'cyan';
  if (value === 'SBV') return 'purple';
  return 'geekblue';
}

async function loadDetail() {
  if (!props.open || !props.responsible) return;
  controller?.abort();
  const nextController = new AbortController();
  controller = nextController;
  loading.value = true;
  try {
    detail.value = await fetchAdCampaignDrilldown(
      {
        ...props.params,
        responsible: props.responsible,
      },
      nextController.signal,
    );
  } catch {
    if (!nextController.signal.aborted) {
      detail.value = null;
      message.error('超标广告活动加载失败');
    }
  } finally {
    if (controller === nextController) {
      controller = null;
      loading.value = false;
    }
  }
}

watch(
  () => [props.open, props.responsible, JSON.stringify(props.params)],
  () => {
    void loadDetail();
  },
  { immediate: true },
);

onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <Modal
    :footer="null"
    :open="open"
    :title="title"
    :width="1600"
    destroy-on-close
    @cancel="emit('close')"
  >
    <Spin :spinning="loading">
      <div v-if="detail" class="drilldown-body">
        <div class="summary-strip">
          <div>
            <span>负责人有效超标</span>
            <b class="is-negative">
              {{ formatMoney(detail.responsibleExcessSpend) }}
            </b>
          </div>
          <div>
            <span>负责人 ACoAS / 目标</span>
            <b>
              {{ formatPercent(detail.responsibleAcoas) }} /
              {{ formatPercent(detail.targetAcoas) }}
            </b>
          </div>
          <div>
            <span>低效活动分摊超标</span>
            <b class="is-negative">
              {{ formatMoney(detail.listedExcessSpend) }}
            </b>
            <small>活动总花费 {{ formatMoney(detail.campaignAdSpend) }}</small>
          </div>
          <div>
            <span>低效活动</span>
            <b>
              {{ detail.qualifiedCampaignCount }} /
              {{ detail.totalCampaignCount }}
            </b>
          </div>
        </div>

        <p class="metric-note">
          负责人超标金额按活动花费占比分摊；低效活动包含零转化、CVR 下降或 ACOS
          高于该负责人活动均值的活动。ACoAS = 活动花费 / 归属商品总销售额。
        </p>

        <Table
          class="campaign-drilldown-table"
          :columns="columns"
          :data-source="detail.rows"
          :pagination="{
            defaultPageSize: 10,
            pageSizeOptions: ['10', '20', '50'],
            showSizeChanger: true,
          }"
          :row-key="
            (row: AdCampaignDrilldownRow) => `${row.campaignId}-${row.shop}`
          "
          :scroll="{ x: 1620, y: 520 }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'campaignName'">
              <div class="campaign-cell">
                <b>{{ record.campaignName }}</b>
                <span>
                  <Tag :color="typeColor(record.sponsoredType)">
                    {{ record.sponsoredType }}
                  </Tag>
                  ID {{ record.campaignId }} ·
                  {{ record.adGroupCount }} 个广告组
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'scope'">
              <div class="scope-cell">
                <b>{{ record.shop || record.country }}</b>
                <span :title="record.spu || '未识别'">
                  SPU {{ record.spu || '未识别' }}
                </span>
                <span :title="record.parentAsin || '未识别'">
                  父ASIN {{ record.parentAsin || '未识别' }}
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'adSpend'">
              <div class="metric-cell">
                <b>{{ formatMoney(record.adSpend) }}</b>
                <span>上期 {{ formatMoney(record.previousAdSpend) }}</span>
                <span
                  :class="deltaClass(record.adSpendChange, true)"
                  class="metric-delta"
                >
                  {{ formatSignedMoney(record.adSpendChange) }} ·
                  {{ formatSignedRate(record.adSpendChangeRate) }}
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'adSales'">
              <div class="metric-cell">
                <b>{{ formatMoney(record.adSales) }}</b>
                <span>上期 {{ formatMoney(record.previousAdSales) }}</span>
                <span
                  :class="deltaClass(record.adSalesChange)"
                  class="metric-delta"
                >
                  {{ formatSignedMoney(record.adSalesChange) }} ·
                  {{ formatSignedRate(record.adSalesChangeRate) }}
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'adUnits'">
              <div class="metric-cell">
                <b>{{ formatInteger(record.adUnits) }}</b>
                <span>上期 {{ formatInteger(record.previousAdUnits) }}</span>
                <span
                  :class="deltaClass(record.adUnitsChange)"
                  class="metric-delta"
                >
                  {{ formatSignedInteger(record.adUnitsChange) }} ·
                  {{ formatSignedRate(record.adUnitsChangeRate) }}
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'adCvr'">
              <div class="metric-cell">
                <b>{{ formatPercent(record.adCvr) }}</b>
                <span :class="deltaClass(record.cvrChangePp)">
                  上期 {{ formatPercent(record.previousAdCvr) }} ·
                  {{ formatSignedPp(record.cvrChangePp) }}
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'acos'">
              <div class="metric-cell">
                <b>{{ formatNullablePercent(record.acos) }}</b>
                <span>
                  上期 {{ formatNullablePercent(record.previousAcos) }}
                </span>
                <span :class="deltaClass(record.acosChangePp, true)">
                  {{ formatSignedPp(record.acosChangePp) }}
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'acoas'">
              <div class="metric-cell">
                <b>{{ formatNullablePercent(record.acoas) }}</b>
                <span>
                  上期 {{ formatNullablePercent(record.previousAcoas) }}
                </span>
                <span :class="deltaClass(record.acoasChangePp, true)">
                  {{ formatSignedPp(record.acoasChangePp) }}
                </span>
                <span
                  :title="`上期 ${formatMoney(record.previousSalesAmount)}`"
                >
                  商品销售额 {{ formatMoney(record.salesAmount) }}
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'allocatedExcessSpend'">
              <div class="metric-cell">
                <b class="is-negative">
                  {{ formatMoney(record.allocatedExcessSpend) }}
                </b>
                <span>
                  负责人超标的
                  {{ formatPercent(record.excessContribution) }}
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'poorReasons'">
              <div class="reason-tags">
                <Tag
                  v-for="reason in record.poorReasons"
                  :key="reason"
                  color="orange"
                >
                  {{ reason }}
                </Tag>
              </div>
            </template>
          </template>
          <template #emptyText>
            <Empty description="当前负责人没有符合条件的低效超标活动" />
          </template>
        </Table>
      </div>
      <Empty v-else-if="!loading" description="暂无活动下钻数据" />
    </Spin>
  </Modal>
</template>

<style scoped>
.drilldown-body {
  min-height: 320px;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 10px;
  background: #f5f8fc;
  border-block: 1px solid #d7e0ec;
}

.summary-strip > div {
  display: grid;
  gap: 5px;
  padding: 12px 16px;
  border-right: 1px solid #d7e0ec;
}

.summary-strip > div:last-child {
  border-right: 0;
}

.summary-strip span,
.summary-strip small,
.metric-note,
.campaign-cell span,
.scope-cell span,
.metric-cell span {
  font-size: 12px;
  color: #667085;
}

.summary-strip b {
  font-size: 18px;
  color: #172033;
}

.metric-note {
  margin: 0 0 12px;
}

.campaign-cell,
.scope-cell,
.metric-cell {
  display: grid;
  gap: 4px;
}

.campaign-cell b,
.scope-cell b {
  overflow: hidden;
  text-overflow: ellipsis;
  color: #172033;
  white-space: nowrap;
}

.scope-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-delta {
  font-weight: 600;
}

.campaign-cell span {
  display: flex;
  align-items: center;
}

.reason-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.reason-tags :deep(.ant-tag),
.campaign-cell :deep(.ant-tag) {
  margin-inline-end: 0;
}

.campaign-drilldown-table :deep(.ant-table-filter-trigger) {
  box-sizing: border-box;
  display: inline-flex;
  flex: 0 0 24px;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: -2px 0 -2px 6px;
  padding: 0;
  color: #175cd3;
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgb(16 24 40 / 8%);
}

.campaign-drilldown-table :deep(.ant-table-filter-trigger:hover) {
  color: #0b4db8;
  background: #dbeafe;
  border-color: #3b82f6;
}

.campaign-drilldown-table :deep(.ant-table-filter-trigger.active) {
  color: #fff;
  background: #2563eb;
  border-color: #1d4ed8;
  box-shadow: 0 0 0 2px rgb(37 99 235 / 18%);
}

.campaign-drilldown-table :deep(.ant-table-filter-trigger .anticon) {
  font-size: 13px;
}

.is-positive {
  color: #039855 !important;
}

.is-negative {
  color: #d92d20 !important;
}

.is-neutral {
  color: #667085 !important;
}

@media (max-width: 760px) {
  .summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
