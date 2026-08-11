<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  AdAutomationAnalysis,
  AdAutomationCampaignRow,
  AdAutomationHourRow,
  AdAutomationPlacementRow,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Empty,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  fetchAdAutomationAnalysis,
  fetchAdAutomationCampaigns,
} from '#/api/kanban';

const loading = ref(false);
const detailLoading = ref(false);
const rows = ref<AdAutomationCampaignRow[]>([]);
const overview = ref<Awaited<ReturnType<typeof fetchAdAutomationCampaigns>>>();
const selected = ref<AdAutomationCampaignRow>();
const analysis = ref<AdAutomationAnalysis>();
const detailOpen = ref(false);
const detailTab = ref('placement');
const dateRange = ref<[string, string] | undefined>();

const query = reactive({
  action: '',
  page: 1,
  pageSize: 50,
  search: '',
  shops: [] as string[],
  sponsoredTypes: [] as string[],
  targetAcos: 30,
});

const actionOptions = [
  { label: '全部建议', value: '' },
  { label: '提高竞价', value: 'increase' },
  { label: '降低竞价', value: 'decrease' },
  { label: '保持不变', value: 'hold' },
  { label: '继续观察', value: 'observe' },
];

const campaignColumns: TableColumnsType<AdAutomationCampaignRow> = [
  {
    dataIndex: 'campaignName',
    fixed: 'left',
    key: 'campaignName',
    title: '广告活动',
    width: 270,
  },
  { dataIndex: 'storeName', key: 'storeName', title: '店铺', width: 140 },
  {
    dataIndex: 'sponsoredType',
    key: 'sponsoredType',
    title: '类型',
    width: 74,
  },
  { dataIndex: 'mappedSpus', key: 'mappedSpus', title: 'SPU映射', width: 170 },
  {
    dataIndex: 'impressions',
    key: 'impressions',
    sorter: true,
    title: '曝光',
    width: 100,
  },
  {
    dataIndex: 'clicks',
    key: 'clicks',
    sorter: true,
    title: '点击',
    width: 82,
  },
  { dataIndex: 'cpc', key: 'cpc', sorter: true, title: 'CPC', width: 82 },
  {
    dataIndex: 'spends',
    key: 'spends',
    sorter: true,
    title: '花费',
    width: 92,
  },
  {
    dataIndex: 'sales',
    key: 'sales',
    sorter: true,
    title: '销售额',
    width: 100,
  },
  {
    dataIndex: 'orders',
    key: 'orders',
    sorter: true,
    title: '订单',
    width: 76,
  },
  { dataIndex: 'acos', key: 'acos', sorter: true, title: 'ACoS', width: 86 },
  { dataIndex: 'cvr', key: 'cvr', sorter: true, title: 'CVR', width: 82 },
  {
    dataIndex: 'effectiveTargetAcos',
    key: 'effectiveTargetAcos',
    title: '有效目标',
    width: 92,
  },
  {
    dataIndex: 'fbaAvailable',
    key: 'fbaAvailable',
    title: '可售库存',
    width: 96,
  },
  { dataIndex: 'daysSupply', key: 'daysSupply', title: '供货天数', width: 92 },
  {
    dataIndex: 'inventoryStatus',
    key: 'inventoryStatus',
    title: '库存状态',
    width: 96,
  },
  { dataIndex: 'action', key: 'action', title: '建议', width: 112 },
  { dataIndex: 'reason', key: 'reason', title: '判断依据', width: 360 },
  { key: 'operation', fixed: 'right', title: '', width: 82 },
];

const placementColumns: TableColumnsType<AdAutomationPlacementRow> = [
  {
    dataIndex: 'placementName',
    key: 'placementName',
    title: '广告位',
    width: 150,
  },
  { dataIndex: 'impressions', key: 'impressions', title: '曝光', width: 96 },
  { dataIndex: 'clicks', key: 'clicks', title: '点击', width: 80 },
  { dataIndex: 'cpc', key: 'cpc', title: 'CPC', width: 80 },
  { dataIndex: 'acos', key: 'acos', title: 'ACoS', width: 84 },
  { dataIndex: 'cvr', key: 'cvr', title: 'CVR', width: 80 },
  {
    dataIndex: 'currentPlacementAdjustment',
    key: 'currentPlacementAdjustment',
    title: '当前加价',
    width: 100,
  },
  {
    dataIndex: 'suggestedPlacementAdjustment',
    key: 'suggestedPlacementAdjustment',
    title: '建议加价',
    width: 100,
  },
  { dataIndex: 'action', key: 'action', title: '建议', width: 108 },
  { dataIndex: 'reason', key: 'reason', title: '判断依据', width: 280 },
];

