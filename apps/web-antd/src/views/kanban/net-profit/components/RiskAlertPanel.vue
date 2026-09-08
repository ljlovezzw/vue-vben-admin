<script setup lang="ts">
import type { NetProfitRiskAlert } from '#/api/kanban/types';

import { computed } from 'vue';

import { Empty, Spin, Tag } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    data: NetProfitRiskAlert[] | null;
    loading?: boolean;
  }>(),
  { loading: false },
);

const severityConfig = {
  high: { color: 'red', label: '高风险' },
  low: { color: 'blue', label: '提示' },
  medium: { color: 'orange', label: '关注' },
} as const;

const typeLabels: Record<NetProfitRiskAlert['type'], string> = {
  continuous_loss: '连续亏损',
  low_gross_margin: '毛利缓冲不足',
  low_net_margin: '净利率偏低',
  low_roi_high_investment: '高投入低回报',
  negative_gross_profit: '负毛利',
};

const alerts = computed(() => props.data ?? []);

function formatMetric(key: string, value: number | string) {
  if (typeof value === 'string') return value;
  if (key.includes('率')) return `${(value * 100).toFixed(2)}%`;
  if (key === 'ROI') return value.toFixed(2);
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}
</script>

<template>
  <div class="risk-alert-panel">
    <Spin :spinning="loading">
      <div v-if="alerts.length > 0" class="alert-list">
        <article
          v-for="(alert, index) in alerts"
          :key="`${alert.type}-${alert.dimension}-${alert.dimensionValue}-${index}`"
          class="alert-card"
          :class="`is-${alert.severity}`"
        >
          <header>
            <div>
              <strong>{{ alert.dimensionValue }}</strong>
              <span>{{ typeLabels[alert.type] }}</span>
            </div>
            <Tag :color="severityConfig[alert.severity].color">
              {{ severityConfig[alert.severity].label }}
            </Tag>
          </header>
          <p>{{ alert.message }}</p>
          <dl>
            <div v-for="(value, key) in alert.metrics" :key="key">
              <dt>{{ key }}</dt>
              <dd>{{ formatMetric(String(key), value) }}</dd>
            </div>
          </dl>
          <footer v-if="alert.recommendation">
            <b>管理动作</b>
            {{ alert.recommendation }}
          </footer>
        </article>
      </div>
      <Empty
        v-else-if="!loading"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
        description="当前筛选范围未触发经营预警"
      />
    </Spin>
  </div>
</template>

<style scoped>
.risk-alert-panel {
  width: 100%;
  max-height: 490px;
  overflow: auto;
}

.alert-list {
  display: grid;
  gap: 8px;
}

.alert-card {
  padding: 11px;
  background: #fff;
  border: 1px solid #d8e1ec;
  border-radius: 5px;
}

.alert-card.is-high {
  background: #fffafa;
  border-color: #efb3b3;
}

.alert-card.is-medium {
  background: #fffdf7;
  border-color: #e6cf91;
}

.alert-card header,
.alert-card header > div {
  display: flex;
  gap: 7px;
  align-items: center;
}

.alert-card header {
  justify-content: space-between;
}

.alert-card header strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: #172033;
  white-space: nowrap;
}

.alert-card header span,
.alert-card p,
.alert-card footer {
  font-size: 11px;
  line-height: 1.55;
  color: #64748b;
}

.alert-card p {
  margin: 7px 0;
  color: #334155;
}

.alert-card dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  margin: 0;
}

.alert-card dl > div {
  min-width: 0;
  padding: 5px 7px;
  background: #f8fafc;
  border-radius: 3px;
}

.alert-card dt {
  font-size: 10px;
  color: #718096;
}

.alert-card dd {
  margin: 1px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
  color: #27364a;
  white-space: nowrap;
}

.alert-card footer {
  padding-top: 7px;
  margin-top: 7px;
  border-top: 1px solid #edf1f5;
}

.alert-card footer b {
  margin-right: 5px;
  color: #334155;
}

.risk-alert-panel :deep(.ant-empty) {
  margin: 110px 0;
}
</style>
