import type { AdCvrOptimizationScope } from '#/api/kanban/ad-cvr-optimization';
import type { AdCvrOptimizationExecutionResult } from '#/api/kanban/types';

import { computed, readonly, ref } from 'vue';

import { notification } from 'ant-design-vue';

import { executeAdCvrOptimizationSuggestions } from '#/api/kanban/ad-cvr-optimization';

type ExecutionPhase = 'executing' | 'idle' | 'submitting';

const executionNotificationKey = 'ad-cvr-optimization-execution';
const executionPhase = ref<ExecutionPhase>('idle');
const executionRevision = ref(0);

export const adCvrExecutionPhase = readonly(executionPhase);
export const adCvrExecutionRevision = readonly(executionRevision);
export const adCvrExecutionInProgress = computed(
  () => executionPhase.value !== 'idle',
);

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function showExecuting(count: number) {
  executionPhase.value = 'executing';
  notification.info({
    description: `领星正在逐条处理 ${count} 条建议。可切换其他页面，请勿关闭或刷新浏览器；中断后先核对结果。`,
    duration: 0,
    key: executionNotificationKey,
    message: '执行中',
    placement: 'topRight',
  });
}

export async function runAdCvrExecutionTask(
  suggestionIds: string[],
  budgetAdjustments: Record<string, number>,
  scope: AdCvrOptimizationScope = 'legacy',
  bidAdjustments: Record<string, number> = {},
  matchTypeAdjustments: Record<
    string,
    { cpc: number; groupName: string; matchType: 'broad' | 'exact' | 'phrase' }
  > = {},
  negativeAdjustments: Record<
    string,
    {
      matchType?: 'negativeExact' | 'negativePhrase';
      scope: 'ad_group' | 'campaign';
    }
  > = {},
): Promise<AdCvrOptimizationExecutionResult> {
  if (executionPhase.value !== 'idle') {
    throw new Error('已有广告优化任务正在执行，请等待当前任务完成');
  }

  const count = suggestionIds.length;
  executionPhase.value = 'submitting';
  notification.info({
    description: `正在提交 ${count} 条广告优化建议，请勿重复提交。`,
    duration: 0,
    key: executionNotificationKey,
    message: '提交中',
    placement: 'topRight',
  });

  const executingTimer = globalThis.setTimeout(() => showExecuting(count), 450);

  try {
    const result = await executeAdCvrOptimizationSuggestions(
      suggestionIds,
      budgetAdjustments,
      scope,
      bidAdjustments,
      matchTypeAdjustments,
      negativeAdjustments,
    );
    globalThis.clearTimeout(executingTimer);
    if (executionPhase.value === 'submitting') showExecuting(count);

    if (result.failed > 0 || (result.needsReview || 0) > 0) {
      notification.warning({
        description:
          result.message ||
          '部分建议未完成，请查看执行状态；待核对的建议不可重复提交。',
        duration: 0,
        key: executionNotificationKey,
        message:
          (result.needsReview || 0) > 0
            ? '执行结果待核对'
            : '执行完成，部分失败',
        placement: 'topRight',
      });
    } else {
      notification.success({
        description: result.message || '广告优化建议已写入领星广告账户。',
        duration: 10,
        key: executionNotificationKey,
        message: '执行完成',
        placement: 'topRight',
      });
    }
    return result;
  } catch (error) {
    globalThis.clearTimeout(executingTimer);
    notification.error({
      description: `${errorText(error)}。未收到完整结果不代表未执行，请刷新清单并核对领星结果，勿直接重复提交。`,
      duration: 0,
      key: executionNotificationKey,
      message: '未收到完整执行结果',
      placement: 'topRight',
    });
    throw error;
  } finally {
    executionPhase.value = 'idle';
    executionRevision.value += 1;
  }
}
