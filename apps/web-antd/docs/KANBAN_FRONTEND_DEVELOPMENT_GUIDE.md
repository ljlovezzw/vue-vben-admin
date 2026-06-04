# Kanban 前端开发与进度说明

更新时间：2026-06-02

本文是 Kanban 前端的主要开发入口。新会话优先读取本文，再按任务打开具体页面。后端说明文档位于：

```text
E:\junlee\Kanban\docs\BACKEND_DEVELOPMENT_GUIDE.md
```

## 1. 项目定位

前端仓库：

```text
C:\Users\Administrator\Desktop\vue-vben-admin
```

业务应用：

```text
apps\web-antd
```

这是基于 Vue Vben Admin 的运营看板前端。主要业务页面包括公司经营驾驶舱、新品监控、广告监控、目标跟踪、ASIN360、SPU 管理和配置中心；工具作为与运营看板同级的独立菜单。

技术栈：

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Ant Design Vue
- ECharts / `vue-echarts`
- pnpm workspace

## 2. 本地启动与构建

启动后端：

```powershell
cd E:\junlee\Kanban
python -m uvicorn api_server.main:app --host 0.0.0.0 --port 8001 --reload
```

启动前端：

```powershell
cd C:\Users\Administrator\Desktop\vue-vben-admin
pnpm dev
```

等价的明确命令：

```powershell
pnpm dev:web
```

默认前端端口：

```text
http://localhost:5666
```

开发环境配置：

```text
apps\web-antd\.env.development
apps\web-antd\vite.config.ts
```

开发环境中，浏览器请求 `/api/*` 会由 Vite 转发到：

```text
http://localhost:8001
```

代理会去掉 `/api` 前缀。例如：

```text
前端请求：/api/kanban/monitor/overview
后端路由：/kanban/monitor/overview
```

生产环境 API：

```text
https://api.junlee.top
```

常用验证：

```powershell
cd C:\Users\Administrator\Desktop\vue-vben-admin
pnpm --filter @vben/web-antd run typecheck
pnpm build:web
```

生产构建会生成：

```text
apps\web-antd\dist
apps\web-antd\dist.zip
```

本机运行生产构建产物：

```powershell
pnpm preview:web
```

`preview:web` 会执行 `vite preview --host 0.0.0.0 --port 5666`。如果通过 `https://hub.junlee.top` 映射访问生产构建产物，服务器或反向代理必须做 SPA fallback：所有非静态资源路径回退到 `index.html`，否则 history 模式下刷新 `/kanban/...` 会 404。生产 API 基地址为 `https://api.junlee.top`，后端必须允许该跨域来源并放行 `OPTIONS` 预检。

## 3. 业务目录

```text
apps/web-antd/src/
  api/
    request.ts                  统一请求客户端、Bearer Token、响应解包
    core/auth.ts                登录、飞书登录、权限码
    core/user.ts                当前用户信息
    kanban/index.ts             看板 API 封装
    kanban/types.ts             看板 TypeScript DTO

  router/
    guard.ts                    登录和动态权限路由守卫
    routes/core.ts              登录页、403、根路由
    routes/modules/dashboard.ts 公司经营驾驶舱路由
    routes/modules/kanban.ts    看板业务路由
    routes/modules/tools.ts     工具路由

  store/auth.ts                 登录状态、用户信息、权限码加载

  views/
    dashboard/analytics/        公司经营驾驶舱
    kanban/monitor/             新品监控
    kanban/ads/                 广告监控
    kanban/targets/             目标跟踪
    kanban/asin360/             ASIN360
    kanban/spus/                SPU 管理
    kanban/tools/               工具页
    kanban/config/              配置中心
    kanban/shared/              页面共用辅助
```

## 4. 登录、权限与路由

### 4.1 登录流程

主要文件：

```text
src\api\core\auth.ts
src\api\core\user.ts
src\store\auth.ts
src\router\guard.ts
```

登录流程：

```text
登录页
  -> POST /auth/login 或 POST /auth/feishu-login
  -> 保存 accessToken
  -> GET /user/info
  -> GET /auth/codes
  -> 根据角色和权限码动态生成菜单
  -> 跳转 userInfo.homePath
```

