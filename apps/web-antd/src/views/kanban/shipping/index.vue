<script setup lang="ts">
import type {
  ShippingAllocationMeta,
  ShippingAllocationRow,
  ShippingBatchStatus,
  ShippingShipmentBatch,
  ShippingSimulationResult,
  ShippingWorkspaceBootstrap,
  ShippingWorkspaceState,
} from '#/api/kanban/types';

import { computed, onMounted, ref } from 'vue';

import { Download, RotateCw } from '@vben/icons';

import { message, Spin } from 'ant-design-vue';

import {
  exportShippingWorkspace,
  exportTodayShippingWorkspace,
  fetchShippingAllocationMeta,
  fetchShippingWorkspace,
  fetchShippingWorkspaceBootstrap,
  fetchShippingWorkspaceSimulation,
  saveShippingWorkspace,
  simulateShippingAllocation,
  syncShippingReceipts,
  syncShippingSkuPlans,
} from '#/api/kanban';

type TabKey =
  | 'allocation'
  | 'channels'
  | 'dashboard'
  | 'receipts'
  | 'rules'
  | 'sku'
  | 'today';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: '总控看板' },
  { key: 'today', label: '今日到货分配' },
  { key: 'receipts', label: '来货数据' },
  { key: 'sku', label: 'SKU渠道计划' },
  { key: 'allocation', label: '自动分配结果' },
  { key: 'channels', label: '渠道配置' },
  { key: 'rules', label: '规则设置' },
];

const activeTab = ref<TabKey>('dashboard');
const loading = ref(true);
const saving = ref(false);
const meta = ref<null | ShippingAllocationMeta>(null);
const workspace = ref<null | ShippingWorkspaceState>(null);
const persistedWorkspace = ref<null | ShippingWorkspaceState>(null);
const result = ref<null | ShippingSimulationResult>(null);
const channelFilter = ref('');
const buildStateFilter = ref('');
const allocationView = ref<'batches' | 'trace'>('batches');
const expandedBatchIds = ref<string[]>([]);
const defaultRules = ref<null | ShippingWorkspaceState['rules']>(null);
const syncingReceipts = ref(false);
const syncingSkuPlans = ref(false);
const exportingBuildPlan = ref(false);
const exportingTodayPlan = ref(false);
const allocatingToday = ref(false);
const workspaceDetailsLoaded = ref(false);
const fullResultLoaded = ref(false);
const bootstrapTotalReturnedQty = ref(0);

const channels = computed(() => workspace.value?.channels ?? []);
const receipts = computed(() => workspace.value?.receipts ?? []);
const skuPlans = computed(() => workspace.value?.skuPlans ?? []);
const allocations = computed(() => result.value?.allocations ?? []);
const filteredAllocations = computed(() =>
  channelFilter.value
    ? allocations.value.filter((row) => row.channelCode === channelFilter.value)
    : allocations.value,
);
const shipmentBatches = computed(() => result.value?.shipmentBatches ?? []);
const filteredShipmentBatches = computed(() =>
  shipmentBatches.value.filter((batch) => {
    if (channelFilter.value && batch.channelCode !== channelFilter.value) {
      return false;
    }
    if (buildStateFilter.value === 'dispatch_ready') {
      return batch.readyForDispatch;
    }
    if (buildStateFilter.value === 'sta_ready') {
      return batch.canCreateStaPlan;
    }
    if (buildStateFilter.value === 'blocked') {
      return !batch.readyForDispatch;
    }
    return true;
  }),
);
const summary = computed(() => result.value?.summary);
const channelResults = computed(() => result.value?.channels ?? []);
const totalReturned = computed(() =>
  workspaceDetailsLoaded.value
    ? receipts.value.reduce(
        (sum, row) => sum + Number(row.returnedQty || row.goodQty || 0),
        0,
      )
    : bootstrapTotalReturnedQty.value,
);
const totalShipped = computed(() => Number(summary.value?.shippedQty || 0));
const todayDate = computed(() => latestAsOfDate());
const todayReceipts = computed(() =>
  receipts.value.filter((row) => row.receiptDate === todayDate.value),
);
const todayReceiptIds = computed(
  () => new Set(todayReceipts.value.map((row) => row.receiptId)),
);
const todayUnallocated = computed(() =>
  (result.value?.unallocated ?? []).filter((row) =>
    todayReceiptIds.value.has(row.receiptId),
  ),
);
const todayShipmentBatches = computed(
  () => result.value?.todayShipmentBatches ?? [],
);

function errorText(error: any, fallback: string) {
  return error?.response?.data?.detail || error?.message || fallback;
}

function integer(value?: null | number) {
  return Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  });
}

