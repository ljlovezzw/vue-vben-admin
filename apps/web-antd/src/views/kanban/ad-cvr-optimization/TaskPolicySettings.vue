<script setup lang="ts">
import type {
  AdCvrOptimizationScope,
  AdCvrTaskPolicy,
  AdCvrTaskPolicyUpdate,
} from '#/api/kanban/ad-cvr-optimization';

import { computed, reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Tag,
} from 'ant-design-vue';

import { updateAdCvrTaskPolicy } from '#/api/kanban/ad-cvr-optimization';

const props = defineProps<{
  policy?: AdCvrTaskPolicy;
  scope: AdCvrOptimizationScope;
}>();
const emit = defineEmits<{
  refresh: [];
  updated: [policy: AdCvrTaskPolicy];
}>();

const modes = [
  {
    value: 'shadow',
    title: '影子试点',
    description: '运营可保存判断并预演；提交不会修改领星广告。',
  },
  {
    value: 'single_package',
    title: '受限试点',
    description: '仅配置的运营可提交；可进一步限定 SPU。',
  },
  {
    value: 'team',
    title: '团队执行',
    description: '权限范围内的运营可提交；仍需通过预演和执行校验。',
  },
] as const;

const draft = reactive<AdCvrTaskPolicyUpdate>({
  acceptanceNote: '',
  dailyCapacity: null,
  mode: 'shadow',
  pilotOwners: [],
  pilotSpus: [],
  shadowChecks: [],
  version: 0,
});
const confirmOpen = ref(false);
const saving = ref(false);
const error = ref('');

function policyUpdate(value: AdCvrTaskPolicy): AdCvrTaskPolicyUpdate {
  return {
    acceptanceNote: value.acceptanceNote || '',
    dailyCapacity: value.dailyCapacity ?? null,
    mode: value.mode,
    pilotOwners: [...(value.pilotOwners || [])],
    pilotSpus: [...(value.pilotSpus || [])],
    shadowChecks: [...(value.shadowChecks || [])],
    version: value.version,
  };
}

watch(
  () => props.policy,
  (value) => {
    if (value) Object.assign(draft, policyUpdate(value));
    confirmOpen.value = false;
    error.value = '';
  },
  { immediate: true },
);

const requiredCycles = computed(() => props.policy?.requiredShadowCycles || 3);
const archivedDates = computed(() =>
  [
    ...new Set([
      ...(props.policy?.availableShadowDates || []),
      ...draft.shadowChecks,
    ]),
  ]
    .toSorted((left, right) => right.localeCompare(left))
    .map((value) => ({ label: value, value })),
);
const ownerOptions = computed(() =>
  [...new Set([...(props.policy?.assignees || []), ...draft.pilotOwners])]
    .toSorted((left, right) => left.localeCompare(right, 'zh-CN'))
    .map((value) => ({ label: value, value })),
);
const dirty = computed(() => {
  const policy = props.policy;
  return (
    policy !== undefined &&
    JSON.stringify(draft) !== JSON.stringify(policyUpdate(policy))
  );
});
const liveMode = computed(() => draft.mode !== 'shadow');
const validationMessage = computed(() => {
  if (!liveMode.value) return '';
  if (draft.shadowChecks.length < requiredCycles.value)
    return `开放真实执行前，须选满 ${requiredCycles.value} 个不同的已归档快照日期。`;
  if (!draft.acceptanceNote.trim()) return '请填写人工验收结论。';
  if (draft.mode === 'single_package' && draft.pilotOwners.length === 0)
    return '受限试点至少指定一名运营。';
  return '';
});
const canSave = computed(() =>
  Boolean(
    props.policy?.canConfigure &&
    dirty.value &&
    !saving.value &&
    !validationMessage.value,
  ),
);

