import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: $t('page.dashboard.title'),
    },
    name: 'Dashboard',
    path: '/dashboard',
    children: [
      {
        name: 'Analytics',
        path: '/analytics',
        component: () => import('#/views/dashboard/analytics/index.vue'),
        meta: {
          affixTab: true,
          authority: ['kanban:analytics'],
          icon: 'lucide:area-chart',
          title: $t('page.dashboard.analytics'),
        },
      },
      {
        name: 'DashboardNetProfit',
        path: '/net-profit',
        component: () => import('#/views/kanban/net-profit/index.vue'),
        meta: {
          authority: ['super'],
          icon: 'lucide:landmark',
          title: '财务看板',
        },
      },
    ],
  },
];

export default routes;
