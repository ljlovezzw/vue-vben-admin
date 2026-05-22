<script setup lang="ts">
import type {
  KanbanCategoryProgress,
  KanbanFunnel,
  KanbanStageSummary,
} from '#/api/kanban/types';

import { computed } from 'vue';
import { Card, Table } from 'ant-design-vue';

const props = defineProps<{
  categories: KanbanCategoryProgress[];
  funnel: KanbanFunnel;
  stages: KanbanStageSummary[];
}>();

const funnelRows = computed(() => [
  { label: '曝光量（Impressions）', value: props.funnel.impressions },
  { label: '点击量（Clicks）', value: props.funnel.clicks },
  { label: '会话数（Sessions）', value: props.funnel.sessions },
  { label: '订单量（Orders）', value: props.funnel.salesQty },
]);

const conversionRows = computed(() => {
  const rows = funnelRows.value;
  return [
    { label: '点击率', value: getRate(rows[1]?.value, rows[0]?.value) },
    { label: '会话率', value: getRate(rows[2]?.value, rows[1]?.value) },
    { label: '转化率', value: getRate(rows[3]?.value, rows[2]?.value) },
  ];
});

function formatNumber(value: number) {
  return Math.round(Number(value || 0)).toLocaleString();
}

function getRate(current = 0, previous = 0) {
  return previous > 0 ? current / previous : 0;
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

const stageColumns = [
  { title: '阶段', dataIndex: 'stage', width: 100 },
  { title: 'SPU', dataIndex: 'count', width: 80 },
  { title: '红色', dataIndex: 'red', width: 80 },
  { title: '橙色', dataIndex: 'orange', width: 80 },
  { title: '平均天数', dataIndex: 'avgLaunchDays', width: 90 },
];

const categoryColumns = [
  { title: '类目', dataIndex: 'category', width: 120 },
  { title: 'SPU', dataIndex: 'total', width: 70 },
  { title: '待干预', dataIndex: 'needAction', width: 80 },
  { title: '成品率', dataIndex: 'currentRate', width: 90 },
  { title: '目标', dataIndex: 'targetRate', width: 80 },
];
</script>

<template>
  <div class="health-grid">
    <Card :body-style="{ padding: '16px 18px 18px' }">
      <template #title>
        <div class="funnel-title">流量转化漏斗</div>
      </template>
      <div class="funnel-panel">
        <div class="funnel-shape">
          <div
            v-for="(row, index) in funnelRows"
            :key="row.label"
            :class="['funnel-slice', `slice-${index}`]"
          >
            <span class="slice-label">{{ row.label }}</span>
            <strong>{{ formatNumber(row.value) }}</strong>
          </div>
        </div>

        <div class="conversion-list">
          <div
            v-for="row in conversionRows"
            :key="row.label"
            class="conversion-item"
          >
            <span class="conversion-dot"></span>
            <div>
              <span>{{ row.label }}</span>
              <strong>{{ formatRate(row.value) }}</strong>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <Card title="生命周期阶段" :body-style="{ padding: 0 }">
      <Table
        :columns="stageColumns"
        :data-source="stages"
        :pagination="false"
        row-key="stage"
        size="small"
      />
    </Card>

    <Card title="类目成品率" :body-style="{ padding: 0 }">
      <Table
        :columns="categoryColumns"
        :data-source="categories"
        :pagination="false"
        row-key="category"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'currentRate'">
            <span
              :class="record.currentRate >= record.targetRate ? 'ok' : 'warn'"
            >
              {{ record.currentRate }}%
            </span>
          </template>
          <template v-if="column.dataIndex === 'targetRate'">
            {{ record.targetRate }}%
          </template>
        </template>
      </Table>
    </Card>
  </div>
</template>

<style scoped>
.health-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr 1fr;
  gap: 12px;
}

.funnel-title {
  font-size: 15px;
  font-weight: 850;
  color: #0f172a;
  text-align: center;
}

.funnel-panel {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 112px;
  gap: 14px;
  align-items: center;
  min-height: 250px;
}

.funnel-shape {
  display: grid;
  align-content: center;
  min-height: 226px;
}

.funnel-slice {
  display: grid;
  place-items: center;
  width: 100%;
  height: 54px;
  color: #0f172a;
  text-align: center;
  box-shadow: 0 10px 20px rgb(15 23 42 / 8%);
}

.funnel-slice + .funnel-slice {
  margin-top: -1px;
}

.funnel-slice strong {
  margin-top: -8px;
  font-size: 15px;
  font-weight: 900;
}

.slice-label {
  font-size: 11px;
  font-weight: 750;
  color: #334155;
}

.slice-0 {
  background: #75a7f8;
  clip-path: polygon(0 0, 100% 0, 88% 100%, 12% 100%);
}

.slice-1 {
  background: #84c7f5;
  clip-path: polygon(12% 0, 88% 0, 76% 100%, 24% 100%);
}

.slice-2 {
  background: #a6dedf;
  clip-path: polygon(24% 0, 76% 0, 64% 100%, 36% 100%);
}

.slice-3 {
  background: #bde9df;
  clip-path: polygon(36% 0, 64% 0, 56% 100%, 44% 100%);
}

.conversion-list {
  display: grid;
  gap: 32px;
}

.conversion-item {
  display: grid;
  grid-template-columns: 10px 1fr;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  font-weight: 800;
  color: #475569;
}

.conversion-dot {
  width: 5px;
  height: 5px;
  background: #2563eb;
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgb(37 99 235 / 10%);
}

.conversion-item strong {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 900;
  color: #2563eb;
}

.ok {
  font-weight: 800;
  color: #15803d;
}

.warn {
  font-weight: 800;
  color: #b45309;
}

@media (max-width: 1200px) {
  .health-grid {
    grid-template-columns: 1fr;
  }
}
</style>
