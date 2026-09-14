import type { AdCvrHierarchyNode } from '#/api/kanban/ad-cvr-optimization';

export function hierarchyRequestParams(filters: Record<string, unknown>) {
  // Keep the list's business filters. Only exclude this picker's own value
  // and presentation parameters, so users can still choose another branch.
  const excluded = new Set([
    'hierarchyPaths',
    'page',
    'pageSize',
    'responsePart',
    'sortField',
    'sortOrder',
  ]);
  return Object.fromEntries(
    Object.entries(filters).filter(([key]) => !excluded.has(key)),
  );
}

export function normalizeHierarchyKeys(keys: string[]) {
  const paths = [...new Set(keys)].map((key) => ({
    key,
    path: JSON.parse(key) as string[],
  }));
  return paths
    .filter(
      ({ path }) =>
        !paths.some(
          (parent) =>
            parent.path.length < path.length &&
            parent.path.every((part, index) => part === path[index]),
        ),
    )
    .map(({ key }) => key);
}

export function searchHierarchy(
  nodes: AdCvrHierarchyNode[],
  search: string,
): AdCvrHierarchyNode[] {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return nodes;
  return nodes.flatMap((node) => {
    if (`${node.title} ${node.key}`.toLocaleLowerCase().includes(term))
      return [node];
    const children = searchHierarchy(node.children ?? [], term);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

export function matchingHierarchyKeys(
  nodes: AdCvrHierarchyNode[],
  search: string,
): string[] {
  const term = search.trim().toLocaleLowerCase();
  return nodes.flatMap((node) =>
    !term || `${node.title} ${node.key}`.toLocaleLowerCase().includes(term)
      ? [node.key]
      : matchingHierarchyKeys(node.children ?? [], term),
  );
}
