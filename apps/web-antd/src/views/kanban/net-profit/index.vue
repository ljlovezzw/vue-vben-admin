<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  NetProfitDetails,
  NetProfitGroupRow,
  NetProfitOverview,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';

import { Button, Drawer, Empty, Select, Spin, Table } from 'ant-design-vue';

import { fetchNetProfitBreakEven, fetchNetProfitDetails, fetchNetProfitOverview, fetchNetProfitPivot } from '#/api/kanban';

interface ProfitQuery {
  brands: string[];
  category1: string[];
  category2: string[];
  category3: string[];
  countries: string[];
  departments: string[];
  developers: string[];
  dimension: string;
  operators: string[];
  periodFrom: string;
  periodTo: string;
  pivotColumn: string;
  pivotRow: string;
  productTypes: string[];
  suppliers: string[];
}

interface ProfitTab {
  key: string;
  label: string;
  overview: NetProfitOverview | null;
  query: ProfitQuery;
}

function createQuery(): ProfitQuery {
  return {
    brands: [],
    category1: [],
    category2: [],
    category3: [],
    countries: [],
    departments: [],
    developers: [],
    dimension: 'department',
    operators: [],
    periodFrom: '',
    periodTo: '',
    pivotColumn: 'category2',
    pivotRow: 'country',
    productTypes: [],
    suppliers: [],
  };
}

function cloneQuery(source: ProfitQuery): ProfitQuery {
  return {
    ...source,
    brands: [...source.brands],
    category1: [...source.category1],
    category2: [...source.category2],
    category3: [...source.category3],
    countries: [...source.countries],
    departments: [...source.departments],
    developers: [...source.developers],
    operators: [...source.operators],
    productTypes: [...source.productTypes],
    suppliers: [...source.suppliers],
  };
}

const loading = ref(false);
const breakEvenLoading = ref(false);
const overview = ref<NetProfitOverview | null>(null);
const detailLoading = ref(false);
const detailOpen = ref(false);
const detailResult = ref<NetProfitDetails | null>(null);
const pivot = ref<NetProfitOverview['pivot']>({ columnDimension: 'category2', columnLabel: '', columns: [], rowDimension: 'country', rowLabel: '', rows: [] });
const breakEven = ref<NetProfitOverview['breakEven']>({ avgDaysToBreakEven: 0, pendingCount: 0, rows: [], total: 0 });
const activeTabKey = ref('profit-1');
const panel = ref<'breakEven' | 'pivot' | 'ranking'>('ranking');
const tabs = ref<ProfitTab[]>([
  { key: 'profit-1', label: '利润总览 1', overview: null, query: createQuery() },
]);
const query = reactive<ProfitQuery>(createQuery());

const fallbackDimensions = [
  { key: 'department', label: '部门' },
  { key: 'operator', label: '运营' },
  { key: 'country', label: '国家' },
  { key: 'brand', label: '品牌' },
  { key: 'category1', label: '一级分类' },
  { key: 'category2', label: '二级分类' },
  { key: 'category3', label: '三级分类' },
  { key: 'account', label: '账号' },
  { key: 'parentAsin', label: '父ASIN' },
];

const groupColumns: TableColumnsType<NetProfitGroupRow> = [
  { title: '排名', key: 'rank', width: 64, align: 'center' },
  { title: '维度', dataIndex: 'name', key: 'name', width: 220 },
  { title: '纯利', dataIndex: 'netProfit', key: 'netProfit', align: 'right', width: 170 },
  { title: '投入', dataIndex: 'investment', key: 'investment', align: 'right', width: 170 },
  { title: 'ROI', dataIndex: 'roi', key: 'roi', align: 'right', width: 110 },
  { title: '贡献度', key: 'contribution', align: 'right', width: 120 },
  { title: '规模', key: 'scale', width: 180 },
];

