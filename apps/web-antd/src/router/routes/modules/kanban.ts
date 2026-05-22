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
          icon: 'lucide:activity',
          title: '新品监控',
        },
      },
      {
        name: 'KanbanAds',
        path: 'ads',
        component: () => import('#/views/kanban/ads/index.vue'),
        meta: {
          icon: 'lucide:badge-dollar-sign',
          title: '广告监控',
        },
      },
    ],
  },
];

export default routes;
