<script setup lang="ts">
import type { BeerDressCalendarOverview } from '#/api/kanban/types';

import { computed, onMounted, ref } from 'vue';
import { Button, Empty, Progress, Select, Spin, Table, Tag } from 'ant-design-vue';
import { fetchBeerDressCalendarOverview } from '#/api/kanban';

const loading = ref(false);
const data = ref<BeerDressCalendarOverview | null>(null);
const responsible = ref<string>();
const priority = ref<string>();

const operators = computed(() => [...new Set((data.value?.actions ?? []).map((row) => row.responsible))]);
const rows = computed(() => data.value?.actions ?? []);
const summary = computed(() => data.value?.summary ?? { actual: 0, expectedProgress: 0, inventoryAlerts: 0, p0: 0, p1: 0, priceActions: 0, progress: 0, target: 0 });
const topUrgent = computed(() => rows.value.find((row) => row.priority === 'P0') ?? rows.value[0]);
const remainingTarget = computed(() => data.value?.categories.reduce((sum, item) => sum + item.remaining, 0) ?? 0);
const operatorTargets = computed(() => data.value?.operatorTargets ?? []);
const topOperators = computed(() => [...operatorTargets.value].sort((a, b) => b.target - a.target).slice(0, 6));

async function load() {
  loading.value = true;
  try {
    data.value = await fetchBeerDressCalendarOverview({ responsible: responsible.value, priority: priority.value });
  } finally {
    loading.value = false;
  }
}

function pct(value: number | null | undefined) { return value === null || value === undefined ? '暂无目标' : `${(Number(value || 0) * 100).toFixed(1)}%`; }
function qty(value: number) { return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 }); }
function money(value: number) { return value ? `€${Number(value).toFixed(2)}` : '待录入'; }
function priorityColor(value: string) { return value === 'P0' ? 'red' : value === 'P1' ? 'orange' : 'green'; }

const columns = [
  { title: '负责人', dataIndex: 'responsible', width: 100 },
  { title: 'SPU', dataIndex: 'spu', width: 120 },
  { title: '品类', dataIndex: 'category', width: 100 },
  { title: '现价 / 建议价', key: 'price', width: 150 },
  { title: '进度 / 应达', key: 'progress', width: 170 },
  { title: '库存覆盖', key: 'inventory', width: 130 },
  { title: '今日动作', dataIndex: 'action', width: 130 },
  { title: '优先级', dataIndex: 'priority', width: 90 },
  { title: '状态', dataIndex: 'status', width: 90 },
];

onMounted(load);
</script>

