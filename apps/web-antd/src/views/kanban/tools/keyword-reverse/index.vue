<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  KeywordReverseColumn,
  KeywordReverseResult,
} from '#/api/kanban/types';

import { computed, reactive, ref } from 'vue';

import {
  Button,
  Card,
  Checkbox,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
  Space,
  Spin,
  Table,
} from 'ant-design-vue';

import { fetchKeywordReverse } from '#/api/kanban';

type SortDirection = 'ASC' | 'DESC';

const loading = ref(false);
const drawerOpen = ref(false);
const highFrequencyCollapsed = ref(false);
const selectedRow = ref<null | Record<string, any>>(null);
const result = ref<KeywordReverseResult | null>(null);
const asinInput = ref('B0GWQ7S8SR');
const keywordFilter = ref('');
const showTopProducts = ref(true);

const query = reactive({
  marketPlaceId: 1,
  monthStr: 'Last 30 Days',
  pageNo: 1,
  pageSize: 20,
  sortDirection: 'DESC' as SortDirection,
  sortField: 'trafficRatio',
});

const monthOptions = [
  { label: '近 7 天', value: 'Last 7 Days' },
  { label: '近 30 天', value: 'Last 30 Days' },
  { label: '近 90 天', value: 'Last 90 Days' },
];

const sortFieldOptions = [
  { label: '流量占比', value: 'trafficRatio' },
  { label: '搜索量', value: 'searchVolume' },
  { label: '自然排名', value: 'organicRank' },
  { label: '广告排名', value: 'sponsoredRank' },
  { label: '标题密度', value: 'titleDensity' },
];

