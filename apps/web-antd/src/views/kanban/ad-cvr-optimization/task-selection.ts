import type { AdCvrTaskPackageDetail } from '#/api/kanban/ad-cvr-optimization';

import { executionBlockReason } from './batch-selection';

type TaskRow = AdCvrTaskPackageDetail['items'][number];

// Selection is for judgment first; it must not imply consent to execute.
export function taskSelectionBlockReason(row: TaskRow) {
  if (row.task_state?.inheritedFrom) return '已继承父级关闭，无需重复处理';
  if (row.task_state?.suppressedReason) return row.task_state.suppressedReason;
  if (
    row.execution_has_write ||
    !['failed', 'not_requested'].includes(row.execution_status)
  )
    return '已提交或已有广告写入，请在执行中心核对回执';
  return '';
}

export function taskExecutionBlockReason(row: TaskRow) {
  return (
    taskSelectionBlockReason(row) ||
    row.task_state?.invalidatedReason ||
    (['adopt', 'modify'].includes(row.task_decision || '')
      ? ''
      : '请先采纳或修改建议') ||
    executionBlockReason(row)
  );
}

export function taskBatchCandidates(
  page: TaskRow[],
  selected: TaskRow[],
  stage: string,
) {
  const selectedIds = new Set(selected.map((row) => row.suggestion_id));
  return page
    .filter(
      (row) => selected.length === 0 || selectedIds.has(row.suggestion_id),
    )
    .filter(
      (row) =>
        row.level === stage &&
        !row.task_decision &&
        !taskSelectionBlockReason(row),
    );
}
