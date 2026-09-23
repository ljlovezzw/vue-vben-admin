<script setup lang="ts">
import type { PerformanceReview } from './TaskPerformanceReview.vue';

import type {
  AdCvrOptimizationScope,
  AdCvrTaskReview,
} from '#/api/kanban/ad-cvr-optimization';

import { onMounted, ref } from 'vue';

import { Alert, Button, Empty, Input, Modal, Spin, Tag } from 'ant-design-vue';

import {
  acknowledgeAdCvrTaskReview,
  fetchAdCvrTaskReviews,
} from '#/api/kanban/ad-cvr-optimization';

import TaskPerformanceReview from './TaskPerformanceReview.vue';

const props = defineProps<{
  canManage?: boolean;
  projectTags: string[];
  scope: AdCvrOptimizationScope;
}>();
const emit = defineEmits<{ open: [item: AdCvrTaskReview] }>();
const rows = ref<AdCvrTaskReview[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const confirmRow = ref<AdCvrTaskReview>();
const note = ref('');
const saving = ref(false);
const labels: Record<string, string> = {
  due: '观察到期 · 重新判断',
  awaiting_data: '等待新数据',
  verified: '关闭状态已验证',
  needs_review: '执行后需核对',
  platform_check_required: '需核对领星对象',
  acknowledged: '人工核对完成',
};
async function acknowledge() {
  if (!confirmRow.value || note.value.trim().length < 5) return;
  saving.value = true;
  try {
    await acknowledgeAdCvrTaskReview(
      {
        sourceVersion: confirmRow.value.source_version,
        suggestionId: confirmRow.value.suggestion_id,
        note: note.value,
        projectTags: props.projectTags,
      },
      props.scope,
    );
    confirmRow.value = undefined;
    await load();
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : String(error_);
  } finally {
    saving.value = false;
  }
}
function evidence(value: string) {
  try {
    return JSON.parse(value) as {
      latest: { clicks?: number; orders?: number; spend?: number };
      note: string;
      performance?: PerformanceReview;
    };
  } catch {
    return undefined;
  }
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await fetchAdCvrTaskReviews(
      { page: page.value, projectTags: props.projectTags },
      props.scope,
    );
    rows.value = result.items;
    total.value = result.total;
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : String(error_);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <section class="reviews">
    <header>
      <div>
        <h3>观察到期与执行后复查</h3>
        <p>新快照发布后自动复查；缺少对象不代表关闭成功，也不会自动重试。</p>
      </div>
      <Button :loading="loading" @click="load">刷新复查</Button>
    </header>
    <Alert v-if="error" :message="error" type="error" show-icon />
    <Spin :spinning="loading">
      <article
        v-for="row in rows"
        :key="`${row.source_version}:${row.suggestion_id}:${row.review_kind}`"
      >
        <div>
          <strong>{{ row.spu || '未识别 SPU' }} · {{ row.site }} ·
            {{ row.store_name }}</strong>
          <p>
            {{ row.responsible }} · 原快照 {{ row.source_date }} → 复查
            {{ row.review_date }}
          </p>
          <small v-if="!evidence(row.evidence_json)?.performance">新窗口点击
            {{ evidence(row.evidence_json)?.latest?.clicks ?? '—' }} · 订单
            {{
              evidence(row.evidence_json)?.latest?.orders ?? '—'
            }}。窗口可能重叠，不代表因果收益。</small>
          <TaskPerformanceReview
            v-if="evidence(row.evidence_json)?.performance"
            :value="evidence(row.evidence_json)!.performance!"
          />
        </div>
        <Tag :color="row.status === 'verified' ? 'green' : 'orange'">
          {{ labels[row.status] || row.status }}
        </Tag>
        <Button @click="emit('open', row)">查看当前任务</Button>
        <Button
          v-if="
            canManage &&
            ['platform_check_required', 'needs_review'].includes(row.status)
          "
          @click="
            confirmRow = row;
            note = '';
          "
        >
          完成领星人工核对
        </Button>
      </article>
      <Empty
        v-if="rows.length === 0 && !loading"
        description="暂无到期复查记录；新快照发布后生成"
      />
      <footer v-if="total">
        <Button
          :disabled="page <= 1"
          @click="
            page--;
            load();
          "
        >
          上一页
</Button><span>{{ page }} 页 · {{ total }} 项</span><Button
          :disabled="page * 50 >= total"
          @click="
            page++;
            load();
          "
        >
          下一页
        </Button>
      </footer>
    </Spin>
    <Modal
      :open="Boolean(confirmRow)"
      title="确认执行后复查结果"
      :confirm-loading="saving"
      :ok-button-props="{ disabled: note.trim().length < 5 }"
      @cancel="confirmRow = undefined"
      @ok="acknowledge"
    >
      <p>
        请先在领星核对具体对象与修改结果。此操作不会修改广告，会记录结论并允许后续新快照重新分析该对象。
      </p>
      <Input.TextArea
        v-model:value="note"
        aria-label="领星核对结论"
        placeholder="填写实际状态、对象与核对结论（至少 5 字）"
        :maxlength="1000"
      />
    </Modal>
  </section>
</template>

<style scoped>
.reviews {
  padding: 20px;
  margin-top: 20px;
  color: #344256;
  background: #fff;
  border: 1px solid #e1e6ee;
  border-radius: 10px;
}

header,
article,
footer {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

p {
  margin: 6px 0;
  font-size: 13px;
  color: #5f7087;
}

small {
  color: #5f7087;
}

article {
  flex-wrap: wrap;
  padding: 16px 0;
  border-top: 1px solid #e1e6ee;
}

article > div {
  flex: 1 1 360px;
}

header {
  align-items: flex-start;
  margin-bottom: 20px;
}

footer {
  margin-top: 16px;
}

@media (max-width: 600px) {
  header {
    flex-direction: column;
  }

  .reviews {
    padding: 14px;
  }
}
</style>
