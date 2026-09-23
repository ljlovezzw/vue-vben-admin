<script setup lang="ts">
import type { GroupKey, QueueKind } from './model';

import type {
  HalloweenOverview,
  HalloweenRow,
  StockField,
  StockValues,
} from '#/api/kanban/halloween-calendar';

import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue';

import { message, Modal, Spin } from 'ant-design-vue';

import {
  confirmHalloweenAction,
  fetchHalloweenOverview,
} from '#/api/kanban/halloween-calendar';

import {
  aggregate,
  DEFAULT_OWNER_SCOPE,
  formatNumber as fmt,
  groupsFor,
  inventoryFor,
  matchesOwnerScope,
  ordered,
  pending,
  formatRate as rate,
  stockText,
} from './model';

defineOptions({ name: 'KanbanHalloweenCalendar' });
const data = ref<HalloweenOverview | null>(null);
const loading = ref(false);
const error = ref('');
const department = ref('');
const site = ref('');
const owner = ref('');
const defaultOwners = computed(
  () => data.value?.viewer?.defaultResponsibles ?? null,
);
const defaultOwnerSelection = () =>
  defaultOwners.value === null ? '' : DEFAULT_OWNER_SCOPE;
let defaultsApplied = false;
const category = ref('');
const group = ref<GroupKey>('category');
const groupPage = ref(1);
const queueKind = ref<QueueKind>('action');
const confirming = ref('');
const modalOpen = ref(false);
const modalMode = ref<'browse' | 'calendar' | 'detail' | 'sources'>('browse');
const detailId = ref('');
const browseKind = ref<QueueKind>('all');
const browseQuery = ref('');
const browsePage = ref(1);
const allRows = computed(() => data.value?.rows ?? []);
const records = computed(() => data.value?.inventoryRecords ?? []);
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
      matchesOwnerScope(r.owner, owner.value, defaultOwners.value) &&
      (!category.value || r.category === category.value),
  ),
);
const summary = computed(() => aggregate(rows.value, records.value));
const groups = computed(() =>
  groupsFor(rows.value, records.value, group.value),
);
const groupPages = computed(() =>
  Math.max(1, Math.ceil(groups.value.length / 6)),
);
const visibleGroups = computed(() =>
  groups.value.slice((groupPage.value - 1) * 6, groupPage.value * 6),
);
const queue = computed(() =>
  ordered(rows.value.filter((r) => pending(r, queueKind.value))),
);
const actionCount = computed(
  () => rows.value.filter((r) => pending(r, 'action')).length,
);
const dataCount = computed(
  () => rows.value.filter((r) => pending(r, 'data')).length,
);
const currentPhase = computed(() =>
  data.value?.phases.find((p) => p.state === 'current'),
);
const phaseTask = computed(
  () => currentPhase.value?.task ?? '当前不在运营阶段内，按实际情况跟进。',
);
const holidayDays = computed(() =>
  data.value
    ? Math.ceil(
        (Date.parse(`${data.value.year}-10-31T00:00:00Z`) -
          Date.parse(`${data.value.asOf}T00:00:00Z`)) /
          86_400_000,
      )
    : 0,
);
const browseRows = computed(() =>
  ordered(
    rows.value.filter(
      (r) =>
        pending(r, browseKind.value) &&
        `${r.spu} ${r.owner} ${r.site} ${r.category}`
          .toLowerCase()
          .includes(browseQuery.value.trim().toLowerCase()),
    ),
  ),
);
const browsePages = computed(() =>
  Math.max(1, Math.ceil(browseRows.value.length / 10)),
);
const visibleBrowse = computed(() =>
  browseRows.value.slice((browsePage.value - 1) * 10, browsePage.value * 10),
);
const detail = computed(() =>
  allRows.value.find((r) => r.id === detailId.value),
);
const detailStock = computed(() => {
  if (!detail.value) return [];
  const groups = new Map<string, ReturnType<typeof inventoryFor>>();
  for (const record of inventoryFor([detail.value], records.value)) {
    const key = `${record.warehouse}|${record.sites.join('/')}`;
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  return [...groups].map(([key, list]) => ({
    key,
    warehouse: list[0]?.warehouse,
    sites: list[0]?.sites.join(' / '),
    ...(Object.fromEntries(
      stockFields.map(([field]) => [
        field,
        list.some((r) => r[field] === null)
          ? null
          : list.reduce((n, r) => n + (r[field] ?? 0), 0),
      ]),
    ) as StockValues),
  }));
});
const scopedPools = computed(
  () =>
    data.value?.targetPools.filter(
      (p) =>
        rows.value.some((r) => r.spu === p.spu) &&
        p.status !== '站点目标已覆盖，区域总数不重复计入',
    ) ?? [],
);
const modalTitle = computed(
  () =>
    ({
      browse:
        browseKind.value === 'all'
          ? '全部商品'
          : (browseKind.value === 'data'
            ? '资料待核对'
            : '完整待办'),
      calendar: '万圣节运营排期',
      detail: detail.value
        ? `${detail.value.spu} · ${siteName(detail.value.site)}`
        : '商品明细',
      sources: '数据口径',
    })[modalMode.value],
);
const metrics = computed(() => [
  [fmt(summary.value.target), '可核对目标'],
  [fmt(summary.value.actual), '对应销量'],
  [rate(summary.value.rate), '目标完成率'],
  [
    summary.value.available === null ? '待核对' : fmt(summary.value.available),
    'FBA 可用库存（去重）',
  ],
  [String(summary.value.stock), '库存提醒'],
]);
const groupOptions: { label: string; value: GroupKey }[] = [
  { label: '站点', value: 'site' },
  { label: '分类', value: 'category' },
  { label: '负责人', value: 'owner' },
];
const stockFields: [StockField, string][] = [
  ['total', '总库存'],
  ['available', '可用库存'],
  ['sellable', '可售'],
  ['reserved', '预留'],
  ['shipped', '标发在途'],
  ['actualTransit', '实际在途'],
  ['working', '计划入库'],
  ['receiving', '接收中'],
];
const siteName = (code: string) => data.value?.sites[code] ?? code;
const shortDate = (date: string) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const barWidth = (value: null | number) =>
  `${Math.max(0, Math.min(100, (value ?? 0) * 100))}%`;

async function load() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    data.value = await fetchHalloweenOverview();
    if (!defaultsApplied) {
      owner.value = defaultOwnerSelection();
      defaultsApplied = true;
    }
    if (!departments.value.includes(department.value)) department.value = '';
    if (!data.value.sites[site.value]) site.value = '';
    if (
      owner.value &&
      owner.value !== DEFAULT_OWNER_SCOPE &&
      !owners.value.includes(owner.value)
    )
      owner.value = defaultOwnerSelection();
    if (!allRows.value.some((r) => r.category === category.value))
      category.value = '';
  } catch {
    error.value = data.value
      ? '刷新失败，当前仍显示上次读取的数据。请重试。'
      : '万圣节运营数据读取失败，请重试。';
  } finally {
    loading.value = false;
  }
}
async function confirm(row: HalloweenRow) {
  if (
    confirming.value ||
    loading.value ||
    row.confirmedAt ||
    row.canConfirm === false ||
    row.kind === 'normal'
  )
    return;
  confirming.value = row.actionKey;
  try {
    const ack = await confirmHalloweenAction(row.actionKey);
    Object.assign(row, ack);
    message.success('已保存处理确认');
  } catch {
    message.error('未能保存确认，待办可能已更新。请刷新后重试。');
  } finally {
    confirming.value = '';
  }
}
function clearFilters() {
  department.value = '';
  site.value = '';
  owner.value = defaultOwnerSelection();
  category.value = '';
}
function drill(key: string) {
  if (group.value === 'site') site.value = key;
  else if (group.value === 'owner') owner.value = key;
  else category.value = key;
}
function openBrowse(kind: QueueKind) {
  browseKind.value = kind;
  browseQuery.value = '';
  browsePage.value = 1;
  modalMode.value = 'browse';
  modalOpen.value = true;
}
function openDetail(row: HalloweenRow) {
  detailId.value = row.id;
  modalMode.value = 'detail';
  modalOpen.value = true;
}
function openInfo(mode: 'calendar' | 'sources') {
  modalMode.value = mode;
  modalOpen.value = true;
}
watch([department, site], () => {
  if (
    owner.value &&
    owner.value !== DEFAULT_OWNER_SCOPE &&
    !owners.value.includes(owner.value)
  )
    owner.value = defaultOwnerSelection();
});
watch([department, site, owner, category, group], () => {
  groupPage.value = 1;
  browsePage.value = 1;
});
watch([browseKind, browseQuery], () => {
  browsePage.value = 1;
});
watch(browsePages, (pages) => {
  browsePage.value = Math.min(browsePage.value, pages);
});
watch(groupPages, (pages) => {
  groupPage.value = Math.min(groupPage.value, pages);
});
function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') modalOpen.value = false;
}
watch(modalOpen, (open) => {
  if (open) document.addEventListener('keydown', closeOnEscape);
  else document.removeEventListener('keydown', closeOnEscape);
});
onBeforeUnmount(() => document.removeEventListener('keydown', closeOnEscape));
onMounted(load);
onActivated(() => {
  if (data.value) void load();
});
onDeactivated(() => {
  modalOpen.value = false;
});
</script>

