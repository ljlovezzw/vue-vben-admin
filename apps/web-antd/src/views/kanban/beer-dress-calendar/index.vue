<script setup lang="ts">
import type { BeerDressCalendarAction, BeerDressCalendarOverview } from '#/api/kanban/types';

import { computed, onMounted, ref } from 'vue';

import { Button, Empty, Modal, Progress, Select, Spin, Tag, message } from 'ant-design-vue';

import {
  confirmBeerDressCalendarAction,
  fetchBeerDressCalendarOverview,
} from '#/api/kanban';

const loading = ref(false);
const data = ref<BeerDressCalendarOverview | null>(null);
const responsible = ref<string>();
const priority = ref<string>();
const detailVisible = ref(false);
const confirmingKey = ref<string | null>(null);

const rows = computed(() => data.value?.actions ?? []);
const pendingRows = computed(() => rows.value.filter((row) => row.status !== '已确认'));
const visibleRows = computed(() => rows.value.slice(0, 8));
const operators = computed(() => [
  ...new Set(rows.value.map((row) => row.responsible).filter(Boolean)),
]);
const summary = computed(
  () =>
    data.value?.summary ?? {
      actual: 0,
      expectedProgress: 0,
      inventoryAlerts: 0,
      p0: 0,
      p1: 0,
      priceActions: 0,
      progress: 0,
      target: 0,
    },
);

async function load() {
  loading.value = true;
  try {
    data.value = await fetchBeerDressCalendarOverview({
      responsible: responsible.value,
      priority: priority.value,
    });
  } finally {
    loading.value = false;
  }
}

async function confirmAction(row: BeerDressCalendarAction) {
  if (row.status === '已确认' || confirmingKey.value) return;
  confirmingKey.value = row.actionKey;
  try {
    const result = await confirmBeerDressCalendarAction(row.actionKey, data.value?.asOfDate);
    row.status = result.status || '已确认';
    row.confirmedBy = result.confirmedBy;
    row.confirmedAt = result.confirmedAt;
    message.success('已确认，状态已保存');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '确认失败，请稍后重试');
  } finally {
    confirmingKey.value = null;
  }
}

function pct(value: null | number | undefined) {
  return value === null || value === undefined ? '—' : `${(Number(value || 0) * 100).toFixed(1)}%`;
}
function qty(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}
function money(value: number) {
  return value ? `€${Number(value).toFixed(2)}` : '待录入';
}
function priorityColor(value: string) {
  return value === 'P0' ? 'red' : value === 'P1' ? 'orange' : 'green';
}
function statusLabel(row: BeerDressCalendarAction) {
  return row.status === '已确认' ? '已确认' : '确认处理';
}

onMounted(load);
</script>

