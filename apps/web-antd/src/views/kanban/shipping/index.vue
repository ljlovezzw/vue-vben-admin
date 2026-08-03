<script setup lang="ts">
import type {
  ShippingAllocationMeta,
  ShippingAllocationRow,
  ShippingReceipt,
  ShippingSimulationResult,
  ShippingWorkspaceState,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';

import { message, Modal, Spin } from 'ant-design-vue';

import {
  downloadShippingReceiptTemplate,
  downloadShippingSkuPlanTemplate,
  exportShippingWorkspace,
  fetchShippingAllocationMeta,
  fetchShippingWorkspace,
  importShippingReceipts,
  importShippingSkuPlans,
  resetShippingWorkspace,
  saveShippingWorkspace,
  simulateShippingAllocation,
} from '#/api/kanban';

type TabKey =
  | 'allocation'
  | 'channels'
  | 'dashboard'
  | 'receipts'
  | 'rules'
  | 'sku';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: '总控看板' },
  { key: 'receipts', label: '来货录入' },
  { key: 'sku', label: 'SKU渠道计划' },
  { key: 'allocation', label: '自动分配结果' },
  { key: 'channels', label: '国家渠道总计划' },
  { key: 'rules', label: '规则设置' },
];

const activeTab = ref<TabKey>('dashboard');
const loading = ref(true);
const saving = ref(false);
const meta = ref<null | ShippingAllocationMeta>(null);
const workspace = ref<null | ShippingWorkspaceState>(null);
const result = ref<null | ShippingSimulationResult>(null);
const channelFilter = ref('');
const defaultRules = ref<null | ShippingWorkspaceState['rules']>(null);

const receiptForm = reactive({
  boxQty: 0,
  goodQty: 0,
  note: '',
  receiptDate: new Date().toISOString().slice(0, 10),
  returnedQty: 0,
  sku: '',
  spu: '',
  supplier: '',
});

const channels = computed(() => workspace.value?.channels ?? []);
const receipts = computed(() => workspace.value?.receipts ?? []);
const skuPlans = computed(() => workspace.value?.skuPlans ?? []);
const allocations = computed(() => result.value?.allocations ?? []);
const filteredAllocations = computed(() =>
  channelFilter.value
    ? allocations.value.filter((row) => row.channelCode === channelFilter.value)
    : allocations.value,
);
const summary = computed(() => result.value?.summary);
const channelResults = computed(() => result.value?.channels ?? []);
const totalReturned = computed(() =>
  receipts.value.reduce(
    (sum, row) => sum + Number(row.returnedQty || row.goodQty || 0),
    0,
  ),
);
const totalAllocated = computed(
  () =>
    Number(summary.value?.lockedQty || 0) +
    Number(summary.value?.proposedQty || 0),
);
const overallRate = computed(() => {
  const plan = Number(summary.value?.totalPlanQty || 0);
  return plan ? totalAllocated.value / plan : 0;
});

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

function cloneRules(rules: ShippingWorkspaceState['rules']) {
  return {
    primaryCompletionRate: Number(rules.primaryCompletionRate),
    ukIenThreshold: Number(rules.ukIenThreshold),
    usCartonDeadline: String(rules.usCartonDeadline),
    usMinBoxes: Number(rules.usMinBoxes),
    usWaitHours: Number(rules.usWaitHours),
    warehouseDailyCapacity: Number(rules.warehouseDailyCapacity),
  };
}

function statusLabel(status: ShippingAllocationRow['status']) {
  return {
    locked: '已锁定',
    needs_review: '待人工复核',
    proposed: '待审核',
    waiting_uk_ien: '英国IEN合并池',
    waiting_us_carton: '美国凑箱池',
  }[status];
}

function statusClass(status: ShippingAllocationRow['status']) {
  return status.replaceAll('_', '-');
}

function receiptStatus(receiptId: string) {
  const rows = allocations.value.filter((row) => row.receiptId === receiptId);
  const hasUnallocated = (result.value?.unallocated ?? []).some(
    (row) => row.receiptId === receiptId,
  );
  if (rows.length === 0) return hasUnallocated ? '待人工' : '待分配';
  if (rows.every((row) => row.locked))
    return hasUnallocated ? '部分锁定' : '已锁定';
  return hasUnallocated ? '部分分配' : '已自动分配';
}

