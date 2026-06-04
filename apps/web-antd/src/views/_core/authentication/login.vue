<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Button, Divider } from 'ant-design-vue';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const route = useRoute();

const labels = {
  adminLogin: '\u8D85\u7EA7\u7BA1\u7406\u5458\u767B\u5F55',
  feishuLogin: '\u4F7F\u7528\u98DE\u4E66\u767B\u5F55',
  loginTitle: '\u8FD0\u8425\u770B\u677F\u767B\u5F55',
  normalUserTip:
    '\u666E\u901A\u7528\u6237\u8BF7\u4F7F\u7528\u98DE\u4E66\u7EDF\u4E00\u767B\u5F55',
  or: '\u6216',
  usernamePlaceholder:
    '\u8D85\u7EA7\u7BA1\u7406\u5458\u8D26\u53F7 / \u90AE\u7BB1',
};

const feishuLoginUrl = computed(() => {
  const apiBase = String(import.meta.env.VITE_GLOB_API_URL || '/api').replace(
    /\/$/,
    '',
  );
  const configured =
    import.meta.env.VITE_FEISHU_LOGIN_URL || `${apiBase}/auth/feishu/login`;
  const next = window.location.hash
    ? `${window.location.origin}${window.location.pathname}#/auth/login`
    : `${window.location.origin}/auth/login`;
  const separator = configured.includes('?') ? '&' : '?';
  return `${configured}${separator}next=${encodeURIComponent(next)}`;
});

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: labels.usernamePlaceholder,
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];
});

function handleFeishuLogin() {
  window.location.assign(feishuLoginUrl.value);
}

onMounted(async () => {
  const rawToken = route.query.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (token) {
    await authStore.authFeishuLogin(token);
  }
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-remember-me="false"
    :show-third-party-login="false"
    :submit-button-text="labels.adminLogin"
    :sub-title="labels.normalUserTip"
    :title="labels.loginTitle"
    @submit="authStore.authLogin"
  >
    <template #third-party-login>
      <Divider plain>{{ labels.or }}</Divider>
      <Button
        block
        class="feishu-login-button"
        size="large"
        type="primary"
        @click="handleFeishuLogin"
      >
        {{ labels.feishuLogin }}
      </Button>
    </template>
  </AuthenticationLogin>
</template>

<style scoped>
.feishu-login-button {
  height: 42px;
  font-weight: 700;
  background: #1677ff;
  border-color: #1677ff;
}
</style>
