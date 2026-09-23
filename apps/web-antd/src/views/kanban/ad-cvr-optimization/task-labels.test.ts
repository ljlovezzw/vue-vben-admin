import { expect, it } from 'vitest';

import { taskDecisionLabel } from './task-labels';

it('distinguishes an undone decision from a record with no decision', () => {
  expect(taskDecisionLabel('pending')).toBe('撤销判断');
  expect(taskDecisionLabel(null)).toBe('尚未判断');
  expect(taskDecisionLabel('retain')).toBe('保留现状');
});
