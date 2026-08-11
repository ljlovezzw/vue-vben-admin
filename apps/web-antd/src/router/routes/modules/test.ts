import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['kanban:ads'],
      icon: 'lucide:flask-conical',
      order: 2,
      title: '测试',
    },
    name: 'TestFeatures',
    path: '/test',
    redirect: '/test/ad-automation',
    children: [
      {
        name: 'AdAutomation',
        path: 'ad-automation',
        component: () => import('#/views/test/ad-automation/index.vue'),
        meta: {
          authority: ['kanban:ads'],
          icon: 'lucide:gauge',
          title: '广告自动化',
        },
      },
    ],
  },
];

export default routes;
