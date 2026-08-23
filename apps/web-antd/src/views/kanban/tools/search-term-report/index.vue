<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';

import type {
  SearchTermReportCampaignRow,
  SearchTermReportOptions,
  SearchTermReportParentAsinRow,
  SearchTermReportResult,
  SearchTermReportSheet,
  SearchTermReportTask,
} from '#/api/kanban/types';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  message,
  Pagination,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createSearchTermReportTask,
  downloadSearchTermReport,
  downloadSearchTermReportChunk,
  fetchSearchTermReportCampaigns,
  fetchSearchTermReportOptions,
  fetchSearchTermReportParentAsins,
  fetchSearchTermReportTask,
} from '#/api/kanban';

const DEFAULT_DATE_RANGE: [Dayjs, Dayjs] = [
  dayjs().subtract(29, 'day'),
  dayjs(),
];
const CAMPAIGN_LOAD_DEBOUNCE_MS = 200;
const TASK_POLL_INTERVAL_MS = 30_000;
const STATE_CACHE_KEY = 'kanban:search-term-report:state:v1';
const PARENT_PAGE_SIZE = 8;

const loadingOptions = ref(false);
const searching = ref(false);
const loadingCampaigns = ref(false);
const generating = ref(false);
const downloading = ref(false);
const options = ref<SearchTermReportOptions>({
  datePresets: [],
  shops: [],
});
const parentRows = ref<SearchTermReportParentAsinRow[]>([]);
const selectedParentAsins = ref<string[]>([]);
const parentPage = ref(1);
const campaignRows = ref<SearchTermReportCampaignRow[]>([]);
const selectedCampaignIds = ref<string[]>([]);
const result = ref<null | SearchTermReportResult>(null);
const activeSheetKey = ref('');
const dateRange = ref<[Dayjs, Dayjs]>(DEFAULT_DATE_RANGE);
const includeAdAnalyzer = ref(false);
const adAnalyzerDateRange = ref<[Dayjs, Dayjs]>(DEFAULT_DATE_RANGE);
const adAnalyzerSearchField = ref<'asin' | 'msku'>('msku');
const currentTaskId = ref('');
const taskStatus = ref('');
const taskError = ref('');
let taskPollTimer: null | ReturnType<typeof setTimeout> = null;
let campaignLoadTimer: null | ReturnType<typeof setTimeout> = null;
let campaignRequestController: AbortController | null = null;
let campaignRequestSerial = 0;
const DOWNLOAD_CHUNK_SIZE = 32 * 1024;
const DOWNLOAD_CONCURRENCY = 4;
const DOWNLOAD_RETRIES = 2;
let restoringState = false;
let restoredDateRange = false;
let adAnalyzerDateTouched = false;

const query = reactive({
  shopName: '',
  spu: '',
});

const shopOptions = computed(() =>
  options.value.shops.map((value) => ({ label: value, value })),
);

const campaignOptions = computed(() =>
  campaignRows.value.map((row) => ({
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    label: `[${row.sponsoredType}] ${row.campaignName}`,
    sponsoredType: row.sponsoredType,
    value: row.campaignId,
  })),
);

const canGenerate = computed(
  () =>
    Boolean(query.shopName.trim()) &&
    Boolean(query.spu.trim()) &&
    Boolean(dateRange.value?.[0]) &&
    Boolean(dateRange.value?.[1]) &&
    (!includeAdAnalyzer.value ||
      (Boolean(adAnalyzerDateRange.value?.[0]) &&
        Boolean(adAnalyzerDateRange.value?.[1]))) &&
    (parentRows.value.length === 0 || selectedParentAsins.value.length > 0),
);

const pagedParentRows = computed(() => {
  const start = (parentPage.value - 1) * PARENT_PAGE_SIZE;
  return parentRows.value.slice(start, start + PARENT_PAGE_SIZE);
});

const activeSheet = computed<null | SearchTermReportSheet>(() => {
  const sheets = result.value?.sheets ?? [];
  return (
    sheets.find((sheet) => sheet.key === activeSheetKey.value) ??
    sheets[0] ??
    null
  );
});

const taskStatusText = computed(() => {
  if (!currentTaskId.value) return '';
  if (taskStatus.value === 'queued') return '任务已提交，等待后端执行';
  if (taskStatus.value === 'running') return '报告生成中，页面正在自动刷新状态';
  if (taskStatus.value === 'succeeded') return '报告已生成';
  if (taskStatus.value === 'failed') return taskError.value || '报告生成失败';
  return '任务状态更新中';
});

