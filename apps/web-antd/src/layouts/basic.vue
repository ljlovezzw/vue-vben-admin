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
const IN_APP_NOTIFICATION_MIN_REQUEST_MS = 58_000;
const IN_APP_NOTIFICATION_OWNER_RETRY_MS = 15_000;
const IN_APP_NOTIFICATION_OWNER_TTL_MS = 75_000;
const IN_APP_NOTIFICATION_OWNER_KEY = 'kanban:card-notifications:poll-owner';
const IN_APP_NOTIFICATION_LAST_REQUEST_KEY =
  'kanban:card-notifications:last-request';

const notifications = ref<NotificationItem[]>([]);
const inAppCardNotifications = ref<InAppCardNotification[]>([]);
const ackLoadingId = ref<null | number>(null);
let notificationPollTimer: ReturnType<typeof setTimeout> | undefined;
let notificationVisibilityListenerBound = false;
let notificationBeforeUnloadListenerBound = false;
let notificationRequestPending = false;

const notificationTabId = `${Date.now()}-${Math.random()
  .toString(16)
  .slice(2)}`;

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

function readNotificationOwner(): null | { expiresAt: number; tabId: string } {
  try {
    const raw = localStorage.getItem(IN_APP_NOTIFICATION_OWNER_KEY);
    if (!raw) return null;
    const owner = JSON.parse(raw) as Record<string, unknown>;
    return {
      expiresAt: Number(owner.expiresAt || 0),
      tabId: String(owner.tabId || ''),
    };
  } catch {
    return null;
  }
}

function acquireNotificationPollOwnership() {
  const now = Date.now();
  const owner = readNotificationOwner();
  if (owner && owner.tabId !== notificationTabId && owner.expiresAt > now) {
    return false;
  }
  try {
    localStorage.setItem(
      IN_APP_NOTIFICATION_OWNER_KEY,
      JSON.stringify({
        expiresAt: now + IN_APP_NOTIFICATION_OWNER_TTL_MS,
        tabId: notificationTabId,
      }),
    );
    return readNotificationOwner()?.tabId === notificationTabId;
  } catch {
    return true;
  }
}

function releaseNotificationPollOwnership() {
  const owner = readNotificationOwner();
  if (!owner || owner.tabId !== notificationTabId) {
    return;
  }
  try {
    localStorage.removeItem(IN_APP_NOTIFICATION_OWNER_KEY);
  } catch {
    // Storage cleanup is best effort only.
  }
}

function notificationRequestThrottleKey() {
  const userInfo = userStore.userInfo as Record<string, unknown> | undefined;
  const userKey = String(
    userInfo?.id || userInfo?.userId || userInfo?.username || 'current',
  );
  return `${IN_APP_NOTIFICATION_LAST_REQUEST_KEY}:${userKey}`;
}

function reserveNotificationRequestSlot() {
  const key = notificationRequestThrottleKey();
  const now = Date.now();
  try {
    const lastRequestAt = Number(localStorage.getItem(key) || 0);
    if (
      lastRequestAt > 0 &&
      now - lastRequestAt < IN_APP_NOTIFICATION_MIN_REQUEST_MS
    ) {
      return false;
    }
    localStorage.setItem(key, String(now));
    return localStorage.getItem(key) === String(now);
  } catch {
    return true;
  }
}

async function loadInAppCardNotifications(silent = true) {
  if (!accessStore.accessToken) {
    inAppCardNotifications.value = [];
    syncNotificationDropdown();
    return;
  }
  if (notificationRequestPending) {
    return;
  }
  if (!reserveNotificationRequestSlot()) {
    return;
  }
  notificationRequestPending = true;
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
  } finally {
    notificationRequestPending = false;
  }
}

function clearNotificationPollTimer() {
  if (notificationPollTimer) {
    clearTimeout(notificationPollTimer);
    notificationPollTimer = undefined;
  }
}

function scheduleNotificationPoll(delay = IN_APP_NOTIFICATION_POLL_MS) {
  clearNotificationPollTimer();
  if (!accessStore.accessToken || document.hidden) {
    return;
  }
  notificationPollTimer = setTimeout(async () => {
    notificationPollTimer = undefined;
    if (!accessStore.accessToken || document.hidden) {
      releaseNotificationPollOwnership();
      return;
    }
    if (!acquireNotificationPollOwnership()) {
      scheduleNotificationPoll(IN_APP_NOTIFICATION_OWNER_RETRY_MS);
      return;
    }
    await loadInAppCardNotifications();
    scheduleNotificationPoll(IN_APP_NOTIFICATION_POLL_MS);
  }, delay);
}

function stopNotificationPolling() {
  clearNotificationPollTimer();
  releaseNotificationPollOwnership();
}

function startNotificationPolling() {
  if (!accessStore.accessToken || document.hidden || notificationPollTimer) {
    return;
  }
  scheduleNotificationPoll(0);
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

function bindNotificationListeners() {
  if (!notificationVisibilityListenerBound) {
    document.addEventListener(
      'visibilitychange',
      handleNotificationVisibilityChange,
    );
    notificationVisibilityListenerBound = true;
  }
  if (!notificationBeforeUnloadListenerBound) {
    window.addEventListener('beforeunload', releaseNotificationPollOwnership);
    notificationBeforeUnloadListenerBound = true;
  }
}

function unbindNotificationListeners() {
  if (notificationVisibilityListenerBound) {
    document.removeEventListener(
      'visibilitychange',
      handleNotificationVisibilityChange,
    );
    notificationVisibilityListenerBound = false;
  }
  if (notificationBeforeUnloadListenerBound) {
    window.removeEventListener('beforeunload', releaseNotificationPollOwnership);
    notificationBeforeUnloadListenerBound = false;
  }
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
    window.open(link, '_blank');
  } else {
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
      bindNotificationListeners();
      startNotificationPolling();
    } else {
      stopNotificationPolling();
      unbindNotificationListeners();
      inAppCardNotifications.value = [];
      syncNotificationDropdown();
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopNotificationPolling();
  unbindNotificationListeners();
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
        @make-all="handleMakeAll"
        @on-click="handleClick"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
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
</style>
