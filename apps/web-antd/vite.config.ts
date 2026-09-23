import process from 'node:process';

import { defineConfig } from '@vben/vite-config';

import { loadEnv } from 'vite';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget =
    env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8002';
  const christmasApiProxyTarget =
    env.VITE_CHRISTMAS_DEV_API_PROXY_TARGET || 'http://localhost:8003';

  return {
    application: {},
    vite: {
      build: {
        emptyOutDir: true,
      },
      server: {
        allowedHosts: ['hub.junlee.top'],
        proxy: {
          '/api/kanban/christmas-calendar': {
            changeOrigin: true,
            rewrite: (requestPath) => requestPath.replace(/^\/api/, ''),
            target: christmasApiProxyTarget,
          },
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            target: apiProxyTarget,
            ws: true,
          },
        },
      },
    },
  };
});
