import type { RouteRecordRaw } from 'vue-router';

const toolAuthorities = [
  'kanban:monitor',
  'kanban:ads',
  'kanban:targets',
  'kanban:asin360',
  'kanban:spus',
  'kanban:config',
];

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: toolAuthorities,
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
          authority: toolAuthorities,
          icon: 'lucide:package-open',
          title: '图片打包工具',
        },
      },
    ],
  },
];

export default routes;
