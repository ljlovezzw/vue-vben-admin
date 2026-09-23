<script setup lang="ts">
export interface PerformanceReview {
  status: string;
  message: string;
  note: string;
  contextOnly: boolean;
  level: string;
  windows?: Record<'after' | 'before', { end: string; start: string }>;
  before?: Record<string, null | number>;
  after?: Record<string, null | number>;
  changes?: Record<string, null | number>;
}
defineProps<{ value: PerformanceReview }>();
const metrics = [
  { key: 'spend', label: '花费' },
  { key: 'sales', label: '广告销售额' },
  { key: 'orders', label: '订单' },
  { key: 'clicks', label: '点击' },
  { key: 'cvr', label: 'CVR (%)' },
  { key: 'acos', label: 'ACoS (%)' },
];
function number(value: null | number | undefined) {
  return value === null || value === undefined
    ? '—'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
</script>
<template>
  <section class="performance-review" aria-label="执行前后效果复盘">
    <h4>
      {{
        value.contextOnly
          ? '所属广告组背景趋势'
          : value.level === 'campaign'
            ? '广告活动前后对比'
            : '广告组前后对比'
      }}
    </h4>
    <p>{{ value.message }}</p>
    <p v-if="value.windows">
      前：{{ value.windows.before.start }} — {{ value.windows.before.end
      }}<br />后：{{ value.windows.after.start }} —
      {{ value.windows.after.end }}
    </p>
    <div
      v-if="value.status === 'ready'"
      class="table-scroll"
      tabindex="0"
      aria-label="前后 7 天指标对比"
    >
      <table>
        <thead>
          <tr>
            <th>指标</th>
            <th>执行前</th>
            <th>执行后</th>
            <th>变化</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="metric in metrics" :key="metric.key">
            <th>{{ metric.label }}</th>
            <td>{{ number(value.before?.[metric.key]) }}</td>
            <td>{{ number(value.after?.[metric.key]) }}</td>
            <td>
              {{ number(value.changes?.[metric.key])
              }}{{
                ['cvr', 'acos'].includes(metric.key) &&
                value.changes?.[metric.key] !== null &&
                value.changes?.[metric.key] !== undefined
                  ? ' 个百分点'
                  : ''
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <small>{{ value.note }}金额使用店铺币种。</small>
  </section>
</template>
<style scoped>
.performance-review {
  padding-top: 12px;
  margin-top: 14px;
  border-top: 1px dashed #d7dee8;
}

h4 {
  margin: 0;
  font-weight: 600;
}

p,
small {
  margin: 6px 0;
  font-size: 13px;
  line-height: 1.6;
  color: #5f7087;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  font-size: 13px;
  white-space: nowrap;
  border-collapse: collapse;
}

th,
td {
  padding: 8px 12px 8px 0;
  text-align: left;
  border-bottom: 1px solid #e1e6ee;
}
</style>