const totalText = computed(() => result.value?.page.total ?? 0);
const highFrequencyWords = computed(
  () => result.value?.highFrequencyWords ?? [],
);
const rows = computed(() => result.value?.rows ?? []);
const filteredRows = computed(() => {
  const keyword = keywordFilter.value.trim().toLowerCase();
  if (!keyword) return rows.value;
  return rows.value.filter((row) =>
    String(keywordText(row)).toLowerCase().includes(keyword),
  );
});

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: query.pageNo,
  pageSize: query.pageSize,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 个关键词`,
  total: result.value?.page.total ?? 0,
}));

const tableColumns = computed<TableColumnsType<Record<string, any>>>(() => {
  const columns = (result.value?.columns ?? [])
    .filter((column) => showTopProducts.value || !isProductColumn(column.key))
    .map((column) => ({
      dataIndex: column.key,
      ellipsis: column.kind === 'text' && !isKeywordColumn(column.key),
      fixed: column.fixed === 'left' ? ('left' as const) : undefined,
      key: column.key,
      title: column.label,
      width: columnWidth(column),
    }));

  return [
    {
      dataIndex: '__index',
      fixed: 'left',
      key: '__index',
      title: '序号',
      width: 72,
    },
    ...columns,
  ];
});

function parseAsins() {
  return [
    ...new Set(
      asinInput.value
        .split(/[\s,;，；]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function columnWidth(column: KeywordReverseColumn) {
  if (isProductColumn(column.key)) return 260;
  if (column.fixed === 'left') return 220;
  if (column.kind === 'percent') return 118;
  if (column.kind === 'rank') return 104;
  if (column.kind === 'number') return 120;
  return 150;
}

function isKeywordColumn(key: unknown) {
  return ['keyword', 'keywordText', 'searchKeyword', 'word'].includes(
    String(key || ''),
  );
}

function isProductColumn(key: unknown) {
  return [
    'first10Product',
    'first10Products',
    'imageList',
    'productList',
    'products',
    'top10Product',
    'top10Products',
    'topProducts',
  ].includes(String(key || ''));
}

function keywordText(row: Record<string, any>) {
  return (
    row.keyword ??
    row.keywordText ??
    row.searchKeyword ??
    row.word ??
    row.keywords ??
    ''
  );
}

function cnKeywordText(row: Record<string, any>) {
  return row.cnKeyword ?? row.keywordCn ?? row.chinese ?? row.translation ?? '';
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  return Number(value.replaceAll(',', '').replace('%', '').trim());
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatCell(value: unknown, column?: KeywordReverseColumn) {
  if (value === null || value === undefined || value === '') return '-';
  if (!column) return String(value);
  if (column.kind === 'percent') {
    if (typeof value === 'string' && value.includes('%')) return value;
    const numeric = numberValue(value);
    if (!Number.isFinite(numeric)) return String(value);
    const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
    return `${formatNumber(percent, 2)}%`;
  }
  if (column.kind === 'rank') {
    const numeric = numberValue(value);
    return Number.isFinite(numeric) ? formatNumber(numeric, 0) : String(value);
  }
  if (column.kind === 'number') {
    const numeric = numberValue(value);
    return Number.isFinite(numeric) ? formatNumber(numeric, 2) : String(value);
  }
  return String(value);
}

function cellClass(column?: KeywordReverseColumn) {
  if (!column) return '';
  if (
    column.kind === 'number' ||
    column.kind === 'percent' ||
    column.kind === 'rank'
  ) {
    return 'numeric-cell';
  }
  return '';
}

function rowKey(record: Record<string, any>, index?: number) {
  const keyword = keywordText(record);
  return `${keyword || 'row'}-${index ?? 0}`;
}

function parseJsonMaybe(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeProductItems(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseJsonMaybe(value);
    if (Array.isArray(parsed)) return parsed;
    return value
      .split(/[\s,;，；]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>);
  }
  return [];
}

function imageFromProduct(item: unknown) {
  if (typeof item === 'string') {
    return /^https?:\/\//.test(item) || item.startsWith('//') ? item : '';
  }
  if (!item || typeof item !== 'object') return '';
  const product = item as Record<string, any>;
  return (
    product.image ??
    product.img ??
    product.imageUrl ??
    product.image_url ??
    product.small_image_url ??
    product.mainImage ??
    product.main_image ??
    ''
  );
}

function productImages(value: unknown) {
  return normalizeProductItems(value)
    .map((item) => imageFromProduct(item))
    .filter(Boolean)
    .slice(0, 10);
}

async function runQuery(resetPage = true) {
  const asins = parseAsins();
  if (asins.length === 0) {
    message.warning('请输入至少一个 ASIN');
    return;
  }
  if (asins.length > 10) {
    message.warning('单次最多查询 10 个 ASIN');
    return;
  }
  if (resetPage) {
    query.pageNo = 1;
  }

  loading.value = true;
  try {
    result.value = await fetchKeywordReverse({
      asins,
      expendMethod: 'current',
      marketPlaceId: query.marketPlaceId,
      monthStr: query.monthStr,
      pageNo: query.pageNo,
      pageSize: query.pageSize,
      searchType: 'keywordReverse',
      sortDirection: query.sortDirection,
      sortField: query.sortField,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    message.error(`关键词反查失败：${detail}`);
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  asinInput.value = '';
  query.marketPlaceId = 1;
  query.monthStr = 'Last 30 Days';
  query.pageNo = 1;
  query.pageSize = 20;
  query.sortDirection = 'DESC';
  query.sortField = 'trafficRatio';
  result.value = null;
}

function handleTableChange(pagination: TablePaginationConfig) {
  query.pageNo = Number(pagination.current || 1);
  query.pageSize = Number(pagination.pageSize || 20);
  runQuery(false);
}

function openRaw(record: Record<string, any>) {
  selectedRow.value = record;
  drawerOpen.value = true;
}

async function copyText(text: string, successText: string) {
  if (!text) {
    message.warning('当前没有可复制内容');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  message.success(successText);
}

function copyHighFrequencyWords() {
  copyText(
    highFrequencyWords.value.map((word) => word.text).join('\n'),
    '高频词已复制',
  );
}

function copyCurrentKeywords() {
  copyText(
    filteredRows.value
      .map((row) => String(keywordText(row) || ''))
      .filter(Boolean)
      .join('\n'),
    '当前页关键词已复制',
  );
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const columns = result.value?.columns ?? [];
  if (columns.length === 0 || filteredRows.value.length === 0) {
    message.warning('当前没有可导出的结果');
    return;
  }
  const lines = [
    columns.map((column) => escapeCsv(column.label)).join(','),
    ...filteredRows.value.map((row) =>
      columns.map((column) => escapeCsv(row[column.key])).join(','),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `keyword-reverse-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="keyword-reverse-page">
    <section class="page-head">
      <div>
        <h1>亚马逊关键词反查</h1>
        <p>输入竞品 ASIN，按流量占比、搜索量和排名维度反查关键词。</p>
      </div>
      <Space>
        <Button @click="resetQuery">重置</Button>
        <Button :disabled="rows.length === 0" @click="exportCsv">
          导出当前页
        </Button>
        <Button :loading="loading" type="primary" @click="runQuery(true)">
          查询
        </Button>
      </Space>
    </section>

    <Card class="query-card" :body-style="{ padding: '16px' }">
      <Form layout="vertical">
        <div class="query-grid">
          <Form.Item class="asin-field" label="ASIN">
            <Input.TextArea
              v-model:value="asinInput"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              placeholder="支持输入多个 ASIN，用换行、空格或逗号分隔"
            />
          </Form.Item>
          <Form.Item label="市场 ID">
            <InputNumber
              v-model:value="query.marketPlaceId"
              :min="1"
              :precision="0"
              class="full-control"
            />
          </Form.Item>
          <Form.Item label="时间范围">
            <Select v-model:value="query.monthStr" :options="monthOptions" />
          </Form.Item>
          <Form.Item label="排序字段">
            <Select
              v-model:value="query.sortField"
              :options="sortFieldOptions"
            />
          </Form.Item>
          <Form.Item label="排序方向">
            <Radio.Group
              v-model:value="query.sortDirection"
              button-style="solid"
              class="direction-group"
            >
              <Radio.Button value="DESC">降序</Radio.Button>
              <Radio.Button value="ASC">升序</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="每页条数">
            <InputNumber
              v-model:value="query.pageSize"
              :max="100"
              :min="1"
              :precision="0"
              class="full-control"
            />
          </Form.Item>
        </div>
      </Form>
    </Card>

    <div class="metric-grid">
      <div class="metric-item">
        <span class="metric-label">查询 ASIN</span>
        <strong>{{ parseAsins().length }}</strong>
      </div>
      <div class="metric-item">
        <span class="metric-label">命中关键词</span>
        <strong>{{ totalText }}</strong>
      </div>
      <div class="metric-item">
        <span class="metric-label">高频词</span>
        <strong>{{ highFrequencyWords.length }}</strong>
      </div>
      <div class="metric-item">
        <span class="metric-label">当前页</span>
        <strong>
          {{ result?.page.pageNo ?? query.pageNo }}/{{
            result?.page.pages ?? 0
          }}
        </strong>
      </div>
    </div>

    <Spin :spinning="loading">
      <section class="result-section frequency-section">
        <div class="panel-title compact-title">
          <div>
            <h2>高频词</h2>
          </div>
          <Space>
            <Button size="small" @click="copyHighFrequencyWords">
              复制到剪切板
            </Button>
            <Button
              size="small"
              type="link"
              @click="highFrequencyCollapsed = !highFrequencyCollapsed"
            >
              {{ highFrequencyCollapsed ? '展开高频词' : '收起高频词' }}
            </Button>
          </Space>
        </div>
        <div
          v-if="highFrequencyWords.length > 0 && !highFrequencyCollapsed"
          class="word-grid"
        >
          <button
            v-for="word in highFrequencyWords"
            :key="word.text"
            class="word-item"
            type="button"
            @click="keywordFilter = word.text"
          >
            {{ word.text }}
            <span v-if="word.count !== null && word.count !== undefined">({{ word.count }})</span>
          </button>
        </div>
        <Empty
          v-else-if="!highFrequencyCollapsed"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
          description="暂无高频词"
        />
      </section>

      <section class="result-section table-section">
        <div class="result-toolbar">
          <Space wrap>
            <Button @click="copyCurrentKeywords">复制</Button>
            <Button @click="exportCsv">导出</Button>
            <span class="result-count">
              关键词反查结果数: {{ result?.page.total ?? 0 }}
            </span>
          </Space>
          <Space wrap>
            <Checkbox v-model:checked="showTopProducts">展示前10产品</Checkbox>
            <Select
              v-model:value="query.sortField"
              :options="sortFieldOptions"
              class="sort-select"
              size="small"
            />
            <Select
              v-model:value="query.sortDirection"
              class="direction-select"
              size="small"
            >
              <Select.Option value="DESC">降序</Select.Option>
              <Select.Option value="ASC">升序</Select.Option>
            </Select>
            <Button :loading="loading" size="small" @click="runQuery(true)">
              查询
            </Button>
          </Space>
        </div>

        <div class="keyword-filter-bar">
          <Select class="match-select" size="small" value="contains">
            <Select.Option value="contains">包含</Select.Option>
          </Select>
          <Input
            v-model:value="keywordFilter"
            allow-clear
            class="keyword-filter-input"
            placeholder="关键词，多个以英文逗号区分"
            size="small"
          />
          <Button size="small" type="primary">搜索</Button>
        </div>

        <Table
          :columns="[
            ...tableColumns,
            {
              dataIndex: 'action',
              fixed: 'right',
              key: 'action',
              title: '操作',
              width: 96,
            },
          ]"
          :data-source="filteredRows"
          :pagination="tablePagination"
          :row-key="rowKey"
          :scroll="{ x: Math.max(tableColumns.length * 130 + 120, 980) }"
          size="small"
          sticky
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, index, record, text }">
            <template v-if="column.dataIndex === '__index'">
              {{ (query.pageNo - 1) * query.pageSize + index + 1 }}
            </template>
            <template v-else-if="column.dataIndex === 'action'">
              <Button size="small" type="link" @click="openRaw(record)">
                原始字段
              </Button>
            </template>
            <template v-else-if="isKeywordColumn(column.dataIndex)">
              <div class="keyword-cell">
                <div class="keyword-main">{{ keywordText(record) || '-' }}</div>
                <div v-if="cnKeywordText(record)" class="keyword-cn">
                  {{ cnKeywordText(record) }}
                </div>
                <div class="row-actions">
                  <Button
                    size="small"
                    @click="
                      copyText(String(keywordText(record)), '关键词已复制')
                    "
                  >
                    复制
                  </Button>
                  <Button
                    size="small"
                    @click="keywordFilter = String(keywordText(record) || '')"
                  >
                    筛选
                  </Button>
                </div>
              </div>
            </template>
            <template v-else-if="isProductColumn(column.dataIndex)">
              <div class="product-strip">
                <img
                  v-for="src in productImages(text)"
                  :key="src"
                  :src="src"
                  alt=""
                />
                <span v-if="productImages(text).length === 0">-</span>
              </div>
            </template>
            <template v-else>
              <span
                :class="
                  cellClass(
                    result?.columns.find(
                      (item) => item.key === column.dataIndex,
                    ),
                  )
                "
              >
                {{
                  formatCell(
                    text,
                    result?.columns.find(
                      (item) => item.key === column.dataIndex,
                    ),
                  )
                }}
              </span>
            </template>
          </template>
        </Table>

        <div v-if="!result && !loading" class="empty-start">
          <Empty
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            description="输入 ASIN 后点击查询"
          />
        </div>
      </section>
    </Spin>

    <Drawer v-model:open="drawerOpen" title="原始字段" width="720">
      <pre class="raw-json">{{ JSON.stringify(selectedRow, null, 2) }}</pre>
    </Drawer>
  </div>