const parentColumns: TableColumnsType<SearchTermReportParentAsinRow> = [
  { dataIndex: 'action', fixed: 'left', title: '选择', width: 72 },
  { dataIndex: 'shopName', title: '店铺', width: 150 },
  { dataIndex: 'spu', title: 'SPU', width: 120 },
  { dataIndex: 'site', title: '站点', width: 80 },
  { dataIndex: 'parentAsin', title: '父ASIN', width: 150 },
  { dataIndex: 'projectTag', title: '项目标签', width: 150 },
  { dataIndex: 'lifecycle', title: '生命周期', width: 150 },
  { dataIndex: 'categoryLevel1', title: '一级分类', width: 140 },
  { dataIndex: 'categoryLevel2', title: '二级分类', width: 140 },
  { dataIndex: 'rowCount', title: '匹配行数', width: 100 },
];

const summaryColumns = computed<TableColumnsType<Record<string, any>>>(() =>
  dynamicColumns(result.value?.summaryRows ?? []),
);

const previewColumns = computed<TableColumnsType<Record<string, any>>>(() =>
  dynamicColumns(activeSheet.value?.previewRows ?? []),
);

function dynamicColumns(rows: Record<string, any>[]) {
  const keys: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }
  return keys.map((key) => ({
    dataIndex: key,
    ellipsis: true,
    key,
    title: key,
    width: columnWidth(key),
  }));
}

function columnWidth(key: string) {
  if (key.includes('搜索词') || key.toLowerCase().includes('keyword'))
    return 220;
  if (key.includes('ASIN')) return 150;
  if (key.includes('日期')) return 128;
  return 120;
}

function normalizeSpu() {
  query.spu = query.spu.trim().toUpperCase();
}

function formattedDateRange() {
  const [start, end] = dateRange.value ?? [];
  return {
    endDate: end?.format('YYYY-MM-DD') ?? '',
    startDate: start?.format('YYYY-MM-DD') ?? '',
  };
}

function formattedAdAnalyzerDateRange() {
  const [start, end] = adAnalyzerDateRange.value ?? [];
  return {
    endDate: end?.format('YYYY-MM-DD') ?? '',
    startDate: start?.format('YYYY-MM-DD') ?? '',
  };
}

function syncAdAnalyzerDateRange() {
  if (adAnalyzerDateTouched) return;
  const [start, end] = dateRange.value ?? [];
  if (start && end) {
    adAnalyzerDateRange.value = [start, end];
  }
}

function restoreCachedState() {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw) as Record<string, any>;
    restoringState = true;
    query.shopName = String(state.query?.shopName || '');
    query.spu = String(state.query?.spu || '');
    if (state.dateRange?.startDate && state.dateRange?.endDate) {
      dateRange.value = [
        dayjs(String(state.dateRange.startDate)),
        dayjs(String(state.dateRange.endDate)),
      ];
      restoredDateRange = true;
    }
    includeAdAnalyzer.value = Boolean(state.includeAdAnalyzer);
    adAnalyzerSearchField.value =
      state.adAnalyzerSearchField === 'asin' ? 'asin' : 'msku';
    if (
      state.adAnalyzerDateRange?.startDate &&
      state.adAnalyzerDateRange?.endDate
    ) {
      adAnalyzerDateRange.value = [
        dayjs(String(state.adAnalyzerDateRange.startDate)),
        dayjs(String(state.adAnalyzerDateRange.endDate)),
      ];
      adAnalyzerDateTouched = Boolean(state.adAnalyzerDateTouched);
    }
    parentRows.value = Array.isArray(state.parentRows) ? state.parentRows : [];
    selectedParentAsins.value = Array.isArray(state.selectedParentAsins)
      ? state.selectedParentAsins
          .map((item) => String(item || ''))
          .filter(Boolean)
      : [];
    campaignRows.value = Array.isArray(state.campaignRows)
      ? state.campaignRows
      : [];
    selectedCampaignIds.value = Array.isArray(state.selectedCampaignIds)
      ? state.selectedCampaignIds
          .map((item) => String(item || ''))
          .filter(Boolean)
      : [];
    currentTaskId.value = String(state.currentTaskId || '');
    taskStatus.value = String(state.taskStatus || '');
    taskError.value = String(state.taskError || '');
    activeSheetKey.value = String(state.activeSheetKey || '');
    return true;
  } catch {
    return false;
  } finally {
    restoringState = false;
  }
}

