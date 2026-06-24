import type { RouteRecordRaw } from 'vue-router';

const configAuthorities = ['kanban:spus', 'kanban:config'];

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: configAuthorities,
      icon: 'lucide:sliders-horizontal',
      order: 1,
      title: '配置管理',
    },
    name: 'ConfigManagement',
    path: '/config-management',
    redirect: '/kanban/spus',
    children: [
      {
        name: 'KanbanSpus',
        path: '/kanban/spus',
        component: () => import('#/views/kanban/spus/index.vue'),
        meta: {
          authority: ['kanban:spus'],
          icon: 'lucide:boxes',
          title: 'SPU管理',
        },
      },
      {
        name: 'KanbanConfig',
        path: '/kanban/config',
        component: () => import('#/views/kanban/config/index.vue'),
        meta: {
          authority: ['kanban:config'],
          icon: 'lucide:settings',
          title: '配置中心',
        },
      },
    ],
  },
];

export default routes;
