import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'KanbanAsin360',
    path: '/kanban/asin360',
    component: () => import('#/views/kanban/asin360/index.vue'),
    meta: {
      hideInMenu: true,
      hideInTab: true,
      noBasicLayout: true,
      title: 'ASIN360',
    },
  },
];

export default routes;
