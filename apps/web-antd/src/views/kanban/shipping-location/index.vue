<script setup lang="ts">
import type {
  ShippingLocationFinderBootstrap,
  ShippingLocationFinderItem,
  ShippingLocationModeEstimate,
} from '#/api/kanban/types';

import { computed, onMounted, ref } from 'vue';

import { fetchShippingLocationFinderBootstrap } from '#/api/kanban';

const DEFAULT_CODES = ['LGB8', 'ABE8', 'IND9', 'DFW7', 'ONT8'];

const codeInput = ref(DEFAULT_CODES.join('\n'));
const loading = ref(false);
const loadError = ref('');
const bootstrap = ref<null | ShippingLocationFinderBootstrap>(null);

const warehouseByCode = computed(() => {
  const map = new Map<string, ShippingLocationFinderItem>();
  for (const item of bootstrap.value?.warehouses || []) {
    map.set(item.warehouseId.toUpperCase(), item);
  }
  return map;
});

const parsedCodes = computed(() => {
  const values = codeInput.value
    .replaceAll('，', '\n')
    .replaceAll(',', '\n')
    .replaceAll('/', '\n')
    .split(/\s+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(values)];
});

const resultRows = computed<ShippingLocationFinderItem[]>(() => {
  const estimates = bootstrap.value?.modeEstimates || [];
  return parsedCodes.value.map((code) => {
    const matched = warehouseByCode.value.get(code);
    if (matched) return matched;
    return {
      city: '',
      countryCode: 'US',
      recommendation: '未命中仓库映射，先补充城市/州后再判断',
      recommendedModes: estimates.slice(0, 5),
      region: 'UNKNOWN',
      regionLabel: '未知',
      source: 'unknown',
      stateCode: '',
      subRegionLabel: '',
      warehouseId: code,
    };
  });
});

const regionCards = computed(() => {
  const rows = resultRows.value;
  return [
    {
      region: 'WEST',
      regionLabel: '美国西部',
      note: '加州 / 亚利桑那 / 内华达',
      count: rows.filter((item) => item.region === 'WEST').length,
    },
    {
      region: 'CENTRAL',
      regionLabel: '美国中部',
      note: '中西部 / 五大湖 / 平原',
      count: rows.filter((item) => item.region === 'CENTRAL').length,
    },
    {
      region: 'SOUTH',
      regionLabel: '美国南部',
      note: 'Texas / 中南部 / 东南部',
      count: rows.filter((item) => item.region === 'SOUTH').length,
    },
    {
      region: 'EAST',
      regionLabel: '美国东部',
      note: '东北部 / 宾州 / 新泽西',
      count: rows.filter((item) => item.region === 'EAST').length,
    },
  ];
});

function riskClass(risk: string) {
  return (
    {
      HIGH: 'risk-high',
      LOW: 'risk-low',
      MEDIUM: 'risk-medium',
    }[risk] || 'risk-medium'
  );
}

function regionClass(region: string) {
  return (
    {
      CENTRAL: 'region-central',
      EAST: 'region-east',
      SOUTH: 'region-south',
      UNKNOWN: 'region-unknown',
      WEST: 'region-west',
    }[region] || 'region-unknown'
  );
}

function daysLabel(mode: ShippingLocationModeEstimate) {
  if (mode.estimatedMinDays === null || mode.estimatedMaxDays === null)
    return '-';
  if (mode.estimatedMinDays === mode.estimatedMaxDays)
    return `${mode.estimatedMinDays} 天`;
  return `${mode.estimatedMinDays}-${mode.estimatedMaxDays} 天`;
}

function vendorLabel(mode: ShippingLocationModeEstimate) {
  return mode.topVendors.map((item) => item.vendor).join(' / ') || '-';
}

function bestEstimate(row: ShippingLocationFinderItem) {
  return row.recommendedModes[0];
}

function clearInput() {
  codeInput.value = '';
}

