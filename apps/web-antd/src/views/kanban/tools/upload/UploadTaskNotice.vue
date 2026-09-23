<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAccessStore, useUserStore } from '@vben/stores';

type UploadPhase =
  | 'caching'
  | 'executing'
  | 'failed'
  | 'pending'
  | 'preparing'
  | 'queued'
  | 'running'
  | 'submitted'
  | 'succeeded'
  | 'uploading';

interface UploadNotice {
  cached: boolean;
  dismissed: boolean;
  draftId: string;
  message: string;
  phase: UploadPhase;
  progress?: { completed: number; total: number; unit: 'chunks' | 'files' };
  spu: string;
}

const router = useRouter();
const accessStore = useAccessStore();
const userStore = useUserStore();
const notices = ref<UploadNotice[]>([]);
const currentOwner = computed(() => {
  const user = userStore.userInfo;
  const id = user?.userId || user?.id || user?.username;
  return accessStore.accessToken && id ? `user:${String(id)}` : '';
});
const visibleNotices = computed(() =>
  notices.value.filter((item) => !item.dismissed).slice(0, 3),
);
const hiddenCount = computed(() =>
  Math.max(0, notices.value.filter((item) => !item.dismissed).length - 3),
);
const terminal = new Set<UploadPhase>(['failed', 'pending', 'succeeded']);
const verifiedFrames = new WeakMap<MessageEventSource, HTMLIFrameElement>();
const identityTargets = new Map<Window, HTMLIFrameElement>();
let legacyOwner = '';
let allowLegacyMessages = true;
const phaseLabels: Record<UploadPhase, string> = {
  caching: '正在保存本地副本',
  executing: '后台执行中',
  failed: '上传失败',
  pending: '等待确认结果',
  preparing: '正在准备图片',
  queued: '已加入上传队列',
  running: '后台执行中',
  submitted: '已提交，等待处理',
  succeeded: '提交完成',
  uploading: '正在上传图片',
};

watch(
  [currentOwner, () => accessStore.accessToken || ''],
  ([owner, token], [previousOwner, previousToken]) => {
    if (previousOwner && owner !== previousOwner) allowLegacyMessages = false;
    if (owner && !legacyOwner) legacyOwner = owner;
    if (owner !== previousOwner) notices.value = [];
    if (isolatedBridgeInstalled()) return;
    if (owner === previousOwner && token === previousToken) return;
    for (const frame of document.querySelectorAll<HTMLIFrameElement>(
      '.upload-tool-frame',
    )) {
      if (frame.contentWindow) isUploadFrame(frame.contentWindow);
    }
    for (const target of identityTargets.keys()) {
      if (isUploadFrame(target)) postAccountIdentity(target);
      else identityTargets.delete(target);
    }
  },
  { immediate: true, flush: 'sync' },
);

function isUploadFrame(source: MessageEventSource | null) {
  if (!source) return false;
  const knownFrame = verifiedFrames.get(source);
  const frames = knownFrame
    ? [knownFrame]
    : [...document.querySelectorAll<HTMLIFrameElement>('.upload-tool-frame')];
  return frames.some((frame) => {
    try {
      const url = new URL(frame.src, window.location.href);
      const valid =
        (frame === knownFrame || frame.contentWindow === source) &&
        url.origin === window.location.origin &&
        url.pathname.endsWith('/tools/upload-tool.html');
      if (valid) {
        verifiedFrames.set(source, frame);
        identityTargets.set(source as Window, frame);
      }
      return valid;
    } catch {
      return false;
    }
  });
}

function isolatedBridgeInstalled() {
  return Boolean(
    (window as Window & { __kanbanUploadNoticeBridge?: boolean })
      .__kanbanUploadNoticeBridge,
  );
}

function postAccountIdentity(target: Window) {
  try {
    target.postMessage(
      {
        source: 'kanban-dashboard',
        token: currentOwner.value ? accessStore.accessToken || '' : '',
        type: 'kanban-auth-token',
        userId: currentOwner.value ? currentOwner.value.slice(5) : '',
      },
      window.location.origin,
    );
  } catch {
    identityTargets.delete(target);
  }
}

function handleMessage(event: MessageEvent) {
  // An isolated deployment may install the capture-phase bridge before the app.
  if (isolatedBridgeInstalled()) return;
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (data?.source !== 'kanban-upload-tool' || !isUploadFrame(event.source))
    return;
  if (data.type === 'kanban-auth-token-request') {
    postAccountIdentity(event.source as Window);
    return;
  }
  if (data.type !== 'kanban-upload-task-status' || !currentOwner.value) return;
  if (
    data.ownerKey === undefined
      ? !allowLegacyMessages || legacyOwner !== currentOwner.value
      : data.ownerKey !== currentOwner.value
  )
    return;
  if (!Object.hasOwn(phaseLabels, data.phase)) return;
  const draftId = String(data.draftId || '').slice(0, 100);
  if (!draftId) return;
  const previous = notices.value.find((item) => item.draftId === draftId);
  const phase = data.phase as UploadPhase;
  const progress = data.progress;
  const normalizedProgress =
    progress &&
    Number.isFinite(progress.completed) &&
    Number.isFinite(progress.total) &&
    progress.total > 0 &&
    ['chunks', 'files'].includes(progress.unit)
      ? {
          completed: Math.min(progress.total, Math.max(0, progress.completed)),
          total: progress.total,
          unit: progress.unit as 'chunks' | 'files',
        }
      : undefined;
  const notice: UploadNotice = {
    cached: data.cached === true,
    dismissed: Boolean(
      previous?.dismissed &&
      (previous.phase === phase ||
        (!terminal.has(phase) && !terminal.has(previous.phase))),
    ),
    draftId,
    message: String(data.message || '').slice(0, 300),
    phase,
    progress: normalizedProgress,
    spu: String(data.spu || '').slice(0, 80),
  };
  const index = notices.value.findIndex((item) => item.draftId === draftId);
  if (index === -1) notices.value.unshift(notice);
  else notices.value[index] = notice;
}

