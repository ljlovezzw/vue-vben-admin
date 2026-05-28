<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  CategoryConfigRow,
  ConfigOverview,
  ConfigUserRow,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  Button,
  Card,
  Input,
  InputNumber,
  message,
  Select,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  createConfigUser,
  fetchConfigOverview,
  saveCategoryConfig,
} from '#/api/kanban';

interface EditableCategoryConfig {
  acosTarget?: number;
  acosWarn?: number;
  category: string;
  planNewItems2026: number;
  qualifyDailySales: number;
  qualifyRateTarget: number;
  tacosTarget?: number;
  tacosWarn?: number;
}

const loading = ref(false);
const savingKey = ref('');
const overview = ref<ConfigOverview | null>(null);
const categoryRows = ref<EditableCategoryConfig[]>([]);

const newCategory = reactive<EditableCategoryConfig>({
  acosTarget: 20,
  acosWarn: 25,
  category: '',
  planNewItems2026: 0,
  qualifyDailySales: 3,
  qualifyRateTarget: 60,
  tacosTarget: 10,
  tacosWarn: 12,
});

const newUser = reactive<Omit<ConfigUserRow, 'id'>>({
  avatarColor: '#4F8EF7',
  email: '',
  role: 'operator',
  username: '',
});

const roleOptions = [
  { label: 'operator', value: 'operator' },
  { label: 'manager', value: 'manager' },
  { label: 'admin', value: 'admin' },
];

const categoryColumns: TableColumnsType<EditableCategoryConfig> = [
  { dataIndex: 'category', fixed: 'left', title: '类目', width: 160 },
  { dataIndex: 'planNewItems2026', title: '2026上新计划', width: 130 },
  { dataIndex: 'qualifyDailySales', title: '成品日均销量', width: 130 },
  { dataIndex: 'qualifyRateTarget', title: '成品率目标%', width: 130 },
  { dataIndex: 'acosTarget', title: 'ACOS目标%', width: 120 },
  { dataIndex: 'acosWarn', title: 'ACOS警告%', width: 120 },
  { dataIndex: 'tacosTarget', title: 'TACOS目标%', width: 120 },
  { dataIndex: 'tacosWarn', title: 'TACOS警告%', width: 120 },
  { dataIndex: 'action', fixed: 'right', title: '操作', width: 96 },
];

const userColumns: TableColumnsType<ConfigUserRow> = [
  { dataIndex: 'username', title: '用户名', width: 140 },
  { dataIndex: 'email', title: '邮箱', width: 220 },
  { dataIndex: 'role', title: '角色', width: 110 },
  { dataIndex: 'avatarColor', title: '颜色', width: 100 },
];

const totalPlan = computed(() =>
  categoryRows.value.reduce(
    (sum, row) => sum + Number(row.planNewItems2026 || 0),
    0,
  ),
);

const avgQualifyRate = computed(() => {
  const rows = categoryRows.value;
  if (rows.length === 0) {
    return 0;
  }
  return (
    rows.reduce((sum, row) => sum + Number(row.qualifyRateTarget || 0), 0) /
    rows.length
  );
});

function cloneCategory(row: CategoryConfigRow): EditableCategoryConfig {
  return {
    acosTarget: row.acosTarget ?? undefined,
    acosWarn: row.acosWarn ?? undefined,
    category: row.category,
    planNewItems2026: row.planNewItems2026 ?? 0,
    qualifyDailySales: row.qualifyDailySales ?? 3,
    qualifyRateTarget: row.qualifyRateTarget ?? 60,
    tacosTarget: row.tacosTarget ?? undefined,
    tacosWarn: row.tacosWarn ?? undefined,
  };
}

async function loadData() {
  loading.value = true;
  try {
    overview.value = await fetchConfigOverview();
    categoryRows.value = overview.value.categoryConfigs.map((row) =>
      cloneCategory(row),
    );
  } finally {
    loading.value = false;
  }
}

