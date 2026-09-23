<script setup lang="ts">
import type {
  AdCvrBatchTask,
  AdCvrOptimizationScope,
  AdCvrTaskHistory,
  AdCvrTaskPackage,
  AdCvrTaskPackageDetail,
  AdCvrTaskParameters,
  AdCvrTaskPolicy,
  AdCvrTaskPreview,
  AdCvrTaskReview,
  AdCvrTaskStage,
} from '#/api/kanban/ad-cvr-optimization';

import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  toRaw,
  watch,
} from 'vue';

import {
  Alert,
  Button,
  Checkbox,
  ConfigProvider,
  Drawer,
  Empty,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  bulkAdoptAdCvrTaskDecisions,
  fetchAdCvrBatchTask,
  fetchAdCvrBatchTasks,
  fetchAdCvrOptimizationOperationContext,
  fetchAdCvrTaskHistory,
  fetchAdCvrTaskPackage,
  fetchAdCvrTaskPackages,
  fetchAdCvrTaskPolicy,
  previewAdCvrTask,
  previewAdCvrTaskRetry,
  reconcileAdCvrExecution,
  saveAdCvrTaskDecision,
  transferAdCvrTasks,
} from '#/api/kanban/ad-cvr-optimization';

import { MAX_BATCH_SELECTION, readBatchContexts } from './batch-selection';
import {
  adCvrExecutionInProgress,
  runAdCvrTaskPackageExecution,
} from './execution-task';
import { useQueueDock } from './queue-layout';
import { taskDecisionLabel } from './task-labels';
import {
  taskBatchCandidates,
  taskExecutionBlockReason,
  taskSelectionBlockReason,
} from './task-selection';
import TaskAccuracyReview from './TaskAccuracyReview.vue';
import TaskActionParameters from './TaskActionParameters.vue';
import TaskPolicySettings from './TaskPolicySettings.vue';
import TaskReviews from './TaskReviews.vue';

type TaskRow = AdCvrTaskPackageDetail['items'][number];
const props = withDefaults(
  defineProps<{
    projectTags?: string[];
    scope: AdCvrOptimizationScope;
    snapshotDate?: string;
  }>(),
  { projectTags: () => [], snapshotDate: '' },
);
const stages: Array<{ key: AdCvrTaskStage; label: string; note: string }> = [
  { key: 'color', label: '颜色', note: '先判断整色表现' },
  { key: 'target', label: '投放内容', note: '投放商品与广告组投放词' },
  { key: 'search_term', label: '搜索词', note: '按转化与相关性判断否定' },
  { key: 'ad_group', label: '广告组', note: '下层处理后再判断' },
  { key: 'campaign', label: '广告活动', note: '最后复核活动层级' },
];
const view = ref<'accuracy' | 'all' | 'execution' | 'settings' | 'today'>(
  'today',
);
const policy = ref<AdCvrTaskPolicy>();
const leaseBusy = ref(false);
const transferOpen = ref(false);
const transferTarget = ref<string>();
const transferNote = ref('');
const checkedPackages = ref<string[]>([]);
const workloads = ref<
  Array<{ capacity: null | number; owner: string; pending: number }>
>([]);
const workloadsOpen = ref(false);
const historyOpen = ref(false);
const historyLoading = ref(false);
const historyVersions = ref<NonNullable<AdCvrTaskHistory['versions']>>([]);
const historyRows = ref<NonNullable<AdCvrTaskHistory['items']>>([]);
const historyRevision = ref('');
const historyPage = ref(1);
const historyTotal = ref(0);
let historySequence = 0;
const workAreaRef = ref<HTMLElement>();
const actionBarStyle = ref<Record<string, string>>({});
let workAreaObserver: ResizeObserver | undefined;
function positionActionBar() {
  const bounds = workAreaRef.value?.getBoundingClientRect();
  if (!bounds) return;
  actionBarStyle.value = {
    left: `${Math.max(0, bounds.left)}px`,
    width: `${bounds.width}px`,
  };
}
const useLatest = ref(false);
const staleSelection = computed(() =>
  Boolean(
    detail.value?.stale ||
    (selected.value &&
      snapshot.value?.version !== selected.value.snapshotVersion),
  ),
);
const writable = computed(() =>
  Boolean(
    detail.value &&
    !detailLoading.value &&
    !detailError.value &&
    !staleSelection.value,
  ),
);
const queue = ref<AdCvrTaskPackage[]>([]);
const queueError = ref('');
const queueLoading = ref(false);
const queuePage = ref(1);
const queueTotal = ref(0);
const snapshot = ref<AdCvrTaskPackageDetail['snapshot']>();
const summary = ref({
  total: 0,
  today: 0,
  urgent: 0,
  blocked: 0,
  observe: 0,
  failed: 0,
});
const options = ref<{ responsibles: string[]; sites: string[] }>({
  sites: [],
  responsibles: [],
});
const bucket = ref('all');
const selected = ref<AdCvrTaskPackage>();
const detail = ref<AdCvrTaskPackageDetail>();
const detailError = ref('');
const detailLoading = ref(false);
const detailPage = ref(1);
const stage = ref<AdCvrTaskStage>('color');
const workbenchGridRef = ref<HTMLElement>();
const queuePanelRef = ref<HTMLElement>();
const queuePanelStyle = useQueueDock(workbenchGridRef, queuePanelRef);
const filters = reactive({
  site: undefined as string | undefined,
  responsible: undefined as string | undefined,
  search: '',
  assignment: 'all',
  taskStatus: 'all',
});
const assignmentOptions = [
  { value: 'all', label: '全部归属' },
  { value: 'mine', label: '我的任务' },
];
const taskStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待判断' },
  { value: 'processing', label: '处理中' },
  { value: 'ready', label: '待执行' },
  { value: 'observing', label: '观察中' },
  { value: 'blocked', label: '数据待核对' },
  { value: 'exception', label: '执行异常' },
  { value: 'completed', label: '已完成' },
];
const priorityOptions = [
  { value: 'all', label: '全部优先级' },
  { value: 'urgent', label: '紧急处理' },
  { value: 'high', label: '高优先' },
  { value: 'routine', label: '常规处理' },
  { value: 'observe', label: '观察中' },
  { value: 'blocked', label: '数据待核对' },
  { value: 'failed', label: '执行异常' },
];
function preferenceKey() {
  return `p3-task-filters:${props.scope}:${policy.value?.actor || ''}`;
}
function restoreFilters() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(preferenceKey()) || '{}',
    ) as Record<string, unknown>;
    for (const key of ['site', 'responsible', 'search'] as const)
      if (typeof saved[key] === 'string') filters[key] = saved[key];
    if (assignmentOptions.some((v) => v.value === saved.assignment))
      filters.assignment = String(saved.assignment);
    if (taskStatusOptions.some((v) => v.value === saved.taskStatus))
      filters.taskStatus = String(saved.taskStatus);
  } catch {
    /* Storage may be disabled; filtering still works. */
  }
}
watch(
  filters,
  () => {
    if (!policy.value?.actor) return;
    try {
      localStorage.setItem(preferenceKey(), JSON.stringify(filters));
    } catch {
      /* Optional preference only. */
    }
  },
  { deep: true },
);
function queryTasks() {
  queuePage.value = 1;
  checkedPackages.value = [];
  void loadQueue(false);
}
let queueSearchTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filters.search,
  () => {
    if (view.value !== 'today') return;
    if (queueSearchTimer) clearTimeout(queueSearchTimer);
    queueSearchTimer = setTimeout(queryTasks, 350);
  },
);
async function openReview(item: AdCvrTaskReview) {
  useLatest.value = true;
  view.value = 'all';
  Object.assign(filters, {
    search: item.spu || item.store_name,
    site: item.site,
    responsible: undefined,
    assignment: 'all',
    taskStatus: 'all',
  });
  bucket.value = 'all';
  queuePage.value = 1;
  await loadQueue(false);
  const match = queue.value.find(
    (p) =>
      p.store === item.store_name && p.site === item.site && p.spu === item.spu,
  );
  if (match) {
    view.value = 'today';
    await openPackage(match);
  } else
    message.info('当前快照没有对应建议，保留复查记录；请在领星核对对象状态。');
}
async function submitTransfer() {
  if (!transferTarget.value || !transferNote.value.trim()) {
    message.warning('请填写接收人和转交原因');
    return;
  }
  leaseBusy.value = true;
  try {
    const packages = queue.value.filter((p) =>
      checkedPackages.value.includes(p.packageId),
    );
    const result = await transferAdCvrTasks(
      packages.map((p) => ({
        ...packageParams(p),
        action: 'transfer',
        version: p.lease?.version || 0,
        target: transferTarget.value,
        note: transferNote.value,
      })),
      props.scope,
    );
    const failed = result.results.filter((r) => !r.ok);
    message[failed.length > 0 ? 'warning' : 'success'](
      `已转交 ${result.results.length - failed.length} 包${failed.length > 0 ? `；${failed.length} 包失败：${failed.map((r) => `${r.spu} ${r.error}`).join('；')}` : ''}`,
    );
    transferOpen.value = false;
    checkedPackages.value = [];
    await loadQueue(true);
    await loadDetail();
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    leaseBusy.value = false;
  }
}
const decisionTarget = ref<TaskRow>();
const evidence = ref<TaskRow>();
const decision = ref<'adopt' | 'ignore' | 'modify' | 'observe' | 'retain'>(
  'modify',
);
const decisionBusy = ref(false);
const decisionNote = ref('');
const observeDays = ref(7);
const decisionParameters = ref<AdCvrTaskParameters>({});
const bulkDecisionOpen = ref(false);
const bulkAdoptOpen = ref(false);
const selectedIds = ref<string[]>([]);
const selectedRows = ref<Record<string, TaskRow>>({});
const executionParameters = reactive<Record<string, AdCvrTaskParameters>>({});
const parametersOpen = ref(false);
const previewOpen = ref(false);
const previewLoading = ref(false);
const previewResult = ref<AdCvrTaskPreview>();
const previewConfirmed = ref(false);
const submitBusy = ref(false);
const frozenSubmission = ref<{
  payload: Record<string, unknown>;
  scope: AdCvrOptimizationScope;
}>();
const uniformPercentage = ref<number>();
const baselines = ref<
  Record<
    string,
    { bid?: null | number; budget?: null | number; error?: string }
  >
>({});
const baselineLoading = ref(false);
const receipt = ref<AdCvrBatchTask>();
const tasks = ref<AdCvrBatchTask[]>([]);
const reconcileBusy = ref(false);
const taskLoading = ref(false);
let detailSequence = 0;
let packageSequence = 0;
let queueSequence = 0;
const currentRows = computed(() => detail.value?.items || []);
const checkedRows = computed(() =>
  selectedIds.value.flatMap((id) =>
    selectedRows.value[id] ? [selectedRows.value[id]] : [],
  ),
);
const currentCheckedRows = computed(() =>
  currentRows.value.filter((row) =>
    selectedIds.value.includes(row.suggestion_id),
  ),
);
const selectedActionRows = computed(() =>
  checkedRows.value.filter((row) => !taskExecutionBlockReason(row)),
);
const bulkScopeLabel = computed(() =>
  currentCheckedRows.value.length > 0 ? '本页所选' : '本页',
);
const bulkAdoptRows = computed(() =>
  taskBatchCandidates(
    currentRows.value,
    currentCheckedRows.value,
    stage.value,
  ).filter(
    (row) =>
      !row.task_decision && canEdit(row) && row.task_state?.evidence.eligible,
  ),
);
const nextStageIndex = computed(() =>
  stages.findIndex((item) => item.key === detail.value?.nextStage),
);
const selectableRows = computed(() =>
  currentRows.value.filter((row) => canSelect(row)),
);
const pageSelected = computed(
  () =>
    selectableRows.value.length > 0 &&
    selectableRows.value.every((row) =>
      selectedIds.value.includes(row.suggestion_id),
    ),
);
const currentProgress = computed(() =>
  detail.value?.nextStage === 'complete'
    ? 5
    : Math.max(0, nextStageIndex.value),
);
const ownerOptions = computed(() =>
  options.value.responsibles.map((value) => ({ label: value, value })),
);
const siteOptions = computed(() =>
  options.value.sites.map((value) => ({ label: value, value })),
);

