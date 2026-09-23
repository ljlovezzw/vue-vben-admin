<script setup lang="ts">
import type {
  ChristmasOverview,
  ChristmasRow,
  ChristmasStock,
} from '#/api/kanban/christmas-calendar';

import { computed, onActivated, onMounted, ref, watch } from 'vue';

import { message } from 'ant-design-vue';

import {
  confirmChristmasAction,
  fetchChristmasOverview,
} from '#/api/kanban/christmas-calendar';

defineOptions({ name: 'KanbanChristmasCalendar' });
const data = ref<ChristmasOverview | null>(null);
const loading = ref(false);
const error = ref('');
const department = ref('');
const site = ref('');
const owner = ref('');
const search = ref('');
const category = ref('');
const groupBy = ref<'category' | 'owner' | 'site'>('site');
const groupPage = ref(1);
const queueKind = ref('action');
const phaseIndex = ref(-1);
const dialog = ref<HTMLDialogElement | null>(null);
const dialogMode = ref<
  'browse' | 'calendar' | 'catalog' | 'detail' | 'method' | 'strategy'
>('browse');
const detailId = ref('');
const browseKind = ref('all');
const browseSearch = ref('');
const browsePage = ref(1);
const confirming = ref('');
const defaultKey = '__my_scope__';
let appliedDefault = false;
const defaults = computed(() => data.value?.viewer.defaultResponsibles ?? null);
const allRows = computed(() => data.value?.rows ?? []);
const departments = computed(() =>
  [...new Set(allRows.value.map((r) => r.department))].toSorted(),
);
const owners = computed(() =>
  [
    ...new Set(
      allRows.value
        .filter(
          (r) =>
            (!department.value || r.department === department.value) &&
            (!site.value || r.site === site.value),
        )
        .map((r) => r.owner),
    ),
  ].toSorted(),
);
const rows = computed(() =>
  allRows.value.filter(
    (r) =>
      (!department.value || r.department === department.value) &&
      (!site.value || r.site === site.value) &&
      (!owner.value ||
        (owner.value === defaultKey
          ? defaults.value?.includes(r.owner)
          : r.owner === owner.value)) &&
      (!category.value || r.category === category.value) &&
      (!search.value || r.spu.includes(search.value.trim().toUpperCase())),
  ),
);
const stockMap = computed(
  () => new Map((data.value?.inventoryRecords ?? []).map((r) => [r.id, r])),
);
const fmt = (n: null | number | undefined) =>
  n === null || n === undefined
    ? '待核对'
    : n.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
const rate = (n: null | number | undefined) =>
  n === null || n === undefined ? '—' : `${(n * 100).toFixed(1)}%`;
