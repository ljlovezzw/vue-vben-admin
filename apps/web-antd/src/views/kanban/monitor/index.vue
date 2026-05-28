<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  AlertLevel,
  KanbanDailyMetric,
  KanbanOverview,
  KanbanSpuRow,
} from '#/api/kanban';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { fetchKanbanOverview, fetchSpuDailyMetrics } from '#/api/kanban';

type Tone = 'amber' | 'blue' | 'cyan' | 'green' | 'purple' | 'red' | 'slate';

interface CategoryBar {
  category: string;
  fail: number;
  failRate: number;
  pending: number;
  rate: number;
  success: number;
  total: number;
}

interface InsightItem {
  detail: string;
  title: string;
}

const loading = ref(false);
const overview = ref<KanbanOverview | null>(null);
const selectedRow = ref<KanbanSpuRow | null>(null);
const drawerOpen = ref(false);
const detailLoading = ref(false);
const activeTab = ref('overview');
const spuSearch = ref('');
const quickStatus = ref<'all' | 'fail' | 'success'>('all');
const dailyMetrics = ref<KanbanDailyMetric[]>([]);

const dailyPagination = reactive<TablePaginationConfig>({
  current: 1,
  pageSize: 20,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
  onChange: (page, pageSize) => {
    dailyPagination.current = page;
    dailyPagination.pageSize = pageSize;
  },
  onShowSizeChange: (_current, size) => {
    dailyPagination.current = 1;
    dailyPagination.pageSize = size;
  },
});

const query = reactive({
  alertLevels: [] as AlertLevel[],
  categories: [] as string[],
  responsibles: [] as string[],
  sites: [] as string[],
  statuses: [] as string[],
});

const alertOptions = [
  { label: '红色', value: 'red' },
  { label: '橙色', value: 'orange' },
  { label: '正常', value: 'green' },
  { label: '待观察', value: 'gray' },
];

const stageTagColor: Record<string, string> = {
  冷启动期: 'blue',
  判定期: 'red',
  未到货: 'default',
  稳定期: 'green',
  起量期: 'orange',
};

const dailyColumns: TableColumnsType<KanbanDailyMetric> = [
  {
    dataIndex: 'metricDate',
    defaultSortOrder: 'descend',
    fixed: 'left',
    sorter: (a, b) => a.metricDate.localeCompare(b.metricDate),
    title: '日期',
    width: 112,
  },
  { dataIndex: 'dayIndex', title: '第N天', width: 76 },
  {
    dataIndex: 'totalSalesQty',
    sorter: (a, b) => a.totalSalesQty - b.totalSalesQty,
    title: '销量',
    width: 76,
  },
  { dataIndex: 'adSalesQty', title: '广告销量', width: 90 },
  { dataIndex: 'organicSalesQty', title: '自然销量', width: 90 },
  { dataIndex: 'salesAmount', title: '销售额', width: 96 },
  { dataIndex: 'adSalesAmount', title: '广告销售额', width: 108 },
  { dataIndex: 'adSpend', title: '广告花费', width: 96 },
  { dataIndex: 'profit', title: '毛利', width: 90 },
  { dataIndex: 'sessions', title: 'Sessions', width: 96 },
  { dataIndex: 'clicks', title: '点击', width: 78 },
  { dataIndex: 'cvr', title: 'CVR', width: 78 },
  { dataIndex: 'adCvr', title: '广告CVR', width: 92 },
  { dataIndex: 'acos', title: 'ACOS', width: 82 },
  { dataIndex: 'tacos', title: 'TACOS', width: 82 },
  { dataIndex: 'roas', title: 'ROAS', width: 78 },
  { dataIndex: 'cpc', title: 'CPC', width: 78 },
  { dataIndex: 'cpo', title: 'CPO', width: 78 },
  { dataIndex: 'budgetUtilization', title: '预算消耗', width: 96 },
  { dataIndex: 'fbaStock', title: 'FBA库存', width: 88 },
  { dataIndex: 'fbaInbound', title: 'FBA在途', width: 88 },
  { dataIndex: 'inventoryDays', title: '库存天数', width: 96 },
  { dataIndex: 'bsrMainRank', title: 'BSR大类', width: 96 },
  { dataIndex: 'starRating', title: '评分', width: 78 },
  { dataIndex: 'reviewCount', title: '评论数', width: 82 },
];

