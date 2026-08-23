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
          title: '圣诞款发货看板与分配',
        },
      },
      {
        name: 'KanbanShippingLocationFinder',
        path: '/kanban/shipping/location-finder',
        component: () => import('#/views/kanban/shipping-location/index.vue'),
        meta: {
          authority: ['kanban:shipping'],
          icon: 'lucide:map-pinned',
          title: '美国东西中部仓库代码查询',
        },
      },
    ],
  },
];

export default routes;