function priorityLabel(value: AdCvrTaskPackage['priority']) {
  return {
    urgent: '立即处理',
    high: '尽快处理',
    routine: '常规处理',
    observe: '观察跟进',
  }[value];
}
function queueProgressLabel(item: AdCvrTaskPackage) {
  if (item.failedCount) return `${item.failedCount} 项执行异常`;
  return (
    (
      {
        blocked: '数据待核对',
        completed: '判断已完成',
        exception: '执行异常',
        observing: '观察中',
        pending: '等待逐层处理',
        processing: '继续逐层判断',
        ready: '待预览执行',
      } as Record<string, string>
    )[item.taskStatus || ''] ||
    (item.pendingCount ? '等待逐层处理' : '判断已完成')
  );
}
function stageLabel(value: string) {
  return stages.find((item) => item.key === value)?.label || value;
}
function percent(value: null | number | string | undefined) {
  return value === null || value === undefined || value === ''
    ? '—'
    : `${(Number(value) * 100).toFixed(2)}%`;
}
function money(value: null | number | string | undefined) {
  return value === null || value === undefined || value === ''
    ? '—'
    : Number(value).toLocaleString('zh-CN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
}
function formatCount(value: null | number | string | undefined) {
  return value === null || value === undefined
    ? '—'
    : Math.round(Number(value)).toLocaleString('zh-CN');
}
function cpc(row: TaskRow) {
  return Number(row.clicks) > 0
    ? money(Number(row.spend) / Number(row.clicks))
    : '—';
}
function healthPercent(value: null | number) {
  return value === null ? '—' : `${value.toFixed(2)}%`;
}
function statusLabel(value: string) {
  return (
    (
      {
        queued: '排队中',
        running: '执行中',
        succeeded: '执行成功',
        partial_failed: '部分失败',
        interrupted: '已中断，待核对',
        failed: '失败',
        needs_review: '待核对',
        unchanged: '无需变更',
      } as Record<string, string>
    )[value] || value
  );
}
function recommendedRowDecision(
  row: TaskRow,
): 'adopt' | 'observe' | 'retain' | undefined {
  const evidence = row.task_state?.evidence;
  if (!evidence || evidence.state === 'blocked') return;
  if (row.action_type === 'hold') return 'retain';
  if (evidence.state === 'manual') return;
  return evidence.eligible ? 'adopt' : 'observe';
}
function rowDecisionLabel(row: TaskRow) {
  if (recommendedRowDecision(row) === 'retain') return '保留';
  if (recommendedRowDecision(row) === 'observe') return '观察';
  if (row.action_type.startsWith('close_')) return '采纳关闭';
  if (row.action_type.startsWith('negative_')) return '采纳否定';
  if (
    [
      'adjust_match_type',
      'decrease_budget',
      'increase_bid',
      'increase_budget',
      'lower_bid',
    ].includes(row.action_type)
  )
    return '采纳调整';
  return '采纳建议';
}
function canEdit(row: TaskRow) {
  return (
    writable.value &&
    !row.task_state?.inheritedFrom &&
    !row.task_state?.suppressedReason &&
    ['failed', 'not_requested'].includes(row.execution_status) &&
    !row.execution_has_write
  );
}
function editBlockReason(row: TaskRow) {
  if (staleSelection.value)
    return '这是旧快照，当前只能查看。请返回工作台切换到最新任务。';
  if (
    row.execution_has_write ||
    !['failed', 'not_requested'].includes(row.execution_status)
  )
    return '该动作已提交或已有广告写入，不能重复判断。请在执行中心核对回执。';
  if (row.task_state?.inheritedFrom)
    return '已继承父级关闭，无需重复判断；撤销父级关闭后可恢复单独处理。';
  if (row.task_state?.suppressedReason) return row.task_state.suppressedReason;
  if (!writable.value) return '任务数据尚未加载完成，请等待加载或刷新后重试。';
  return '';
}
function canSelect(row: TaskRow) {
  return (
    writable.value && !decisionBusy.value && !taskSelectionBlockReason(row)
  );
}
function canModify(row: TaskRow) {
  return [
    'adjust_match_type',
    'decrease_budget',
    'increase_bid',
    'increase_budget',
    'lower_bid',
    'negative_asin',
    'negative_keyword',
  ].includes(row.action_type);
}
function packageParams(item: AdCvrTaskPackage) {
  return {
    projectTags: [...props.projectTags],
    snapshotDate: item.snapshotDate,
    snapshotVersion: item.snapshotVersion,
    site: item.site,
    store: item.store,
    spu: item.spu,
  };
}
function clearSelection() {
  selectedIds.value = [];
  selectedRows.value = {};
}
let policySequence = 0;
let taskLoadSequence = 0;
let receiptSequence = 0;
async function loadPolicy() {
  const seq = ++policySequence;
  try {
    const result = await fetchAdCvrTaskPolicy(props.scope);
    if (seq === policySequence) policy.value = result;
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
}
async function loadQueue(preserveSelection = true) {
  const seq = ++queueSequence;
  queueLoading.value = true;
  queueError.value = '';
  try {
    const result = await fetchAdCvrTaskPackages(
      {
        ...filters,
        ...(view.value === 'today'
          ? { assignment: 'all', taskStatus: 'all' }
          : {}),
        projectTags: props.projectTags,
        snapshotDate: useLatest.value
          ? undefined
          : props.snapshotDate || undefined,
        view: view.value === 'all' ? 'all' : 'today',
        bucket: bucket.value,
        page: queuePage.value,
        pageSize: 30,
      },
      props.scope,
    );
    if (seq !== queueSequence) return;
    queue.value = result.items;
    workloads.value = result.workloads || [];
    queueTotal.value = result.pagination.total;
    queuePage.value = result.pagination.page;
    summary.value = result.summary;
    options.value = result.options;
    snapshot.value = result.snapshot;
    if (view.value === 'all') return;
    if (preserveSelection && selected.value) {
      const existing = result.items.find(
        (item) =>
          item.packageId === selected.value?.packageId &&
          item.snapshotVersion === selected.value?.snapshotVersion,
      );
      if (existing) selected.value = existing;
      // Keep the operator's open package pinned even when it leaves today's queue.
      return;
    }
    const first = result.items[0];
    if (first) await openPackage(first);
    else {
      ++detailSequence;
      ++packageSequence;
      selected.value = undefined;
      detail.value = undefined;
      clearSelection();
    }
  } catch (error) {
    if (seq === queueSequence)
      queueError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (seq === queueSequence) queueLoading.value = false;
  }
}
async function openPackage(item: AdCvrTaskPackage) {
  if (decisionBusy.value) return;
  const seq = ++packageSequence;
  selected.value = item;
  ++historySequence;
  historyOpen.value = false;
  bulkAdoptOpen.value = false;
  clearSelection();
  detail.value = undefined;
  stage.value = 'color';
  detailPage.value = 1;
  const loaded = await loadDetail();
  if (seq !== packageSequence) return;
  const next = loaded?.nextStage;
  if (next && next !== 'complete' && next !== 'color') {
    stage.value = next as AdCvrTaskStage;
    await loadDetail();
  }
}
async function openHistory() {
  if (!selected.value) return;
  const item = selected.value;
  const seq = ++historySequence;
  historyOpen.value = true;
  historyLoading.value = true;
  historyVersions.value = [];
  historyRows.value = [];
  historyRevision.value = '';
  try {
    const result = await fetchAdCvrTaskHistory(
      {
        site: item.site,
        store: item.store,
        spu: item.spu,
        projectTags: props.projectTags,
      },
      props.scope,
    );
    if (seq !== historySequence) return;
    historyVersions.value = result.versions || [];
  } catch (error) {
    if (seq === historySequence)
      message.error(error instanceof Error ? error.message : String(error));
  } finally {
    if (seq === historySequence) historyLoading.value = false;
  }
}
async function showHistoryVersion(revision: string, page = 1) {
  if (!selected.value) return;
  const item = selected.value;
  const seq = ++historySequence;
  historyRevision.value = revision;
  historyPage.value = page;
  historyLoading.value = true;
  try {
    const result = await fetchAdCvrTaskHistory(
      {
        site: item.site,
        store: item.store,
        spu: item.spu,
        revision,
        page,
        projectTags: props.projectTags,
      },
      props.scope,
    );
    if (seq !== historySequence) return;
    historyRows.value = result.items || [];
    historyTotal.value = result.total || 0;
  } catch (error) {
    if (seq === historySequence)
      message.error(error instanceof Error ? error.message : String(error));
  } finally {
    if (seq === historySequence) historyLoading.value = false;
  }
}
async function loadDetail() {
  if (!selected.value) return;
  const seq = ++detailSequence;
  detailLoading.value = true;
  detailError.value = '';
  try {
    const result = await fetchAdCvrTaskPackage(
      {
        ...packageParams(selected.value),
        stage: stage.value,
        page: detailPage.value,
        pageSize: 50,
      },
      props.scope,
    );
    if (seq !== detailSequence) return;
    detail.value = result;
    detailPage.value = result.pagination.page;
    for (const row of result.items) {
      if (row.task_decision === 'modify')
        executionParameters[row.suggestion_id] = structuredClone(
          row.task_parameters || {},
        );
      if (selectedIds.value.includes(row.suggestion_id)) {
        // Reconcile row eligibility, not the transient loading/busy UI guard.
        if (!staleSelection.value && !taskSelectionBlockReason(row))
          selectedRows.value[row.suggestion_id] = row;
        else toggleRow(row, false);
      }
    }
    return result;
  } catch (error) {
    if (seq === detailSequence) {
      detail.value = undefined;
      detailError.value =
        error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (seq === detailSequence) detailLoading.value = false;
  }
}
async function switchStage(value: AdCvrTaskStage) {
  if (decisionBusy.value || detailLoading.value) return;
  const index = stages.findIndex((item) => item.key === value);
  if (nextStageIndex.value >= 0 && index > nextStageIndex.value) return;
  clearSelection();
  stage.value = value;
  detailPage.value = 1;
  await loadDetail();
}
function toggleRow(row: TaskRow, checked: boolean) {
  if (checked) {
    if (!canSelect(row) || selectedIds.value.includes(row.suggestion_id))
      return;
    if (selectedIds.value.length >= MAX_BATCH_SELECTION) {
      message.warning(`单批最多 ${MAX_BATCH_SELECTION} 个动作`);
      return;
    }
    selectedIds.value = [...selectedIds.value, row.suggestion_id];
    selectedRows.value[row.suggestion_id] = row;
  } else {
    selectedIds.value = selectedIds.value.filter(
      (id) => id !== row.suggestion_id,
    );
    delete selectedRows.value[row.suggestion_id];
  }
}
function togglePage(checked: boolean) {
  for (const row of selectableRows.value) {
    if (checked && selectedIds.value.length >= MAX_BATCH_SELECTION) break;
    toggleRow(row, checked);
  }
}
async function saveDecision(
  row: TaskRow,
  value: 'adopt' | 'ignore' | 'modify' | 'observe' | 'pending' | 'retain',
  note = '',
) {
  if (!selected.value || decisionBusy.value || !writable.value) return;
  if (value === 'adopt' && !row.task_state?.evidence.eligible && !note.trim()) {
    openDecision(row, 'adopt');
    return;
  }
  decisionBusy.value = true;
  try {
    await saveAdCvrTaskDecision(
      {
        ...packageParams(selected.value),
        suggestionId: row.suggestion_id,
        decision: value,
        note,
        version: row.task_version || 0,
        observeDays: observeDays.value,
        parameters: value === 'modify' ? decisionParameters.value : {},
      },
      props.scope,
    );
    message.success(
      value === 'pending'
        ? '已撤销判断，记录仍保留'
        : '判断已保存；采纳和修改仍须预演后执行',
    );
    decisionTarget.value = undefined;
    clearSelection();
    await loadDetail();
    await loadQueue(true);
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
    await loadDetail();
  } finally {
    decisionBusy.value = false;
  }
}
function defaultParameters(row: TaskRow): AdCvrTaskParameters {
  if (Object.keys(row.task_parameters || {}).length > 0)
    return structuredClone(toRaw(row.task_parameters || {}));
  if (['negative_asin', 'negative_keyword'].includes(row.action_type))
    return {
      negative: {
        scope:
          row.metrics?.recommended_negative_scope === 'campaign'
            ? 'campaign'
            : 'ad_group',
        ...(row.action_type === 'negative_keyword'
          ? {
              matchType:
                row.metrics?.recommended_negative_match_type ===
                'negativePhrase'
                  ? ('negativePhrase' as const)
                  : ('negativeExact' as const),
              keywordText: String(
                row.metrics?.recommended_negative_text || row.search_term || '',
              ),
            }
          : {}),
      },
    };
  if (row.action_type === 'adjust_match_type')
    return {
      matchType: {
        groupName: `${row.ad_group_name || row.entity_name}-精准`,
        cpc: 0,
        matchType: 'exact',
      },
    };
  return {};
}
function openDecision(
  row: TaskRow,
  value: 'adopt' | 'ignore' | 'modify' | 'observe' | 'retain',
) {
  decisionTarget.value = row;
  decision.value = value;
  decisionNote.value = row.task_note || '';
  decisionParameters.value = defaultParameters(row);
  observeDays.value = 7;
}
async function confirmDecision() {
  if (!decisionTarget.value) return;
  if (!decisionNote.value.trim()) {
    message.warning('请填写依据或复查条件');
    return;
  }
  await saveDecision(decisionTarget.value, decision.value, decisionNote.value);
}
function openBulk(value: 'ignore' | 'observe' | 'retain') {
  decision.value = value;
  decisionNote.value = '';
  observeDays.value = 7;
  bulkDecisionOpen.value = true;
}
function openBulkAdopt() {
  if (bulkAdoptRows.value.length === 0) {
    message.info('本页没有证据充分的未判断建议；样本不足的建议请逐项复核');
    return;
  }
  bulkAdoptOpen.value = true;
}
async function adoptCurrentPage(
  value: 'adopt' | 'ignore' | 'observe' | 'retain' = 'adopt',
) {
  if (!selected.value || decisionBusy.value || !writable.value) return;
  const ids = (
    value === 'adopt'
      ? bulkAdoptRows.value
      : taskBatchCandidates(
          currentRows.value,
          currentCheckedRows.value,
          stage.value,
        ).filter((row) => !row.task_decision && canEdit(row))
  ).map((row) => row.suggestion_id);
  if (ids.length === 0) {
    message.info(
      `当前阶段${bulkScopeLabel.value}没有符合条件的未判断建议；样本不足项请填写复核原因后单独采纳，或批量观察。`,
    );
    return;
  }
  if (value !== 'adopt' && !decisionNote.value.trim()) {
    message.warning('请填写批量处理原因');
    return;
  }
  decisionBusy.value = true;
  try {
    const result = await bulkAdoptAdCvrTaskDecisions(
      {
        ...packageParams(selected.value),
        stage: stage.value,
        suggestionIds: ids,
        decision: value,
        note: value === 'adopt' ? '' : decisionNote.value,
        observeDays: observeDays.value,
      },
      props.scope,
    );
    message.success(`已保存 ${result.newlyAdopted} 项判断，已有判断不覆盖`);
    bulkAdoptOpen.value = false;
    clearSelection();
    bulkDecisionOpen.value = false;
    await loadDetail();
    await loadQueue(true);
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
    await loadDetail();
    await loadQueue(true);
  } finally {
    decisionBusy.value = false;
  }
}
function ensureParameters() {
  if (
    !writable.value ||
    decisionBusy.value ||
    selectedActionRows.value.length === 0
  )
    return;
  for (const row of selectedActionRows.value) {
    if (!executionParameters[row.suggestion_id])
      executionParameters[row.suggestion_id] = defaultParameters(row);
  }
  parametersOpen.value = true;
}
function applyUniformPercentage() {
  if (!uniformPercentage.value || uniformPercentage.value >= 100) return;
  for (const row of selectedActionRows.value) {
    if (row.task_decision === 'modify') continue;
    if (['increase_bid', 'lower_bid'].includes(row.action_type))
      executionParameters[row.suggestion_id] = {
        bidPercentage: uniformPercentage.value,
      };
    if (['decrease_budget', 'increase_budget'].includes(row.action_type))
      executionParameters[row.suggestion_id] = {
        budgetPercentage: uniformPercentage.value,
      };
  }
}
async function loadBaselines() {
  if (baselineLoading.value) return;
  const scope = props.scope;
  const seq = packageSequence;
  baselineLoading.value = true;
  try {
    const results = await readBatchContexts(
      selectedActionRows.value.filter((row) =>
        [
          'adjust_match_type',
          'decrease_budget',
          'increase_bid',
          'increase_budget',
          'lower_bid',
        ].includes(row.action_type),
      ),
      async (row) => {
        try {
          const context = await fetchAdCvrOptimizationOperationContext(
            row.suggestion_id,
            scope,
          );
          return {
            id: row.suggestion_id,
            bid: context.currentBid,
            budget: context.dailyBudget,
          };
        } catch (error) {
          return {
            id: row.suggestion_id,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    );
    if (seq === packageSequence)
      for (const item of results) baselines.value[item.id] = item;
  } finally {
    baselineLoading.value = false;
  }
}
function executionPayload() {
  if (!selected.value) throw new Error('请先选择任务包');
  const executableIds = selectedActionRows.value.map(
    (row) => row.suggestion_id,
  );
  if (!writable.value || executableIds.length === 0)
    throw new Error('请先采纳或修改可执行建议');
  const adjustments: Record<string, Record<string, unknown>> = {
    budgetAdjustments: {},
    bidAdjustments: {},
    matchTypeAdjustments: {},
    negativeAdjustments: {},
  };
  for (const id of executableIds) {
    const p = executionParameters[id] || {};
    for (const [key, group] of [
      ['bidPercentage', 'bidAdjustments'],
      ['budgetPercentage', 'budgetAdjustments'],
      ['negative', 'negativeAdjustments'],
      ['matchType', 'matchTypeAdjustments'],
    ] as const) {
      if (p[key] !== undefined) {
        const map = adjustments[group];
        if (map) map[id] = p[key];
      }
    }
  }
  return {
    ...packageParams(selected.value),
    suggestionIds: executableIds,
    ...adjustments,
  };
}
function previewSelectedOrPackage() {
  if (selectedActionRows.value.length === 0) {
    const candidates = detail.value?.executionCandidates || [];
    if (candidates.length === 0) return;
    selectedIds.value = candidates.map((row) => row.suggestion_id);
    selectedRows.value = Object.fromEntries(
      candidates.map((row) => [row.suggestion_id, row]),
    );
    for (const row of candidates)
      if (row.task_decision === 'modify')
        executionParameters[row.suggestion_id] = structuredClone(
          row.task_parameters || {},
        );
    if ((detail.value?.executionCandidateTotal || 0) > candidates.length)
      message.info(
        `本批已选前 ${candidates.length} 项；剩余动作请在本批完成后继续处理`,
      );
  }
  ensureParameters();
}
async function doPreview() {
  previewLoading.value = true;
  const scope = props.scope;
  try {
    // Freeze the exact JSON transport representation, including Vue proxy values.
    const serializedPayload = JSON.stringify(executionPayload());
    const payload = JSON.parse(serializedPayload) as Record<string, unknown>;
    const result = await previewAdCvrTask(payload, scope);
    previewResult.value = result;
    frozenSubmission.value = {
      payload: {
        ...payload,
        suggestionIds: result.finalIds,
        colorAdIds: result.colorAdIds,
        previewHash: result.previewHash,
        requestId: crypto.randomUUID(),
      },
      scope,
    };
    parametersOpen.value = false;
    previewConfirmed.value = false;
    previewOpen.value = true;
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    previewLoading.value = false;
  }
}
async function submit() {
  const frozen = frozenSubmission.value;
  if (
    !previewResult.value?.ready ||
    previewResult.value.executionAllowed === false ||
    !previewConfirmed.value ||
    submitBusy.value ||
    !frozen
  )
    return;
  submitBusy.value = true;
  previewOpen.value = false;
  try {
    // One immutable payload/request ID survives transport failure; never regenerate on retry.
    await runAdCvrTaskPackageExecution(frozen.payload, frozen.scope);
    frozenSubmission.value = undefined;
    clearSelection();
    await loadDetail();
    await loadQueue(true);
    await loadTasks();
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
    previewOpen.value = true;
  } finally {
    submitBusy.value = false;
  }
}
async function loadTasks() {
  const seq = ++taskLoadSequence;
  taskLoading.value = true;
  try {
    const response = await fetchAdCvrBatchTasks(props.scope);
    if (seq === taskLoadSequence) tasks.value = response.tasks;
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    if (seq === taskLoadSequence) taskLoading.value = false;
  }
}
async function openReceipt(task: AdCvrBatchTask) {
  const seq = ++receiptSequence;
  receipt.value = task;
  try {
    const result = await fetchAdCvrBatchTask(task.taskId, props.scope);
    if (seq === receiptSequence) receipt.value = result;
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
}
async function prepareRetry(task: AdCvrBatchTask) {
  if (previewLoading.value || adCvrExecutionInProgress.value) return;
  previewLoading.value = true;
  try {
    const result = await previewAdCvrTaskRetry(
      task.taskId,
      props.scope,
      props.projectTags,
    );
    previewResult.value = result.preview;
    frozenSubmission.value = {
      scope: props.scope,
      payload: {
        ...result.payload,
        previewHash: result.preview.previewHash,
        requestId: crypto.randomUUID(),
      },
    };
    previewConfirmed.value = false;
    previewOpen.value = true;
    if (result.excludedCount)
      message.info(`已排除 ${result.excludedCount} 项已有写入或待核对项目`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    previewLoading.value = false;
  }
}
async function reconcile(id: string) {
  if (reconcileBusy.value) return;
  reconcileBusy.value = true;
  try {
    const result = await reconcileAdCvrExecution(id, props.scope);
    message.info(result.message);
    if (receipt.value) await openReceipt(receipt.value);
    await loadTasks();
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    reconcileBusy.value = false;
  }
}
function selectBucket(value: string) {
  bucket.value = value;
  queuePage.value = 1;
  void loadQueue(false);
}
function changeView(value: typeof view.value) {
  view.value = value;
  queuePage.value = 1;
  bucket.value = 'all';
  if (value === 'execution') void loadTasks();
  if (value === 'today' || value === 'all') void loadQueue(true);
}
async function policyUpdated(value: AdCvrTaskPolicy) {
  policy.value = { ...policy.value, ...value };
  previewOpen.value = false;
  previewResult.value = undefined;
  previewConfirmed.value = false;
  frozenSubmission.value = undefined;
  message.success('执行设置已保存；原预演已失效，请重新预演');
  await loadPolicy();
  if (selected.value) void loadDetail();
}
watch(
  () => [props.scope, props.projectTags, props.snapshotDate],
  () => {
    ++queueSequence;
    ++detailSequence;
    ++packageSequence;
    ++policySequence;
    ++taskLoadSequence;
    ++receiptSequence;
    snapshot.value = undefined;
    queue.value = [];
    queueTotal.value = 0;
    summary.value = {
      total: 0,
      today: 0,
      urgent: 0,
      blocked: 0,
      observe: 0,
      failed: 0,
    };
    options.value = { sites: [], responsibles: [] };
    workloads.value = [];
    tasks.value = [];
    receipt.value = undefined;
    queueError.value = '';
    selected.value = undefined;
    detail.value = undefined;
    frozenSubmission.value = undefined;
    previewOpen.value = false;
    parametersOpen.value = false;
    clearSelection();
    queuePage.value = 1;
    useLatest.value = false;
    policy.value = undefined;
    void loadPolicy().then(() => {
      restoreFilters();
      if (view.value === 'execution') void loadTasks();
      return loadQueue(false);
    });
  },
  { deep: true },
);
onMounted(async () => {
  window.addEventListener('resize', positionActionBar);
  await loadPolicy();
  restoreFilters();
  await loadQueue(false);
});
watch([view, selected], async () => {
  await nextTick();
  workAreaObserver?.disconnect();
  if (!workAreaRef.value) return;
  workAreaObserver = new ResizeObserver(positionActionBar);
  workAreaObserver.observe(workAreaRef.value);
  positionActionBar();
});
onUnmounted(() => {
  workAreaObserver?.disconnect();
  window.removeEventListener('resize', positionActionBar);
  if (queueSearchTimer) clearTimeout(queueSearchTimer);
});
</script>

<template>
  <ConfigProvider
    :theme="{
      token: {
        colorPrimary: '#2563eb',
        colorText: '#1c2d48',
        colorTextSecondary: '#718097',
        colorBorder: '#dce4ef',
        borderRadius: 6,
        fontFamily:
          'Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif',
        fontSize: 14,
      },
    }"
  >
    <div class="task-workbench">
      <div class="workbench-head">
        <div>
          <h1>广告优化工作台</h1>
          <p v-if="snapshot">
            {{ scope === 'daily' ? '每日滚动更新' : '每月更新' }} · 近 30 天：{{
              snapshot.rangeStart
            }}
            —
            {{ snapshot.rangeEnd }}
            <span
              class="snapshot-status"
              :class="{ incomplete: snapshot.status !== 'succeeded' }"
            >
              {{ snapshot.status === 'succeeded' ? '数据完整' : '数据待核对' }}
            </span>
          </p>
          <p v-else>
            {{ scope === 'daily' ? '每日滚动更新' : '每月更新' }} ·
            等待完整广告快照
          </p>
          <p v-if="snapshot?.timing">
            数据截至 {{ snapshot.timing.dataThrough }} · 计算完成
            {{ snapshot.timing.calculatedAt || '—' }} · 归因观察
            {{ snapshot.timing.attributionObservationDays }} 天 · 操作冷却
            {{ snapshot.timing.cooldownHours }} 小时
          </p>
        </div>
        <div class="head-tools">
          <Button v-if="view !== 'settings'" @click="loadQueue(true)">
            刷新数据
          </Button>
        </div>
      </div>

      <Alert
        v-if="snapshot?.timing && !snapshot.timing.executable"
        :message="snapshot.timing.message"
        description="可继续查看和保存判断，数据更新后重新预演。"
        type="warning"
        show-icon
        class="block-gap"
      />

      <nav class="workbench-nav" aria-label="广告优化工作台视图">
        <button
          v-for="item in [
            { key: 'today', label: '今日任务' },
            { key: 'all', label: '全部任务' },
            { key: 'execution', label: '执行中心' },
            { key: 'accuracy', label: '建议审核' },
            { key: 'settings', label: '执行设置' },
          ]"
          :key="item.key"
          type="button"
          :class="{ active: view === item.key }"
          :aria-current="view === item.key ? 'page' : undefined"
          @click="changeView(item.key as typeof view)"
        >
          {{ item.label }}
        </button>
      </nav>

      <template v-if="view === 'today'">
        <div class="workbench-banner">
          <div>
            <strong>{{
              !snapshot
                ? '广告数据尚未就绪'
                : queueTotal
                  ? `从 ${queueTotal.toLocaleString()} 个 SPU 任务包开始`
                  : '暂无可处理任务包'
            }}</strong>
            <p>按证据与影响排队；逐层判断，提交前核对真实广告实体与参数。</p>
          </div>
          <Button
            :disabled="!selected"
            @click="selected && openPackage(selected)"
          >
            继续当前任务
          </Button>
        </div>
        <div class="workbench-kpis">
          <button
            v-for="item in [
              {
                key: 'all',
                label: '今日待处理',
                value: summary.today,
                note: '需要判断、执行或核对',
              },
              {
                key: 'urgent',
                label: '优先处理',
                value: summary.urgent,
                note: '低 CVR · 有效点击 · 数据完整',
              },
              {
                key: 'observe',
                label: '观察中',
                value: summary.observe,
                note: '到期后重新进入待判断',
              },
              {
                key: 'blocked',
                label: '数据待核对',
                value: summary.blocked,
                note: '含数据不完整的建议',
              },
              {
                key: 'failed',
                label: '执行异常',
                value: summary.failed,
                note: '先核对回执，避免重复写入',
              },
            ]"
            :key="item.key"
            type="button"
            class="kpi"
            :class="{
              active: bucket === item.key,
              'kpi-alert': ['urgent', 'failed'].includes(item.key),
            }"
            :aria-pressed="bucket === item.key"
            @click="selectBucket(item.key)"
          >
            <span class="kpi-label">{{ item.label }}</span><strong>{{ snapshot ? item.value.toLocaleString() : '—' }}</strong><small>{{ item.note }}</small>
          </button>
        </div>
        <Alert
          v-if="queueError"
          type="error"
          :message="queueError"
          show-icon
          class="block-gap"
        />
        <div ref="workbenchGridRef" class="workbench-grid">
          <aside
            ref="queuePanelRef"
            class="queue-panel panel"
            :style="queuePanelStyle"
          >
            <div class="panel-title">
              <h2>处理队列</h2>
              <Tag color="blue">
                {{ snapshot ? `${queueTotal} 包` : '等待快照' }}
              </Tag>
            </div>
            <p class="muted">按优先级、涉及花费与建议量排序</p>
            <Input
              v-model:value="filters.search"
              aria-label="搜索 SPU 或店铺"
              placeholder="搜索 SPU / 店铺"
              allow-clear
              @press-enter="queryTasks"
            />
            <div class="queue-filters">
              <Select
                v-model:value="filters.site"
                :options="siteOptions"
                allow-clear
                placeholder="全部站点"
                @change="
                  queuePage = 1;
                  loadQueue(false);
                "
              /><Select
                v-model:value="filters.responsible"
                :options="ownerOptions"
                allow-clear
                placeholder="全部负责人"
                @change="
                  queuePage = 1;
                  loadQueue(false);
                "
              />
            </div>
            <div class="queue-loading">
              <Spin :spinning="queueLoading">
                <div class="queue-list" aria-label="SPU 任务包队列">
                  <button
                    v-for="item in queue"
                    :key="item.packageId"
                    type="button"
                    class="queue-item"
                    :class="{
                      selected: selected?.packageId === item.packageId,
                    }"
                    :aria-pressed="selected?.packageId === item.packageId"
                    @click="openPackage(item)"
                  >
                    <div class="queue-item-top">
                      <span class="priority" :class="item.priority">{{
                        priorityLabel(item.priority)
                      }}</span><small>{{ item.site }} · {{ item.responsible }}</small>
                    </div>
                    <strong class="queue-spu">{{
                      item.spu || '未识别 SPU'
                    }}</strong>
                    <p>{{ item.store }} · {{ item.adGroupCount }} 个广告组</p>
                    <div class="queue-item-numbers">
                      <span>广告 CVR <b>{{ percent(item.adCvr) }}</b></span>
                      <span>近 30 天花费 <b>{{ money(item.groupSpend) }}</b></span>
                    </div>
                    <div class="progress-track" aria-hidden="true">
                      <i
                        :style="{
                          width: `${item.suggestionCount ? (item.reviewedCount / item.suggestionCount) * 100 : 0}%`,
                        }"
                      ></i>
                    </div>
                    <small>{{ item.reviewedCount }} /
                      {{ item.suggestionCount }} 项已判断 ·
                      {{ queueProgressLabel(item) }}</small>
                    <small class="queue-reason">{{
                      item.priorityReason
                    }}</small>
                    <small
                      v-if="item.priorityEvidence"
                      class="queue-reason"
                      :title="item.priorityEvidence.scoreMeaning"
                      >排序分 {{ item.priorityScore }} ·
                      {{ item.priorityEvidence.eligibleObjects }}
                      个对象证据达标（执行前复核）</small>
                  </button>
                  <Empty
                    v-if="queue.length === 0 && !queueLoading"
                    description="没有匹配的任务包"
                  />
                </div>
              </Spin>
            </div>
            <div class="queue-pagination">
              <Button
                size="small"
                :disabled="queuePage <= 1"
                @click="
                  queuePage--;
                  loadQueue(false);
                "
              >
                上一页
</Button><span>第 {{ queuePage }} /
                {{ Math.max(1, Math.ceil(queueTotal / 30)) }} 页</span><Button
                size="small"
                :disabled="queuePage * 30 >= queueTotal"
                @click="
                  queuePage++;
                  loadQueue(false);
                "
              >
                下一页
              </Button>
            </div>
          </aside>

          <main ref="workAreaRef" class="work-area">
            <template v-if="selected">
              <Alert
                v-if="staleSelection"
                type="warning"
                show-icon
                class="block-gap"
                message="有新的数据快照：当前草稿仍保留，旧版本不可提交。"
              >
                <template #description>
                  <Button
                    size="small"
                    @click="
                      useLatest = true;
                      loadQueue(false);
                    "
                  >
                    进入最新快照重新判断
                  </Button>
                </template>
              </Alert>
              <Alert
                v-if="detail?.policy?.mode === 'shadow'"
                type="info"
                show-icon
                class="block-gap"
                message="影子试点：判断和预演正常保存，不会调用接口修改广告。验收后由管理员开放执行。"
              />
              <Alert
                v-if="snapshot?.status !== 'succeeded'"
                type="warning"
                show-icon
                message="快照部分完成：可保存判断；执行时按每条建议的数据完整性校验。"
                class="block-gap"
              />
              <Alert
                v-if="detailError"
                type="error"
                :message="detailError"
                show-icon
                class="block-gap"
              />
              <Spin :spinning="detailLoading">
                <section class="health-panel panel">
                  <div class="health-head">
                    <div>
                      <h2>
                        {{ selected.spu || '未识别 SPU' }}
                        <span class="priority" :class="selected.priority">{{
                          priorityLabel(selected.priority)
                        }}</span>
                      </h2>
                      <p>
                        {{ selected.store }} · {{ selected.site }} ·
                        <template v-if="detail?.ownerBreakdown?.length">
                          <span v-if="detail.ownerBreakdown.length > 1">建议归属：</span>
                          <span
                            v-for="(owner, index) in detail.ownerBreakdown"
                            :key="owner.name"
                          >
                            {{ index ? ' / ' : '' }}{{ owner.name
                            }}<template v-if="detail.ownerBreakdown.length > 1">（{{ owner.suggestions }} 条）</template>
                          </span>
                        </template>
                        <template v-else>{{ selected.responsible }}</template>
                      </p>
                    </div>
                    <div class="health-controls">
                      <div class="task-progress">
                        <span>判断进度
                          <strong>{{ currentProgress }} / 5</strong></span>
                        <small :title="`任务包 ID：${selected.packageId}`">{{ selected.snapshotDate }} · SPU 诊断任务</small>
                      </div>
                      <Button size="small" @click="openHistory">历史</Button>
                    </div>
                  </div>
                  <div class="health-metrics">
                    <div>
                      <span>广告 CVR</span><strong
                        :class="{
                          red:
                            detail?.health.adCvr != null &&
                            detail?.health.targetCvr != null &&
                            detail.health.adCvr < detail.health.targetCvr,
                        }"
                        >{{
                          healthPercent(detail?.health.adCvr ?? null)
                        }}</strong><small>点击 {{ detail?.health.clicks ?? '—' }} / 订单
                        {{ detail?.health.orders ?? '—' }}</small>
                    </div>
                    <div>
                      <span>自然 CVR</span><strong>{{
                        healthPercent(detail?.health.naturalCvr ?? null)
                      }}</strong><small>{{
                        detail?.health.naturalCvrSource === 'organic'
                          ? `同站点 SPU 汇总 · ${detail.health.naturalParentCount} 个父 ASIN`
                          : detail?.health.naturalCvrSource === 'sessions'
                            ? '同站点 SPU 汇总 · 销量/会话兜底'
                            : detail?.health.naturalCvrSource === 'snapshot'
                              ? '同周期快照参照'
                              : '缺少完整的同周期自然数据'
                      }}</small>
                    </div>
                    <div>
                      <span>合理 CVR</span><strong>{{
                        healthPercent(detail?.health.targetCvr ?? null)
                      }}</strong><small>模型阈值，仅供诊断</small>
                    </div>
                    <div>
                      <span>近 30 天广告组花费</span><strong>{{ money(detail?.health.spend) }}</strong><small>站点原币；不跨币种汇总</small>
                    </div>
                  </div>
                  <div class="health-note">
                    先判断有证据的低效问题；零花费不等于低
                    CVR，样本不足不默认关闭。上层广告组与活动动作须在下层判断完成后再执行。
                  </div>
                </section>

                <section class="stage-panel panel">
                  <div class="stage-steps">
                    <button
                      v-for="(item, index) in stages"
                      :key="item.key"
                      type="button"
                      :class="{
                        current: stage === item.key,
                        complete:
                          detail?.stageCounts[item.key]?.total ===
                          detail?.stageCounts[item.key]?.reviewed,
                        locked: nextStageIndex >= 0 && index > nextStageIndex,
                      }"
                      :disabled="nextStageIndex >= 0 && index > nextStageIndex"
                      :aria-current="stage === item.key ? 'step' : undefined"
                      @click="switchStage(item.key)"
                    >
                      <span class="step-circle">
                        <svg
                          v-if="nextStageIndex >= 0 && index > nextStageIndex"
                          viewBox="0 0 20 20"
                          fill="none"
                          aria-hidden="true"
                        >
                          <rect
                            x="4.5"
                            y="8.5"
                            width="11"
                            height="8"
                            rx="1.5"
                            stroke="currentColor"
                          />
                          <path
                            d="M7 8.5V6a3 3 0 0 1 6 0v2.5"
                            stroke="currentColor"
                          />
                        </svg>
                        <svg
                          v-else-if="
                            stage !== item.key &&
                            detail?.stageCounts[item.key]?.total ===
                              detail?.stageCounts[item.key]?.reviewed
                          "
                          viewBox="0 0 20 20"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="m4 10 4 4 8-8"
                            stroke="currentColor"
                            stroke-width="1.7"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        <template v-else>{{ index + 1 }}</template> </span><span>{{ item.label
                        }}<small>{{ detail?.stageCounts[item.key]?.reviewed || 0 }}/{{
                            detail?.stageCounts[item.key]?.total || 0
                          }}
                          {{
                            stage === item.key
                              ? '当前阶段'
                              : nextStageIndex >= 0 && index > nextStageIndex
                                ? '前序未完成'
                                : '已判断'
                          }}</small></span>
                    </button>
                  </div>
                  <div class="stage-heading">
                    <div>
                      <h3>
                        {{
                          stages.findIndex((item) => item.key === stage) + 1
                        }}. {{ stageLabel(stage) }}判断
                      </h3>
                      <p>
                        {{ stages.find((item) => item.key === stage)?.note }} ·
                        当前阶段 {{ detail?.pagination.total || 0 }} 个对象 ·
                        {{
                          (detail?.stageCounts[stage]?.total || 0) -
                          (detail?.stageCounts[stage]?.reviewed || 0)
                        }}
                        个待判断 · 点击对象查看证据
                      </p>
                    </div>
                    <div class="stage-bulk-actions">
                      <Button
                        size="small"
                        :loading="decisionBusy"
                        :disabled="!writable"
                        @click="openBulkAdopt"
                      >
                        采纳{{ bulkScopeLabel }}有效建议
                      </Button>
                      <details class="bulk-more">
                        <summary>更多批量判断</summary>
                        <div>
                          <Button
                            size="small"
                            :disabled="decisionBusy || !writable"
                            @click="openBulk('observe')"
                          >
                            {{ bulkScopeLabel }}观察
                          </Button>
                          <Button
                            size="small"
                            :disabled="decisionBusy || !writable"
                            @click="openBulk('ignore')"
                          >
                            {{ bulkScopeLabel }}忽略
                          </Button>
                          <Button
                            size="small"
                            :disabled="decisionBusy || !writable"
                            @click="openBulk('retain')"
                          >
                            {{ bulkScopeLabel }}保留
                          </Button>
                        </div>
                      </details>
                    </div>
                  </div>
                  <Alert
                    v-if="stage === 'color'"
                    type="info"
                    show-icon
                    message="颜色与投放内容在当前快照中不能可靠关联；颜色关闭不会自动继承到投放对象，预演会明确展示这一限制。"
                    class="stage-alert"
                  />
                  <div class="node-scroll">
                    <table class="node-table">
                      <thead>
                        <tr>
                          <th>
                            <Checkbox
                              :checked="pageSelected"
                              :disabled="selectableRows.length === 0"
                              :indeterminate="
                                !pageSelected &&
                                selectableRows.some((row) =>
                                  selectedIds.includes(row.suggestion_id),
                                )
                              "
                              aria-label="选择当前页建议"
                              @change="
                                togglePage(
                                  ($event.target as HTMLInputElement).checked,
                                )
                              "
                            />
                          </th>
                          <th>诊断对象 / 层级</th>
                          <th>点击 / 订单</th>
                          <th>广告 CVR</th>
                          <th>花费</th>
                          <th>证据与建议</th>
                          <th>本次判断</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in currentRows" :key="row.suggestion_id">
                          <td>
                            <Checkbox
                              :checked="selectedIds.includes(row.suggestion_id)"
                              :disabled="!canSelect(row)"
                              :title="
                                editBlockReason(row) ||
                                '勾选后可批量采纳、观察、忽略或保留'
                              "
                              :aria-label="`选择 ${row.entity_name}`"
                              @change="
                                toggleRow(
                                  row,
                                  ($event.target as HTMLInputElement).checked,
                                )
                              "
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              class="node-link"
                              @click="evidence = row"
                            >
                              <strong>{{
                                row.entity_name ||
                                row.targeting_text ||
                                row.search_term ||
                                '未命名对象'
                              }}</strong><small>{{
                                row.ad_group_name ||
                                row.campaign_name ||
                                row.spu
                              }}</small>
                            </button>
                          </td>
                          <td>
                            <strong>{{ formatCount(row.clicks) }}</strong><small>/ {{ formatCount(row.orders) }} · CPC
                              {{ cpc(row) }}</small>
                          </td>
                          <td
                            :class="{
                              red:
                                row.cvr != null &&
                                Number(row.cvr) === 0 &&
                                Number(row.clicks) > 0,
                            }"
                          >
                            {{ percent(row.cvr) }}
                          </td>
                          <td>{{ money(row.spend) }}</td>
                          <td>
                            <Tag
                              :color="
                                !row.task_state?.evidence.eligible
                                  ? 'default'
                                  : row.action_type.startsWith('close_') ||
                                      row.action_type.startsWith('negative_')
                                    ? 'red'
                                    : 'blue'
                              "
                            >
                              {{ row.action_label || row.action_type }}
