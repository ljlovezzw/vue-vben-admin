<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type {
  CategoryConfigRow,
  ConfigOverview,
  ConfigUserRow,
  LoginLogRow,
  OperationGroupRow,
} from '#/api/kanban/types';

import { computed, onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Input,
  InputNumber,
  message,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  createConfigUser,
  deleteOperationGroup,
  fetchConfigLoginLogs,
  fetchConfigOverview,
  saveCategoryConfig,
  saveOperationGroup,
  updateConfigUserAuth,
} from '#/api/kanban';

import { useTablePagination } from '../shared/pagination';

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

interface NewConfigUser {
  avatarColor: string;
  email: string;
  role: string;
  username: string;
}

const loading = ref(false);
const savingKey = ref('');
const savingUserId = ref<null | number>(null);
const savingGroupId = ref<null | number>(null);
const overview = ref<ConfigOverview | null>(null);
const categoryRows = ref<EditableCategoryConfig[]>([]);
const loginLogs = ref<LoginLogRow[]>([]);
const userStore = useUserStore();
const userFilters = reactive({
  authProvider: 'all',
  keyword: '',
  role: 'all',
  status: 'all',
});
const categoryPagination = useTablePagination(12, ['12', '20', '50', '100']);
const userPagination = useTablePagination(8, ['8', '20', '50', '100']);
const memberPagination = useTablePagination(8, ['8', '20', '50', '100']);
const loginLogPagination = useTablePagination(10, ['10', '20', '50', '100']);

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

const newUser = reactive<NewConfigUser>({
  avatarColor: '#4F8EF7',
  email: '',
  role: 'operator',
  username: '',
});
const newGroup = reactive({
  memberUserIds: [] as number[],
  name: '',
});

const roleOptions = [
  { label: 'super', value: 'super' },
  { label: 'admin', value: 'admin' },
  { label: 'manager', value: 'manager' },
  { label: 'leader', value: 'leader' },
  { label: 'operator', value: 'operator' },
];

const roleDescriptions: Record<string, string> = {
  admin: '后台管理员：可查看全部数据',
  leader: '组长：可查看本人和组员数据',
  manager: '经理：可查看全部数据',
  operator: '普通运营：仅可查看本人数据',
  super: '超级管理员：可查看全部数据并维护配置',
};

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
];

const authProviderOptions = [
  { label: '飞书', value: 'feishu' },
  { label: '本地', value: 'local' },
];

const permissionOptions = [
  { label: '经营分析', value: 'kanban:analytics' },
  { label: '新品监控', value: 'kanban:monitor' },
  { label: 'SPU管理', value: 'kanban:spus' },
  { label: '广告监控', value: 'kanban:ads' },
  { label: '目标跟踪', value: 'kanban:targets' },
  { label: 'ASIN360', value: 'kanban:asin360' },
  { label: '配置中心', value: 'kanban:config' },
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
  { dataIndex: 'authProvider', title: '登录方式', width: 100 },
  { dataIndex: 'department', title: '部门', width: 150 },
  { dataIndex: 'role', title: '角色', width: 130 },
  { dataIndex: 'managedUserIds', title: '组员范围', width: 300 },
  { dataIndex: 'status', title: '状态', width: 100 },
  { dataIndex: 'permissions', title: '权限', width: 320 },
  { dataIndex: 'loginCount', title: '登录次数', width: 90 },
  { dataIndex: 'lastLoginAt', title: '最近登录', width: 170 },
  { dataIndex: 'action', fixed: 'right', title: '操作', width: 90 },
];

const memberColumns: TableColumnsType<ConfigUserRow> = [
  { dataIndex: 'username', fixed: 'left', title: '用户名', width: 140 },
  { dataIndex: 'email', title: '邮箱', width: 220 },
  { dataIndex: 'role', title: '角色', width: 120 },
  { dataIndex: 'managedUserIds', title: '组员范围', width: 520 },
  { dataIndex: 'lastLoginAt', title: '最近登录', width: 170 },
  { dataIndex: 'action', fixed: 'right', title: '操作', width: 90 },
];