<template>
  <div class="beer-calendar">
    <header class="topbar">
      <div>
        <h1>啤酒服运营预警中心</h1>
        <p>德国站 · 每日销售节奏与库存决策</p>
      </div>
      <div class="refresh">截至 {{ data?.asOfDate || '—' }} · 更新 {{ data?.lastRefreshedAt || '—' }}</div>
    </header>

    <Spin :spinning="loading">
      <template v-if="data">
        <section class="decision-head">
          <div><span class="section-label">TODAY'S OPERATING DECISION</span><h2>今天先处理什么？</h2><p class="lead">先处理节日节点，再处理售价、进度与库存异常。</p></div>
          <div class="filters">
            <Select v-model:value="responsible" allow-clear placeholder="全部负责人" style="width: 150px" :options="operators.map((x) => ({ label: x, value: x }))" @change="load" />
            <Select v-model:value="priority" allow-clear placeholder="全部优先级" style="width: 130px" :options="[{ label: 'P0 紧急', value: 'P0' }, { label: 'P1 关注', value: 'P1' }, { label: '正常', value: '正常' }]" @change="load" />
            <Button type="primary" @click="load">刷新数据</Button>
          </div>
        </section>

        <section class="hero-grid">
          <article class="festival panel"><div class="festival-top"><Tag color="volcano">P0 主战场</Tag><span>TOP1 · 目标集中</span></div><h3>{{ data.holiday.name }}</h3><p>{{ data.holiday.start }} — {{ data.holiday.end }}</p><strong>{{ data.holiday.daysToStart > 0 ? `${data.holiday.daysToStart} 天` : data.holiday.daysToStart === 0 ? '今天' : `${Math.abs(data.holiday.daysToStart)} 天` }}</strong><small>距开幕</small><div class="festival-action">当前动作：{{ topUrgent?.action || '稳价观察' }} · 优先清理 P0 事项</div></article>
          <article class="phase panel"><div class="panel-kicker">当前销售阶段</div><h3>{{ data.phase.name }} · {{ (data.phase.progress * 100).toFixed(1) }}%</h3><p>{{ data.phase.start }} — {{ data.phase.end }} · 距阶段结束 {{ data.phase.daysToEnd }} 天</p><Progress :percent="data.phase.progress * 100" :show-info="false" stroke-color="#356ae6" /><div class="phase-meta"><span>阶段应达 {{ pct(data.phase.expectedRate) }}</span><span>目标终点 {{ pct(data.phase.toRate) }}</span></div></article>
        </section>

        <section class="milestone-grid"><article class="milestone panel"><span>坎斯塔特啤酒节</span><strong>{{ Math.max(0, Math.ceil((new Date('2026-09-25').getTime() - new Date(data.asOfDate).getTime()) / 86400000)) }} 天</strong><small>9/25 开幕</small></article><article class="milestone panel"><span>不莱梅承接量</span><strong>{{ qty(remainingTarget) }} 件</strong><small>独立增量 · 不与主节日重复累计</small></article></section>

        <section class="pace panel"><div class="section-row"><div><div class="panel-kicker">CATEGORY RHYTHM</div><h2>还能卖多少 × 每天要卖多少</h2></div><span>距销售周期结束 {{ data.phase.daysToEnd }} 天 · 计划基准</span></div><div class="category-cards"><div v-for="item in data.categories" :key="item.name" class="category-card"><div class="category-head"><b>{{ item.name }}</b><span>季节目标 {{ qty(item.target) }}</span></div><Progress :percent="Math.min(item.progress * 100, 100)" :show-info="false" stroke-color="#356ae6" /><div class="category-stats"><span>计划剩余<strong>{{ qty(item.remaining) }}</strong></span><span>当前进度<strong>{{ pct(item.progress) }}</strong></span><span>日均需求<strong>{{ data.phase.daysToEnd ? qty(item.remaining / data.phase.daysToEnd) : '—' }}</strong></span></div></div></div><div class="notice">ⓘ 不莱梅销量已包含在清仓回款期，不能与慕尼黑、坎斯塔特重复相加；目标来源为运营啤酒服 SPU 月目标汇总。</div></section>

        <section class="insight-grid"><article class="operator-panel panel"><div class="section-row"><div><div class="panel-kicker">OWNER TARGETS</div><h2>运营目标分布</h2></div><span>{{ operatorTargets.length }} 位负责人</span></div><div v-for="item in topOperators" :key="item.responsible" class="operator-row"><span>{{ item.responsible }}</span><Progress :percent="summary.target ? item.target / summary.target * 100 : 0" :show-info="false" stroke-color="#4ecdc4" /><b>{{ qty(item.target) }}</b><small>{{ qty(item.targetSales) }} USD</small></div></article><article class="calendar-panel panel"><div class="section-row"><div><div class="panel-kicker">SEASON MAP</div><h2>啤酒服销售日历</h2></div><span>阶段切换提醒</span></div><div class="timeline"><div v-for="item in (data.calendar || [])" :key="item.name" class="timeline-item" :class="{ active: item.active }"><i></i><div><b>{{ item.name }}</b><small>{{ item.start.slice(5) }} — {{ item.end.slice(5) }}</small></div><span>{{ pct(item.toRate) }}</span></div></div></article></section>

        <div class="notice">口径提示：不莱梅与慕尼黑 / 坎斯塔特活动不重复累计；目标来自运营啤酒服 SPU 月目标汇总。</div>

        <section class="kpis"><div class="kpi p0"><span>P0 紧急事项</span><strong>{{ summary.p0 }}</strong><small>需要今天处理</small></div><div class="kpi"><span>需要调价</span><strong>{{ summary.priceActions }}</strong><small>提价 {{ rows.filter((row) => row.action.includes('提价')).length }} · 降价 {{ rows.filter((row) => row.action.includes('降价')).length }}</small></div><div class="kpi"><span>库存异常</span><strong>{{ summary.inventoryAlerts }}</strong><small>覆盖不足 / 超储识别</small></div><div class="kpi progress-kpi"><span>应达销售进度</span><strong>{{ pct(summary.progress) }}</strong><Progress :percent="summary.progress * 100" :show-info="false" stroke-color="#f6bd60" /><small>目标 {{ qty(summary.target) }} · 实际 {{ qty(summary.actual) }}</small></div></section>

        <section class="queue panel"><div class="queue-title"><div><div class="panel-kicker">ACTION QUEUE</div><h2>运营行动队列</h2></div><span>{{ rows.length }} 条事项</span></div><Table :columns="columns" :data-source="rows" :pagination="{ pageSize: 12 }" row-key="spu" size="middle"><template #bodyCell="{ column, record }"><template v-if="column.key === 'price'"><span>{{ money(record.currentPrice) }}</span><em> → {{ money(record.suggestedPrice) }}</em></template><template v-else-if="column.key === 'progress'"><span>{{ pct(record.progress) }} / {{ pct(record.expectedProgress) }}</span><small v-if="record.progressGap !== null" class="gap" :class="record.progressGap < 0 ? 'negative' : 'positive'">{{ record.progressGap >= 0 ? '+' : '' }}{{ pct(record.progressGap) }}</small><small v-if="record.target <= 0">近30天 {{ qty(record.recent30) }} 件 · 目标待补录</small></template><template v-else-if="column.key === 'inventory'"><span>{{ qty(record.inventory) }} 件总可用</span><small>{{ qty(record.inventorySellable || 0) }} 可售 · {{ qty(record.inventoryInbound || 0) }} 在途 · {{ record.inventoryDays ? `${record.inventoryDays.toFixed(1)} 天覆盖` : '缺少销量基准' }}</small></template><template v-else-if="column.dataIndex === 'priority'"><Tag :color="priorityColor(record.priority)">{{ record.priority }}</Tag></template><template v-else-if="column.dataIndex === 'action'"><strong :class="record.priority === 'P0' ? 'urgent' : ''">{{ record.action }}</strong></template></template></Table><Empty v-if="!rows.length" description="当前没有可执行事项" /></section>
      </template>
      <Empty v-else description="暂无啤酒服数据，请检查目标和每日表现同步状态" />
    </Spin>
  </div>