</Tag><small class="reason" :title="row.reason">{{
                              row.reason
                            }}</small>
                          </td>
                          <td>
                            <Tag
                              v-if="row.task_state?.inheritedFrom"
                              color="blue"
                            >
                              继承关闭 · 不重复执行
                            </Tag>
                            <Tag
                              v-else-if="row.task_state?.suppressedReason"
                              color="green"
                            >
                              上层关闭已抑制
                            </Tag>
                            <Tag
                              v-else-if="
                                row.execution_status !== 'not_requested'
                              "
                            >
                              {{ statusLabel(row.execution_status) }}
                            </Tag>
                            <Tag
                              v-else-if="row.task_state?.invalidatedReason"
                              color="orange"
                            >
                              下层已变化 · 重新复核
                            </Tag>
                            <Tag
                              v-else-if="row.task_decision"
                              :color="
                                row.task_decision === 'adopt'
                                  ? 'green'
                                  : 'orange'
                              "
                            >
                              {{
                                {
                                  adopt: '已采纳',
                                  modify: '已修改',
                                  observe: '观察中',
                                  ignore: '已忽略',
                                  retain: '已保留',
                                }[row.task_decision]
                              }}
</Tag><span v-else class="muted">待判断</span>
                          </td>
                          <td>
                            <div class="row-actions">
                              <Button
                                type="link"
                                size="small"
                                @click="evidence = row"
                              >
                                详情
                              </Button>
                              <Button
                                v-if="
                                  !row.task_decision &&
                                  recommendedRowDecision(row)
                                "
                                size="small"
                                :disabled="!canEdit(row) || decisionBusy"
                                @click="
                                  recommendedRowDecision(row) === 'observe'
                                    ? openDecision(row, 'observe')
                                    : saveDecision(
                                        row,
                                        recommendedRowDecision(row) === 'retain'
                                          ? 'retain'
                                          : 'adopt',
                                      )
                                "
                              >
                                {{ rowDecisionLabel(row) }}
                              </Button>
                              <Button
                                v-else-if="row.task_decision"
                                size="small"
                                :disabled="!canEdit(row) || decisionBusy"
                                @click="saveDecision(row, 'pending')"
                              >
                                撤销
                              </Button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <Empty
                      v-if="currentRows.length === 0 && !detailLoading"
                      description="本阶段没有建议"
                    />
                  </div>
                  <div class="stage-footer">
                    <span>当前页 {{ currentRows.length }} 项 ·
                      {{ detail?.pagination.total || 0 }} 项总计</span>
                    <div>
                      <Button
                        size="small"
                        :disabled="detailPage <= 1"
                        @click="
                          detailPage--;
                          loadDetail();
                        "
                      >
                        上一页