function percent(value?: null | number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function dateTime(value?: string) {
  if (!value) return '默认方案';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('zh-CN', { hour12: false });
}

function latestAsOfDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function refreshWorkspaceAsOfDate() {
  const latest = latestAsOfDate();
  if (workspace.value) workspace.value.asOfDate = latest;
  return latest;
}

function cloneRules(rules: ShippingWorkspaceState['rules']) {
  return {
    allocationUnit: 5,
    canadaSeaReleaseRate: Number(rules.canadaSeaReleaseRate ?? 1),
    deadlineWarningDays: Number(rules.deadlineWarningDays ?? 2),
    primaryCompletionRate: Number(rules.primaryCompletionRate),
    sampleReserveQty: Number(rules.sampleReserveQty ?? 1),
    seaFreightTargetMaxRate: Number(rules.seaFreightTargetMaxRate ?? 0.8),
    seaFreightTargetMinRate: Number(rules.seaFreightTargetMinRate ?? 0.7),
    ukIenMinBoxes: Number(rules.ukIenMinBoxes ?? 6),
    ukIenThreshold: Number(rules.ukIenThreshold),
    usCartonDeadline: String(rules.usCartonDeadline),
    usMinBoxes: Number(rules.usMinBoxes),
    usWaitHours: Number(rules.usWaitHours),
    warehouseDailyCapacity: Number(rules.warehouseDailyCapacity),
  };
}

function cloneWorkspaceState(state: ShippingWorkspaceState) {
  // Vue may wrap nested workspace values in proxies that structuredClone rejects.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(state)) as ShippingWorkspaceState;
}

function statusLabel(status: ShippingAllocationRow['status']) {
  return {
    locked: '已锁定',
    needs_review: '待人工复核',
    proposed: '待审核',
    waiting_ca_consolidation: '加拿大整批池',
    waiting_sku_carton: '美国一致装箱池',
    waiting_uk_ien: '英国IEN合并池',
  }[status];
}

function statusClass(status: ShippingAllocationRow['status']) {
  return status.replaceAll('_', '-');
}

function batchStatusLabel(status: ShippingBatchStatus) {
  return {
    ambiguous_listing: '建单商品有歧义',
    missed_deadline: '仓库排程已超期',
    missing_listing: '缺建单商品',
    needs_review: '待人工复核',
    ready: '可直接交仓',
    waiting_air_target: '等待空运目标',
    waiting_ca_batch: '等待加拿大整批',
    waiting_carton: '等待美国凑箱',
    waiting_ien: '等待英国 IEN',
    waiting_qty_rounding: '等待美国 SKU 凑 5',
  }[status];
}

function batchStatusClass(status: ShippingBatchStatus) {
  return status.replaceAll('_', '-');
}

function toggleBatch(batch: ShippingShipmentBatch) {
  expandedBatchIds.value = expandedBatchIds.value.includes(batch.batchId)
    ? expandedBatchIds.value.filter((id) => id !== batch.batchId)
    : [...expandedBatchIds.value, batch.batchId];
}

function batchSchedule(batch: ShippingShipmentBatch) {
  if (!batch.warehouseStartDate) return '-';
  return batch.warehouseStartDate === batch.warehouseReadyDate
    ? batch.warehouseStartDate
    : `${batch.warehouseStartDate} 至 ${batch.warehouseReadyDate}`;
}

function batchSkuSummary(batch: ShippingShipmentBatch) {
  return batch.items
    .map((item) => `${item.sku} × ${integer(item.allocationQty)}`)
    .join('；');
}

function batchBlockerSummary(batch: ShippingShipmentBatch) {
  return batch.blockers
    .map((blocker) => blocker.detail || blocker.label)
    .filter(Boolean)
    .join('；');
}

function cartonEstimateLabel(row: ShippingAllocationRow) {
  if (row.cartonEstimateSource === 'same_sku_units_per_box') {
    return row.estimatedUnitsPerBox
      ? `参考同 SKU ${integer(row.estimatedUnitsPerBox)} 件/箱`
      : '参考同 SKU 箱规';
  }
  if (row.cartonEstimateSource === 'transport_mode_common_carton') {
    return row.estimatedUnitsPerBox
      ? `参考常用箱规，约 ${integer(row.estimatedUnitsPerBox)} 件/箱`
      : '参考同运输方式常用箱规';
  }
  if (row.cartonEstimateSource === 'carton_code_rough_volume') {
    return row.estimatedUnitsPerBox
      ? `粗估约 ${integer(row.estimatedUnitsPerBox)} 件/箱`
      : '按箱型体积粗估';
  }
  if (row.estimatedUnitsPerBox) {
    return `按 ${integer(row.estimatedUnitsPerBox)} 件/箱`;
  }
  if (row.cartonEstimateSource === 'recorded_box_qty') {
    return '按来货总箱数比例';
  }
  if (row.estimatedBoxes !== null && row.estimatedBoxes !== undefined) {
    return '按录入箱规初估';
  }
  return '';
}

function shippingModeLabel(
  mode: ShippingWorkspaceState['channels'][number]['mode'],
) {
  return {
    air: '空运',
    sea: '海运',
    truck: '卡航',
  }[mode];
}

function workspacePayload() {
  if (!workspace.value || !workspaceDetailsLoaded.value) {
    throw new Error('工作区明细尚未加载');
  }
  return {
    asOfDate: refreshWorkspaceAsOfDate(),
    channels: workspace.value.channels,
    lockedAllocations: workspace.value.lockedAllocations,
    receipts: workspace.value.receipts,
    rules: workspace.value.rules,
    skuPlans: workspace.value.skuPlans,
  };
}

async function recalculate() {
  result.value = await simulateShippingAllocation(workspacePayload());
  fullResultLoaded.value = true;
}

async function persist(showSuccess = false) {
  if (!workspace.value) return;
  saving.value = true;
  try {
    refreshWorkspaceAsOfDate();
    workspace.value = await saveShippingWorkspace(workspace.value);
    persistedWorkspace.value = cloneWorkspaceState(workspace.value);
    if (showSuccess) message.success('保存成功');
  } finally {
    saving.value = false;
  }
}

async function recoverWorkspaceAfterFailure(error: any, fallback: string) {
  const conflict = Number(error?.response?.status || 0) === 409;
  try {
    workspace.value = await fetchShippingWorkspace();
    workspaceDetailsLoaded.value = true;
    persistedWorkspace.value = cloneWorkspaceState(workspace.value);
    await recalculate();
  } catch {
    if (persistedWorkspace.value) {
      workspace.value = cloneWorkspaceState(persistedWorkspace.value);
      await recalculate().catch(() => undefined);
    }
  }
  message.error(
    conflict
      ? '共享工作区已被其他用户更新，页面已刷新，请重新操作'
      : `${errorText(error, fallback)}，页面已恢复服务器数据`,
  );
}

async function recalculateAndSave(successText = '') {
  loading.value = true;
  try {
    await recalculate();
    await persist(false);
    if (successText) message.success(successText);
  } catch (error: any) {
    await recoverWorkspaceAfterFailure(error, '重新分配失败');
  } finally {
    loading.value = false;
  }
}

async function downloadBuildPlan() {
  if (exportingBuildPlan.value) return;
  exportingBuildPlan.value = true;
  try {
    const blob = await exportShippingWorkspace();
    downloadBlob(blob, `圣诞发货建单计划_${latestAsOfDate()}.xlsx`);
  } catch (error: any) {
    message.error(errorText(error, '建单计划导出失败'));
  } finally {
    exportingBuildPlan.value = false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function downloadTodayBuildPlan() {
  if (exportingTodayPlan.value) return;
  exportingTodayPlan.value = true;
  try {
    const blob = await exportTodayShippingWorkspace();
    downloadBlob(blob, `今日到货建单计划_${latestAsOfDate()}.xlsx`);
  } catch (error: any) {
    message.error(errorText(error, '今日建单表导出失败'));
  } finally {
    exportingTodayPlan.value = false;
  }
}

async function toggleLock(row: ShippingAllocationRow) {
  if (!workspace.value) return;
  if (row.locked) {
    workspace.value.lockedAllocations =
      workspace.value.lockedAllocations.filter(
        (item) => item.allocationId !== row.allocationId,
      );
  } else {
    workspace.value.lockedAllocations.push({
      allocationId: row.allocationId,
      channelCode: row.channelCode,
      qty: row.qty,
      receiptId: row.receiptId,
      sku: row.sku,
      spu: row.spu,
    });
  }
  await recalculateAndSave(row.locked ? '分配已解锁' : '分配已锁定');
}

async function saveChannels() {
  await recalculateAndSave('渠道配置已保存并重新演算');
}

async function saveRules() {
  if (
    Number(workspace.value?.rules.seaFreightTargetMinRate) >
    Number(workspace.value?.rules.seaFreightTargetMaxRate)
  ) {
    return void message.warning('海运占比目标下限不能高于上限');
  }
  await recalculateAndSave('分配规则已保存并重新演算');
}

async function restoreDefaultRules() {
  if (!workspace.value || !defaultRules.value) return;
  workspace.value.rules = cloneRules(defaultRules.value);
  await recalculateAndSave('规则已恢复默认值');
}

async function synchronizeReceipts() {
  if (!workspace.value || syncingReceipts.value || allocatingToday.value)
    return;
  syncingReceipts.value = true;
  try {
    const synchronized = await syncShippingReceipts();
    workspace.value = synchronized.workspace;
    workspaceDetailsLoaded.value = true;
    persistedWorkspace.value = cloneWorkspaceState(synchronized.workspace);
    await recalculate();
    const { removedLocks, skippedRecords, syncedReceipts } =
      synchronized.summary;
    const details = [
      skippedRecords ? `跳过 ${skippedRecords} 条无效记录` : '',
      removedLocks ? `清理 ${removedLocks} 条失效锁定` : '',
    ].filter(Boolean);
    message.success(
      `已同步 ${syncedReceipts} 条来货数据${details.length > 0 ? `，${details.join('，')}` : ''}`,
    );
  } catch (error: any) {
    await recoverWorkspaceAfterFailure(error, '来货数据同步失败');
  } finally {
    syncingReceipts.value = false;
  }
}

async function allocateTodayArrivals() {
  if (!workspace.value || allocatingToday.value || syncingReceipts.value)
    return;
  allocatingToday.value = true;
  try {
    const synchronized = await syncShippingReceipts();
    workspace.value = synchronized.workspace;
    workspaceDetailsLoaded.value = true;
    persistedWorkspace.value = cloneWorkspaceState(synchronized.workspace);
    await recalculate();
    activeTab.value = 'today';
    message.success(
      `今日同步 ${integer(summary.value?.todayReceiptCount)} 条来货，自动分配 ${integer(summary.value?.todayAllocatedQty)} 件，未分配 ${integer(summary.value?.todayUnallocatedQty)} 件`,
    );
  } catch (error: any) {
    await recoverWorkspaceAfterFailure(error, '今日到货同步与自动分配失败');
  } finally {
    allocatingToday.value = false;
  }
}

async function synchronizeSkuPlans() {
  if (!workspace.value || syncingSkuPlans.value) return;
  syncingSkuPlans.value = true;
  try {
    const synchronized = await syncShippingSkuPlans();
    workspace.value = synchronized.workspace;
    workspaceDetailsLoaded.value = true;
    persistedWorkspace.value = cloneWorkspaceState(synchronized.workspace);
    await recalculate();
    const { mergedRecords, skippedRecords, syncedSkuPlans } =
      synchronized.summary;
    const details = [
      mergedRecords ? `合并 ${mergedRecords} 条重复 SKU 记录` : '',
      skippedRecords ? `跳过 ${skippedRecords} 条无效记录` : '',
    ].filter(Boolean);
    message.success(
      `已同步 ${syncedSkuPlans} 条 SKU 渠道计划${details.length > 0 ? `，${details.join('，')}` : ''}`,
    );
  } catch (error: any) {
    await recoverWorkspaceAfterFailure(error, 'SKU 渠道计划同步失败');
  } finally {
    syncingSkuPlans.value = false;
  }
}

function lightweightSimulationResult(
  bootstrap: ShippingWorkspaceBootstrap,
): ShippingSimulationResult {
  const emptyBuildSummary = {
    blockedBatchCount: 0,
    blockedQty: 0,
    dispatchReadyBatchCount: 0,
    dispatchReadyQty: 0,
    staPlanReadyBatchCount: 0,
    staPlanReadyQty: 0,
    totalBatchCount: 0,
    totalQty: 0,
  };
  return {
    allocations: [],
    buildBlockers: [],
    buildSummary: { ...emptyBuildSummary },
    channels: bootstrap.result.channels,
    shipmentBatches: [],
    summary: bootstrap.result.summary,
    todayBuildBlockers: [],
    todayBuildSummary: { ...emptyBuildSummary },
    todayShipmentBatches: [],
    unallocated: [],
  };
}

async function ensureWorkspaceDetails(includeSimulation = false) {
  if (
    workspaceDetailsLoaded.value &&
    (!includeSimulation || fullResultLoaded.value)
  ) {
    return;
  }
  const [loadedWorkspace, loadedResult] = await Promise.all([
    workspaceDetailsLoaded.value
      ? Promise.resolve(null)
      : fetchShippingWorkspace(),
    includeSimulation && !fullResultLoaded.value
      ? fetchShippingWorkspaceSimulation()
      : Promise.resolve(null),
  ]);
  if (loadedWorkspace) {
    workspace.value = loadedWorkspace;
    persistedWorkspace.value = cloneWorkspaceState(loadedWorkspace);
    workspaceDetailsLoaded.value = true;
    bootstrapTotalReturnedQty.value = loadedWorkspace.receipts.reduce(
      (sum, row) => sum + Number(row.returnedQty || row.goodQty || 0),
      0,
    );
  }
  if (loadedResult) {
    result.value = loadedResult;
    fullResultLoaded.value = true;
  }
}

async function selectTab(key: TabKey) {
  activeTab.value = key;
  if (key === 'dashboard') return;
  loading.value = true;
  try {
    await ensureWorkspaceDetails(key === 'allocation' || key === 'today');
  } catch (error: any) {
    activeTab.value = 'dashboard';
    message.error(errorText(error, '发货分配明细加载失败'));
  } finally {
    loading.value = false;
  }
}

async function loadPage() {
  loading.value = true;
  try {
    const [loadedMeta, bootstrap] = await Promise.all([
      fetchShippingAllocationMeta(),
      fetchShippingWorkspaceBootstrap(),
    ]);
    meta.value = loadedMeta;
    workspace.value = {
      ...bootstrap.workspace,
      lockedAllocations: [],
      receipts: [],
      skuPlans: [],
    };
    result.value = lightweightSimulationResult(bootstrap);
    bootstrapTotalReturnedQty.value = bootstrap.totalReturnedQty;
    workspaceDetailsLoaded.value = false;
    fullResultLoaded.value = false;
    persistedWorkspace.value = null;
    defaultRules.value = cloneRules(meta.value.rules);
  } catch (error: any) {
    message.error(errorText(error, '发货分配工作区加载失败'));
  } finally {
    loading.value = false;
  }
}

onMounted(loadPage);
</script>

<template>
  <div class="erp-page">
    <header class="erp-header">
      <div>
        <h1>圣诞款发货看板与分配</h1>
        <p>供应链回货、渠道计划与仓库发货分配总控</p>
      </div>
      <div class="header-meta">
        <span>{{
          saving ? '保存中...' : `已保存：${dateTime(workspace?.updatedAt)}`
        }}</span>
      </div>
    </header>

    <main class="erp-main">
      <nav class="tabbar" aria-label="圣诞款发货看板与分配功能">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-button"
          :class="[{ active: activeTab === tab.key }]"
          type="button"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <Spin :spinning="loading">
        <template v-if="workspace">
          <section v-show="activeTab === 'dashboard'" class="page-section">
            <div class="section-heading">
              <div>
                <h2>总控看板</h2>
                <p>各国家渠道计划执行进度</p>
              </div>
            </div>

            <div class="kpi-grid">
              <article class="kpi-card blue">
                <span>国家渠道总计划</span><strong>{{ integer(summary?.totalPlanQty) }}</strong><small>{{ channels.length }} 个发货渠道</small>
              </article>
              <article class="kpi-card green">
                <span>今日收货数量</span><strong>{{ integer(summary?.todayReceiptQty) }}</strong><small>按今日来货良品数量统计</small>
              </article>
              <article class="kpi-card cyan">
                <span>今日预计可发出</span><strong>{{
                  integer(summary?.todayExpectedDispatchQty)
                }}</strong><small>当前可直接交仓批次数量合计</small>
              </article>
              <article class="kpi-card green">
                <span>累计回货数量</span><strong>{{ integer(totalReturned) }}</strong><small>良品 {{ integer(summary?.totalGoodQty) }}</small>
              </article>
              <article class="kpi-card cyan">
                <span>已发货数量</span><strong>{{ integer(totalShipped) }}</strong><small>来自 STA 货件详情，仅统计目标 SKU</small>
              </article>
              <article class="kpi-card orange">
                <span>总计划完成率</span><strong>{{ percent(summary?.totalPlanCompletionRate) }}</strong><small>已发货数量 / 国家渠道总计划</small>
              </article>
              <article class="kpi-card gold">
                <span>海运发货占比</span><strong>{{ percent(summary?.shippedSeaFreightRate) }}</strong><small>目标 {{ percent(summary?.seaFreightTargetMinRate) }} -
                  {{ percent(summary?.seaFreightTargetMaxRate) }}</small>
              </article>
            </div>

            <div class="data-panel">
              <div class="panel-title">
                <h3>国家渠道执行进度</h3>
                <span>数据按当前工作区实时演算</span>
              </div>
              <div class="table-scroll dashboard-table">
                <table>
                  <thead>
                    <tr>
                      <th>优先级</th>
                      <th>国家渠道</th>
                      <th>基准计划</th>
                      <th>已发货</th>
                      <th>剩余</th>
                      <th>完成率</th>
                      <th>时效要求</th>
                      <th>分配规则</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="channel in channelResults" :key="channel.code">
                      <td>
                        <span
                          class="priority"
                          :class="[channel.priorityLevel.toLowerCase()]"
                          >{{ channel.priorityLevel }}</span>
                      </td>
                      <td>
                        <strong>{{ channel.name }}</strong><small>{{ channel.code }}</small>
                      </td>
                      <td>{{ integer(channel.plannedQty) }}</td>
                      <td class="number-positive">
                        {{ integer(channel.shippedQty) }}
                      </td>
                      <td>{{ integer(channel.shippedRemainingQty) }}</td>
                      <td>
                        <div class="progress">
                          <i
                            :style="{
                              width: `${Math.min(100, channel.shippedCompletionRate * 100)}%`,
                            }"
                          ></i>
                        </div>
                        <small>{{
                          percent(channel.shippedCompletionRate)
                        }}</small>
                      </td>
                      <td>{{ channel.deadline || '-' }}</td>
                      <td class="rule-cell">{{ channel.rule || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'today'" class="page-section">
            <div class="section-heading">
              <div>
                <h2>今日到货分配</h2>
                <p>
                  {{ todayDate }}
                  到货货件；历史来货按已发送处理，只生成今日建单批次
                </p>
              </div>
              <div class="toolbar">
                <button
                  class="button sync-button"
                  :disabled="
                    exportingTodayPlan ||
                    allocatingToday ||
                    syncingReceipts ||
                    todayReceipts.length === 0
                  "
                  type="button"
                  @click="downloadTodayBuildPlan"
                >
                  <Download :size="15" />
                  {{ exportingTodayPlan ? '正在导出...' : '导出今日建单表' }}
                </button>
                <button
                  class="button primary sync-button"
                  :disabled="allocatingToday || syncingReceipts"
                  type="button"
                  @click="allocateTodayArrivals"
                >
                  <RotateCw :size="15" />
                  {{
                    allocatingToday ? '同步分配中...' : '同步今日来货并自动分配'
                  }}
                </button>
              </div>
            </div>

            <div class="kpi-grid today-kpi-grid">
              <article class="kpi-card blue">
                <span>今日到货</span>
                <strong>{{ integer(summary?.todayReceiptQty) }}</strong>
                <small>{{ integer(summary?.todayReceiptCount) }} 条来货 /
                  {{ integer(summary?.todayReceiptSkuCount) }} 个 SKU</small>
              </article>
              <article class="kpi-card green">
                <span>生成建单</span>
                <strong>{{ integer(summary?.todayAllocatedQty) }}</strong>
                <small>{{
                    integer(summary?.todayShipmentBatchCount)
                  }}
                  个建单批次</small>
              </article>
              <article class="kpi-card cyan">
                <span>可直接交仓</span>
                <strong>{{
                  integer(summary?.todayExpectedDispatchQty)
                }}</strong>
                <small>可创建 STA
                  {{ integer(summary?.todayStaPlanReadyQty) }} 件</small>
              </article>
              <article class="kpi-card orange">
                <span>未分配</span>
                <strong>{{ integer(summary?.todayUnallocatedQty) }}</strong>
                <small>留样、凑整、缺计划或渠道不可发</small>
              </article>
            </div>

            <div v-if="todayReceipts.length === 0" class="data-panel">
              <div class="empty today-empty">
                今日暂无来货记录，请先同步来货数据。
              </div>
            </div>

            <template v-else>
              <div
                v-if="Number(summary?.todayBlockedQty || 0) > 0"
                class="warning-bar"
              >
                已生成建单中有
                {{ integer(summary?.todayBlockedQty) }}
                件尚未满足直接交仓条件，具体原因见下表状态列。
              </div>
              <div class="data-panel">
                <div class="panel-title">
                  <h3>今日建单清单</h3>
                  <span>历史分配已计入渠道占用，但不会混入以下批次</span>
                </div>
                <div class="table-scroll today-batch-table">
                  <table>
                    <thead>
                      <tr>
                        <th>建单批次</th>
                        <th>渠道 / 运输</th>
                        <th>店铺 / 目的站</th>
                        <th>SKU 建单数量</th>
                        <th>总件数 / 箱数</th>
                        <th>仓库排程 / 发走</th>
                        <th>状态 / 处理要求</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="batch in todayShipmentBatches"
                        :key="batch.batchId"
                      >
                        <td>
                          <strong>{{ batch.batchId }}</strong>
                          <small>{{
                            batch.destinationCountryCode || '-'
                          }}</small>
                        </td>
                        <td>
                          <strong>{{ batch.channelName }}</strong>
                          <small>{{ shippingModeLabel(batch.mode) }} ·
                            {{ batch.channelCode }}</small>
                        </td>
                        <td>
                          <strong>{{ batch.sellerName || '-' }}</strong>
                          <small>SID {{ batch.sid || '-' }} ·
                            {{ batch.destinationCountryCode || '-' }}</small>
                        </td>
                        <td
                          class="today-sku-cell"
                          :title="batchSkuSummary(batch)"
                        >
                          <div
                            v-for="item in batch.items"
                            :key="item.itemId"
                            class="today-sku-line"
                          >
                            <strong>{{ item.sku }} ×
                              {{ integer(item.allocationQty) }}</strong>
                            <small>{{ item.msku || '缺 MSKU' }} /
                              {{ item.fnsku || '缺 FNSKU' }}</small>
                          </div>
                        </td>
                        <td>
                          <strong>{{ integer(batch.qty) }} 件</strong>
                          <small>{{ batch.estimatedBoxes ?? '-' }} 箱 /
                            {{ integer(batch.skuCount) }} 个 SKU</small>
                        </td>
                        <td>
                          {{ batchSchedule(batch) }}
                          <small>发走 {{ batch.plannedDispatchDate || '-' }} / 截止
                            {{ batch.deadline || '-' }}</small>
                        </td>
                        <td>
                          <span
                            class="status"
                            :class="[batchStatusClass(batch.status)]"
                            >{{ batchStatusLabel(batch.status) }}</span>
                          <small class="today-blocker-text">
                            {{
                              batchBlockerSummary(batch) ||
                              '规则校验通过，可按此批次建单发货'
                            }}
                          </small>
                        </td>
                      </tr>
                      <tr v-if="todayShipmentBatches.length === 0">
                        <td class="empty" colspan="7">
                          今日分配尚未形成建单批次
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <template v-if="todayUnallocated.length > 0">
                <div class="subsection-heading">
                  <h3>今日未分配明细</h3>
                  <span>{{
                      integer(summary?.todayUnallocatedQty)
                    }}
                    件需要处理</span>
                </div>
                <div class="data-panel">
                  <div class="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>店铺</th>
                          <th>SPU</th>
                          <th>SKU</th>
                          <th>未分配数量</th>
                          <th>原因</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="row in todayUnallocated"
                          :key="`${row.receiptId}-${row.reasonCode || row.reason}`"
                        >
                          <td>{{ row.shop || '-' }}</td>
                          <td>{{ row.spu || '-' }}</td>
                          <td>
                            <strong>{{ row.sku }}</strong>
                          </td>
                          <td class="number-danger">{{ integer(row.qty) }}</td>
                          <td class="rule-cell">{{ row.reason }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </template>
            </template>
          </section>

          <section v-show="activeTab === 'receipts'" class="page-section">
            <div class="section-heading">
              <div>
                <h2>来货数据</h2>
                <p>数据来自图励-2026年圣诞款发货计划</p>
              </div>
              <div class="toolbar">
                <button
                  class="button primary sync-button"
                  :disabled="syncingReceipts || allocatingToday"
                  type="button"
                  @click="synchronizeReceipts"
                >
                  <RotateCw :size="15" />
                  {{ syncingReceipts ? '同步中...' : '同步来货数据' }}
                </button>
              </div>
            </div>
            <div class="data-panel">
              <div class="panel-title">
                <h3>来货记录</h3>
                <span>共 {{ receipts.length }} 条</span>
              </div>
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>来货日期</th>
                      <th>供应商</th>
                      <th>店铺</th>
                      <th>SPU</th>
                      <th>SKU</th>
                      <th>回货数量</th>
                      <th>良品数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in receipts" :key="row.receiptId">
                      <td>{{ row.receiptDate }}</td>
                      <td>{{ row.supplier || '-' }}</td>
                      <td>{{ row.shop || '-' }}</td>
                      <td>{{ row.spu || '-' }}</td>
                      <td>
                        <strong>{{ row.sku }}</strong>
                      </td>
                      <td>{{ integer(row.returnedQty || row.goodQty) }}</td>
                      <td>{{ integer(row.goodQty) }}</td>
                    </tr>
                    <tr v-if="receipts.length === 0">
                      <td class="empty" colspan="7">暂无来货记录</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'sku'" class="page-section">
            <div class="section-heading">
              <div>
                <h2>SKU 渠道计划</h2>
                <p>
                  空运数量独立保留；非空运先按 SKU
                  渠道计划逐渠道分配，计划渠道不可发时再同国升级
                </p>
              </div>
              <div class="toolbar">
                <button
                  class="button primary sync-button"
                  :disabled="syncingSkuPlans"
                  type="button"
                  @click="synchronizeSkuPlans"
                >
                  <RotateCw :size="15" />
                  {{ syncingSkuPlans ? '同步中...' : '同步 SKU 渠道计划' }}
                </button>
              </div>
            </div>
            <div class="data-panel wide-panel">
              <div class="table-scroll sku-table">
                <table>
                  <thead>
                    <tr>
                      <th class="sticky-col first">SPU</th>
                      <th class="sticky-col second">SKU</th>
                      <th>类型</th>
                      <th v-for="channel in channels" :key="channel.code">
                        {{ channel.name }}<small>{{ channel.code }}</small>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="plan in skuPlans"
                      :key="`${plan.spu}-${plan.sku}`"
                    >
                      <td class="sticky-col first">{{ plan.spu || '-' }}</td>
                      <td class="sticky-col second">
                        <strong>{{ plan.sku || '-' }}</strong>
                      </td>
                      <td>
                        <span
                          class="plan-type"
                          :class="plan.productType === '新品' ? 'new' : 'old'"
                        >
                          {{ plan.productType || '老品' }}
                        </span>
                      </td>
                      <td v-for="channel in channels" :key="channel.code">
                        {{ integer(plan.channelTargets[channel.code]) }}
                      </td>
                    </tr>
                    <tr v-if="skuPlans.length === 0">
                      <td class="empty" :colspan="channels.length + 3">
                        暂无 SKU 渠道计划
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'allocation'" class="page-section">
            <div class="section-heading">
              <div>
                <h2>自动分配结果</h2>
                <p>
                  默认按店铺、目的站和渠道生成 STA
                  建单批次；来货行仅用于数量追溯
                </p>
              </div>
              <div class="toolbar">
                <select v-model="channelFilter">
                  <option value="">全部渠道</option>
                  <option
                    v-for="channel in channels"
                    :key="channel.code"
                    :value="channel.code"
                  >
                    {{ channel.name }}
                  </option>
</select><select v-model="buildStateFilter">
                  <option value="">全部建单状态</option>
                  <option value="dispatch_ready">可直接交仓</option>
                  <option value="sta_ready">可创建 STA（含可交仓）</option>
                  <option value="blocked">存在阻断</option>
</select><button
                  class="button sync-button"
                  :disabled="exportingBuildPlan"
                  type="button"
                  @click="downloadBuildPlan"
                >
                  <Download :size="15" />
                  {{ exportingBuildPlan ? '正在导出' : '导出建单表' }}
</button><button
                  class="button primary"
                  type="button"
                  @click="recalculateAndSave('未锁定数据已重新分配')"
                >
                  重新分配全部未锁定
                </button>
              </div>
            </div>
            <div class="allocation-scope-bar">
              <span>到货良品
                <strong>{{ integer(summary?.totalGoodQty) }}</strong></span>
              <span>STA 已发货抵扣
                <strong>{{
                  integer(summary?.deductedShippedQty)
                }}</strong></span>
              <span>本次建议
                <strong>{{ integer(summary?.proposedQty) }}</strong></span><span>可创建 STA 计划
                <strong>{{
                  integer(result?.buildSummary.staPlanReadyQty)
                }}</strong></span><span>可直接交仓
                <strong>{{
                  integer(result?.buildSummary.dispatchReadyQty)
                }}</strong></span>
            </div>
            <div v-if="result?.buildBlockers.length" class="build-blocker-bar">
              <strong>当前阻断</strong>
              <span v-for="blocker in result.buildBlockers" :key="blocker.code">
                {{ blocker.label }} {{ integer(blocker.qty) }} 件 /
                {{ integer(blocker.affectedSkuCount) }} 个 SKU
              </span>
            </div>
            <div v-if="result?.unallocated.length" class="warning-bar">
              有
              {{ integer(summary?.unallocatedQty) }}
              件尚未分配，请检查渠道剩余计划、SKU 计划或主市场释放门槛。
            </div>
            <div class="allocation-view-switch" aria-label="分配结果视图">
              <button
                :class="[{ active: allocationView === 'batches' }]"
                type="button"
                @click="allocationView = 'batches'"
              >
                建单批次 {{ integer(result?.buildSummary.totalBatchCount) }}
              </button>
              <button
                :class="[{ active: allocationView === 'trace' }]"
                type="button"
                @click="allocationView = 'trace'"
              >
                来货来源追溯 {{ integer(allocations.length) }}
              </button>
            </div>
            <div v-if="allocationView === 'batches'" class="data-panel">
              <div class="table-scroll shipment-batch-table">
                <table>
                  <thead>
                    <tr>
                      <th>建单批次</th>
                      <th>渠道</th>
                      <th>店铺 / SID</th>
                      <th>目的站</th>
                      <th>SKU / 件数</th>
                      <th>预计箱数</th>
                      <th>仓库处理</th>
                      <th>计划发走</th>
                      <th>状态</th>
                      <th>明细</th>
                    </tr>
                  </thead>
                  <tbody>
                    <template
                      v-for="batch in filteredShipmentBatches"
                      :key="batch.batchId"
                    >
                      <tr>
                        <td>
                          <strong>{{ batch.batchId }}</strong>
                          <small>{{
                              batch.canCreateStaPlan ? '标识完整' : '不可建单'
                            }}
                            / {{ shippingModeLabel(batch.mode) }}</small>
                        </td>
                        <td>
                          {{ batch.channelName
                          }}<small>{{ batch.channelCode }}</small>
                        </td>
                        <td>
                          <strong>{{ batch.sellerName || '-' }}</strong>
                          <small>SID {{ batch.sid || '-' }}</small>
                        </td>
                        <td>{{ batch.destinationCountryCode || '-' }}</td>
                        <td>
                          <strong>{{ integer(batch.skuCount) }} 个 SKU</strong>
                          <small>{{ integer(batch.qty) }} 件</small>
                        </td>
                        <td class="carton-estimate-cell">
                          <strong>{{ batch.estimatedBoxes ?? '-' }}</strong>
                          <small>{{
                            batch.estimatedBoxes === null
                              ? '待补箱数依据'
                              : 'SKU 合计'
                          }}</small>
                        </td>
                        <td>
                          {{ batchSchedule(batch) }}
                          <small v-if="batch.warehouseReadyDate">按仓库日产能排程</small>
                        </td>
                        <td>
                          {{ batch.plannedDispatchDate || '-' }}
                          <small v-if="batch.deadline">截止 {{ batch.deadline }}</small>
                        </td>
                        <td>
                          <span
                            class="status"
                            :class="[batchStatusClass(batch.status)]"
                            >{{ batchStatusLabel(batch.status) }}</span>
                          <small
                            v-if="
                              batch.canCreateStaPlan && !batch.readyForDispatch
                            "
                          >
                            可先创建 STA 计划
                          </small>
                        </td>
                        <td>
                          <button
                            class="detail-button"
                            type="button"
                            @click="toggleBatch(batch)"
                          >
                            {{
                              expandedBatchIds.includes(batch.batchId)
                                ? '收起'
                                : '展开'
                            }}
                          </button>
                        </td>
                      </tr>
                      <tr
                        v-if="expandedBatchIds.includes(batch.batchId)"
                        class="batch-detail-row"
                      >
                        <td colspan="10">
                          <div
                            v-if="batch.blockers.length > 0"
                            class="batch-blockers"
                          >
                            <span
                              v-for="blocker in batch.blockers"
                              :key="blocker.code"
                            >
                              <strong>{{ blocker.label }}</strong>
                              {{ blocker.detail }}
                            </span>
                          </div>
                          <div class="batch-item-scroll">
                            <table class="batch-item-table">
                              <thead>
                                <tr>
                                  <th>SPU</th>
                                  <th>SKU</th>
                                  <th>店铺</th>
                                  <th>MSKU</th>
                                  <th>FNSKU</th>
                                  <th>渠道目标</th>
                                  <th>STA 已占用</th>
                                  <th>本次建单</th>
                                  <th>建单后累计</th>
                                  <th>预计箱数</th>
                                  <th>来货来源</th>
                                  <th>校验</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr
                                  v-for="item in batch.items"
                                  :key="item.itemId"
                                >
                                  <td>{{ item.spu || '-' }}</td>
                                  <td>
                                    <strong>{{ item.sku }}</strong>
                                  </td>
                                  <td>{{ item.shop || '-' }}</td>
                                  <td>
                                    {{ item.msku || '-' }}
                                    <small
                                      v-if="item.listingCandidates.length === 1"
                                    >
                                      {{
                                        item.listingCandidates[0]?.source ===
                                        'fba_inventory'
                                          ? '当前 FBA Listing'
                                          : 'STA 历史回补'
                                      }}
                                    </small>
                                  </td>
                                  <td>{{ item.fnsku || '-' }}</td>
                                  <td>{{ integer(item.targetQty) }}</td>
                                  <td>{{ integer(item.shippedQty) }}</td>
                                  <td class="number-positive">
                                    {{ integer(item.allocationQty) }}
                                  </td>
                                  <td>
                                    {{ integer(item.targetAfterBuildQty) }}
                                  </td>
                                  <td>{{ item.estimatedBoxes ?? '-' }}</td>
                                  <td>
                                    {{ integer(item.sourceReceipts.length) }} 批
                                    <small>{{
                                      item.sourceReceipts[0]?.shop ||
                                      item.shop ||
                                      '-'
                                    }}</small>
                                  </td>
                                  <td class="item-validation-cell">
                                    <span
                                      v-if="item.blockers.length === 0"
                                      class="validation-ok"
                                      >通过</span>
                                    <template v-else>
                                      <span
                                        v-for="blocker in item.blockers"
                                        :key="blocker.code"
                                        >{{ blocker.label }}</span>
                                    </template>
                                    <small
                                      v-if="item.listingCandidates.length > 1"
                                    >
                                      {{
                                        integer(item.listingCandidates.length)
                                      }}
                                      个候选建单商品
                                    </small>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    </template>
                    <tr v-if="filteredShipmentBatches.length === 0">
                      <td class="empty" colspan="10">
                        暂无符合筛选条件的建单批次
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else class="data-panel">
              <div class="table-scroll allocation-table">
                <table>
                  <thead>
                    <tr>
                      <th>来货日期</th>
                      <th>店铺</th>
                      <th>SPU</th>
                      <th>SKU</th>
                      <th>分配渠道</th>
                      <th>分配数量</th>
                      <th>预计箱数</th>
                      <th>状态</th>
                      <th>规则提示</th>
                      <th>锁定</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in filteredAllocations"
                      :key="`${row.allocationId}-${row.locked}`"
                    >
                      <td>{{ row.receiptDate || '-' }}</td>
                      <td>{{ row.shop || '-' }}</td>
                      <td>{{ row.spu || '-' }}</td>
                      <td>
                        <strong>{{ row.sku }}</strong>
                      </td>
                      <td>
                        {{ row.channelName
                        }}<small>{{ row.channelCode }}</small>
                      </td>
                      <td class="number-positive">{{ integer(row.qty) }}</td>
                      <td class="carton-estimate-cell">
                        <strong>{{ row.estimatedBoxes ?? '-' }}</strong>
                        <small
                          v-if="cartonEstimateLabel(row)"
                          :title="row.cartonEstimateDetail"
                          >{{ cartonEstimateLabel(row) }}</small>
                      </td>
                      <td>
                        <span class="status" :class="[statusClass(row.status)]">
                          {{ statusLabel(row.status) }}
                        </span>
                      </td>
                      <td class="rule-cell">{{ row.note }}</td>
                      <td>
                        <button
                          class="lock-switch"
                          :class="[{ locked: row.locked }]"
                          type="button"
                          @click="toggleLock(row)"
                        >
                          <i></i><span>{{ row.locked ? '已锁定' : '未锁定' }}</span>
                        </button>
                      </td>
                    </tr>
                    <tr v-if="filteredAllocations.length === 0">
                      <td class="empty" colspan="10">暂无自动分配结果</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <template v-if="result?.unallocated.length">
              <div class="subsection-heading">
                <h3>未分配明细</h3>
                <span>需要调整渠道、计划或人工处理</span>
              </div>
              <div class="data-panel">
                <div class="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>来货日期</th>
                        <th>店铺</th>
                        <th>SPU</th>
                        <th>SKU</th>
                        <th>未分配数量</th>
                        <th>原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in result.unallocated"
                        :key="`${row.receiptId}-${row.sku}`"
                      >
                        <td>{{ row.receiptDate || '-' }}</td>
                        <td>{{ row.shop || '-' }}</td>
                        <td>{{ row.spu || '-' }}</td>
                        <td>
                          <strong>{{ row.sku }}</strong>
                        </td>
                        <td class="number-danger">{{ integer(row.qty) }}</td>
                        <td class="rule-cell">{{ row.reason }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </section>

          <section v-show="activeTab === 'channels'" class="page-section">
            <div class="section-heading">
              <div>
                <h2>渠道配置</h2>
                <p>计划量由 SKU 渠道计划自动汇总；这里只维护分配策略</p>
              </div>
              <button
                class="button primary"
                type="button"
                @click="saveChannels"
              >
                保存渠道配置
              </button>
            </div>
            <div class="data-panel">
              <div class="panel-title">
                <h3>国家渠道</h3>
                <span>{{
                    channels.length
                  }}
                  个渠道，名称、代码和运输方式由系统维护</span>
              </div>
              <div class="table-scroll channel-plan-table">
                <table>
                  <thead>
                    <tr>
                      <th>国家渠道</th>
                      <th>SKU 计划量</th>
                      <th>市场优先级</th>
                      <th>时效要求</th>
                      <th>分配规则</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="channel in channels" :key="channel.code">
                      <td class="channel-identity">
                        <div>
                          <strong>{{ channel.name }}</strong>
                          <span
                            class="mode-badge"
                            :class="[`mode-${channel.mode}`]"
                          >
                            {{ shippingModeLabel(channel.mode) }}
                          </span>
                        </div>
                        <small>{{ channel.code }} · {{ channel.country }}</small>
                      </td>
                      <td class="channel-plan-qty">
                        <strong>{{ integer(channel.plannedQty) }}</strong>
                        <small>SKU 汇总</small>
                      </td>
                      <td>
                        <select
                          v-model="channel.priorityLevel"
                          class="priority-select"
                          :class="[
                            `priority-${channel.priorityLevel.toLowerCase()}`,
                          ]"
                        >
                          <option value="P0">P0 · 核心</option>
                          <option value="P1">P1 · 主要</option>
                          <option value="P2">P2 · 弹性</option>
                        </select>
                      </td>
                      <td>
                        <input
                          v-model.trim="channel.deadline"
                          class="deadline-input"
                        />
                      </td>
                      <td>
                        <textarea
                          v-model.trim="channel.rule"
                          class="rule-input"
                          rows="2"
                        ></textarea>
                      </td>
                      <td>
                        <button
                          :aria-pressed="channel.enabled !== false"
                          class="channel-toggle"
                          :class="[{ enabled: channel.enabled !== false }]"
                          type="button"
                          @click="channel.enabled = channel.enabled === false"
                        >
                          <i></i>
                          <span>{{
                            channel.enabled === false ? '已停用' : '已启用'
                          }}</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'rules'" class="page-section">
            <div class="section-heading">
              <div>
                <h2>规则设置</h2>
                <p>参数会直接参与下一次自动分配</p>
              </div>
              <div class="toolbar">
                <button
                  class="button secondary"
                  type="button"
                  @click="restoreDefaultRules"
                >
                  恢复默认
</button><button
                  class="button primary"
                  type="button"
                  @click="saveRules"
                >
                  保存规则
                </button>
              </div>
            </div>
            <div class="settings-grid">
              <label><span>美国 SKU 货件凑整单位</span><input disabled type="number" value="5" /><small>美国固定按 5 件凑整；其他国家按实际可发数量发货</small></label>
              <label><span>美国一致装箱核心箱数</span><input
                  v-model.number="workspace.rules.usMinBoxes"
                  min="1"
                  type="number"
                /><small>同一建单批次前 5 箱配置一致，可多 SKU
                  混装；后续箱自由混装</small></label>
              <label><span>美国 SKU 凑箱等待时间（小时）</span><input
                  v-model.number="workspace.rules.usWaitHours"
                  min="0"
                  type="number"
                /><small>到期后转为人工复核</small></label>
              <label><span>交仓节点预警天数</span><input
                  v-model.number="workspace.rules.deadlineWarningDays"
                  max="30"
                  min="0"
                  type="number"
                /><small>临近节点时，美国优先美东；加拿大不再继续等整批</small></label>
              <label><span>加拿大海运整批释放比例（%）</span><input
                  :value="
                    Math.round(workspace.rules.canadaSeaReleaseRate * 100)
                  "
                  max="100"
                  min="0"
                  type="number"
                  @input="
                    workspace.rules.canadaSeaReleaseRate =
                      Number(($event.target as HTMLInputElement).value) / 100
                  "
                /><small>未达比例先进入加拿大整批池，固定空运量已独立保留</small></label>
              <label><span>英国 IEN 最低箱数</span><input :value="workspace.rules.ukIenMinBoxes" disabled /><small>不按件数限制；同一店铺、同一非空运渠道可合并多个 SKU，至少 6
                  箱才可直接交仓</small></label>
              <label><span>仓库每日处理能力（件）</span><input
                  v-model.number="workspace.rules.warehouseDailyCapacity"
                  min="1"
                  type="number"
                /><small>用于按到货日期安排建单批次的仓库开始和完成时间</small></label>
              <label><span>主市场完成率门槛（%）</span><input
                  :value="
                    Math.round(workspace.rules.primaryCompletionRate * 100)
                  "
                  max="100"
                  min="0"
                  type="number"
                  @input="
                    workspace.rules.primaryCompletionRate =
                      Number(($event.target as HTMLInputElement).value) / 100
                  "
                /><small>超过门槛后才释放澳洲、中东全部渠道</small></label>
              <label><span>5箱凑箱统一处理截止日</span><input
                  v-model="workspace.rules.usCartonDeadline"
                  type="date"
                /><small>与等待时间取较早日期；到期转运营确认拼箱、拆分或升级</small></label>
              <label><span>海运占比目标下限（%）</span><input
                  :value="
                    Math.round(workspace.rules.seaFreightTargetMinRate * 100)
                  "
                  max="100"
                  min="0"
                  type="number"
                  @input="
                    workspace.rules.seaFreightTargetMinRate =
                      Number(($event.target as HTMLInputElement).value) / 100
                  "
                /><small>会议目标下限为 70%</small></label>
              <label><span>海运占比目标上限（%）</span><input
                  :value="
                    Math.round(workspace.rules.seaFreightTargetMaxRate * 100)
                  "
                  max="100"
                  min="0"
                  type="number"
                  @input="
                    workspace.rules.seaFreightTargetMaxRate =
                      Number(($event.target as HTMLInputElement).value) / 100
                  "
                /><small>会议目标上限为 80%</small></label>
            </div>
          </section>
        </template>
      </Spin>
    </main>
  </div>
</template>

<style scoped>
.erp-page {
  min-height: calc(100vh - 104px);
  font-size: 13px;
  color: #1f2937;
  background: #f3f6fa;
}

.erp-header {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  min-height: 62px;
  padding: 10px 24px;
  color: #fff;
  background: #15263b;
}

.erp-header h1 {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0;
}

.erp-header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #b9c7d8;
}

.header-meta {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 12px;
  color: #b9c7d8;
}

.erp-main {
  width: min(1500px, 100%);
  padding: 16px 20px 28px;
  margin: 0 auto;
}

.tabbar {
  display: flex;
  gap: 6px;
  padding: 5px;
  margin-bottom: 14px;
  overflow-x: auto;
  background: #fff;
  border: 1px solid #dce3ec;
  border-radius: 8px;
}

.tab-button {
  min-width: 126px;
  padding: 9px 16px;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.tab-button:hover {
  color: #1d4ed8;
  background: #eff6ff;
}

.tab-button.active {
  color: #fff;
  background: #2563eb;
  box-shadow: 0 2px 5px rgb(37 99 235 / 25%);
}

.page-section {
  min-height: 560px;
}

.section-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  margin-bottom: 12px;
}

.section-heading h2 {
  margin: 0;
  font-size: 18px;
  color: #182435;
  letter-spacing: 0;
}

.section-heading p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #718096;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.button {
  min-height: 32px;
  padding: 6px 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  background: #fff;
  border: 1px solid #cfd8e5;
  border-radius: 5px;
}

.button:hover {
  color: #1d4ed8;
  border-color: #2563eb;
}

.button.primary {
  color: #fff;
  background: #2563eb;
  border-color: #2563eb;
}

.button.primary:hover {
  background: #1d4ed8;
}

.sync-button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

input,
select,
textarea {
  min-height: 32px;
  padding: 5px 8px;
  font: inherit;
  color: #1f2937;
  outline: none;
  background: #fff;
  border: 1px solid #cfd8e5;
  border-radius: 4px;
}

input:focus,
select:focus,
textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgb(37 99 235 / 10%);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.today-kpi-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.kpi-card {
  position: relative;
  min-height: 112px;
  padding: 17px 19px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e1e7ef;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(30 41 59 / 5%);
}

.kpi-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  content: '';
  background: #2563eb;
}

.kpi-card.green::before {
  background: #16a34a;
}

.kpi-card.cyan::before {
  background: #0891b2;
}

.kpi-card.orange::before {
  background: #ea580c;
}

.kpi-card.gold::before {
  background: #ca8a04;
}

.kpi-card span,
.kpi-card small {
  display: block;
  color: #64748b;
}

.kpi-card strong {
  display: block;
  margin: 5px 0 2px;
  font-size: 28px;
  line-height: 1.15;
  color: #162235;
}

.data-panel {
  overflow: hidden;
  background: #fff;
  border: 1px solid #dce3ec;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(30 41 59 / 4%);
}

.panel-title {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 47px;
  padding: 0 15px;
  border-bottom: 1px solid #e5eaf1;
}

.panel-title h3 {
  margin: 0;
  font-size: 14px;
}

.panel-title span {
  font-size: 12px;
  color: #718096;
}

.panel-title > div {
  display: flex;
  gap: 12px;
  align-items: center;
}

.table-scroll {
  max-width: 100%;
  max-height: 570px;
  overflow: auto;
}

table {
  width: 100%;
  border-spacing: 0;
  border-collapse: separate;
  background: #fff;
}

th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 10px 11px;
  font-size: 12px;
  color: #334155;
  text-align: left;
  white-space: nowrap;
  background: #edf5ff;
  border-bottom: 1px solid #d8e2ee;
}

td {
  padding: 9px 11px;
  vertical-align: middle;
  color: #3c4858;
  white-space: nowrap;
  border-bottom: 1px solid #e8edf3;
}

tbody tr:hover td {
  background: #f8fbff;
}

td strong {
  color: #1e293b;
}

td small,
th small {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: #8290a3;
}

.rule-cell {
  max-width: 340px;
  line-height: 1.45;
  white-space: normal;
}

.carton-estimate-cell strong {
  color: #087e45;
}

.number-positive {
  font-weight: 700;
  color: #087e45;
}

.number-danger {
  font-weight: 700;
  color: #b42318;
}

.priority,
.status {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
}

.priority.p0 {
  color: #b91c1c;
  background: #fee2e2;
}

.priority.p1 {
  color: #a16207;
  background: #fef3c7;
}

.priority.p2 {
  color: #475569;
  background: #e2e8f0;
}

.status {
  color: #475569;
  background: #e8eef6;
}

.status.proposed {
  color: #15803d;
  background: #dcfce7;
}

.status.ready {
  color: #166534;
  background: #dcfce7;
}

.status.locked {
  color: #1d4ed8;
  background: #dbeafe;
}

.status.needs-review {
  color: #c2410c;
  background: #ffedd5;
}

.status.waiting-sku-carton,
.status.waiting-ca-consolidation,
.status.waiting-uk-ien,
.status.waiting-ca-batch,
.status.waiting-carton,
.status.waiting-ien {
  color: #a16207;
  background: #fef3c7;
}

.status.ambiguous-listing,
.status.missed-deadline,
.status.missing-listing {
  color: #b42318;
  background: #fee2e2;
}

.progress {
  width: 112px;
  height: 7px;
  margin-bottom: 3px;
  overflow: hidden;
  background: #e7edf4;
  border-radius: 4px;
}

.progress i {
  display: block;
  height: 100%;
  background: #2563eb;
  border-radius: inherit;
}

.settings-grid label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 120px;
  padding: 15px;
  font-size: 12px;
  color: #536174;
  background: #fafcff;
  border: 1px solid #e4e9f0;
  border-radius: 6px;
}