请求客户端会自动添加：

```text
Authorization: Bearer <accessToken>
```

### 4.2 页面权限

| 页面           | 路由              | 权限码             |
| -------------- | ----------------- | ------------------ |
| 公司经营驾驶舱 | `/analytics`      | `kanban:analytics` |
| 新品监控       | `/kanban/monitor` | `kanban:monitor`   |
| 广告监控       | `/kanban/ads`     | `kanban:ads`       |
| 目标跟踪       | `/kanban/targets` | `kanban:targets`   |
| ASIN360        | `/kanban/asin360` | `kanban:asin360`   |
| SPU 管理       | `/kanban/spus`    | `kanban:spus`      |
| 工具           | `/tools/upload`   | 复用看板权限       |
| 配置中心       | `/kanban/config`  | `kanban:config`    |

页面路由的 `meta.authority` 负责菜单和页面可见性；后端仍会再次校验权限，不能只依赖前端。

默认模块权限：

- 所有角色默认拥有 `kanban:analytics`、`kanban:monitor`、`kanban:ads`、`kanban:targets`、`kanban:asin360`，因此默认可见公司经营驾驶舱、新品监控、广告监控、目标跟踪和 ASIN360。
- `operator`、`leader` 的 `permissions_json` 只用于追加默认模块之外的权限，例如 SPU 管理和配置中心。
- `manager`、`admin`、`super` 默认拥有全部模块权限。
- 模块可见性不代表数据全量可见；数据范围仍由后端按登录人负责人范围过滤。

## 5. API 开发流程

看板接口统一放在：

```text
apps\web-antd\src\api\kanban\index.ts
apps\web-antd\src\api\kanban\types.ts
```

新增或修改接口时：

1. 先在后端确认 JSON 结构。
2. 在 `types.ts` 增加或调整 DTO。
3. 在 `index.ts` 增加 API 封装。
4. 页面只调用封装函数，不直接散落 URL。
5. 运行 typecheck 和生产构建。

当前主要封装：

| 前端函数                     | 后端路由                                      |
| ---------------------------- | --------------------------------------------- |
| `fetchAnalyticsOverview`     | `GET /kanban/analytics/overview`              |
| `fetchKanbanOverview`        | `GET /kanban/monitor/overview`                |
| `fetchKanbanProductDetail`   | `GET /kanban/monitor/product-detail`          |
| `fetchSpuDailyMetrics`       | `GET /kanban/monitor/spu-daily`               |
| `fetchAdMonitorOverview`     | `GET /kanban/ads/overview`                    |
| `fetchTargetTrackerOverview` | `GET /kanban/targets/overview`                |
| `fetchAsin360Overview`       | `GET /kanban/asin360/overview`                |
| `fetchAsin360StoreOptions`   | `GET /kanban/asin360/stores`                  |
| `fetchAsin360Section`        | `GET /kanban/asin360/{section}`               |
| `fetchSpuManagerOverview`    | `GET /kanban/spus`                            |
| `fetchSpuManagerOptions`     | `GET /kanban/spus/options`                    |
| `fetchConfigOverview`        | `GET /kanban/config/overview`                 |
| 运营组单独读取               | `GET /kanban/config/operation-groups`         |
| `saveOperationGroup`         | `POST /kanban/config/operation-groups`        |
| `deleteOperationGroup`       | `DELETE /kanban/config/operation-groups/{id}` |

## 6. 页面说明

### 6.1 公司经营驾驶舱 `/analytics`

文件：

```text
src\views\dashboard\analytics\index.vue
```

用途：

- 按站点日期查看公司单日经营情况。
- 展示销量完成率、销售额完成率、销售额、库存、推广费用和广告效率。
- 展示所选日、前一天、上周同日。
- 展示运营组和运营负责人完成情况。

当前口径：

