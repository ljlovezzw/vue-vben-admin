<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import type {
  InAppCardNotification,
  InAppCardNotificationHistory,
} from '#/api/kanban';

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

import {
  Button,
  Empty,
  Input,
  message,
  Modal,
  Pagination,
  Segmented,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  acknowledgeInAppCardNotification,
  fetchInAppCardNotificationHistory,
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
const notificationHistoryOpen = ref(false);
const notificationHistoryLoading = ref(false);
const notificationHistoryKeyword = ref('');
const notificationHistoryStatus = ref<'acked' | 'all' | 'pending'>('all');
const notificationHistoryPage = ref(1);
const notificationHistoryPageSize = 10;
const notificationHistory = ref<InAppCardNotificationHistory>({
  items: [],
  page: 1,
  pageSize: notificationHistoryPageSize,
  total: 0,
});
const notificationHistoryDetail = ref<InAppCardNotification | null>(null);
let notificationHistoryRequestId = 0;
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
const notificationHistoryStatusOptions = [
  { label: '全部', value: 'all' },
  { label: '未读', value: 'pending' },
  { label: '已读', value: 'acked' },
];

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

async function loadNotificationHistory() {
  const requestId = ++notificationHistoryRequestId;
  notificationHistoryLoading.value = true;
  try {
    const result = await fetchInAppCardNotificationHistory({
      keyword: notificationHistoryKeyword.value.trim() || undefined,
      page: notificationHistoryPage.value,
      pageSize: notificationHistoryPageSize,
      status:
        notificationHistoryStatus.value === 'all'
          ? undefined
          : notificationHistoryStatus.value,
    });
    if (requestId === notificationHistoryRequestId) {
      notificationHistory.value = result;
    }
  } catch (error) {
    if (requestId === notificationHistoryRequestId) {
      const detail = error instanceof Error ? error.message : String(error);
      message.error(`查询通知记录失败：${detail}`);
    }
  } finally {
    if (requestId === notificationHistoryRequestId) {
      notificationHistoryLoading.value = false;
    }
  }
}

function viewAll() {
  notificationHistoryOpen.value = true;
  notificationHistoryPage.value = 1;
  void loadNotificationHistory();
}

function reloadNotificationHistoryFromFirstPage() {
  notificationHistoryPage.value = 1;
  void loadNotificationHistory();
}

function handleNotificationHistoryPageChange(page: number) {
  notificationHistoryPage.value = page;
  void loadNotificationHistory();
}

function openNotificationHistoryDetail(item: InAppCardNotification) {
  notificationHistoryDetail.value = item;
}

async function acknowledgeNotificationHistoryDetail() {
  const item = notificationHistoryDetail.value;
  if (!item || item.inAppStatus !== 'pending') return;
  await acknowledgeInAppNotification(item.id);
  notificationHistoryDetail.value = null;
  await loadNotificationHistory();
}

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

function notificationSceneText(scene: string) {
  const labels: Record<string, string> = {
    cold_start_fba_arrival: '新品 FBA 到货',
    cold_start_performance_bonus: '冷启动优秀表现',
    first_week_visual_cvr_low: '第一周低 CVR',
  };
  return labels[scene] || scene || '卡片通知';
}

function notificationTime(item: InAppCardNotification) {
  return String(item.sentAt || item.detectedAt || '')
    .replace('T', ' ')
    .slice(0, 16);
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
    window.removeEventListener(
      'beforeunload',
      releaseNotificationPollOwnership,
    );
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
      <Modal
        v-model:open="notificationHistoryOpen"
        :footer="null"
        title="通知记录"
        width="760px"
      >
        <div class="notification-history">
          <div class="notification-history-toolbar">
            <Segmented
              v-model:value="notificationHistoryStatus"
              :options="notificationHistoryStatusOptions"
              @change="reloadNotificationHistoryFromFirstPage"
            />
            <div class="notification-history-search">
              <Input
                v-model:value="notificationHistoryKeyword"
                allow-clear
                placeholder="搜索标题、场景或卡片内容"
                @press-enter="reloadNotificationHistoryFromFirstPage"
              />
              <Button
                :loading="notificationHistoryLoading"
                type="primary"
                @click="reloadNotificationHistoryFromFirstPage"
              >
                查询
              </Button>
            </div>
          </div>

          <Spin :spinning="notificationHistoryLoading">
            <div
              v-if="notificationHistory.items.length > 0"
              class="notification-history-list"
            >
              <button
                v-for="item in notificationHistory.items"
                :key="item.id"
                class="notification-history-item"
                type="button"
                @click="openNotificationHistoryDetail(item)"
              >
                <div class="notification-history-main">
                  <div class="notification-history-title">
                    <span>{{ cardTitle(item) }}</span>
                    <Tag
                      :color="
                        item.inAppStatus === 'pending'
                          ? 'processing'
                          : 'default'
                      "
                    >
                      {{ item.inAppStatus === 'pending' ? '未读' : '已读' }}
                    </Tag>
                  </div>
                  <p>{{ cardPlainText(item) || '查看卡片详情' }}</p>
                </div>
                <div class="notification-history-meta">
                  <span>{{ notificationSceneText(item.scene) }}</span>
                  <time>{{ notificationTime(item) }}</time>
                </div>
              </button>
            </div>
            <Empty v-else description="暂无通知记录" />
          </Spin>

          <div
            v-if="notificationHistory.total > notificationHistoryPageSize"
            class="notification-history-pagination"
          >
            <Pagination
              :current="notificationHistoryPage"
              :page-size="notificationHistoryPageSize"
              :show-size-changer="false"
              :total="notificationHistory.total"
              @change="handleNotificationHistoryPageChange"
            />
          </div>
        </div>
      </Modal>
      <Modal
        :footer="null"
        :open="Boolean(notificationHistoryDetail)"
        :title="cardTitle(notificationHistoryDetail)"
        width="640px"
        @cancel="notificationHistoryDetail = null"
      >
        <div v-if="notificationHistoryDetail" class="in-app-card-notice">
          <div class="notification-detail-meta">
            <Tag
              :color="
                notificationHistoryDetail.inAppStatus === 'pending'
                  ? 'processing'
                  : 'default'
              "
            >
              {{
                notificationHistoryDetail.inAppStatus === 'pending'
                  ? '未读'
                  : '已读'
              }}
            </Tag>
            <span>{{
              notificationSceneText(notificationHistoryDetail.scene)
            }}</span>
            <time>{{ notificationTime(notificationHistoryDetail) }}</time>
          </div>
          <div
            v-for="(block, index) in cardContentBlocks(
              notificationHistoryDetail,
            )"
            :key="index"
            class="in-app-card-block"
            :class="{ 'in-app-card-note': block.kind === 'note' }"
          >
            {{ block.text }}
          </div>
          <div
            v-if="notificationHistoryDetail.inAppStatus === 'pending'"
            class="in-app-card-actions"
          >
            <Button
              :loading="ackLoadingId === notificationHistoryDetail.id"
              type="primary"
              @click="acknowledgeNotificationHistoryDetail"
            >
              标记已读
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

.notification-history {
  min-height: 420px;
}

.notification-history-toolbar {
  display: grid;
  grid-template-columns: auto minmax(280px, 1fr);
  gap: 12px;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid #e5e7eb;
}

.notification-history-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.notification-history-list {
  max-height: 520px;
  overflow-y: auto;
}

.notification-history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  width: 100%;
  padding: 14px 4px;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #e5e7eb;
}

.notification-history-item:hover {
  background: #f8fafc;
}

.notification-history-main {
  min-width: 0;
}

.notification-history-title {
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: 650;
}

.notification-history-main p {
  display: -webkit-box;
  margin: 7px 0 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 13px;
  line-height: 1.55;
  color: #64748b;
  -webkit-box-orient: vertical;
}

.notification-history-meta {
  display: grid;
  gap: 6px;
  align-content: center;
  justify-items: end;
  font-size: 12px;
  color: #64748b;
}

.notification-history-pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.notification-detail-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  padding-bottom: 12px;
  font-size: 12px;
  color: #64748b;
}

@media (max-width: 680px) {
  .notification-history-toolbar,
  .notification-history-item {
    grid-template-columns: 1fr;
  }

  .notification-history-meta {
    grid-auto-flow: column;
    justify-content: start;
    justify-items: start;
  }
}
</style>