.empty {
  height: 120px;
  color: #94a3b8;
  text-align: center;
}

.sku-table table {
  min-width: 2200px;
}

.sku-table th {
  text-align: center;
}

.sku-table td {
  padding: 6px;
}

.plan-type {
  display: inline-block;
  min-width: 38px;
  padding: 2px 6px;
  font-size: 12px;
  text-align: center;
  border-radius: 999px;
}

.plan-type.new {
  color: #9a3412;
  background: #ffedd5;
}

.plan-type.old {
  color: #166534;
  background: #dcfce7;
}

.sku-table .sticky-col {
  position: sticky;
  z-index: 3;
  background: #fff;
}

.sku-table th.sticky-col {
  z-index: 4;
  background: #edf5ff;
}

.sku-table .first {
  left: 0;
  min-width: 130px;
}

.sku-table .second {
  left: 130px;
  min-width: 150px;
  box-shadow: 3px 0 5px rgb(15 23 42 / 6%);
}

.sku-table .first input {
  width: 114px;
}

.sku-table .second input {
  width: 134px;
}

.warning-bar {
  padding: 9px 12px;
  margin-bottom: 10px;
  color: #b45309;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 5px;
}

.warning-bar.critical {
  color: #991b1b;
  background: #fff1f2;
  border-color: #fecdd3;
}