function dismiss(notice: UploadNotice) {
  notice.dismissed = true;
}

function openDraft(notice?: UploadNotice) {
  const draftId = notice?.draftId;
  void router.push({
    name: 'UploadTool',
    query: draftId ? { uploadDraft: draftId } : {},
  });
}

onMounted(() => {
  if (!isolatedBridgeInstalled()) {
    (
      window as Window & { __kanbanUploadIdentityBridge?: boolean }
    ).__kanbanUploadIdentityBridge = true;
  }
  window.addEventListener('message', handleMessage);
});
onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage);
  if (!isolatedBridgeInstalled()) {
    delete (window as Window & { __kanbanUploadIdentityBridge?: boolean })
      .__kanbanUploadIdentityBridge;
  }
  identityTargets.clear();
});
</script>

<template>
  <section
    v-if="visibleNotices.length > 0"
    class="upload-task-notices"
    aria-label="图片上传任务通知"
  >
    <div
      v-for="notice in visibleNotices"
      :key="notice.draftId"
      class="upload-task-notice"
      :class="`is-${notice.phase}`"
      :data-draft-id="notice.draftId"
      role="status"
      aria-live="polite"
    >
      <div class="notice-heading">
        <span class="notice-indicator" aria-hidden="true"></span>
        <strong>{{ phaseLabels[notice.phase] }}</strong>
        <button
          class="notice-close"
          type="button"
          :aria-label="`关闭 ${notice.spu || '上传任务'} 通知`"
          @click="dismiss(notice)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div v-if="notice.spu" class="notice-spu">SPU {{ notice.spu }}</div>
      <p>{{ notice.message }}</p>
      <div v-if="notice.progress" class="notice-progress">
        <progress
          :value="notice.progress.completed"
          :max="notice.progress.total"
          :aria-label="`${notice.spu}上传进度`"
        ></progress>
        <span>{{ notice.progress.completed }} / {{ notice.progress.total }}
          {{ notice.progress.unit === 'chunks' ? '片' : '个文件' }}</span>
      </div>
      <div class="notice-actions">
        <button type="button" @click="openDraft(notice)">
          查看任务{{
            notice.cached &&
            (notice.phase === 'failed' || notice.phase === 'pending')
              ? '并重试'
              : ''
          }}
        </button>
      </div>
    </div>
    <button
      v-if="hiddenCount"
      class="notice-more"
      type="button"
      @click="openDraft()"
    >
      另有 {{ hiddenCount }} 个任务，查看全部
    </button>
  </section>
</template>

<style scoped>
.upload-task-notices {
  position: fixed;
  inset-block-start: 74px;
  inset-inline-end: 20px;
  z-index: 900;
  display: grid;
  gap: 10px;
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100dvh - 94px);
  padding: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.upload-task-notice {
  padding: 15px 17px;
  color: #14243a;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 12px 36px rgb(15 23 42 / 20%);
}

.notice-heading {
  display: flex;
  gap: 9px;
  align-items: center;
}

.notice-heading strong {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.notice-indicator {
  width: 9px;
  height: 9px;
  background: #2563eb;
  border-radius: 50%;
}

.is-succeeded .notice-indicator {
  background: #059669;
}

.is-failed .notice-indicator {
  background: #dc2626;
}

.is-pending .notice-indicator {
  background: #d97706;
}

.notice-close {
  display: grid;
  place-items: center;
  padding: 4px;
  color: #64748b;
  background: transparent;
  border: 0;
}

.notice-close svg {
  width: 16px;
  height: 16px;
}

.notice-close:hover {
  color: #14243a;
}

.notice-close:focus-visible,
.notice-actions button:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.notice-spu {
  margin-block-start: 6px;
  font-size: 12px;
  color: #52657e;
}

.upload-task-notice p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #334155;
  overflow-wrap: anywhere;
}

.notice-actions {
  margin-block-start: 10px;
}

.notice-actions button {
  padding: 0;
  font-size: 13px;
  font-weight: 600;
  color: #1d4ed8;
  background: transparent;
  border: 0;
}

.notice-actions button:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.notice-progress {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-block-start: 9px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #52657e;
}

.notice-progress progress {
  width: 100%;
  min-width: 0;
  height: 6px;
  accent-color: #2563eb;
}

.notice-progress span {
  flex: none;
}

.notice-more {
  padding: 10px 14px;
  font-size: 13px;
  color: #1d4ed8;
  cursor: pointer;
  background: #fff;
  border: 0;
  border-radius: 12px;
}

.notice-more:hover {
  background: #eff6ff;
}

.notice-more:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}

.dark .upload-task-notice {
  color: #f8fafc;
  background: #1e293b;
  box-shadow: 0 12px 36px rgb(0 0 0 / 35%);
}

.dark .notice-spu,
.dark .upload-task-notice p {
  color: #cbd5e1;
}

.dark .notice-close {
  color: #94a3b8;
}

.dark .notice-close:hover {
  color: #f8fafc;
}

.dark .notice-actions button {
  color: #93c5fd;
}

.dark .notice-more {
  color: #93c5fd;
  background: #1e293b;
}

.dark .notice-progress {
  color: #cbd5e1;
}

@media (max-width: 640px) {
  .upload-task-notices {
    inset-block-start: 62px;
    inset-inline-end: 16px;
    max-height: calc(100dvh - 82px);
  }
}
</style>
