import type { TablePaginationConfig } from 'ant-design-vue';

import { reactive } from 'vue';

export function useTablePagination(
  pageSize = 10,
  pageSizeOptions: string[] = ['10', '20', '50', '100'],
  showTotal: TablePaginationConfig['showTotal'] = (total) => `共 ${total} 条`,
): TablePaginationConfig {
  const pagination = reactive<TablePaginationConfig>({
    current: 1,
    onChange: (page, size) => {
      pagination.current = page;
      pagination.pageSize = size;
    },
    onShowSizeChange: (_current, size) => {
      pagination.current = 1;
      pagination.pageSize = size;
    },
    pageSize,
    pageSizeOptions,
    showSizeChanger: true,
    showTotal,
  });

  return pagination;
}

export function resetTablePagination(pagination: TablePaginationConfig) {
  pagination.current = 1;
}