.build-blocker-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 18px;
  align-items: center;
  padding: 9px 12px;
  margin-bottom: 10px;
  font-size: 12px;
  color: #7c2d12;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 5px;
}

.build-blocker-bar > strong {
  color: #9a3412;
}

.allocation-view-switch {
  display: inline-flex;
  padding: 3px;
  margin-bottom: 9px;
  background: #e8eef6;
  border: 1px solid #d7e0eb;
  border-radius: 5px;
}

.allocation-view-switch button {
  min-height: 29px;
  padding: 4px 12px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 3px;
}

.allocation-view-switch button.active {
  color: #174b7a;
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 12%);
}

.allocation-scope-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  padding: 10px 12px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #536174;
  background: #eef6ff;
  border: 1px solid #cfe3fb;
  border-radius: 6px;
}

.allocation-scope-bar strong {
  margin-left: 5px;
  color: #174b7a;
}

.subsection-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 16px 0 8px;
}

.subsection-heading h3 {
  margin: 0;
  font-size: 15px;
  color: #1e293b;
}

.subsection-heading span {
  font-size: 12px;
  color: #7b8798;
}

.allocation-table table {
  min-width: 1160px;
}

.shipment-batch-table table {
  min-width: 1450px;
}

.today-batch-table table {
  min-width: 1280px;
}

