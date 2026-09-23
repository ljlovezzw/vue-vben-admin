import type { AdCvrTaskPackageDetail } from '#/api/kanban/ad-cvr-optimization';

import { describe, expect, it } from 'vitest';

import {
  taskBatchCandidates,
  taskExecutionBlockReason,
  taskSelectionBlockReason,
} from './task-selection';

type TaskRow = AdCvrTaskPackageDetail['items'][number];
const row = (id: string, extra: Partial<TaskRow> = {}) =>
  ({
    suggestion_id: id,
    level: 'color',
    action_type: 'close_color',
    execution_status: 'not_requested',
    decision_status: 'pending',
    metrics: {},
    ...extra,
  }) as TaskRow;

describe('task judgment selection', () => {
  it('allows selecting pending rows without permitting execution', () => {
    const pending = row('pending');
    expect(taskSelectionBlockReason(pending)).toBe('');
    expect(taskExecutionBlockReason(pending)).toBe('请先采纳或修改建议');
  });

  it('keeps adopted selections eligible when details are refreshed', () => {
    const adopted = row('adopted', { task_decision: 'adopt' });
    expect(taskSelectionBlockReason(adopted)).toBe('');
    expect(taskExecutionBlockReason(adopted)).toBe('');
  });

  it('allows observing or reviewing non-executable rows, never submits them', () => {
    for (const extra of [
      { action_type: 'fix_listing' },
      { metrics: { data_complete: false } },
      { task_decision: 'observe' as const },
      { task_decision: 'retain' as const },
      { task_decision: 'ignore' as const },
    ]) {
      const item = row('review', extra);
      expect(taskSelectionBlockReason(item)).toBe('');
      expect(taskExecutionBlockReason(item)).not.toBe('');
    }
  });

  it.each(['queued', 'running', 'succeeded', 'needs_review'])(
    'blocks %s rows',
    (status) => {
      expect(
        taskSelectionBlockReason(
          row('busy', { execution_status: status } as Partial<TaskRow>),
        ),
      ).not.toBe('');
    },
  );

  it('does not reselect a failed row with uncertain writes', () => {
    expect(
      taskSelectionBlockReason(
        row('failed', {
          execution_status: 'failed',
          execution_has_write: true,
        }),
      ),
    ).not.toBe('');
    expect(
      taskSelectionBlockReason(
        row('failed', {
          execution_status: 'failed',
          execution_has_write: false,
        }),
      ),
    ).toBe('');
  });

  it('honors the selected subset without falling back to unrelated rows or pages', () => {
    const first = row('a');
    const page = [first, row('b')];
    expect(
      taskBatchCandidates(page, [first, row('other-page')], 'color').map(
        (r) => r.suggestion_id,
      ),
    ).toEqual(['a']);
    expect(taskBatchCandidates(page, [row('other-page')], 'color')).toEqual([]);
    expect(
      taskBatchCandidates(
        page,
        [row('other-stage', { level: 'target' })],
        'color',
      ),
    ).toEqual([]);
    expect(
      taskBatchCandidates(
        page,
        [row('adopted', { task_decision: 'adopt' })],
        'color',
      ),
    ).toEqual([]);
    expect(taskBatchCandidates(page, [], 'color')).toEqual(page);
  });
});