function persistCachedState() {
  if (restoringState) return;
  const { startDate, endDate } = formattedDateRange();
  const adDate = formattedAdAnalyzerDateRange();
  try {
    localStorage.setItem(
      STATE_CACHE_KEY,
      JSON.stringify({
        activeSheetKey: activeSheetKey.value,
        adAnalyzerDateRange: {
          endDate: adDate.endDate,
          startDate: adDate.startDate,
        },
        adAnalyzerDateTouched,
        adAnalyzerSearchField: adAnalyzerSearchField.value,
        currentTaskId: currentTaskId.value,
        dateRange: { endDate, startDate },
        includeAdAnalyzer: includeAdAnalyzer.value,
        campaignRows: campaignRows.value,
        parentRows: parentRows.value,
        query: {
          shopName: query.shopName,
          spu: query.spu,
        },
        selectedParentAsins: selectedParentAsins.value,
        selectedCampaignIds: selectedCampaignIds.value,
        taskError: taskError.value,
        taskStatus: taskStatus.value,
      }),
    );
  } catch {
    // Local cache is an optimization; ignore quota or privacy-mode failures.
  }
}

function applyPreset(startDate: string, endDate: string) {
  dateRange.value = [dayjs(startDate), dayjs(endDate)];
  syncAdAnalyzerDateRange();
}

function presetSelected(startDate: string, endDate: string) {
  return (
    dateRange.value[0]?.format('YYYY-MM-DD') === startDate &&
    dateRange.value[1]?.format('YYYY-MM-DD') === endDate
  );
}

function handleMainDateChange() {
  syncAdAnalyzerDateRange();
}

function handleAdAnalyzerDateChange() {
  adAnalyzerDateTouched = true;
  resetResultState();
}

function handleAdAnalyzerConfigChange() {
  resetResultState();
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return '-';
  return String(value);
}

function parentTotalText(total: number) {
  return `共 ${total} 条`;
}

function errorText(error: unknown) {
  if (error && typeof error === 'object') {
    const payload = error as Record<string, any>;
    return payload.detail || payload.message || payload.error || String(error);
  }
  return error instanceof Error ? error.message : String(error);
}

async function downloadErrorText(error: unknown) {
  if (!error || typeof error !== 'object') return errorText(error);
  const payload = error as Record<string, any>;
  const responseData = payload.response?.data ?? payload.data;
  if (!(responseData instanceof Blob)) return errorText(error);
  try {
    const text = await responseData.text();
    if (!text) return errorText(error);
    const parsed = JSON.parse(text) as Record<string, any>;
    return parsed.detail || parsed.message || parsed.error || text;
  } catch {
    return errorText(error);
  }
}

function parentRowKey(row: SearchTermReportParentAsinRow) {
  return `${row.shopName}-${row.spu}-${row.site}-${row.parentAsin}`;
}

function parentRowClassName(row: SearchTermReportParentAsinRow) {
  return selectedParentAsins.value.includes(row.parentAsin)
    ? 'selected-parent-row'
    : '';
}

function selectParent(row: SearchTermReportParentAsinRow) {
  const parent = row.parentAsin;
  if (!parent) return;
  selectedParentAsins.value = selectedParentAsins.value.includes(parent)
    ? selectedParentAsins.value.filter((item) => item !== parent)
    : [...selectedParentAsins.value, parent];
  selectedCampaignIds.value = [];
  resetResultState();
  scheduleLoadCampaigns();
}

function clearTaskPoll() {
  if (taskPollTimer) {
    clearTimeout(taskPollTimer);
    taskPollTimer = null;
  }
}

function resetResultState() {
  clearTaskPoll();
  result.value = null;
  activeSheetKey.value = '';
  currentTaskId.value = '';
  taskStatus.value = '';
  taskError.value = '';
}

function resetCandidateState() {
  clearCampaignLoad();
  campaignRequestSerial += 1;
  loadingCampaigns.value = false;
  parentRows.value = [];
  selectedParentAsins.value = [];
  campaignRows.value = [];
  selectedCampaignIds.value = [];
  resetResultState();
}

function clearCampaignLoad() {
  if (campaignLoadTimer) {
    clearTimeout(campaignLoadTimer);
    campaignLoadTimer = null;
  }
  campaignRequestController?.abort();
  campaignRequestController = null;
}

function scheduleLoadCampaigns() {
  if (campaignLoadTimer) {
    clearTimeout(campaignLoadTimer);
  }
  campaignRequestController?.abort();
  campaignLoadTimer = setTimeout(() => {
    campaignLoadTimer = null;
    void loadCampaigns();
  }, CAMPAIGN_LOAD_DEBOUNCE_MS);
}