</Button><span>第 {{ detailPage }} 页</span><Button
                        size="small"
                        :disabled="
                          detailPage * 50 >= (detail?.pagination.total || 0)
                        "
                        @click="
                          detailPage++;
                          loadDetail();
                        "
                      >
                        下一页
</Button><Button
                        type="primary"
                        :disabled="
                          nextStageIndex < 0 ||
                          stage === 'campaign' ||
                          detail?.stageCounts[stage]?.reviewed !==
                            detail?.stageCounts[stage]?.total
                        "
                        @click="
                          switchStage(
                            stages[
                              stages.findIndex((item) => item.key === stage) + 1
                            ]?.key || stage,
                          )
                        "
                      >
                        {{
                          stage === 'campaign'
                            ? '已完成五阶段判断'
                            : `完成本层，进入${stageLabel(stages[stages.findIndex((item) => item.key === stage) + 1]?.key || '')} →`
                        }}
                      </Button>
                    </div>
                  </div>
                </section>
                <div
                  class="action-bar"
                  :style="actionBarStyle"
                  role="region"
                  aria-label="变更预览操作"
                >
                  <div class="action-summary">
                    <div>
                      <strong>{{
                        detail?.executionCandidateTotal || 0
                      }}</strong>
                      个待提交动作
                      <small>继承去重 {{ detail?.inheritedCount || 0 }} 项 ·
                        判断自动保存</small>
                    </div>
                    <div v-if="selectedIds.length > 0" class="selected-summary">
                      本批已选 {{ selectedIds.length }} 项 ·
                      {{ selectedActionRows.length }} 项可预演
                      <Button type="link" size="small" @click="clearSelection">
                        清空
                      </Button>
                    </div>
                  </div>
                  <div class="action-buttons">
                    <span class="autosave-label">草稿已自动保存</span>
                    <Button
                      type="primary"
                      :disabled="
                        (selectedActionRows.length === 0 &&
                          !detail?.executionCandidates?.length) ||
                        !writable ||
                        decisionBusy ||
                        adCvrExecutionInProgress ||
                        submitBusy
                      "
                      @click="previewSelectedOrPackage"
                    >
                      预览变更 →
                    </Button>
                  </div>
                </div>
              </Spin>
            </template>
            <div v-else class="panel empty-work">
              <Empty description="请选择左侧任务包" />
            </div>
          </main>
        </div>
      </template>

      <template v-else-if="view === 'all'">
        <div class="section-head">
          <h2>全部任务</h2>
          <p>按任务包管理所有站点与 SPU；汇总随筛选范围更新。</p>
          <Button @click="workloadsOpen = true">团队负载</Button>
        </div>
        <section class="panel all-panel">
          <div class="all-filters">
            <Select
              v-model:value="filters.assignment"
              aria-label="全部任务归属"
              :options="assignmentOptions"
              @change="queryTasks"
            />
            <Select
              v-model:value="filters.taskStatus"
              aria-label="全部任务状态"
              :options="taskStatusOptions"
              @change="queryTasks"
            />
            <Select
              v-model:value="bucket"
              aria-label="全部任务优先级"
              :options="priorityOptions"
              @change="queryTasks"
            />
            <Input
              v-model:value="filters.search"
              allow-clear
              placeholder="搜索 SPU / 店铺"
              aria-label="搜索全部任务"
              @press-enter="
                queuePage = 1;
                loadQueue(false);
              "
            />
            <Select
              v-model:value="filters.site"
              :options="siteOptions"
              allow-clear
              placeholder="全部站点"
              @change="
                queuePage = 1;
                loadQueue(false);
              "
            />
            <Select
              v-model:value="filters.responsible"
              :options="ownerOptions"
              allow-clear
              placeholder="全部负责人"
              @change="
                queuePage = 1;
                loadQueue(false);
              "
            />
            <Button
              @click="
                queuePage = 1;
                loadQueue(false);
              "
            >
              查询
            </Button>
          </div>
          <Alert
            v-if="queueError"
            type="error"
            :message="queueError"
            show-icon
          />
          <div v-if="policy?.canManage" class="ownership-bar">
            <Checkbox
              :checked="
                queue.length > 0 && checkedPackages.length === queue.length
              "
              :indeterminate="
                checkedPackages.length > 0 &&
                checkedPackages.length < queue.length
              "
              @change="
                checkedPackages = $event.target.checked
                  ? queue.map((p) => p.packageId)
                  : []
              "
            >
              选择本页任务包（{{ checkedPackages.length }}）
            </Checkbox>
            <Button
              :disabled="checkedPackages.length === 0"
              @click="transferOpen = true"
            >
              批量转交
            </Button>
          </div>
          <Spin :spinning="queueLoading">
            <div class="node-scroll">
              <table class="node-table all-table">
                <thead>
                  <tr>
                    <th v-if="policy?.canManage">选择</th>
                    <th>SPU / 店铺</th>
                    <th>站点 / 负责人</th>
                    <th>优先级</th>
                    <th>广告组</th>
                    <th>建议处理进度</th>
                    <th>执行异常</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in queue" :key="item.packageId">
                    <td v-if="policy?.canManage">
                      <Checkbox
                        :checked="checkedPackages.includes(item.packageId)"
                        :aria-label="`选择 ${item.spu} ${item.store}`"
                        @change="
                          checkedPackages = $event.target.checked
                            ? [...checkedPackages, item.packageId]
                            : checkedPackages.filter(
                                (id) => id !== item.packageId,
                              )
                        "
                      />
                    </td>
                    <td>
                      <strong>{{ item.spu || '未识别 SPU' }}</strong><small>{{ item.store }}</small>
                    </td>
                    <td>
                      {{ item.site }} ·
                      {{ item.lease?.assignedTo || item.responsible
                      }}<small>{{
                        taskStatusOptions.find(
                          (s) => s.value === item.taskStatus,
                        )?.label
                      }}</small>
                    </td>
                    <td>
                      <span class="priority" :class="item.priority">{{
                        priorityLabel(item.priority)
                      }}</span>
                    </td>
                    <td>{{ item.adGroupCount }}</td>
                    <td>
                      {{ item.reviewedCount }} / {{ item.suggestionCount }}
                    </td>
                    <td>{{ item.failedCount || '—' }}</td>
                    <td>
                      <Button
                        size="small"
                        type="link"
                        @click="
                          view = 'today';
                          openPackage(item);
                        "
                      >
                        打开任务 →
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <Empty
                v-if="queue.length === 0 && !queueLoading"
                description="没有匹配任务"
              />
            </div>
          </Spin>
          <div class="queue-pagination">
            <Button
              size="small"
              :disabled="queuePage <= 1"
              @click="
                queuePage--;
                loadQueue(false);
              "
            >
              上一页