- 历史日期来自数据库 `profitstatement`。
- 当天数据由后端优先调用领星利润表 API。
- 第二个仪表盘是销售额完成率，目标值来自后端按 `operator_targets.target_sales_cny` 折算出的 `dailyTargetSales`。
- 两个完成率仪表盘中心通过 Vue 覆盖层展示具体完成值和完成率百分比：销量图展示实际销量，销售额图展示实际销售额；下方继续展示实际值和日目标。不要依赖 ECharts `detail/graphic` 渲染中心文字。
- 销量和销售额对比卡片展示前一天、上周同日、绝对差值和百分比差异，方便同时判断差了多少和差异比例。
- 运营组完成率使用全量负责人行汇总，负责人明细区域只截取 Top 12 展示，不能反向影响运营组汇总口径。
- 负责人列表仅展示有 US 站点有效销量目标的运营人员。

已完成：

- 按设计图恢复主要布局。
- 统计周期改为可编辑的站点日期。
- 接入运营组筛选。
- 接入毛利润目标与实际值。
- 修复广告费用负数展示口径。

待做：

- 修复后端目标导入重复键后，复核 2026 年 5 月单日目标销量应显示 `2,213`。
- 在浏览器中继续做视觉验收和布局微调。
- 顶部 `02-05` 标签目前仍是占位，后续按业务优先级逐步实现。

### 6.2 新品监控 `/kanban/monitor`

文件：

```text
src\views\kanban\monitor\index.vue
src\views\kanban\monitor\components\
```

用途：

- 查看新品概览、核心 KPI、趋势、漏斗、阶段、类目和行动列表。
- 查看商品明细。
- 下钻单个 SPU 每日指标。

重要原则：

- 生命周期、状态和预警等级由后端 ETL 与快照计算。
- 前端只展示 `lifecycleStage`、`status`、`alertLevel`、`reasonText` 等字段。
- 不要在 Vue 中重新实现阶段规则。
- 大表分页使用 `src\views\kanban\shared\pagination.ts`；主筛选、SPU 搜索、快捷状态、商品明细国家筛选和列配置变化后都回到第一页。
- 顶部主筛选同时刷新概览和商品明细；商品明细页签内的国家筛选只刷新 `GET /kanban/monitor/product-detail`，避免重复请求概览接口。

后端规则说明：

```text
E:\junlee\Kanban\新品周期判断.md
```

### 6.3 广告监控 `/kanban/ads`

文件：

```text
src\views\kanban\ads\index.vue
```

用途：

- 按日期、站点、店铺、类目和负责人查看广告 KPI。
- 展示趋势、类目、负责人、广告类型和 Campaign 分析。

### 6.4 目标跟踪 `/kanban/targets`

文件：

```text
src\views\kanban\targets\index.vue
```

用途：

- 展示年度、季度和月度目标。
- 展示毛利润、Run Rate、挑战目标、负责人矩阵、Top SPU 和亏损 SPU。

注意：

- 目标源自后端 `operator_targets`。
- 当前后端仍有占位 SPU 重复键覆盖问题。
- 前端不应通过临时加减值修正目标。

### 6.5 ASIN360 `/kanban/asin360`

文件：

```text
src\views\kanban\asin360\index.vue
```

用途：

- 查看 Parent ASIN 的概览、订单、广告、子体、库存、利润、售后和日志。
- 支持日期范围、Parent ASIN 和店铺筛选。

最近完成：

- 原 SID 文本输入框改为可搜索、多选的店铺名称下拉。
- 页面展示店铺名称。
- 接口参数继续发送 SID。
- 默认显示 `RSLOVE-US`，提交 SID `1039`。
- 页面包含请求取消、请求版本控制、短期缓存和防抖加载。

### 6.6 SPU 管理 `/kanban/spus`

文件：

```text
src\views\kanban\spus\index.vue
```

用途：

- 查询、新增和修改 SPU。
- 维护负责人和人工字段。

重要权限：

- 受限用户只能查看和分配本人或受管理成员范围内的 SPU。
- 选项列表使用独立接口 `/kanban/spus/options`，不要改回完整配置中心接口。

### 6.7 工具 `/tools`

文件：

```text
src\views\kanban\tools\upload\index.vue
public\tools\upload-tool.html
```

用途：

