import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        allowedHosts: ['hub.junlee.top'],
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // 开发环境代理到本机 FastAPI；公网访问 hub.junlee.top 时也由 Vite 转发到本机 8001
            target: 'http://localhost:8001',
            ws: true,
          },
        },
      },
    },
  };
});