</Button><span>共 {{ queueTotal }} 包 · 第 {{ queuePage }} 页</span><Button
              size="small"
              :disabled="queuePage * 30 >= queueTotal"
              @click="
                queuePage++;
                loadQueue(false);
              "
            >
              下一页
            </Button>
          </div>
        </section>
      </template>

      <template v-else-if="view === 'execution'">
        <div class="section-head">
          <h2>执行中心</h2>
          <Button @click="loadTasks">刷新批次</Button>
          <p>每个批次独立追踪；失败项先核对真实状态，再决定是否重试。</p>
        </div>
        <Alert
          type="info"
          show-icon
          message="成功项不会自动重放；超时或结果不明时请先核对领星当前状态。"
          class="block-gap"
        /><Spin :spinning="taskLoading">
          <div class="panel execution-list">
            <div
              v-for="task in tasks"
              :key="task.taskId"
              class="execution-item"
            >
              <div>
                <strong>{{ task.taskId }}</strong><small>{{ task.createdAt }}</small>
              </div>
              <Tag
                :color="
                  task.status === 'succeeded'
                    ? 'green'
                    : task.status === 'running'
                      ? 'blue'
                      : 'orange'
                "
              >
                {{ statusLabel(task.status) }}
</Tag><span>{{ task.completed }} / {{ task.total }} 项</span><small>{{
                task.message || task.result?.message || '查看处理回执'
              }}</small><Button size="small" @click="openReceipt(task)">逐项回执</Button><Button
                v-if="
                  task.result?.results?.some((item) => item.status === 'failed')
                "
                :disabled="adCvrExecutionInProgress"
                :loading="previewLoading"
                @click="prepareRetry(task)"
              >
                仅失败项重新预演
              </Button>
            </div>
            <Empty v-if="tasks.length === 0" description="暂无执行批次" />
          </div>
        </Spin>
        <TaskReviews
          :can-manage="policy?.canManage"
          :key="`${scope}:${projectTags.join(',')}`"
          :scope="scope"
          :project-tags="projectTags"
          @open="openReview"
        />
      </template>

      <TaskAccuracyReview
        v-else-if="view === 'accuracy'"
        :key="`${scope}:${projectTags.join(',')}`"
        :scope="scope"
        :project-tags="projectTags"
      />

      <TaskPolicySettings
        v-else-if="view === 'settings'"
        :scope="scope"
        :policy="policy"
        @refresh="loadPolicy"
        @updated="policyUpdated"
      />

      <Drawer
        :open="!!evidence"
        title="诊断证据"
        width="min(480px, 100vw)"
        @close="evidence = undefined"
      >
        <div v-if="evidence" class="evidence-body">
          <h3>{{ evidence.entity_name }}</h3>
          <p class="muted">
            {{ evidence.store_name }} · {{ evidence.spu }} ·
            {{ stageLabel(evidence.level) }}
          </p>
          <div class="drawer-evidence">
            <div>
              <span>广告 CVR</span><strong>{{ percent(evidence.cvr) }}</strong>
            </div>
            <div>
              <span>自然 CVR</span><strong>{{ percent(evidence.natural_cvr) }}</strong>
            </div>
            <div>
              <span>合理 CVR</span><strong>{{ percent(evidence.target_cvr) }}</strong>
            </div>
            <div>
              <span>点击 / 订单 · CPC</span><strong>{{ formatCount(evidence.clicks) }} /
                {{ formatCount(evidence.orders) }} · {{ cpc(evidence) }}</strong>
            </div>
            <div>
              <span>广告花费</span><strong>{{ money(evidence.spend) }}</strong>
            </div>
            <div>
              <span>建议动作</span><strong>{{ evidence.action_label }}</strong>
            </div>
          </div>
          <h4>诊断依据</h4>
          <Alert
            v-if="evidence.task_state?.invalidatedReason"
            type="warning"
            show-icon
            :message="evidence.task_state.invalidatedReason"
          />
          <p>{{ evidence.reason }}</p>
          <Alert
            v-if="evidence.task_state"
            :type="evidence.task_state.evidence.eligible ? 'info' : 'warning'"
            :message="evidence.task_state.evidence.reason"
            show-icon
          />
          <p v-if="evidence.task_state?.inheritedFrom">
            已继承父级关闭，本对象不会重复下发；撤销父级决定后恢复原判断。
          </p>
          <p v-if="evidence.task_state?.suppressedReason">
            {{ evidence.task_state.suppressedReason }}
          </p>
          <p v-if="evidence.task_state?.projection">
            剔除已选关闭对象后，历史剩余点击
            {{ evidence.task_state.projection.clicks }}，订单
            {{ evidence.task_state.projection.orders }}，CVR
            {{
              evidence.task_state.projection.cvr === null
                ? '—'
                : `${(evidence.task_state.projection.cvr * 100).toFixed(2)}%`
            }}。此为历史场景推算，不是收益预测。
          </p>
          <h4>执行影响</h4>
          <p>
            广告活动 {{ evidence.campaign_name || evidence.campaign_id
            }}<br />广告组 {{ evidence.ad_group_name || evidence.ad_group_id }}
          </p>
          <Alert
            v-if="evidence.level === 'color'"
            type="warning"
            show-icon
            message="无法从当前快照证明此颜色包含的全部投放对象；不自动继承关闭。"
          />
          <h4>人工判断</h4>
          <Alert
            v-if="editBlockReason(evidence)"
            type="info"
            show-icon
            :message="editBlockReason(evidence)"
          />
          <p>
            {{ taskDecisionLabel(evidence.task_decision) }}
            {{ evidence.task_note }}
          </p>
          <p v-if="evidence.task_observe_until">
            观察截止：{{ evidence.task_observe_until }}
          </p>
          <div class="drawer-actions">
            <Button
              :disabled="!canEdit(evidence) || decisionBusy"
              @click="
                saveDecision(evidence, 'adopt');
                evidence = undefined;
              "
            >
              采纳建议
            </Button>
            <Button
              v-if="canModify(evidence)"
              :disabled="!canEdit(evidence) || decisionBusy"
              @click="
                openDecision(evidence, 'modify');
                evidence = undefined;
              "
            >
              修改执行参数
            </Button>
            <Button
              :disabled="!canEdit(evidence) || decisionBusy"
              @click="
                openDecision(evidence, 'observe');
                evidence = undefined;
              "
            >
              观察
            </Button>
            <Button
              :disabled="!canEdit(evidence) || decisionBusy"
              @click="
                openDecision(evidence, 'ignore');
                evidence = undefined;
              "
            >
              忽略建议
            </Button>
            <Button
              :disabled="!canEdit(evidence) || decisionBusy"
              @click="
                openDecision(evidence, 'retain');
                evidence = undefined;
              "
            >
              保留现状
            </Button>
          </div>
          <h4>判断历史</h4>
          <p v-if="!evidence.task_history?.length" class="muted">
            暂无判断记录
          </p>
          <div
            v-for="event in evidence.task_history"
            :key="event.version"
            class="audit-event"
          >
            <strong>V{{ event.version }} · {{ event.actor }} ·
              {{ taskDecisionLabel(event.decision) }}</strong>
            <p>{{ event.at }} · {{ event.note || '采纳原建议' }}</p>
          </div>
        </div>
      </Drawer>

      <Modal
        :open="!!receipt"
        title="批次逐项回执"
        width="900"
        :footer="null"
        @cancel="receipt = undefined"
      >
        <template v-if="receipt">
          <p>
            {{ receipt.taskId }} · {{ statusLabel(receipt.status) }} ·
            {{ receipt.completed }}/{{ receipt.total }}
          </p>
          <Alert
            type="info"
            show-icon
            message="成功项不重放。失败或超时先核对真实状态；确认无写入的失败项可回到任务包重新预演。"
          />
          <div class="receipt-list">
            <div
              v-for="item in receipt.result?.results || []"
              :key="item.suggestionId"
              class="receipt-row"
            >
              <strong>{{ item.entityName || item.suggestionId }}</strong><Tag>{{ statusLabel(item.status) }}</Tag>
              <p>{{ item.message }}</p>
              <small>{{ item.actionType }} ·
                {{ item.adGroupName || item.adGroupId }}</small>
              <Button
                v-if="['failed', 'needs_review'].includes(item.status)"
                size="small"
                :loading="reconcileBusy"
                @click="reconcile(item.suggestionId)"
              >
                核对真实状态
              </Button>
            </div>
            <Empty
              v-if="!receipt.result?.results?.length"
              description="尚无逐项回执，请稍后刷新批次"
            />
          </div>
        </template>
      </Modal>
      <Modal
        v-model:open="bulkAdoptOpen"
        :title="`确认采纳${bulkScopeLabel}有效建议`"
        :confirm-loading="decisionBusy"
        :ok-button-props="{ disabled: bulkAdoptRows.length === 0 }"
        ok-text="确认采纳"
        @ok="adoptCurrentPage('adopt')"
      >
        <p>
          将保存以下
          {{ bulkAdoptRows.length }}
          项判断；不会直接修改广告。样本不足或数据不完整的对象仍需逐项复核。
        </p>
        <div class="bulk-adopt-list">
          <div v-for="row in bulkAdoptRows" :key="row.suggestion_id">
            <strong>{{ row.entity_name }}</strong>
            <span>{{ row.action_label || row.action_type }}</span>
          </div>
        </div>
      </Modal>
      <Modal
        v-model:open="bulkDecisionOpen"
        :title="`批量判断${bulkScopeLabel}未处理项`"
        :confirm-loading="decisionBusy"
        @ok="
          adoptCurrentPage(
            decision === 'observe'
              ? 'observe'
              : decision === 'retain'
                ? 'retain'
                : 'ignore',
          )
        "
      >
        <p>
          只处理当前阶段{{
            bulkScopeLabel
          }}尚未判断的项目；不覆盖已有判断，不直接修改广告。已采纳项可跨页选择、集中预览执行。
        </p>
        <Select
          v-if="decision === 'observe'"
          v-model:value="observeDays"
          :options="
            [3, 7, 14].map((value) => ({ label: `${value} 天后复查`, value }))
          "
          aria-label="批量观察周期"
        />
        <Input.TextArea
          v-model:value="decisionNote"
          :maxlength="1000"
          :rows="4"
          placeholder="请填写共同的处理依据"
        />
      </Modal>
      <Modal
        :open="!!decisionTarget"
        :title="`记录${{ adopt: '人工采纳', modify: '修改', observe: '观察', ignore: '忽略', retain: '保留' }[decision]}原因`"
        :confirm-loading="decisionBusy"
        @ok="confirmDecision"
        @cancel="decisionTarget = undefined"
      >
        <p>{{ decisionTarget?.entity_name }}</p>
        <TaskActionParameters
          v-if="decision === 'modify' && decisionTarget"
          v-model="decisionParameters"
          :action="decisionTarget.action_type"
        />
        <Select
          v-if="decision === 'observe'"
          v-model:value="observeDays"
          :options="
            [3, 7, 14].map((value) => ({ label: `${value} 天后复查`, value }))
          "
          aria-label="观察周期"
        />
        <Input.TextArea
          v-model:value="decisionNote"
          :rows="4"
          :maxlength="1000"
          show-count
          placeholder="说明依据、调整方案或观察复查条件"
        />
      </Modal>

      <Modal
        v-model:open="parametersOpen"
        title="本批执行参数"
        width="800"
        :confirm-loading="previewLoading"
        ok-text="检查并预览"
        @ok="doPreview"
      >
        <p class="muted">
          竞价 /
          预算以执行时当前值为基数，未填写比例时不能执行。已保存的修改使用其原参数。
        </p>
        <div class="uniform-parameters">
          <InputNumber
            v-model:value="uniformPercentage"
            :min="0.01"
            :max="99.99"
            addon-after="%"
            placeholder="本批统一比例"
            aria-label="批量调整比例"
          />
          <Button @click="applyUniformPercentage">应用到本批竞价 / 预算</Button>
          <Button :loading="baselineLoading" @click="loadBaselines">
            读取当前竞价 / 预算
          </Button>
        </div>
        <div
          v-for="row in selectedActionRows"
          :key="row.suggestion_id"
          class="parameter-row"
        >
          <div>
            <strong>{{ row.entity_name }}</strong><small>{{ row.action_label || row.action_type }} · CPC
              {{ cpc(row) }}</small>
            <small v-if="baselines[row.suggestion_id]">读取时竞价 {{ money(baselines[row.suggestion_id]?.bid) }} · 预算
              {{ money(baselines[row.suggestion_id]?.budget) }}
              {{ baselines[row.suggestion_id]?.error }}</small>
          </div>
          <TaskActionParameters
            :model-value="executionParameters[row.suggestion_id] || {}"
            :action="row.action_type"
            :disabled="row.task_decision === 'modify'"
            @update:model-value="
              executionParameters[row.suggestion_id] = $event
            "
          />
        </div>
      </Modal>
      <Modal
        v-model:open="previewOpen"
        title="变更预览 · 提交前检查"
        width="680"
        :ok-button-props="{
          disabled:
            !previewResult?.ready ||
            previewResult.executionAllowed === false ||
            !previewConfirmed ||
            submitBusy,
        }"
        ok-text="确认提交执行"
        @ok="submit"
      >
        <div v-if="previewResult">
          <Alert
            v-if="previewResult.executionAllowed === false"
            type="info"
            message="预演结果已生成；当前影子模式不下发广告修改。"
            show-icon
            class="block-gap"
          />
          <p>
            去重后 {{ previewResult.finalCount }} 个动作 ·
            {{ previewResult.inheritedCount }} 项继承关闭 ·
            {{ previewResult.suppressedCount }} 项上层关闭已抑制
          </p>
          <div
            v-for="(ids, id) in previewResult.colorAdIds"
            :key="id"
            class="preview-physical"
          >
            <strong>颜色关闭 → {{ ids.length }} 个商品广告</strong>
            <p>Ad IDs：{{ ids.join('、') }}</p>
          </div>
          <div class="preview-metrics">
            <div>
              <strong>{{ previewResult.selectedCount }}</strong><small>所选动作</small>
            </div>
            <div>
              <strong>{{ previewResult.validatedCount }}</strong><small>有效对象</small>
            </div>
            <div>
              <strong>{{ previewResult.blockers.length }}</strong><small>阻断项</small>
            </div>
          </div>
          <Alert
            v-for="item in previewResult.blockers"
            :key="item"
            :message="item"
            type="error"
            show-icon
            class="block-gap"
          /><Alert
            v-for="item in previewResult.warnings"
            :key="item"
            :message="item"
            type="warning"
            show-icon
            class="block-gap"
          /><Alert
            v-if="previewResult.ready"
            message="快照与对象校验通过；真实提交时服务端会再次预检。"
            type="success"
            show-icon
            class="block-gap"
          />
          <div class="preview-actions">
            <p v-if="previewResult.matureEvidence?.length">
              已按成熟归因窗口复核
              {{ previewResult.matureEvidence.length }}
              个关闭或否定动作；成熟数据截至
              {{ previewResult.timing?.matureThrough }}。
            </p>
            <div
              v-for="(count, action) in previewResult.actionCounts"
              :key="action"
            >
              <span>{{ action }}</span><strong>{{ count }} 项</strong>
            </div>
          </div>
          <div class="preview-entities">
            <div v-for="item in previewResult.items" :key="item.suggestionId">
              <strong>{{ item.name }}</strong><small>{{ item.action }} · 活动 {{ item.campaignId }} / 广告组
                {{ item.adGroupId || '—' }} / 对象
                {{ item.entityId || '执行时解析' }}</small>
            </div>
          </div>
          <Checkbox
            v-model:checked="previewConfirmed"
            :disabled="!previewResult.ready"
          >
            已核对对象、调整比例、否定层级及影响范围
          </Checkbox>
        </div>
      </Modal>
      <Drawer
        v-model:open="historyOpen"
        :title="`${selected?.spu || '任务包'} · 判断历史`"
        width="min(560px, 100vw)"
      >
        <Spin :spinning="historyLoading">
          <p class="muted">
            历史版本只读；当前版本的判断记录可在各对象“详情”中查看。
          </p>
          <div v-if="!historyRevision" class="history-versions">
            <Button
              v-for="item in historyVersions"
              :key="item.version"
              block
              @click="showHistoryVersion(item.version)"
            >
              {{ item.date }} · {{ item.count }} 条历史建议
            </Button>
            <Empty
              v-if="historyVersions.length === 0 && !historyLoading"
              description="暂无归档历史版本"
            />
          </div>
          <template v-else>
            <Button type="link" @click="historyRevision = ''">
              ← 返回版本
            </Button>
            <div
              v-for="item in historyRows"
              :key="item.suggestion.suggestion_id"
              class="history-row"
            >
              <strong>{{
                item.suggestion.entity_name || item.suggestion.suggestion_id
              }}</strong>
              <span>{{ taskDecisionLabel(item.decision || undefined) }} ·
                {{ item.note || '无备注' }}</span>
              <small v-for="(event, index) in item.history" :key="index">{{ event.at }} · {{ event.actor }} ·
                {{ taskDecisionLabel(event.decision)
                }}{{ event.note ? ` · ${event.note}` : '' }}</small>
            </div>
            <Empty
              v-if="historyRows.length === 0 && !historyLoading"
              description="该版本暂无建议记录"
            />
            <div class="history-pagination">
              <Button
                size="small"
                :disabled="historyPage <= 1"
                @click="showHistoryVersion(historyRevision, historyPage - 1)"
              >
                上一页
              </Button>
              <span>第 {{ historyPage }} 页</span>
              <Button
                size="small"
                :disabled="historyPage * 50 >= historyTotal"
                @click="showHistoryVersion(historyRevision, historyPage + 1)"
              >
                下一页
              </Button>
            </div>
          </template>
        </Spin>
      </Drawer>
      <Drawer
        v-model:open="workloadsOpen"
        title="当前筛选范围 · 团队负载"
        width="min(560px, 100vw)"
      >
        <p>按当前筛选范围内的真实任务包统计；共同负责的任务单独归组。</p>
        <div v-for="item in workloads" :key="item.owner" class="workload-row">
          <strong>{{ item.owner }}</strong>
          <span>{{ item.pending }} 包待处理<span v-if="item.capacity != null">
              · 已配置每日容量 {{ item.capacity }}</span></span>
        </div>
        <Empty v-if="workloads.length === 0" description="暂无匹配负载" />
      </Drawer>
      <Modal
        v-model:open="transferOpen"
        :title="`转交 ${checkedPackages.length} 个任务包`"
        :confirm-loading="leaseBusy"
        @ok="submitTransfer"
      >
        <p>
          更新任务归属，保留已保存判断和操作历史；接收人仍需具备对应广告权限。
        </p>
        <Select
          v-model:value="transferTarget"
          style="width: 100%"
          show-search
          placeholder="选择接收人"
          aria-label="任务接收人"
          :options="
            (policy?.assignees || []).map((value) => ({ label: value, value }))
          "
        />
        <Input.TextArea
          v-model:value="transferNote"
          placeholder="填写转交原因"
          aria-label="转交原因"
          :maxlength="1000"
          class="block-gap"
        />
      </Modal>
    </div>
  </ConfigProvider>