const spuColumns: TableColumnsType<KanbanSpuRow> = [
  { dataIndex: 'spu', fixed: 'left', title: 'SPU', width: 128 },
  { dataIndex: 'site', fixed: 'left', title: '站点', width: 70 },
  { dataIndex: 'category', title: '类目', width: 120 },
  { dataIndex: 'status', title: '状态', width: 86 },
  { dataIndex: 'lifecycleStage', title: '阶段', width: 110 },
  {
    dataIndex: 'lastProfit',
    sorter: (a, b) => a.lastProfit - b.lastProfit,
    title: '最新毛利',
    width: 104,
  },
  {
    dataIndex: 'avgSales7',
    sorter: (a, b) => a.avgSales7 - b.avgSales7,
    title: '近7日日销',
    width: 104,
  },
  { dataIndex: 'acos7', title: 'ACOS', width: 88 },
  { dataIndex: 'budgetUtilization', title: '预算消耗', width: 98 },
  {
    dataIndex: 'inventoryDays',
    sorter: (a, b) => a.inventoryDays - b.inventoryDays,
    title: '库存天数',
    width: 98,
  },
  { dataIndex: 'stockQty', title: '库存/在途', width: 106 },
  { dataIndex: 'starRating', title: '评分', width: 86 },
  { dataIndex: 'reasonText', ellipsis: true, title: '关注原因', width: 280 },
  { dataIndex: 'responsibleName', title: '负责人', width: 100 },
  { dataIndex: 'lastMetricDate', title: '指标日', width: 110 },
  { dataIndex: 'action', fixed: 'right', title: '操作', width: 90 },
];

const rows = computed(() => overview.value?.actionRows ?? []);
const allRows = computed(() => overview.value?.actionRows ?? []);
const filterOptions = computed(() => overview.value?.filters);

const failedRows = computed(() =>
  allRows.value.filter(
    (row) => row.status === '滞销' || row.alertLevel === 'red',
  ),
);

const successRows = computed(() =>
  allRows.value.filter((row) => row.status === '成品'),
);

const pendingRows = computed(() =>
  allRows.value.filter((row) => row.status !== '成品' && row.status !== '滞销'),
);

const inventoryRiskRows = computed(() =>
  allRows.value.filter(
    (row) => row.inventoryDays > 0 && row.inventoryDays <= 30,
  ),
);

const coldTimeoutRows = computed(() =>
  failedRows.value.filter(
    (row) =>
      row.lifecycleStage === '冷启动期' ||
      row.reasonText.includes('冷启动') ||
      row.reasonText.includes('上架>7天'),
  ),
);

const salesLowRows = computed(() =>
  failedRows.value.filter(
    (row) =>
      row.avgSales7 > 0 &&
      row.avgSales7 < 6 &&
      (row.lifecycleStage === '起量期' || row.reasonText.includes('销量')),
  ),
);

const highAcosRows = computed(() =>
  failedRows.value.filter(
    (row) => row.acos7 > 0.45 || row.reasonText.includes('ACOS'),
  ),
);

const overviewCards = computed(() => {
  const total = allRows.value.length;
  const failed = failedRows.value.length;
  return [
    {
      label: '新品总数',
      sub: `当前筛选范围 ${total} 个 SPU`,
      tone: 'blue' as Tone,
      value: total,
    },
    {
      label: '成品率',
      sub: `成品 ${successRows.value.length} 个，待判定 ${pendingRows.value.length} 个`,
      tone: 'green' as Tone,
      value: percent(successRows.value.length, total),
    },
    {
      label: '待干预',
      sub: `红色 ${overview.value?.summary.redCount ?? 0}，橙色 ${overview.value?.summary.orangeCount ?? 0}`,
      tone: failed > 0 ? ('red' as Tone) : ('green' as Tone),
      value: overview.value?.summary.needAction ?? 0,
    },
    {
      label: '冷启动超时率',
      sub: `${coldTimeoutRows.value.length}/${failed || 0} 个风险 SPU`,
      tone: 'amber' as Tone,
      value: percent(coldTimeoutRows.value.length, failed),
    },
    {
      label: '销量不足率',
      sub: `${salesLowRows.value.length}/${failed || 0} 个风险 SPU`,
      tone: 'cyan' as Tone,
      value: percent(salesLowRows.value.length, failed),
    },
    {
      label: '库存风险',
      sub: '库存天数 <= 30 天',
      tone:
        inventoryRiskRows.value.length > 0
          ? ('purple' as Tone)
          : ('green' as Tone),
      value: inventoryRiskRows.value.length,
    },
  ];
});