- 将 `E:\junlee\Kanban\upload-tool.html` 挂入与运营看板同级的工具菜单。
- 当前工具为图片标准命名打包工具，支持 A+ 与品牌故事素材选择、文件名预览、ZIP 下载，以及将生成的 A+ / 品牌故事 ZIP 上传到飞书任务。
- 履约方式在界面隐藏；品牌卡媒体资产默认选择“重命名为 SPU-序号”。
- 在线 Listing 查询完成后，从返回行提取父 ASIN 下拉选项，并按所选父 ASIN 展示对应 ASIN 列表和 Listing 明细。查询前父 ASIN 下拉保留可操作状态，只显示提示项。
- Listing 明细表固定展示：父ASIN、ASIN、图片、MSKU、SKU、品名、店铺、国家、品牌、状态、负责人；Listing 代理当前返回中文列名，图片列优先读取 `图片`，兼容 `small_image_url`、对象、数组、JSON 字符串和 `//` 协议相对地址，并在候选字段未命中时从图片类字段名兜底提取 URL；品牌读取 `亚马逊品牌`，状态 1/true 显示在售，0/false 显示停售。图片加载失败显示空占位。
- 在线 Listing 查询本地开发使用 `/api/lingxing/listing/show-online` 经 Vite proxy 转到本机 FastAPI；非 localhost 环境使用 `https://api.junlee.top/api/lingxing/listing/show-online`。飞书任务上传同样按环境切换，本地使用 `/api/feishu/image-upload-tasks`，线上使用 `https://api.junlee.top/api/feishu/image-upload-tasks`。
- 工具页作为静态 HTML iframe 挂载，不能直接依赖 Vue/Pinia 运行时。`src/views/kanban/tools/upload/index.vue` 负责在 iframe `load` 后通过 `postMessage` 注入当前 `accessToken`，HTML 内部保存到 `state.authToken` 后再调用飞书任务接口；开发环境保留读取 `localStorage['vben-web-antd-core-access']` 的兜底，线上 SecureLS 加密存储不能作为主要取 token 方式。

权限：

- 工具菜单暂不新增后端权限码，前端路由复用现有看板模块权限，避免未配置 `kanban:tools` 时菜单不可见。

### 6.8 配置中心 `/kanban/config`

文件：

```text
src\views\kanban\config\index.vue
```

用途：

- 类目阈值配置。
- 运营人员维护。
- 用户角色、权限码和管理成员维护。
- 运营组维护。
- 登录日志。

重要概念：

- 运营组用于驾驶舱汇总和筛选。
- 运营组不是权限组。
- 不要复用用户的管理成员关系代替运营组。

字段编辑权限：

- `leader` 及以上角色可以进入配置中心。
- `leader` 只能修改自己的组员范围。
- `manager` 可以修改组员范围，不能修改角色、状态和可访问模块。
- `admin` 和 `super` 可以修改角色、状态、可访问模块和组员范围。
- “可访问模块”是否可编辑只取决于当前登录人是否为 `admin/super`，不取决于被编辑用户当前是什么角色。
- 角色变化或飞书登录后如果页面仍显示旧权限，需要重新登录刷新 `/user/info` 和 `/auth/codes`。

当前页面结构：

- 顶部为类目数、上新计划、成品率目标和运营人员汇总。
- `admin/super` 可看到新增类目、新增运营人员、类目阈值和运营组组织架构。
- 飞书用户权限卡片拆成“成员范围维护”和“管理员权限维护”两个页签。
- 成员范围维护支持姓名、邮箱、部门、飞书 ID 搜索，并支持按角色、状态和登录方式过滤。
- `leader` 在成员范围维护页签只看到并保存自己的组员范围；`manager` 可以维护成员范围；`admin/super` 还能进入管理员权限维护页签修改角色、状态和可访问模块。

## 7. 已完成的主要开发

- 从旧页面方案迁移到 Vue Vben Admin。
- 接入 FastAPI 登录、本地账号和飞书登录。
- 增加用户默认首页、403 页面和动态权限菜单。
- 完成新品监控、广告监控、目标跟踪、SPU 管理和配置中心页面。
- 新增公司经营驾驶舱 `/analytics`。
- 为多个大表增加共用分页辅助 `src/views/kanban/shared/pagination.ts`。
- ASIN360 增加店铺名称下拉，接口继续发送 SID。
- 配置中心增加用户筛选，并将成员范围维护与管理员权限维护拆成独立页签。
- 根目录增加 `dev:web`、`build:web`、`preview:web` 脚本，应用级 preview 固定为 `0.0.0.0:5666`。

