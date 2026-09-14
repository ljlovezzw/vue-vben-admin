<script setup lang="ts">
import type {
  AdCvrHierarchyNode,
  AdCvrOptimizationScope,
} from '#/api/kanban/ad-cvr-optimization';

import { computed, ref, watch } from 'vue';

import { ChevronDown, Search } from '@vben/icons';

import { Button, Empty, Input, Popover, Spin, Tree } from 'ant-design-vue';

import { fetchAdCvrOptimizationHierarchy } from '#/api/kanban/ad-cvr-optimization';

import {
  hierarchyRequestParams,
  matchingHierarchyKeys,
  normalizeHierarchyKeys,
  searchHierarchy,
} from './hierarchy-picker';

const props = defineProps<{
  filters: Record<string, any>;
  scope: AdCvrOptimizationScope;
  value: string[];
}>();
const emit = defineEmits<{ change: [value: string[]] }>();
const open = ref(false);
const loading = ref(false);
const error = ref('');
const search = ref('');
const draft = ref<string[]>([]);
const nodes = ref<AdCvrHierarchyNode[]>([]);
const expanded = ref<string[]>([]);
let sequence = 0;
let cachedAt = 0;
const requestParams = computed(() => hierarchyRequestParams(props.filters));
const scopeKey = computed(() =>
  JSON.stringify([props.scope, requestParams.value]),
);
const visibleNodes = computed(() => searchHierarchy(nodes.value, search.value));
const normalizedDraft = computed(() => normalizeHierarchyKeys(draft.value));
const allRootsSelected = computed(
  () =>
    nodes.value.length > 0 &&
    nodes.value.every((node) => normalizedDraft.value.includes(node.key)),
);
const selectionError = computed(() =>
  !allRootsSelected.value &&
  (normalizedDraft.value.length > 200 ||
    normalizedDraft.value.reduce(
      (size, key) => size + encodeURIComponent(key).length + 24,
      0,
    ) > 5000)
    ? '所选节点过多，请优先勾选上级 SPU 或广告活动（最多 200 项）'
    : '',
);

async function loadTree() {
  if (cachedAt && Date.now() - cachedAt < 120_000) return;
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const result = await fetchAdCvrOptimizationHierarchy(
      requestParams.value,
      props.scope,
    );
    if (current !== sequence) return;
    nodes.value = result.hierarchy;
    cachedAt = Date.now();
  } catch {
    if (current === sequence) error.value = '关联广告加载失败，请重试';
  } finally {
    if (current === sequence) loading.value = false;
  }
}

watch(scopeKey, () => {
  sequence += 1;
  cachedAt = 0;
  nodes.value = [];
  loading.value = false;
  open.value = false;
});
watch(open, (value) => {
  if (!value) return;
  draft.value = [...props.value];
  search.value = '';
  expanded.value = [];
  void loadTree();
});
watch(search, (value) => {
  const keys: string[] = [];
  function visit(rows: AdCvrHierarchyNode[]) {
    for (const node of rows) {
      if (node.children?.length) {
        keys.push(node.key);
        visit(node.children);
      }
    }
  }
  if (value.trim()) visit(visibleNodes.value);
  expanded.value = keys;
});

function check(value: (number | string)[] | { checked: (number | string)[] }) {
  draft.value = (Array.isArray(value) ? value : value.checked).map(String);
}
function confirm() {
  const keys = normalizedDraft.value;
  emit('change', allRootsSelected.value ? [] : keys);
  open.value = false;
}
</script>

<template>
  <Popover
    v-model:open="open"
    trigger="click"
    placement="bottomRight"
    overlay-class-name="ad-cvr-hierarchy-popover"
  >
    <template #content>
      <div class="hierarchy-panel">
        <Input
          v-model:value="search"
          allow-clear
          placeholder="搜索 SPU、广告活动或广告组"
          aria-label="搜索关联广告"
        >
          <template #prefix><Search :size="14" /></template>
        </Input>
        <p class="hierarchy-hint">
          展开 SPU 查看活动和广告组，勾选上级包含其下全部记录
        </p>
        <div class="hierarchy-tools">
          <Button
            type="link"
            size="small"
            :disabled="loading || visibleNodes.length === 0"
            @click="draft = matchingHierarchyKeys(nodes, search)"
          >
            全选搜索结果
          </Button>
          <Button type="link" size="small" @click="draft = []">清空</Button>
          <span>{{ nodes.length }} 个 SPU</span>
        </div>
        <Spin :spinning="loading">
          <div class="hierarchy-tree">
            <div v-if="error" role="alert">
              {{ error }} <Button size="small" @click="loadTree">重试</Button>
            </div>
            <Tree
              v-else-if="visibleNodes.length > 0"
              v-model:expanded-keys="expanded"
              :tree-data="visibleNodes"
              :checked-keys="draft"
              checkable
              check-strictly
              :selectable="false"
              :height="300"
              :virtual="true"
              @check="check"
            >
              <template #title="node">
                <span :title="node.title">{{ node.title }}</span>
              </template>
            </Tree>
            <Empty
              v-else-if="!loading"
              :description="
                search
                  ? '没有匹配的 SPU / 广告活动 / 广告组'
                  : '当前筛选范围没有关联广告'
              "
            />
          </div>
        </Spin>
        <p v-if="selectionError" class="hierarchy-error" role="alert">
          {{ selectionError }}
        </p>
        <div class="hierarchy-footer">
          <span>已选 {{ normalizedDraft.length }} 项</span>
          <Button size="small" @click="open = false">取消</Button>
          <Button
            size="small"
            type="primary"
            :disabled="loading || !!error || !!selectionError"
            @click="confirm"
          >
            确定
          </Button>
        </div>
      </div>
    </template>
    <Button
      class="hierarchy-trigger"
      :aria-expanded="open"
      aria-label="筛选 SPU / 广告活动 / 广告组"
    >
      <span>{{
        value.length > 0
          ? `已选 ${value.length} 项 · SPU / 活动 / 广告组`
          : '筛选 SPU / 广告活动 / 广告组'
      }}</span>
      <ChevronDown :size="14" />
    </Button>
  </Popover>
</template>

<style scoped>
.hierarchy-trigger {
  display: inline-flex;
  gap: 12px;
  justify-content: space-between;
  width: 100%;
}

.hierarchy-trigger span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.hierarchy-panel {
  width: min(480px, calc(100vw - 56px));
}

.hierarchy-hint {
  margin: 8px 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.hierarchy-tools,
.hierarchy-footer {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hierarchy-tools > span {
  margin-left: auto;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.hierarchy-tree {
  min-height: 180px;
  max-height: 300px;
  margin: 8px 0;
  overflow: auto;
}

.hierarchy-tree :deep(.ant-tree-title) {
  display: inline-block;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.hierarchy-footer {
  padding-top: 12px;
  border-top: 1px solid hsl(var(--border));
}

.hierarchy-footer > span {
  margin-right: auto;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.hierarchy-error {
  font-size: 12px;
  color: hsl(var(--destructive));
}
</style>