</template>

<style scoped>
.history-versions {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.history-versions :deep(.ant-btn) {
  justify-content: flex-start;
}

.history-row {
  display: grid;
  gap: 5px;
  padding: 12px 0;
  overflow-wrap: anywhere;
  border-bottom: 1px solid var(--line);
}

.history-row span,
.history-row small {
  color: var(--muted);
}

.history-pagination {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  margin-top: 14px;
}

.health-controls {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}

.bulk-more {
  position: relative;
  font-size: 12px;
}

.bulk-more summary {
  padding: 5px 8px;
  color: var(--muted);
  cursor: pointer;
}

.bulk-more > div {
  position: absolute;
  right: 0;
  z-index: 25;
  display: grid;
  gap: 4px;
  min-width: 150px;
  padding: 8px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 8px 24px #14243d16;
}

.bulk-more :deep(.ant-btn) {
  justify-content: flex-start;
}

.selected-summary {
  font-size: 12px;
  color: var(--muted);
}

.autosave-label {
  font-size: 12px;
  color: var(--green);
}

.stage-steps svg {
  width: 14px;
  height: 14px;
}

.bulk-adopt-list {
  max-height: 340px;
  margin-top: 12px;
  overflow-y: auto;
  border: 1px solid #e4eaf2;
  border-radius: 8px;
}

.bulk-adopt-list > div {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 9px 12px;
  border-bottom: 1px solid #e4eaf2;
}

.bulk-adopt-list > div:last-child {
  border-bottom: 0;
}

.bulk-adopt-list strong {
  min-width: 0;
  overflow-wrap: anywhere;
}

.bulk-adopt-list span {
  flex-shrink: 0;
  color: #576579;
}

.workload-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #e4eaf2;
}