.today-empty {
  display: grid;
  place-items: center;
  min-height: 220px;
}

.today-sku-cell {
  min-width: 260px;
  white-space: normal;
}

.today-sku-line + .today-sku-line {
  padding-top: 7px;
  margin-top: 7px;
  border-top: 1px solid #edf1f5;
}

.today-blocker-text {
  max-width: 300px;
  line-height: 1.4;
  color: #64748b;
  white-space: normal;
}

.detail-button {
  min-width: 48px;
  padding: 4px 8px;
  font-weight: 600;
  color: #1d4ed8;
  cursor: pointer;
  background: transparent;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
}

.detail-button:hover {
  background: #eff6ff;
}

.batch-detail-row > td,
.batch-detail-row:hover > td {
  padding: 0;
  white-space: normal;
  background: #f8fafc;
}

.batch-blockers {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 18px;
  padding: 10px 13px;
  font-size: 12px;
  color: #9a3412;
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
}

.batch-blockers strong {
  margin-right: 4px;
}

.batch-item-scroll {
  max-width: calc(100vw - 110px);
  overflow-x: auto;
}

.batch-item-table {
  min-width: 1380px;
}

.batch-item-table th {
  position: static;
  background: #f1f5f9;
}

.batch-item-table td {
  font-size: 12px;
  background: #fff;
}

