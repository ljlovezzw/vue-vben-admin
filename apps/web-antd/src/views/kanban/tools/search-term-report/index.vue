<script setup lang="ts">
import type { Dayjs } from 'dayjs';
import type { TableColumnsType } from 'ant-design-vue';

import type {
  SearchTermReportOptions,
  SearchTermReportParentAsinRow,
  SearchTermReportResult,
  SearchTermReportSheet,
  SearchTermReportTask,
} from '#/api/kanban/types';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

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
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createSearchTermReportTask,
  downloadSearchTermReport,
  fetchSearchTermReportTask,
  fetchSearchTermReportOptions,
  fetchSearchTermReportParentAsins,
} from '#/api/kanban';

const DEFAULT_DATE_RANGE: [Dayjs, Dayjs] = [
  dayjs().subtract(29, 'day'),
  dayjs(),
];
const TASK_POLL_INTERVAL_MS = 30_000;

const loadingOptions = ref(false);
const searching = ref(false);
const generating = ref(false);
const downloading = ref(false);
const options = ref<SearchTermReportOptions>({
  datePresets: [],
  shops: [],
});
const parentRows = ref<SearchTermReportParentAsinRow[]>([]);
const selectedParentAsins = ref<string[]>([]);
const result = ref<SearchTermReportResult | null>(null);
const activeSheetKey = ref('');
const dateRange = ref<[Dayjs, Dayjs]>(DEFAULT_DATE_RANGE);
const currentTaskId = ref('');
const taskStatus = ref('');
const taskError = ref('');
let taskPollTimer: ReturnType<typeof setTimeout> | null = null;

const query = reactive({
  shopName: '',
  spu: '',
});

const shopOptions = computed(() =>
  options.value.shops.map((value) => ({ label: value, value })),
);

const canGenerate = computed(
  () =>
    Boolean(query.shopName.trim()) &&
    Boolean(query.spu.trim()) &&
    Boolean(dateRange.value?.[0]) &&
    Boolean(dateRange.value?.[1]) &&
    (parentRows.value.length === 0 || selectedParentAsins.value.length > 0),
);

const activeSheet = computed<SearchTermReportSheet | null>(() => {
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
  if (key.includes('搜索词') || key.toLowerCase().includes('keyword')) return 220;
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

function applyPreset(startDate: string, endDate: string) {
  dateRange.value = [dayjs(startDate), dayjs(endDate)];
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return '-';
  return String(value);
}

function errorText(error: unknown) {
  if (error && typeof error === 'object') {
    const payload = error as Record<string, any>;
    return payload.detail || payload.message || payload.error || String(error);
  }
  return error instanceof Error ? error.message : String(error);
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

async function loadOptions() {
  loadingOptions.value = true;
  try {
    options.value = await fetchSearchTermReportOptions();
    const defaultPreset =
      options.value.datePresets.find((item) => item.label === '近30天') ??
      options.value.datePresets[0];
    if (defaultPreset) {
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
  selectedParentAsins.value = [];
  parentRows.value = [];
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
  if (!query.shopName.trim() || !query.spu.trim()) {
    message.warning('店铺和 SPU 不能为空');
    return;
  }
  if (!startDate || !endDate) {
    message.warning('请选择报告日期范围');
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
      endDate,
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
    selectedParentAsins.value = task.result.parentAsins?.length
      ? task.result.parentAsins
      : task.result.parentAsin
        ? [task.result.parentAsin]
        : [];
    activeSheetKey.value = task.result.sheets[0]?.key ?? '';
    generating.value = false;
    message.success('搜索词报告已生成');
    return;
  }

  if (task.status === 'failed') {
    generating.value = false;
    message.error(`生成报告失败：${task.error || '未知错误'}`);
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
  downloading.value = true;
  try {
    const blob = await downloadSearchTermReport(result.value.fileName);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.value.fileName;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    message.error(`下载失败：${errorText(error)}`);
  } finally {
    downloading.value = false;
  }
}

onMounted(loadOptions);
onBeforeUnmount(clearTaskPoll);
</script>

<template>
  <div class="search-term-report-page">
    <section class="page-head">
      <div>
        <h1>搜索词报告词库</h1>
        <p>按店铺、SPU、父ASIN 和日期范围生成搜索词报告 Excel。</p>
      </div>
      <Space>
        <Button :loading="searching" @click="searchParentAsins">
          查询父ASIN
        </Button>
        <Button
          :disabled="!canGenerate"
          :loading="generating"
          type="primary"
          @click="generateReport"
        >
          生成搜索词报告
        </Button>
      </Space>
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
                @change="resetResultState"
              />
            </Form.Item>
            <Form.Item label="SPU" required>
              <Input
                v-model:value="query.spu"
                placeholder="如 LLW000001"
                @blur="normalizeSpu"
                @press-enter="searchParentAsins"
              />
            </Form.Item>
            <Form.Item class="date-field" label="报告日期范围" required>
              <DatePicker.RangePicker
                v-model:value="dateRange"
                class="full-control"
                format="YYYY-MM-DD"
                value-format=""
              />
            </Form.Item>
          </div>
          <div class="preset-row">
            <span>快捷日期</span>
            <Button
              v-for="preset in options.datePresets"
              :key="preset.label"
              size="small"
              @click="applyPreset(preset.startDate, preset.endDate)"
            >
              {{ preset.label }}
            </Button>
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
        <Tag v-if="selectedParentAsins.length" color="blue">
          已选择 {{ selectedParentAsins.length }} 个
        </Tag>
      </div>
      <Table
        :columns="parentColumns"
        :data-source="parentRows"
        :loading="searching"
        :pagination="{ pageSize: 8, showTotal: (total) => `共 ${total} 条` }"
        :row-class-name="parentRowClassName"
        :row-key="parentRowKey"
        :scroll="{ x: 974 }"
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
    </section>

    <section class="result-section">
      <div class="section-title">
        <div>
          <h2>生成结果</h2>
          <p>生成完成后可预览各 sheet 前 50 行，并下载完整 Excel。</p>
          <div v-if="currentTaskId" class="task-status">
            <Tag :color="taskStatus === 'failed' ? 'red' : taskStatus === 'succeeded' ? 'green' : 'blue'">
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
          <Descriptions.Item :span="4" label="文件名">
            {{ result.fileName }}
          </Descriptions.Item>
        </Descriptions>

        <div v-if="result.summaryRows.length" class="summary-table">
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
              :pagination="{ pageSize: 10, showTotal: (total) => `共 ${total} 行预览` }"
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
  color: #12233f;
  font-weight: 700;
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
  background: #ffffff;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.result-section {
  padding: 16px;
}

.query-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(180px, 0.7fr) minmax(320px, 1.2fr);
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

.result-desc,
.summary-table,
.sheet-tabs {
  margin-top: 14px;
}

.summary-table h3 {
  margin: 0 0 10px;
  color: #12233f;
  font-size: 15px;
  line-height: 22px;
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
  .query-grid {
    grid-template-columns: 1fr;
  }

  .page-head,
  .section-title {
    flex-direction: column;
  }
}
</style>