const hourColumns: TableColumnsType<AdAutomationHourRow> = [
  {
    dataIndex: 'hourLabel',
    fixed: 'left',
    key: 'hourLabel',
    title: '时段',
    width: 118,
  },
  {
    dataIndex: 'daysObserved',
    key: 'daysObserved',
    title: '有效天数',
    width: 86,
  },
  { dataIndex: 'impressions', key: 'impressions', title: '曝光', width: 96 },
  { dataIndex: 'clicks', key: 'clicks', title: '点击', width: 80 },
  { dataIndex: 'spends', key: 'spends', title: '花费', width: 84 },
  { dataIndex: 'orders', key: 'orders', title: '订单', width: 72 },
  { dataIndex: 'cpc', key: 'cpc', title: 'CPC', width: 80 },
  { dataIndex: 'acos', key: 'acos', title: 'ACoS', width: 84 },
  { dataIndex: 'cvr', key: 'cvr', title: 'CVR', width: 80 },
  { dataIndex: 'action', key: 'action', title: '建议', width: 108 },
  { dataIndex: 'reason', key: 'reason', title: '判断依据', width: 280 },
];

const shopOptions = computed(() =>
  (overview.value?.filters.shops ?? []).map((value) => ({
    label: value,
    value,
  })),
);

const typeOptions = computed(() =>
  (overview.value?.filters.sponsoredTypes ?? []).map((value) => ({
    label: value,
    value,
  })),
);

const summaryItems = computed(() => {
  const summary = overview.value?.summary;
  return [
    { label: '启用活动', tone: 'neutral', value: summary?.total ?? 0 },
    { label: '建议提高', tone: 'increase', value: summary?.increase ?? 0 },
    { label: '建议降低', tone: 'decrease', value: summary?.decrease ?? 0 },
    { label: '保持不变', tone: 'hold', value: summary?.hold ?? 0 },
    { label: '样本不足', tone: 'observe', value: summary?.observe ?? 0 },
    { label: '利润可用', tone: 'ready', value: summary?.profitReady ?? 0 },
    { label: '库存可用', tone: 'ready', value: summary?.inventoryReady ?? 0 },
    { label: '护栏拦截', tone: 'guarded', value: summary?.guarded ?? 0 },
  ];
});

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || '未知错误');
}

function formatNumber(value: number, digits = 0) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatMoney(value: number) {
  return `$${formatNumber(value, 2)}`;
}

