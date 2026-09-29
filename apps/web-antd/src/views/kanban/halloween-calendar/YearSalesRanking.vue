<script setup lang="ts">
import type { HalloweenRow } from '#/api/kanban/halloween-calendar';

import { computed, ref, watch } from 'vue';

import { formatNumber as fmt, formatRate as rate } from './model';
import { rankYearChanges } from './year-ranking';

const props = defineProps<{
  index: number;
  rows: HalloweenRow[];
  sites: Record<string, string>;
  through: null | string;
}>();
const emit = defineEmits<{ detail: [id: string] }>();
const expanded = ref('');
const mode = ref<'all' | 'stage'>('all');
const ranking = computed(() =>
  rankYearChanges(props.rows, mode.value === 'all' ? 'all' : props.index + 1),
);
const lists = computed(() => [
  {
    key: 'growth',
    title: '同比增量前十',
    tone: 'positive',
    items: ranking.value.growth,
  },
  {
    key: 'decline',
    title: '同比下滑前十',
    tone: 'negative',
    items: ranking.value.decline,
  },
]);
const signed = (value: number) => `${value > 0 ? '+' : ''}${fmt(value)}`;
watch([() => props.rows, () => props.through, () => props.index, mode], () => {
  expanded.value = '';
});
</script>

<template>
  <details class="section year-ranking" aria-label="商品同比增减排名">
    <summary class="ranking-title">
      <h3>同比增减前十</h3>
      <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
        <path
          d="m6 3 5 5-5 5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </summary>
    <div class="ranking-controls" role="group" aria-label="同比排名周期">
      <button :aria-pressed="mode === 'stage'" @click="mode = 'stage'">
        所选阶段
      </button>
      <button :aria-pressed="mode === 'all'" @click="mode = 'all'">
        全阶段
      </button>
    </div>
    <div class="ranking-grid">
      <section
        v-for="list in lists"
        :key="list.key"
        class="ranking-list"
        :class="list.tone"
      >
        <div class="list-title">
          <h3>{{ list.title }}</h3>
        </div>
        <table v-if="list.items.length > 0">
          <caption class="sr-only">
            {{
              list.title
            }}，单位：件，点击商品展开站点
          </caption>
          <colgroup>
            <col class="product-column" />
            <col class="sales-column" />
            <col class="sales-column" />
            <col class="delta-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">商品</th>
              <th scope="col">今年</th>
              <th scope="col">去年</th>
              <th scope="col">增减 / 同比</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(item, rank) in list.items" :key="item.spu">
              <tr>
                <td>
                  <button
                    class="rank-product"
                    :aria-expanded="expanded === item.spu"
                    :aria-controls="
                      expanded === item.spu ? `rank-${item.spu}` : undefined
                    "
                    :title="`${item.sites.length}/${item.totalSites} 站点可比`"
                    :aria-label="`${expanded === item.spu ? '收起' : '展开'} ${item.spu} 站点明细`"
                    @click="expanded = expanded === item.spu ? '' : item.spu"
                  >
                    <span class="rank-position">{{ rank + 1 }}</span><span>{{ item.spu }}</span>
                  </button>
                </td>
                <td>{{ fmt(item.current) }}</td>
                <td>{{ fmt(item.previous) }}</td>
                <td>
                  <strong class="rank-delta">{{ signed(item.delta) }}</strong><small>{{
                    item.yoy === null
                      ? '去年为 0'
                      : `${item.yoy > 0 ? '+' : ''}${rate(item.yoy)}`
                  }}</small>
                </td>
              </tr>
              <template v-if="expanded === item.spu">
                <tr
                  v-for="(entry, siteIndex) in item.sites"
                  :key="entry.id"
                  :id="siteIndex === 0 ? `rank-${item.spu}` : undefined"
                  class="rank-detail rank-site"
                >
                  <td>
                    <button class="link" @click="emit('detail', entry.id)">
                      {{ sites[entry.site] ?? entry.site }} · {{ entry.owner }}
                    </button>
                  </td>
                  <td>{{ fmt(entry.current) }}</td>
                  <td>{{ fmt(entry.previous) }}</td>
                  <td>
                    <b :class="entry.delta >= 0 ? 'site-up' : 'site-down'">{{
                      signed(entry.delta)
                    }}</b>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
        <p v-else class="rank-empty">
          {{
            ranking.comparableSpus > 0
              ? `暂无同比${list.key === 'growth' ? '增长' : '下滑'}商品`
              : '暂无可比销量'
          }}
        </p>
      </section>
    </div>
  </details>