async function save() {
  if (!props.policy || !canSave.value) return;
  saving.value = true;
  error.value = '';
  try {
    const result = await updateAdCvrTaskPolicy(
      {
        ...draft,
        acceptanceNote: draft.acceptanceNote.trim(),
        pilotOwners: [
          ...new Set(
            draft.pilotOwners.map((value) => value.trim()).filter(Boolean),
          ),
        ],
        pilotSpus: [
          ...new Set(
            draft.pilotSpus.map((value) => value.trim()).filter(Boolean),
          ),
        ],
        shadowChecks: [...new Set(draft.shadowChecks)],
      },
      props.scope,
    );
    emit('updated', result);
    confirmOpen.value = false;
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : String(error_);
    confirmOpen.value = false;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="policy-settings panel" aria-labelledby="policy-title">
    <header class="policy-header">
      <div>
        <h2 id="policy-title">执行设置</h2>
        <p>
          设置适用于{{
            scope === 'daily' ? '日常广告优化' : '广告优化建议'
          }}；不会改写快照或已保存判断。
        </p>
      </div>
      <div class="header-actions">
        <Tag :color="policy?.mode === 'shadow' ? 'blue' : 'orange'">
          当前：{{
            modes.find((item) => item.value === policy?.mode)?.title || '未加载'
          }}
        </Tag>
        <Button size="small" @click="emit('refresh')">刷新设置</Button>
      </div>
    </header>

    <Alert
      v-if="!policy"
      type="error"
      show-icon
      message="设置加载失败，请刷新重试。"
    />
    <template v-else>
      <Alert
        v-if="!policy.canConfigure"
        type="info"
        show-icon
        message="当前账号可查看执行设置；仅管理员可以修改。"
        class="policy-notice"
      />
      <Alert
        v-if="error"
        type="error"
        show-icon
        :message="error"
        class="policy-notice"
      />

      <div class="policy-grid">
        <div class="policy-primary">
          <h3>执行模式</h3>
          <p class="field-hint">
            切换模式只改变后续提交权限；已生成的预演仍需重新核对。
          </p>
          <div class="mode-list" role="radiogroup" aria-label="执行模式">
            <button
              v-for="item in modes"
              :key="item.value"
              type="button"
              class="mode-option"
              :class="{ active: draft.mode === item.value }"
              role="radio"
              :aria-checked="draft.mode === item.value"
              :disabled="!policy.canConfigure"
              @click="draft.mode = item.value"
            >
              <span class="mode-mark" aria-hidden="true"></span>
              <span><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span>
            </button>
          </div>

          <div v-if="draft.mode === 'single_package'" class="pilot-fields">
            <h3>试点范围</h3>
            <label for="pilot-owners">试点运营 <span class="required">必填</span></label>
            <Select
              id="pilot-owners"
              v-model:value="draft.pilotOwners"
              mode="multiple"
              :options="ownerOptions"
              :disabled="!policy.canConfigure"
              placeholder="选择可提交的运营"
              aria-label="试点运营"
            />
            <label for="pilot-spus">试点 SPU</label>
            <Select
              id="pilot-spus"
              v-model:value="draft.pilotSpus"
              mode="tags"
              :disabled="!policy.canConfigure"
              placeholder="输入工作台中的 SPU 后按回车"
              aria-label="试点 SPU"
            />
            <p class="field-hint">
              SPU 留空会开放试点运营权限范围内的全部
              SPU；模式名称不代表系统只允许一个任务包。
            </p>
          </div>
        </div>

        <div class="policy-secondary">
          <h3>开放前验收</h3>
          <p class="field-hint">
            开放真实执行需要至少
            {{ requiredCycles }} 个不同日期的已归档快照，并登记人工验收结论。
          </p>
          <div
            class="cycle-count"
            :class="{ complete: draft.shadowChecks.length >= requiredCycles }"
          >
            <strong>{{ draft.shadowChecks.length }}</strong><span>/ {{ requiredCycles }} 个验收日期</span>
          </div>
          <label for="shadow-checks">已验收快照日期</label>
          <Select
            id="shadow-checks"
            v-model:value="draft.shadowChecks"
            mode="multiple"
            :options="archivedDates"
            :disabled="!policy.canConfigure"
            placeholder="从已归档快照中选择"
            aria-label="已验收快照日期"
          />
          <p v-if="archivedDates.length === 0" class="field-hint">
            暂无可选的已归档快照，不能开放真实执行。
          </p>
          <label for="acceptance-note">人工验收结论</label>
          <Input.TextArea
            id="acceptance-note"
            v-model:value="draft.acceptanceNote"
            :rows="4"
            :maxlength="2000"
            :disabled="!policy.canConfigure"
            placeholder="记录核对人、样本和结论；不要填写未经验证的通过结论"
            aria-label="人工验收结论"
          />
          <label for="daily-capacity">“我的任务”每日显示容量</label>
          <InputNumber
            id="daily-capacity"
            :value="draft.dailyCapacity ?? undefined"
            :min="1"
            :max="200"
            :disabled="!policy.canConfigure"
            placeholder="不限制"
            aria-label="每日显示容量"
            @change="
              draft.dailyCapacity = typeof $event === 'number' ? $event : null
            "
          />
          <p class="field-hint">留空不截断队列；此值不是执行提交额度。</p>
        </div>
      </div>

      <footer class="policy-footer">
        <span v-if="validationMessage" class="validation-error" role="status">{{
          validationMessage
        }}</span>
        <span v-else class="field-hint">{{
          dirty ? '有未保存的设置' : '设置已同步'
        }}</span>
        <Button
          v-if="policy.canConfigure"
          type="primary"
          :disabled="!canSave"
          @click="confirmOpen = true"
        >
          保存执行设置
        </Button>
      </footer>
    </template>
  </section>

  <Modal
    v-model:open="confirmOpen"
    title="确认保存执行设置"
    ok-text="确认保存"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !canSave }"
    @ok="save"
  >
    <p>
      将{{ policy?.mode === draft.mode ? '更新' : '切换至' }}“{{
        modes.find((item) => item.value === draft.mode)?.title
      }}”。
    </p>
    <p v-if="liveMode">
      保存后，符合试点范围或团队权限的运营可在完成判断与预演后提交真实广告修改；此操作本身不会立即修改广告。
    </p>
    <p v-else>
      保存后，提交真实广告修改将被服务端阻断；已有判断和执行回执不会删除。
    </p>
    <p v-if="draft.mode === 'single_package'">
      试点运营 {{ draft.pilotOwners.length }} 人 · 试点 SPU
      {{ draft.pilotSpus.length }} 个
    </p>
  </Modal>
</template>

<style scoped>
.policy-settings {
  width: 100%;
  max-width: 1120px;
  padding: 0;
  margin-inline: auto;
  overflow: hidden;
}

.policy-header,
.policy-footer {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.policy-header {
  padding: 22px 26px;
  border-bottom: 1px solid var(--line);
}

.policy-header h2 {
  margin: 0 0 4px;
  font-size: 21px;
  font-weight: 700;
}

.policy-header p,
.field-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--muted);
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.policy-notice {
  margin: 18px 26px 0;
}

.policy-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.16fr) minmax(300px, 0.84fr);
}