const short = (s: string) =>
  `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
const siteName = (code: string) => data.value?.sites[code] ?? code;
function stockFor(list: ChristmasRow[]): ChristmasStock[] {
  const ids = new Set(list.flatMap((r) => r.inventory.ids));
  return [...ids]
    .map((id) => stockMap.value.get(id))
    .filter((record): record is ChristmasStock => record !== undefined);
}
function summary(list: ChristmasRow[]) {
  const valid = list.filter((r) => r.target !== null);
  const comparable = list.filter(
    (r) => r.comparable && r.target !== null && r.actual !== null,
  );
  const stock = stockFor(list);
  const target = valid.reduce((n, r) => n + (r.target ?? 0), 0);
  const comparableTarget = comparable.reduce((n, r) => n + (r.target ?? 0), 0);
  const actual = comparable.reduce((n, r) => n + (r.actual ?? 0), 0);
  return {
    target: valid.length > 0 ? target : null,
    matched: valid.length,
    reference: valid.filter((r) => r.targetMode === 'category').length,
    actual: comparable.length > 0 ? actual : null,
    done: comparableTarget > 0 ? actual / comparableTarget : null,
    comparable: comparable.length,
    available:
      stock.length > 0 && stock.every((r) => r.available !== null)
        ? stock.reduce((n, r) => n + (r.available ?? 0), 0)
        : null,
    shared: stock.some((r) => r.sites.length > 1),
    alerts: list.filter((r) => r.kind === 'stock').length,
  };
}
const totals = computed(() => summary(rows.value));
const groups = computed(() => {
  const map = new Map<string, ChristmasRow[]>();
  for (const row of rows.value)
    map.set(row[groupBy.value], [...(map.get(row[groupBy.value]) ?? []), row]);
  return [...map.entries()]
    .map(([name, list]) => ({ name, list, total: summary(list) }))
    .toSorted(
      (a, b) =>
        (b.total.target ?? 0) - (a.total.target ?? 0) ||
        a.name.localeCompare(b.name),
    );
});
const groupPages = computed(() =>
  Math.max(1, Math.ceil(groups.value.length / 6)),
);
const visibleGroups = computed(() =>
  groups.value.slice((groupPage.value - 1) * 6, groupPage.value * 6),
);
const currentIndex = computed(
  () => data.value?.phases.findIndex((p) => p.state === 'current') ?? -1,
);
const phase = computed(
  () =>
    data.value?.phases[
      phaseIndex.value < 0 ? Math.max(0, currentIndex.value) : phaseIndex.value
    ],
);
const countdown = computed(() =>
  data.value
    ? Math.round(
        (Date.parse('2026-12-25T00:00:00Z') -
          Date.parse(`${data.value.asOf}T00:00:00Z`)) /
          86_400_000,
      )
    : 0,
);
function queueRows(kind = queueKind.value) {
  return rows.value
    .filter((r) =>
      kind === 'confirmed'
        ? Boolean(r.confirmedAt)
        : !r.confirmedAt &&
          (kind === 'all' ||
            (kind === 'action'
              ? ['prepare', 'stock'].includes(r.kind)
              : r.kind === kind)),
    )
    .toSorted(
      (a, b) =>
        a.priority - b.priority ||
        (b.target ?? 0) - (a.target ?? 0) ||
        a.id.localeCompare(b.id),
    );
}
const queue = computed(() => queueRows());
const browsing = computed(() =>
  (browseKind.value === 'all'
    ? rows.value
    : queueRows(browseKind.value)
  ).filter((r) =>
    `${r.spu} ${r.owner} ${r.site} ${r.category}`
      .toLowerCase()
      .includes(browseSearch.value.trim().toLowerCase()),
  ),
);
const browsePages = computed(() =>
  Math.max(1, Math.ceil(browsing.value.length / 10)),
);
const visibleBrowse = computed(() =>
  browsing.value.slice((browsePage.value - 1) * 10, browsePage.value * 10),
);
const detail = computed(() =>
  allRows.value.find((r) => r.id === detailId.value),
);
const detailStock = computed(() =>
  detail.value ? stockFor([detail.value]) : [],
);
const title = computed(
  () =>
    ({
      browse: '商品清单',
      calendar: '2026 圣诞运营完整日历',
      catalog: '圣诞款候选 SPU',
      detail: detail.value
        ? `${detail.value.spu} · ${siteName(detail.value.site)}`
        : '商品明细',
      method: '数据来源与统计口径',
      strategy: '按站点核对节前送达',
    })[dialogMode.value],
);

async function load() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    data.value = await fetchChristmasOverview();
    if (!appliedDefault) {
      owner.value =
        data.value.viewer.defaultResponsibles === null ? '' : defaultKey;
      appliedDefault = true;
    }
    if (!departments.value.includes(department.value)) department.value = '';
    if (!data.value.sites[site.value]) site.value = '';
    if (
      owner.value &&
      owner.value !== defaultKey &&
      !owners.value.includes(owner.value)
    )
      owner.value = defaults.value === null ? '' : defaultKey;
  } catch {
    error.value = data.value
      ? '刷新失败，仍显示上次读取的数据。请重试。'
      : '圣诞节运营数据读取失败，请重试。';
  } finally {
    loading.value = false;
  }
}
async function confirm(row: ChristmasRow) {
  if (confirming.value || row.confirmedAt || row.canConfirm === false) return;
  confirming.value = row.actionKey;
  try {
    Object.assign(row, await confirmChristmasAction(row.actionKey));
    message.success('已保存处理确认');
  } catch {
    message.error('确认未保存，待办可能已更新。请刷新后重试。');
  } finally {
    confirming.value = '';
  }
}
function reset() {
  department.value = '';
  site.value = '';
  owner.value = defaults.value === null ? '' : defaultKey;
  search.value = '';
  category.value = '';
}
function drill(name: string) {
  if (groupBy.value === 'site') site.value = name;
  else if (groupBy.value === 'owner') owner.value = name;
  else category.value = name;
}
function open(mode: typeof dialogMode.value) {
  dialogMode.value = mode;
  dialog.value?.showModal();
}
function openBrowse(kind: string) {
  browseKind.value = kind;
  browseSearch.value = '';
  browsePage.value = 1;
  open('browse');
}
function openDetail(row: ChristmasRow) {
  detailId.value = row.id;
  open('detail');
}
function stockText(row: ChristmasRow, key: 'available' | 'sellable' | 'total') {
  return row.inventory.rows && !row.inventory.missingInventory
    ? fmt(row.inventory[key])
    : '待核对';
}
watch([department, site], () => {
  if (
    owner.value &&
    owner.value !== defaultKey &&
    !owners.value.includes(owner.value)
  )
    owner.value = defaults.value === null ? '' : defaultKey;
});
watch([department, site, owner, category, groupBy, search], () => {
  groupPage.value = 1;
  browsePage.value = 1;
});
watch([browseKind, browseSearch], () => {
  browsePage.value = 1;
});
onMounted(load);
onActivated(() => {
  if (data.value) void load();
});
</script>

<template>
  <div class="christmas-page">
    <main class="app" :aria-busy="loading">
      <header class="header">
        <div class="title">
          <svg
            class="symbol"
            viewBox="0 0 40 40"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            aria-hidden="true"
          >
            <path d="M20 3 9 17h6L7 28h10v8h6v-8h10l-8-11h6L20 3Z" />
            <path d="m13 20 14 5M15 12l11 3" />
          </svg>
          <div>
            <h1>圣诞节运营日历</h1>
            <p>按阶段安排广告与库存，按站点核对节前送达</p>
          </div>
        </div>
        <button class="link" :disabled="loading" @click="load">
          {{ loading ? '读取中…' : '刷新数据' }}
        </button>
      </header>
      <div v-if="error" class="error" role="alert">
        {{ error }} <button class="link" @click="load">重试</button>
      </div>
      <div v-if="!data" class="loading">
        {{ loading ? '正在读取圣诞节运营数据…' : '暂无可显示的数据。' }}
      </div>
      <template v-else>
        <div class="filters">
          <label>部门<select v-model="department">
              <option value="">全部部门</option>
              <option v-for="x in departments" :key="x">{{ x }}</option>
            </select></label><label>站点<select v-model="site">
              <option value="">全部站点</option>
              <option v-for="(x, k) in data.sites" :key="k" :value="k">
                {{ x }}
              </option>
            </select></label><label>负责人<select v-model="owner">
              <option v-if="defaults !== null" :value="defaultKey">
                {{ data.viewer.defaultLabel }}
              </option>
              <option value="">全部负责人</option>
              <option v-for="x in owners" :key="x">{{ x }}</option>
            </select></label><label class="search">查找商品<input
              v-model="search"
              placeholder="输入 SPU"
              autocomplete="off"
/></label><button class="link" @click="reset">恢复默认</button>
        </div>
        <div class="scope-line">
          <span>飞书范围 <strong>{{ data.sourceSpus }} 个 SPU</strong> · 当前筛选
            {{ new Set(rows.map((r) => r.spu)).size }} 个 SPU /
            {{ rows.length }} 个站点组合</span><button class="link" @click="open('catalog')">查看候选 SPU</button>
        </div>
        <section class="stage-section">
          <div class="section-head">
            <h2>运营阶段</h2>
            <div class="section-tools">
              <span class="small muted">{{
                phaseIndex < 0 ? `${data.asOf} 当前阶段` : '正在预览其他阶段'
              }}</span><button
                v-if="phaseIndex >= 0"
                class="link"
                @click="phaseIndex = -1"
              >
                回到当前阶段
</button><button class="link" @click="open('calendar')">
                查看完整日历
              </button>
            </div>
          </div>
          <div
            class="stage-scroll"
            tabindex="0"
            aria-label="运营阶段，可横向滚动查看"
          >
            <ol class="stages">
              <li v-for="(p, i) in data.phases" :key="p.start">
                <button
                  class="stage"
                  :class="{ past: p.state === 'done' }"
                  :aria-pressed="
                    (phaseIndex < 0 ? currentIndex : phaseIndex) === i
                  "
                  @click="phaseIndex = i"
                >
                  <span class="step">{{ i + 1 }}</span><strong>{{ p.name }}</strong><small>{{ short(p.start) }}—{{ short(p.end) }}</small>
                </button>
              </li>
            </ol>
          </div>
          <div v-if="phase" class="elapsed">
            <span>{{
              phaseIndex < 0 ? '本阶段日历时间' : `截至 ${data.asOf}`
            }}</span>
            <div class="bar">
              <span :style="{ width: `${phase.progress * 100}%` }"></span>
            </div>
            <span>{{ phase.elapsed }}/{{ phase.days }} 天 ·
              仅表示时间经过，不代表任务完成</span>
          </div>
        </section>
        <section v-if="phase">
          <div class="stage-summary">
            <div>
              <h2>
                {{ phaseIndex < 0 ? '当前：' : '预览：' }}{{ phase.name }}
              </h2>
              <p>
                {{ short(phase.start) }}—{{ short(phase.end) }} ·
                {{ phase.condition }}
              </p>
            </div>
            <div class="date-panel">
              <span>{{ countdown >= 0 ? '距 12 月 25 日' : '圣诞节已过' }}</span><strong>{{ Math.abs(countdown) }} 天</strong><span>{{ data.asOf }}</span>
            </div>
          </div>
          <div class="tasks">
            <div class="task">
              <strong>商品</strong>
              <p>{{ phase.product }}</p>
            </div>
            <div class="task">
              <strong>广告</strong>
              <p>{{ phase.ads }}</p>
            </div>
            <div class="task">
              <strong>库存</strong>
              <p>{{ phase.stock }}</p>
            </div>
          </div>
          <div class="context">
            <span>2025 历史提醒：12/8—10 为峰值区，12/15—18
              仍处高位。各站点按节前送达承诺收缩。</span><button class="link" @click="open('strategy')">
              查看站点配送窗口
            </button>
          </div>
        </section>
        <div class="metrics" aria-label="经营数据摘要">
          <div class="metric">
            <span>10—12 月目标</span><strong>{{ fmt(totals.target) }}</strong><small>已匹配 {{ totals.matched }}/{{ rows.length }} · 含
              {{ totals.reference }} 个新品参考</small>
          </div>
          <div class="metric">
            <span>对应实际销量</span><strong>{{
              data.asOf < '2026-10-01' ? '未开始' : fmt(totals.actual)
            }}</strong><small>截至 {{ data.salesThrough ?? '待同步' }}</small>
          </div>
          <div class="metric">
            <span>目标完成率</span><strong>{{ rate(totals.done) }}</strong><small>{{
              data.asOf < '2026-10-01'
                ? '销售周期尚未开始'
                : `${totals.comparable} 个组合可比`
            }}</small>
          </div>
          <div class="metric">
            <span>FBA 可用库存</span><strong>{{ fmt(totals.available) }}</strong><small>{{
              totals.shared ? '物理库存去重 · 含共享仓' : '物理库存去重'
            }}</small>
          </div>
          <div class="metric">
            <span>库存提醒</span><strong class="risk">{{ totals.alerts }} 项</strong><small>展开待办查看证据</small>
          </div>
        </div>
        <p class="coverage">
          真实数据读取：{{ data.fetchedAt.replace('T', ' ') }}。{{
            totals.reference
          }}
          个新品按当前运营、同站点二级分类月均目标参考；目标缺失
          {{ rows.length - totals.matched }} 个组合不按 0 计算。近 7
          天销量仅用于核对库存。
        </p>
        <section class="section">
          <div class="section-head">
            <h2>完成进度</h2>
            <div class="segmented" aria-label="进度分组">
              <button
                v-for="(label, key) in {
                  site: '站点',
                  category: '分类',
                  owner: '负责人',
                }"
                :key="key"
                :aria-pressed="groupBy === key"
                @click="groupBy = key as typeof groupBy"
              >
                {{ label }}
              </button>
            </div>
          </div>
          <div v-if="category" class="chip">
            分类：{{ category }}
            <button aria-label="清除分类筛选" @click="category = ''">×</button>
          </div>
          <div class="groups">
            <button
              v-for="g in visibleGroups"
              :key="g.name"
              class="group"
              @click="drill(g.name)"
            >
              <div class="group-top">
                <strong>{{
                  groupBy === 'site' ? siteName(g.name) : g.name
                }}</strong><small>{{
                  data.asOf < '2026-10-01' ? '周期未开始' : rate(g.total.done)
                }}</small>
              </div>
              <div class="group-values">
                <span>{{ g.total.matched < g.list.length ? '已匹配目标' : '目标' }}
                  {{ fmt(g.total.target) }} 件</span><span>已匹配 {{ g.total.matched }}/{{ g.list.length
                  }}{{
                    g.total.reference ? ` · 新品参考 ${g.total.reference}` : ''
                  }}</span>
              </div>
              <div class="bar">
                <span
                  :style="{
                    width: `${Math.max(0, Math.min(100, (g.total.done ?? 0) * 100))}%`,
                  }"
                ></span>
              </div>
            </button>
            <div v-if="groups.length === 0" class="empty">
              当前筛选没有商品，请调整筛选条件。
            </div>
          </div>
          <div class="pager">
            <span>点击分组查看商品；目标含新品分类参考，未匹配显示待核对。</span>
            <div class="pager-buttons">
              <button :disabled="groupPage === 1" @click="groupPage--">
                上一页
</button><span>{{ groupPage }} / {{ groupPages }}</span><button
                :disabled="groupPage === groupPages"
                @click="groupPage++"
              >
                下一页
              </button>
            </div>
          </div>
        </section>
        <section class="section">
          <div class="section-head">
            <h2>现在要做什么</h2>
            <div class="queue-tools">
              <span class="muted">{{ queue.length }} 项 · 显示前
                {{ Math.min(6, queue.length) }} 项</span><select v-model="queueKind" aria-label="待办类型">
                <option value="action">优先待办</option>
                <option value="stock">库存提醒</option>
                <option value="prepare">准备工作</option>
                <option value="data">资料核对</option>
                <option value="confirmed">已确认</option>
              </select>
            </div>
          </div>
          <div class="queue">
            <article
              v-for="r in queue.slice(0, 6)"
              :key="r.id"
              class="queue-row"
            >
              <div>
                <span
                  class="badge"
                  :class="{
                    quiet: r.kind === 'prepare',
                    gray: r.kind === 'data',
                  }"
                  >{{
                    r.kind === 'stock'
                      ? '关注'
                      : r.kind === 'prepare'
                        ? '准备'
                        : '待核对'
                  }}</span>
                <div class="owner">{{ r.owner }}</div>
              </div>
              <div>
                <div class="product-line">
                  <strong>{{ r.spu }}</strong><span>{{ siteName(r.site) }} · {{ r.category }}</span>
                </div>
                <div class="facts">
                  <b>{{ r.action }}</b><span>可用 {{ stockText(r, 'available') }} · 可售
                    {{ stockText(r, 'sellable') }}</span><span>近 7 天
                    {{
                      r.sevenComplete ? `${fmt(r.recent7)} 件` : '待核对'
                    }}</span>
                </div>
              </div>
              <div class="row-buttons">
                <button class="link" @click="openDetail(r)">明细</button><button
                  class="primary"
                  :disabled="Boolean(confirming) || r.canConfirm === false"
                  @click="confirm(r)"
                >
                  {{
                    r.canConfirm === false
                      ? '仅查看'
                      : confirming === r.actionKey
                        ? '保存中…'
                        : '确认处理'
                  }}
                </button>
              </div>
            </article>
            <div v-if="queue.length === 0" class="empty">
              当前筛选没有这类待办，可切换类型或恢复默认。
            </div>
          </div>
          <div class="section-foot">
            <span><button class="link" @click="openBrowse('all')">
                查看全部商品（{{ rows.length }}）
              </button>
              <button class="link" @click="openBrowse(queueKind)">
                查看此类全部（{{ queue.length }}）
              </button></span><button class="link" @click="openBrowse('data')">
              资料待核对（{{ queueRows('data').length }}）
            </button>
          </div>
        </section>
        <footer class="source-note">
          <p>
            销量截至 {{ data.salesThrough ?? '待同步' }} ·
            {{ data.fetchedAt.replace('T', ' ') }}
            读取。处理确认保存到看板，仅表示已跟进。
          </p>
          <button class="link" @click="open('method')">
            数据来源与统计口径
          </button>
        </footer>
      </template>
    </main>
    <dialog
      ref="dialog"
      class="christmas-dialog"
      aria-labelledby="christmas-dialog-title"
      @cancel="dialog?.close()"
    >
      <div class="dialog-head">
        <h2 id="christmas-dialog-title">{{ title }}</h2>
        <button @click="dialog?.close()">关闭</button>
      </div>
      <div class="dialog-content">
        <template v-if="dialogMode === 'browse'">
          <div class="browse-search">
            <input
              v-model="browseSearch"
              placeholder="输入 SPU 或负责人"
              aria-label="搜索商品清单"
            /><span class="small muted">经营快照 {{ data?.asOf }}</span>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SPU / 分类</th>
                  <th>站点 / 负责人</th>
                  <th>10—12 月目标</th>
                  <th>FBA 可用 / 可售</th>
                  <th>近 7 天销量</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in visibleBrowse" :key="r.id">
                  <td>
                    <strong>{{ r.spu }}</strong><small>{{ r.category }}</small>
                  </td>
                  <td>
                    {{ siteName(r.site) }}<small>{{ r.owner }}</small>
                  </td>
                  <td class="num">
                    {{ fmt(r.target)
                    }}<small v-if="r.targetMode === 'category'">新品分类参考</small>
                  </td>
                  <td class="num">
                    {{ stockText(r, 'available') }} /
                    {{ stockText(r, 'sellable') }}
                  </td>
                  <td class="num">
                    {{ r.sevenComplete ? fmt(r.recent7) : '待核对' }}
                  </td>
                  <td>
                    <button class="link" @click="openDetail(r)">明细</button>
                  </td>
                </tr>
                <tr v-if="browsing.length === 0">
                  <td colspan="6">没有匹配的商品，请修改搜索词。</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pager">
            <span>{{ browsing.length }} 个组合 · 每页 10 条</span>
            <div class="pager-buttons">
              <button :disabled="browsePage === 1" @click="browsePage--">
                上一页
</button><span>{{ browsePage }} / {{ browsePages }}</span><button
                :disabled="browsePage === browsePages"
                @click="browsePage++"
              >
                下一页
              </button>
            </div>
          </div>
        </template>
        <template v-else-if="dialogMode === 'detail' && detail">
          <button class="link" @click="dialogMode = 'browse'">
            返回商品清单
          </button>
          <p>
            {{ detail.category }} · {{ detail.department }} · 当前负责人
            {{ detail.owner }}
          </p>
          <div class="detail-grid">
            <div>
              <span>FBA 总库存</span><strong>{{ stockText(detail, 'total') }}</strong>
            </div>
            <div>
              <span>FBA 可用</span><strong>{{ stockText(detail, 'available') }}</strong>
            </div>
            <div>
              <span>FBA 可售</span><strong>{{ stockText(detail, 'sellable') }}</strong>
            </div>
            <div>
              <span>近 7 天销量</span><strong>{{
                detail.sevenComplete ? fmt(detail.recent7) : '待核对'
              }}</strong>
            </div>
          </div>
          <div class="site-info">
            <strong>{{ detail.action }}</strong><br />{{ detail.reason }}
          </div>
          <div class="detail-block">
            <h3>销售目标与备货计划</h3>
            <p>
              10—12 月{{
                detail.targetMode === 'category'
                  ? '新品分类参考目标'
                  : '销售目标'
              }}
              {{ fmt(detail.target) }} 件；完成率 {{ rate(detail.done) }}。
            </p>
            <p v-if="detail.targetMode === 'category'">
              按当前运营 {{ detail.owner }}、本站点、二级分类
              {{ detail.matchedCategory }}
              匹配占位目标，逐月取单款均值；属于参考值。
            </p>
            <p v-if="detail.targetIssue">{{ detail.targetIssue }}</p>
            <p>
              10 月 {{ fmt(detail.monthly['10']) }} · 11 月
              {{ fmt(detail.monthly['11']) }} · 12 月
              {{ fmt(detail.monthly['12']) }} 件
            </p>
            <p>
              飞书该站点首单计划：{{
                detail.planUnits == null
                  ? '未填写'
                  : `${fmt(detail.planUnits)} 件`
              }}。计划量不代表销售目标或 FBA 可售。
            </p>
          </div>
          <details>
            <summary>库存来源与更新时间</summary>
            <p>
              更新
              {{
                detail.inventory.refreshed ?? '待核对'
              }}；共享仓不代表本站独占。
            </p>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>仓库 / 适用站点</th>
                    <th>总库存</th>
                    <th>可用</th>
                    <th>可售</th>
                    <th>标发在途</th>
                    <th>实际在途</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="x in detailStock" :key="x.id">
                    <td>
                      {{ x.warehouse }}<small>{{ x.sites.join(' / ') }}</small>
                    </td>
                    <td class="num">{{ fmt(x.total) }}</td>
                    <td class="num">{{ fmt(x.available) }}</td>
                    <td class="num">{{ fmt(x.sellable) }}</td>
                    <td class="num">{{ fmt(x.shipped) }}</td>
                    <td class="num">{{ fmt(x.actualTransit) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary>负责人、销量与目标来源</summary>
            <p>
              当前负责人按
              SPU＋站点取商品主数据；目标表旧姓名不覆盖当前负责人。近七天销量截至
              {{ data?.salesThrough ?? '待同步' }}。
            </p>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>店铺</th>
                    <th>父 ASIN</th>
                    <th>负责人</th>
                    <th>站点生命周期</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(m, i) in detail.masters" :key="i">
                    <td>{{ m.shop }}</td>
                    <td>{{ m.parent }}</td>
                    <td>{{ m.owner }}</td>
                    <td>{{ m.life }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              目标来源：{{
                [
                  ...new Set(
                    detail.targetSources.map(
                      (t) => `${t.source_file} / ${t.source_sheet}`,
                    ),
                  ),
                ].join('；') || '未匹配'
              }}。
            </p>
            <p>
              匹配记录：{{
                detail.targetSources
                  .map(
                    (t) =>
                      `${t.spu} / ${t.month}月 / ${t.operator_name} / ${t.target_units}件`,
                  )
                  .join('；') || '无'
              }}
            </p>
          </details>
          <div class="detail-block">
            <button
              class="primary"
              :disabled="
                Boolean(confirming) ||
                detail.canConfirm === false ||
                Boolean(detail.confirmedAt)
              "
              @click="confirm(detail)"
            >
              {{
                detail.confirmedAt
                  ? '已确认'
                  : detail.canConfirm === false
                    ? '仅查看'
                    : '确认处理'
              }}
            </button>
          </div>
        </template>
        <template v-else-if="dialogMode === 'calendar'">
          <p>
            阶段与日期来自已审核的运营日历。点击阶段仅切换安排，不改变经营数据。
          </p>
          <article
            v-for="(p, i) in data?.phases"
            :key="p.start"
            class="schedule-item"
          >
            <div>
              <h3>{{ p.name }}</h3>
              <p>{{ p.start }} 至 {{ p.end }}</p>
              <button
                class="link"
                @click="
                  phaseIndex = i;
                  dialog?.close();
                "
              >
                预览阶段
              </button>
            </div>
            <div>
              <p><strong>商品：</strong>{{ p.product }}</p>
              <p><strong>广告：</strong>{{ p.ads }}</p>
              <p><strong>库存：</strong>{{ p.stock }}</p>
              <p><strong>判断条件：</strong>{{ p.condition }}</p>
            </div>
          </article>
        </template>
        <template v-else-if="dialogMode === 'strategy'">
          <p>
            下表为运营日历依据 2025 年订单给出的参考窗口，2026
            年实际配送截止日需按邮编核对。
          </p>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>站点</th>
                  <th>历史峰值周</th>
                  <th>建议开始收缩</th>
                  <th>12/20 后</th>
                  <th>核对重点</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in data?.source.strategies" :key="s.site">
                  <td>{{ s.site }}</td>
                  <td>{{ s.peak }}</td>
                  <td>{{ s.reduce }}</td>
                  <td>{{ s.late }}</td>
                  <td>{{ s.logistics }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <template v-else-if="dialogMode === 'catalog'">
          <p>
            来自飞书完整收货与发货计划，共 {{ data?.sourceSpus }} 个 SPU、{{
              data?.skuRows
            }}
            行。有效站点与负责人以当前商品主数据为准。
          </p>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SPU</th>
                  <th>SKU 行数</th>
                  <th>原表分类</th>
                  <th>新品 / 老品</th>
                  <th>有首单计划的站点</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in data?.source.plans" :key="p.spu">
                  <td>{{ p.spu }}</td>
                  <td>{{ p.skuCount }}</td>
                  <td>{{ p.categories.join(' / ') }}</td>
                  <td>{{ p.new.join(' / ') }}</td>
                  <td>
                    {{
                      Object.entries(p.sites)
                        .filter(([, v]) => v > 0)
                        .map(([k]) => siteName(k))
                        .join('、') || '未填写'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <template v-else-if="dialogMode === 'method'">
          <div class="detail-block">
            <h3>商品范围和目标</h3>
            <p>
              飞书收货与发货计划 {{ data?.skuRows }} 行，{{ data?.sourceSpus }}
              个候选
              SPU；有效站点按当前商品主数据确认，剔除已下架、衰退期、已终止和
              Funspread-US。
            </p>
            <p>
              目标周期为 2026 年 10—12 月。优先按
              SPU＋站点读取；完全没有直接目标的新品按当前运营＋同站点＋二级分类匹配占位目标，逐月取单款均值。缺失、重复、无效目标保持待核对。
            </p>
          </div>
          <div class="detail-block">
            <h3>销量、库存和负责人</h3>
            <p>
              销量来自 productexpressionnew，按父 ASIN＋店铺＋站点对应。库存来自
              FBA
              快照，物理记录去重；共享仓不代表本站独占。负责人来自当前商品主数据及启用账号；目标表旧姓名仅供核对。
            </p>
            <p>
              销售周期开始前不显示虚构完成率。阶段预览只切换排期；处理确认写入看板记录，不会自动调价或修改广告。
            </p>
          </div>
          <a :href="data?.source.sourceUrl" target="_blank" rel="noopener">打开飞书商品范围来源</a>
        </template>
      </div>
    </dialog>
  </div>
</template>

<style scoped src="./style.css"></style>