const breakEvenColumns: TableColumnsType<any> = [
  { title: 'SPU', dataIndex: 'spu', key: 'spu', width: 120 },
  { title: '店铺', dataIndex: 'shop', key: 'shop', width: 130 },
  { title: '父ASIN', dataIndex: 'parentAsin', key: 'parentAsin', width: 130 },
  { title: '开发日期', dataIndex: 'developmentDate', key: 'developmentDate', width: 120 },
  { title: '转正日期', dataIndex: 'breakEvenDate', key: 'breakEvenDate', width: 120 },
  { title: '转正天数', dataIndex: 'daysToBreakEven', key: 'daysToBreakEven', width: 110 },
  { title: '全周期纯利', dataIndex: 'lifetimeNetProfit', key: 'lifetimeNetProfit', align: 'right', width: 140 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
];

const activeTab = computed(() => tabs.value.find((item) => item.key === activeTabKey.value));
const filters = computed(() => overview.value?.filters ?? {
  brands: [], category1: [], category2: [], category3: [], countries: [],
  departments: [], developers: [], operators: [], productTypes: [], suppliers: [],
});
const dimensions = computed(() => overview.value?.dimensions?.length ? overview.value.dimensions : fallbackDimensions);
const periodOptions = computed(() => overview.value?.periods ?? []);
const summary = computed(() => overview.value?.summary);

const detailColumns = computed<TableColumnsType<any>>(() =>
  (detailResult.value?.columns ?? []).map((column) => ({
    dataIndex: column.key,
    key: column.key,
    title: column.label,
    width: 130,
  })),
);

function optionList(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

function formatInteger(value: null | number | undefined) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function formatMoney(value: null | number | undefined) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function formatMoneyWan(value: null | number | undefined) {
  return `¥${(Number(value || 0) / 10_000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`;
}

function formatPercent(value: null | number | undefined) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatRoi(value: null | number | undefined) {
  return `${Number(value || 0).toFixed(2)}x`;
}

function moneyClass(value: number) {
  return { positive: value > 0, negative: value < 0 };
}

function saveActiveTab() {
  const current = activeTab.value;
  if (current) current.query = cloneQuery(query);
}

function applyTab(tab: ProfitTab) {
  Object.assign(query, cloneQuery(tab.query));
  overview.value = tab.overview;
}

function switchTab(key: string) {
  saveActiveTab();
  const target = tabs.value.find((item) => item.key === key);
  if (!target) return;
  activeTabKey.value = key;
  applyTab(target);
  if (!target.overview) void loadOverview();
}

function addTab() {
  saveActiveTab();
  const key = `profit-${Date.now()}`;
  const tab = { key, label: `利润总览 ${tabs.value.length + 1}`, overview: null, query: cloneQuery(query) };
  tabs.value.push(tab);
  activeTabKey.value = key;
  applyTab(tab);
  void loadOverview();
}

function closeTab(key: string) {
  if (tabs.value.length === 1) return;
  const index = tabs.value.findIndex((item) => item.key === key);
  tabs.value = tabs.value.filter((item) => item.key !== key);
  if (activeTabKey.value === key) {
    const next = tabs.value[Math.max(0, index - 1)];
    if (next) switchTab(next.key);
  }
}

function overviewParams() {
  return {
    ...query,
    limit: 100,
    periodFrom: query.periodFrom || undefined,
    periodTo: query.periodTo || undefined,
  };
}

async function loadOverview() {
  loading.value = true;
  try {
    const data = await fetchNetProfitOverview(overviewParams());
    overview.value = data;
    if (!query.periodFrom && data.period) query.periodFrom = data.period;
    if (!query.periodTo && data.period) query.periodTo = data.period;
    const current = activeTab.value;
    if (current) {
      current.query = cloneQuery(query);
      current.overview = data;
    }
  } finally {
    loading.value = false;
  }
}

async function loadBreakEven() {
  breakEvenLoading.value = true;
  try {
    breakEven.value = await fetchNetProfitBreakEven(overviewParams());
  } finally {
    breakEvenLoading.value = false;
  }
}

async function loadPivot() {
  loading.value = true;
  try {
    pivot.value = await fetchNetProfitPivot(overviewParams());
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(query, createQuery());
  void loadOverview();
}

function selectPanel(value: 'breakEven' | 'pivot' | 'ranking') {
  panel.value = value;
  if (value === 'pivot') void loadPivot();
  if (value === 'breakEven' && breakEven.value.rows.length === 0) void loadBreakEven();
}

function groupContribution(value: number) {
  const total = summary.value?.selectedNetProfit ?? 0;
  return total ? value / total : 0;
}

async function openGroupDetails(record: NetProfitGroupRow | Record<string, any>) {
  const group = record as NetProfitGroupRow;
  detailOpen.value = true;
  detailLoading.value = true;
  detailResult.value = null;
  try {
    detailResult.value = await fetchNetProfitDetails({
      ...overviewParams(),
      dimension: group.dimension,
      page: 1,
      pageSize: 200,
      value: group.name,
    });
  } finally {
    detailLoading.value = false;
  }
}

function breakEvenRows() {
  return (breakEven.value?.rows ?? []).map((row) => ({
    ...row,
    daysToBreakEven: row.daysToBreakEven ?? '-',
    lifetimeNetProfit: formatMoney(row.lifetimeNetProfit),
  }));
}

onMounted(loadOverview);
</script>

<template>
  <div class="net-profit-page">
    <div class="page-head">
      <div>
        <h1>纯利计算</h1>
        <p>按时间跨度和业务属性对比利润贡献、投入与全周期盈亏平衡。</p>
      </div>
      <Button type="primary" :loading="loading" @click="loadOverview">刷新</Button>
    </div>

    <div class="view-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="view-tab"
        :class="{ active: tab.key === activeTabKey }"
        type="button"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
        <span v-if="tabs.length > 1" class="tab-close" @click.stop="closeTab(tab.key)">×</span>
      </button>
      <button class="add-tab" type="button" title="新增对比视图" @click="addTab">＋</button>
    </div>

    <div class="filter-bar">
      <Select v-model:value="query.periodFrom" class="filter-control" placeholder="开始月份" :options="periodOptions" />
      <span class="range-separator">至</span>
      <Select v-model:value="query.periodTo" class="filter-control" placeholder="结束月份" :options="periodOptions" />
      <Select v-model:value="query.dimension" class="filter-control" :options="dimensions.map((item) => ({ label: item.label, value: item.key }))" />
      <Select v-model:value="query.countries" class="filter-control wide" mode="multiple" placeholder="国家" :max-tag-count="1" :options="optionList(filters.countries)" />
      <Select v-model:value="query.brands" class="filter-control wide" mode="multiple" placeholder="品牌" :max-tag-count="1" :options="optionList(filters.brands)" />
      <Select v-model:value="query.departments" class="filter-control wide" mode="multiple" placeholder="部门" :max-tag-count="1" :options="optionList(filters.departments)" />
      <Select v-model:value="query.operators" class="filter-control wide" mode="multiple" placeholder="运营" :max-tag-count="1" :options="optionList(filters.operators)" />
      <Select v-model:value="query.suppliers" class="filter-control wide" mode="multiple" placeholder="供应商" :max-tag-count="1" :options="optionList(filters.suppliers)" />
      <Select v-model:value="query.developers" class="filter-control wide" mode="multiple" placeholder="开发负责人" :max-tag-count="1" :options="optionList(filters.developers)" />
      <Select v-model:value="query.category1" class="filter-control wide" mode="multiple" placeholder="一级分类" :max-tag-count="1" :options="optionList(filters.category1)" />
      <Select v-model:value="query.category2" class="filter-control wide" mode="multiple" placeholder="二级分类" :max-tag-count="1" :options="optionList(filters.category2)" />
      <Select v-model:value="query.category3" class="filter-control wide" mode="multiple" placeholder="三级分类" :max-tag-count="1" :options="optionList(filters.category3)" />
      <Select v-model:value="query.productTypes" class="filter-control" mode="multiple" placeholder="新老品" :max-tag-count="1" :options="optionList(filters.productTypes)" />
      <Button type="primary" :loading="loading" @click="loadOverview">查询</Button>
      <Button @click="resetFilters">重置</Button>
    </div>

    <Spin :spinning="loading">
      <template v-if="overview">
        <div class="kpi-grid">
          <div class="kpi-card tone-profit">
            <span>区间纯利</span><strong>{{ formatMoneyWan(summary?.selectedNetProfit) }}</strong>
            <em>{{ overview.periodLabel }}</em>
          </div>
          <div class="kpi-card tone-investment">
            <span>投入</span><strong>{{ formatMoneyWan(summary?.investment) }}</strong>
            <em>回款收入 - 纯利</em>
          </div>
          <div class="kpi-card tone-roi">
            <span>ROI</span><strong>{{ formatRoi(summary?.roi) }}</strong>
            <em>纯利 ÷ 投入</em>
          </div>
          <div class="kpi-card tone-scope">
            <span>覆盖范围</span><strong>{{ formatInteger(summary?.parentAsinCount) }}</strong>
            <em>{{ formatInteger(summary?.rowCount) }} 条利润明细 · {{ formatInteger(summary?.accountCount) }} 个账号</em>
          </div>
        </div>

        <div class="sub-tabs">
          <button :class="{ active: panel === 'ranking' }" type="button" @click="selectPanel('ranking')">利润贡献排行</button>
          <button :class="{ active: panel === 'pivot' }" type="button" @click="selectPanel('pivot')">国家 × 品类透视</button>
          <button :class="{ active: panel === 'breakEven' }" type="button" @click="selectPanel('breakEven')">全周期盈亏平衡</button>
        </div>

        <section v-if="panel === 'ranking'" class="panel">
          <div class="panel-title">
            <div><h2>利润贡献排行</h2><p>当前按 {{ dimensions.find((item) => item.key === query.dimension)?.label || '维度' }} 聚合，点击名称可继续使用现有明细下钻。</p></div>
            <span>{{ overview.periodLabel }}</span>
          </div>
          <Table :columns="groupColumns" :data-source="overview.groups" :pagination="false" row-key="name" size="middle">
            <template #bodyCell="{ column, record, text, index }">
              <span v-if="column.key === 'rank'" class="rank-badge">{{ index + 1 }}</span>
              <button v-else-if="column.key === 'name'" class="group-name" type="button" @click="openGroupDetails(record)">{{ text }}</button>
              <span v-else-if="column.key === 'netProfit'" :class="moneyClass(record.netProfit)">{{ formatMoney(record.netProfit) }}</span>
              <span v-else-if="column.key === 'investment'">{{ formatMoney(record.investment) }}</span>
              <span v-else-if="column.key === 'roi'" :class="moneyClass(record.roi)">{{ formatRoi(record.roi) }}</span>
              <span v-else-if="column.key === 'contribution'">{{ formatPercent(groupContribution(record.netProfit)) }}</span>
              <span v-else-if="column.key === 'scale'">{{ formatInteger(record.parentAsinCount) }} 父ASIN · {{ formatInteger(record.accountCount) }} 账号</span>
              <span v-else>{{ text || '-' }}</span>
            </template>
          </Table>
        </section>

        <section v-else-if="panel === 'pivot'" class="panel">
          <div class="panel-title">
            <div><h2>两重筛选数据透视</h2><p>行维度和列维度同时展开，单元格同时显示纯利、投入和 ROI。</p></div>
            <div class="pivot-selects">
              <Select v-model:value="query.pivotRow" :options="dimensions.map((item) => ({ label: item.label, value: item.key }))" @change="loadOverview" />
              <span>×</span>
              <Select v-model:value="query.pivotColumn" :options="dimensions.map((item) => ({ label: item.label, value: item.key }))" @change="loadOverview" />
            </div>
          </div>
          <div v-if="pivot?.rows.length" class="pivot-table-wrap">
            <table class="pivot-table"><thead><tr><th>{{ pivot.rowLabel }}</th><th v-for="column in pivot.columns" :key="column">{{ column }}</th></tr></thead><tbody><tr v-for="row in pivot.rows" :key="row.name"><th>{{ row.name }}</th><td v-for="(cell, index) in row.cells" :key="`${row.name}-${index}`"><strong>{{ formatMoney(cell.netProfit) }}</strong><small>投入 {{ formatMoney(cell.investment) }} · ROI {{ formatRoi(cell.roi) }}</small></td></tr></tbody></table>
          </div>
          <Empty v-else description="当前筛选没有可透视的数据" />
        </section>

        <section v-else class="panel">
          <div class="panel-title"><div><h2>全周期盈亏平衡</h2><p>从 product_life 最早创建时间开始，追踪到利润月份首次转正。</p></div><span>共 {{ formatInteger(breakEven?.total) }} 个父ASIN</span></div>
          <div class="break-even-summary"><span>平均转正周期 <strong>{{ Number(breakEven?.avgDaysToBreakEven || 0).toFixed(0) }} 天</strong></span><span>尚未转正 <strong>{{ formatInteger(breakEven?.pendingCount) }}</strong></span></div>
          <Spin :spinning="breakEvenLoading"><Table :columns="breakEvenColumns" :data-source="breakEvenRows()" :pagination="{ pageSize: 50, showSizeChanger: true }" row-key="parentAsin" size="middle" /></Spin>
        </section>
      </template>
      <Empty v-else description="暂无纯利数据" />
    </Spin>

    <Drawer v-model:open="detailOpen" width="88vw" :title="`纯利明细：${detailResult?.focus?.value || '当前排行'}`" destroy-on-close>
      <Table
        :columns="detailColumns"
        :data-source="detailResult?.rows ?? []"
        :loading="detailLoading"
        :pagination="{ pageSize: 50, showSizeChanger: true }"
        row-key="key"
        size="small"
        :scroll="{ x: 1600 }"
      />
    </Drawer>
  </div>
</template>

<style scoped>
.net-profit-page { min-height: 100%; padding: 18px; color: #172033; background: #eef3f8; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.page-head h1 { margin: 0; font-size: 24px; font-weight: 750; }
.page-head p { margin: 6px 0 0; color: #607089; }
.view-tabs, .sub-tabs { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.view-tab, .add-tab, .sub-tabs button { border: 1px solid #cfdae7; background: #fff; color: #50627b; cursor: pointer; }
.view-tab { padding: 8px 12px; border-radius: 7px 7px 0 0; }
.view-tab.active, .sub-tabs button.active { color: #1558c0; border-color: #8bb7ee; background: #eaf3ff; }
.tab-close { margin-left: 8px; color: #8a98aa; }
.add-tab { width: 32px; height: 32px; border-radius: 6px; font-size: 18px; }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px; margin-bottom: 14px; background: #fff; border: 1px solid #d9e2ec; border-radius: 8px; }
.filter-control { width: 142px; }
.filter-control.wide { width: 170px; }
.range-separator { color: #7c8ca2; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.kpi-card { min-height: 130px; padding: 18px; border: 1px solid #dbe4ef; border-radius: 8px; box-shadow: 0 8px 22px rgb(31 55 88 / 7%); }
.kpi-card span, .kpi-card em { display: block; color: #63738a; font-size: 13px; font-style: normal; }
.kpi-card strong { display: block; margin: 14px 0 8px; color: #172033; font-size: 28px; }
.tone-profit { background: #effcf7; border-top: 4px solid #0f9f83; }
.tone-investment { background: #fff8ed; border-top: 4px solid #f59e0b; }
.tone-roi { background: #eff5ff; border-top: 4px solid #2563eb; }
.tone-scope { background: #f6f2ff; border-top: 4px solid #7c3aed; }
.sub-tabs { padding: 4px; background: #e5ecf4; border-radius: 7px; }
.sub-tabs button { padding: 9px 14px; border-radius: 5px; }
.panel { padding: 16px; margin-bottom: 14px; background: #fff; border: 1px solid #d9e2ec; border-radius: 8px; }
.panel-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.panel-title h2 { margin: 0; font-size: 18px; }
.panel-title p { margin: 4px 0 0; color: #708099; font-size: 13px; }
.panel-title > span { color: #708099; white-space: nowrap; }
.rank-badge { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; color: #fff; background: #2869d7; border-radius: 50%; }
.group-name { padding: 0; color: #1558c0; font-weight: 650; background: transparent; border: 0; cursor: pointer; }
.positive { color: #00875a; }
.negative { color: #d4380d; }
.pivot-selects { display: flex; align-items: center; gap: 6px; }
.pivot-selects .ant-select { width: 130px; }
.pivot-table-wrap { overflow: auto; }
.pivot-table { width: 100%; min-width: 760px; border-collapse: collapse; }
.pivot-table th, .pivot-table td { padding: 10px 12px; text-align: right; border: 1px solid #e1e7ef; }
.pivot-table th:first-child, .pivot-table td:first-child { text-align: left; }
.pivot-table thead th { color: #49617f; background: #f5f8fb; }
.pivot-table td strong, .pivot-table td small { display: block; }
.pivot-table td small { margin-top: 5px; color: #7b8ba0; font-size: 11px; }
.break-even-summary { display: flex; gap: 26px; padding: 12px 14px; margin-bottom: 12px; color: #65758a; background: #f5f8fb; border-radius: 6px; }
.break-even-summary strong { margin-left: 6px; color: #172033; font-size: 18px; }
@media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .filter-control.wide { width: 150px; } }
@media (max-width: 640px) { .net-profit-page { padding: 10px; } .page-head { flex-direction: column; } .kpi-grid { grid-template-columns: 1fr; } .filter-control, .filter-control.wide { width: 100%; } .filter-bar { align-items: stretch; } .range-separator { display: none; } }
</style>
