<script setup lang="ts">
import type {
  AlertLevel,
  KanbanDailyMetric,
  KanbanOverview,
  KanbanSpuRow,
} from '#/api/kanban';

import { computed, onMounted, reactive, ref } from 'vue';
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Select,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import { fetchKanbanOverview, fetchSpuDailyMetrics } from '#/api/kanban';

import HealthPanels from './components/HealthPanels.vue';
import MetricCards from './components/MetricCards.vue';
import SpuTable from './components/SpuTable.vue';
import TrendPanel from './components/TrendPanel.vue';

const loading = ref(false);
const overview = ref<KanbanOverview | null>(null);
const selectedRow = ref<KanbanSpuRow | null>(null);
const drawerOpen = ref(false);
const detailLoading = ref(false);
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

const filterOptions = computed(() => overview.value?.filters);

const alertOptions = [
  { label: '红色', value: 'red' },
  { label: '橙色', value: 'orange' },
  { label: '正常', value: 'green' },
  { label: '待观察', value: 'gray' },
];

const dailyColumns: TableColumnsType<KanbanDailyMetric> = [
  {
    title: '日期',
    dataIndex: 'metricDate',
    defaultSortOrder: 'descend',
    fixed: 'left',
    sorter: (a, b) => a.metricDate.localeCompare(b.metricDate),
    width: 112,
  },
  { title: '第N天', dataIndex: 'dayIndex', width: 76 },
  {
    title: '销量',
    dataIndex: 'totalSalesQty',
    width: 76,
    sorter: (a, b) => a.totalSalesQty - b.totalSalesQty,
  },
  { title: '广告销量', dataIndex: 'adSalesQty', width: 90 },
  { title: '自然销量', dataIndex: 'organicSalesQty', width: 90 },
  {
    title: '销售额',
    dataIndex: 'salesAmount',
    width: 96,
    sorter: (a, b) => a.salesAmount - b.salesAmount,
  },
  { title: '广告花费', dataIndex: 'adSpend', width: 96 },
  { title: '毛利', dataIndex: 'profit', width: 90 },
  { title: 'Sessions', dataIndex: 'sessions', width: 96 },
  { title: '点击', dataIndex: 'clicks', width: 78 },
  { title: 'CVR', dataIndex: 'cvr', width: 78 },
  { title: 'CTR', dataIndex: 'ctr', width: 78 },
  { title: 'ACOS', dataIndex: 'acos', width: 82 },
  { title: '预算消耗', dataIndex: 'budgetUtilization', width: 96 },
  { title: '库存', dataIndex: 'fbaStock', width: 82 },
  { title: '在途', dataIndex: 'fbaInbound', width: 82 },
  { title: '库存天数', dataIndex: 'inventoryDays', width: 96 },
  { title: 'BSR大类', dataIndex: 'bsrMainRank', width: 96 },
  { title: '评分', dataIndex: 'starRating', width: 78 },
  { title: '评论数', dataIndex: 'reviewCount', width: 82 },
];

function formatPercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
const stageTagColor: Record<string, string> = {
  冷启动期: 'blue',
  判定期: 'red',
  未到货: 'default',
  稳定期: 'green',
  起量期: 'orange',
};

onMounted(loadData);
</script>