function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`;
}

function optionalPercent(value: null | number | undefined) {
  return value === null || value === undefined ? '-' : formatPercent(value);
}

function inventoryColor(status: string) {
  return (
    {
      cautious: 'gold',
      critical: 'red',
      high: 'blue',
      healthy: 'green',
      low: 'orange',
      missing: 'default',
      overstock: 'purple',
      stale: 'red',
      stockout: 'red',
      unknown_days: 'default',
    }[status] ?? 'default'
  );
}

function inventoryLabel(status: string) {
  return (
    {
      cautious: '谨慎放量',
      critical: '库存紧张',
      high: '库存偏高',
      healthy: '库存正常',
      low: '库存偏低',
      missing: '无库存数据',
      overstock: '积压风险',
      stale: '快照过期',
      stockout: '断货风险',
      unknown_days: '天数未知',
    }[status] ?? status
  );
}

function profitLabel(status: string, estimated = false) {
  if (estimated && status === 'ready') return '上月毛利估算';
  if (estimated && status === 'partial') return '估算数据部分缺失';
  if (estimated && status === 'non_positive') return '估算利润风险';
  return (
    {
      ready: '已匹配',
      partial: '部分缺失',
      incomplete: '字段缺失',
      non_positive: '利润风险',
      missing: '无毛利',
    }[status] ?? status
  );
}

function daysSupplySourceLabel(source: string) {
  return (
    {
      fba_historical: '领星历史供货天数',
      missing: '无有效销量基线',
      spu_metrics_cache: '按库存和平均销量测算',
    }[source] ?? source
  );
}

function actionLabel(action: string) {
  return (
    {
      decrease: '降低竞价',
      hold: '保持不变',
      increase: '提高竞价',
      observe: '继续观察',
    }[action] ?? action
  );
}

function actionColor(action: string) {
  return (
    {
      decrease: 'orange',
      hold: 'green',
      increase: 'blue',
      observe: 'default',
    }[action] ?? 'default'
  );
}

function adjustmentText(row: { action?: string; adjustmentPct?: number }) {
  const action = row.action ?? 'observe';
  const adjustment = row.adjustmentPct ?? 0;
  if (action === 'observe' || adjustment === 0) return actionLabel(action);
  return `${actionLabel(action)} ${adjustment > 0 ? '+' : ''}${adjustment}%`;
}

function campaignRecord(record: Record<string, any>) {
  return record as AdAutomationCampaignRow;
}

async function loadCampaigns(resetPage = false) {
  if (resetPage) query.page = 1;
  loading.value = true;
  try {
    const data = await fetchAdAutomationCampaigns({
      action: query.action || undefined,
      endDate: dateRange.value?.[1],
      page: query.page,
      pageSize: query.pageSize,
      search: query.search.trim() || undefined,
      shops: query.shops.length > 0 ? query.shops : undefined,
      sponsoredTypes:
        query.sponsoredTypes.length > 0 ? query.sponsoredTypes : undefined,
      startDate: dateRange.value?.[0],
      targetAcos: query.targetAcos,
    });
    overview.value = data;
    rows.value = data.rows;
    if (!dateRange.value?.length) {
      dateRange.value = [data.query.startDate, data.query.endDate];
    }
  } catch (error) {
    message.error(`加载广告活动失败：${errorText(error)}`);
  } finally {
    loading.value = false;
  }
}

async function openAnalysis(row: AdAutomationCampaignRow, refresh = false) {
  selected.value = row;
  detailOpen.value = true;
  detailLoading.value = true;
  if (!refresh) analysis.value = undefined;
  try {
    analysis.value = await fetchAdAutomationAnalysis(
      row.profileId,
      row.campaignId,
      {
        endDate: dateRange.value?.[1],
        refresh,
        startDate: dateRange.value?.[0],
        targetAcos: query.targetAcos,
      },
    );
    detailTab.value =
      analysis.value.placements.length > 0 ? 'placement' : 'hour';
  } catch (error) {
    message.error(`加载活动分析失败：${errorText(error)}`);
  } finally {
    detailLoading.value = false;
  }
}

function resetFilters() {
  query.action = '';
  query.search = '';
  query.shops = [];
  query.sponsoredTypes = [];
  query.targetAcos = 30;
  dateRange.value = undefined;
  loadCampaigns(true);
}

function handleTableChange(pagination: {
  current?: number;
  pageSize?: number;
}) {
  query.page = pagination.current ?? 1;
  query.pageSize = pagination.pageSize ?? 50;
  loadCampaigns();
}

onMounted(() => loadCampaigns());
</script>

<template>
  <div class="automation-page">
    <header class="page-header">
      <div>
        <h1>广告自动化</h1>
        <span v-if="overview">数据截止 {{ overview.query.endDate }}</span>
      </div>
      <Tag color="blue">仅建议，不自动执行</Tag>
    </header>

    <section class="filter-band">
      <Input
        v-model:value="query.search"
        allow-clear
        class="search-input"
        placeholder="广告活动、ID 或店铺"
        @press-enter="loadCampaigns(true)"
      />
      <Select
        v-model:value="query.shops"
        :max-tag-count="1"
        :options="shopOptions"
        allow-clear
        mode="multiple"
        placeholder="店铺"
        show-search
      />
      <Select
        v-model:value="query.sponsoredTypes"
        :options="typeOptions"
        allow-clear
        mode="multiple"
        placeholder="广告类型"
      />
      <Select v-model:value="query.action" :options="actionOptions" />
      <DatePicker.RangePicker
        v-model:value="dateRange"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
      />
      <div class="target-input">
        <span>目标 ACoS 上限</span>
        <InputNumber
          v-model:value="query.targetAcos"
          :max="100"
          :min="5"
          :step="1"
        />
        <span>%</span>
      </div>
      <Space>
        <Button type="primary" @click="loadCampaigns(true)">查询</Button>
        <Button @click="resetFilters">重置</Button>
      </Space>
    </section>

    <section class="summary-strip">
      <div
        v-for="item in summaryItems"
        :key="item.label"
        class="summary-item"
        :data-tone="item.tone"
      >
        <span>{{ item.label }}</span>
        <strong>{{ formatNumber(item.value) }}</strong>
      </div>
    </section>

    <section class="table-section">
      <div class="section-head">
        <div>
          <h2>活动建议</h2>
          <span>28 天数据，排除最近 2 天归因窗口；有效目标会受 SKU
            毛利和库存护栏限制</span>
        </div>
        <span v-if="overview">
          花费 {{ formatMoney(overview.summary.spends) }} · 销售额
          {{ formatMoney(overview.summary.sales) }}
        </span>
      </div>
      <Table
        :columns="campaignColumns"
        :data-source="rows"
        :loading="loading"
        :pagination="{
          current: overview?.pagination.page ?? query.page,
          pageSize: overview?.pagination.pageSize ?? query.pageSize,
          showSizeChanger: true,
          showTotal: (total: number) => `共 ${total} 个启用活动`,
          total: overview?.pagination.total ?? 0,
        }"
        :row-key="(row) => `${row.profileId}-${row.campaignId}`"
        :scroll="{ x: 2200, y: 'calc(100vh - 410px)' }"
        size="small"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'campaignName'">
            <div class="campaign-cell">
              <strong>{{ record.campaignName || record.campaignId }}</strong>
              <span>{{ record.campaignId }} ·
                {{ record.adGroupCount }} 个广告组</span>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'sponsoredType'">
            <Tag color="geekblue">{{ record.sponsoredType }}</Tag>
          </template>
          <template
            v-else-if="
              column.dataIndex === 'impressions' ||
              column.dataIndex === 'clicks' ||
              column.dataIndex === 'orders'
            "
          >
            {{ formatNumber(record[column.dataIndex]) }}
          </template>
          <template
            v-else-if="
              column.dataIndex === 'cpc' ||
              column.dataIndex === 'spends' ||
              column.dataIndex === 'sales'
            "
          >
            {{ formatMoney(record[column.dataIndex]) }}
          </template>
          <template
            v-else-if="
              column.dataIndex === 'acos' || column.dataIndex === 'cvr'
            "
          >
            {{ formatPercent(record[column.dataIndex]) }}
          </template>
          <template v-else-if="column.dataIndex === 'mappedSpus'">
            <div class="mapping-cell">
              <span :title="record.mappedSpus.join(', ')">{{
                record.mappedSpus.length > 0
                  ? record.mappedSpus.join(', ')
                  : '未匹配'
              }}</span>
              <Tag
                :color="
                  record.skuMappingConfidence === 'high' ? 'green' : 'orange'
                "
              >
                {{
                  record.skuMappingConfidence === 'high' ? '精确' : 'SPU/弱映射'
                }}
              </Tag>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'effectiveTargetAcos'">
            {{ optionalPercent(record.effectiveTargetAcos) }}
          </template>
          <template v-else-if="column.dataIndex === 'fbaAvailable'">
            {{ formatNumber(record.fbaAvailable) }}
          </template>
          <template v-else-if="column.dataIndex === 'daysSupply'">
            <span :title="daysSupplySourceLabel(record.daysSupplySource)">
              {{
                record.daysSupply == null
                  ? '-'
                  : `${formatNumber(record.daysSupply, 1)} 天`
              }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'inventoryStatus'">
            <Tag
              :color="inventoryColor(record.inventoryStatus)"
              :title="record.inventoryReason"
            >
              {{ inventoryLabel(record.inventoryStatus) }}
            </Tag>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <Tag :color="actionColor(record.action)">
              {{ adjustmentText(record) }}
            </Tag>
          </template>
          <template v-else-if="column.dataIndex === 'reason'">
            <span class="reason-text">{{ record.reason }}</span>
          </template>
          <template v-else-if="column.key === 'operation'">
            <Button
              size="small"
              type="link"
              @click="openAnalysis(campaignRecord(record))"
            >
              分析
            </Button>
          </template>
        </template>
      </Table>
    </section>

    <Drawer
      v-model:open="detailOpen"
      :title="selected?.campaignName || '活动分析'"
      :width="980"
      destroy-on-close
    >
      <template #extra>
        <Button
          :loading="detailLoading"
          @click="selected && openAnalysis(selected, true)"
        >
          刷新数据
        </Button>
      </template>
      <Spin :spinning="detailLoading">
        <template v-if="analysis">
          <div class="detail-meta">
            <Tag color="blue">{{ analysis.campaign.sponsoredType }}</Tag>
            <span>{{ analysis.campaign.storeName }}</span>
            <span>{{ analysis.query.startDate }} 至
              {{ analysis.query.endDate }}</span>
            <span>{{ analysis.campaign.adGroupCount }} 个广告组</span>
          </div>
          <div v-if="selected" class="context-grid">
            <div>
              <span>SPU映射</span><strong>{{
                selected.mappedSpus.length > 0
                  ? selected.mappedSpus.join(', ')
                  : '未匹配'
              }}</strong>
            </div>
            <div>
              <span>有效目标 ACoS</span><strong>{{
                optionalPercent(selected.effectiveTargetAcos)
              }}</strong>
            </div>
            <div>
              <span>毛利状态</span><strong :title="selected.profitReason">{{
                  profitLabel(selected.profitStatus, selected.profitEstimated)
                }}{{
                  selected.profitMonth ? ` · ${selected.profitMonth}` : ''
                }}</strong>
            </div>
            <div>
              <span>广告前保本 ACoS</span><strong>{{ optionalPercent(selected.breakEvenAcos) }}</strong>
            </div>
            <div>
              <span>可售库存</span><strong>{{ formatNumber(selected.fbaAvailable) }}</strong>
            </div>
            <div>
              <span>确认在途</span><strong>{{ formatNumber(selected.confirmedInbound) }}</strong>
            </div>
            <div>
              <span>供货天数</span><strong
                :title="daysSupplySourceLabel(selected.daysSupplySource)"
                >{{
                  selected.daysSupply == null
                    ? '-'
                    : `${formatNumber(selected.daysSupply, 1)} 天`
                }}</strong>
            </div>
            <div>
              <span>库存状态</span><Tag :color="inventoryColor(selected.inventoryStatus)">
                {{ inventoryLabel(selected.inventoryStatus) }}
              </Tag>
            </div>
          </div>
          <Alert
            v-if="selected?.guarded"
            :message="`当前建议受到护栏限制：${selected.reason}`"
            class="detail-warning"
            show-icon
            type="info"
          />
          <Alert
            v-for="warning in analysis.warnings"
            :key="warning"
            :message="warning"
            class="detail-warning"
            show-icon
            type="warning"
          />
          <Tabs v-model:active-key="detailTab">
            <Tabs.TabPane
              key="placement"
              :tab="`广告位 (${analysis.placements.length})`"
            >
              <Table
                v-if="analysis.placements.length > 0"
                :columns="placementColumns"
                :data-source="analysis.placements"
                :pagination="false"
                :row-key="(row) => row.placement"
                :scroll="{ x: 1260 }"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template
                    v-if="
                      column.dataIndex === 'impressions' ||
                      column.dataIndex === 'clicks'
                    "
                  >
                    {{ formatNumber(record[column.dataIndex]) }}
                  </template>
                  <template v-else-if="column.dataIndex === 'cpc'">
                    {{ formatMoney(record.cpc) }}
                  </template>
                  <template
                    v-else-if="
                      column.dataIndex === 'acos' ||
                      column.dataIndex === 'cvr' ||
                      column.dataIndex === 'currentPlacementAdjustment' ||
                      column.dataIndex === 'suggestedPlacementAdjustment'
                    "
                  >
                    {{ formatPercent(record[column.dataIndex]) }}
                  </template>
                  <template v-else-if="column.dataIndex === 'action'">
                    <Tag :color="actionColor(record.action)">
                      {{ adjustmentText(record) }}
                    </Tag>
                  </template>
                </template>
              </Table>
              <Empty v-else description="当前活动无可用广告位数据" />
            </Tabs.TabPane>
            <Tabs.TabPane key="hour" tab="小时表现">
              <Table
                :columns="hourColumns"
                :data-source="analysis.hours"
                :pagination="false"
                :row-key="(row) => row.hour"
                :scroll="{ x: 1180, y: 'calc(100vh - 300px)' }"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template
                    v-if="
                      column.dataIndex === 'impressions' ||
                      column.dataIndex === 'clicks' ||
                      column.dataIndex === 'orders'
                    "
                  >
                    {{ formatNumber(record[column.dataIndex]) }}
                  </template>
                  <template
                    v-else-if="
                      column.dataIndex === 'spends' ||
                      column.dataIndex === 'cpc'
                    "
                  >
                    {{ formatMoney(record[column.dataIndex]) }}
                  </template>
                  <template
                    v-else-if="
                      column.dataIndex === 'acos' || column.dataIndex === 'cvr'
                    "
                  >
                    {{ formatPercent(record[column.dataIndex]) }}
                  </template>
                  <template v-else-if="column.dataIndex === 'action'">
                    <Tag :color="actionColor(record.action)">
                      {{ adjustmentText(record) }}
                    </Tag>
                  </template>
                </template>
              </Table>
            </Tabs.TabPane>
          </Tabs>
        </template>
      </Spin>
    </Drawer>
  </div>
</template>

<style scoped>
.automation-page {
  min-height: calc(100vh - 112px);
  padding: 18px;
  background: #eef3f8;
}

.page-header,
.section-head,
.filter-band,
.detail-meta {
  display: flex;
  gap: 12px;
  align-items: center;
}

.page-header,
.section-head {
  justify-content: space-between;
}

.page-header {
  margin-bottom: 14px;
}

.page-header h1,
.section-head h2 {
  margin: 0;
  color: #12233f;
  letter-spacing: 0;
}

.page-header h1 {
  font-size: 24px;
  line-height: 32px;
}

.section-head h2 {
  font-size: 18px;
  line-height: 26px;
}

.page-header span,
.section-head span,
.detail-meta {
  color: #64748b;
}

.filter-band,
.table-section {
  background: #fff;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.filter-band {
  display: grid;
  grid-template-columns:
    minmax(190px, 1.3fr) minmax(160px, 1fr)
    150px 130px minmax(240px, 1.2fr) auto auto;
  padding: 12px;
}

.filter-band > * {
  min-width: 0;
}

.target-input {
  display: flex;
  gap: 6px;
  align-items: center;
  white-space: nowrap;
}

.target-input :deep(.ant-input-number) {
  width: 72px;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(8, minmax(100px, 1fr));
  margin: 14px 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.summary-item {
  min-width: 0;
  padding: 12px 16px;
  border-right: 1px solid #e2e8f0;
}

.summary-item:last-child {
  border-right: 0;
}

.summary-item span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.summary-item strong {
  display: block;
  margin-top: 2px;
  font-size: 22px;
  color: #12233f;
}

.summary-item[data-tone='increase'] strong {
  color: #2563eb;
}

.summary-item[data-tone='decrease'] strong {
  color: #c2410c;
}

.summary-item[data-tone='hold'] strong {
  color: #15803d;
}

.summary-item[data-tone='observe'] strong {
  color: #64748b;
}

.summary-item[data-tone='ready'] strong {
  color: #0f766e;
}

.summary-item[data-tone='guarded'] strong {
  color: #b45309;
}

.table-section {
  padding: 14px;
}

.section-head {
  margin-bottom: 12px;
}

.section-head > div span {
  display: block;
  margin-top: 2px;
}

.campaign-cell strong,
.campaign-cell span {
  display: block;
}

.campaign-cell strong {
  overflow: hidden;
  text-overflow: ellipsis;
  color: #1e293b;
  white-space: nowrap;
}

.campaign-cell span {
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
}

.reason-text {
  color: #475569;
  white-space: normal;
}

.mapping-cell {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.mapping-cell > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 16px;
  padding: 12px;
  margin-bottom: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.context-grid div {
  min-width: 0;
}

.context-grid span {
  display: block;
  margin-bottom: 2px;
  font-size: 12px;
  color: #64748b;
}

.context-grid strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #1e293b;
  white-space: nowrap;
}

.detail-meta {
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.detail-warning {
  margin-bottom: 8px;
}

@media (max-width: 1400px) {
  .filter-band {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .automation-page {
    padding: 10px;
  }

  .filter-band,
  .summary-strip {
    grid-template-columns: 1fr;
  }

  .summary-item {
    border-right: 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .page-header,
  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .context-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