const categoryBars = computed<CategoryBar[]>(() => {
  const groups = new Map<string, KanbanSpuRow[]>();
  for (const row of allRows.value) {
    const key = row.category || '未分类';
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([category, list]) => {
      const success = list.filter((row) => row.status === '成品').length;
      const fail = list.filter(
        (row) => row.status === '滞销' || row.alertLevel === 'red',
      ).length;
      const pending = Math.max(0, list.length - success - fail);
      return {
        category,
        fail,
        failRate: roundRate(fail, list.length),
        pending,
        rate: roundRate(success, list.length),
        success,
        total: list.length,
      };
    })
    .toSorted((a, b) => b.total - a.total || b.failRate - a.failRate);
});

const stageRows = computed(() =>
  (overview.value?.stageSummary ?? []).map((stage) => ({
    ...stage,
    risk: stage.red + stage.orange,
    riskRate: roundRate(stage.red + stage.orange, stage.count),
  })),
);

const rootCauseRows = computed(() => {
  const counter = new Map<string, number>();
  for (const row of failedRows.value) {
    const parts = (row.reasonText || '')
      .split(/[；;，,]/)
      .map((item) => item.trim())
      .filter((item) => item && item !== '推进正常');
    for (const part of parts.length > 0 ? parts : ['待人工复核']) {
      counter.set(part, (counter.get(part) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .map(([label, count]) => ({
      count,
      label,
      rate: roundRate(count, failedRows.value.length),
    }))
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 6);
});

const insightGroups = computed(() => {
  const riskCategories = categoryBars.value
    .filter((item) => item.total >= 2)
    .toSorted((a, b) => b.failRate - a.failRate || b.fail - a.fail)
    .slice(0, 2)
    .map<InsightItem>((item) => ({
      detail: `失败/红色风险 ${item.fail}/${item.total}，成品率 ${item.rate}%。优先看首单速度、广告效率和评分。`,
      title: `${item.category} 风险偏高`,
    }));

  const opportunity = [
    ...highAcosRows.value.slice(0, 1).map<InsightItem>((row) => ({
      detail: `${row.spu} 近7日 ACOS ${formatPercent(row.acos7)}，预算消耗 ${formatPercent(row.budgetUtilization)}。`,
      title: '广告效率需要复核',
    })),
    ...inventoryRiskRows.value.slice(0, 1).map<InsightItem>((row) => ({
      detail: `${row.spu} 库存可用 ${row.inventoryDays} 天，FBA库存 ${formatInteger(row.fbaStock)}，在途 ${formatInteger(row.fbaInbound)}。`,
      title: '补货节奏需要前置',
    })),
  ];

  const strengths = categoryBars.value
    .filter((item) => item.total >= 2 && item.rate >= 70)
    .slice(0, 3)
    .map<InsightItem>((item) => ({
      detail: `${item.success}/${item.total} 个已成品，当前风险 ${item.fail} 个。可作为后续选品和投放节奏参考。`,
      title: `${item.category} 成品率 ${item.rate}%`,
    }));

  return {
    opportunity:
      opportunity.length > 0
        ? opportunity
        : [
            {
              detail: '当前筛选范围内广告和库存没有集中异常。',
              title: '暂无集中机会点',
            },
          ],
    risk:
      riskCategories.length > 0
        ? riskCategories
        : [
            {
              detail: '当前筛选范围内暂无明显高风险类目。',
              title: '风险分布平稳',
            },
          ],
    strength:
      strengths.length > 0
        ? strengths
        : [
            {
              detail: '成品率优势类目不足，建议扩大样本后再判断。',
              title: '优势类目待观察',
            },
          ],
  };
});

const filteredSpuRows = computed(() => {
  const keyword = spuSearch.value.trim().toLowerCase();
  return rows.value.filter((row) => {
    if (quickStatus.value === 'success' && row.status !== '成品') return false;
    if (
      quickStatus.value === 'fail' &&
      row.status !== '滞销' &&
      row.alertLevel !== 'red'
    ) {
      return false;
    }
    if (!keyword) return true;
    return (
      row.spu.toLowerCase().includes(keyword) ||
      row.category.toLowerCase().includes(keyword) ||
      row.parentAsin.toLowerCase().includes(keyword)
    );
  });
});

const dailySummary = computed(() => {
  const totalSales = dailyMetrics.value.reduce(
    (sum, row) => sum + Number(row.totalSalesQty || 0),
    0,
  );
  const totalProfit = dailyMetrics.value.reduce(
    (sum, row) => sum + Number(row.profit || 0),
    0,
  );
  const totalAdSpend = dailyMetrics.value.reduce(
    (sum, row) => sum + Number(row.adSpend || 0),
    0,
  );
  const latest = dailyMetrics.value.at(-1);
  return {
    inventoryDays: latest?.inventoryDays ?? 0,
    latestStock: latest?.fbaStock ?? 0,
    totalAdSpend,
    totalProfit,
    totalSales,
  };
});

async function loadData() {
  loading.value = true;
  try {
    overview.value = await fetchKanbanOverview({
      alertLevels: query.alertLevels,
      categories: query.categories,
      responsibles: query.responsibles,
      sites: query.sites,
      statuses: query.statuses,
    });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  query.alertLevels = [];
  query.categories = [];
  query.responsibles = [];
  query.sites = [];
  query.statuses = [];
  spuSearch.value = '';
  quickStatus.value = 'all';
  loadData();
}

async function openDetail(row: KanbanSpuRow) {
  selectedRow.value = row;
  drawerOpen.value = true;
  dailyMetrics.value = [];
  dailyPagination.current = 1;
  detailLoading.value = true;
  try {
    dailyMetrics.value = await fetchSpuDailyMetrics({
      site: row.site,
      spu: row.spu,
    });
  } finally {
    detailLoading.value = false;
  }
}

function rowKey(row: KanbanSpuRow) {
  return `${row.spu}-${row.site}`;
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return '0%';
  return `${roundRate(numerator, denominator)}%`;
}

function roundRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function formatPercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function formatMoney(value: number) {
  return `¥${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function formatInteger(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function statusColor(row: KanbanSpuRow) {
  if (row.status === '成品') return 'green';
  if (row.status === '滞销' || row.alertLevel === 'red') return 'red';
  if (row.alertLevel === 'orange') return 'orange';
  return 'blue';
}

function statusLabel(row: KanbanSpuRow) {
  if (row.status === '成品') return '成功';
  if (row.status === '滞销') return '失败';
  if (row.alertLevel === 'red') return '红色';
  if (row.alertLevel === 'orange') return '橙色';
  return row.status || '新品';
}

function inventoryTone(row: KanbanSpuRow) {
  if (row.inventoryDays > 0 && row.inventoryDays <= 15) return 'risk-text';
  if (row.inventoryDays > 0 && row.inventoryDays <= 30) return 'warn-text';
  return '';
}

function cardValueClass(tone: Tone) {
  return `value-${tone}`;
}

onMounted(loadData);
</script>

<template>
  <div class="monitor-page">
    <section class="hero">
      <div>
        <h1>RSLOVE 新品数据看板</h1>
        <p>
          以 SPU +
          站点为核心，追踪新品从冷启动到判定期的销售、广告、库存和评分表现。
        </p>
      </div>
      <div class="hero-meta">
        <span>最新数据：{{ overview?.summary.lastMetricDate ?? '加载中' }}</span>
        <span>当前范围：{{ overview?.summary.scopeTotal ?? 0 }} 个 SPU</span>
      </div>
    </section>

    <Card :body-style="{ padding: '16px' }" class="filter-card">
      <div class="filters">
        <Select
          v-model:value="query.sites"
          :options="
            filterOptions?.sites.map((value) => ({ label: value, value }))
          "
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="站点"
        />
        <Select
          v-model:value="query.responsibles"
          :options="
            filterOptions?.responsibles.map((value) => ({
              label: value,
              value,
            }))
          "
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="负责人"
        />
        <Select
          v-model:value="query.categories"
          :options="
            filterOptions?.categories.map((value) => ({ label: value, value }))
          "
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="类目"
        />
        <Select
          v-model:value="query.statuses"
          :options="
            filterOptions?.statuses.map((value) => ({ label: value, value }))
          "
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="状态"
        />
        <Select
          v-model:value="query.alertLevels"
          :options="alertOptions"
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="预警等级"
        />
        <div class="filter-actions">
          <Button @click="resetFilters">重置</Button>
          <Button type="primary" :loading="loading" @click="loadData">
            应用筛选
          </Button>
        </div>
      </div>
    </Card>

    <Spin :spinning="loading">
      <template v-if="overview">
        <Tabs v-model:active-key="activeTab" class="page-tabs">
          <Tabs.TabPane key="overview" tab="总览大盘">
            <div class="metric-grid">
              <div
                v-for="card in overviewCards"
                :key="card.label"
                class="metric-card"
                :class="`tone-${card.tone}`"
              >
                <span>{{ card.label }}</span>
                <strong :class="cardValueClass(card.tone)">
                  {{ card.value }}
                </strong>
                <p>{{ card.sub }}</p>
              </div>
            </div>

            <div class="overview-grid">
              <Card title="各类目成品率" :body-style="{ padding: '16px' }">
                <div class="category-bars">
                  <div
                    v-for="item in categoryBars"
                    :key="item.category"
                    class="category-row"
                  >
                    <span class="category-name">{{ item.category }}</span>
                    <div class="category-track">
                      <div
                        class="category-success"
                        :style="{ width: `${item.rate}%` }"
                      ></div>
                      <div
                        class="category-fail"
                        :style="{ width: `${item.failRate}%` }"
                      ></div>
                    </div>
                    <strong
                      :class="
                        item.rate >= 70
                          ? 'ok-text'
                          : item.rate >= 50
                            ? 'warn-text'
                            : 'risk-text'
                      "
                    >
                      {{ item.rate }}%
                    </strong>
                  </div>
                </div>
              </Card>

              <Card title="待干预阶段与根因" :body-style="{ padding: '16px' }">
                <div class="stage-list">
                  <div
                    v-for="stage in stageRows"
                    :key="stage.stage"
                    class="stage-row"
                  >
                    <span>{{ stage.stage }}</span>
                    <Progress
                      :percent="stage.riskRate"
                      :show-info="false"
                      size="small"
                      stroke-color="#d97706"
                    />
                    <strong>{{ stage.risk }}/{{ stage.count }}</strong>
                  </div>
                </div>
                <div class="root-cause-list">
                  <div
                    v-for="cause in rootCauseRows"
                    :key="cause.label"
                    class="root-cause-row"
                  >
                    <span>{{ cause.label }}</span>
                    <strong>{{ cause.count }} · {{ cause.rate }}%</strong>
                  </div>
                </div>
              </Card>
            </div>

            <div class="insight-grid">
              <Card title="重点问题" :body-style="{ padding: '14px 16px' }">
                <div
                  v-for="item in insightGroups.risk"
                  :key="item.title"
                  class="insight-item risk"
                >
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.detail }}</p>
                </div>
              </Card>
              <Card title="改善机会" :body-style="{ padding: '14px 16px' }">
                <div
                  v-for="item in insightGroups.opportunity"
                  :key="item.title"
                  class="insight-item warn"
                >
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.detail }}</p>
                </div>
              </Card>
              <Card title="优势类目" :body-style="{ padding: '14px 16px' }">
                <div
                  v-for="item in insightGroups.strength"
                  :key="item.title"
                  class="insight-item ok"
                >
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.detail }}</p>
                </div>
              </Card>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane key="spus" :tab="`SPU明细 (${filteredSpuRows.length})`">
            <Card class="spu-card" :body-style="{ padding: 0 }">
              <template #title>
                <div class="spu-toolbar">
                  <Space wrap>
                    <Button
                      :type="quickStatus === 'all' ? 'primary' : 'default'"
                      @click="quickStatus = 'all'"
                    >
                      全部 {{ rows.length }}
                    </Button>
                    <Button
                      :type="quickStatus === 'fail' ? 'primary' : 'default'"
                      danger
                      @click="quickStatus = 'fail'"
                    >
                      失败/红色 {{ failedRows.length }}
                    </Button>
                    <Button
                      :type="quickStatus === 'success' ? 'primary' : 'default'"
                      @click="quickStatus = 'success'"
                    >
                      成功 {{ successRows.length }}
                    </Button>
                  </Space>
                  <Input.Search
                    v-model:value="spuSearch"
                    allow-clear
                    class="spu-search"
                    placeholder="搜索 SPU / 类目 / 父ASIN"
                  />
                </div>
              </template>

              <Table
                :columns="spuColumns"
                :data-source="filteredSpuRows"
                :pagination="{
                  pageSize: 15,
                  pageSizeOptions: ['15', '30', '50', '100'],
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 个 SPU`,
                }"
                :row-key="rowKey"
                :scroll="{ x: 1780 }"
                size="small"
                sticky
              >
                <template #bodyCell="{ column, record, text }">
                  <template v-if="column.dataIndex === 'spu'">
                    <a
                      class="spu-link"
                      @click="openDetail(record as KanbanSpuRow)"
                    >
                      {{ text }}
                    </a>
                  </template>
                  <template v-else-if="column.dataIndex === 'status'">
                    <Tag :color="statusColor(record as KanbanSpuRow)">
                      {{ statusLabel(record as KanbanSpuRow) }}
                    </Tag>
                  </template>
                  <template v-else-if="column.dataIndex === 'lifecycleStage'">
                    <Tag :color="stageTagColor[String(text || '')]">
                      {{ text || '-' }}
                    </Tag>
                  </template>
                  <template v-else-if="column.dataIndex === 'lastProfit'">
                    <span
                      :class="Number(text || 0) < 0 ? 'risk-text' : 'ok-text'"
                    >
                      {{ formatMoney(Number(text || 0)) }}
                    </span>
                  </template>
                  <template v-else-if="column.dataIndex === 'acos7'">
                    <span :class="record.acos7 > 0.35 ? 'risk-text' : ''">
                      {{ formatPercent(record.acos7) }}
                    </span>
                  </template>
                  <template
                    v-else-if="column.dataIndex === 'budgetUtilization'"
                  >
                    {{
                      record.budgetUtilization
                        ? formatPercent(record.budgetUtilization)
                        : '-'
                    }}
                  </template>
                  <template v-else-if="column.dataIndex === 'inventoryDays'">
                    <span :class="inventoryTone(record as KanbanSpuRow)">
                      {{
                        record.inventoryDays
                          ? `${record.inventoryDays} 天`
                          : '-'
                      }}
                    </span>
                  </template>
                  <template v-else-if="column.dataIndex === 'stockQty'">
                    {{ formatInteger(record.fbaStock) }} /
                    {{ formatInteger(record.fbaInbound) }}
                  </template>
                  <template v-else-if="column.dataIndex === 'starRating'">
                    {{
                      record.starRating
                        ? `${record.starRating.toFixed(1)}★`
                        : '-'
                    }}
                  </template>
                  <template v-else-if="column.dataIndex === 'reasonText'">
                    {{ text || '推进正常' }}
                  </template>
                  <template v-else-if="column.dataIndex === 'action'">
                    <Button
                      size="small"
                      type="link"
                      @click="openDetail(record as KanbanSpuRow)"
                    >
                      每日明细
                    </Button>
                  </template>
                </template>
              </Table>
            </Card>
          </Tabs.TabPane>
        </Tabs>
      </template>
    </Spin>

    <Drawer
      v-model:open="drawerOpen"
      :title="selectedRow ? `${selectedRow.spu} · 每日明细` : '每日明细'"
      width="1120"
    >
      <template v-if="selectedRow">
        <Descriptions :column="2" bordered size="small">
          <Descriptions.Item label="父 ASIN">
            {{ selectedRow.parentAsin || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="站点 / 类目">
            {{ selectedRow.site }} / {{ selectedRow.category || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="负责人">
            {{ selectedRow.responsibleName || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="生命周期">
            <Tag :color="stageTagColor[selectedRow.lifecycleStage]">
              {{ selectedRow.lifecycleStage || '-' }}
            </Tag>
            {{ selectedRow.erpLifecycle || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="近7日日销 / ACOS">
            {{ selectedRow.avgSales7 }} /
            {{ formatPercent(selectedRow.acos7) }}
          </Descriptions.Item>
          <Descriptions.Item label="库存">
            {{ selectedRow.inventoryDays || '-' }} 天 · FBA
            {{ formatInteger(selectedRow.fbaStock) }} · 在途
            {{ formatInteger(selectedRow.fbaInbound) }}
          </Descriptions.Item>
          <Descriptions.Item label="最新销售额 / 毛利">
            {{ formatMoney(selectedRow.lastSalesAmount) }} /
            {{ formatMoney(selectedRow.lastProfit) }}
          </Descriptions.Item>
          <Descriptions.Item label="关注原因">
            {{ selectedRow.reasonText || '推进正常' }}
          </Descriptions.Item>
        </Descriptions>

        <div class="drawer-summary">
          <div>
            <span>累计销量</span>
            <strong>{{ formatInteger(dailySummary.totalSales) }}</strong>
          </div>
          <div>
            <span>累计毛利</span>
            <strong>{{ formatMoney(dailySummary.totalProfit) }}</strong>
          </div>
          <div>
            <span>累计广告花费</span>
            <strong>{{ formatMoney(dailySummary.totalAdSpend) }}</strong>
          </div>
          <div>
            <span>最新库存天数</span>
            <strong>{{ dailySummary.inventoryDays || '-' }}</strong>
          </div>
        </div>

        <Card class="daily-card" title="每日明细" :body-style="{ padding: 0 }">
          <Table
            :columns="dailyColumns"
            :data-source="dailyMetrics"
            :loading="detailLoading"
            :pagination="dailyPagination"
            :scroll="{ x: 2140, y: 460 }"
            row-key="metricDate"
            size="small"
          >
            <template #bodyCell="{ column, record, text }">
              <template
                v-if="
                  column.dataIndex === 'salesAmount' ||
                  column.dataIndex === 'adSalesAmount' ||
                  column.dataIndex === 'adSpend' ||
                  column.dataIndex === 'profit' ||
                  column.dataIndex === 'cpc' ||
                  column.dataIndex === 'cpo'
                "
              >
                {{ formatMoney(Number(text || 0)) }}
              </template>
              <template
                v-else-if="
                  column.dataIndex === 'cvr' ||
                  column.dataIndex === 'adCvr' ||
                  column.dataIndex === 'acos' ||
                  column.dataIndex === 'tacos' ||
                  column.dataIndex === 'budgetUtilization'
                "
              >
                <span
                  :class="
                    (column.dataIndex === 'acos' && record.acos > 0.35) ||
                    (column.dataIndex === 'tacos' && record.tacos > 0.15)
                      ? 'risk-text'
                      : ''
                  "
                >
                  {{ formatPercent(Number(text || 0)) }}
                </span>
              </template>
              <template v-else-if="column.dataIndex === 'inventoryDays'">
                <span
                  :class="
                    record.inventoryDays <= 15
                      ? 'risk-text'
                      : record.inventoryDays <= 30
                        ? 'warn-text'
                        : ''
                  "
                >
                  {{ text ?? '-' }}
                </span>
              </template>
              <template v-else-if="column.dataIndex === 'bsrMainRank'">
                {{ text ? `#${Number(text).toLocaleString()}` : '-' }}
              </template>
              <template v-else-if="column.dataIndex === 'starRating'">
                {{ Number(text || 0).toFixed(1) }}
              </template>
            </template>
          </Table>
        </Card>
      </template>
    </Drawer>
  </div>
</template>

<style scoped>
.monitor-page {
  min-height: 100%;
  padding: 16px;
  background: #f6f8fb;
}

.hero {
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 24px 28px;
  margin-bottom: 12px;
  color: #f8fafc;
  background: #164e63;
  border: 1px solid rgb(15 118 110 / 18%);
  border-radius: 10px;
  box-shadow: 0 16px 36px rgb(15 23 42 / 12%);
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 850;
  letter-spacing: 0;
}

.hero p {
  max-width: 820px;
  margin: 0;
  line-height: 1.7;
  color: rgb(248 250 252 / 82%);
}

.hero-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
  justify-content: center;
  font-size: 13px;
  color: rgb(248 250 252 / 86%);
  white-space: nowrap;
}

.filter-card {
  margin-bottom: 12px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(140px, 1fr)) auto;
  gap: 10px;
  align-items: center;
}

.filter-actions {
  display: inline-flex;
  gap: 8px;
  justify-content: flex-end;
}

.page-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.metric-card {
  min-height: 116px;
  padding: 15px 16px;
  background: #fff;
  border: 1px solid rgb(15 23 42 / 8%);
  border-top: 4px solid #2563eb;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgb(15 23 42 / 5%);
}

.metric-card span {
  display: block;
  font-size: 12px;
  font-weight: 750;
  color: #64748b;
}

.metric-card strong {
  display: block;
  margin-top: 12px;
  font-size: 27px;
  line-height: 1;
}

.metric-card p {
  margin: 9px 0 0;
  font-size: 12px;
  color: #64748b;
}

.tone-blue {
  border-top-color: #2563eb;
}

.tone-green {
  border-top-color: #16a34a;
}

.tone-red {
  border-top-color: #dc2626;
}

.tone-amber {
  border-top-color: #d97706;
}

.tone-cyan {
  border-top-color: #0891b2;
}

.tone-purple {
  border-top-color: #7c3aed;
}

.value-blue {
  color: #1d4ed8;
}

.value-green {
  color: #15803d;
}

.value-red {
  color: #dc2626;
}

.value-amber {
  color: #b45309;
}

.value-cyan {
  color: #0e7490;
}

.value-purple {
  color: #6d28d9;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
  gap: 12px;
  margin-bottom: 12px;
}

.category-bars,
.stage-list,
.root-cause-list {
  display: grid;
  gap: 10px;
}

.category-row {
  display: grid;
  grid-template-columns: 128px 1fr 58px;
  gap: 10px;
  align-items: center;
}

.category-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  white-space: nowrap;
}

.category-track {
  display: flex;
  height: 18px;
  overflow: hidden;
  background: #eef2f7;
  border-radius: 5px;
}

.category-success {
  height: 100%;
  background: #16a34a;
}

.category-fail {
  height: 100%;
  background: #dc2626;
}

.stage-row {
  display: grid;
  grid-template-columns: 92px 1fr 58px;
  gap: 10px;
  align-items: center;
}

.stage-row span,
.root-cause-row span {
  font-size: 12px;
  font-weight: 750;
  color: #475569;
}

.stage-row strong,
.root-cause-row strong {
  font-size: 12px;
  color: #0f172a;
  text-align: right;
}

.root-cause-list {
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.root-cause-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 86px;
  gap: 10px;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.insight-item {
  padding: 11px 12px;
  border-radius: 8px;
}

.insight-item + .insight-item {
  margin-top: 9px;
}

.insight-item strong {
  font-size: 13px;
  color: #0f172a;
}

.insight-item p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.65;
  color: #64748b;
}

.insight-item.risk {
  background: #fff1f2;
}

.insight-item.warn {
  background: #fffbeb;
}

.insight-item.ok {
  background: #f0fdf4;
}

.spu-card {
  margin-bottom: 12px;
}

.spu-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.spu-search {
  width: 280px;
}

.spu-link {
  font-weight: 800;
}

.daily-card {
  margin-top: 12px;
}

.drawer-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.drawer-summary div {
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.drawer-summary span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.drawer-summary strong {
  display: block;
  margin-top: 7px;
  font-size: 18px;
  color: #0f172a;
}

.ok-text {
  font-weight: 800;
  color: #15803d;
}

.warn-text {
  font-weight: 800;
  color: #b45309;
}

.risk-text {
  font-weight: 800;
  color: #dc2626;
}

@media (max-width: 1320px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .overview-grid,
  .insight-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 980px) {
  .filters {
    grid-template-columns: 1fr 1fr;
  }

  .drawer-summary,
  .metric-grid {
    grid-template-columns: 1fr 1fr;
  }

  .spu-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .spu-search {
    width: 100%;
  }
}

@media (max-width: 760px) {
  .hero {
    flex-direction: column;
  }

  .hero-meta {
    align-items: flex-start;
  }

  .filters,
  .drawer-summary,
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