<template>
  <div class="halloween-page">
    <main class="notice" :aria-busy="loading">
      <header class="header">
        <div class="calendar-title">
          <span class="mark" aria-hidden="true"></span>
          <div>
            <h1>万圣节运营日历</h1>
            <p class="subtitle">
              {{ data?.year ?? 2026 }} · 9—10 月销售与库存跟进
            </p>
          </div>
        </div>
        <button
          class="refresh"
          :disabled="loading || Boolean(confirming)"
          @click="load"
        >
          {{ loading ? '读取中…' : '刷新数据' }}
        </button>
      </header>
      <div v-if="error" class="error" role="alert">
        {{ error }}
        <button class="link" :disabled="loading" @click="load">重试</button>
      </div>
      <div v-if="!data" class="empty">
        <Spin v-if="loading" />
        <p v-else>暂无可显示的数据。</p>
      </div>
      <template v-else>
        <div class="filters">
          <div class="filters-left">
            <label class="department-filter">部门<select v-model="department" aria-label="部门">
                <option value="">全部部门</option>
                <option v-for="name in departments" :key="name">
                  {{ name }}
                </option>
              </select></label>
            <label>站点<select v-model="site" aria-label="站点">
                <option value="">全部站点</option>
                <option
                  v-for="(name, code) in data.sites"
                  :key="code"
                  :value="code"
                >
                  {{ name }} {{ code }}
                </option>
              </select></label>
            <label>负责人<select v-model="owner" aria-label="负责人">
                <option
                  v-if="defaultOwners !== null"
                  :value="DEFAULT_OWNER_SCOPE"
                >
                  {{ data?.viewer?.defaultLabel }}
                </option>
                <option value="">全部负责人</option>
                <option v-for="name in owners" :key="name">{{ name }}</option>
              </select></label>
          </div>
          <button class="link" @click="clearFilters">恢复默认</button>
        </div>
        <div v-if="category" class="filter-chip">
          分类：{{ category
          }}<button class="link" @click="category = ''">清除</button>
        </div>
        <section class="stage-calendar" aria-label="运营阶段时间轴">
          <div class="section-head">
            <h2>运营阶段</h2>
            <button class="link" @click="openInfo('calendar')">
              查看完整日历
            </button>
          </div>
          <div
            class="stage-scroll"
            tabindex="0"
            aria-label="运营阶段，可横向滚动查看"
          >
            <ol class="stages">
              <li
                v-for="(phase, index) in data.phases"
                :key="phase.name"
                :class="phase.state"
                :aria-current="phase.state === 'current' ? 'step' : undefined"
              >
                <b>{{ index + 1 }}</b><span>{{ phase.name }}</span><small>{{ shortDate(phase.start) }}—{{
                    shortDate(phase.end)
                  }}</small>
              </li>
            </ol>
          </div>
          <div class="stage-elapsed">
            <span>{{
              currentPhase ? '本阶段日历时间进度' : '当前不在运营阶段内'
            }}</span>
            <div
              v-if="currentPhase"
              class="track"
              role="img"
              :aria-label="`本阶段已过 ${currentPhase.elapsed}/${currentPhase.days} 天`"
            >
              <i :style="{ width: barWidth(currentPhase.progress) }"></i>
            </div>
            <span>{{
                currentPhase
                  ? `${currentPhase.elapsed}/${currentPhase.days} 天 · `
                  : ''
              }}仅表示时间经过，不代表任务完成</span>
          </div>
        </section>
        <section class="intro">
          <div>
            <h2>
              {{
                actionCount
                  ? `有 ${actionCount} 项需要处理`
                  : '当前暂无销售与库存待办'
              }}
            </h2>
            <p>当前安排：{{ phaseTask }}</p>
          </div>
          <div class="holiday">
            <small>{{ holidayDays >= 0 ? '距万圣节' : '万圣节已过' }}</small><strong>{{ Math.abs(holidayDays) }}</strong> 天<small>10 月 31 日</small>
          </div>
        </section>
        <section class="metrics" aria-label="销售与库存摘要">
          <div
            v-for="([value, label], index) in metrics"
            :key="label"
            class="metric"
            :class="{ attention: index === 4 }"
          >
            <span>{{ label }}</span><strong>{{ value }}</strong>
          </div>
        </section>
        <div class="pace">
          <div class="pace-label">
            <span>9—10 月销售进度</span><span>月内均摊参考 {{ rate(summary.expected) }}</span>
          </div>
          <div
            class="track"
            role="img"
            :aria-label="`销售目标完成率 ${rate(summary.rate)}`"
          >
            <i :style="{ width: barWidth(summary.rate) }"></i>
          </div>
          <p class="scope-note">
            目标与销量同口径：{{ summary.comparable }} 个商品 /
            站点组合；库存匹配 {{ summary.inventoryPairs }}/{{ rows.length }}
            个组合，含共享仓，同一记录只计一次。
          </p>
        </div>
        <section class="section">
          <div class="section-head">
            <h2>完成进度</h2>
            <div class="switch" role="group" aria-label="进度汇总维度">
              <button
                v-for="option in groupOptions"
                :key="option.value"
                :aria-pressed="group === option.value"
                @click="group = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <div class="group-grid">
            <button
              v-for="item in visibleGroups"
              :key="item.key"
              class="group-item"
              :aria-label="`查看${group === 'site' ? siteName(item.key) : item.key}商品`"
              @click="drill(item.key)"
            >
              <div class="group-title">
                <strong>{{
                  group === 'site'
                    ? `${siteName(item.key)} ${item.key}`
                    : item.key
                }}</strong><span>{{
                  item.summary.rate === null
                    ? '待核对'
                    : rate(item.summary.rate)
                }}</span>
              </div>
              <div class="track">
                <i :style="{ width: barWidth(item.summary.rate) }"></i>
              </div>
              <div class="group-values">
                <span>已完成
                  <b>{{
                    item.summary.comparable ? fmt(item.summary.actual) : '—'
                  }}</b>
                  /
                  {{
                    item.summary.comparable ? fmt(item.summary.target) : '—'
                  }}</span><span>还差
                  <b>{{
                    item.summary.comparable ? fmt(item.summary.gap) : '—'
                  }}</b>
                  件</span>
              </div>
            </button>
            <p v-if="groups.length === 0" class="empty">
              当前筛选没有商品，请清空筛选。
            </p>
          </div>
          <div class="section-foot">
            <span>点选一项，查看对应商品</span>
            <div class="pager">
              <button
                :disabled="groupPage === 1"
                aria-label="上一组进度"
                @click="groupPage--"
              >
                上一组