</template>

<style scoped>
.keyword-reverse-page {
  min-height: calc(100vh - 112px);
  padding: 18px;
  background: #eef3f8;
}

.page-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.page-head h1,
.panel-title h2 {
  margin: 0;
  font-weight: 700;
  color: #12233f;
  letter-spacing: 0;
}

.page-head h1 {
  font-size: 24px;
  line-height: 32px;
}

.page-head p,
.panel-title p {
  margin: 4px 0 0;
  color: #64748b;
}

.query-card {
  margin-bottom: 14px;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.query-grid {
  display: grid;
  grid-template-columns: minmax(300px, 2fr) repeat(5, minmax(120px, 1fr));
  gap: 12px;
  align-items: end;
}

.asin-field {
  min-width: 0;
}

.full-control,
.direction-group {
  width: 100%;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.metric-item {
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.metric-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #64748b;
}

.metric-item strong {
  display: block;
  font-size: 24px;
  line-height: 30px;
  color: #0f766e;
}

.result-section {
  padding: 14px 16px;
  margin-bottom: 14px;
  background: #fff;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.frequency-section {
  padding-bottom: 18px;
}

.table-section {
  padding-bottom: 0;
}

.panel-title {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title h2 {
  font-size: 18px;
  line-height: 26px;
}

.compact-title {
  align-items: center;
  padding-bottom: 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid #edf2f7;
}

.word-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
  gap: 14px 18px;
  max-height: 260px;
  padding: 8px 2px 2px;
  overflow: auto;
}

.word-item {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #1f2937;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.word-item:hover {
  color: #2563eb;
}

.word-item span {
  margin-left: 2px;
  color: #64748b;
}

.result-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid #edf2f7;
}

.result-count {
  font-weight: 600;
  color: #334155;
}

.sort-select {
  width: 140px;
}

.direction-select {
  width: 86px;
}

.keyword-filter-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 0;
}

.match-select {
  width: 86px;
}

.keyword-filter-input {
  max-width: 360px;
}

.keyword-cell {
  min-width: 200px;
}

.keyword-main {
  font-weight: 600;
  color: #111827;
}

.keyword-cn {
  margin-top: 4px;
  color: #64748b;
}

.row-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.product-strip {
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 48px;
  overflow: hidden;
}

.product-strip img {
  width: 38px;
  height: 38px;
  object-fit: contain;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.numeric-cell {
  display: block;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.raw-json {
  padding: 12px;
  overflow: auto;
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.empty-start {
  padding: 28px 0 36px;
}

@media (max-width: 1200px) {
  .query-grid,
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .asin-field {
    grid-column: span 2;
  }
}

@media (max-width: 720px) {
  .keyword-reverse-page {
    padding: 12px;
  }

  .page-head {
    flex-direction: column;
  }

  .result-toolbar,
  .keyword-filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .keyword-filter-input,
  .match-select,
  .sort-select,
  .direction-select {
    width: 100%;
    max-width: none;
  }

  .query-grid,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .asin-field {
    grid-column: span 1;
  }
}
</style>