function channelResult(code: string) {
  return channelResults.value.find((row) => row.code === code);
}

function workspacePayload() {
  if (!workspace.value) throw new Error('工作区尚未加载');
  return {
    asOfDate: workspace.value.asOfDate,
    channels: workspace.value.channels,
    lockedAllocations: workspace.value.lockedAllocations,
    receipts: workspace.value.receipts,
    rules: workspace.value.rules,
    skuPlans: workspace.value.skuPlans,
  };
}

async function recalculate() {
  result.value = await simulateShippingAllocation(workspacePayload());
}

async function persist(showSuccess = false) {
  if (!workspace.value) return;
  saving.value = true;
  try {
    workspace.value = await saveShippingWorkspace(workspace.value);
    if (showSuccess) message.success('保存成功');
  } catch (error: any) {
    message.error(errorText(error, '保存失败'));
    throw error;
  } finally {
    saving.value = false;
  }
}

async function recalculateAndSave(successText = '') {
  loading.value = true;
  try {
    await recalculate();
    await persist(false);
    if (successText) message.success(successText);
  } catch (error: any) {
    message.error(errorText(error, '重新分配失败'));
  } finally {
    loading.value = false;
  }
}

function resetReceiptForm() {
  Object.assign(receiptForm, {
    boxQty: 0,
    goodQty: 0,
    note: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    returnedQty: 0,
    sku: '',
    spu: '',
    supplier: '',
  });
}

async function addReceipt() {
  if (!workspace.value) return;
  if (!receiptForm.sku.trim()) return void message.warning('请填写 SKU');
  if (Number(receiptForm.goodQty) <= 0)
    return void message.warning('良品数量必须大于 0');
  const receipt: ShippingReceipt = {
    ...receiptForm,
    receiptId: `REC-${Date.now()}`,
    returnedQty: Number(receiptForm.returnedQty || receiptForm.goodQty),
    status: '待分配',
    unitsPerBox:
      Number(receiptForm.boxQty) > 0
        ? Math.max(
            1,
            Math.round(
              Number(receiptForm.goodQty) / Number(receiptForm.boxQty),
            ),
          )
        : 0,
  };
  workspace.value.receipts.push(receipt);
  resetReceiptForm();
  await recalculateAndSave('来货已保存并自动分配');
}

function removeReceipt(receiptId: string) {
  Modal.confirm({
    content: '删除后，与这条来货关联的锁定分配也会删除。',
    okText: '删除',
    okType: 'danger',
    title: '确认删除来货记录？',
    async onOk() {
      if (!workspace.value) return;
      workspace.value.receipts = workspace.value.receipts.filter(
        (row) => row.receiptId !== receiptId,
      );
      workspace.value.lockedAllocations =
        workspace.value.lockedAllocations.filter(
          (row) => row.receiptId !== receiptId,
        );
      await recalculateAndSave('来货记录已删除');
    },
  });
}

function clearReceipts() {
  if (receipts.value.length === 0) return;
  Modal.confirm({
    content: '将清空全部来货记录、锁定分配和当前演算结果。',
    okText: '全部清空',
    okType: 'danger',
    title: '确认清空全部来货？',
    async onOk() {
      if (!workspace.value) return;
      workspace.value.receipts = [];
      workspace.value.lockedAllocations = [];
      await recalculateAndSave('全部来货已清空');
    },
  });
}

function addSkuPlan() {
  if (!workspace.value) return;
  const targets = Object.fromEntries(
    workspace.value.channels.map((channel) => [channel.code, 0]),
  );
  workspace.value.skuPlans.push({ channelTargets: targets, sku: '', spu: '' });
}

async function removeSkuPlan(index: number) {
  if (!workspace.value) return;
  workspace.value.skuPlans.splice(index, 1);
  await recalculateAndSave('SKU 计划已删除');
}

async function saveSkuPlans() {
  await recalculateAndSave('SKU 渠道计划已保存');
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
  await recalculateAndSave('国家渠道总计划已保存');
}

async function saveRules() {
  await recalculateAndSave('分配规则已保存并重新演算');
}