.policy-primary,
.policy-secondary {
  min-width: 0;
  padding: 24px 26px 28px;
}

.policy-secondary {
  background: #fbfcff;
  border-left: 1px solid var(--line);
}

h3 {
  margin: 0 0 5px;
  font-size: 16px;
  font-weight: 650;
}

.mode-list {
  display: grid;
  gap: 9px;
  margin-top: 18px;
}

.mode-option {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
  padding: 15px 16px;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 9px;
}

.mode-option:hover:not(:disabled) {
  border-color: #a9c2f5;
}

.mode-option.active {
  background: #f4f8ff;
  border-color: var(--blue);
}

.mode-option:disabled {
  cursor: default;
}

.mode-option:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

.mode-mark {
  flex: none;
  width: 17px;
  height: 17px;
  margin-top: 2px;
  background: white;
  border: 1px solid #aab8ce;
  border-radius: 50%;
}

.active .mode-mark {
  border: 5px solid var(--blue);
}

.mode-option strong,
.mode-option small {
  display: block;
}

.mode-option strong {
  font-size: 14px;
  font-weight: 650;
}

.mode-option small {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--muted);
}

.pilot-fields {
  display: grid;
  gap: 8px;
  margin-top: 30px;
}

.pilot-fields h3 {
  margin-bottom: 4px;
}

label {
  display: block;
  margin: 14px 0 2px;
  font-size: 13px;
  font-weight: 600;
  color: #415574;
}

.required,
.validation-error {
  color: var(--red);
}

.required {
  font-weight: 500;
}

.policy-settings :deep(.ant-select),
.policy-settings :deep(.ant-input-number) {
  width: 100%;
}

.cycle-count {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 19px 0 7px;
  color: var(--amber);
}

.cycle-count.complete {
  color: var(--green);
}

.cycle-count strong {
  font-size: 28px;
  line-height: 1;
}

.cycle-count span {
  font-size: 13px;
}

.policy-footer {
  padding: 16px 26px;
  border-top: 1px solid var(--line);
}

.validation-error {
  font-size: 12px;
}

@media (max-width: 800px) {
  .policy-grid {
    grid-template-columns: 1fr;
  }

  .policy-secondary {
    border-top: 1px solid var(--line);
    border-left: 0;
  }
}

@media (max-width: 560px) {
  .policy-header,
  .policy-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .policy-primary,
  .policy-secondary,
  .policy-header,
  .policy-footer {
    padding-right: 16px;
    padding-left: 16px;
  }

  .policy-footer :deep(.ant-btn) {
    width: 100%;
  }
}
</style>
