<script setup lang="ts">
import type { NetProfitDashboardData } from '#/api/kanban/types';

import { computed, ref } from 'vue';

import { Col, Row, Segmented, Spin } from 'ant-design-vue';

import CostDriverChart from './CostDriverChart.vue';
import MetricCard from './MetricCard.vue';
import PortfolioMatrix from './PortfolioMatrix.vue';
import RiskAlertPanel from './RiskAlertPanel.vue';
import TrendChart from './TrendChart.vue';
import WaterfallChart from './WaterfallChart.vue';

type CardTone = 'danger' | 'default' | 'info' | 'success' | 'warning';

interface KpiCard {
  note: string;
  title: string;
  tone: CardTone;
  value: string;
}

const props = withDefaults(
  defineProps<{
    data: NetProfitDashboardData | null;
    loading?: boolean;
  }>(),
  { loading: false },
);

const selectedMetric = ref('netProfit');
const metricOptions = [
  { label: '净利润', value: 'netProfit' },
  { label: 'ROI', value: 'roi' },
  { label: '回款', value: 'cashIncome' },
  { label: '投入', value: 'investment' },
];

function formatMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 10_000) return `¥${(value / 10_000).toFixed(2)}万`;
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function thresholdTone(value: number, managementThreshold: number): CardTone {
  if (value < 0) return 'danger';
  if (value < managementThreshold) return 'warning';
  return 'success';
}

function riskTone(value: number): CardTone {
  if (value <= 30) return 'success';
  if (value <= 60) return 'warning';
  return 'danger';
}

const selectedMetrics = computed(() => [selectedMetric.value]);
const highRiskCount = computed(
  () =>
    props.data?.alerts.filter((alert) => alert.severity === 'high').length ?? 0,
);
const kpiCards = computed<KpiCard[]>(() => {
  const kpi = props.data?.kpi;
  const benchmarks = props.data?.benchmarks;
  if (!kpi || !benchmarks) return [];
  return [
    {
      note: '筛选期间累计经营结果',
      title: '净利润',
      tone: kpi.netProfit >= 0 ? 'success' : 'danger',
      value: formatMoney(kpi.netProfit),
    },
    {
      note: `投入 ${formatMoney(kpi.investment)}`,
      title: '投入回报 ROI',
      tone: thresholdTone(kpi.roi, benchmarks.minRoi),
      value: kpi.roi.toFixed(2),
    },
    {
      note: `回款 ${formatMoney(kpi.cashIncome)}`,
      title: '净利率',
      tone: thresholdTone(kpi.profitMargin, benchmarks.minNetMargin),
      value: `${(kpi.profitMargin * 100).toFixed(2)}%`,
    },
    {
      note: '亏损面、低回报与利润缓冲综合评分',
      title: '经营风险',
      tone: riskTone(kpi.riskScore),
      value: `${kpi.riskScore.toFixed(0)} / 100`,
    },
  ];
});
</script>

<template>
  <section class="strategic-dashboard">
    <Spin :spinning="loading">
      <header class="dashboard-header">
        <div>
          <p>经营驾驶舱</p>
          <h2>利润质量与资本效率</h2>
        </div>
        <span>{{ data?.periodLabel ?? '等待数据' }}</span>
      </header>

      <Row :gutter="[12, 12]" class="kpi-grid">
        <Col
          v-for="card in kpiCards"
          :key="card.title"
          :lg="6"
          :sm="12"
          :xs="24"
        >
          <MetricCard
            :loading="loading"
            :note="card.note"
            :title="card.title"
            :tone="card.tone"
            :value="card.value"
          />
        </Col>
      </Row>

      <section class="dashboard-panel trend-panel">
        <header class="panel-header">
          <div>
            <h3>经营趋势</h3>
            <p>
              展示截至筛选期末最近 12 个可用月份，不改变上方 KPI 的筛选口径。
            </p>
          </div>
          <Segmented
            v-model:value="selectedMetric"
            :options="metricOptions"
            size="small"
          />
        </header>
        <TrendChart
          :data="data?.trend ?? null"
          height="350px"
          :loading="loading"
          :selected-metrics="selectedMetrics"
        />
      </section>

      <Row :gutter="[12, 12]" class="dashboard-row">
        <Col :lg="12" :xs="24">
          <section class="dashboard-panel full-height">
            <header class="panel-header">
              <div>
                <h3>利润桥</h3>
                <p>从回款收入逐项解释费用如何侵蚀净利润。</p>
              </div>
            </header>
            <WaterfallChart
              :data="data?.waterfall ?? null"
              height="360px"
              :loading="loading"
            />
          </section>
        </Col>
        <Col :lg="12" :xs="24">
          <section class="dashboard-panel full-height">
            <header class="panel-header">
              <div>
                <h3>利润变动归因</h3>
                <p>区分收入拉动和费用变化对纯利的真实影响。</p>
              </div>
            </header>
            <CostDriverChart
              :data="data?.costDrivers ?? null"
              height="330px"
              :loading="loading"
            />
          </section>
        </Col>
      </Row>

      <Row :gutter="[12, 12]" class="dashboard-row">
        <Col :lg="16" :xs="24">
          <section class="dashboard-panel full-height">
            <header class="panel-header">
              <div>
                <h3>经营组合矩阵</h3>
                <p>
                  按纯利贡献和增长方向分组，识别加码、守成、修复与退出对象。
                </p>
              </div>
            </header>
            <PortfolioMatrix
              :data="data?.portfolio ?? null"
              height="420px"
              :loading="loading"
            />
          </section>
        </Col>
        <Col :lg="8" :xs="24">
          <section class="dashboard-panel full-height">
            <header class="panel-header">
              <div>
                <h3>经营预警</h3>
                <p>只展示需要管理动作的异常。</p>
              </div>
              <span v-if="highRiskCount" class="risk-count">
                {{ highRiskCount }} 项高风险
              </span>
            </header>
            <RiskAlertPanel :data="data?.alerts ?? null" :loading="loading" />
          </section>
        </Col>
      </Row>
    </Spin>
  </section>
</template>

<style scoped>
.strategic-dashboard {
  width: 100%;
  color: #27364a;
}

.dashboard-header {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 2px 2px 14px;
}

.dashboard-header p,
.dashboard-header h2,
.panel-header h3,
.panel-header p {
  margin: 0;
}

.dashboard-header p {
  font-size: 11px;
  font-weight: 700;
  color: #2563eb;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.dashboard-header h2 {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 800;
  color: #172033;
}

.dashboard-header > span {
  font-size: 12px;
  color: #64748b;
}

.kpi-grid {
  margin-bottom: 12px;
}

.dashboard-panel {
  padding: 14px;
  background: #fff;
  border: 1px solid #d8e1ec;
  border-radius: 6px;
}

.dashboard-row,
.trend-panel {
  margin-bottom: 12px;
}

.full-height {
  height: 100%;
}

.panel-header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  min-height: 44px;
  margin-bottom: 8px;
}

.panel-header h3 {
  font-size: 15px;
  font-weight: 800;
  color: #172033;
}

.panel-header p {
  margin-top: 2px;
  font-size: 11px;
  color: #718096;
}

.risk-count {
  flex: none;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  color: #b42318;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
}

@media (width <= 760px) {
  .dashboard-header,
  .panel-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>