async function loadCampaigns() {
  if (campaignLoadTimer) {
    clearTimeout(campaignLoadTimer);
    campaignLoadTimer = null;
  }
  campaignRequestController?.abort();
  campaignRequestController = null;
  const requestSerial = ++campaignRequestSerial;
  const shopName = query.shopName.trim();
  const spu = query.spu.trim();
  const parentAsins = [...selectedParentAsins.value];
  campaignRows.value = [];
  if (!shopName || !spu || parentAsins.length === 0) {
    selectedCampaignIds.value = [];
    return;
  }
  const controller = new AbortController();
  campaignRequestController = controller;
  loadingCampaigns.value = true;
  try {
    const data = await fetchSearchTermReportCampaigns(
      {
        parentAsins: parentAsins.join(','),
        shopName,
        spu,
      },
      controller.signal,
    );
    if (
      requestSerial !== campaignRequestSerial ||
      shopName !== query.shopName.trim() ||
      spu !== query.spu.trim() ||
      parentAsins.join(',') !== selectedParentAsins.value.join(',')
    ) {
      return;
    }
    campaignRows.value = data.rows;
    const validIds = new Set(data.rows.map((row) => row.campaignId));
    selectedCampaignIds.value = selectedCampaignIds.value.filter((value) =>
      validIds.has(value),
    );
  } catch (error) {
    if (!controller.signal.aborted && requestSerial === campaignRequestSerial) {
      message.error(`查询广告活动失败：${errorText(error)}`);
    }
  } finally {
    if (requestSerial === campaignRequestSerial) {
      loadingCampaigns.value = false;
    }
    if (campaignRequestController === controller) {
      campaignRequestController = null;
    }
  }
}

function handleCampaignChange() {
  resetResultState();
}

async function loadOptions() {
  loadingOptions.value = true;
  try {
    options.value = await fetchSearchTermReportOptions();
    const defaultPreset =
      options.value.datePresets.find((item) => item.label === '近30天') ??
      options.value.datePresets[0];
    if (defaultPreset && !restoredDateRange) {
      applyPreset(defaultPreset.startDate, defaultPreset.endDate);
    }
  } finally {
    loadingOptions.value = false;
  }
}

async function searchParentAsins() {
  normalizeSpu();
  if (!query.shopName.trim() || !query.spu.trim()) {
    message.warning('店铺和 SPU 不能为空');
    return;
  }
  searching.value = true;
  parentPage.value = 1;
  selectedParentAsins.value = [];
  parentRows.value = [];
  campaignRows.value = [];
  selectedCampaignIds.value = [];
  resetResultState();
  try {
    const data = await fetchSearchTermReportParentAsins({
      shopName: query.shopName.trim(),
      spu: query.spu.trim(),
    });
    parentRows.value = data.rows;
    if (data.rows.length === 1) {
      selectedParentAsins.value = data.rows[0]?.parentAsin
        ? [data.rows[0].parentAsin]
        : [];
    }
    await loadCampaigns();
    if (data.rows.length === 0) {
      message.warning('未找到该店铺 + SPU 对应的父ASIN');
    }
  } catch (error) {
    message.error(`查询父ASIN失败：${errorText(error)}`);
  } finally {
    searching.value = false;
  }
}

async function generateReport() {
  normalizeSpu();
  const { startDate, endDate } = formattedDateRange();
  const adDate = formattedAdAnalyzerDateRange();
  if (!query.shopName.trim() || !query.spu.trim()) {
    message.warning('店铺和 SPU 不能为空');
    return;
  }
  if (!startDate || !endDate) {
    message.warning('请选择报告日期范围');
    return;
  }
  if (includeAdAnalyzer.value && (!adDate.startDate || !adDate.endDate)) {
    message.warning('请选择广告分析日期范围');
    return;
  }
  if (parentRows.value.length > 0 && selectedParentAsins.value.length === 0) {
    message.warning('请先选择至少一个父ASIN');
    return;
  }

  generating.value = true;
  resetResultState();
  try {
    const task = await createSearchTermReportTask({
      adAnalyzerEndDate: includeAdAnalyzer.value ? adDate.endDate : null,
      adAnalyzerSearchField: adAnalyzerSearchField.value,
      adAnalyzerStartDate: includeAdAnalyzer.value ? adDate.startDate : null,
      campaignId: selectedCampaignIds.value[0] || null,
      campaignIds: selectedCampaignIds.value,
      endDate,
      includeAdAnalyzer: includeAdAnalyzer.value,
      parentAsin: selectedParentAsins.value[0] || null,
      parentAsins: selectedParentAsins.value,
      shopName: query.shopName.trim(),
      spu: query.spu.trim(),
      startDate,
    });
    currentTaskId.value = task.taskId;
    message.info('任务已提交，正在后台生成报告');
    handleTaskStatus(task);
  } catch (error) {
    message.error(`生成报告失败：${errorText(error)}`);
    generating.value = false;
  }
}

