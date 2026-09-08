<script setup lang="ts">
import { computed } from 'vue';

import { Skeleton } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    loading?: boolean;
    note?: string;
    title: string;
    tone?: 'danger' | 'default' | 'info' | 'success' | 'warning';
    value: number | string;
  }>(),
  {
    loading: false,
    note: '',
    tone: 'default',
  },
);

const formattedValue = computed(() =>
  typeof props.value === 'number'
    ? props.value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
    : props.value,
);
</script>

<template>
  <article class="metric-card" :class="`is-${tone}`">
    <Skeleton v-if="loading" :paragraph="{ rows: 1 }" size="small" active />
    <template v-else>
      <span>{{ title }}</span>
      <strong>{{ formattedValue }}</strong>
      <p v-if="note">{{ note }}</p>
    </template>
  </article>
</template>

<style scoped>
.metric-card {
  --metric-accent: #94a3b8;

  position: relative;
  min-height: 106px;
  padding: 13px 14px 11px 17px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #d8e1ec;
  border-radius: 6px;
}

.metric-card::after {
  position: absolute;
  top: 13px;
  right: 13px;
  width: 7px;
  height: 7px;
  content: '';
  background: var(--metric-accent);
  border-radius: 50%;
}

.metric-card > span {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.metric-card > strong {
  display: block;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: #172033;
  white-space: nowrap;
}

.metric-card > p {
  margin: 7px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  color: #718096;
  white-space: nowrap;
}

.metric-card.is-success {
  --metric-accent: #059669;

  border-color: #a7d9ca;
}

.metric-card.is-warning {
  --metric-accent: #ca8a04;

  border-color: #e6cf91;
}

.metric-card.is-danger {
  --metric-accent: #dc2626;

  border-color: #efb3b3;
}

.metric-card.is-info {
  --metric-accent: #2563eb;

  border-color: #b4c8ef;
}
</style>