<template>
  <div class="beer-calendar">
    <Spin :spinning="loading">
      <template v-if="data">
        <main class="notice-card">
          <header class="notice-header">
            <div class="notice-title-wrap">
              <span class="notice-mark" aria-hidden="true"></span>
              <div>
                <p class="notice-kicker">DE · BEER DRESS OPERATIONS</p>
                <h1>啤酒服今日运营通知</h1>
                <p class="notice-subtitle">{{ data.asOfDate }} · {{ data.phase.name }} · 距阶段结束 {{ data.phase.daysToEnd }} 天</p>
              </div>
            </div>
            <Button type="text" class="refresh-button" :loading="loading" @click="load">刷新</Button>
          </header>

          <section class="notice-intro">
            <div>
              <Tag color="volcano">{{ pendingRows.length ? '待处理' : '已清空' }}</Tag>
              <h2>{{ pendingRows.length ? `有 ${pendingRows.length} 项需要确认` : '今日事项已全部确认' }}</h2>
              <p>先处理 P0，再处理库存覆盖和售价动作。点击每行右侧按钮即完成确认。</p>
            </div>
            <div class="holiday-chip">
              <span>慕尼黑啤酒节</span>
              <strong>{{ data.holiday.daysToStart > 0 ? `${data.holiday.daysToStart} 天` : data.holiday.daysToStart === 0 ? '今天' : '进行中' }}</strong>
              <small>{{ data.holiday.start }} 开幕</small>
            </div>
          </section>

          <section class="metrics-strip" aria-label="今日摘要">
            <div><span>目标销量</span><strong>{{ qty(summary.target) }}</strong></div>
            <div><span>已完成</span><strong>{{ qty(summary.actual) }}</strong></div>
            <div><span>当前进度</span><strong>{{ pct(summary.progress) }}</strong></div>
            <div class="metric-alert"><span>P0 / P1</span><strong>{{ summary.p0 }} <b>/</b> {{ summary.p1 }}</strong></div>
            <div><span>库存预警</span><strong>{{ summary.inventoryAlerts }}</strong></div>
          </section>

          <div class="pace-line">
            <div class="pace-label"><span>销售进度</span><b>应达 {{ pct(summary.expectedProgress) }}</b></div>
            <Progress :percent="Math.min(summary.progress * 100, 100)" :show-info="false" stroke-color="#d86a43" />
          </div>

          <section class="queue-section">
            <div class="queue-heading">
              <div><span class="section-label">ACTION QUEUE</span><h2>现在要做什么</h2></div>
              <span>{{ rows.length }} 项 · 显示最紧急 8 项</span>
            </div>
            <div v-if="visibleRows.length" class="queue-list">
              <article v-for="row in visibleRows" :key="row.actionKey" class="queue-row" :class="{ confirmed: row.status === '已确认' }">
                <div class="queue-priority"><Tag :color="priorityColor(row.priority)">{{ row.priority }}</Tag><span>{{ row.responsible }}</span></div>
                <div class="queue-main">
                  <div class="queue-product"><strong>{{ row.spu }}</strong><span>{{ row.category }} · {{ row.parentAsin || '父ASIN待补录' }}</span></div>
                  <div class="queue-facts"><span>{{ row.action }}</span><span>现价 {{ money(row.currentPrice) }} → {{ money(row.suggestedPrice) }}</span><span>库存 {{ qty(row.inventory) }} 件 · {{ row.inventoryDays ? `${row.inventoryDays.toFixed(1)} 天覆盖` : '缺少销量基准' }}</span><span>进度 {{ pct(row.progress) }} / {{ pct(row.expectedProgress) }}</span></div>
                  <p>{{ row.reason }}</p>
                </div>
                <Button class="confirm-button" :type="row.status === '已确认' ? 'default' : 'primary'" :disabled="row.status === '已确认'" :loading="confirmingKey === row.actionKey" @click="confirmAction(row)">{{ statusLabel(row) }}</Button>
              </article>
            </div>
            <Empty v-else description="当前没有可执行事项" />
          </section>

          <footer class="notice-footer">
            <div class="filters">
              <Select v-model:value="responsible" allow-clear placeholder="全部负责人" :options="operators.map((x) => ({ label: x, value: x }))" @change="load" />
              <Select v-model:value="priority" allow-clear placeholder="全部优先级" :options="[{ label: 'P0 紧急', value: 'P0' }, { label: 'P1 关注', value: 'P1' }, { label: '正常', value: '正常' }]" @change="load" />
            </div>
            <Button type="link" @click="detailVisible = true">查看完整通知（{{ rows.length }} 项）</Button>
          </footer>
        </main>

        <Modal v-model:open="detailVisible" title="啤酒服完整运营通知" width="980px" :footer="null" destroy-on-close>
          <div class="modal-summary">{{ data.asOfDate }} · {{ data.phase.name }} · 目标 {{ qty(summary.target) }} · 已完成 {{ qty(summary.actual) }}（{{ pct(summary.progress) }}）</div>
          <div class="modal-list">
            <article v-for="row in rows" :key="`modal-${row.actionKey}`" class="modal-row">
              <div class="modal-row-head"><Tag :color="priorityColor(row.priority)">{{ row.priority }}</Tag><strong>{{ row.spu }}</strong><span>{{ row.responsible }} · {{ row.category }}</span><Button size="small" :type="row.status === '已确认' ? 'default' : 'primary'" :disabled="row.status === '已确认'" :loading="confirmingKey === row.actionKey" @click="confirmAction(row)">{{ statusLabel(row) }}</Button></div>
              <div class="modal-row-facts">{{ row.action }} · 现价 {{ money(row.currentPrice) }} → {{ money(row.suggestedPrice) }} · 库存 {{ qty(row.inventory) }} 件 / {{ row.inventoryDays ? `${row.inventoryDays.toFixed(1)} 天覆盖` : '缺少销量基准' }} · 进度 {{ pct(row.progress) }} / {{ pct(row.expectedProgress) }}</div>
              <p>{{ row.reason }}</p>
            </article>
          </div>
        </Modal>
      </template>
      <Empty v-else description="暂无啤酒服数据，请检查目标和每日表现同步状态" />
    </Spin>
  </div>
</template>

