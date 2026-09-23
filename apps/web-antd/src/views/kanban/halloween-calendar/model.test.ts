import type {
  HalloweenInventoryRecord,
  HalloweenRow,
} from '#/api/kanban/halloween-calendar';

import { describe, expect, it } from 'vitest';

import {
  aggregate,
  DEFAULT_OWNER_SCOPE,
  groupsFor,
  inventoryFor,
  matchesOwnerScope,
  pending,
  stockText,
} from './model';

const record = {
  id: 1,
  available: 113,
  sellable: 0,
  total: 197,
  sites: ['CA', 'US'],
} as HalloweenInventoryRecord;
const row = {
  id: 'LLW000742|CA',
  site: 'CA',
  owner: '当前负责人',
  category: 'bodystocking',
  target: 100,
  actual: 10,
  due: 50,
  comparable: true,
  kind: 'stock',
  inventory: { rows: 1, ids: [1], available: 113, sellable: 0, total: 197 },
} as HalloweenRow;

describe('halloween calendar business summaries', () => {
  it('deduplicates shared physical stock across site rows', () => {
    const rows = [row, { ...row, id: 'LLW000742|US', site: 'US' }];
    expect(inventoryFor(rows, [record])).toHaveLength(1);
    expect(aggregate(rows, [record]).available).toBe(113);
    expect(aggregate(rows, [record]).target).toBe(200);
  });
  it('uses matching complete sales and targets in every group dimension', () => {
    const rows = [
      row,
      { ...row, target: null, actual: 300, comparable: false },
    ];
    expect(aggregate(rows, [record])).toMatchObject({
      target: 100,
      actual: 10,
      rate: 0.1,
      comparable: 1,
    });
    for (const key of ['site', 'owner', 'category'] as const) {
      expect(groupsFor(rows, [record], key)[0]?.summary.rate).toBe(0.1);
    }
  });
  it('distinguishes zero sellable from missing available inventory', () => {
    expect(stockText(row)).toBe('113');
    expect(stockText(row, 'sellable')).toBe('0');
    expect(
      stockText({ ...row, inventory: { ...row.inventory, available: null } }),
    ).toBe('待核对');
    expect(
      aggregate([row], [{ ...record, available: null }]).available,
    ).toBeNull();
  });
  it('keeps confirmed products in the full list while removing their pending action', () => {
    const confirmed = { ...row, confirmedAt: '2026-09-21 14:00:00' };
    expect(pending(confirmed, 'all')).toBe(true);
    expect(pending(confirmed, 'stock')).toBe(false);
    expect(pending(confirmed, 'action')).toBe(false);
    expect(aggregate([confirmed], [record]).stock).toBe(0);
  });
});

describe('halloween owner defaults', () => {
  it('defaults to self/team without treating missing personal rows as all', () => {
    expect(
      matchesOwnerScope('本人', DEFAULT_OWNER_SCOPE, ['本人', '组员']),
    ).toBe(true);
    expect(
      matchesOwnerScope('组员', DEFAULT_OWNER_SCOPE, ['本人', '组员']),
    ).toBe(true);
    expect(
      matchesOwnerScope('同部门同事', DEFAULT_OWNER_SCOPE, ['本人', '组员']),
    ).toBe(false);
    expect(matchesOwnerScope('同部门同事', DEFAULT_OWNER_SCOPE, [])).toBe(
      false,
    );
  });
  it('allows explicit all or individual selection within the server department scope', () => {
    expect(matchesOwnerScope('同部门同事', '', ['本人'])).toBe(true);
    expect(matchesOwnerScope('同部门同事', '同部门同事', ['本人'])).toBe(true);
    expect(matchesOwnerScope('本人', '同部门同事', ['本人'])).toBe(false);
  });
});