## 8. 当前 Git 状态

截至 2026-06-02：

- 前端是独立 Git 仓库。
- 当前分支是 `main`。
- 当前 `HEAD` 是 `b77b73f98 feat: update kanban dashboard`。
- 仓库中存在较多已暂存修改，包含业务页面、登录、路由、配置和部分仓库清理。
- `src\views\kanban\config\index.vue` 还有 2 行仅用于模板缩进的未暂存修改。
- 不要执行 `git reset --hard`、`git checkout -- .` 或批量清理。
- 继续开发时只修改任务相关文件，并先查看 `git status --short`。

当前已暂存业务文件包括：

```text
apps/web-antd/.env.development
apps/web-antd/.env.production
apps/web-antd/src/api/core/auth.ts
apps/web-antd/src/api/kanban/index.ts
apps/web-antd/src/api/kanban/types.ts
apps/web-antd/src/layouts/basic.vue
apps/web-antd/src/router/guard.ts
apps/web-antd/src/router/routes/core.ts
apps/web-antd/src/router/routes/modules/dashboard.ts
apps/web-antd/src/router/routes/modules/kanban.ts
apps/web-antd/src/store/auth.ts
apps/web-antd/src/views/_core/authentication/login.vue
apps/web-antd/src/views/dashboard/analytics/index.vue
apps/web-antd/src/views/kanban/*
package.json
```

此外，仓库中已有一批 `.github` 和 `.changeset` 删除项。这些不是本轮文档任务产生的，不要擅自恢复或删除。

## 9. 开发验收清单

每次修改页面或接口后至少执行：

```powershell
pnpm -F @vben/web-antd run typecheck
pnpm build:web
```

联调时建议逐页检查：

1. 本地账号登录和飞书登录。
2. 不同权限用户的菜单和默认首页。
3. `/analytics` 历史日期与当天数据。
4. `/kanban/monitor` 概览、商品明细和 SPU 下钻。
5. `/kanban/ads` 筛选和表格。
6. `/kanban/targets` 年、季、月切换。
7. `/kanban/asin360` 店铺名称选择后是否提交正确 SID。
8. `/kanban/spus` 受限用户范围。
9. `/kanban/config` 类目、运营组和权限维护。

## 10. 后续优化建议

### P0：修复目标导入后复核页面

后端修复 `target_to_sql.py` 后，重新验证 `/analytics` 和 `/kanban/targets`。

### P1：浏览器视觉验收

重点检查：

- `/analytics` 卡片密度、窄屏布局、仪表盘和运营卡片。
- `/kanban/asin360` 店铺下拉在 243 个店铺时的搜索体验。
- 大表分页与筛选重置行为。

### P1：统一乱码文本

部分历史源文件中存在编码异常注释或文案。后续应逐文件确认 UTF-8 编码并修复可见文案，避免在一次提交中做大范围无关格式化。

### P2：拆分超大页面

优先拆分：

- `views/kanban/asin360/index.vue`
- `views/kanban/targets/index.vue`
- `views/dashboard/analytics/index.vue`

可以按筛选区、指标卡、图表、表格和数据 composable 分拆，降低后续修改风险。

### P2：增加前端自动化测试

目前主要依赖 typecheck、生产构建和人工联调。后续可增加：

- API DTO 单测。
- 权限路由测试。
- Analytics 指标渲染测试。
- ASIN360 店铺名称与 SID 映射测试。
- Playwright 登录和关键页面冒烟。

## 11. 下一轮建议顺序

1. 阅读本文和后端开发文档。
2. 查看前后端 `git status --short`。
3. 先处理后端目标导入重复键问题。
4. 重导目标并验收 `/analytics`。
5. 在浏览器验收 ASIN360 店铺名称下拉。
6. 再安排页面拆分、乱码清理和自动化测试。
