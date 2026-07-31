<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { AdMonitorOverviewParams } from '#/api/kanban';
import type {
  AdMonitorOverview,
  AdMonitorStatus,
  AdResponsibleRow,
} from '#/api/kanban/types';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

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

import AdMetricTrendPanel from './components/AdMetricTrendPanel.vue';
import ResponsibleCampaignDrilldownModal from './components/ResponsibleCampaignDrilldownModal.vue';

type RangePreset = '7d' | '30d' | 'month' | 'range';

const loading = ref(false);
const overview = ref<AdMonitorOverview | null>(null);
const rangePreset = ref<RangePreset>('30d');
const dateRange = ref<[string, string]>([
  dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD'),
]);
let loadController: AbortController | null = null;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let activeLoadKey = '';
let activeLoadPromise: null | Promise<void> = null;
const query = reactive({
  countries: [] as string[],
  departments: [] as string[],
  shops: [] as string[],
});
const drilldownResponsible = ref('');
const drilldownOpen = computed(() => Boolean(drilldownResponsible.value));

const rangeOptions = [
  { label: '近7天', value: '7d' },
  { label: '近30天', value: '30d' },
  { label: '本月', value: 'month' },
];

const countrySiteMap: Record<string, string[]> = {
  AE: ['AE'],
  AU: ['AU'],
  BE: ['BE'],
  BR: ['BR'],
  CA: ['CA'],
  DE: ['DE'],
  ES: ['ES'],
  FR: ['FR'],
  GB: ['UK'],
  IE: ['IE'],
  IT: ['IT'],
  JP: ['JP'],
  MX: ['MX'],
  NL: ['NL'],
  PL: ['PL'],
  SE: ['SE'],
  UK: ['UK'],
  US: ['US'],
  UNITEDARABEMIRATES: ['AE'],
  UNITEDKINGDOM: ['UK'],
  UNITEDSTATES: ['US'],
  加拿大: ['CA'],
  巴西: ['BR'],
  德国: ['DE'],
  意大利: ['IT'],
  日本: ['JP'],
  比利时: ['BE'],
  法国: ['FR'],
  波兰: ['PL'],
  澳大利亚: ['AU'],
  澳洲: ['AU'],
  爱尔兰: ['IE'],
  瑞典: ['SE'],
  美国: ['US'],
  英国: ['UK'],
  荷兰: ['NL'],
  西班牙: ['ES'],
  阿联酋: ['AE'],
  墨西哥: ['MX'],
};

const shopSitePattern =
  /(?:-|_|\s)(AE|AU|BE|BR|CA|DE|ES|FR|IE|IT|JP|MX|NL|PL|SE|UK|US)$/i;

function normalizeCountry(value: string) {
  return String(value || '')
    .trim()
    .replaceAll(/[-_\s]/g, '')
    .toUpperCase();
}

function countrySites(country: string) {
  return countrySiteMap[normalizeCountry(country)] ?? [];
}

function shopSite(shop: string) {
  return (
    String(shop || '')
      .trim()
      .match(shopSitePattern)?.[1]
      ?.toUpperCase() ?? ''
  );
}

function shopSiteTone(site: string) {
  if (['CA', 'MX', 'US'].includes(site)) return 'americas';
  if (['AE', 'AU', 'BR', 'JP'].includes(site)) return 'growth';
  if (
    ['BE', 'DE', 'ES', 'FR', 'IE', 'IT', 'NL', 'PL', 'SE', 'UK'].includes(site)
  ) {
    return 'europe';
  }
  return 'neutral';
}