</button><span>{{ groupPage }} / {{ groupPages }}</span><button
                :disabled="groupPage === groupPages"
                aria-label="下一组进度"
                @click="groupPage++"
              >
                下一组
              </button>
            </div>
          </div>
        </section>
        <section class="section">
          <div class="section-head">
            <h2>现在要做什么</h2>
            <div class="queue-options">
              <span>{{ queue.length }} 项 · 显示前
                {{ Math.min(8, queue.length) }} 项</span><select v-model="queueKind" aria-label="筛选待办类型">
                <option value="action">全部待办</option>
                <option value="stock">库存提醒</option>
                <option value="slow">进度偏慢</option>
                <option value="data">资料待核对</option>
              </select>
            </div>
          </div>
          <div class="queue">
            <article
              v-for="row in queue.slice(0, 8)"
              :key="row.id"
              class="queue-row"
            >
              <div>
                <span class="badge" :class="{ gray: row.kind === 'data' }">{{
                  row.priority === 0
                    ? '紧急'
                    : row.kind === 'data'
                      ? '核对'
                      : '关注'
                }}</span>
                <div class="queue-owner">{{ row.owner }}</div>
              </div>
              <div>
                <div class="queue-product">
                  <strong>{{ row.spu }}</strong><span>{{ siteName(row.site) }} · {{ row.category }}</span>
                </div>
                <div class="queue-facts">
                  <span class="queue-action">{{ row.action }}</span><span>可用 {{ stockText(row) }} 件 · 可售
                    {{ stockText(row, 'sellable') }} 件<span
                      v-if="row.cover !== null"
                    >
                      · 可用覆盖 {{ fmt(row.cover) }} 天</span><span v-if="row.sharedStock"> · 含共享库存</span></span><span>{{
                    row.sevenComplete
                      ? `近 7 天销量 ${fmt(row.recent7)} 件`
                      : '近 7 天销量待补齐'
                  }}</span><span>进度 {{ rate(row.done) }}</span>
                </div>
              </div>
              <div class="queue-buttons">
                <button
                  class="link"
                  :aria-label="`查看 ${row.spu} ${row.site} 明细`"
                  @click="openDetail(row)"
                >
                  明细
