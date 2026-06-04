import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import {
  feishuLoginApi,
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
} from '#/api';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

  async function completeLogin(
    accessToken: string,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    if (!accessToken) {
      return { userInfo };
    }

    accessStore.setAccessToken(accessToken);
    const [fetchUserInfoResult] = await Promise.all([
      fetchUserInfo(),
      fetchAccessCodes(),
    ]);

    userInfo = fetchUserInfoResult;
    userStore.setUserInfo(userInfo);

    if (accessStore.loginExpired) {
      accessStore.setLoginExpired(false);
    } else {
      onSuccess
        ? await onSuccess?.()
        : await router.push(
            userInfo.homePath || preferences.app.defaultHomePath,
          );
    }

    if (userInfo?.realName) {
      notification.success({
        description: `${$t('authentication.loginSuccessDesc')}:${userInfo.realName}`,
        duration: 3,
        message: $t('authentication.loginSuccess'),
      });
    }

    return { userInfo };
  }

  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    try {
      loginLoading.value = true;
      const { accessToken } = await loginApi(params);
      return await completeLogin(accessToken, onSuccess);
    } finally {
      loginLoading.value = false;
    }
  }

  async function authFeishuLogin(
    token: string,
    onSuccess?: () => Promise<void> | void,
  ) {
    try {
      loginLoading.value = true;
      const { accessToken } = await feishuLoginApi({ token });
      return await completeLogin(accessToken, onSuccess);
    } finally {
      loginLoading.value = false;
    }
  }

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // Ignore logout failures and clear local session state.
    }
    resetAllStores();
    accessStore.setLoginExpired(false);

    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    const userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  async function fetchAccessCodes() {
    const accessCodes = await getAccessCodesApi();
    accessStore.setAccessCodes(accessCodes);
    return accessCodes;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authFeishuLogin,
    authLogin,
    fetchAccessCodes,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
