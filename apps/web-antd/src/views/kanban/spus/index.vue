<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  SpuManagerOptions,
  SpuManagerOverview,
  SpuManagerRow,
  SpuPayload,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Input,
  message,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  createSpu,
  fetchSpuDetail,
  fetchSpuManagerOptions,
  fetchSpuManagerOverview,
  updateSpu,
} from '#/api/kanban';

import { useTablePagination } from '../shared/pagination';

type FormMode = 'create' | 'edit';

interface SpuFormState {
  category?: string;
  devDate?: string;
  fbaShipDate?: string;
  firstArrivalDate?: string;
  firstOrderDate?: string;
  listingCreated?: string;
  notes?: string;
  parentAsin?: string;
  responsibleUid?: number;
  site: string;
  spu: string;
  status: SpuPayload['status'];
}

const loading = ref(false);
const saving = ref(false);
const drawerOpen = ref(false);
const formMode = ref<FormMode>('create');
const overview = ref<null | SpuManagerOverview>(null);
const spuOptions = ref<null | SpuManagerOptions>(null);
const editingKey = ref('');
const tablePagination = useTablePagination(
  15,
  ['15', '30', '50', '100'],
  (total) => `共 ${total} 个 SPU`,
);

const query = reactive({
  categories: [] as string[],
  responsibles: [] as string[],
  sites: [] as string[],
  statuses: [] as string[],
});

const formState = reactive<SpuFormState>({
  category: undefined,
  devDate: undefined,
  fbaShipDate: undefined,
  firstArrivalDate: undefined,
  firstOrderDate: undefined,
  listingCreated: undefined,
  notes: undefined,
  parentAsin: undefined,
  responsibleUid: undefined,
  site: 'US',
  spu: '',
  status: '新品',
});

const statusOptions = ['新品', '成品', '滞销'].map((value) => ({
  label: value,
  value,
}));

const columns: TableColumnsType<SpuManagerRow> = [
  { dataIndex: 'spu', fixed: 'left', title: 'SPU', width: 130 },
  { dataIndex: 'site', fixed: 'left', title: '站点', width: 72 },
  { dataIndex: 'parentAsin', title: '父ASIN', width: 130 },
  { dataIndex: 'category', title: '类目', width: 120 },
  { dataIndex: 'responsibleName', title: '负责人', width: 110 },
  { dataIndex: 'status', title: '状态', width: 86 },
  { dataIndex: 'lifecycleStage', title: '看板阶段', width: 112 },
  {
    dataIndex: 'daysSinceLaunch',
    sorter: (a, b) =>
      Number(a.daysSinceLaunch ?? -1) - Number(b.daysSinceLaunch ?? -1),
    title: '上架天数',
    width: 96,
  },
  { dataIndex: 'listingCreated', title: 'Listing创建', width: 118 },
  { dataIndex: 'fbaShipDate', title: 'FBA发货', width: 112 },
  { dataIndex: 'firstArrivalDate', title: '传图时间', width: 112 },
  { dataIndex: 'firstOrderDate', title: '首单时间', width: 112 },
  { dataIndex: 'lastMetricDate', title: '最新指标日', width: 112 },
  { dataIndex: 'notes', ellipsis: true, title: '备注', width: 220 },
  { dataIndex: 'action', fixed: 'right', title: '操作', width: 92 },
];

const siteOptions = computed(() =>
  (overview.value?.filters.sites ?? []).map((value) => ({
    label: value,
    value,
  })),
);

const categoryOptions = computed(() => {
  const fromConfig = spuOptions.value?.categories ?? [];
  const fromRows = overview.value?.filters.categories ?? [];
  return [...new Set([...fromConfig, ...fromRows])]
    .filter(Boolean)
    .map((value) => ({ label: value, value }));
});

const responsibleFilterOptions = computed(() =>
  (overview.value?.filters.responsibles ?? []).map((value) => ({
    label: value,
    value,
  })),
);

const userOptions = computed(() =>
  (spuOptions.value?.users ?? []).map((user) => ({
    label: user.username,
    value: user.id,
  })),
);

function rowKey(row: SpuManagerRow) {
  return `${row.spu}-${row.site}`;
}

function emptyPayload(): SpuFormState {
  return {
    category: undefined,
    devDate: undefined,
    fbaShipDate: undefined,
    firstArrivalDate: undefined,
    firstOrderDate: undefined,
    listingCreated: undefined,
    notes: undefined,
    parentAsin: undefined,
    responsibleUid:
      spuOptions.value?.users.length === 1
        ? spuOptions.value.users[0]?.id
        : undefined,
    site: overview.value?.filters.sites?.[0] ?? 'US',
    spu: '',
    status: '新品',
  };
}

