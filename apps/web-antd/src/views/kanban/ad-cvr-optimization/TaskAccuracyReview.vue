<script setup lang="ts">
import type {
  AdCvrAccuracyRow,
  AdCvrAccuracySample,
  AdCvrOptimizationScope,
} from '#/api/kanban/ad-cvr-optimization';

import { computed, onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  fetchAdCvrAccuracy,
  saveAdCvrAccuracy,
} from '#/api/kanban/ad-cvr-optimization';

const props = defineProps<{
  projectTags: string[];
  scope: AdCvrOptimizationScope;
}>();
const sample = ref<AdCvrAccuracySample>();
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const selected = ref<AdCvrAccuracyRow>();
const action = ref('');
const rating = ref<AdCvrAccuracyRow['rating']>();
const note = ref('');
const labels = {
  correct: '建议合理',
  insufficient: '证据不足',
  incorrect: '建议不合理',
};
const options = computed(() => [
  { value: '', label: '全部动作' },
  ...(sample.value?.counts ?? []).map((row) => ({
    value: row.action_type,
    label: row.actionLabel,
  })),
]);
const items = computed(() =>
  (sample.value?.items ?? []).filter(
    (row) => !action.value || row.action_type === action.value,
  ),
);
function metric(value: null | number | undefined) {
  return value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    sample.value = await fetchAdCvrAccuracy(
      { projectTags: props.projectTags },
      props.scope,
    );
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : String(error_);
  } finally {
    loading.value = false;
  }
}
function open(row: AdCvrAccuracyRow) {
  selected.value = row;
  rating.value = row.rating || undefined;
  note.value = row.note;
}
async function save() {
  if (
    !selected.value ||
    !sample.value ||
    !rating.value ||
    note.value.trim().length < 5
  )
    return;
  saving.value = true;
  error.value = '';
  try {
    await saveAdCvrAccuracy(
      {
        snapshotDate: sample.value.snapshot.date,
        snapshotVersion: sample.value.snapshot.version,
        suggestionId: selected.value.suggestion_id,
        rating: rating.value,
        note: note.value,
        version: selected.value.reviewVersion,
        projectTags: props.projectTags,
      },
      props.scope,
    );
    selected.value = undefined;
    await load();
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : String(error_);
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>

<template>
  <section class="accuracy-review">
    <header>
      <div>
        <h2>建议准确性审核</h2>
        <p>审核规则是否适合具体对象，记录证据与误判原因。</p>
      </div>
      <Button :loading="loading" @click="load">刷新样本</Button>
    </header>
    <Alert v-if="error && !selected" :message="error" type="error" show-icon />
    <p v-if="sample" class="sampling-note">{{ sample.sampling }}</p>
    <Spin :spinning="loading">
      <div
        v-if="sample?.counts.length"
        class="summary-scroll"
        tabindex="0"
        aria-label="按动作查看已审核结论"
      >
        <table>
          <thead>
            <tr>
              <th>建议动作</th>
              <th>已入选对象</th>
              <th>已审核</th>
              <th>合理</th>
              <th>证据不足</th>
              <th>不合理</th>
              <th>样本一致率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sample.counts" :key="row.action_type">
              <th>{{ row.actionLabel }}</th>
              <td>{{ row.total }}</td>
              <td>{{ row.reviewed }}</td>
              <td>{{ row.correct || 0 }}</td>
              <td>{{ row.insufficient || 0 }}</td>
              <td>{{ row.incorrect || 0 }}</td>
              <td>
                {{
                  row.reviewed
                    ? `${((100 * row.correct) / row.reviewed).toFixed(0)}%`
                    : '未审核'
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="sample-filter">
        <label for="accuracy-action">筛选动作</label><Select
          id="accuracy-action"
          v-model:value="action"
          :options="options"
        />
      </div>
      <article v-for="row in items" :key="row.suggestion_id">
        <div class="sample-evidence">
          <h3>
            {{ row.entity_name || '未命名对象' }}
            <Tag>{{ row.actionLabel }}</Tag>
          </h3>
          <p>
            {{ row.site }} · {{ row.store_name }} ·
            {{ row.spu || '未识别 SPU' }}
          </p>
          <p>
            点击 {{ metric(row.clicks) }} · 订单 {{ metric(row.orders) }} · 花费
            {{ metric(row.spend) }}（店铺币种）
          </p>
          <p>{{ row.reason }}</p>
          <p class="evidence-note">{{ row.evidence.reason }}</p>
          <p v-if="row.rating">
            {{ labels[row.rating] }} · {{ row.reviewedBy }}：{{ row.note }}
          </p>
        </div>
        <Button @click="open(row)">
          {{ row.rating ? '更新审核' : '填写审核' }}
        </Button>
      </article>
      <Empty
        v-if="!loading && items.length === 0"
        description="当前范围暂无可审核样本"
      />
    </Spin>
    <Modal
      :open="Boolean(selected)"
      title="记录建议审核结论"
      :confirm-loading="saving"
      :ok-button-props="{ disabled: !rating || note.trim().length < 5 }"
      @cancel="selected = undefined"
      @ok="save"
    >
      <Alert v-if="error" :message="error" type="error" show-icon />
      <p>{{ selected?.entity_name }} · {{ selected?.actionLabel }}</p>
      <p>审核记录用于校准规则；保存后仍需在任务中单独判断是否采纳。</p>
      <label for="accuracy-rating">审核结论</label><Select
        id="accuracy-rating"
        v-model:value="rating"
        class="modal-input"
        :options="
          Object.entries(labels).map(([value, label]) => ({ value, label }))
        "
        placeholder="请选择结论"
      />
      <label for="accuracy-note">判断依据</label><Input.TextArea
        id="accuracy-note"
        v-model:value="note"
        class="modal-input"
        :maxlength="1000"
        :rows="4"
        placeholder="填写指标、相关性或误判原因，至少 5 字"
      />
    </Modal>
  </section>
</template>

<style scoped>
.accuracy-review {
  padding: 24px;
  color: #344256;
  background: #fff;
  border: 1px solid #e1e6ee;
  border-radius: 10px;
}

header,
article {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

p {
  margin: 8px 0;
  line-height: 1.6;
}

.sampling-note,
.evidence-note {
  font-size: 13px;
  color: #5f7087;
}

.summary-scroll {
  margin: 20px 0;
  overflow-x: auto;
}

table {
  width: 100%;
  font-size: 13px;
  white-space: nowrap;
  border-collapse: collapse;
}

th,
td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e1e6ee;
}

thead {
  background: #f5f7fa;
}

.sample-filter {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.sample-filter :deep(.ant-select) {
  min-width: 180px;
}

article {
  padding: 20px 0;
  border-top: 1px solid #e1e6ee;
}

.sample-evidence {
  min-width: 0;
}

.modal-input {
  width: 100%;
  margin: 8px 0 16px;
}

@media (max-width: 600px) {
  .accuracy-review {
    padding: 16px;
  }

  header,
  article {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