function handleTaskStatus(task: SearchTermReportTask) {
  if (task.taskId !== currentTaskId.value) return;
  taskStatus.value = task.status;
  taskError.value = task.error || '';

  if (task.status === 'succeeded') {
    if (!task.result) {
      taskStatus.value = 'failed';
      taskError.value = '任务已完成但未返回报告结果';
      message.error(taskError.value);
      generating.value = false;
      return;
    }
    result.value = task.result;
    if (task.result.parentAsins?.length) {
      selectedParentAsins.value = task.result.parentAsins;
    } else if (task.result.parentAsin) {
      selectedParentAsins.value = [task.result.parentAsin];
    } else {
      selectedParentAsins.value = [];
    }
    selectedCampaignIds.value = task.result.campaignIds ?? [];
    activeSheetKey.value = task.result.sheets[0]?.key ?? '';
    generating.value = false;
    message.success('搜索词报告已生成');
    persistCachedState();
    return;
  }

  if (task.status === 'failed') {
    generating.value = false;
    message.error(`生成报告失败：${task.error || '未知错误'}`);
    persistCachedState();
    return;
  }

  taskPollTimer = setTimeout(() => {
    pollTaskStatus(task.taskId);
  }, TASK_POLL_INTERVAL_MS);
}

async function pollTaskStatus(taskId: string) {
  try {
    const task = await fetchSearchTermReportTask(taskId);
    handleTaskStatus(task);
  } catch (error) {
    generating.value = false;
    message.error(`查询任务状态失败：${errorText(error)}`);
  }
}

async function downloadReport() {
  if (!result.value?.fileName) {
    message.warning('请先生成报告');
    return;
  }
  await downloadFile(result.value.fileName);
}

