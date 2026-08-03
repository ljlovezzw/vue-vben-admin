import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:kanban-square',
      order: 0,
      title: '运营看板',
    },
    name: 'Kanban',
    path: '/kanban',
    children: [
      {
        name: 'KanbanMonitor',
        path: 'monitor',
        component: () => import('#/views/kanban/monitor/index.vue'),
        meta: {
          affixTab: true,
          authority: ['kanban:monitor'],
          icon: 'lucide:activity',
          title: '新品监控',
        },
      },
      {
        name: 'KanbanAds',
        path: 'ads',
        component: () => import('#/views/kanban/ads/index.vue'),
        meta: {
          authority: ['kanban:ads'],
          icon: 'lucide:badge-dollar-sign',
          title: '广告监控',
        },
      },
      {
        name: 'KanbanTargets',
        path: 'targets',
        component: () => import('#/views/kanban/targets/index.vue'),
        meta: {
          authority: ['kanban:targets'],
          icon: 'lucide:target',
          title: '目标跟踪',
        },
      },
      {
        name: 'KanbanShipping',
        path: 'shipping',
        component: () => import('#/views/kanban/shipping/index.vue'),
        meta: {
          authority: ['kanban:shipping'],
          icon: 'lucide:truck',
          title: '发货分配',
        },
      },
      {
        name: 'KanbanAsin360',
        path: 'asin360',
        component: () => import('#/views/kanban/asin360/index.vue'),
        meta: {
          authority: ['kanban:asin360'],
          icon: 'lucide:scan-search',
          title: 'ASIN360',
        },
      },
    ],
  },
];

export default routes;
