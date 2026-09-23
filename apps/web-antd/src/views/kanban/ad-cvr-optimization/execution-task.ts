import type {
  AdCvrBatchTask,
  AdCvrOptimizationScope,
} from '#/api/kanban/ad-cvr-optimization';

import { computed, ref } from 'vue';

import { notification } from 'ant-design-vue';

import {
  fetchAdCvrBatchTask,
  fetchAdCvrBatchTasks,
  submitAdCvrTaskPackage,
} from '#/api/kanban/ad-cvr-optimization';

const executionPhase = ref<'executing' | 'idle' | 'submitting'>('idle');
const key = 'ad-cvr-optimization-execution';
export const adCvrExecutionInProgress = computed(
  () => executionPhase.value !== 'idle',
);

function showTask(task: AdCvrBatchTask) {
  const active = ['queued', 'running'].includes(task.status);
  const config = {
    description: active
      ? `已处理 ${task.completed}/${task.total} 条。后台继续执行，可切换页面；刷新后可从“执行中心”恢复查看。`
      : task.result?.message ||
        task.message ||
        `已处理 ${task.completed}/${task.total} 条，请查看执行中心。`,
    duration: active || task.status !== 'succeeded' ? 0 : 10,
    key,
    message: active
      ? '执行中'
      : (task.status === 'succeeded'
        ? '执行完成'
        : '执行完成，请核对结果'),
    placement: 'topRight' as const,
  };
  if (active) notification.info(config);
  else if (task.status === 'succeeded') notification.success(config);
  else notification.warning(config);
}

async function poll(task: AdCvrBatchTask, scope: AdCvrOptimizationScope) {
  let latest = task;
  let errors = 0;
  while (['queued', 'running'].includes(latest.status)) {
    executionPhase.value = 'executing';
    showTask(latest);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 2000));
    try {
      latest = await fetchAdCvrBatchTask(latest.taskId, scope);
      errors = 0;
    } catch (error) {
      if (++errors >= 5) throw error;
    }
  }
  showTask(latest);
  return latest;
}

function reportError(error: unknown) {
  notification.error({
    description: `${error instanceof Error ? error.message : String(error)}。后台任务可能仍在执行，请从“执行中心”查询，勿直接重复提交。`,
    duration: 0,
    key,
    message: '暂时无法获取执行结果',
    placement: 'topRight',
  });
}

export async function resumeAdCvrExecutionTask(scope: AdCvrOptimizationScope) {
  if (adCvrExecutionInProgress.value) return;
  executionPhase.value = 'submitting';
  try {
    const { tasks } = await fetchAdCvrBatchTasks(scope);
    const task = tasks.find((item) =>
      ['queued', 'running'].includes(item.status),
    );
    if (task) {
      await poll(task, scope);
    }
  } catch (error) {
    reportError(error);
  } finally {
    executionPhase.value = 'idle';
  }
}

export async function runAdCvrTaskPackageExecution(
  payload: Record<string, unknown>,
  scope: AdCvrOptimizationScope,
) {
  if (adCvrExecutionInProgress.value)
    throw new Error('已有广告优化任务正在执行，请等待当前任务完成');
  executionPhase.value = 'submitting';
  notification.info({
    description: '正在提交已预演的任务包动作，请勿重复点击。',
    duration: 0,
    key,
    message: '提交中',
    placement: 'topRight',
  });
  try {
    const task = await submitAdCvrTaskPackage(payload, scope);
    return await poll(task, scope);
  } catch (error) {
    reportError(error);
    throw error;
  } finally {
    executionPhase.value = 'idle';
  }
}