async function downloadRangeWithRetry(
  fileName: string,
  start: number,
  end: number,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < DOWNLOAD_RETRIES; attempt += 1) {
    try {
      const chunk = await downloadSearchTermReportChunk(fileName, start, end);
      const expectedEnd = Number.isFinite(chunk.fileSize)
        ? Math.min(end, chunk.fileSize - 1)
        : end;
      const expectedSize = expectedEnd - start + 1;
      if (
        chunk.status !== 200 ||
        chunk.start !== start ||
        chunk.end !== expectedEnd ||
        chunk.blob.size !== expectedSize
      ) {
        throw new Error(`文件分段校验失败：${start}-${end}`);
      }
      return chunk;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < DOWNLOAD_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(errorText(lastError));
}

async function downloadReportBlob(fileName: string) {
  const first = await downloadRangeWithRetry(
    fileName,
    0,
    DOWNLOAD_CHUNK_SIZE - 1,
  );
  if (!Number.isFinite(first.fileSize) || first.fileSize <= 0) {
    return downloadSearchTermReport(fileName);
  }
  if (first.end + 1 >= first.fileSize) return first.blob;

  const ranges: Array<[number, number]> = [];
  for (
    let start = first.end + 1;
    start < first.fileSize;
    start += DOWNLOAD_CHUNK_SIZE
  ) {
    ranges.push([
      start,
      Math.min(start + DOWNLOAD_CHUNK_SIZE - 1, first.fileSize - 1),
    ]);
  }

  const parts: Blob[] = [first.blob];
  for (let index = 0; index < ranges.length; index += DOWNLOAD_CONCURRENCY) {
    const batch = ranges.slice(index, index + DOWNLOAD_CONCURRENCY);
    const chunks = await Promise.all(
      batch.map(([start, end]) => downloadRangeWithRetry(fileName, start, end)),
    );
    parts.push(...chunks.map((chunk) => chunk.blob));
  }

  const blob = new Blob(parts, {
    type:
      first.contentType ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  if (blob.size !== first.fileSize) {
    throw new Error(`文件分段不完整：${blob.size}/${first.fileSize}`);
  }
  return blob;
}

async function downloadFile(fileName: string) {
  downloading.value = true;
  try {
    const blob = await downloadReportBlob(fileName);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    message.error(`下载失败：${await downloadErrorText(error)}`);
  } finally {
    downloading.value = false;
  }
}

watch(
  () => ({
    activeSheetKey: activeSheetKey.value,
    adAnalyzerDateEnd: formattedAdAnalyzerDateRange().endDate,
    adAnalyzerDateStart: formattedAdAnalyzerDateRange().startDate,
    adAnalyzerSearchField: adAnalyzerSearchField.value,
    currentTaskId: currentTaskId.value,
    dateEnd: formattedDateRange().endDate,
    dateStart: formattedDateRange().startDate,
    includeAdAnalyzer: includeAdAnalyzer.value,
    campaignRows: campaignRows.value,
    parentRows: parentRows.value,
    queryShopName: query.shopName,
    querySpu: query.spu,
    selectedParentAsins: selectedParentAsins.value,
    selectedCampaignIds: selectedCampaignIds.value,
    taskError: taskError.value,
    taskStatus: taskStatus.value,
  }),
  persistCachedState,
  { deep: true },
);

onMounted(() => {
  const restored = restoreCachedState();
  loadOptions();
  if (restored && currentTaskId.value) {
    generating.value = ['queued', 'running'].includes(taskStatus.value);
    pollTaskStatus(currentTaskId.value);
  }
});
onBeforeUnmount(() => {
  clearTaskPoll();
  clearCampaignLoad();
});
</script>

<template>
  <div class="search-term-report-page">
    <section class="page-head">
      <div>
        <h1>搜索词报告词库</h1>
        <p>按店铺、SPU、父ASIN 和日期范围生成搜索词报告 Excel。</p>
      </div>
    </section>

    <Spin :spinning="loadingOptions">
      <Card class="query-card" :body-style="{ padding: '16px' }">
        <Form layout="vertical">
          <div class="query-grid">
            <Form.Item label="店铺" required>
              <Select
                v-model:value="query.shopName"
                :options="shopOptions"
                allow-clear
                placeholder="选择店铺"
                show-search
                @change="resetCandidateState"
              />
            </Form.Item>
            <Form.Item label="SPU" required>
              <Input
                v-model:value="query.spu"
                placeholder="如 LLW000001"
                @blur="normalizeSpu"
                @change="resetCandidateState"
                @press-enter="searchParentAsins"
              />
            </Form.Item>
            <Form.Item class="date-field" label="报告日期范围" required>
              <DatePicker.RangePicker
                v-model:value="dateRange"
                class="full-control"
                format="YYYY-MM-DD"
                value-format=""
                @change="handleMainDateChange"
              />
            </Form.Item>
          </div>
          <div class="preset-row">
            <span>快捷日期</span>
            <Button
              v-for="preset in options.datePresets"
              :key="preset.label"
              size="small"
              :type="
                presetSelected(preset.startDate, preset.endDate)
                  ? 'primary'
                  : 'default'
              "
              @click="applyPreset(preset.startDate, preset.endDate)"
            >
              {{ preset.label }}
            </Button>
            <Button
              class="parent-search-button"
              :loading="searching"
              type="primary"
              @click="searchParentAsins"
            >
              查询父ASIN
            </Button>
          </div>
          <div class="campaign-filter-row">
            <Form.Item label="广告活动（可选）">
              <Select
                v-model:value="selectedCampaignIds"
                :disabled="selectedParentAsins.length === 0"
                :loading="loadingCampaigns"
                max-tag-count="responsive"
                :max-tag-text-length="28"
                :options="campaignOptions"
                allow-clear
                mode="multiple"
                option-filter-prop="label"
                placeholder="不选择表示全部广告活动"
                show-search
                @change="handleCampaignChange"
              >
                <template #option="{ campaignId, campaignName, sponsoredType }">
                  <div class="campaign-option">
                    <Tag :color="sponsoredType === 'SP' ? 'blue' : 'cyan'">
                      {{ sponsoredType }}
                    </Tag>
                    <span class="campaign-option-name">{{ campaignName }}</span>
                    <span class="campaign-option-id">{{ campaignId }}</span>
                  </div>
                </template>
              </Select>
            </Form.Item>
            <span class="campaign-filter-summary">
              {{
                selectedCampaignIds.length > 0
                  ? `已选择 ${selectedCampaignIds.length} / ${campaignRows.length} 个活动`
                  : campaignRows.length > 0
                    ? `当前商品共 ${campaignRows.length} 个活动，默认查询全部`
                    : '选择父ASIN后加载广告活动'
              }}
            </span>
          </div>
          <div class="ad-analyzer-row">
            <div class="ad-analyzer-switch">
              <Switch
                v-model:checked="includeAdAnalyzer"
                @change="handleAdAnalyzerConfigChange"
              />
              <span>附加广告ASIN和广告活动 xlsx</span>
            </div>
            <Select
              v-model:value="adAnalyzerSearchField"
              :disabled="!includeAdAnalyzer"
              class="ad-search-field"
              :options="[
                { label: 'MSKU', value: 'msku' },
                { label: 'ASIN', value: 'asin' },
              ]"
              @change="handleAdAnalyzerConfigChange"
            />
            <DatePicker.RangePicker
              v-model:value="adAnalyzerDateRange"
              :disabled="!includeAdAnalyzer"
              class="ad-date-range"
              format="YYYY-MM-DD"
              value-format=""
              @change="handleAdAnalyzerDateChange"
            />
          </div>
        </Form>
      </Card>
    </Spin>

    <section class="result-section">
      <div class="section-title">
        <div>
          <h2>父ASIN候选</h2>
          <p>输入店铺和 SPU 后先查询候选，可选择一个或多个父ASIN。</p>
        </div>
        <Tag v-if="selectedParentAsins.length > 0" color="blue">
          已选择 {{ selectedParentAsins.length }} 个
        </Tag>
      </div>
      <Table
        :columns="parentColumns"
        :data-source="pagedParentRows"
        :loading="searching"
        :pagination="false"
        :row-class-name="parentRowClassName"
        :row-key="parentRowKey"
        :scroll="{ x: 1254 }"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'action'">
            <Checkbox
              :checked="selectedParentAsins.includes(record.parentAsin)"
              @change="selectParent(record as SearchTermReportParentAsinRow)"
            />
          </template>
          <template v-else-if="column.dataIndex === 'parentAsin'">
            <Button
              size="small"
              type="link"
              @click="selectParent(record as SearchTermReportParentAsinRow)"
            >
              {{ record.parentAsin }}
            </Button>
          </template>
        </template>
      </Table>
      <div class="parent-table-footer">
        <Button
          class="parent-generate-button"
          :disabled="!canGenerate"
          :loading="generating"
          type="primary"
          @click="generateReport"
        >
          生成搜索词报告
        </Button>
        <Pagination
          v-model:current="parentPage"
          :page-size="PARENT_PAGE_SIZE"
          :show-size-changer="false"
          :show-total="parentTotalText"
          :total="parentRows.length"
          size="small"
        />
      </div>
    </section>

    <section class="result-section">
      <div class="section-title">
        <div>
          <h2>生成结果</h2>
          <p>生成完成后可预览各 sheet 前 50 行，并下载完整 Excel。</p>
          <div v-if="currentTaskId" class="task-status">
            <Tag
              :color="
                taskStatus === 'failed'
                  ? 'red'
                  : taskStatus === 'succeeded'
                    ? 'green'
                    : 'blue'
              "
            >
              {{ taskStatus || 'queued' }}
            </Tag>
            <span>{{ taskStatusText }}</span>
          </div>
        </div>
        <Space>
          <Button
            :disabled="!result"
            :loading="downloading"
            type="primary"
            @click="downloadReport"
          >
            下载报告
          </Button>
        </Space>
      </div>

      <template v-if="result">
        <Descriptions
          :column="{ lg: 4, md: 2, sm: 1, xs: 1 }"
          bordered
          class="result-desc"
          size="small"
        >
          <Descriptions.Item label="店铺">
            {{ result.shopName }}
          </Descriptions.Item>
          <Descriptions.Item label="SPU">{{ result.spu }}</Descriptions.Item>
          <Descriptions.Item label="父ASIN">
            {{ result.parentAsin }}
          </Descriptions.Item>
          <Descriptions.Item label="报告日期">
            {{ result.reportDate }}
          </Descriptions.Item>
          <Descriptions.Item label="广告活动">
            {{
              result.campaignIds?.length
                ? `${result.campaignIds.length} 个`
                : '全部'
            }}
          </Descriptions.Item>
          <Descriptions.Item :span="4" label="文件名">
            {{ result.fileName }}
          </Descriptions.Item>
        </Descriptions>

        <div v-if="result.extraFiles?.length" class="extra-files">
          <h3>附加文件</h3>
          <div class="extra-file-list">
            <div
              v-for="file in result.extraFiles"
              :key="file.key"
              class="extra-file-item"
            >
              <div>
                <strong>{{ file.label }}</strong>
                <span>
                  {{ file.reportDate }} · {{ file.searchField.toUpperCase() }}
                  {{ file.searchTextCount }} 个 · {{ file.rowCount }} 行
                </span>
              </div>
              <Button size="small" @click="downloadFile(file.fileName)">
                下载
              </Button>
            </div>
          </div>
        </div>

        <div v-if="result.summaryRows.length > 0" class="summary-table">
          <h3>汇总</h3>
          <Table
            :columns="summaryColumns"
            :data-source="result.summaryRows"
            :pagination="false"
            :scroll="{ x: Math.max(summaryColumns.length * 120, 720) }"
            size="small"
          >
            <template #bodyCell="{ text }">
              {{ formatCell(text) }}
            </template>
          </Table>
        </div>

        <Tabs v-model:active-key="activeSheetKey" class="sheet-tabs">
          <Tabs.TabPane
            v-for="sheet in result.sheets"
            :key="sheet.key"
            :tab="`${sheet.label} (${sheet.rowCount})`"
          >
            <div class="sheet-summary">
              <Tag color="geekblue">预览 {{ sheet.previewRows.length }} 行</Tag>
            </div>
            <Table
              :columns="previewColumns"
              :data-source="sheet.previewRows"
              :pagination="{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 行预览`,
              }"
              :scroll="{ x: Math.max(previewColumns.length * 120, 960) }"
              size="small"
            >
              <template #bodyCell="{ text }">
                {{ formatCell(text) }}
              </template>
            </Table>
          </Tabs.TabPane>
        </Tabs>
      </template>
      <Empty
        v-else
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
        description="生成报告后展示预览和下载入口"
      />
    </section>
  </div>
</template>

<style scoped>
.search-term-report-page {
  min-height: calc(100vh - 112px);
  padding: 18px;
  background: #eef3f8;
}

.page-head,
.section-title {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.page-head {
  margin-bottom: 14px;
}

.page-head h1,
.section-title h2 {
  margin: 0;
  font-weight: 700;
  color: #12233f;
  letter-spacing: 0;
}

.page-head h1 {
  font-size: 24px;
  line-height: 32px;
}

.section-title h2 {
  font-size: 18px;
  line-height: 26px;
}

.page-head p,
.section-title p {
  margin: 4px 0 0;
  color: #64748b;
}

.query-card,
.result-section {
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.result-section {
  padding: 16px;
}

.query-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(180px, 0.7fr) minmax(
      320px,
      1.2fr
    );
  gap: 12px;
  align-items: end;
}

.date-field {
  min-width: 0;
}

.full-control {
  width: 100%;
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
  color: #64748b;
}

.parent-search-button {
  margin-left: auto;
}

.parent-table-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  min-height: 32px;
  margin-top: 12px;
}

.campaign-filter-row {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) auto;
  gap: 12px;
  align-items: end;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid #e2e8f0;
}