const logColumns: TableColumnsType<LoginLogRow> = [
  { dataIndex: 'createdAt', title: '登录时间', width: 170 },
  { dataIndex: 'username', title: '用户', width: 140 },
  { dataIndex: 'email', title: '邮箱', width: 220 },
  { dataIndex: 'provider', title: '方式', width: 90 },
  { dataIndex: 'success', title: '结果', width: 90 },
  { dataIndex: 'ip', title: 'IP', width: 130 },
  { dataIndex: 'message', title: '说明', width: 140 },
  { dataIndex: 'userAgent', title: 'User Agent', width: 360 },
];
const groupColumns: TableColumnsType<OperationGroupRow> = [
  { dataIndex: 'name', title: '运营组', width: 180 },
  { dataIndex: 'memberUserIds', title: '成员', width: 520 },
  { dataIndex: 'action', fixed: 'right', title: '操作', width: 140 },
];

const totalPlan = computed(() => {
  let total = 0;
  for (const row of categoryRows.value) {
    total += Number(row.planNewItems2026 || 0);
  }
  return total;
});

const avgQualifyRate = computed(() => {
  const rows = categoryRows.value;
  if (rows.length === 0) {
    return 0;
  }
  let total = 0;
  for (const row of rows) {
    total += Number(row.qualifyRateTarget || 0);
  }
  return total / rows.length;
});

const userOptions = computed(() => {
  return (overview.value?.users || []).map((user) => ({
    label: `${user.username}${user.email ? ` (${user.email})` : ''}`,
    value: user.id,
  }));
});

const currentRole = computed(() =>
  String(userStore.userInfo?.roles?.[0] || 'operator').toLowerCase(),
);
const canManageModules = computed(() =>
  ['admin', 'super'].includes(currentRole.value),
);
const canManageMembers = computed(() =>
  ['admin', 'leader', 'manager', 'super'].includes(currentRole.value),
);
const canEditAdminFields = computed(() => canManageModules.value);

const filteredUsers = computed(() => {
  const keyword = userFilters.keyword.trim().toLowerCase();
  return (overview.value?.users || []).filter((user) => {
    const role = String(user.role || '').toLowerCase();
    const status = String(user.status || '').toLowerCase();
    const provider = String(user.authProvider || '').toLowerCase();
    if (userFilters.role !== 'all' && role !== userFilters.role) {
      return false;
    }
    if (userFilters.status !== 'all' && status !== userFilters.status) {
      return false;
    }
    if (
      userFilters.authProvider !== 'all' &&
      provider !== userFilters.authProvider
    ) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const searchable = [
      user.username,
      user.email,
      user.department,
      user.feishuOpenId,
      user.feishuUserId,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(keyword);
  });
});

const memberScopeUsers = computed(() =>
  filteredUsers.value.filter((user) => canEditMembers(user)),
);

function isCurrentUser(row: ConfigUserRow) {
  const info = userStore.userInfo;
  const currentUserId = (info as null | { id?: number })?.id;
  if (currentUserId && row.id === currentUserId) {
    return true;
  }
  return row.email === info?.username || row.username === info?.realName;
}

function canEditMembers(row: ConfigUserRow) {
  if (!canManageMembers.value) {
    return false;
  }
  if (currentRole.value === 'leader') {
    return isCurrentUser(row);
  }
  return true;
}

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
    const [config, logs] = await Promise.all([
      fetchConfigOverview(),
      canManageModules.value ? fetchConfigLoginLogs(100) : Promise.resolve([]),
    ]);
    overview.value = config;
    loginLogs.value = logs;
    categoryRows.value = overview.value.categoryConfigs.map((row) =>
      cloneCategory(row),
    );
  } finally {
    loading.value = false;
  }
}