</button><button
                  class="primary"
                  :disabled="
                    Boolean(confirming) || loading || row.canConfirm === false
                  "
                  @click="confirm(row)"
                >
                  {{
                    row.canConfirm === false
                      ? '仅查看'
                      : confirming === row.actionKey
                        ? '保存中…'
                        : '确认处理'
                  }}
                </button>
              </div>
            </article>
            <div v-if="queue.length === 0" class="empty">
              当前筛选没有待办，可切换类型或清空筛选。
            </div>
          </div>
          <div class="section-foot">
            <button class="link" @click="openBrowse(queueKind)">
              查看完整待办（{{ queue.length }}）
</button><button class="link" @click="openBrowse('data')">
              另有 {{ dataCount }} 项资料待核对
            </button>
          </div>
        </section>
        <footer class="footer">
          <div class="footer-links">
            <button class="link" @click="openInfo('calendar')">运营排期</button><button class="link" @click="openBrowse('all')">全部商品</button><button class="link" @click="openInfo('sources')">数据口径</button>
          </div>
          <small>销量 {{ data.salesThrough ?? '待同步' }} · 库存
            {{ data.inventoryAt?.slice(0, 10) ?? '待同步' }}<br />读取于
            {{ data.fetchedAt.replace('T', ' ') }}</small>
        </footer>
      </template>
    </main>
    <Modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :footer="null"
      :width="960"
      :destroy-on-close="true"
      class="halloween-modal"
    >
      <div class="halloween-dialog">
        <template v-if="modalMode === 'calendar'">
          <div class="table-scroll">
            <table class="calendar-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>要做什么</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="([date, task], index) in data?.operations"
                  :key="index"
                >
                  <td>{{ date }}</td>
                  <td>{{ task }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="tip">
            阶段进度仅表示日历时间经过，实际完成状态需运营确认。
          </p>
        </template>
        <template v-else-if="modalMode === 'sources'">
          <h3>目标、销量和负责人</h3>
          <p>
            默认统计 {{ data?.year }} 年 9—10 月。目标来自系统目标表，负责人按
            SPU＋站点匹配当前商品主数据；旧姓名仅用于对账。部门来自当前负责人账号。已下架、衰退期、已终止按站点排除，默认排除
            Funspread-US。
          </p>
          <p>
            完成率仅使用目标和销量都齐全的商品组合；缺失、重复和零目标不按 0
            混算。月内均摊仅为进度参考，不是旺季预测。
          </p>
          <h3>库存与提醒</h3>
          <p>
            总库存、可用、可售分别取原字段；主指标为 FBA
            可用库存。共享仓按物理记录去重，各站点库存不能直接相加。在途和接收中不追加到可用库存。
          </p>
          <p>
            可售为 0 但有库存或在途，先跟进入库与配送。库存不足 14
            天时核对到仓，评估提价；进度落后参考 8
            个百分点且库存可支撑时检查广告和降价空间。共享库存先核对跨站点消耗，数据不完整先补齐。
          </p>
          <p>
            “确认处理”保存当前日期的处理确认；明天的新待办重新判断。确认不会执行调价、广告或消息推送。
          </p>
          <details>
            <summary>来源与区域目标</summary>
            <p>
              范围：{{ data?.scopeSource }}。实际数据来自
              operator_targets、product_life、productexpressionnew、fba_inventory_snapshot
              和 users。缓存最长 2 分钟。
            </p>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SPU / 区域</th>
                    <th>月份</th>
                    <th>目标</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(pool, index) in scopedPools.slice(0, 20)"
                    :key="index"
                  >
                    <td>{{ pool.spu }} · {{ pool.scope }}</td>
                    <td>{{ pool.month }} 月</td>
                    <td>{{ fmt(pool.units) }}</td>
                    <td>{{ pool.status }}</td>
                  </tr>
                  <tr v-if="scopedPools.length === 0">
                    <td colspan="4">当前范围没有可展示的待核对区域目标。</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="tip">
              最多展示 20 条。区域目标不自动分摊，也不重复计入站点目标。
            </p>
          </details>
        </template>
        <template v-else-if="modalMode === 'browse'">
          <div class="browse-controls">
            <input
              v-model="browseQuery"
              type="search"
              placeholder="搜索 SPU、负责人、分类"
              aria-label="搜索商品"
            /><select v-model="browseKind" aria-label="筛选商品类型">
              <option value="all">全部商品</option>
              <option value="action">销售与库存待办</option>
              <option value="stock">库存提醒</option>
              <option value="slow">进度偏慢</option>
              <option value="data">资料待核对</option>
            </select>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>商品 / 站点</th>
                  <th>负责人</th>
                  <th class="num">目标 / 已卖</th>
                  <th>完成率</th>
                  <th class="num">FBA 库存</th>
                  <th>处理建议</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in visibleBrowse" :key="row.id">
                  <td>
                    <strong>{{ row.spu }}</strong><small>{{ siteName(row.site) }} · {{ row.category }}</small>
                  </td>
                  <td>{{ row.owner }}</td>
                  <td class="num">
                    {{ fmt(row.target)
                    }}<small>已取数 {{ fmt(row.actual)
                      }}{{ row.complete ? '' : ' · 不完整' }}</small>
                  </td>
                  <td>{{ rate(row.done) }}</td>
                  <td class="num">
                    <strong>可用 {{ stockText(row) }}</strong><small>总库存 {{ stockText(row, 'total') }} · 可售
                      {{ stockText(row, 'sellable') }}</small><small v-if="row.sharedStock">含共享库存</small>
                  </td>
                  <td>
                    {{ row.action
                    }}<small v-if="row.confirmedAt">{{ row.confirmedBy }} 已确认</small>
                  </td>
                  <td>
                    <button
                      :aria-label="`查看 ${row.spu} ${row.site} 明细`"
                      @click="openDetail(row)"
                    >
                      明细
                    </button>
                  </td>
                </tr>
                <tr v-if="visibleBrowse.length === 0">
                  <td colspan="7" class="empty">
                    没有匹配商品，请更换筛选或搜索词。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="section-foot">
            <span>共 {{ browseRows.length }} 个商品 / 站点组合</span>
            <div class="pager">
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
        <template v-else-if="detail">
          <p>
            {{ detail.category }} · 当前负责人：<strong>{{
              detail.owner
            }}</strong>
            · {{ detail.department
            }}{{ detail.ownerChanged ? ' · 已按当前归属校正' : '' }}
          </p>
          <div class="detail-grid">
            <div>
              <span>9—10 月目标</span><strong>{{ fmt(detail.target) }}</strong>
            </div>
            <div>
              <span>本期已取数销量</span><strong>{{ fmt(detail.actual) }}</strong>
            </div>
            <div>
              <span>完成率</span><strong>{{ rate(detail.done) }}</strong>
            </div>
            <div>
              <span>可用库存覆盖</span><strong>{{
                detail.cover === null
                  ? detail.sharedStock
                    ? '共享仓另核'
                    : '待核对'
                  : `${fmt(detail.cover)} 天`
              }}</strong>
            </div>
          </div>
          <div class="stock-grid">
            <div v-for="[field, label] in stockFields" :key="field">
              <span>FBA {{ label }}</span><strong>{{ stockText(detail, field) }} <small>件</small></strong>
            </div>
          </div>
          <p v-if="detail.sharedStock">
            可用库存含共享
            {{ fmt(detail.inventory.sharedAvailable) }} 件，不代表本站独占。
          </p>
          <p v-if="detail.sellableCover !== null">
            当前可售覆盖 {{ fmt(detail.sellableCover) }} 天。
          </p>
          <p class="tip">
            总库存、可用、可售分别显示，不相加；入库与在途不重复叠加到可用库存。
          </p>
          <div class="action-note">
            <strong>{{ detail.action }}</strong><br />{{ detail.reason }}
          </div>
          <p>
            近 7 天（截至 {{ data?.salesThrough ?? '待同步' }}）：{{
              detail.sevenComplete
                ? `销量 ${fmt(detail.recent7)} 件，数据完整`
                : `销量待补齐，已取数 ${fmt(detail.recent7)} 件`
            }}。
          </p>
          <p v-if="!detail.complete">周期销量不完整，完成率暂不计算。</p>
          <p v-if="detail.targetIssues.length > 0">
            {{ detail.targetIssues.join('；') }}。
          </p>
          <p v-if="detail.ownerIssue">{{ detail.ownerIssue }}。</p>
          <details>
            <summary>查看库存来源</summary>
            <p>
              库存更新 {{ detail.inventory.refreshed ?? '未匹配' }}。{{
                detail.sharedStock ? '共享数量可被多个站点使用。' : ''
              }}
            </p>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>仓库 / 适用站点</th>
                    <th
                      v-for="[field, label] in stockFields"
                      :key="field"
                      class="num"
                    >
                      {{ label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in detailStock" :key="item.key">
                    <td>
                      {{ item.warehouse }}<small>{{ item.sites }}</small>
                    </td>
                    <td v-for="[field] in stockFields" :key="field" class="num">
                      {{ fmt(item[field] as null | number) }}
                    </td>
                  </tr>
                  <tr v-if="detailStock.length === 0">
                    <td colspan="9">未匹配到库存快照。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary>查看目标与负责人来源</summary>
            <p>
              目标表原负责人：{{
                detail.oldOwners.join('、') || '未填写'
              }}。当前按 SPU＋站点匹配商品主数据。
            </p>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>月份</th>
                    <th class="num">目标</th>
                    <th>原表来源</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in detail.targetSources" :key="item.id">
                    <td>{{ item.month }} 月</td>
                    <td class="num">{{ fmt(item.target_units) }}</td>
                    <td>
                      {{ item.source_file
                      }}<small>{{ item.source_sheet }} · 第
                        {{ item.source_row }} 行</small>
                    </td>
                  </tr>
                  <tr v-if="detail.targetSources.length === 0">
                    <td colspan="3">未匹配到目标明细。</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>父 ASIN / 店铺</th>
                    <th>当前负责人</th>
                    <th>生命周期</th>
                    <th>修改日期</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(master, index) in detail.masters" :key="index">
                    <td>
                      {{ master.parent }}<small>{{ master.shop }}</small>
                    </td>
                    <td>{{ master.owner || '待确认' }}</td>
                    <td>{{ master.life }}</td>
                    <td>{{ master.modified?.slice(0, 10) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
          <div class="detail-toolbar">
            <button
              v-if="detail.kind !== 'normal'"
              class="primary"
              :disabled="
                Boolean(detail.confirmedAt) ||
                Boolean(confirming) ||
                loading ||
                detail.canConfirm === false
              "
              @click="confirm(detail)"
            >
              {{
                detail.canConfirm === false
                  ? '仅查看'
                  : detail.confirmedAt
                    ? '已确认处理'
                    : confirming
                      ? '保存中…'
                      : '确认处理'
              }}
</button><button class="link" @click="openBrowse('all')">
              返回商品清单
            </button>
          </div>
          <p v-if="detail.confirmedAt">
            {{ detail.confirmedBy }} · {{ detail.confirmedAt }} 已确认
          </p>
          <p class="tip">确认仅记录处理状态，调价与投放需运营另行执行。</p>
        </template>
      </div>
    </Modal>
  </div>
</template>

<style scoped src="./style.css"></style>