</template>

<style scoped>
.beer-calendar { min-height: 100%; padding: 24px 28px 48px; background: #f5f1e8; color: #162a2b; }
.topbar { display: flex; justify-content: space-between; align-items: end; padding: 24px 28px; margin: -24px -28px 26px; background: #132d2e; color: #f7f3ea; }
h1, h2, h3, p { margin: 0; } h1 { font-size: 26px; letter-spacing: -.03em; } h2 { font-size: 24px; letter-spacing: -.03em; } h3 { margin-top: 8px; font-size: 20px; } p { color: #6f7f7a; font-size: 13px; } .topbar p { color: #b8c9be; margin-top: 5px; } .refresh { font-size: 12px; color: #b8c9be; } .lead { margin-top:6px; font-size:13px; }
.decision-head, .queue-title { display:flex; justify-content:space-between; align-items:end; gap: 16px; } .section-label, .panel-kicker { color: #ad5d37; font-size: 11px; font-weight: 700; letter-spacing: .12em; } .section-label { display:block; margin-bottom: 7px; } .filters { display:flex; gap: 10px; }
.hero-grid { display:grid; grid-template-columns: 1.05fr 1fr; gap: 14px; margin-top: 18px; } .panel { background: #fffdf8; border: 1px solid #e5ded1; border-radius: 14px; padding: 20px; box-shadow: 0 6px 22px rgba(39,57,51,.06); } .festival { background:#fff5df; border-color:#e7bf69; position:relative; min-height: 178px; } .festival-top,.section-row,.category-head { display:flex; justify-content:space-between; align-items:center; gap: 10px; } .festival-top > span { color:#8f6a2d; font-size:12px; } .festival strong { display:inline-block; margin-top: 17px; font-size: 42px; line-height:1; color:#9a510d; } .festival > small { color:#9a510d; margin-left: 5px; } .festival-action { border-top: 1px solid #ead7ab; margin-top: 16px; padding-top: 12px; color:#705d3d; font-size: 13px; } .phase-meta { display:flex; justify-content:space-between; margin-top: 9px; font-size: 12px; color:#6f7f7a; } .milestone-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:14px 0; } .milestone { padding:16px 20px; } .milestone span,.milestone small { display:block; color:#6f7f7a; font-size:12px; } .milestone strong { display:block; margin:5px 0; font-size:26px; font-weight:600; }
.pace { margin-bottom:14px; } .category-cards { display:grid; grid-template-columns: repeat(2,1fr); gap:12px; margin-top:16px; } .category-card { background:#f3f5f9; border-radius:10px; padding:14px; } .category-head { margin-bottom:10px; } .category-head b { font-size:15px; } .category-head span { color:#6f7f7a; font-size:12px; } .category-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:10px; } .category-stats span { color:#6f7f7a; font-size:11px; } .category-stats strong { display:block; margin-top:3px; color:#243c51; font-size:15px; } .notice { margin-top: 14px; padding: 12px 16px; color:#735e38; background:#fbf0d3; border-radius: 9px; font-size: 13px; }
.insight-grid { display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-bottom:18px; } .section-row > span { color:#7c8988; font-size:12px; } .operator-row { display:grid; grid-template-columns:75px 1fr 65px; gap:9px; align-items:center; margin-top:13px; } .operator-row b { text-align:right; font-size:12px; } .operator-row small { grid-column:2 / span 2; color:#8a9691; font-size:11px; margin-top:-6px; } .timeline { position:relative; margin-top:14px; padding-left:8px; } .timeline:before { content:""; position:absolute; left:13px; top:6px; bottom:6px; width:1px; background:#d8dfd9; } .timeline-item { display:grid; grid-template-columns:20px 1fr auto; align-items:center; gap:9px; min-height:35px; color:#72807a; } .timeline-item i { z-index:1; width:10px; height:10px; border:2px solid #b8c5bc; background:#fffdf8; border-radius:50%; } .timeline-item.active { color:#a65335; font-weight:600; } .timeline-item.active i { border-color:#a65335; background:#f4c28c; } .timeline-item small { display:block; color:#8a9691; font-size:10px; font-weight:400; } .timeline-item > span { font-size:11px; }
.kpis { display:grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 18px; } .kpi { padding:18px 20px; background:#132d2e; color:#f7f3ea; border-radius: 12px; } .kpi span,.kpi small { display:block; color:#b8c9be; font-size:12px; } .kpi strong { display:block; margin: 8px 0 2px; font-size: 30px; } .kpi.p0 { background:#8f4035; } .progress-kpi { background:#315d58; }
.queue-title { margin-bottom:16px; } .queue-title > span { color:#6f7f7a; font-size: 13px; } .queue :deep(.ant-table) { background:transparent; } em { color:#ad5d37; font-style:normal; margin-left:5px; } .queue small { display:block; color:#82918b; font-size:11px; margin-top:3px; } .gap.negative { color:#b34b3d; } .gap.positive { color:#39766c; } .urgent { color:#b34b3d; }
@media (max-width: 1000px) { .hero-grid,.insight-grid { grid-template-columns:1fr; } .kpis { grid-template-columns: repeat(2,1fr); } .topbar, .decision-head { align-items:flex-start; flex-direction:column; } } @media (max-width: 620px) { .beer-calendar { padding:16px; } .topbar { margin:-16px -16px 20px; padding:20px 16px; } .filters { flex-wrap:wrap; } .category-cards { grid-template-columns:1fr; } .kpis { grid-template-columns:1fr 1fr; gap:8px; } .kpi { padding:14px; } .panel { padding:16px; } .decision-head h2 { font-size:22px; } }
</style>
