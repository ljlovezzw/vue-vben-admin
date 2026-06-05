<script setup lang="ts">
import type { UserInfo } from '@vben/types';

import { computed, onMounted, ref } from 'vue';

import { getUserInfoApi } from '#/api';

const loading = ref(false);
const userInfo = ref<Partial<UserInfo>>({});

const roleLabelMap: Record<string, string> = {
  admin: '管理员',
  leader: '组长',
  manager: '经理',
  operator: '运营',
  super: '超级管理员',
};

const authProviderLabel = computed(() =>
  userInfo.value.authProvider === 'feishu' ? '飞书登录' : '本地账号',
);

const roleLabel = computed(() => {
  const role = userInfo.value.roles?.[0] || '';
  return roleLabelMap[role] || role || '-';
});

const profileRows = computed(() => [
  { label: '姓名', value: userInfo.value.realName || '-' },
  { label: '登录账号', value: userInfo.value.username || '-' },
  { label: '邮箱', value: userInfo.value.email || '-' },
  { label: '角色', value: roleLabel.value },
  { label: '部门', value: userInfo.value.department || '-' },
  { label: '直属上级', value: userInfo.value.directLeaderName || '-' },
  { label: '登录方式', value: authProviderLabel.value },
]);

onMounted(async () => {
  loading.value = true;
  try {
    userInfo.value = await getUserInfoApi();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="profile-basic">
    <div class="profile-basic__header">
      <div>
        <div class="profile-basic__title">基本设置</div>
        <div class="profile-basic__desc">当前账号信息由飞书登录与权限配置同步</div>
      </div>
    </div>

    <div v-if="loading" class="profile-basic__loading">加载中...</div>
    <div v-else class="profile-basic__grid">
      <div
        v-for="row in profileRows"
        :key="row.label"
        class="profile-basic__item"
      >
        <div class="profile-basic__label">{{ row.label }}</div>
        <div class="profile-basic__value">{{ row.value }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-basic {
  max-width: 760px;
  padding: 4px 0 24px;
}

.profile-basic__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18px;
  border-bottom: 1px solid hsl(var(--border));
}

.profile-basic__title {
  font-size: 18px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.profile-basic__desc {
  margin-top: 6px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.profile-basic__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
  padding-top: 18px;
}

.profile-basic__loading {
  padding-top: 18px;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
}

.profile-basic__item {
  min-height: 72px;
  padding: 14px 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card));
}

.profile-basic__label {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.profile-basic__value {
  margin-top: 8px;
  overflow-wrap: anywhere;
  font-size: 15px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

@media (max-width: 720px) {
  .profile-basic__grid {
    grid-template-columns: 1fr;
  }
}
</style>