async function restoreDefaultRules() {
  if (!workspace.value || !defaultRules.value) return;
  workspace.value.rules = cloneRules(defaultRules.value);
  await recalculateAndSave('规则已恢复默认值');
}

async function resetAll() {
  Modal.confirm({
    content: '这会清除来货、SKU 计划和锁定结果，并恢复 Demo 的默认渠道与规则。',
    okText: '恢复初始数据',
    okType: 'danger',
    title: '确认重置整个工作区？',
    async onOk() {
      loading.value = true;
      try {
        workspace.value = await resetShippingWorkspace();
        defaultRules.value = cloneRules(workspace.value.rules);
        await recalculate();
        message.success('工作区已重置');
      } catch (error: any) {
        message.error(errorText(error, '重置失败'));
      } finally {
        loading.value = false;
      }
    },
  });
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadReceiptTemplate() {
  saveBlob(await downloadShippingReceiptTemplate(), '来货导入模板.xlsx');
}

async function downloadSkuTemplate() {
  saveBlob(await downloadShippingSkuPlanTemplate(), 'SKU渠道计划模板.xlsx');
}

async function exportExcel() {
  try {
    await persist(false);
    saveBlob(
      await exportShippingWorkspace(),
      `圣诞来货分配_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  } catch (error: any) {
    message.error(errorText(error, '导出失败'));
  }
}

function printPage() {
  window.print();
}

async function handleReceiptImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !workspace.value) return;
  loading.value = true;
  try {
    const rows = await importShippingReceipts(file);
    workspace.value.receipts.push(...rows);
    await recalculate();
    await persist(false);
    message.success(`已导入 ${rows.length} 条来货记录`);
  } catch (error: any) {
    message.error(errorText(error, '来货导入失败'));
  } finally {
    loading.value = false;
  }
}

async function handleSkuImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !workspace.value) return;
  loading.value = true;
  try {
    const imported = await importShippingSkuPlans(file);
    const byKey = new Map(
      workspace.value.skuPlans.map((row) => [`${row.spu}|${row.sku}`, row]),
    );
    imported.forEach((row) => byKey.set(`${row.spu}|${row.sku}`, row));
    workspace.value.skuPlans = [...byKey.values()];
    await recalculate();
    await persist(false);
    message.success(`已导入 ${imported.length} 条 SKU 计划`);
  } catch (error: any) {
    message.error(errorText(error, 'SKU 计划导入失败'));
  } finally {
    loading.value = false;
  }
}

async function loadPage() {
  loading.value = true;
  try {
    [meta.value, workspace.value] = await Promise.all([
      fetchShippingAllocationMeta(),
      fetchShippingWorkspace(),
    ]);
    defaultRules.value = cloneRules(meta.value.rules);
    await recalculate();
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
        <h1>圣诞款来货分配 ERP</h1>
        <p>供应链回货、渠道计划与仓库发货分配总控</p>
      </div>
      <div class="header-meta">
        <span>{{
          saving ? '保存中...' : `已保存：${dateTime(workspace?.updatedAt)}`
        }}</span>
        <button class="header-button" type="button" @click="resetAll">
          重置工作区
        </button>
      </div>
    </header>

    <main class="erp-main">
      <nav class="tabbar" aria-label="发货分配功能">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-button"
          :class="[{ active: activeTab === tab.key }]"
          type="button"
          @click="activeTab = tab.key"
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
              <div class="toolbar">
                <label class="date-control">统计日期<input
                    v-model="workspace.asOfDate"
                    type="date"
                    @change="recalculateAndSave()"
                /></label>
                <button
                  class="button secondary"
                  type="button"
                  @click="printPage"
                >
                  打印
                </button>
                <button
                  class="button primary"
                  type="button"
                  @click="exportExcel"
                >
                  导出 Excel
                </button>
              </div>
            </div>

            <div class="kpi-grid">
              <article class="kpi-card blue">
                <span>国家渠道总计划</span><strong>{{ integer(summary?.totalPlanQty) }}</strong><small>15 个发货渠道</small>
              </article>
              <article class="kpi-card green">
                <span>累计回货数量</span><strong>{{ integer(totalReturned) }}</strong><small>良品 {{ integer(summary?.totalGoodQty) }}</small>
              </article>
              <article class="kpi-card cyan">
                <span>已分配数量</span><strong>{{ integer(totalAllocated) }}</strong><small>含锁定 {{ integer(summary?.lockedQty) }}</small>
              </article>
              <article class="kpi-card orange">
                <span>总计划完成率</span><strong>{{ percent(overallRate) }}</strong><small>未分配 {{ integer(summary?.unallocatedQty) }}</small>
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
                      <th>计划数</th>
                      <th>已分配</th>
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
                        {{ integer(channel.allocatedQty) }}
                      </td>
                      <td>{{ integer(channel.remainingQty) }}</td>
                      <td>
                        <div class="progress">
                          <i
                            :style="{
                              width: `${Math.min(100, channel.completionRate * 100)}%`,
                            }"
                          ></i>
                        </div>
                        <small>{{ percent(channel.completionRate) }}</small>
                      </td>
                      <td>{{ channel.deadline || '-' }}</td>
                      <td class="rule-cell">{{ channel.rule || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'receipts'" class="page-section">
            <div class="section-heading">
              <div>
                <h2>来货录入</h2>
                <p>录入良品后自动按 SKU 与国家渠道计划分配</p>
              </div>
              <div class="toolbar">
                <button
                  class="button secondary"
                  type="button"
                  @click="downloadReceiptTemplate"
                >
                  下载模板
                </button>
                <label class="button secondary file-button">导入 Excel<input
                    accept=".xlsx,.xlsm,.csv"
                    type="file"
                    @change="handleReceiptImport"
                /></label>
              </div>
            </div>
            <div class="entry-form">
              <label>来货日期<input v-model="receiptForm.receiptDate" type="date" /></label>
              <label>供应商<input
                  v-model.trim="receiptForm.supplier"
                  placeholder="供应商"
              /></label>
              <label>SPU<input v-model.trim="receiptForm.spu" placeholder="SPU" /></label>
              <label>SKU<input v-model.trim="receiptForm.sku" placeholder="SKU" /></label>
              <label>回货数量<input
                  v-model.number="receiptForm.returnedQty"
                  min="0"
                  type="number"
              /></label>
              <label>良品数量<input
                  v-model.number="receiptForm.goodQty"
                  min="0"
                  type="number"
              /></label>
              <label>箱数<input
                  v-model.number="receiptForm.boxQty"
                  min="0"
                  type="number"
              /></label>
              <label class="note-input">备注<input v-model.trim="receiptForm.note" placeholder="选填" /></label>
              <button
                class="button primary form-submit"
                type="button"
                @click="addReceipt"
              >
                保存并自动分配
              </button>
            </div>
            <div class="data-panel">
              <div class="panel-title">
                <h3>来货记录</h3>
                <div>
                  <span>共 {{ receipts.length }} 条</span><button
                    class="text-danger"
                    type="button"
                    @click="clearReceipts"
                  >
                    清空全部
                  </button>
                </div>
              </div>
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>供应商</th>
                      <th>SPU</th>
                      <th>SKU</th>
                      <th>回货数量</th>
                      <th>良品数量</th>
                      <th>箱数</th>
                      <th>状态</th>
                      <th>备注</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in receipts" :key="row.receiptId">
                      <td>{{ row.receiptDate }}</td>
                      <td>{{ row.supplier || '-' }}</td>
                      <td>{{ row.spu || '-' }}</td>
                      <td>
                        <strong>{{ row.sku }}</strong>
                      </td>
                      <td>{{ integer(row.returnedQty || row.goodQty) }}</td>
                      <td>{{ integer(row.goodQty) }}</td>
                      <td>{{ integer(row.boxQty) }}</td>
                      <td>
                        <span class="status neutral">{{
                          receiptStatus(row.receiptId)
                        }}</span>
                      </td>
                      <td>{{ row.note || '-' }}</td>
                      <td class="actions">
                        <button
                          type="button"
                          @click="recalculateAndSave('已重新分配')"
                        >
                          重新分配
</button><button
                          class="danger"
                          type="button"
                          @click="removeReceipt(row.receiptId)"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                    <tr v-if="receipts.length === 0">
                      <td class="empty" colspan="10">暂无来货记录</td>
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
                <p>维护每个 SKU 在 15 个国家渠道中的目标数量</p>
              </div>
              <div class="toolbar">
                <button
                  class="button secondary"
                  type="button"
                  @click="downloadSkuTemplate"
                >
                  下载模板
</button><label class="button secondary file-button">导入 Excel<input
                    accept=".xlsx,.xlsm,.csv"
                    type="file"
                    @change="handleSkuImport"
/></label><button
                  class="button secondary"
                  type="button"
                  @click="addSkuPlan"
                >
                  新增一行
</button><button
                  class="button primary"
                  type="button"
                  @click="saveSkuPlans"
                >
                  保存计划
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
                      <th v-for="channel in channels" :key="channel.code">
                        {{ channel.name }}<small>{{ channel.code }}</small>
                      </th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(plan, index) in skuPlans" :key="index">
                      <td class="sticky-col first">
                        <input v-model.trim="plan.spu" placeholder="SPU" />
                      </td>
                      <td class="sticky-col second">
                        <input v-model.trim="plan.sku" placeholder="SKU" />
                      </td>
                      <td v-for="channel in channels" :key="channel.code">
                        <input
                          v-model.number="plan.channelTargets[channel.code]"
                          min="0"
                          type="number"
                        />
                      </td>
                      <td>
                        <button
                          class="text-danger"
                          type="button"
                          @click="removeSkuPlan(index)"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                    <tr v-if="skuPlans.length === 0">
                      <td class="empty" :colspan="channels.length + 3">
                        暂无 SKU 计划，可新增一行或导入模板
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
                <p>锁定后的分配在重新演算时优先保留</p>
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
</select><button
                  class="button primary"
                  type="button"
                  @click="recalculateAndSave('未锁定数据已重新分配')"
                >
                  重新分配全部未锁定
                </button>
              </div>
            </div>
            <div v-if="result?.unallocated.length" class="warning-bar">
              有
              {{ integer(summary?.unallocatedQty) }}
              件尚未分配，请检查渠道剩余计划、SKU 计划、主市场门槛或仓库日产能。
            </div>
            <div class="data-panel">
              <div class="table-scroll allocation-table">
                <table>
                  <thead>
                    <tr>
                      <th>来货日期</th>
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
                      <td>{{ row.spu || '-' }}</td>
                      <td>
                        <strong>{{ row.sku }}</strong>
                      </td>
                      <td>
                        {{ row.channelName
                        }}<small>{{ row.channelCode }}</small>
                      </td>
                      <td class="number-positive">{{ integer(row.qty) }}</td>
                      <td>{{ row.estimatedBoxes ?? '-' }}</td>
                      <td>
                        <span
                          class="status"
                          :class="[statusClass(row.status)]"
                          >{{ statusLabel(row.status) }}</span>
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
                      <td class="empty" colspan="9">暂无自动分配结果</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'channels'" class="page-section">
            <div class="section-heading">
              <div>
                <h2>国家渠道总计划</h2>
                <p>Demo 的 15 个发货渠道及 2026 圣诞款时效规则</p>
              </div>
              <button
                class="button primary"
                type="button"
                @click="saveChannels"
              >
                保存国家渠道计划
              </button>
            </div>
            <div class="data-panel">
              <div class="table-scroll channel-plan-table">
                <table>
                  <thead>
                    <tr>
                      <th>优先级</th>
                      <th>代码</th>
                      <th>国家渠道</th>
                      <th>运输方式</th>
                      <th>计划数量</th>
                      <th>已分配</th>
                      <th>剩余</th>
                      <th>时效要求</th>
                      <th>分配规则</th>
                      <th>启用</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="channel in channels" :key="channel.code">
                      <td>
                        <select v-model="channel.priorityLevel">
                          <option>P0</option>
                          <option>P1</option>
                          <option>P2</option>
                        </select>
                      </td>
                      <td>
                        <strong>{{ channel.code }}</strong>
                      </td>
                      <td><input v-model.trim="channel.name" /></td>
                      <td>
                        <select v-model="channel.mode">
                          <option value="sea">海运</option>
                          <option value="truck">卡航</option>
                          <option value="air">空运</option>
                        </select>
                      </td>
                      <td>
                        <input
                          v-model.number="channel.plannedQty"
                          min="0"
                          type="number"
                        />
                      </td>
                      <td>
                        {{ integer(channelResult(channel.code)?.allocatedQty) }}
                      </td>
                      <td>
                        {{ integer(channelResult(channel.code)?.remainingQty) }}
                      </td>
                      <td><input v-model.trim="channel.deadline" /></td>
                      <td><input v-model.trim="channel.rule" /></td>
                      <td>
                        <input
                          v-model="channel.enabled"
                          class="checkbox"
                          type="checkbox"
                        />
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
              <label><span>美国海运最低箱数</span><input
                  v-model.number="workspace.rules.usMinBoxes"
                  min="1"
                  type="number"
                /><small>单产品不足该箱数时进入凑箱池</small></label>
              <label><span>美国凑箱等待时间（小时）</span><input
                  v-model.number="workspace.rules.usWaitHours"
                  min="0"
                  type="number"
                /><small>到期后转为人工复核</small></label>
              <label><span>英国 IEN 合并门槛（件）</span><input
                  v-model.number="workspace.rules.ukIenThreshold"
                  min="1"
                  type="number"
                /><small>海运及卡航按该数量进入合并池</small></label>
              <label><span>仓库每日处理能力（件）</span><input
                  v-model.number="workspace.rules.warehouseDailyCapacity"
                  min="1"
                  type="number"
                /><small>按来货日期限制每日自动分配量</small></label>
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
                /><small>达到后才释放澳洲、阿联酋海运</small></label>
              <label><span>美国统一凑箱截止日</span><input
                  v-model="workspace.rules.usCartonDeadline"
                  type="date"
                /><small>与等待时间取较早日期</small></label>
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

.header-button {
  padding: 6px 11px;
  color: #fff;
  cursor: pointer;
  background: transparent;
  border: 1px solid #58708d;
  border-radius: 5px;
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

.date-control {
  display: flex;
  gap: 7px;
  align-items: center;
  color: #64748b;
}

input,
select {
  min-height: 32px;
  padding: 5px 8px;
  color: #1f2937;
  outline: none;
  background: #fff;
  border: 1px solid #cfd8e5;
  border-radius: 4px;
}

input:focus,
select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgb(37 99 235 / 10%);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
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

.number-positive {
  font-weight: 700;
  color: #087e45;
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

.status.locked {
  color: #1d4ed8;
  background: #dbeafe;
}

.status.needs-review {
  color: #c2410c;
  background: #ffedd5;
}

.status.waiting-uk-ien,
.status.waiting-us-carton {
  color: #a16207;
  background: #fef3c7;
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

.entry-form {
  display: grid;
  grid-template-columns: repeat(8, minmax(115px, 1fr));
  gap: 10px;
  align-items: end;
  padding: 14px;
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #dce3ec;
  border-radius: 8px;
}

.entry-form label,
.settings-grid label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: #536174;
}

.entry-form input {
  width: 100%;
}

.entry-form .note-input {
  grid-column: span 2;
}

.form-submit {
  min-width: 142px;
}

.file-button {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.file-button input {
  display: none;
}

.actions {
  display: flex;
  gap: 10px;
}

.actions button,
.text-danger {
  padding: 0;
  color: #2563eb;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.actions .danger,
.text-danger {
  color: #dc2626;
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

.sku-table input {
  width: 108px;
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

.allocation-table table {
  min-width: 1160px;
}

.channel-plan-table table {
  min-width: 1320px;
}

.channel-plan-table input {
  width: 100%;
  min-width: 110px;
}

.channel-plan-table td:nth-child(3) input {
  min-width: 170px;
}

.channel-plan-table td:nth-child(8) input {
  min-width: 170px;
}

.channel-plan-table td:nth-child(9) input {
  min-width: 260px;
}

.channel-plan-table .checkbox {
  width: 16px;
  min-width: 16px;
  min-height: 16px;
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

.settings-grid label {
  min-height: 120px;
  padding: 15px;
  background: #fafcff;
  border: 1px solid #e4e9f0;
  border-radius: 6px;
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
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .entry-form {
    grid-template-columns: repeat(4, 1fr);
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
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .entry-form {
    grid-template-columns: repeat(2, 1fr);
  }

  .entry-form .note-input {
    grid-column: span 2;
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