function exportCsv() {
  const header = [
    '仓库代码',
    '区域',
    '州',
    '城市',
    '推荐运输方式',
    '预计入仓周期',
    '风险',
    '操作建议',
  ];
  const rows = resultRows.value.map((row) => {
    const estimate = bestEstimate(row);
    return [
      row.warehouseId,
      row.regionLabel,
      row.stateCode || '-',
      row.city || '-',
      estimate?.mode || '-',
      estimate ? daysLabel(estimate) : '-',
      estimate?.riskLabel || '-',
      row.recommendation,
    ];
  });
  const csv = [header, ...rows]
    .map((line) =>
      line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','),
    )
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `FBA仓库区域查询_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function loadBootstrap() {
  loading.value = true;
  loadError.value = '';
  try {
    bootstrap.value = await fetchShippingLocationFinderBootstrap();
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : '北美物流数据加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadBootstrap);
</script>

<template>
  <div class="location-page">
    <section class="hero">
      <div>
        <p class="eyebrow">Amazon FBA Location Finder</p>
        <h1>仓库代码，一查就知道<br /><span>该往哪里发</span></h1>
        <p class="subline">
          北美物流历史样本 {{ bootstrap?.logisticsSampleCount ?? '-' }} 条 ·
          {{ bootstrap?.loadedAt?.slice(0, 16).replace('T', ' ') || '加载中' }}
        </p>
      </div>
    </section>

    <section class="workspace">
      <div class="query-panel">
        <div class="panel-title">
          <b>输入仓库代码</b>
          <span>支持空格、逗号、斜杠、换行</span>
        </div>
        <textarea v-model="codeInput" spellcheck="false" />
        <div class="actions">
          <button class="primary" disabled type="button">
            {{ loading ? '加载北美数据中' : '已初始化' }}
          </button>
          <button type="button" @click="clearInput">清空</button>
          <button type="button" @click="exportCsv">导出结果</button>
        </div>
        <p v-if="loadError" class="error">{{ loadError }}</p>
      </div>

      <aside class="region-panel">
        <div class="panel-title">
          <b>区域速查</b>
          <span>{{ resultRows.length }} 个编码</span>
        </div>
        <div class="region-grid">
          <div
            v-for="card in regionCards"
            :key="card.region"
            class="region-card"
          >
            <strong>{{ card.regionLabel }}</strong>
            <span>{{ card.note }}</span>
            <b>{{ card.count }}</b>
          </div>
        </div>
      </aside>
    </section>

    <section class="results">
      <div class="result-head">
        <b>查询结果</b>
        <span>共 {{ resultRows.length }} 条</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>仓库代码</th>
              <th>区域</th>
              <th>州 / 城市</th>
              <th>推荐运输方式</th>
              <th>预计入仓周期</th>
              <th>风险</th>
              <th>物流商参考</th>
              <th>操作建议</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in resultRows" :key="row.warehouseId">
              <td>
                <strong>{{ row.warehouseId }}</strong>
              </td>
              <td>
                <span class="pill" :class="regionClass(row.region)">{{
                  row.regionLabel
                }}</span>
              </td>
              <td>
                <b>{{ row.stateCode || '-' }}</b>
                <small>{{
                  [row.city || '-', row.subRegionLabel]
                    .filter(Boolean)
                    .join(' / ')
                }}</small>
              </td>
              <td>{{ bestEstimate(row)?.mode || '-' }}</td>
              <td>
                <strong>{{
                  bestEstimate(row) ? daysLabel(bestEstimate(row)!) : '-'
                }}</strong>
              </td>
              <td>
                <span
                  v-if="bestEstimate(row)"
                  class="risk"
                  :class="riskClass(bestEstimate(row)!.risk)"
                >
                  {{ bestEstimate(row)!.riskLabel }}
                </span>
                <span v-else>-</span>
              </td>
              <td>
                {{ bestEstimate(row) ? vendorLabel(bestEstimate(row)!) : '-' }}
              </td>
              <td>{{ row.recommendation }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.location-page {
  min-height: 100vh;
  padding: 32px 22px 48px;
  color: #172235;
  background: linear-gradient(105deg, #f8fbf6 0%, #eef7f3 58%, #f7fbff 100%);
}

.hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  max-width: 1240px;
  margin: 0 auto 26px;
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 800;
  color: #177c68;
  text-transform: uppercase;
  letter-spacing: 2px;
}

h1 {
  margin: 0;
  font-size: 48px;
  line-height: 1.06;
}

h1 span {
  color: #ff6a3d;
}

.subline {
  margin: 14px 0 0;
  color: #718093;
}

.workspace,
.results {
  display: grid;
  gap: 18px;
  max-width: 1240px;
  margin: 0 auto 18px;
}

.workspace {
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
}

.query-panel,
.region-panel,
.results {
  padding: 18px;
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(210 226 221 / 90%);
  border-radius: 8px;
  box-shadow: 0 18px 44px rgb(42 73 62 / 10%);
}

.panel-title,
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title span,
.result-head span {
  font-size: 12px;
  color: #8390a0;
}

textarea {
  width: 100%;
  height: 168px;
  padding: 14px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 15px;
  line-height: 1.7;
  color: #172235;
  resize: vertical;
  outline: none;
  background: #fbfdfc;
  border: 1px solid #d9e6e2;
  border-radius: 6px;
}

textarea:focus {
  border-color: #4fa991;
  box-shadow: 0 0 0 3px rgb(79 169 145 / 16%);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

button {
  height: 36px;
  padding: 0 14px;
  font-weight: 700;
  color: #172235;
  cursor: pointer;
  background: white;
  border: 1px solid #dbe5e2;
  border-radius: 6px;
}

button.primary {
  color: white;
  background: #172235;
  border-color: #172235;
}

button:disabled {
  cursor: default;
  opacity: 0.82;
}

.error {
  padding: 10px 12px;
  margin: 12px 0 0;
  color: #b42318;
  background: #fff0f0;
  border-radius: 6px;
}

.region-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.region-card {
  min-height: 94px;
  padding: 14px;
  background: #f7faf8;
  border-radius: 8px;
}

.region-card strong,
.region-card span,
.region-card b {
  display: block;
}

.region-card span {
  margin-top: 6px;
  font-size: 12px;
  color: #778494;
}

.region-card b {
  margin-top: 10px;
  font-size: 24px;
  color: #ff6a3d;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
}

th {
  padding: 12px;
  font-size: 12px;
  font-weight: 800;
  color: #697789;
  text-align: left;
  background: #f3f7f5;
}

td {
  padding: 14px 12px;
  vertical-align: middle;
  border-top: 1px solid #eef2f1;
}

td small {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: #7f8b9a;
}

.pill,
.risk {
  display: inline-block;
  min-width: 52px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
  border-radius: 999px;
}

.region-west {
  color: #136f5d;
  background: #e8f4f1;
}

.region-central {
  color: #9a5b00;
  background: #fff5dd;
}

.region-east {
  color: #4653a8;
  background: #eef2ff;
}

.region-south {
  color: #b84a1b;
  background: #fff0e8;
}

.region-unknown {
  color: #667085;
  background: #f2f4f7;
}

.risk-low {
  color: #16794c;
  background: #e7f6ef;
}

.risk-medium {
  color: #a45b00;
  background: #fff4dc;
}

.risk-high {
  color: #b42318;
  background: #ffe9e5;
}

@media (max-width: 920px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 36px;
  }
}
</style>
