import type { AdCvrOptimizationSuggestion } from '#/api/kanban/types';

import { describe, expect, it } from 'vitest';

import { executionBlockReason, readBatchContexts } from './batch-selection';

const row = (id: string, extra: Partial<AdCvrOptimizationSuggestion> = {}) =>
  ({
    suggestion_id: id,
    action_type: 'close_target',
    execution_status: '',
    decision_status: 'pending',
    profile_id: 'p',
    campaign_id: 'c',
    ad_group_id: 'g',
    metrics: {},
    orders: 0,
    ...extra,
  }) as AdCvrOptimizationSuggestion;

describe('batch selection', () => {
  it('reads live references with at most three requests and preserves order', async () => {
    let active = 0;
    let peak = 0;
    const result = await readBatchContexts([1, 2, 3, 4, 5], async (item) => {
      peak = Math.max(peak, ++active);
      await Promise.resolve();
      active--;
      return item * 2;
    });
    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(3);
  });
  it('stops the next read batch on any failed reference', async () => {
    const seen: number[] = [];
    await expect(
      readBatchContexts([1, 2, 3, 4], async (item) => {
        seen.push(item);
        if (item === 2) throw new Error('missing live bid');
        return item;
      }),
    ).rejects.toThrow('missing live bid');
    expect(seen).toEqual([1, 2, 3]);
  });
  it('blocks uncertain writes, incomplete data, human advice and converting negatives', () => {
    for (const extra of [
      { execution_status: 'needs_review' },
      { execution_status: 'running' },
      { execution_status: 'failed', execution_has_write: true },
      { action_type: 'fix_listing' },
      { metrics: { data_complete: false } },
      { action_type: 'negative_keyword', orders: 1 },
    ])
      expect(executionBlockReason(row('x', extra))).not.toBe('');
    expect(
      executionBlockReason(
        row('x', { execution_status: 'failed', execution_has_write: false }),
      ),
    ).toBe('');
  });
});