.campaign-filter-row :deep(.ant-form-item) {
  margin-bottom: 0;
}

.campaign-filter-summary {
  padding-bottom: 6px;
  color: #64748b;
  white-space: nowrap;
}

.campaign-option {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.campaign-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  color: #1e293b;
  white-space: nowrap;
}

.campaign-option-id {
  margin-left: auto;
  font-size: 12px;
  color: #94a3b8;
}

.ad-analyzer-row {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 180px minmax(280px, 1fr);
  gap: 10px;
  align-items: center;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid #e2e8f0;
}

.ad-analyzer-switch {
  display: flex;
  gap: 8px;
  align-items: center;
  color: #334155;
}

.ad-search-field,
.ad-date-range {
  width: 100%;
}

.result-desc,
.extra-files,
.summary-table,
.sheet-tabs {
  margin-top: 14px;
}

.extra-files h3,
.summary-table h3 {
  margin: 0 0 10px;
  font-size: 15px;
  line-height: 22px;
  color: #12233f;
}

.extra-file-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px;
}

.extra-file-item {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #dbe5ef;
  border-radius: 8px;
}

.extra-file-item strong {
  display: block;
  color: #12233f;
}

.extra-file-item span {
  display: block;
  margin-top: 2px;
  color: #64748b;
}

.sheet-summary {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
  color: #64748b;
}

.task-status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  color: #475569;
}

:deep(.selected-parent-row td) {
  background: #eff6ff !important;
}

@media (max-width: 960px) {
  .ad-analyzer-row,
  .campaign-filter-row,
  .query-grid {
    grid-template-columns: 1fr;
  }

  .campaign-filter-summary {
    padding-bottom: 0;
    white-space: normal;
  }

  .parent-search-button {
    width: 100%;
    margin-left: 0;
  }

  .page-head,
  .section-title {
    flex-direction: column;
  }
}
</style>
