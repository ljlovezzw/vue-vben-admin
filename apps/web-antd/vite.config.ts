import process from 'node:process';

import { defineConfig } from '@vben/vite-config';

import { loadEnv } from 'vite';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget =
    env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8002';

  return {
    application: {},
    vite: {
      build: {
        // Production serves this directory directly; keep previous hashed assets
        // available until the new index and chunks have finished writing.
        emptyOutDir: false,
      },
      server: {
        allowedHosts: ['hub.junlee.top'],
        proxy: {
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
