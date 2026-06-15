<script lang="ts" setup>
import { computed } from 'vue';

import { useAntdDesignTokens } from '@vben/hooks';
import { preferences, usePreferences } from '@vben/preferences';

import { App, ConfigProvider, theme } from 'ant-design-vue';

import { antdLocale } from '#/locales';

defineOptions({ name: 'App' });

const { isDark } = usePreferences();
const { tokens } = useAntdDesignTokens();

const tokenTheme = computed(() => {
  const algorithm = isDark.value
    ? [theme.darkAlgorithm]
    : [theme.defaultAlgorithm];

  // antd 紧凑模式算法
  if (preferences.app.compact) {
    algorithm.push(theme.compactAlgorithm);
  }

  return {
    algorithm,
    token: tokens,
  };
});
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="tokenTheme">
    <App>
      <RouterView />
    </App>
  </ConfigProvider>
</template>

<style>
.ant-select-dropdown {
  background: #fff !important;
  border: 1px solid rgb(203 213 225 / 95%) !important;
  box-shadow: 0 14px 36px rgb(15 23 42 / 24%) !important;
  backdrop-filter: none !important;
}

.ant-select-dropdown .ant-select-item {
  color: #334155;
  background: #fff;
}

.ant-select-dropdown
  .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background: #eef4ff !important;
}

.ant-select-dropdown
  .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  color: #1d4ed8;
  background: #dbeafe !important;
}

.ant-select-dropdown .ant-empty-description {
  color: #64748b;
}

.dark .ant-select-dropdown {
  background: #111827 !important;
  border-color: rgb(51 65 85 / 96%) !important;
  box-shadow: 0 18px 42px rgb(0 0 0 / 42%) !important;
}

.dark .ant-select-dropdown .ant-select-item {
  color: #d1d5db;
  background: #111827;
}

.dark
  .ant-select-dropdown
  .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background: #1e293b !important;
}

.dark
  .ant-select-dropdown
  .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  color: #bfdbfe;
  background: #1d4ed8 !important;
}

.dark .ant-select-dropdown .ant-empty-description {
  color: #94a3b8;
}
</style>
