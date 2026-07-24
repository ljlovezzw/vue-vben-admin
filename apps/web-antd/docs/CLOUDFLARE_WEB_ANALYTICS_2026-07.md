# Cloudflare Web Analytics 性能分析与优化

## 1. 报告范围

- 报告时间：2026-07-13 17:46 至 2026-07-14 17:46（GMT+8）。
- 重点页面：`/analytics`、`/auth/login`、`/tools/search-term-report`、`/`、`/tools/upload-tool.html`。

## 2. 报告结论

| 指标 | 良好 | 需改进 | 较差 |      P50 |       P75 |       P90 |       P99 |
| ---- | ---: | -----: | ---: | -------: | --------: | --------: | --------: |
| LCP  |  21% |    13% |  67% | 9,080 ms | 23,184 ms | 47,748 ms | 64,488 ms |
| INP  | 100% |     0% |   0% |        - |         - |         - |         - |
| CLS  |  90% |     3% |   8% |        - |         - |         - |         - |

交互性能正常，主要问题是首屏资源交付和异步数据返回后的布局稳定性。

CLS 主要来源：

1. `/analytics` 的 `.top-board`，单次 CLS 最高为 `0.457`。
2. 图片打包工具的主内容 `.panel`，单次 CLS 为 `0.291`。
3. Ant Design 表格滚动体 `.ant-table-body`，单次 CLS 为 `0.206`。

## 3. 根因

### 3.1 静态资源请求过碎

生产冷启动会加载约 90 个资源。入口脚本压缩后约 84 KB，但大量小模块需要分别建立请求、等待 Cloudflare 和本地源站，耗时主要在请求排队和首字节，而不是文件下载体积。

### 3.2 正式环境使用 Vite Preview

`hub.junlee.top` 原来通过 Cloudflare Tunnel 指向 `127.0.0.1:5667` 的 `vite preview`。它适合构建结果预览，不适合作为正式静态资源服务器，也没有按哈希资源和 HTML 分别配置缓存。

### 3.3 构建目录长期未清理

原配置为 `emptyOutDir: false`。检查时 `dist/js` 已累计 2,786 个文件、约 62 MB，其中大量是旧哈希文件。虽然浏览器不会一次加载全部旧文件，但会扩大部署目录、压缩包和缓存维护成本。

### 3.4 首屏区域没有预留最终高度

运营负责人卡片高度为 344 px，但总览网格第二、三行原来只按 128 px 起算。接口返回后卡片会撑高整个 `.top-board`。表格空态和有数据状态也没有保持一致高度。

## 4. 已实施优化

1. 保留 Rolldown 默认的业务路由懒加载，不做跨入口 vendor 重组；把每次启动必需的 `bootstrap`、Tippy 和 Motion 改为静态导入，让浏览器从首轮模块图并行加载核心资源。
2. 生产构建开启 gzip，供 Nginx `gzip_static` 直接返回。
3. 恢复干净构建，并通过 `dist-production/blue`、`dist-production/green` 两个固定目录切换版本；非活跃目录作为回滚版本。
4. Nginx 在 5668 提供正式静态站点：哈希 JS/CSS 缓存一年且标记 `immutable`，HTML 和运行时配置禁止缓存，SPA 路由回退到 `index.html`。
5. `/analytics` 顶部指标行按卡片真实内容自适应高度，负责人区域和报表滚动体保留稳定高度；数据来源标签限制宽度，防止文本变化引起工具栏换行。顶部指标行不能锁成固定高度，否则广告卡片的 6 个对比项会覆盖下方负责人区域。
6. 图片工具的默认组件由多次渲染改为一次性渲染，减少初始化期间的 DOM 重排。

## 5. 发布与回滚

正式发布：

```powershell
powershell -ExecutionPolicy Bypass -File apps/web-antd/deploy/deploy-production.ps1
C:\Windows\nginx\nginx.exe -t
C:\Windows\nginx\nginx.exe -s reload
```

部署脚本只清理 `apps/web-antd/dist-production` 下即将写入的非活跃槽位，不会删除工作区其他文件。成功后：

- 两个版本槽位：`dist-production/blue`、`dist-production/green`
- 活跃版本记录：`dist-production/active-root.conf`

回滚到另一个槽位：

```powershell
powershell -ExecutionPolicy Bypass -File apps/web-antd/deploy/deploy-production.ps1 -Rollback
```

## 6. 验证结果

在禁用浏览器缓存的同一正式域名环境下：

| 场景             | 资源请求 |    传输量 |       FCP |   完整加载 |
| ---------------- | -------: | --------: | --------: | ---------: |
| 默认动态启动依赖 |    约 90 | 约 507 KB | 约 2.2 秒 | 超过 20 秒 |
| 静态必需启动依赖 |       39 | 约 491 KB | 约 2.2 秒 |  约 4.9 秒 |

单包候选虽然只有 7 个请求，但入口 gzip 达到约 1.16 MB，完整加载约 21 秒，因此未采用。

## 7. 后续观测

Cloudflare Web Analytics 是真实用户数据，发布后至少观察 24 小时，再用 7 天窗口判断结果。验收目标：

- LCP 良好占比不低于 75%，P75 小于 2.5 秒。
- CLS 良好占比不低于 95%，P75 小于 0.1。
- 静态哈希资源正常请求应返回长期缓存；Cloudflare 命中状态逐步由 `REVALIDATED` 转为 `HIT`。
- `/analytics` 接口慢查询仍需单独治理，静态资源优化不能掩盖 4 至 15 秒的后端查询。
