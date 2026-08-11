import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['kanban:shipping'],
      icon: 'lucide:warehouse',
      order: 1,
      title: '仓库',
    },
    name: 'Warehouse',
    path: '/warehouse',
    redirect: '/kanban/shipping',
    children: [
      {
        name: 'KanbanShipping',
        path: '/kanban/shipping',
        component: () => import('#/views/kanban/shipping/index.vue'),
        meta: {
          authority: ['kanban:shipping'],
          icon: 'lucide:truck',
          title: '发货分配',
        },
      },
    ],
  },
];

export default routes;
