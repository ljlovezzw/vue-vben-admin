<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { AlertLevel, KanbanSpuRow } from '#/api/kanban';

import { computed } from 'vue';

import { Button, Card, Table, Tag } from 'ant-design-vue';

const props = defineProps<{
  rows: KanbanSpuRow[];
}>();

const emit = defineEmits<{
  select: [row: KanbanSpuRow];
}>();

const alertMeta: Record<AlertLevel, { color: string; label: string }> = {
  red: { color: 'red', label: '红色' },
  orange: { color: 'orange', label: '橙色' },
  green: { color: 'green', label: '正常' },
  gray: { color: 'default', label: '待观察' },
};

function getAlertMeta(level: AlertLevel) {
  return alertMeta[level];
}

function openRow(record: KanbanSpuRow) {
  emit('select', record);
}

function openTableRecord(record: Record<string, any>) {
  openRow(record as KanbanSpuRow);
}

function customRow(record: KanbanSpuRow) {
  return {
    class: 'clickable-row',
    onClick: () => openRow(record),
  };
}

const columns: TableColumnsType<KanbanSpuRow> = [
  { title: '优先级', dataIndex: 'alertLevel', fixed: 'left', width: 92 },
  { title: 'SPU', dataIndex: 'spu', fixed: 'left', width: 128 },
  { title: '站点', dataIndex: 'site', width: 70 },
  { title: '类目', dataIndex: 'category', width: 110 },
  { title: '负责人', dataIndex: 'responsibleName', width: 100 },
  { title: '阶段', dataIndex: 'lifecycleStage', width: 110 },
  {
    title: '上架天数',
    dataIndex: 'daysSinceLaunch',
    width: 92,
    sorter: (a, b) => a.daysSinceLaunch - b.daysSinceLaunch,
  },
  {
    title: '近7日日销',
    dataIndex: 'avgSales7',
    width: 96,
    sorter: (a, b) => a.avgSales7 - b.avgSales7,
  },
  { title: 'CVR', dataIndex: 'cvr7', width: 80 },
  { title: '广告CVR', dataIndex: 'adCvr7', width: 92 },
  { title: 'ACOS', dataIndex: 'acos7', width: 86 },
  { title: 'TACOS', dataIndex: 'tacos7', width: 86 },
  { title: 'ROAS', dataIndex: 'roas7', width: 78 },
  {
    title: '库存天数',
    dataIndex: 'inventoryDays',
    width: 92,
    sorter: (a, b) => a.inventoryDays - b.inventoryDays,
  },
  { title: '评分', dataIndex: 'starRating', width: 78 },
  { title: '异常原因', dataIndex: 'reasonText', ellipsis: true, width: 280 },
  { title: '操作', dataIndex: 'action', fixed: 'right', width: 92 },
];

const dataSource = computed(() =>
  [...props.rows].toSorted(
    (a, b) =>
      a.priorityRank - b.priorityRank ||
      b.reasonCount - a.reasonCount ||
      b.daysSinceLaunch - a.daysSinceLaunch,
  ),
);

function rowKey(row: KanbanSpuRow) {
  return `${row.spu}-${row.site}`;
}
</script>

<template>
  <Card title="待干预新品清单" :body-style="{ padding: 0 }">
    <Table
      :columns="columns"
      :custom-row="customRow"
      :data-source="dataSource"
      :pagination="{ pageSize: 12, showSizeChanger: true }"
      :scroll="{ x: 1760 }"
      :row-key="rowKey"
      size="small"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'alertLevel'">
          <Tag :color="getAlertMeta(record.alertLevel).color">
            {{ getAlertMeta(record.alertLevel).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'spu'">
          <a class="spu-link" @click.stop="openTableRecord(record)">{{
            text
          }}</a>
        </template>
        <template v-else-if="column.dataIndex === 'cvr7'">
          {{ (record.cvr7 * 100).toFixed(2) }}%
        </template>
        <template v-else-if="column.dataIndex === 'adCvr7'">
          {{ (record.adCvr7 * 100).toFixed(2) }}%
        </template>
        <template v-else-if="column.dataIndex === 'acos7'">
          <span :class="record.acos7 > 0.3 ? 'risk' : ''">
            {{ (record.acos7 * 100).toFixed(2) }}%
          </span>
        </template>
        <template v-else-if="column.dataIndex === 'tacos7'">
          <span :class="record.tacos7 > 0.15 ? 'risk' : ''">
            {{ (record.tacos7 * 100).toFixed(2) }}%
          </span>
        </template>
        <template v-else-if="column.dataIndex === 'roas7'">
          {{ record.roas7.toFixed(2) }}
        </template>
        <template v-else-if="column.dataIndex === 'inventoryDays'">
          <span
            :class="
              record.inventoryDays <= 15
                ? 'risk'
                : record.inventoryDays <= 30
                  ? 'warn'
                  : ''
            "
          >
            {{ record.inventoryDays }} 天
          </span>
        </template>
        <template v-else-if="column.dataIndex === 'starRating'">
          {{ record.starRating.toFixed(1) }}
        </template>
        <template v-else-if="column.dataIndex === 'action'">
          <Button
            size="small"
            type="link"
            @click.stop="openTableRecord(record)"
          >
            明细
          </Button>
        </template>
      </template>
    </Table>
  </Card>
</template>

<style scoped>
.spu-link {
  font-weight: 800;
}

:deep(.clickable-row) {
  cursor: pointer;
}

:deep(.clickable-row:hover td) {
  background: #f8fafc !important;
}

.risk {
  font-weight: 800;
  color: #dc2626;
}

.warn {
  font-weight: 800;
  color: #b45309;
}
</style>