const columns: TableColumnsType<AdResponsibleRow> = [
  { dataIndex: 'responsible', fixed: 'left', title: '负责人', width: 110 },
  { dataIndex: 'adSpend', title: '广告花费', width: 105 },
  { dataIndex: 'adOrders', title: '广告销量', width: 90 },
  { dataIndex: 'totalSalesQty', title: '总销量', width: 88 },
  { dataIndex: 'adCvr', title: '广告CVR', width: 92 },
  { dataIndex: 'previousAdCvr', title: '上一周期CVR', width: 112 },
  { dataIndex: 'cvrChangePp', title: '转换率变化', width: 100 },
  { dataIndex: 'acoas', title: 'ACoAS', width: 92 },
  { dataIndex: 'excessContribution', title: '超标影响', width: 145 },
  {
    dataIndex: 'status',
    fixed: 'right',
    title: '转换率变化状态',
    width: 136,
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

const filters = computed(() => overview.value?.filters);
const shopOptions = computed(() => {
  const selectedSites = new Set(
    query.countries.flatMap((country) => countrySites(country)),
  );
  const restrictByCountry =
    query.countries.length > 0 && selectedSites.size > 0;

  return (filters.value?.shops ?? [])
    .map((shop) => {
      const site = shopSite(shop);
      return {
        label: shop,
        site,
        tone: shopSiteTone(site),
        value: shop,
      };
    })
    .filter((option) => !restrictByCountry || selectedSites.has(option.site));
});
const summary = computed(() => overview.value?.summary);
const periodText = computed(() => {
  const period = overview.value?.period;
  return period ? `${period.startDate} 至 ${period.endDate}` : '';
});
const drilldownParams = computed<AdMonitorOverviewParams>(() => ({
  countries: query.countries,
  departments: query.departments,
  ...requestPeriodParams(),
  shops: query.shops,
}));

function requestPeriodParams() {
  if (rangePreset.value === 'range') {
    return {
      endDate: dateRange.value[1],
      rangePreset: '30d' as const,
      startDate: dateRange.value[0],
    };
  }
  return { rangePreset: rangePreset.value };
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
    countries: query.countries.toSorted(),
    departments: query.departments.toSorted(),
    ...periodParams,
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
          countries: query.countries,
          departments: query.departments,
          ...periodParams,
          shops: query.shops,
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

function handleRangeChange() {
  scheduleLoadData();
}

function handleDateChange() {
  if (dateRange.value.length !== 2) return;
  rangePreset.value = 'range';
  scheduleLoadData();
}

function resetFilters() {
  query.countries = [];
  query.departments = [];
  query.shops = [];
  rangePreset.value = '30d';
  dateRange.value = [
    dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ];
  loadData();
}

function handleCountryChange() {
  const allowedShops = new Set(shopOptions.value.map((option) => option.value));
  query.shops = query.shops.filter((shop) => allowedShops.has(shop));
  scheduleLoadData();
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

function severityText(row: AdResponsibleRow) {
  if (!row.targetConfigured) return '未配置目标';
  if (row.excessSeverity >= 1.5) return '严重超标';
  if (row.excessSeverity >= 1.2) return '明显超标';
  return '轻度超标';
}

function openCampaignDrilldown(row: AdResponsibleRow) {
  drilldownResponsible.value = row.responsible;
}

function closeCampaignDrilldown() {
  drilldownResponsible.value = '';
}

onMounted(loadData);
onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer);
  loadController?.abort();
});
</script>

<template>
  <div class="ad-monitor-page">
    <header class="page-head">
      <div>
        <h1>广告监控</h1>
        <p>
          <span>{{ periodText }}</span>
          <span v-if="overview?.dataUpdatedAt">
            数据更新 {{ overview.dataUpdatedAt }}
          </span>
        </p>
      </div>
      <Button :loading="loading" @click="loadData">刷新</Button>
    </header>

    <section class="filter-bar" aria-label="广告监控筛选">
      <div class="filter-item range-filter">
        <label>区间</label>
        <div class="range-control">
          <Segmented
            v-model:value="rangePreset"
            :options="rangeOptions"
            @change="handleRangeChange"
          />
          <DatePicker.RangePicker
            v-model:value="dateRange"
            :allow-clear="false"
            :disabled-date="disabledFutureDate"
            class="custom-date-range"
            value-format="YYYY-MM-DD"
            @change="handleDateChange"
          />
        </div>
      </div>
      <div class="filter-item">
        <label>部门</label>
        <Select
          v-model:value="query.departments"
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="全部部门"
          :options="
            filters?.departments.map((value) => ({ label: value, value }))
          "
          @change="scheduleLoadData"
        />
      </div>
      <div class="filter-item">
        <label>国家</label>
        <Select
          v-model:value="query.countries"
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="全部国家"
          show-search
          :options="
            filters?.countries.map((value) => ({ label: value, value }))
          "
          @change="handleCountryChange"
        />
      </div>
      <div class="filter-item shop-filter">
        <label>店铺</label>
        <Select
          v-model:value="query.shops"
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="全部店铺"
          show-search
          :options="shopOptions"
          @change="scheduleLoadData"
        >
          <template #option="{ label, site, tone }">
            <div class="shop-option">
              <span class="shop-option-name">{{ label }}</span>
              <span class="shop-site-badge" :class="`is-${tone}`">
                {{ site || '其他' }}
              </span>
            </div>
          </template>
        </Select>
      </div>
      <Button class="reset-button" @click="resetFilters">重置</Button>
    </section>

    <Spin :spinning="loading">
      <section class="kpi-grid" aria-label="广告核心指标">
        <article class="kpi-card kpi-spend">
          <div class="kpi-title">
            <span>广告总花费</span>
            <small>AD SPEND</small>
          </div>
          <strong>{{ formatMoney(summary?.totalSpend) }}</strong>
          <div class="kpi-foot">
            <span>前一周期 {{ formatMoney(summary?.previousSpend) }}</span>
            <b :class="deltaClass(summary?.spendChangeRate, true)">
              环比 {{ formatSignedPercent(summary?.spendChangeRate) }}
            </b>
          </div>
        </article>

        <article class="kpi-card kpi-orders">
          <div class="kpi-title">
            <span>广告销量 / 总销量</span>
            <small>AD ORDER SHARE</small>
          </div>
          <strong>
            {{ formatInteger(summary?.adOrders) }}
            <i>/</i>
            {{ formatInteger(summary?.totalSalesQty) }}
          </strong>
          <div class="kpi-foot">
            <span>广告订单占比</span>
            <b>{{ formatPercent(summary?.adOrderShare) }}</b>
          </div>
        </article>

        <article class="kpi-card kpi-cvr">
          <div class="kpi-title">
            <span>广告 CVR</span>
            <small>AD CONVERSION</small>
          </div>
          <strong>{{ formatPercent(summary?.adCvr) }}</strong>
          <div class="kpi-foot multi-metric">
            <span>
              上一周期 {{ formatPercent(summary?.previousAdCvr) }}
              <b :class="deltaClass(summary?.cvrChangePp)">
                {{ formatSignedPp(summary?.cvrChangePp) }}
              </b>
            </span>
            <span>
              同比 {{ formatPercent(summary?.yoyAdCvr) }}
              <b :class="deltaClass(summary?.yoyChangePp)">
                {{ formatSignedPp(summary?.yoyChangePp) }}
              </b>
            </span>
          </div>
        </article>

        <article class="kpi-card kpi-acoas">
          <div class="kpi-title">
            <span>广告占比 ACoAS</span>
            <small>AD SPEND / SALES</small>
          </div>
          <strong>{{ formatPercent(summary?.acoas) }}</strong>
          <div class="kpi-foot multi-metric">
            <span>目标 {{ formatPercent(summary?.targetAcoas) }}</span>
            <span>
              超标
              <b :class="deltaClass(summary?.overTargetPp, true)">
                {{ formatSignedPp(summary?.overTargetPp) }}
              </b>
            </span>
          </div>
        </article>
      </section>

      <div class="analysis-grid">
        <section class="data-panel responsible-panel">
          <div class="panel-head">
            <div>
              <h2>负责人广告表现及超标归因</h2>
              <p>CVR 变化对比当前筛选周期与紧邻的上一等长周期</p>
            </div>
            <div class="panel-meta">
              <span>目标覆盖 {{ formatPercent(summary?.targetCoverage) }}</span>
              <b>有效超标 {{ formatMoney(summary?.totalExcessSpend) }}</b>
            </div>
          </div>

          <Table
            bordered
            :columns="columns"
            :data-source="overview?.responsibleRows ?? []"
            :pagination="false"
            row-key="responsible"
            :scroll="{ x: 1030, y: 470 }"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'responsible'">
                <div class="responsible-cell">
                  <b>{{ record.responsible }}</b>
                  <span>{{ record.department }}</span>
                </div>
              </template>
              <template v-else-if="column.dataIndex === 'adSpend'">
                <b class="money-value">{{ formatMoney(record.adSpend) }}</b>
              </template>
              <template v-else-if="column.dataIndex === 'adOrders'">
                <b>{{ formatInteger(record.adOrders) }}</b>
                <small class="cell-note">
                  占比 {{ formatPercent(record.adOrderShare) }}
                </small>
              </template>
              <template v-else-if="column.dataIndex === 'totalSalesQty'">
                <b>{{ formatInteger(record.totalSalesQty) }}</b>
              </template>
              <template v-else-if="column.dataIndex === 'adCvr'">
                <b>{{ formatPercent(record.adCvr) }}</b>
              </template>
              <template v-else-if="column.dataIndex === 'previousAdCvr'">
                <span>{{ formatPercent(record.previousAdCvr) }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'cvrChangePp'">
                <b :class="deltaClass(record.cvrChangePp)">
                  {{ formatSignedPp(record.cvrChangePp) }}
                </b>
              </template>
              <template v-else-if="column.dataIndex === 'acoas'">
                <b>{{ formatPercent(record.acoas) }}</b>
                <small v-if="record.targetConfigured" class="cell-note">
                  目标 {{ formatPercent(record.targetAcoas) }}
                </small>
                <small v-else class="cell-note is-warning">未配置目标</small>
              </template>
              <template v-else-if="column.dataIndex === 'excessContribution'">
                <Tooltip
                  :title="`有效超标 ${formatMoney(record.effectiveExcessSpend)}；允许花费 ${formatMoney(record.allowedAdSpend)}`"
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
                  {{ statusFor(record).symbol }}
                  {{ statusFor(record).label }}
                </Tag>
              </template>
            </template>
            <template #emptyText>
              <Empty description="当前筛选范围暂无广告数据" />
            </template>
          </Table>
        </section>

        <section class="data-panel impact-panel">
          <div class="panel-head">
            <div>
              <h2>广告占比超标影响</h2>
              <p>按有效超标金额排序，仅统计已配置目标的负责人</p>
            </div>
          </div>

          <div v-if="overview?.impactRows.length" class="impact-ranking">
            <div
              v-for="(row, index) in overview.impactRows"
              :key="row.responsible"
              class="impact-row"
            >
              <span class="rank" :class="{ 'rank-top': index < 3 }">
                {{ index + 1 }}
              </span>
              <div class="impact-owner">
                <button
                  class="impact-owner-button"
                  type="button"
                  @click="openCampaignDrilldown(row)"
                >
                  {{ row.responsible }}
                </button>
                <span>
                  {{ severityText(row) }} · ACoAS
                  {{ formatPercent(row.acoas) }}
                </span>
              </div>
              <div class="impact-value">
                <b>{{ formatMoney(row.effectiveExcessSpend) }}</b>
                <span>
                  影响比例 {{ formatPercent(row.excessContribution) }}
                </span>
              </div>
              <div class="impact-bar">
                <Progress
                  :percent="row.excessContribution * 100"
                  :show-info="false"
                  :stroke-color="contributionStroke(row)"
                />
              </div>
            </div>
          </div>
          <Empty v-else description="当前筛选范围没有广告占比超标" />
        </section>
      </div>
    </Spin>

    <AdMetricTrendPanel class="trend-section" :params="drilldownParams" />

    <ResponsibleCampaignDrilldownModal
      :open="drilldownOpen"
      :params="drilldownParams"
      :responsible="drilldownResponsible"
      @close="closeCampaignDrilldown"
    />
  </div>
</template>

<style scoped>
.ad-monitor-page {
  min-height: 100%;
  padding: 16px;
  color: #172033;
  background:
    linear-gradient(#dce8f7 1px, transparent 1px),
    linear-gradient(90deg, #dce8f7 1px, transparent 1px), #edf4fb;
  background-size: 28px 28px;
}

.trend-section {
  margin-top: 12px;
}

.page-head,
.filter-bar,
.panel-head,
.kpi-title,
.kpi-foot,
.impact-row,
.contribution-cell {
  display: flex;
  align-items: center;
}

.page-head {
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-head h1,
.panel-head h2 {
  margin: 0;
  font-weight: 800;
  color: #101828;
  letter-spacing: 0;
}

.page-head h1 {
  font-size: 24px;
}

.page-head p,
.panel-head p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #667085;
}

.page-head p {
  display: flex;
  gap: 14px;
}

.filter-bar {
  display: grid;
  grid-template-columns:
    minmax(330px, auto) minmax(180px, 0.8fr) minmax(180px, 0.8fr)
    minmax(240px, 1.2fr) auto;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 12px;
  background: rgb(255 255 255 / 96%);
  border: 1px solid #cbd9ea;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgb(31 65 114 / 6%);
}

.filter-item {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.filter-item label {
  font-size: 12px;
  font-weight: 700;
  color: #475467;
}

.range-filter {
  min-width: 330px;
}

.range-control {
  display: flex;
  gap: 8px;
  align-items: center;
}

.custom-date-range {
  width: 240px;
}

.shop-filter :deep(.ant-select-selector) {
  background: #f0fdfa !important;
  border-color: #5cc8bc !important;
  box-shadow: inset 3px 0 0 #0f9f8f;
}

.shop-filter :deep(.ant-select-selection-placeholder) {
  color: #38756e;
}

.shop-filter :deep(.ant-select-selection-item) {
  font-weight: 700;
  color: #155e56;
  background: #ccfbf1;
  border-color: #5eead4;
}

.shop-option {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  padding: 5px 8px;
  background: #f8fafc;
  border: 1px solid #dbe4ef;
  border-radius: 4px;
}

.shop-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
  color: #253247;
  white-space: nowrap;
}

.shop-site-badge {
  flex: 0 0 auto;
  min-width: 34px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 800;
  line-height: 20px;
  text-align: center;
  border: 1px solid;
  border-radius: 4px;
}

.shop-site-badge.is-americas {
  color: #175cd3;
  background: #eff8ff;
  border-color: #84caff;
}

.shop-site-badge.is-europe {
  color: #067647;
  background: #ecfdf3;
  border-color: #75e0a7;
}

.shop-site-badge.is-growth {
  color: #b54708;
  background: #fffaeb;
  border-color: #fec84b;
}

.shop-site-badge.is-neutral {
  color: #475467;
  background: #f2f4f7;
  border-color: #d0d5dd;
}

.reset-button {
  align-self: end;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.kpi-card {
  min-height: 154px;
  padding: 17px 18px 15px;
  overflow: hidden;
  border: 1px solid;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgb(31 65 114 / 8%);
}

.kpi-spend {
  background: #fff7ed;
  border-color: #fdba74;
}

.kpi-orders {
  background: #f0fdfa;
  border-color: #5eead4;
}

.kpi-cvr {
  background: #eff6ff;
  border-color: #93c5fd;
}

.kpi-acoas {
  color: #fff;
  background: #263fcc;
  border-color: #1d4ed8;
}

.kpi-title {
  gap: 8px;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 800;
}

.kpi-title small {
  font-size: 10px;
  font-weight: 700;
  color: #667085;
}

.kpi-card > strong {
  display: block;
  margin: 19px 0 16px;
  font-size: 34px;
  line-height: 1;
  color: #101828;
  letter-spacing: 0;
}

.kpi-card > strong i {
  margin: 0 5px;
  font-size: 20px;
  font-style: normal;
  color: #98a2b3;
}

.kpi-foot {
  gap: 10px;
  justify-content: space-between;
  padding-top: 12px;
  font-size: 12px;
  color: #475467;
  border-top: 1px solid rgb(102 112 133 / 18%);
}

.multi-metric > span {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 5px;
}

.kpi-acoas .kpi-title small,
.kpi-acoas .kpi-foot {
  color: #dbeafe;
}

.kpi-acoas > strong {
  color: #fde047;
}

.kpi-acoas .kpi-foot {
  border-color: rgb(255 255 255 / 22%);
}

.is-positive {
  color: #039855;
}

.is-negative {
  color: #d92d20;
}

.is-neutral {
  color: #667085;
}

.is-warning {
  color: #b54708;
}

.data-panel {
  margin-bottom: 12px;
  overflow: hidden;
  background: rgb(255 255 255 / 97%);
  border: 1px solid #cbd9ea;
  border-radius: 6px;
  box-shadow: 0 5px 18px rgb(31 65 114 / 7%);
}

.analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 12px;
  align-items: stretch;
}

.analysis-grid > .data-panel {
  min-width: 0;
}

.panel-head {
  gap: 16px;
  justify-content: space-between;
  min-height: 62px;
  padding: 12px 16px;
  border-bottom: 1px solid #d8e2ef;
}

.panel-head h2 {
  font-size: 17px;
}

.panel-meta {
  display: flex;
  gap: 18px;
  font-size: 12px;
  color: #475467;
}

.panel-meta b {
  color: #d92d20;
}

.responsible-cell,
.impact-owner,
.impact-value {
  display: grid;
  gap: 2px;
}

.responsible-cell b,
.money-value {
  color: #175cd3;
}

.responsible-cell span,
.cell-note,
.impact-owner span,
.impact-value span {
  font-size: 12px;
  color: #667085;
}

.cell-note {
  display: block;
  margin-top: 2px;
}

.contribution-cell {
  gap: 8px;
}

.contribution-cell :deep(.ant-progress) {
  flex: 1;
  min-width: 54px;
}

.contribution-cell b {
  width: 44px;
  text-align: right;
}

.responsible-panel :deep(.ant-table-cell) {
  padding: 11px 8px !important;
  font-size: 14px;
  text-align: center;
}

.responsible-panel :deep(.ant-table-tbody > tr > td b),
.responsible-cell b {
  font-size: 15px;
  font-weight: 800;
}

.responsible-panel :deep(.ant-table-thead > tr > th) {
  padding: 11px 8px !important;
  font-size: 14px;
  font-weight: 800;
  color: #344054;
  text-align: center;
  background: #f4f7fb;
}

.responsible-panel :deep(.ant-tag) {
  margin-inline-end: 0;
  font-size: 13px;
}

.responsible-panel :deep(.ant-table-tbody > tr:nth-child(even) > td) {
  background: #f8fafc;
}

.impact-ranking {
  max-height: 536px;
  padding: 4px 14px 14px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.impact-ranking::-webkit-scrollbar {
  width: 8px;
}

.impact-ranking::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.impact-ranking::-webkit-scrollbar-track {
  background: #f8fafc;
}

.impact-row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 4px 8px;
  min-height: 64px;
  padding: 8px 0;
  border-bottom: 1px solid #eaecf0;
}

.rank {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  font-weight: 800;
  color: #475467;
  background: #f2f4f7;
  border-radius: 50%;
}

.rank-top {
  color: #fff;
  background: #f97316;
}

.impact-bar :deep(.ant-progress-bg) {
  height: 7px !important;
}

.impact-bar {
  grid-column: 2 / 4;
  line-height: 1;
}

.impact-value {
  justify-items: end;
}

.impact-value b {
  color: #b42318;
}

.impact-owner-button {
  width: fit-content;
  padding: 0;
  font: inherit;
  font-weight: 800;
  color: #175cd3;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.impact-owner-button:hover {
  color: #004eeb;
  text-decoration: underline;
}

.impact-owner-button:focus-visible {
  outline: 2px solid #84adff;
  outline-offset: 2px;
}

.impact-panel > :deep(.ant-empty) {
  padding: 54px 0;
}

@media (max-width: 1180px) {
  .filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .range-filter,
  .shop-filter {
    min-width: 0;
  }

  .range-filter {
    grid-column: 1 / -1;
  }

  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .analysis-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .ad-monitor-page {
    padding: 10px;
  }

  .page-head p,
  .panel-meta {
    display: grid;
    gap: 2px;
  }

  .filter-bar,
  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .range-control {
    flex-direction: column;
    align-items: stretch;
  }

  .custom-date-range {
    width: 100%;
  }

  .kpi-card {
    min-height: 140px;
  }

  .impact-row {
    grid-template-columns: 30px minmax(0, 1fr) auto;
  }
}
</style>