<style scoped>
.beer-calendar { min-height: 100%; padding: 28px; color: #173332; background: #f2efe8; }
.notice-card { max-width: 1180px; margin: 0 auto; overflow: hidden; background: #fffdf8; border: 1px solid #ded8cc; border-radius: 18px; box-shadow: 0 18px 50px rgb(31 56 52 / 10%); }
.notice-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 30px; color: #f8f5ee; background: #173b39; }
.notice-title-wrap { display: flex; gap: 14px; align-items: center; }
.notice-mark { width: 12px; height: 42px; background: #e37b4d; border-radius: 8px; }
.notice-kicker, .section-label { margin: 0 0 5px; color: #e9b497; font-size: 10px; font-weight: 700; letter-spacing: .14em; }
h1, h2, p { margin: 0; }
h1 { font-size: 25px; letter-spacing: -.03em; }
h2 { font-size: 21px; letter-spacing: -.025em; }
.notice-subtitle { margin-top: 5px; color: #b8cdc3; font-size: 12px; }
.refresh-button { color: #eaf1e9; }
.notice-intro { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px 30px 22px; }
.notice-intro h2 { margin-top: 10px; }
.notice-intro p { margin-top: 7px; color: #76837d; font-size: 13px; }
.holiday-chip { min-width: 150px; padding: 12px 14px; color: #80502e; background: #fff2dc; border: 1px solid #f0d3a0; border-radius: 10px; }
.holiday-chip span, .holiday-chip small { display: block; font-size: 11px; }
.holiday-chip strong { display: block; margin: 4px 0; font-size: 21px; }
.metrics-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; margin: 0 30px; background: #e5e0d6; border: 1px solid #e5e0d6; border-radius: 10px; overflow: hidden; }
.metrics-strip > div { padding: 13px 15px; background: #f8f6f0; }
.metrics-strip span { display: block; color: #77847e; font-size: 11px; }
.metrics-strip strong { display: block; margin-top: 5px; color: #244a46; font-size: 21px; }
.metrics-strip b { color: #a8b1ab; font-weight: 400; }
.metric-alert strong { color: #b94f38; }
.pace-line { padding: 20px 30px 8px; }
.pace-label { display: flex; justify-content: space-between; margin-bottom: 5px; color: #697873; font-size: 12px; }
.pace-label b { color: #a65d43; font-weight: 600; }
.queue-section { padding: 18px 30px 12px; }
.queue-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 13px; }
.queue-heading > span { color: #8b9690; font-size: 12px; }
.queue-list { display: grid; gap: 8px; }
.queue-row { display: grid; grid-template-columns: 76px 1fr auto; gap: 14px; align-items: center; padding: 13px 14px; border: 1px solid #e5e1d8; border-radius: 11px; transition: border-color .2s, background .2s; }
.queue-row:hover { background: #fcfaf5; border-color: #d5c9b8; }
.queue-row.confirmed { opacity: .65; }
.queue-priority { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.queue-priority > span { color: #718079; font-size: 11px; }
.queue-product { display: flex; gap: 10px; align-items: baseline; }
.queue-product strong { color: #1c4d48; font-size: 14px; }
.queue-product span, .queue-facts, .queue-main p { color: #77837d; font-size: 11px; }
.queue-facts { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 5px; }
.queue-facts span:first-child { color: #ad5a3c; font-weight: 700; }
.queue-main p { margin-top: 5px; }
.confirm-button { min-width: 78px; }
.notice-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 30px 22px; border-top: 1px solid #eee9df; }
.filters { display: flex; gap: 8px; }
.filters :deep(.ant-select) { min-width: 130px; }
.modal-summary { padding: 10px 12px; margin-bottom: 12px; color: #6d7b74; background: #f7f4ed; border-radius: 8px; font-size: 12px; }
.modal-list { display: grid; gap: 8px; max-height: 65vh; overflow: auto; }
.modal-row { padding: 13px 14px; border: 1px solid #e5e1d8; border-radius: 10px; }
.modal-row-head { display: flex; gap: 9px; align-items: center; }
.modal-row-head strong { color: #1c4d48; }
.modal-row-head span { flex: 1; color: #77837d; font-size: 12px; }
.modal-row-facts { margin-top: 7px; color: #65756e; font-size: 12px; }
.modal-row p { margin-top: 6px; color: #8b5b45; font-size: 12px; }
@media (max-width: 760px) {
  .beer-calendar { padding: 12px; }
  .notice-header, .notice-intro, .notice-footer { padding-left: 18px; padding-right: 18px; }
  .notice-intro { align-items: flex-start; flex-direction: column; }
  .metrics-strip { grid-template-columns: repeat(2, 1fr); margin: 0 18px; }
  .metrics-strip > div:last-child { grid-column: span 2; }
  .pace-line, .queue-section { padding-left: 18px; padding-right: 18px; }
  .queue-row { grid-template-columns: 1fr auto; gap: 9px; }
  .queue-priority { grid-column: 1 / -1; flex-direction: row; align-items: center; }
  .queue-facts { gap: 6px 10px; }
  .notice-footer { align-items: flex-start; flex-direction: column; }
  .filters { width: 100%; }
  .filters :deep(.ant-select) { flex: 1; min-width: 0; }
}
</style>
