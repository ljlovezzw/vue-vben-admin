<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import type { InAppCardNotification } from '#/api/kanban';

import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import {
  acknowledgeInAppCardNotification,
  fetchInAppCardNotifications,
} from '#/api/kanban';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login.vue';

const IN_APP_NOTIFICATION_POLL_MS = 60_000;
const UPDATE_TIPS_SEARCH_TERM_AD_ANALYZER_KEY =
  'kanban:update-tips:search-term-report-ad-analyzer:v1';

const notifications = ref<NotificationItem[]>([]);
const inAppCardNotifications = ref<InAppCardNotification[]>([]);
const ackLoadingId = ref<null | number>(null);
const updateTipsVisible = ref(false);
let notificationPollTimer: ReturnType<typeof setInterval> | undefined;
let notificationVisibilityListenerBound = false;

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();
const showDot = computed(() =>
  notifications.value.some((item) => !item.isRead),
);
const activeInAppCardNotification = computed(
  () => inAppCardNotifications.value[0] ?? null,
);
const updateTipsModalOpen = computed(
  () => updateTipsVisible.value && !activeInAppCardNotification.value,
);

const menus = computed(() => [
  {
    handler: () => {
      router.push({ name: 'Profile' });
    },
    icon: 'lucide:user',
    text: $t('page.auth.profile'),
  },
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout(false);
}

function shouldShowSearchTermAdAnalyzerTips() {
  if (!accessStore.accessToken) return false;
  try {
    return (
      localStorage.getItem(UPDATE_TIPS_SEARCH_TERM_AD_ANALYZER_KEY) !== '1'
    );
  } catch {
    return false;
  }
}

function maybeShowSearchTermAdAnalyzerTips() {
  if (shouldShowSearchTermAdAnalyzerTips()) {
    updateTipsVisible.value = true;
  }
}

function acknowledgeSearchTermAdAnalyzerTips() {
  try {
    localStorage.setItem(UPDATE_TIPS_SEARCH_TERM_AD_ANALYZER_KEY, '1');
  } catch {
    // Ignore storage failures; closing the modal should still work this time.
  }
  updateTipsVisible.value = false;
}

async function handleNoticeClear() {
  await acknowledgeAllInAppNotifications();
}

async function markRead(id: number | string) {
  const item = notifications.value.find((item) => item.id === id);
  if (item?.inAppEventId) {
    await acknowledgeInAppNotification(Number(item.inAppEventId));
    return;
  }
  if (item) {
    item.isRead = true;
  }
}

async function remove(id: number | string) {
  await markRead(id);
}

async function handleMakeAll() {
  await acknowledgeAllInAppNotifications();
}

const viewAll = () => {};

const handleClick = (item: NotificationItem) => {
  if (item.inAppEventId) {
    const target = inAppCardNotifications.value.find(
      (notice) => notice.id === item.inAppEventId,
    );
    if (target) {
      inAppCardNotifications.value = [
        target,
        ...inAppCardNotifications.value.filter(
          (notice) => notice.id !== item.inAppEventId,
        ),
      ];
    }
    return;
  }
  // 如果通知项有链接，点击时跳转
  if (item.link) {
    navigateTo(item.link, item.query, item.state);
  }
};

function cardTitle(item: InAppCardNotification | null) {
  if (!item) return '卡片通知';
  const title = item.card?.header?.title?.content;
  return String(title || item.title || '卡片通知');
}

function cardPlainText(item: InAppCardNotification) {
  const blocks = cardContentBlocks(item);
  return blocks
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 160);
}