async function saveRow(row: EditableCategoryConfig) {
  const category = row.category.trim();
  if (!category) {
    message.warning('类目名称不能为空');
    return;
  }
  savingKey.value = category;
  try {
    const saved = await saveCategoryConfig({ ...row, category });
    const index = categoryRows.value.findIndex(
      (item) => item.category === category,
    );
    if (index !== -1) {
      categoryRows.value[index] = cloneCategory(saved);
    }
    message.success(`${category} 已保存`);
  } finally {
    savingKey.value = '';
  }
}

async function addCategory() {
  const category = newCategory.category.trim();
  if (!category) {
    message.warning('请输入类目名称');
    return;
  }
  if (categoryRows.value.some((row) => row.category === category)) {
    message.warning('类目已存在，可直接在表格中编辑');
    return;
  }
  const saved = await saveCategoryConfig({ ...newCategory, category });
  categoryRows.value = [cloneCategory(saved), ...categoryRows.value];
  newCategory.category = '';
  message.success(`${category} 已创建`);
}

async function addUser() {
  if (!newUser.username.trim() || !newUser.email.trim()) {
    message.warning('用户名和邮箱不能为空');
    return;
  }
  const saved = await createConfigUser({
    avatarColor: newUser.avatarColor,
    email: newUser.email.trim(),
    role: newUser.role,
    username: newUser.username.trim(),
  });
  overview.value?.users.unshift(saved);
  newUser.username = '';
  newUser.email = '';
  message.success(`${saved.username} 已创建`);
}