</template>

<style scoped>
.ranking-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
  align-items: start;
}

.ranking-list {
  min-width: 0;
}

.list-title h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--rank-color);
}

.ranking-controls {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  margin: 12px 0;
}

.ranking-controls button {
  min-height: 36px;
  padding: 6px 12px;
  font: inherit;
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
  background: var(--soft);
  border: 1px solid var(--line);
  border-radius: 4px;
}

.ranking-controls button[aria-pressed='true'] {
  color: var(--paper);
  background: var(--ink);
  border-color: var(--ink);
}

.ranking-controls button:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.positive {
  --rank-color: var(--positive);
  --rank-bg: var(--positive-bg);
}

.negative {
  --rank-color: var(--negative);
  --rank-bg: var(--negative-bg);
}

.ranking-title {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 8px 12px;
  color: var(--ink);
  cursor: pointer;
  list-style: none;
  background: var(--soft);
  border-radius: 4px;
}

.ranking-title::-webkit-details-marker {
  display: none;
}

.ranking-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.ranking-title svg {
  flex: none;
}

.year-ranking[open] .ranking-title svg {
  transform: rotate(90deg);
}

.ranking-title:hover {
  box-shadow: inset 0 0 0 1px var(--line);
}

button:focus-visible,
summary:focus-visible {
  outline: 3px solid var(--orange);
  outline-offset: 3px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  clip-path: inset(50%);
}

table {
  width: 100%;
  font-size: 13px;
  table-layout: fixed;
  border-collapse: collapse;
}

.product-column {
  width: 40%;
}

.sales-column {
  width: 17%;
}

.delta-column {
  width: 26%;
}

th,
td {
  padding: 8px 4px;
  vertical-align: middle;
  text-align: center;
  border-bottom: 1px solid var(--line);
}

th {
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
}

td {
  font-variant-numeric: tabular-nums;
}

th:first-child,
td:first-child {
  padding-left: 0;
  text-align: left;
}

td small {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--muted);
}

.rank-product {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-height: 36px;
  padding: 2px 0;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  text-decoration: underline;
  text-decoration-color: var(--line);
  text-underline-offset: 4px;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 3px;
}

.rank-product:hover {
  background: var(--soft);
}

.rank-position {
  min-width: 16px;
  font-weight: 400;
  color: var(--muted);
}

.rank-delta {
  display: inline-block;
  padding: 2px 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--rank-color);
  white-space: nowrap;
  background: var(--rank-bg);
  border-radius: 4px;
}

.rank-detail td {
  padding: 6px 4px;
  font-size: 12px;
  background: var(--soft);
}

.rank-detail td:first-child {
  padding-left: 8px;
}

.rank-site .link {
  min-height: 32px;
  padding: 4px 0;
  font: inherit;
  font-size: 12px;
  color: var(--orange);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.rank-site b {
  font-weight: 600;
}

.site-up {
  color: var(--positive);
}

.site-down {
  color: var(--negative);
}

.rank-empty {
  padding: 24px 8px;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
  background: var(--soft);
}

@media (max-width: 900px) {
  .ranking-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

@media (max-width: 450px) {
  table {
    font-size: 12px;
  }

  .rank-delta {
    font-size: 14px;
  }
}
</style>