.preview-physical {
  padding: 10px 0;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.receipt-list,
.preview-entities {
  max-height: 420px;
  overflow: auto;
}

.receipt-row,
.preview-entities > div,
.audit-event {
  padding: 12px 0;
  border-bottom: 1px solid var(--line, #e0e7f2);
}

.receipt-row small,
.preview-entities small {
  display: block;
  color: var(--muted, #67758b);
}

.drawer-actions,
.uniform-parameters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}

.workbench-kpis button.kpi {
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.workbench-kpis button.active {
  border-color: #9dbcf9;
}

.task-workbench,
.evidence-body {
  /* User-pinned P3 HTML palette; do not substitute the global app theme. */
  --ink: #1c2d48;
  --muted: #718097;
  --line: #e4eaf2;
  --blue: #2563eb;
  --blue-bg: #edf3ff;
  --bg: #f3f6fb;
  --red: #cf4754;
  --red-bg: #fff0f1;
  --green: #16846c;
  --green-bg: #e9f7f2;
  --amber: #a66612;
  --amber-bg: #fff6e5;

  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.55;
  color: var(--ink);
}

.task-workbench {
  min-height: calc(100vh - 90px);
  padding: 24px 28px 30px;
  background: var(--bg);
}

.evidence-body {
  font-size: 13px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.evidence-body h3 {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 600;
}

.evidence-body h4 {
  margin: 20px 0 6px;
  font-size: 13px;
  font-weight: 600;
}

.evidence-body p {
  margin: 0;
}

.evidence-body :deep(.ant-alert) {
  margin-top: 12px;
  font-family: inherit;
  font-size: 13px;
}

.evidence-body :deep(.ant-btn) {
  font-family: inherit;
  font-size: 13px;
}

.task-workbench button,
.task-workbench :deep(.ant-spin-nested-loading),
.task-workbench :deep(.ant-btn),
.task-workbench :deep(.ant-input),
.task-workbench :deep(.ant-select),
.task-workbench :deep(.ant-alert) {
  font-family: inherit;
}

.task-workbench strong,
.task-workbench b,
.evidence-body strong {
  font-weight: 600;
}

.task-workbench :is(button, a, input):focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 3px;
}

.task-workbench ::selection {
  color: #243c5b;
  background: #dbe8f7;
}

.task-workbench :deep(.ant-btn-sm) {
  min-height: 28px;
  padding-inline: 10px;
  font-size: 12px;
}

.task-workbench :deep(.ant-input::placeholder) {
  color: var(--muted);
}

.task-workbench
  :deep(
    .ant-select:not(.ant-select-disabled) .ant-select-selection-placeholder
  ) {
  color: var(--muted);
}

.workbench-head,
.head-tools,
.workbench-nav,
.workbench-banner,
.panel-title,
.queue-item-top,
.queue-item-numbers,
.queue-pagination,
.health-head,
.stage-heading,
.stage-footer,
.stage-footer > div,
.action-bar,
.action-buttons,
.execution-item,
.parameter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.workbench-head h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 750;
  letter-spacing: -0.5px;
}

.workbench-head p,
.muted {
  color: var(--muted);
}

.workbench-head p {
  margin: 5px 0 0;
  font-size: 13px;
}

.snapshot-status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  margin-left: 12px;
  color: #38765e;
  white-space: nowrap;
}

.snapshot-status::before {
  width: 6px;
  height: 6px;
  content: '';
  background: currentcolor;
  border-radius: 50%;
}

.snapshot-status.incomplete {
  color: #91641c;
}

.workbench-nav {
  gap: 20px;
  justify-content: flex-start;
  margin: 14px 0;
  border-bottom: 1px solid var(--line);
}

.workbench-nav button {
  padding: 10px 2px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  transition:
    color 160ms ease,
    border-color 160ms ease;
}

.workbench-nav button:hover {
  color: var(--ink);
}

.workbench-nav button.active {
  color: var(--blue);
  border-color: var(--blue);
}

.workbench-banner {
  justify-content: flex-start;
  padding: 13px 17px;
  margin-bottom: 18px;
  background: #eff5ff;
  border: 1px solid #dce7fb;
  border-radius: 10px;
}

.workbench-banner strong {
  font-size: 14px;
}

.workbench-banner p {
  margin: 3px 0 0;
  font-size: 13px;
  color: #6c80a1;
}

.workbench-banner :deep(.ant-btn) {
  margin-left: auto;
}

.workbench-kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 20px;
}

