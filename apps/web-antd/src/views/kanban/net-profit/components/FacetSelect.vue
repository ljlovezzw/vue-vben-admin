<script setup lang="ts">
import { computed, defineComponent } from 'vue';

import { Button, Select } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modelValue: string[];
    options: string[];
    placeholder: string;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  change: [value: string[]];
  'update:modelValue': [value: string[]];
}>();

const VNodes = defineComponent({
  inheritAttrs: false,
  props: {
    vnodes: {
      required: true,
      type: Object,
    },
  },
  setup(componentProps) {
    return () => componentProps.vnodes;
  },
});

const selectOptions = computed(() =>
  props.options.map((value) => ({ label: value, value })),
);
const allSelected = computed(
  () =>
    props.options.length > 0 &&
    props.options.every((value) => props.modelValue.includes(value)),
);
const selectionText = computed(() => {
  if (allSelected.value) return `全部 ${props.options.length} 项`;
  return `已选 ${props.modelValue.length} 项`;
});

function updateValue(value: string[]) {
  emit('update:modelValue', value);
  emit('change', value);
}

function handleSelectChange(value: unknown) {
  updateValue(Array.isArray(value) ? value.map(String) : []);
}

function selectAll() {
  if (!allSelected.value) updateValue([...props.options]);
}

function clearAll() {
  if (props.modelValue.length > 0) updateValue([]);
}
</script>

<template>
  <Select
    allow-clear
    class="facet-select"
    :disabled="disabled"
    :max-tag-count="0"
    :max-tag-placeholder="selectionText"
    mode="multiple"
    :not-found-content="`没有匹配的${placeholder}`"
    option-filter-prop="label"
    :options="selectOptions"
    :placeholder="`${placeholder}（全部）`"
    show-search
    :value="modelValue"
    @change="handleSelectChange"
  >
    <template #dropdownRender="{ menuNode }">
      <div class="facet-actions" @mousedown.prevent>
        <span>当前范围 {{ options.length }} 项</span>
        <div>
          <Button
            :disabled="allSelected || options.length === 0"
            size="small"
            type="link"
            @click.stop="selectAll"
          >
            全选
          </Button>
          <Button
            :disabled="modelValue.length === 0"
            size="small"
            type="link"
            @click.stop="clearAll"
          >
            清空
          </Button>
        </div>
      </div>
      <VNodes :vnodes="menuNode" />
    </template>
  </Select>
</template>

<style scoped>
.facet-select {
  min-width: 0;
}

.facet-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  padding: 4px 8px;
  border-bottom: 1px solid #e5eaf0;
}

.facet-actions > span {
  font-size: 12px;
  color: #66758a;
}

.facet-actions > div {
  display: flex;
  flex: none;
}

.facet-actions :deep(.ant-btn) {
  padding-inline: 6px;
}

.facet-select :deep(.ant-select-selection-overflow) {
  flex-wrap: nowrap;
}

.facet-select :deep(.ant-select-selection-item) {
  max-width: calc(100% - 8px);
  font-weight: 600;
  color: #1f4f85;
  background: #edf5ff;
  border-color: #bfd7f2;
}
</style>