function assignForm(payload: SpuFormState) {
  Object.assign(formState, payload);
}

function rowToPayload(row: SpuManagerRow): SpuFormState {
  return {
    category: row.category || undefined,
    devDate: row.devDate || undefined,
    fbaShipDate: row.fbaShipDate || undefined,
    firstArrivalDate: row.firstArrivalDate || undefined,
    firstOrderDate: row.firstOrderDate || undefined,
    listingCreated: row.listingCreated || undefined,
    notes: row.notes || undefined,
    parentAsin: row.parentAsin || undefined,
    responsibleUid: row.responsibleUid ?? undefined,
    site: row.site || 'US',
    spu: row.spu,
    status: (row.status as SpuPayload['status']) || '新品',
  };
}

async function loadData() {
  loading.value = true;
  try {
    const [spuOverview, config] = await Promise.all([
      fetchSpuManagerOverview({
        categories: query.categories,
        responsibles: query.responsibles,
        sites: query.sites,
        statuses: query.statuses,
      }),
      spuOptions.value
        ? Promise.resolve(spuOptions.value)
        : fetchSpuManagerOptions(),
    ]);
    overview.value = spuOverview;
    spuOptions.value = config;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  query.categories = [];
  query.responsibles = [];
  query.sites = [];
  query.statuses = [];
  loadData();
}

function openCreate() {
  formMode.value = 'create';
  editingKey.value = '';
  assignForm(emptyPayload());
  drawerOpen.value = true;
}

async function openEdit(row: SpuManagerRow) {
  formMode.value = 'edit';
  editingKey.value = rowKey(row);
  drawerOpen.value = true;
  const detail = await fetchSpuDetail({ site: row.site, spu: row.spu });
  assignForm(rowToPayload(detail.spu ? detail : row));
}

function normalizePayload(): SpuPayload {
  return {
    category: formState.category || null,
    devDate: formState.devDate || null,
    fbaShipDate: formState.fbaShipDate || null,
    firstArrivalDate: formState.firstArrivalDate || null,
    firstOrderDate: formState.firstOrderDate || null,
    listingCreated: formState.listingCreated || null,
    notes: formState.notes || null,
    parentAsin: formState.parentAsin?.trim()?.toUpperCase() || null,
    responsibleUid: formState.responsibleUid ?? null,
    site: formState.site.trim().toUpperCase(),
    spu: formState.spu.trim().toUpperCase(),
    status: formState.status,
  };
}

async function submitForm() {
  const payload = normalizePayload();
  if (!payload.spu || !payload.site) {
    message.warning('SPU 和站点不能为空');
    return;
  }

  saving.value = true;
  try {
    if (formMode.value === 'create') {
      await createSpu(payload);
      message.success(`${payload.spu} 已创建`);
    } else {
      await updateSpu(payload.spu, payload.site, payload);
      message.success(`${payload.spu} 已保存`);
    }
    drawerOpen.value = false;
    await loadData();
  } finally {
    saving.value = false;
  }
}

function stageColor(stage: string) {
  if (stage === '起量期') return 'orange';
  if (stage === '稳定期') return 'green';
  if (stage === '判定期') return 'red';
  if (stage === '冷启动期') return 'blue';
  return 'default';
}

function statusColor(status: string) {
  if (status === '成品') return 'green';
  if (status === '滞销') return 'red';
  return 'blue';
}

onMounted(loadData);
</script>

<template>
  <div class="spu-page">
    <section class="page-head">
      <div>
        <h1>SPU 管理</h1>
        <p>维护新品主数据和人工字段，供新品监控快照与下钻明细使用。</p>
      </div>
      <Space>
        <Button :loading="loading" @click="loadData">刷新</Button>
        <Button type="primary" @click="openCreate">新增 SPU</Button>
      </Space>
    </section>

    <Card class="filter-card" :body-style="{ padding: '14px 16px' }">
      <div class="filters">
        <Select
          v-model:value="query.sites"
          :options="siteOptions"
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="站点"
        />
        <Select
          v-model:value="query.responsibles"
          :options="responsibleFilterOptions"
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="负责人"
        />
        <Select
          v-model:value="query.categories"
          :options="categoryOptions"
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="类目"
        />
        <Select
          v-model:value="query.statuses"
          :options="statusOptions"
          allow-clear
          max-tag-count="responsive"
          mode="multiple"
          placeholder="状态"
        />
        <div class="filter-actions">
          <Button @click="resetFilters">重置</Button>
          <Button :loading="loading" type="primary" @click="loadData">
            应用筛选
          </Button>
        </div>
      </div>
    </Card>

    <Spin :spinning="loading">
      <Card class="table-card" :body-style="{ padding: 0 }">
        <Table
          :columns="columns"
          :data-source="overview?.rows ?? []"
          :pagination="tablePagination"
          :row-key="rowKey"
          :scroll="{ x: 1740 }"
          size="small"
          sticky
        >
          <template #bodyCell="{ column, record, text }">
            <template v-if="column.dataIndex === 'spu'">
              <a class="spu-link" @click="openEdit(record as SpuManagerRow)">
                {{ text }}
              </a>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <Tag :color="statusColor(String(text || ''))">{{ text }}</Tag>
            </template>
            <template v-else-if="column.dataIndex === 'lifecycleStage'">
              <Tag :color="stageColor(String(text || ''))">
                {{ text || '-' }}
              </Tag>
            </template>
            <template v-else-if="column.dataIndex === 'daysSinceLaunch'">
              {{ text === null || text === undefined ? '-' : `${text} 天` }}
            </template>
            <template v-else-if="column.dataIndex === 'notes'">
              {{ text || '-' }}
            </template>
            <template v-else-if="column.dataIndex === 'action'">
              <Button
                size="small"
                type="link"
                @click="openEdit(record as SpuManagerRow)"
              >
                编辑
              </Button>
            </template>
          </template>
        </Table>
      </Card>
    </Spin>

    <Drawer
      v-model:open="drawerOpen"
      :title="formMode === 'create' ? '新增 SPU' : `编辑 ${formState.spu}`"
      width="720"
    >
      <Form layout="vertical">
        <div class="form-grid">
          <Form.Item label="SPU 编码" required>
            <Input
              v-model:value="formState.spu"
              :disabled="formMode === 'edit'"
              placeholder="如 LLW000423"
            />
          </Form.Item>
          <Form.Item label="站点" required>
            <Select
              v-model:value="formState.site"
              :disabled="formMode === 'edit'"
              :options="siteOptions"
              show-search
            />
          </Form.Item>
          <Form.Item label="父 ASIN">
            <Input
              v-model:value="formState.parentAsin"
              placeholder="如 B0GVYHN8FW"
            />
          </Form.Item>
          <Form.Item label="类目">
            <Select
              v-model:value="formState.category"
              :options="categoryOptions"
              allow-clear
              show-search
              placeholder="选择类目"
            />
          </Form.Item>
          <Form.Item label="负责人">
            <Select
              v-model:value="formState.responsibleUid"
              :options="userOptions"
              allow-clear
              show-search
              placeholder="选择负责人"
            />
          </Form.Item>
          <Form.Item label="状态">
            <Select v-model:value="formState.status" :options="statusOptions" />
          </Form.Item>
          <Form.Item label="开发时间">
            <DatePicker
              v-model:value="formState.devDate"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </Form.Item>
          <Form.Item label="Listing 创建时间">
            <DatePicker
              v-model:value="formState.listingCreated"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </Form.Item>
          <Form.Item label="FBA 发货时间">
            <DatePicker
              v-model:value="formState.fbaShipDate"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </Form.Item>
          <Form.Item label="传图时间">
            <DatePicker
              v-model:value="formState.firstArrivalDate"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </Form.Item>
          <Form.Item label="首单时间">
            <DatePicker
              v-model:value="formState.firstOrderDate"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </Form.Item>
        </div>
        <Form.Item label="备注">
          <Input.TextArea v-model:value="formState.notes" :rows="4" />
        </Form.Item>
      </Form>
      <template #footer>
        <Space>
          <Button @click="drawerOpen = false">取消</Button>
          <Button :loading="saving" type="primary" @click="submitForm">
            保存
          </Button>
        </Space>
      </template>
    </Drawer>
  </div>
</template>

<style scoped>
.spu-page {
  min-height: 100%;
  padding: 16px;
  background: #f6f8fb;
}

.page-head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-head h1 {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 850;
  color: #0f172a;
}

.page-head p {
  margin: 0;
  color: #64748b;
}

.filter-card,
.table-card {
  margin-bottom: 12px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr)) auto;
  gap: 10px;
  align-items: center;
}

.filter-actions {
  display: inline-flex;
  gap: 8px;
  justify-content: flex-end;
}

.spu-link {
  font-weight: 800;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.form-grid :deep(.ant-picker),
.form-grid :deep(.ant-select),
.form-grid :deep(.ant-input) {
  width: 100%;
}

@media (max-width: 980px) {
  .filters,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