async function saveRow(row: EditableCategoryConfig) {
  if (!canManageModules.value) {
    message.warning('只有 admin 及以上角色可以修改类目配置');
    return;
  }
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
  if (!canManageModules.value) {
    message.warning('只有 admin 及以上角色可以新增类目');
    return;
  }
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
  if (!canManageModules.value) {
    message.warning('只有 admin 及以上角色可以新增用户');
    return;
  }
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

async function addOperationGroup() {
  const name = newGroup.name.trim();
  if (!name) {
    message.warning('请输入运营组名称');
    return;
  }
  const saved = await saveOperationGroup({
    memberUserIds: newGroup.memberUserIds,
    name,
  });
  overview.value?.operationGroups.push(saved);
  newGroup.name = '';
  newGroup.memberUserIds = [];
  message.success(`${saved.name} 已创建`);
}

async function saveGroup(row: OperationGroupRow) {
  savingGroupId.value = row.id;
  try {
    const saved = await saveOperationGroup({
      id: row.id,
      memberUserIds: row.memberUserIds,
      name: row.name.trim(),
    });
    if (overview.value) {
      const index = overview.value.operationGroups.findIndex(
        (item) => item.id === row.id,
      );
      if (index !== -1) overview.value.operationGroups[index] = saved;
    }
    message.success(`${saved.name} 已保存`);
  } finally {
    savingGroupId.value = null;
  }
}

async function removeGroup(row: OperationGroupRow) {
  await deleteOperationGroup(row.id);
  if (overview.value) {
    overview.value.operationGroups = overview.value.operationGroups.filter(
      (item) => item.id !== row.id,
    );
  }
  message.success(`${row.name} 已删除`);
}

async function saveUserAuth(row: ConfigUserRow) {
  if (!canManageModules.value && !canEditMembers(row)) {
    message.warning('当前角色只能修改自己的组员范围');
    return;
  }
  savingUserId.value = row.id;
  try {
    const saved = await updateConfigUserAuth(row.id, {
      department: canEditAdminFields.value ? row.department.trim() : undefined,
      managedUserIds: canEditMembers(row) ? row.managedUserIds : [],
      permissions: row.permissions,
      role: row.role,
      status: row.status,
    });
    if (overview.value) {
      const index = overview.value.users.findIndex(
        (item) => item.id === row.id,
      );
      if (index !== -1) {
        overview.value.users[index] = saved;
      }
    }
    message.success(`${saved.username} 权限已保存`);
  } finally {
    savingUserId.value = null;
  }
}

function resetUserFilters() {
  userFilters.authProvider = 'all';
  userFilters.keyword = '';
  userFilters.role = 'all';
  userFilters.status = 'all';
}

function formatRate(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatUserAgent(value: string) {
  return value.length > 90 ? `${value.slice(0, 90)}...` : value;
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

        <div v-if="canManageModules" class="form-grid">
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
          v-if="canManageModules"
          class="config-card"
          title="类目阈值配置"
          :body-style="{ padding: 0 }"
        >
          <Table
            :columns="categoryColumns"
            :data-source="categoryRows"
            :pagination="categoryPagination"
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

        <Card
          v-if="canManageModules"
          class="config-card"
          title="运营组组织架构"
          :body-style="{ padding: 0 }"
        >
          <div class="group-form">
            <Input v-model:value="newGroup.name" placeholder="运营组名称" />
            <Select
              v-model:value="newGroup.memberUserIds"
              :options="userOptions"
              mode="multiple"
              placeholder="选择运营组成员"
            />
            <Button type="primary" @click="addOperationGroup">
              新增运营组
            </Button>
          </div>
          <Table
            :columns="groupColumns"
            :data-source="overview.operationGroups"
            :pagination="false"
            row-key="id"
            :scroll="{ x: 820 }"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'name'">
                <Input v-model:value="(record as OperationGroupRow).name" />
              </template>
              <template v-else-if="column.dataIndex === 'memberUserIds'">
                <Select
                  v-model:value="(record as OperationGroupRow).memberUserIds"
                  :options="userOptions"
                  mode="multiple"
                  placeholder="选择成员"
                  style="width: 100%"
                />
              </template>
              <template v-else-if="column.dataIndex === 'action'">
                <Button
                  :loading="savingGroupId === (record as OperationGroupRow).id"
                  size="small"
                  type="link"
                  @click="saveGroup(record as OperationGroupRow)"
                >
                  保存
                </Button>
                <Button
                  danger
                  size="small"
                  type="link"
                  @click="removeGroup(record as OperationGroupRow)"
                >
                  删除
                </Button>
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

          <Card
            v-if="canManageMembers"
            class="config-card user-permission-card"
            title="飞书用户权限"
            :body-style="{ padding: 0 }"
          >
            <div class="permission-note">
              <Tag color="green">operator</Tag>仅本人数据
              <Tag color="blue">leader</Tag>本人和组员数据
              <Tag color="purple">manager</Tag>全部数据
              <Tag color="red">super</Tag>全部数据和配置权限
            </div>
            <div class="user-filter-bar">
              <Input
                v-model:value="userFilters.keyword"
                allow-clear
                placeholder="搜索姓名 / 邮箱 / 部门 / 飞书ID"
              />
              <Select
                v-model:value="userFilters.role"
                :options="[{ label: '全部角色', value: 'all' }, ...roleOptions]"
              />
              <Select
                v-model:value="userFilters.status"
                :options="[
                  { label: '全部状态', value: 'all' },
                  ...statusOptions,
                ]"
              />
              <Select
                v-model:value="userFilters.authProvider"
                :options="[
                  { label: '全部登录方式', value: 'all' },
                  ...authProviderOptions,
                ]"
              />
              <Button @click="resetUserFilters">重置</Button>
            </div>

            <Tabs class="permission-tabs">
              <Tabs.TabPane key="members" tab="成员范围维护">
                <Table
                  :columns="memberColumns"
                  :data-source="memberScopeUsers"
                  :pagination="memberPagination"
                  row-key="id"
                  :scroll="{ x: 1180 }"
                  size="small"
                >
                  <template #bodyCell="{ column, record, text }">
                    <template v-if="column.dataIndex === 'role'">
                      <Tag>
                        {{ text }}
                      </Tag>
                    </template>
                    <template v-else-if="column.dataIndex === 'managedUserIds'">
                      <Select
                        v-model:value="(record as ConfigUserRow).managedUserIds"
                        :disabled="!canEditMembers(record as ConfigUserRow)"
                        :max-tag-count="4"
                        :options="
                          userOptions.filter(
                            (item) =>
                              item.value !== (record as ConfigUserRow).id,
                          )
                        "
                        mode="multiple"
                        placeholder="选择组员"
                        size="small"
                      />
                    </template>
                    <template v-else-if="column.dataIndex === 'action'">
                      <Button
                        :disabled="!canEditMembers(record as ConfigUserRow)"
                        :loading="savingUserId === (record as ConfigUserRow).id"
                        size="small"
                        type="link"
                        @click="saveUserAuth(record as ConfigUserRow)"
                      >
                        保存
                      </Button>
                    </template>
                  </template>
                </Table>
              </Tabs.TabPane>

              <Tabs.TabPane
                v-if="canManageModules"
                key="modules"
                tab="管理员权限维护"
              >
                <Table
                  :columns="userColumns"
                  :data-source="filteredUsers"
                  :pagination="userPagination"
                  row-key="id"
                  :scroll="{ x: 1720 }"
                  size="small"
                >
                  <template #bodyCell="{ column, record, text }">
                    <template v-if="column.dataIndex === 'authProvider'">
                      <Tag :color="text === 'feishu' ? 'blue' : 'purple'">
                        {{ text === 'feishu' ? '飞书' : '本地' }}
                      </Tag>
                    </template>
                    <template v-else-if="column.dataIndex === 'department'">
                      <Input
                        v-model:value="(record as ConfigUserRow).department"
                        :disabled="!canEditAdminFields"
                        placeholder="部门"
                        size="small"
                      />
                    </template>
                    <template v-else-if="column.dataIndex === 'role'">
                      <Select
                        v-model:value="(record as ConfigUserRow).role"
                        :disabled="!canEditAdminFields"
                        :options="roleOptions"
                        size="small"
                      />
                      <div class="role-help">
                        {{ roleDescriptions[(record as ConfigUserRow).role] }}
                      </div>
                    </template>
                    <template v-else-if="column.dataIndex === 'managedUserIds'">
                      <Select
                        v-model:value="(record as ConfigUserRow).managedUserIds"
                        :disabled="!canEditMembers(record as ConfigUserRow)"
                        :max-tag-count="2"
                        :options="
                          userOptions.filter(
                            (item) =>
                              item.value !== (record as ConfigUserRow).id,
                          )
                        "
                        mode="multiple"
                        placeholder="选择组员"
                        size="small"
                      />
                    </template>
                    <template v-else-if="column.dataIndex === 'status'">
                      <Select
                        v-model:value="(record as ConfigUserRow).status"
                        :disabled="!canEditAdminFields"
                        :options="statusOptions"
                        size="small"
                      />
                    </template>
                    <template v-else-if="column.dataIndex === 'permissions'">
                      <Select
                        v-model:value="(record as ConfigUserRow).permissions"
                        :disabled="!canEditAdminFields"
                        :max-tag-count="2"
                        :options="permissionOptions"
                        mode="multiple"
                        placeholder="选择可访问模块"
                        size="small"
                      />
                    </template>
                    <template v-else-if="column.dataIndex === 'action'">
                      <Button
                        :disabled="
                          !canEditAdminFields &&
                          !canEditMembers(record as ConfigUserRow)
                        "
                        :loading="savingUserId === (record as ConfigUserRow).id"
                        size="small"
                        type="link"
                        @click="saveUserAuth(record as ConfigUserRow)"
                      >
                        保存
                      </Button>
                    </template>
                  </template>
                </Table>
              </Tabs.TabPane>
            </Tabs>
          </Card>
        </div>

        <Card
          v-if="canManageModules"
          class="config-card login-log-card"
          title="飞书 / 管理员登录记录"
          :body-style="{ padding: 0 }"
        >
          <Table
            :columns="logColumns"
            :data-source="loginLogs"
            :pagination="loginLogPagination"
            :scroll="{ x: 1200 }"
            row-key="id"
            size="small"
          >
            <template #bodyCell="{ column, text }">
              <template v-if="column.dataIndex === 'success'">
                <Tag :color="text ? 'green' : 'red'">
                  {{ text ? '成功' : '失败' }}
                </Tag>
              </template>
              <template v-else-if="column.dataIndex === 'provider'">
                <Tag :color="text === 'feishu' ? 'blue' : 'purple'">
                  {{ text === 'feishu' ? '飞书' : '本地' }}
                </Tag>
              </template>
              <template v-else-if="column.dataIndex === 'userAgent'">
                {{ formatUserAgent(String(text || '')) }}
              </template>
            </template>
          </Table>
        </Card>
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

.group-form {
  display: grid;
  grid-template-columns: 220px minmax(280px, 1fr) auto;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid #eef2f7;
}

.config-card {
  margin-bottom: 12px;
}

.config-card :deep(.ant-table-thead > tr > th) {
  font-weight: 800;
  color: #1f2937;
  background: #eef2f7;
}

.config-card :deep(.ant-table-cell) {
  border-color: #d6dde8;
}

.permission-note {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  color: #475569;
  background: #f8fafc;
  border-bottom: 1px solid #d6dde8;
}

.user-filter-bar {
  display: grid;
  grid-template-columns:
    minmax(260px, 1.4fr) repeat(3, minmax(140px, 0.7fr))
    auto;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border-bottom: 1px solid #d6dde8;
}

.permission-tabs {
  padding: 0 12px 12px;
  background: #fff;
}

.permission-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 10px;
}

.role-help {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.35;
  color: #64748b;
}

.config-card :deep(.ant-select) {
  width: 100%;
}

.login-log-card {
  margin-top: 12px;
}

.bottom-grid {
  grid-template-columns: 1fr;
}

.user-permission-card {
  min-width: 0;
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
  .group-form,
  .user-filter-bar,
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
  .group-form,
  .user-filter-bar,
  .user-form {
    grid-template-columns: 1fr;
  }
}
</style>
