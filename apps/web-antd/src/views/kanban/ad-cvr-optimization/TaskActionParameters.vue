<script setup lang="ts">
import type { AdCvrTaskParameters } from '#/api/kanban/ad-cvr-optimization';

import { Input, InputNumber, Select } from 'ant-design-vue';

const props = defineProps<{
  action: string;
  disabled?: boolean;
  modelValue: AdCvrTaskParameters;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: AdCvrTaskParameters];
}>();

function percentage(
  value: null | number | string,
  key: 'bidPercentage' | 'budgetPercentage',
) {
  emit('update:modelValue', value === null ? {} : { [key]: value });
}
function negative(
  value: Partial<NonNullable<AdCvrTaskParameters['negative']>>,
) {
  emit('update:modelValue', {
    negative: { scope: 'ad_group', ...props.modelValue.negative, ...value },
  });
}
function match(value: Partial<NonNullable<AdCvrTaskParameters['matchType']>>) {
  emit('update:modelValue', {
    matchType: {
      cpc: 0,
      groupName: '',
      matchType: 'exact',
      ...props.modelValue.matchType,
      ...value,
    },
  });
}
</script>

<template>
  <div class="task-parameters">
    <template v-if="['lower_bid', 'increase_bid'].includes(action)">
      <label>竞价调整比例</label>
      <InputNumber
        :value="modelValue.bidPercentage"
        :disabled="disabled"
        :min="0.01"
        :max="99.99"
        addon-after="%"
        placeholder="输入比例"
        aria-label="竞价调整比例"
        @update:value="percentage($event, 'bidPercentage')"
      />
    </template>
    <template
      v-else-if="['decrease_budget', 'increase_budget'].includes(action)"
    >
      <label>预算调整比例</label>
      <InputNumber
        :value="modelValue.budgetPercentage"
        :disabled="disabled"
        :min="0.01"
        :max="99.99"
        addon-after="%"
        placeholder="输入比例"
        aria-label="预算调整比例"
        @update:value="percentage($event, 'budgetPercentage')"
      />
    </template>
    <template
      v-else-if="['negative_keyword', 'negative_asin'].includes(action)"
    >
      <Select
        :value="modelValue.negative?.scope"
        :disabled="disabled"
        placeholder="选择否定层级"
        aria-label="否定层级"
        :options="[
          { label: '广告组否定', value: 'ad_group' },
          { label: '广告活动否定', value: 'campaign' },
        ]"
        @update:value="negative({ scope: $event as 'ad_group' | 'campaign' })"
      />
      <Select
        v-if="action === 'negative_keyword'"
        :value="modelValue.negative?.matchType"
        :disabled="disabled"
        placeholder="选择否定匹配"
        aria-label="否定匹配方式"
        :options="[
          { label: '精准否定', value: 'negativeExact' },
          { label: '词组否定', value: 'negativePhrase' },
        ]"
        @update:value="
          negative({ matchType: $event as 'negativeExact' | 'negativePhrase' })
        "
      />
    </template>
    <Input
      v-if="action === 'negative_keyword'"
      :value="modelValue.negative?.keywordText || ''"
      :disabled="disabled"
      placeholder="实际否定词；词组须为原词连续片段"
      aria-label="实际否定词"
      @update:value="negative({ keywordText: $event })"
    />
    <template v-if="action === 'adjust_match_type'">
      <Input
        :value="modelValue.matchType?.groupName"
        :disabled="disabled"
        placeholder="新广告组名称"
        aria-label="新广告组名称"
        @update:value="match({ groupName: $event })"
      />
      <InputNumber
        :value="modelValue.matchType?.cpc"
        :disabled="disabled"
        :min="0.01"
        :precision="2"
        placeholder="当前币种竞价"
        aria-label="新广告组竞价"
        @update:value="match({ cpc: $event ?? 0 })"
      />
      <Select
        :value="modelValue.matchType?.matchType"
        :disabled="disabled"
        placeholder="选择匹配方式"
        aria-label="目标匹配方式"
        :options="[
          { label: '词组', value: 'phrase' },
          { label: '精准', value: 'exact' },
        ]"
        @update:value="match({ matchType: $event as 'exact' | 'phrase' })"
      />
    </template>
    <span
      v-if="
        ![
          'lower_bid',
          'increase_bid',
          'decrease_budget',
          'increase_budget',
          'negative_keyword',
          'negative_asin',
          'adjust_match_type',
        ].includes(action)
      "
      >按建议动作执行，无额外参数</span>
  </div>
</template>

<style scoped>
.task-parameters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.task-parameters :deep(.ant-select) {
  min-width: 140px;
}

.task-parameters :deep(.ant-input) {
  min-width: 180px;
}
</style>