function normalizeCardMarkdown(value: unknown) {
  return String(value || '')
    .replaceAll('**', '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .replaceAll(/(?:^|\n)- /g, '\n- ')
    .replaceAll(/(?:^|\n)(\d+)\. /g, '\n$1. ')
    .trim();
}

function cardContentBlocks(item: InAppCardNotification | null) {
  const elements = Array.isArray(item?.card?.elements)
    ? item?.card?.elements
    : [];
  return elements
    .map((element: Record<string, any>) => {
      if (element.tag === 'markdown') {
        const text = normalizeCardMarkdown(element.content);
        return { kind: 'markdown', text };
      }
      if (element.tag === 'note' && Array.isArray(element.elements)) {
        const text = element.elements
          .map((child: Record<string, any>) => String(child.content || ''))
          .filter(Boolean)
          .join('\n');
        return { kind: 'note', text };
      }
      return null;
    })
    .filter(Boolean) as Array<{ kind: string; text: string }>;
}

function syncNotificationDropdown() {
  notifications.value = inAppCardNotifications.value.map((item) => ({
    avatar: avatar.value,
    date: item.sentAt || item.detectedAt || '',
    id: `in-app-card-${item.id}`,
    inAppEventId: item.id,
    isRead: false,
    message: cardPlainText(item),
    title: cardTitle(item),
  }));
}

function isNotificationAuthFailure(error: unknown) {
  const detail =
    typeof error === 'object' && error
      ? String(
          (error as Record<string, unknown>).detail ||
            (error as Record<string, unknown>).message ||
            '',
        )
      : String(error || '');
  return ['未登录', '登录已过期', '无效登录凭证', 'unauthorized'].some((item) =>
    detail.toLowerCase().includes(item.toLowerCase()),
  );
}

async function loadInAppCardNotifications(silent = true) {
  if (!accessStore.accessToken) {
    inAppCardNotifications.value = [];
    syncNotificationDropdown();
    return;
  }
  try {
    inAppCardNotifications.value = await fetchInAppCardNotifications({
      limit: 5,
    });
    syncNotificationDropdown();
  } catch (error) {
    if (isNotificationAuthFailure(error)) {
      stopNotificationPolling();
      inAppCardNotifications.value = [];
      syncNotificationDropdown();
      return;
    }
    if (!silent) {
      const detail = error instanceof Error ? error.message : String(error);
      message.error(`查询站内通知失败：${detail}`);
    }
  }
}

function stopNotificationPolling() {
  if (notificationPollTimer) {
    clearInterval(notificationPollTimer);
    notificationPollTimer = undefined;
  }
}

function startNotificationPolling() {
  stopNotificationPolling();
  if (document.hidden) {
    return;
  }
  void loadInAppCardNotifications();
  notificationPollTimer = setInterval(() => {
    void loadInAppCardNotifications();
  }, IN_APP_NOTIFICATION_POLL_MS);
}

function handleNotificationVisibilityChange() {
  if (!accessStore.accessToken) {
    return;
  }
  if (document.hidden) {
    stopNotificationPolling();
  } else {
    startNotificationPolling();
  }
}

function bindNotificationVisibilityListener() {
  if (notificationVisibilityListenerBound) {
    return;
  }
  document.addEventListener(
    'visibilitychange',
    handleNotificationVisibilityChange,
  );
  notificationVisibilityListenerBound = true;
}

function unbindNotificationVisibilityListener() {
  if (!notificationVisibilityListenerBound) {
    return;
  }
  document.removeEventListener(
    'visibilitychange',
    handleNotificationVisibilityChange,
  );
  notificationVisibilityListenerBound = false;
}

async function acknowledgeInAppNotification(eventId: number) {
  ackLoadingId.value = eventId;
  try {
    await acknowledgeInAppCardNotification(eventId);
    inAppCardNotifications.value = inAppCardNotifications.value.filter(
      (item) => item.id !== eventId,
    );
    syncNotificationDropdown();
  } finally {
    ackLoadingId.value = null;
  }
}

async function acknowledgeActiveInAppNotification() {
  const item = activeInAppCardNotification.value;
  if (!item) return;
  await acknowledgeInAppNotification(item.id);
}

async function acknowledgeAllInAppNotifications() {
  const ids = inAppCardNotifications.value.map((item) => item.id);
  for (const id of ids) {
    await acknowledgeInAppNotification(id);
  }
}

function navigateTo(
  link: string,
  query?: Record<string, any>,
  state?: Record<string, any>,
) {
  if (link.startsWith('http://') || link.startsWith('https://')) {
    // 外部链接，在新标签页打开
    window.open(link, '_blank');
  } else {
    // 内部路由链接，支持 query 参数和 state
    router.push({
      path: link,
      query: query || {},
      state,
    });
  }
}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const watermarkColor = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';

      await updateWatermark({
        advancedStyle: {
          colorStops: [
            {
              color: watermarkColor,
              offset: 0,
            },
            {
              color: watermarkColor,
              offset: 1,
            },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => accessStore.accessToken,
  (token) => {
    if (token) {
      bindNotificationVisibilityListener();
      startNotificationPolling();
      maybeShowSearchTermAdAnalyzerTips();
    } else {
      stopNotificationPolling();
      unbindNotificationVisibilityListener();
      inAppCardNotifications.value = [];
      syncNotificationDropdown();
      updateTipsVisible.value = false;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopNotificationPolling();
  unbindNotificationVisibilityListener();
});
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
        @on-click="handleClick"
        @view-all="viewAll"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
      <Modal
        :closable="false"
        :footer="null"
        :keyboard="false"
        :mask-closable="false"
        :open="Boolean(activeInAppCardNotification)"
        width="640px"
      >
        <div v-if="activeInAppCardNotification" class="in-app-card-notice">
          <div class="in-app-card-title">
            {{ cardTitle(activeInAppCardNotification) }}
          </div>
          <div
            v-for="(block, index) in cardContentBlocks(
              activeInAppCardNotification,
            )"
            :key="index"
            class="in-app-card-block"
            :class="{ 'in-app-card-note': block.kind === 'note' }"
          >
            {{ block.text }}
          </div>
          <div class="in-app-card-actions">
            <Button
              :loading="ackLoadingId === activeInAppCardNotification.id"
              type="primary"
              @click="acknowledgeActiveInAppNotification"
            >
              已收到
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        :closable="false"
        :footer="null"
        :keyboard="false"
        :mask-closable="false"
        :open="updateTipsModalOpen"
        width="560px"
      >
        <div class="update-tips-modal">
          <div class="update-tips-title">搜索词报告词库更新</div>
          <div class="update-tips-body">
            <p>搜索词报告词库新增“附加广告分析 xlsx”能力。</p>
            <ol>
              <li>进入工具下的搜索词报告词库。</li>
              <li>选择店铺、输入 SPU、选择主报告日期。</li>
              <li>查询并选择父 ASIN。</li>
              <li>
                如需额外广告分析文件，打开“附加广告商品和 SKU
                广告分析 xlsx”。
              </li>
              <li>广告分析日期默认跟主报告日期一致，也可以单独修改。</li>
              <li>点击生成后，完成页会额外出现两个下载文件。</li>
            </ol>
            <div class="update-tips-files">
              <div>店铺-SPU-ASIN转化报告.xlsx</div>
              <div>店铺-SPU-时间-全部广告.xlsx</div>
            </div>
          </div>
          <div class="update-tips-actions">
            <Button type="primary" @click="acknowledgeSearchTermAdAnalyzerTips">
              知道了
            </Button>
          </div>
        </div>
      </Modal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>

<style scoped>
.in-app-card-notice {
  color: #0f172a;
}

.in-app-card-title {
  padding-right: 24px;
  margin-bottom: 14px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
}

.in-app-card-block {
  padding: 12px 0;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-line;
  border-top: 1px solid #e5e7eb;
}

.in-app-card-block:first-of-type {
  border-top: 0;
}

.in-app-card-note {
  padding: 10px 12px;
  margin-top: 10px;
  font-size: 12px;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.in-app-card-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 18px;
}

.update-tips-modal {
  color: #0f172a;
}

.update-tips-title {
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
}

.update-tips-body {
  font-size: 14px;
  line-height: 1.8;
}

.update-tips-body p {
  margin: 0 0 10px;
}

.update-tips-body ol {
  padding-left: 20px;
  margin: 0;
}

.update-tips-files {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  margin-top: 12px;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #dbe5ef;
  border-radius: 8px;
}

.update-tips-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 18px;
}
</style>
