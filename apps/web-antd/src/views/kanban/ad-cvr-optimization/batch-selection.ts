import type { AdCvrOptimizationSuggestion } from '#/api/kanban/types';

export const MAX_BATCH_SELECTION = 200;

// Bound live read concurrency; never use this helper for advertising writes.
export async function readBatchContexts<T, R>(
  items: T[],
  read: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += 3) {
    const batch = await Promise.allSettled(
      items.slice(start, start + 3).map((item) => read(item)),
    );
    for (const item of batch) {
      if (item.status === 'rejected') throw item.reason;
      results.push(item.value);
    }
  }
  return results;
}
export const EXECUTABLE_ACTIONS = new Set([
  'adjust_match_type',
  'close_ad_group',
  'close_campaign',
  'close_color',
  'close_target',
  'decrease_budget',
  'increase_bid',
  'increase_budget',
  'lower_bid',
  'negative_asin',
  'negative_keyword',
]);

export function executionBlockReason(row: AdCvrOptimizationSuggestion) {
  if (!EXECUTABLE_ACTIONS.has(row.action_type)) return '此建议需人工处理';
  if (row.decision_status === 'dismissed') return '已忽略，请先恢复';
  if (
    ['needs_review', 'queued', 'running', 'submitted', 'succeeded'].includes(
      row.execution_status,
    )
  )
    return '已执行、执行中或待核对';
  if (row.execution_status === 'failed' && row.execution_has_write)
    return '已有写入记录，须先核对';
  if (row.metrics?.data_complete === false) return '统计数据不完整';
  if (
    ['negative_asin', 'negative_keyword'].includes(row.action_type) &&
    Number(row.orders) > 0
  )
    return '搜索词已有订单，请复核竞价，不直接否定';
  return '';
}
