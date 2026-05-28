<script setup lang="ts">
import type { KanbanCoreKpi, KanbanSummary } from '#/api/kanban/types';

const props = defineProps<{
  kpis: KanbanCoreKpi[];
  summary: KanbanSummary;
}>();

const topCards = computed(() => [
  {
    label: '在追踪新品',
    value: props.summary.totalNew,
    sub: `监控范围 ${props.summary.scopeTotal} 个 SPU`,
    tone: 'blue',
  },
  {
    label: '红色预警',
    value: props.summary.redCount,
    sub: '需当天处理',
    tone: props.summary.redCount > 0 ? 'red' : 'green',
  },
  {
    label: '橙色提醒',
    value: props.summary.orangeCount,
    sub: '48 小时内跟进',
    tone: 'amber',
  },
  {
    label: '当前成品率',
    value: `${props.summary.qualifyRate}%`,
    sub: `成品 ${props.summary.qualified} 个`,
    tone: 'green',
  },
]);

function formatValue(kpi: KanbanCoreKpi) {
  if (kpi.unit === '$') {
    return `$${Number(kpi.value).toLocaleString()}`;
  }
  if (kpi.unit === '¥') {
    return `¥${Number(kpi.value).toLocaleString()}`;
  }
  return `${Number(kpi.value).toLocaleString()}${kpi.unit ?? ''}`;
}

function deltaClass(kpi: KanbanCoreKpi) {
  const delta = kpi.delta ?? 0;
  const good = kpi.inverseDelta ? delta <= 0 : delta >= 0;
  return good ? 'delta-up' : 'delta-down';
}
</script>

<script lang="ts">
import { computed } from 'vue';
</script>

<template>
  <div class="metric-grid">
    <div
      v-for="item in topCards"
      :key="item.label"
      class="summary-card"
      :class="`tone-${item.tone}`"
    >
      <div class="label">{{ item.label }}</div>
      <div class="value">{{ item.value }}</div>
      <div class="sub">{{ item.sub }}</div>
    </div>
  </div>

  <div class="core-grid">
    <div
      v-for="kpi in kpis"
      :key="kpi.key"
      class="core-card"
      :class="`core-${kpi.tone}`"
    >
      <div class="core-label">{{ kpi.label }}</div>
      <div class="core-value">{{ formatValue(kpi) }}</div>
      <div
        v-if="kpi.delta !== undefined"
        class="core-delta"
        :class="deltaClass(kpi)"
      >
        {{ kpi.delta > 0 ? '+' : '' }}{{ kpi.delta }}%
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric-grid,
.core-grid {
  display: grid;
  gap: 12px;
}

.metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.core-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 12px;
}

.summary-card,
.core-card {
  min-height: 118px;
  background: #fff;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 8px;
  box-shadow: 0 8px 20px rgb(15 23 42 / 5%);
}

.summary-card {
  padding: 16px 18px;
  border-top: 4px solid #2563eb;
}

.label,
.core-label {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
}

.value {
  margin-top: 12px;
  font-size: 30px;
  font-weight: 850;
  line-height: 1;
  color: #0f172a;
}

.sub {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
}

.tone-red {
  border-top-color: #dc2626;
}

.tone-amber {
  border-top-color: #d97706;
}

.tone-green {
  border-top-color: #16a34a;
}

.core-card {
  padding: 15px 16px;
  color: #fff;
}

.core-value {
  margin-top: 14px;
  font-size: 24px;
  font-weight: 850;
  line-height: 1;
}

.core-delta {
  display: inline-flex;
  padding: 3px 8px;
  margin-top: 12px;
  font-size: 12px;
  font-weight: 800;
  background: rgb(255 255 255 / 16%);
  border-radius: 999px;
}

.delta-up {
  color: #dcfce7;
}

.delta-down {
  color: #fee2e2;
}

.core-blue {
  background: #1d4ed8;
}

.core-cyan {
  background: #0369a1;
}

.core-green {
  background: #15803d;
}

.core-amber {
  background: #b45309;
}

.core-red {
  background: #b91c1c;
}

.core-purple {
  background: #4338ca;
}

@media (max-width: 1200px) {
  .metric-grid,
  .core-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .metric-grid,
  .core-grid {
    grid-template-columns: 1fr;
  }
}
</style>
