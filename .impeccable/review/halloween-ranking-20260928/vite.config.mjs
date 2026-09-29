import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
const here=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root:here,
  plugins:[vue(),{name:'readonly-fixture',configureServer(server){server.middlewares.use('/qa-data',(_req,res)=>{res.setHeader('Content-Type','application/json');res.end(fs.readFileSync('E:/kanban-release/halloween-ranking-data.json'));});}}],
  resolve:{alias:{'#/api/kanban/halloween-calendar':path.join(here,'mock-api.ts')}},
  server:{host:'127.0.0.1',port:8772,strictPort:true,fs:{allow:['E:/desktop/vue-vben-admin']}},
});
