import { describe, expect, it } from 'vitest';

import {
  hierarchyRequestParams,
  matchingHierarchyKeys,
  normalizeHierarchyKeys,
  searchHierarchy,
} from './hierarchy-picker';

const group = { key: '["S1","p1","c1","g1"]', title: '目标广告组' };
const campaign = { key: '["S1","p1","c1"]', title: '活动', children: [group] };
const tree = [{ key: '["S1"]', title: 'S1', children: [campaign] }];
describe('sPU hierarchy picker', () => {
  it('follows every business filter without narrowing itself to the selected branch', () => {
    const filters = {
      actions: ['close_campaign'],
      countries: ['DE'],
      departments: ['亚马逊一部'],
      hierarchyPaths: ['["S1"]'],
      levels: ['campaign'],
      page: 4,
      pageSize: 50,
      responsibles: ['谢玉燕'],
      responsePart: 'rows',
      selectedOnly: true,
      severities: ['high'],
      snapshotDate: '2026-09-02',
      sortField: 'spend',
      sortOrder: 'descend',
      statuses: ['pending'],
    };
    expect(hierarchyRequestParams(filters)).toEqual({
      actions: ['close_campaign'],
      countries: ['DE'],
      departments: ['亚马逊一部'],
      levels: ['campaign'],
      responsibles: ['谢玉燕'],
      selectedOnly: true,
      severities: ['high'],
      snapshotDate: '2026-09-02',
      statuses: ['pending'],
    });
    expect(filters.hierarchyPaths).toEqual(['["S1"]']);
  });
  it('invalidates the scope key when any formerly ignored filter changes', () => {
    const filters = { actions: [], levels: [], severities: [], statuses: [] };
    const before = JSON.stringify(hierarchyRequestParams(filters));
    for (const field of Object.keys(filters)) {
      expect(
        JSON.stringify(
          hierarchyRequestParams({ ...filters, [field]: ['changed'] }),
        ),
      ).not.toBe(before);
    }
    expect(hierarchyRequestParams({ ...filters, page: 2 })).toEqual(
      hierarchyRequestParams(filters),
    );
  });
  it('collapses covered descendants without merging other accounts', () => {
    expect(
      normalizeHierarchyKeys([campaign.key, group.key, '["S1","p2","c1"]']),
    ).toEqual([campaign.key, '["S1","p2","c1"]']);
  });
  it('retains the ancestor path when searching a group', () => {
    expect(searchHierarchy(tree, '目标广告组')).toEqual(tree);
    expect(searchHierarchy(tree, '不存在')).toEqual([]);
  });
  it('selects matching groups, not their unrelated SPU siblings', () => {
    expect(matchingHierarchyKeys(tree, '目标广告组')).toEqual([group.key]);
    expect(matchingHierarchyKeys(tree, '')).toEqual(['["S1"]']);
  });
});