.panel {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 8px 30px #11264609;
}

.kpi {
  display: block;
  min-width: 0;
  padding: 15px 17px;
  background: white;
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 2px 3px #14233d02;
  transition: border-color 160ms ease;
}

.kpi:hover {
  border-color: #9dbcf9;
}

.kpi small {
  display: block;
}

.kpi:focus-visible {
  outline-offset: -3px;
}

.kpi span {
  font-size: 13px;
  color: var(--muted);
}

.kpi strong {
  display: block;
  margin: 9px 0 6px;
  font-size: 28px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
}

.kpi:first-child strong {
  color: var(--blue);
}

.kpi.kpi-alert strong {
  color: var(--red);
}

.kpi small,
.queue-item small,
.health-head small,
.health-metrics small,
.node-table small,
.action-bar small,
.execution-item small,
.parameter-row small {
  font-size: 12px;
  color: var(--muted);
}

.red {
  color: var(--red);
}

.amber {
  color: var(--amber);
}

.workbench-grid {
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.queue-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-height: var(--queue-height, none);
  padding: 17px 15px 12px;
  transform: translateY(var(--queue-offset, 0));
}

.queue-panel > :not(.queue-loading) {
  flex-shrink: 0;
}

.queue-loading,
.queue-loading :deep(.ant-spin-nested-loading),
.queue-loading :deep(.ant-spin-container) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.panel-title h2,
.stage-heading h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.queue-panel > .muted {
  margin: 4px 0 14px;
  font-size: 12px;
}

.queue-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin: 8px 0 12px;
}

.queue-filters :deep(.ant-select) {
  width: 100%;
  min-width: 0;
}

.queue-list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: var(--queue-height, 340px);
  padding: 0 10px;
  margin: 0 -16px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: #b9c5d4 transparent;
  scrollbar-width: thin;
}

.queue-item {
  width: 100%;
  padding: 14px 11px;
  margin-bottom: 5px;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid transparent;
  border-bottom-color: var(--line);
  border-radius: 8px;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}

.queue-item:hover {
  background: #f7f9fd;
}

.queue-item.selected {
  background: #f0f5ff;
  border-color: #c6d9ff;
  box-shadow: inset 3px 0 var(--blue);
}

.queue-item.selected small,
.queue-item.selected p,
.queue-item.selected .queue-item-numbers {
  color: #536b8b;
}

.queue-item-top {
  gap: 8px;
  align-items: flex-start;
}

.queue-item-top small {
  font-size: 12px;
  text-align: right;
  overflow-wrap: anywhere;
}

.queue-reason {
  display: block;
  margin: 6px 0;
}

.priority {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 5px;
}

.priority.urgent {
  color: var(--red);
  background: var(--red-bg);
}

.priority.high {
  color: var(--amber);
  background: var(--amber-bg);
}

.priority.routine {
  color: var(--blue);
  background: var(--blue-bg);
}

.priority.observe {
  color: #728097;
  background: #f0f3f8;
}

.queue-spu {
  display: block;
  margin: 7px 0 2px;
  font-size: 15px;
}

.queue-item p {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.queue-item-numbers {
  font-size: 12px;
  color: var(--muted);
}

.queue-item-numbers b {
  display: block;
  font-size: 15px;
  color: var(--ink);
}

.progress-track {
  height: 3px;
  margin: 8px 0 6px;
  overflow: hidden;
  background: #edf1f8;
  border-radius: 99px;
}

.progress-track i {
  display: block;
  height: 100%;
  background: var(--blue);
  border-radius: 99px;
}

.queue-pagination {
  padding-top: 8px;
  font-size: 12px;
  color: var(--muted);
}

.work-area {
  min-width: 0;
  padding-bottom: 110px;
}

.health-panel {
  padding: 20px 20px 0;
  margin-bottom: 14px;
  overflow: hidden;
}

.health-head h2 {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 4px 0;
  font-size: 21px;
  font-weight: 700;
}

.health-head p {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.task-progress {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--muted);
  text-align: right;
}

.task-progress strong {
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.task-progress small {
  display: block;
  margin-top: 4px;
}

.health-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 14px 0 18px;
}

.health-metrics > div {
  padding: 0 12px 0 0;
  border-right: 1px solid var(--line);
}

.health-metrics > div:first-child {
  padding-left: 0;
}

.health-metrics > div:last-child {
  border-right: 0;
}

.health-metrics span,
.health-metrics strong,
.health-metrics small {
  display: block;
}

.health-metrics span {
  font-size: 12px;
  color: var(--muted);
}

.health-metrics strong {
  margin: 3px 0;
  font-size: 23px;
  font-weight: 700;
}

.health-note {
  padding: 11px 20px;
  margin: 0 -20px;
  font-size: 13px;
  color: #536b90;
  background: #f8faff;
  border-top: 1px solid #e6edf7;
}

.stage-panel {
  overflow: hidden;
}

.stage-steps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 19px 15px 17px;
  border-bottom: 1px solid var(--line);
}

.stage-steps button {
  position: relative;
  min-width: 0;
  padding: 0 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  text-align: center;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.stage-steps button:not(:last-child)::after {
  position: absolute;
  top: 14px;
  left: calc(50% + 20px);
  width: calc(100% - 40px);
  height: 1px;
  content: '';
  background: #dbe3ef;
}

.stage-steps button.current {
  font-weight: 650;
  color: var(--blue);
}

.stage-steps button.locked {
  color: #7c8898;
  cursor: not-allowed;
}

.step-circle {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0 auto 7px;
  font-size: 12px;
  color: #9aa8bb;
  background: #f4f6fa;
  border: 1px solid #e0e6ef;
  border-radius: 50%;
}

.current .step-circle {
  color: white;
  background: var(--blue);
  border-color: var(--blue);
  box-shadow: 0 0 0 4px var(--blue-bg);
}

.complete .step-circle {
  color: var(--green);
  background: var(--green-bg);
  border-color: #cbe8df;
}

.stage-steps small {
  display: block;
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
}

.stage-steps button.current small {
  color: #536b8b;
}

.stage-heading {
  flex-wrap: wrap;
  padding: 16px 18px 12px;
}

.stage-bulk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.stage-heading p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.stage-alert {
  margin: 0 18px 12px;
  font-size: 12px;
  background: #f3f7fc;
  border-color: #dce6f2;
}

.node-scroll {
  overflow: auto;
  scrollbar-color: #a5b6cb #edf1f6;
  scrollbar-width: thin;
}

.node-table {
  width: 100%;
  min-width: 980px;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  border-collapse: collapse;
}

.node-table th {
  padding: 10px 13px;
  font-size: 12px;
  font-weight: 550;
  color: #8090a6;
  text-align: left;
  background: #f7f9fc;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.node-table td {
  padding: 14px 13px;
  vertical-align: middle;
  border-bottom: 1px solid #edf1f6;
}

.node-table tbody tr:hover {
  background: #f8fafc;
}

.node-table td:first-child {
  width: 38px;
}

.node-table td:nth-child(2) {
  min-width: 165px;
}

.node-table td:last-child {
  min-width: 146px;
}

.node-table small,
.node-link small {
  display: block;
  margin-top: 3px;
}

.node-link {
  display: block;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
}

.node-link:hover strong {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.node-table strong {
  font-weight: 600;
}

.reason {
  max-width: 230px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.stage-footer {
  padding: 14px 20px;
  font-size: 12px;
  color: var(--muted);
}

.stage-footer > div {
  gap: 8px;
}

.action-bar {
  position: fixed;
  bottom: 14px;
  z-index: 20;
  padding: 13px 17px;
  background: #fff;
  border: 1px solid #d9e3f4;
  border-radius: 10px;
  box-shadow:
    0 -3px 25px #22334d0a,
    0 5px 20px #22334d0b;
}

.action-bar strong {
  font-size: 22px;
  color: var(--blue);
}

.action-bar small {
  display: block;
}

.action-buttons {
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.block-gap {
  margin: 12px 0;
}

.section-head {
  margin-bottom: 15px;
}

.section-head h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.section-head p {
  margin: 4px 0;
  color: var(--muted);
}

.all-panel {
  padding: 16px;
}

.all-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-bottom: 14px;
}

.all-filters :deep(.ant-input-affix-wrapper) {
  flex: 2;
  min-width: 200px;
}

.all-filters :deep(.ant-select) {
  flex: 1;
  min-width: 150px;
}

.all-table {
  min-width: 900px;
}

.execution-list {
  padding: 8px 18px;
}

.execution-item {
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}

.execution-item > div {
  min-width: 210px;
  overflow-wrap: anywhere;
}

.execution-item small {
  display: block;
}

.empty-work {
  padding: 40px;
}

.drawer-evidence {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin: 18px 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.drawer-evidence > div {
  padding: 12px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.drawer-evidence > div:nth-child(even) {
  border-right: 0;
}

.drawer-evidence > div:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.drawer-evidence span,
.drawer-evidence strong {
  display: block;
}

.drawer-evidence span {
  font-size: 12px;
  color: var(--muted);
}

.drawer-evidence strong {
  margin-top: 4px;
}

.parameter-row {
  justify-content: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

.parameter-row > div {
  min-width: 165px;
  max-width: 240px;
}

.parameter-row strong,
.parameter-row small {
  display: block;
}

.parameter-row :deep(.ant-select),
.parameter-row :deep(.ant-input) {
  flex: 1;
  min-width: 125px;
}

.preview-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 12px 0;
}

.preview-metrics > div {
  padding: 13px;
  background: #f6f8fc;
  border-radius: 8px;
}

.preview-metrics strong,
.preview-metrics small {
  display: block;
}

.preview-metrics strong {
  font-size: 22px;
}

.preview-actions {
  margin: 15px 0;
}

.preview-actions > div {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}

@media (min-width: 1550px) {
  .workbench-grid {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .node-table td {
    padding-top: 18px;
    padding-bottom: 18px;
  }
}

@media (max-width: 1180px) {
  .workbench-grid {
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 12px;
  }

  .health-metrics strong {
    font-size: 21px;
  }

  .row-actions :deep(.ant-btn) {
    padding-inline: 6px;
  }
}

@media (max-width: 900px) {
  .task-workbench {
    padding: 14px;
  }

  .workbench-grid {
    grid-template-columns: 1fr;
  }

  .queue-list {
    max-height: 340px;
  }

  .workbench-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .health-metrics {
    grid-template-columns: repeat(2, 1fr);
  }

  .health-metrics > div:nth-child(2) {
    border-right: 0;
  }

  .health-metrics > div:nth-child(-n + 2) {
    border-bottom: 1px solid var(--line);
  }

  .execution-item {
    flex-wrap: wrap;
  }
}

@media (max-width: 560px) {
  .workbench-head,
  .workbench-banner,
  .health-head,
  .action-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .head-tools {
    justify-content: flex-start;
    width: 100%;
  }

  .workbench-kpis {
    gap: 7px;
  }

  .kpi {
    padding: 12px;
  }

  .kpi strong {
    font-size: 24px;
  }

  .workbench-nav {
    overflow: auto;
    white-space: nowrap;
  }

  .snapshot-status {
    display: flex;
    margin-top: 4px;
    margin-left: 0;
  }

  .health-panel {
    padding: 16px 15px 0;
  }

  .health-note {
    padding-inline: 15px;
    margin-inline: -15px;
  }

  .health-head h2 {
    flex-wrap: wrap;
    gap: 8px;
  }

  .task-progress {
    text-align: left;
  }

  .health-metrics > div {
    padding-inline: 8px;
  }

  .health-metrics > div:nth-child(odd) {
    padding-left: 0;
  }

  .work-area {
    padding-bottom: 130px;
  }

  .action-buttons {
    gap: 6px;
    justify-content: flex-start;
  }

  .action-bar {
    bottom: 8px;
  }

  .action-buttons :deep(.ant-btn) {
    padding-inline: 9px;
  }

  .workbench-banner :deep(.ant-btn) {
    margin-left: 0;
  }

  .stage-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .stage-footer > div {
    flex-wrap: wrap;
  }

  .stage-steps button {
    font-size: 12px;
  }

  .stage-steps {
    padding-inline: 6px;
  }

  .health-metrics strong {
    font-size: 21px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workbench-nav button,
  .kpi,
  .queue-item {
    transition: none;
  }
}
</style>
