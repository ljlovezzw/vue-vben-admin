import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:wrench',
      order: 2,
      title: '工具',
    },
    name: 'Tools',
    path: '/tools',
    redirect: '/tools/upload',
    children: [
      {
        name: 'UploadTool',
        path: 'upload',
        component: () => import('#/views/kanban/tools/upload/index.vue'),
        meta: {
          icon: 'lucide:package-open',
          title: '图片打包工具',
        },
      },
      {
        name: 'KeywordReverseTool',
        path: 'keyword-reverse',
        component: () =>
          import('#/views/kanban/tools/keyword-reverse/index.vue'),
        meta: {
          icon: 'lucide:search',
          title: '关键词反查',
        },
      },
      {
        name: 'SearchTermReportTool',
        path: 'search-term-report',
        component: () =>
          import('#/views/kanban/tools/search-term-report/index.vue'),
        meta: {
          icon: 'lucide:file-spreadsheet',
          title: '搜索词报告词库',
        },
      },
    ],
  },
];

export default routes;
