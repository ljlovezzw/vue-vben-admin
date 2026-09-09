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
        name: 'KanbanDailyAdOptimization',
        path: 'daily-ad-optimization',
        component: () => import('#/views/kanban/ad-cvr-optimization/index.vue'),
        meta: {
          authority: ['kanban:ads'],
          icon: 'lucide:calendar-check-2',
          keepAlive: true,
          title: '今日广告优化',
        },
      },
      {
        name: 'KanbanAdCvrOptimization',
        path: 'ad-cvr-optimization',
        alias: 'ads/cvr-optimization',
        component: () => import('#/views/kanban/ad-cvr-optimization/index.vue'),
        meta: {
          authority: ['kanban:ads'],
          icon: 'lucide:list-checks',
          keepAlive: true,
          title: '广告优化建议',
        },
      },
      {
        name: 'KanbanAdCampaignDetail',
        path: 'ads/campaign-detail/:profileId/:campaignId',
        component: () => import('#/views/kanban/ad-campaign-detail/index.vue'),
        meta: {
          authority: ['kanban:ads'],
          hideInMenu: true,
          keepAlive: true,
          title: '广告活动详情',
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
        name: 'KanbanBeerDressCalendar',
        path: 'beer-dress-calendar',
        component: () => import('#/views/kanban/beer-dress-calendar/index.vue'),
        meta: {
          authority: ['kanban:monitor'],
          icon: 'lucide:calendar-days',
          title: '啤酒服销售日历',
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
