<script setup lang="ts">
import type {
  HalloweenOverview,
  HalloweenRow,
} from '#/api/kanban/halloween-calendar';

import { computed } from 'vue';

import { formatNumber as fmt, formatRate as rate } from './model';
import { compactGap, compactYoy, trendTone } from './progress-display';
import { periodSummary } from './sales-progress';

const props = defineProps<{
  index: number;
  phase: HalloweenOverview['phases'][number];
  rows: HalloweenRow[];
  through: null | string;
}>();
const summary = computed(() => periodSummary(props.rows, props.index + 1));
const hasTarget = computed(() =>
  ['09', '10'].includes(props.phase.start.slice(5, 7)),
);
const cutoff = computed(() =>
  props.through && props.through >= props.phase.start
    ? [props.through, props.phase.end].toSorted()[0]
    : null,
);
</script>

<template>
  <section class="stage-sales" aria-label="所选阶段销售进度" aria-live="polite">
    <div class="stage-sales-heading">
      <h3>{{ phase.name }}</h3>
      <span>{{ phase.start.slice(5).replace('-', '/') }}—{{
          phase.end.slice(5).replace('-', '/')
        }}<template v-if="cutoff">
          · 截至 {{ cutoff.slice(5).replace('-', '/') }}</template></span>
    </div>
    <p v-if="!cutoff" class="stage-sales-empty">
      {{ phase.state === 'upcoming' ? '未开始' : '待更新' }}
    </p>
    <div v-else class="stage-sales-grid">
      <div>
        <span>销量同比</span>
        <strong
          :class="trendTone(summary.yoy === null ? null : summary.yoy * 100)"
          >{{ compactYoy(summary) }}</strong>
        <p>
          今年 {{ fmt(summary.current) }} · 去年 {{ fmt(summary.previous) }}
        </p>
      </div>
      <div>
        <span>目标完成</span>
        <strong>{{ hasTarget ? rate(summary.rate) : '未设目标' }}</strong>
        <p>{{ fmt(summary.actual) }} / {{ fmt(summary.target) }} 件</p>
      </div>
      <div>
        <span>较均摊目标</span>
        <strong
          class="pace-value"
          :class="hasTarget ? trendTone(summary.points) : 'trend-neutral'"
          >{{ hasTarget ? compactGap(summary.points) : '未设目标' }}</strong>
        <p v-if="summary.delta !== null">
          应达 {{ rate(summary.expected) }} ·
          {{ summary.delta >= 0 ? '多' : '少' }}
          {{ fmt(Math.abs(summary.delta)) }} 件
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stage-sales {
  padding-top: 14px;
  margin-top: 18px;
  border-top: 1px solid var(--line);
}

.stage-sales-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  justify-content: space-between;
}

h3 {
  margin: 0;
  font-size: 14px;
}

.stage-sales-heading span,
.stage-sales-empty {
  font-size: 12px;
  color: var(--muted);
}

.stage-sales-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  margin-top: 12px;
}

.stage-sales-grid span {
  font-size: 12px;
  color: var(--muted);
}

.stage-sales-grid strong {
  display: block;
  margin: 4px 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.5;
}

.stage-sales-grid strong.pace-value {
  font-size: 18px;
}

.stage-sales-grid p {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.trend-up {
  color: var(--positive);
  background: var(--positive-bg);
}

.trend-down {
  color: var(--negative);
  background: var(--negative-bg);
}

.trend-neutral {
  color: var(--muted);
}

.stage-sales-grid strong.trend-up,
.stage-sales-grid strong.trend-down {
  width: fit-content;
  padding: 3px 8px;
  font-weight: 700;
  border-radius: 4px;
}

@media (max-width: 700px) {
  .stage-sales-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .stage-sales-grid > div {
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }
}
</style>