.item-validation-cell {
  max-width: 260px;
  white-space: normal;
}

.item-validation-cell > span {
  display: block;
  color: #b45309;
}

.item-validation-cell .validation-ok {
  color: #15803d;
}

.channel-plan-table table {
  min-width: 1120px;
}

.channel-plan-table th:nth-child(1) {
  min-width: 250px;
}

.channel-plan-table th:nth-child(2) {
  min-width: 110px;
}

.channel-plan-table th:nth-child(3) {
  min-width: 130px;
}

.channel-plan-table th:nth-child(4) {
  min-width: 170px;
}

.channel-plan-table th:nth-child(5) {
  min-width: 360px;
}

.channel-plan-table th:nth-child(6) {
  min-width: 100px;
}

.channel-identity > div {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mode-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  background: #e2e8f0;
  border-radius: 4px;
}

.mode-badge.mode-sea {
  color: #1d4ed8;
  background: #dbeafe;
}

.mode-badge.mode-truck {
  color: #a16207;
  background: #fef3c7;
}

.mode-badge.mode-air {
  color: #7e22ce;
  background: #f3e8ff;
}

.channel-plan-qty strong,
.channel-plan-qty small {
  text-align: right;
}

.channel-plan-qty strong {
  display: block;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.priority-select,
.deadline-input,
.rule-input {
  width: 100%;
}

.priority-select {
  font-weight: 700;
}

.priority-select.priority-p0 {
  color: #b91c1c;
  background: #fff7f7;
}

.priority-select.priority-p1 {
  color: #a16207;
  background: #fffdf5;
}

.priority-select.priority-p2 {
  color: #475569;
  background: #f8fafc;
}

.deadline-input {
  min-width: 160px;
}

.rule-input {
  min-width: 340px;
  min-height: 48px;
  line-height: 1.4;
  resize: vertical;
}

.channel-toggle {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  min-width: 82px;
  padding: 0;
  color: #64748b;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.channel-toggle i {
  position: relative;
  width: 30px;
  height: 17px;
  background: #cbd5e1;
  border-radius: 10px;
}

.channel-toggle i::after {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  content: '';
  background: #fff;
  border-radius: 50%;
  transition: transform 0.16s ease;
}

.channel-toggle.enabled {
  color: #15803d;
}

.channel-toggle.enabled i {
  background: #16a34a;
}

.channel-toggle.enabled i::after {
  transform: translateX(13px);
}

.lock-switch {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-width: 82px;
  padding: 0;
  color: #64748b;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.lock-switch i {
  position: relative;
  width: 30px;
  height: 17px;
  background: #cbd5e1;
  border-radius: 10px;
}

.lock-switch i::after {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  content: '';
  background: #fff;
  border-radius: 50%;
  transition: transform 0.16s ease;
}

.lock-switch.locked {
  color: #1d4ed8;
}

.lock-switch.locked i {
  background: #2563eb;
}

.lock-switch.locked i::after {
  transform: translateX(13px);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 14px;
  padding: 18px;
  background: #fff;
  border: 1px solid #dce3ec;
  border-radius: 8px;
}

.settings-grid label > span {
  font-weight: 700;
  color: #263548;
}

.settings-grid input {
  margin-top: 5px;
  font-size: 16px;
  font-weight: 600;
}

.settings-grid small {
  line-height: 1.45;
  color: #8491a3;
}

@media (max-width: 1080px) {
  .kpi-grid,
  .today-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .settings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 680px) {
  .erp-header,
  .section-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-meta {
    justify-content: space-between;
    width: 100%;
  }

  .erp-main {
    padding: 10px;
  }

  .kpi-grid,
  .today-kpi-grid,
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .tab-button {
    min-width: 112px;
  }

  .toolbar {
    width: 100%;
  }

  .button {
    flex: 1;
  }
}

@media print {
  .erp-header,
  .tabbar,
  .toolbar {
    display: none !important;
  }

  .erp-page {
    background: #fff;
  }

  .erp-main {
    width: 100%;
    padding: 0;
  }

  .page-section {
    display: none !important;
  }

  .page-section:first-of-type {
    display: block !important;
  }

  .data-panel,
  .kpi-card {
    box-shadow: none;
  }
}
</style>