<template>
  <div class="monitor-page">
    <section class="hero">
      <div>
        <h1>新品运营看板</h1>
        <p>
          基于快照表与聚合接口的前后端分离版本。页面只负责筛选、展示和下钻，重计算放到后端与
          ETL。
        </p>
      </div>
      <div class="hero-meta">
        <span
          >最新数据：{{ overview?.summary.lastMetricDate ?? '加载中' }}</span
        >
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
        <MetricCards :kpis="overview.coreKpis" :summary="overview.summary" />

        <div class="main-grid">
          <TrendPanel :trend="overview.trend" />
          <Card title="处理焦点" :body-style="{ padding: '16px' }">
            <div class="focus-list">
              <div class="focus-item red">
                <span>今日红色预警</span>
                <strong>{{ overview.summary.redCount }}</strong>
                <p>优先排查销量失速、评分异常和库存断档风险。</p>
              </div>
              <div class="focus-item amber">
                <span>48 小时跟进</span>
                <strong>{{ overview.summary.orangeCount }}</strong>
                <p>关注起量偏慢、转化不足和预算消耗异常。</p>
              </div>
              <div class="focus-item slate">
                <span>即将判定</span>
                <strong>{{ overview.summary.judgeCount }}</strong>
                <p>61-90 天阶段 SPU，需要准备成品或滞销判定。</p>
              </div>
            </div>
          </Card>
        </div>

        <HealthPanels
          :categories="overview.categoryProgress"
          :funnel="overview.funnel"
          :stages="overview.stageSummary"
        />

        <SpuTable :rows="overview.actionRows" @select="openDetail" />
      </template>
    </Spin>

    <Drawer
      v-model:open="drawerOpen"
      :title="selectedRow ? `${selectedRow.spu} 下钻详情` : '下钻详情'"
      width="1080"
    >
      <template v-if="selectedRow">
        <Descriptions :column="2" bordered size="small">
          <Descriptions.Item label="父 ASIN">
            {{ selectedRow.parentAsin }}
          </Descriptions.Item>
          <Descriptions.Item label="站点 / 类目">
            {{ selectedRow.site }} / {{ selectedRow.category }}
          </Descriptions.Item>
          <Descriptions.Item label="负责人">
            {{ selectedRow.responsibleName }}
          </Descriptions.Item>
          <Descriptions.Item label="生命周期">
            <Tag :color="stageTagColor[selectedRow.lifecycleStage]">
              {{ selectedRow.lifecycleStage }}
            </Tag>
            {{ selectedRow.erpLifecycle }}
          </Descriptions.Item>
          <Descriptions.Item label="近7日日销">
            {{ selectedRow.avgSales7 }}
          </Descriptions.Item>
          <Descriptions.Item label="CVR / ACOS">
            {{ (selectedRow.cvr7 * 100).toFixed(2) }}% /
            {{ (selectedRow.acos7 * 100).toFixed(2) }}%
          </Descriptions.Item>
          <Descriptions.Item label="库存 / 评分">
            {{ selectedRow.inventoryDays }} 天 / {{ selectedRow.starRating }}
          </Descriptions.Item>
          <Descriptions.Item label="异常原因">
            {{ selectedRow.reasonText }}
          </Descriptions.Item>
        </Descriptions>

        <Card class="daily-card" title="每日明细" :body-style="{ padding: 0 }">
          <Table
            :columns="dailyColumns"
            :data-source="dailyMetrics"
            :loading="detailLoading"
            :pagination="dailyPagination"
            :scroll="{ x: 1680, y: 460 }"
            row-key="metricDate"
            size="small"
          >
            <template #bodyCell="{ column, record, text }">
              <template
                v-if="
                  column.dataIndex === 'salesAmount' ||
                  column.dataIndex === 'adSpend' ||
                  column.dataIndex === 'profit'
                "
              >
                {{ formatMoney(Number(text || 0)) }}
              </template>
              <template
                v-else-if="
                  column.dataIndex === 'cvr' ||
                  column.dataIndex === 'ctr' ||
                  column.dataIndex === 'acos' ||
                  column.dataIndex === 'budgetUtilization'
                "
              >
                <span
                  :class="
                    column.dataIndex === 'acos' && record.acos > 0.3
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
  background: #0f172a;
  border: 1px solid rgb(148 163 184 / 18%);
  border-radius: 10px;
  box-shadow: 0 16px 36px rgb(15 23 42 / 16%);
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 850;
  letter-spacing: 0;
}

.hero p {
  max-width: 760px;
  margin: 0;
  line-height: 1.7;
  color: rgb(248 250 252 / 76%);
}

.hero-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
  justify-content: center;
  font-size: 13px;
  color: rgb(248 250 252 / 78%);
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

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(320px, 0.8fr);
  gap: 12px;
  margin: 12px 0;
}

.focus-list {
  display: grid;
  gap: 10px;
}

.focus-item {
  padding: 14px 16px;
  background: #fff;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 8px;
}

.focus-item span {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
}

.focus-item strong {
  display: block;
  margin-top: 6px;
  font-size: 28px;
  line-height: 1;
  color: #0f172a;
}

.focus-item p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: #64748b;
}

.focus-item.red {
  border-top: 4px solid #dc2626;
}

.focus-item.amber {
  border-top: 4px solid #d97706;
}

.focus-item.slate {
  border-top: 4px solid #475569;
}

.daily-card {
  margin-top: 12px;
}

.risk-text {
  font-weight: 800;
  color: #dc2626;
}

.warn-text {
  font-weight: 800;
  color: #b45309;
}

@media (max-width: 1280px) {
  .filters,
  .main-grid {
    grid-template-columns: 1fr 1fr;
  }

  .filter-actions {
    justify-content: flex-start;
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
  .main-grid {
    grid-template-columns: 1fr;
  }
}
</style>
