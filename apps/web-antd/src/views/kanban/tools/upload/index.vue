<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccessStore } from '@vben/stores';

const baseUrl = import.meta.env.BASE_URL || '/';
const toolUrl = `${baseUrl.replace(/\/$/, '')}/tools/upload-tool.html`;
const iframeRef = ref<HTMLIFrameElement | null>(null);
const accessStore = useAccessStore();

function postAuthToken() {
  const frameWindow = iframeRef.value?.contentWindow;
  if (!frameWindow || !accessStore.accessToken) {
    return;
  }
  frameWindow.postMessage(
    {
      source: 'kanban-dashboard',
      token: accessStore.accessToken,
      type: 'kanban-auth-token',
    },
    window.location.origin,
  );
}

function handleMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) {
    return;
  }
  if (event.data?.type === 'kanban-auth-token-request') {
    postAuthToken();
  }
}

onMounted(() => {
  window.addEventListener('message', handleMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage);
});
</script>

<template>
  <div class="upload-tool-page">
    <iframe
      ref="iframeRef"
      class="upload-tool-frame"
      :src="toolUrl"
      title="图片标准命名打包工具"
      @load="postAuthToken"
    ></iframe>
  </div>
</template>

<style scoped>
.upload-tool-page {
  height: calc(100vh - 112px);
  min-height: 720px;
  overflow: hidden;
  background: #eef3f8;
}

.upload-tool-frame {
  display: block;
  width: 100%;
  height: 100%;
  background: #eef3f8;
  border: 0;
}
</style>