function formatRate(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

onMounted(loadData);
</script>

<template>
  <div class="config-page">
    <section class="page-head">
      <div>
        <h1>配置中心</h1>
        <p>维护类目阈值、广告效率目标和运营人员基础信息。</p>
      </div>
      <Button :loading="loading" @click="loadData">刷新</Button>
    </section>

    <Spin :spinning="loading">
      <template v-if="overview">
        <div class="summary-grid">
          <div class="summary-item">
            <span>类目数</span>
            <strong>{{ categoryRows.length }}</strong>
          </div>
          <div class="summary-item">
            <span>2026上新计划</span>
            <strong>{{ totalPlan }}</strong>
          </div>
          <div class="summary-item">
            <span>平均成品率目标</span>
            <strong>{{ formatRate(avgQualifyRate) }}</strong>
          </div>
          <div class="summary-item">
            <span>运营人员</span>
            <strong>{{ overview.users.length }}</strong>
          </div>
        </div>

        <div class="form-grid">
          <Card title="新增类目" :body-style="{ padding: '14px 16px' }">
            <div class="category-form">
              <Input
                v-model:value="newCategory.category"
                placeholder="类目名称"
              />
              <InputNumber
                v-model:value="newCategory.planNewItems2026"
                :min="0"
                placeholder="2026上新计划"
              />
              <InputNumber
                v-model:value="newCategory.qualifyDailySales"
                :min="0"
                placeholder="成品日均销量"
              />
              <InputNumber
                v-model:value="newCategory.qualifyRateTarget"
                :max="100"
                :min="0"
                placeholder="成品率目标%"
              />
              <InputNumber
                v-model:value="newCategory.acosTarget"
                :max="100"
                :min="0"
                placeholder="ACOS目标%"
              />
              <InputNumber
                v-model:value="newCategory.acosWarn"
                :max="100"
                :min="0"
                placeholder="ACOS警告%"
              />
              <InputNumber
                v-model:value="newCategory.tacosTarget"
                :max="100"
                :min="0"
                placeholder="TACOS目标%"
              />
              <InputNumber
                v-model:value="newCategory.tacosWarn"
                :max="100"
                :min="0"
                placeholder="TACOS警告%"
              />
              <Button type="primary" @click="addCategory">创建类目</Button>
            </div>
          </Card>

          <Card title="新增运营人员" :body-style="{ padding: '14px 16px' }">
            <div class="user-form">
              <Input v-model:value="newUser.username" placeholder="用户名" />
              <Input v-model:value="newUser.email" placeholder="邮箱" />
              <Select v-model:value="newUser.role" :options="roleOptions" />
              <Input
                v-model:value="newUser.avatarColor"
                placeholder="#4F8EF7"
              />
              <Button type="primary" @click="addUser">创建人员</Button>
            </div>
          </Card>
        </div>

        <Card
          class="config-card"
          title="类目阈值配置"
          :body-style="{ padding: 0 }"
        >
          <Table
            :columns="categoryColumns"
            :data-source="categoryRows"
            :pagination="{ pageSize: 12, showSizeChanger: true }"
            :scroll="{ x: 1120 }"
            row-key="category"
            size="small"
          >
            <template #bodyCell="{ column, record, text }">
              <template v-if="column.dataIndex === 'category'">
                <strong>{{ text }}</strong>
              </template>
              <template v-else-if="column.dataIndex === 'action'">
                <Button
                  :loading="savingKey === record.category"
                  size="small"
                  type="link"
                  @click="saveRow(record as EditableCategoryConfig)"
                >
                  保存
                </Button>
              </template>
              <template v-else>
                <InputNumber
                  v-model:value="
                    (record as EditableCategoryConfig)[
                      column.dataIndex as keyof EditableCategoryConfig
                    ]
                  "
                  :max="
                    String(column.dataIndex).includes('Rate') ||
                    String(column.dataIndex).includes('acos') ||
                    String(column.dataIndex).includes('tacos')
                      ? 100
                      : undefined
                  "
                  :min="0"
                  size="small"
                />
              </template>
            </template>
          </Table>
        </Card>

        <div class="bottom-grid">
          <Card title="预警规则说明" :body-style="{ padding: '14px 16px' }">
            <div class="rule-grid">
              <div
                v-for="group in overview.alertRules"
                :key="group.level"
                class="rule-panel"
              >
                <Tag :color="group.level === 'red' ? 'red' : 'orange'">
                  {{ group.title }}
                </Tag>
                <ul>
                  <li v-for="rule in group.rules" :key="rule">{{ rule }}</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card title="运营人员" :body-style="{ padding: 0 }">
            <Table
              :columns="userColumns"
              :data-source="overview.users"
              :pagination="{ pageSize: 8, showSizeChanger: false }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record, text }">
                <template v-if="column.dataIndex === 'role'">
                  <Tag>{{ text }}</Tag>
                </template>
                <template v-else-if="column.dataIndex === 'avatarColor'">
                  <span
                    class="color-dot"
                    :style="{ background: record.avatarColor }"
                  ></span>
                  {{ text }}
                </template>
              </template>
            </Table>
          </Card>
        </div>
      </template>
    </Spin>
  </div>
</template>

<style scoped>
.config-page {
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

.summary-grid,
.form-grid,
.bottom-grid {
  display: grid;
  gap: 12px;
}

.summary-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 12px;
}

.summary-item {
  padding: 13px 14px;
  background: #fff;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 8px;
}

.summary-item span {
  display: block;
  font-size: 12px;
  font-weight: 750;
  color: #64748b;
}

.summary-item strong {
  display: block;
  margin-top: 8px;
  font-size: 24px;
  line-height: 1;
  color: #0f172a;
}

.form-grid {
  grid-template-columns: 1.45fr 0.9fr;
  margin-bottom: 12px;
}

.category-form {
  display: grid;
  grid-template-columns: 1.2fr repeat(4, minmax(110px, 1fr));
  gap: 10px;
}

.category-form :deep(.ant-input-number),
.user-form :deep(.ant-input-number) {
  width: 100%;
}

.user-form {
  display: grid;
  grid-template-columns: 1fr 1.3fr 0.9fr 0.9fr auto;
  gap: 10px;
}

.config-card {
  margin-bottom: 12px;
}

.config-card :deep(.ant-table-thead > tr > th) {
  font-weight: 800;
  color: #1f2937;
  background: #eef2f7;
}

.bottom-grid {
  grid-template-columns: 1fr 1fr;
}

.rule-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.rule-panel ul {
  padding-left: 18px;
  margin: 12px 0 0;
  line-height: 1.9;
  color: #334155;
}

.color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  vertical-align: middle;
  border-radius: 50%;
}

@media (max-width: 1320px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-grid,
  .bottom-grid,
  .rule-grid {
    grid-template-columns: 1fr;
  }

  .category-form,
  .user-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-grid,
  .category-form,
  .user-form {
    grid-template-columns: 1fr;
  }
}
</style>
