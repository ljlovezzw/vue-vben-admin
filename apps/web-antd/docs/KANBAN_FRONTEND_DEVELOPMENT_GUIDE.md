# Kanban 前端开发与进度说明

更新时间：2026-06-26

本文是 Kanban 前端的主要开发入口。新会话优先读取本文，再按任务打开具体页面。计划任务安装和手动运行命令统一维护在后端文档。若本文、后端文档和实际代码不一致，以当前实际代码为准，再回补文档。后端说明文档位于：

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
.\scripts\start_backend_dev.ps1
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
http://localhost:8002
```

该地址由 `apps\web-antd\.env.development` 的 `VITE_DEV_API_PROXY_TARGET` 控制。`8002` 是开发后端端口；`8001` 保留给正式后端，并由 `https://api.junlee.top` 穿透到外网。

代理会去掉 `/api` 前缀。例如：

```text
前端请求：/api/kanban/monitor/overview
后端路由：/kanban/monitor/overview
```

看板页面默认站点范围为全部站点。站点筛选为空或 `ALL` 时不向后端施加 US 限制；只有用户选择具体站点时才传 `sites/site` 参数。新品监控的 `query.sites` 默认保持空数组，不能再用 `['US']` 作为初始化默认值；否则首屏会主动请求 US 数据。

后端可通过 .env 的 KANBAN_ALLOWED_SHOPS 做全局店铺白名单；前端站点/负责人筛选只是在白名单结果上继续筛选，不需要把店铺列表硬编码到页面。

新品监控的新品详情表列由后端 columns 驱动；当前固定列包含 SPU / 父ASIN / 主图 / 店铺 / ASIN / 运营负责人 / 一级类目 / 二级分类 等基础字段。前端只负责列宽、固定列和图片渲染，不在页面硬编码业务字段顺序。新品监控和分析页商品维度明细的主图 URL 均由后端 `product_image.small_image_url` 提供；泛欧聚合行由后端从被聚合的源父 ASIN 中取第一张可用图；老品缺图由后端 `product_image_service` 定时从领星 Listing 回填，前端不直接调用领星接口补图。如果页面仍显示缺图，先在后端确认 `product_image` 是否存在 `(parent_asin, site)` 记录，再看 `product_image_backfill_log.status`；`no_image/no_rows` 表示领星 Listing 本次没有可用主图或查不到父 ASIN，前端只显示空占位。

生产环境 API：

```text
https://api.junlee.top
```

该域名当前是本机正式后端 `localhost:8001` 的外网穿透地址。开发前端不要代理到 `8001`，否则本地调试会影响线上用户。

后端会对部分父 ASIN 做运行时 SPU 口径修正，前端展示和下钻应以后端接口返回的 `spu` 为准。当前特例：`B0D53PVTZD -> LLW000526`。

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
      components/ProductDetailTable.vue  分析页内嵌新品详情表
    kanban/monitor/             新品监控
    kanban/ads/                 广告监控
    kanban/targets/             目标跟踪
    kanban/asin360/             ASIN360
    kanban/spus/                SPU 管理
    kanban/tools/               工具页
    kanban/config/              配置中心
    kanban/shared/              页面共用辅助
```

## 3.1 最新代码地图（2026-06-22）

当前前端最新改动主要集中在这些文件：

- `src\views\dashboard\analytics\index.vue`：公司经营驾驶舱主页面，包含顶部时间/国家/部门/运营组/负责人筛选、双仪表盘、实时销量/销售额/毛利润卡片、推广与周转卡片、部门销量完成率、负责人完成率、商品维度明细报表和内嵌新品详情表。底部两个表格的负责人范围必须从顶部筛选后的最终负责人作用域继承；部门筛选本身不出现在子表 UI 中。
- `src\views\dashboard\analytics\components\ProductDetailTable.vue`：分析页内嵌新品详情表。复用新品监控详情接口，继承顶部时间、站点、国家、项目标签和负责人作用域，同时拥有自己的国家、负责人、列配置、固定列、分页、汇总行、FBA SKU 库存弹窗和点击排序；本地负责人筛选只能在父级作用域内继续缩小。
- `src\views\kanban\monitor\index.vue`：新品监控主页面，新品详情表已改成类似商品维度明细报表的确认式筛选和列配置，并增加时间范围、负责人筛选。
- `public\tools\upload-tool.html`：图片标准命名打包工具，负责本地预览、AI 标记、ZIP 生成、JSON 元数据打包和飞书任务上传。
- `src\api\kanban\index.ts` 与 `src\api\kanban\types.ts`：补齐 `fetchKanbanProductDetail` 的时间范围参数和 `KanbanProductDetailOverview.query` 类型。

后续修改时先按页面定位到上述文件，再决定是否需要调整后端 DTO；不要把新品详情表和商品维度明细报表的逻辑混在同一个接口里。

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

个人中心 `/profile` 只保留“基本设置”。页面展示 `/user/info` 返回的姓名、账号、邮箱、角色、部门、直属上级和登录方式，所有字段只读，不提供密码、安全设置或通知设置入口。直属上级来自后端登录时同步的飞书通讯录字段 `directLeaderName`；如果飞书开放平台未开通组织架构权限，则显示为空。

### 4.2 页面权限

| 页面 | 路由 | 权限码 |
| --- | --- | --- |
| 公司经营驾驶舱 | `/analytics` | `kanban:analytics`，仅用于菜单展示 |
| 新品监控 | `/kanban/monitor` | `kanban:monitor` |
| 广告监控 | `/kanban/ads` | `kanban:ads` |
| 目标跟踪 | `/kanban/targets` | `kanban:targets` |
| ASIN360 | `/kanban/asin360` | `kanban:asin360` |
| SPU 管理 | `/kanban/spus` | `kanban:spus` |
| 工具 | `/tools/upload`、`/tools/keyword-reverse`、`/tools/search-term-report` | 复用看板权限 |
| 配置中心 | `/kanban/config` | `kanban:config` |

页面路由的 `meta.authority` 负责菜单和页面可见性；后端仍会再次校验权限，不能只依赖前端。

默认模块权限：

- 所有角色默认拥有 `kanban:analytics`、`kanban:monitor`、`kanban:ads`、`kanban:targets`、`kanban:asin360`，因此默认可见公司经营驾驶舱、新品监控、广告监控、目标跟踪和 ASIN360。
- `operator`、`leader` 的 `permissions_json` 只用于追加默认模块之外的权限，例如 SPU 管理和配置中心。
- `manager`、`admin`、`super` 默认拥有全部模块权限。
- 模块可见性不代表数据全量可见；后端会按接口场景应用登录人的负责人、部门或国家范围。
- 公司经营驾驶舱 `/analytics` 是全员可见的公司级页面，后端 `/kanban/analytics/overview` 不做模块权限校验，也不按登录人的负责人范围裁剪；页面上的负责人和运营组筛选代表用户主动选择的筛选条件。但 `operator/leader` 仍可能受后端 `department` 和 `countryScope` 裁剪，前端必须以后端返回的 `filters/query` 为准。

## 4.4 公司经营驾驶舱交互口径

分析页主筛选的负责人选项来自后端 `product_life.运营负责人`，不再依赖利润表或目标表。公司经营驾驶舱仍是公司级视角；负责人、部门、运营组和项目标签是用户主动筛选条件。若登录用户配置了国家范围或部门范围，后端会裁剪对应候选和查询参数，前端不要用本地选项绕过接口回显。

商品维度明细报表维护自己的分页、列配置、SPU、新品/老品等查询状态，但顶部时间、国家、部门、运营组和负责人是它的全局范围，会跟随顶部筛选自动刷新。明细报表支持国家、新品/老品、运营组、SPU、负责人、展示列、固定列和分页/排序筛选；SPU 选项来自后端 `filters.spus`，请求参数为 `spus[]`。运营组使用总览接口返回的 `filters.operationGroups`。国家、新品/老品、运营组、SPU、负责人使用 Dropdown + Checkbox 的确认式筛选，不直接用普通多选 Select，避免大选项列表频繁触发表格请求。筛选浮层必须使用实体背景和足够层级，避免透明叠字。注意：当前后端 `/kanban/analytics/report` 还没有接入 `projectTags` 参数，顶部项目标签只确定性作用于总览和内嵌新品详情表；若要让商品明细也按项目标签过滤，需要先补后端。

顶部部门筛选不会在商品维度明细报表和新品详情表里单独展示，但必须通过负责人范围生效。实现口径是：父页面先请求 `/kanban/analytics/overview`，使用响应里的 `query.responsibles` 作为部门、运营组、负责人取交集后的最终负责人名单，再把这个名单传给 `/kanban/analytics/report` 和 `ProductDetailTable.baseParams.responsibles`。如果顶部筛选后没有负责人，子表请求传内部空集哨兵 `__NO_ACCESS__`，避免误查成全部负责人。子表自己的负责人筛选只能在这个父级名单内继续缩小；父级名单变化时，需要清掉不再允许的本地负责人选择。

明细报表时间快捷项切换时，前端必须同步更新 `startDate/endDate` 后再请求后端，避免 `dateRangeType` 与显式日期不一致。当前规则：今日=今天，昨日=昨天，最近 7/30 天以昨天为结束日，本月为本月 1 日到昨天，上月为完整上月，今年为今年 1 月 1 日到昨天；自定义日期范围由日期选择器控制。报表标题展示快捷项中文名和实际日期范围。

Ant Design Select dropdown uses global `.ant-select-dropdown` solid background rules in `src\app.vue`; do not add repeated local opacity patches for Select popups. Analytics top summary layout is compact: KPI gauges, comparison cards, operation-group cards, and responsible cards use constrained heights so the product detail report stays close to the first screen without large blank gaps. Analytics report columns support xlsx-like header drag resizing; widths are applied to table columns and the fixed summary row together. Do not put width inputs inside the column config modal. Custom Dropdown + Checkbox menus must use solid `background: var(..., #fff)` plus dark-mode overrides; avoid `color-mix(...)` for popup backgrounds because unsupported browsers may drop the background and make table text show through.

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

| 前端函数 | 后端路由 |
| --- | --- | --- |
| `fetchAnalyticsOverview` | `GET /kanban/analytics/overview`，支持 `granularity=day | month`、`departments`、`operationGroupIds`、`responsibles`、`projectTags` 等查询参数；页面当前不提供手动数据源切换，近实时日期由后端自动使用产品表现缓存；分析页不再展示或发送交易状态筛选 |
| `fetchAnalyticsReport` | `GET /kanban/analytics/report`，支持报表时间范围、国家、新品/老品、运营组、SPU、负责人、分页、排序和列配置所需元数据；当前后端尚未接入 `projectTags` |
| `fetchKanbanOverview` | `GET /kanban/monitor/overview` |
| `fetchKanbanProductDetail` | `GET /kanban/monitor/product-detail`，支持新品详情表 `dateRangeType/startDate/endDate`、国家、负责人、类目、状态、预警和站点筛选；响应包含 `query` 回显 |
| `fetchKanbanProductDetailMeta` | `GET /kanban/monitor/product-detail/meta`，轻量返回列配置、国家候选和查询回显 |
| `fetchKanbanProductDetailRows` | `GET /kanban/monitor/product-detail/rows`，分页返回当前页宽表、全量汇总、排序结果和精确总数 |
| `fetchKanbanProductDetailFbaInventory` | `GET /kanban/monitor/product-detail/fba-inventory`，按 `spu + site` 返回当前 FBA SKU 库存弹窗数据 |
| `fetchSpuDailyMetrics` | `GET /kanban/monitor/spu-daily` |
| `fetchAdMonitorOverview` | `GET /kanban/ads/overview` |
| `fetchTargetTrackerOverview` | `GET /kanban/targets/overview` |
| `fetchAsin360Overview` | `GET /kanban/asin360/overview` |
| `fetchAsin360StoreOptions` | `GET /kanban/asin360/stores` |
| `fetchAsin360Section` | `GET /kanban/asin360/{section}` |
| `fetchSpuManagerOverview` | `GET /kanban/spus` |
| `fetchSpuManagerOptions` | `GET /kanban/spus/options` |
| `fetchConfigOverview` | `GET /kanban/config/overview` |
| 运营组单独读取 | `GET /kanban/config/operation-groups` |
| `saveOperationGroup` | `POST /kanban/config/operation-groups` |
| `deleteOperationGroup` | `DELETE /kanban/config/operation-groups/{id}` |

## 6. 页面说明

### 6.1 公司经营驾驶舱 `/analytics`

文件：

```text
src\views\dashboard\analytics\index.vue
src\views\dashboard\analytics\components\ProductDetailTable.vue
```

用途：

- 按站点日期或月份查看公司经营情况。
- 展示销量完成率、销售额完成率、销售额、库存、推广费用和广告效率。
- 日维度展示所选日期范围、前一同长度周期、上周同期；月维度展示所选月份、上月、去年同期。
- 展示部门、运营组和运营负责人完成情况。
- 权限口径：所有登录用户都可查看全量经营数据，不按登录人的负责人范围裁剪。
- 底部已接入商品维度明细报表。页面调用 `fetchAnalyticsReport`，支持报表时间范围、国家、新品/老品、运营组、SPU、负责人、列配置、固定左侧列、横向/纵向滚动、分页排序、汇总行、迷你销量趋势和 CSV 下载。顶部部门、运营组和负责人先在总览接口中被后端归并成最终负责人名单，报表再以该名单作为父级范围。
- 商品维度明细报表下方已接入“新品详情表”。该表由 `components\ProductDetailTable.vue` 维护，复用 `/kanban/monitor/product-detail`、`/kanban/monitor/product-detail/meta` 和 `/kanban/monitor/product-detail/rows`，继承顶部时间、站点与负责人作用域，但拥有自己的国家、负责人、列配置和分页状态。

当前口径：

- 纯历史日期的销量、销售额、库存、周转等运营指标来自数据库 `productexpressionnew` 或产品表现日/月快照；包含今天或昨天的日维度区间会混合 `productexpressionnew_live_cache` 和历史产品表现数据。销售额完成率的实际销售额使用产品表现销售额，不再被利润表销售额覆盖。
- 页面首次进入和重置时，日维度默认选择北京时间当前日期减 1 到当前日期减 1 的单日范围。
- 顶部“维度”可切换日/月。日维度使用 `DatePicker.RangePicker` 日期范围选择，提交 `startDate/endDate`；月维度使用月份选择，提交 `siteDate=YYYY-MM-DD`，后端按该日期所在月份计算。
- 顶部主筛选的时间、站点、部门、运营组、负责人会作为底部商品维度明细报表和内嵌新品详情表的全局范围；项目标签当前作用于总览和内嵌新品详情表，商品维度明细报表后端尚未接入。报表自身运营组和负责人筛选与顶部主筛选取交集，避免扩大数据范围。部门没有子表 UI，但会通过 `overview.query.responsibles` 传递到子表请求。
- 底部报表快捷项包括今日、昨日、最近 7 天、最近 30 天、本月、上月、今年和自定义；自定义时使用 `DatePicker.RangePicker`。若同时传 `startDate/endDate` 和快捷 `dateRangeType`，后端优先使用显式日期范围。国家筛选来自后端 `filters.countries`，当前包含“泛欧”和非泛欧业务国家；欧洲国家在后端归并到“泛欧”。顶部国家筛选会映射为后端报表使用的中文国家标签，例如 `US -> 美国`、`PAN_EU -> 泛欧`。
- 报表列由后端 `columns/defaultColumns` 驱动。前端列配置弹窗支持按业务分组勾选、搜索字段、已选列拖拽排序、上下移动、移除和固定左侧列；默认固定主图、父 ASIN、负责人和 SPU，最多固定 7 列。二级分类已纳入后端默认展示列，订单量不在默认展示列中但仍可通过列配置打开。CSV 下载按当前筛选和列配置分页拉取全部结果，不只导出当前页。报表底部汇总行读取后端 `summary`，销量、订单量、销售额、广告花费等是当前筛选条件下的全量汇总，不是当前页合计。商品维度明细报表的“店铺”是后端聚合维度之一，导出后按店铺二次汇总应与同日期同店铺的原始产品表现销量对齐。
- 报表目标销量由后端统一计算：老品使用 `站点 + SPU + 月份` 精确目标，不依赖负责人；泛欧聚合行展示 `site=泛欧`，并匹配 `operator_targets.site=泛欧`；新品按 `负责人 + 二级分类%` 的类目占位目标兜底，缺失时再回退精确 SPU 目标，前端只展示返回的 `targetUnits`。
- 顶部不再展示“交易状态”筛选；分析页运营指标主数据源已经切到产品表现，前端不再向经营分析请求发送 `transactionStatuses`。后端默认仅把利润表“已发放”口径用于毛利润、广告费、广告销售额和推广费用等财务项，其中广告费、广告销售额和推广费用会从 CNY 转 USD，毛利润保持 CNY；销售额实际值保留产品表现口径。
- 日维度日期范围如果包含今天或昨天，后端会优先用 `productexpressionnew_live_cache` 覆盖这些近实时日期，再与其余历史日期的 `productexpressionnew` 数据合并；只有纯历史日期才完全读取 `productexpressionnew`。
- 月维度固定使用 `productexpressionnew` 聚合，不触发实时产品表现缓存；当前月默认截止北京时间当前日期减 1。
- 前端不提供手动数据源切换按钮，实际数据源以接口 `source.message` 为准。
- 产品表现实时缓存由后端计划任务刷新今天和昨天两天，按 USD 拉取；前端不直接触发领星全量 API。接口 `source.message` 会显示缓存大约多久前刷新。分析页上半部分销售额展示美元，毛利润展示人民币；毛利润实际值由后端按 CNY 口径返回，用来匹配 `dailyTargetProfit`。底部商品维度明细报表和新品详情表是例外，金额字段展示后端行级 `currencySymbol` 对应的原币种。
- 第二个仪表盘是销售额完成率，实际销售额来自产品表现历史表/快照或今天、昨天实时缓存；目标值来自后端优先按 `operator_target_summary` 汇总出的 USD 目标折算，缺失组合再由旧 `operator_targets.target_sales_original_currency` 或 CNY 目标兜底。
- 日维度目标为所选日期范围内逐日目标累加后的区间目标；月维度目标为当月目标总额。由于接口兼容原因，仍读取 `dailyTargetUnits/dailyTargetSales/dailyTargetProfit` 字段，但页面文案按维度显示为“区间目标”或“月目标”。`dailyTargetSales` 是 USD，`dailyTargetProfit` 是 CNY。
- 销售额、销售额目标、销售额差值和推广占比中的总销售额展示美元金额；毛利润、目标毛利、毛利差值展示人民币金额。分析页总览的销售额实际值来自产品表现，历史 `productexpressionnew` 原币种金额会由后端按站点汇率换算到 USD，今天/昨天实时缓存本身按 USD 拉取。总览毛利润优先取利润表 CNY 记录，缺失时后端会用产品表现/实时缓存毛利乘 `ANALYTICS_USD_TO_CNY_RATE` 兜底。毛利润目标和目标毛利率优先来自后端 `operator_target_summary`，缺少 UK/泛欧时由旧 `operator_targets` 兜底；前端只展示后端返回的 `dailyTargetProfit`、`targetGrossMarginRate` 和 `grossMarginCompletionRate`，不要自行按行重算。商品维度明细报表和新品详情表不要套用这里的 USD 规则，它们保留原币种。月维度展示 2 位小数，日维度保留紧凑金额展示。
- 周转周期(月)展示后端返回的 `turnoverMonths`，口径为 `(FBA库存 + FBA在途 + FBA调仓中) / 当天销量 / 30`；前端不再用其它库存字段补算。右侧周转卡片经过压缩布局，主值、前一周期和上周同期需要保持上下对齐。
- 三个完成率仪表盘中心通过 Vue 覆盖层展示具体完成值和完成率百分比：销量图展示实际销量，销售额图展示 USD 实际销售额，毛利润图展示 CNY 实际毛利润；下方继续展示实际值和目标值。不要依赖 ECharts `detail/graphic` 渲染中心文字。
- 销量和销售额对比卡片按维度切换文案：日维度为前一周期/上周同期，月维度为上月/去年同期，并展示绝对差值和百分比差异。
- 黄色销售指标区按视觉稿采用橙黄渐变背景、内层半透明 KPI 玻璃卡和 2x3 对比信息面板。对比面板标签和普通数值使用黑色系并比默认小字大一号；只调整 `yellow-grid` 的表现层，不改变 `latest/previous/weekBefore` 数据口径；涨跌值继续使用 `comparisonClass` 输出的 `good/bad/neutral` 状态着色。
- 蓝色推广与周转指标区采用蓝紫渐变背景、点阵纹理、内层半透明 KPI 玻璃卡和信息对比面板。推广费用占比保留 6 项对比指标，周转周期保留 2x2 对比；只调整 `blue-grid` 表现层，不改变推广占比和周转周期计算口径。
- 顶部大网格桌面端需要给右侧 `blue-grid` 保留足够宽度，当前右列宽度约 460px；后续调整 `yellow-grid` 时不要再次挤压蓝色指标区。
- 部门维度 `group-panel` 当前需要比早期布局更宽，桌面端第 2 列最小宽度约 340px；负责人面板可以适度压缩，负责人卡片最小宽度约 196px。
- 右侧推广占比、周转周期和对比卡片展示 `period.startDate/endDate/days` 对应的时间段信息；日维度区间模式下必须显示当前区间、前一同长度周期和上周同期区间，不能只展示单日语义。
- 部门筛选选项来自后端 `filters.departments`，请求参数为 `departments`；运营组筛选选项来自后端 `filters.operationGroups`，并会随部门选择收窄，部门、运营组、负责人多选由后端按交集过滤。前端不要自行用运营组成员替代后端最终名单；底部两个表格应优先使用 `overview.query.responsibles`，这样部门筛选也能影响没有部门控件的子表。
- 原运营组区域已改为部门维度，三段横向指标卡分别展示“销量完成率 - 部门维度”“销售额完成率 - 部门维度”和“毛利润完成率 - 部门维度”。数据来自后端 `operations.departmentRows`，运营组仍只作为顶部和负责人面板右上角的筛选条件存在。
- 负责人列表只展示后端返回的活跃负责人，优先排列实时销量大于 0 的运营；后端已过滤不在 `users` 表里的离职人员和区间目标销量为 0 的人员。标题显示总展示人数和其中有销量人数。
- 负责人维度卡片区按独立小卡展示，桌面端使用 `auto-fit + minmax(210px, 1fr)`，不能用连续表格边框挤压文本；负责人姓名必须作为卡片顶部的主标题清晰展示。卡片内部使用两列指标，包含销售额完成率、目标销售额、销量完成率、目标销量、毛利润、目标毛利、毛利完成率、毛利率、目标毛利率、毛利率完成率、FBA 可售数量、周转周期（月）、广告 ACoAS 和推广费占比；右上角提供独立的运营组/负责人级联筛选状态，不要复用顶部筛选 Dropdown 的 open/draft 状态。该筛选下拉要通过 `getPopupContainer` 挂到 `document.body`，避免被 `responsible-panel/top-board` 网格或滚动区域裁切；弹层背景必须不透明，不能透出下方表格文字。忽略原图右侧收藏/评论/导出/告警侧栏和“每日运营完成率动态追踪”装饰字。
- 新品详情表位于商品维度明细报表下方。表格不展示 `No.` 行号列，表头第一行按业务分组展示基础信息、销售、利润费用、广告、表现、库存；基础信息包含 `SPU`、`父ASIN`、`主图`、`店铺`、`等级`、`运营负责人`、`一级类目`、`二级分类`、`国家`、`创建时间`、`开售时间`、`上线天数` 和 `销售均价`，销售/广告/库存字段按各自业务组展示。列配置分组与表头分组保持一致。指标单元格使用左对齐填色表达占比或完成度，颜色使用更深的蓝/绿/橙/红；上线天数显示数字在前、红点在后。
- 左侧三个完成率环形图内部比例单独维护：ECharts gauge 只画环形，中心数字用覆盖层；图表中心下移到 `55%`，图表区域随卡片伸展，避免底部说明上方出现大块空白。
- 新品详情表所有字段都支持点击排序，排序取指标对象的真实 `value`，不是格式化后的文本；排序由后端 `/kanban/monitor/product-detail/rows` 对完整结果排序后再分页。表格底部汇总行读取后端 `summary`，不是当前页前端本地求和。
- 新品详情表父 ASIN 展示为 Amazon 链接，按行内站点/国家映射到对应 Amazon 域名，打开新标签；无站点兜底到 `www.amazon.com`。

已完成：

- 按设计图恢复主要布局。
- 统计周期改为可编辑的站点日期。
- 移除顶部 `01 完成率 / 02 评分监控 / ...` 状态页签行，筛选区增加“部门”多选并放在“运营组”前。
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
- 前端只展示 `lifecycleStage`、`status`、`alertLevel`、`reasonText` 等字段。新品成功/失败判定建议先看后端文档 `docs/新品成功失败判定建议.md`，确认前不要在前端自行改判定口径。
- 不要在 Vue 中重新实现阶段规则。
- 大表分页使用 `src\views\kanban\shared\pagination.ts`；主筛选、SPU 搜索、快捷状态、商品明细国家筛选和列配置变化后都回到第一页。
- 商品明细表已经改为类似分析页的确认式筛选和列配置：国家筛选使用 Dropdown + Checkbox；列配置弹窗支持字段分组、搜索、勾选、拖拽排序、上下移动、移除和固定列。当前不再要求新品详情表强制冻结固定列，固定列由用户配置决定。
- 顶部主筛选同时刷新概览和商品明细；商品明细页签内的国家筛选只刷新 `GET /kanban/monitor/product-detail`，避免重复请求概览接口。国家下拉候选项必须使用后端返回的 `countries`，不要从当前表格 rows 本地反推；后端保证该候选项不受当前国家筛选影响。
- 新品详情表已经增加与商品维度明细报表相同语义的时间范围和负责人筛选。分析页内嵌场景中，它的时间范围默认继承顶部时间，负责人为空时继承顶部筛选后的最终负责人作用域；如果用户在新品详情表内选择负责人，只能在父级作用域内继续缩小，不能绕过顶部部门筛选。
- 新品详情表的金额、毛利、利润、花费、退款、运费、销售额、净销售额等金额类字段展示两位小数；后端保留原币种并返回 `currencyCode/currencySymbol`，前端使用行级币种符号展示，不要统一加 `$`，也不要按站点二次换算。
- 新品详情表库存相关单元格可通过 `fetchKanbanProductDetailFbaInventory` 读取 `GET /kanban/monitor/product-detail/fba-inventory`，按当前行 `spu + site` 展示 SKU 维度库存弹窗。该接口读取当前 `fba_inventory_snapshot`，不按详情表日期回溯；登录人的国家/负责人范围仍由后端校验。
- 指标填色只用于有明确进度或占比含义的字段。`目标销量`、`销量完成率` 使用完成率口径；广告订单、自然订单、退款量等字段如果展示进度，应与同 SPU 当前时间维度下的总订单、总销量或销售额相比，不能简单按自身数值填满。
- 父 ASIN 在新品详情表中应渲染为 Amazon 链接，点击新窗口打开对应站点商品页。
- `上线天数`、`销量`、`目标销量`、`销量完成率`、`销售额` 这几列支持点击排序；排序使用后端返回指标对象中的原始数值。

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
- SPU 管理列表筛选已下推到后端 SQL 层，前端应继续把站点、负责人、类目和状态作为查询参数传给 `/kanban/spus`，不要改回先拉全量再本地过滤。

### 6.7 工具 `/tools`

文件：

```text
src\views\kanban\tools\upload\index.vue
src\views\kanban\tools\keyword-reverse\index.vue
src\views\kanban\tools\search-term-report\index.vue
public\tools\upload-tool.html
```

用途：

- 将 `E:\junlee\Kanban\upload-tool.html` 挂入与运营看板同级的工具菜单。
- 当前工具为图片标准命名打包工具，支持 A+ 与品牌故事素材选择、文件名预览、ZIP 下载，以及将生成的 A+ / 品牌故事 ZIP 上传到飞书任务。
- `/tools/keyword-reverse` 为亚马逊关键词反查工具，是 Vue 原生页面，不走 iframe。页面调用 `#/api/kanban` 的 `fetchKeywordReverse()`，实际请求 `/api/kanban/tools/keyword-reverse`，由本机 FastAPI 代理第三方关键词反查接口。
- 关键词反查页输入 ASIN、市场、时间范围、排序字段和排序方向。`marketPlaceId` 当前已知映射不完整，只确认 `美国=1、英国=5、德国=6、法国=7、意大利=8、西班牙=9`，页面用下拉选择这 6 个市场，不再让用户手输 ID。结果区按业务参考图组织为：顶部高频词矩阵，支持复制到剪切板、点击高频词筛选和收起/展开；下方结果工具栏展示复制、导出、结果数、`展示前10产品` 开关、排序字段、升降序和查询按钮；明细表固定补充序号列，关键词列展示英文关键词、中文解释和行内复制/筛选操作。
- 后端返回 `columns` 动态列，前端不要写死第三方接口所有字段。当前只对常见字段做增强展示：`keyword/keywordText/searchKeyword/word` 作为关键词列，`top10Products/top10Product/topProducts/productList/imageList` 作为“前10产品”图片条，`trafficRatio/searchVolume/organicRank/sponsoredRank/asinTrafficRatio/asinTrafficDistribution/abaWeek` 等按后端中文列名和数值类型渲染；未识别字段仍按动态表格普通列展示，并可通过“原始字段”抽屉排查。
- 关键词筛选是当前页本地过滤，不改变后端分页总数；需要跨页精确过滤时，应在后端接口增加对应过滤参数，避免前端拉取全量结果。
- `/tools/search-term-report` 为搜索词报告词库工具，是 Vue 原生页面。页面调用 `fetchSearchTermReportOptions()` 获取店铺和快捷日期，调用 `fetchSearchTermReportParentAsins()` 按店铺 + SPU 查询父 ASIN 候选，调用 `createSearchTermReportTask()` 提交后端生成任务，再用 `fetchSearchTermReportTask()` 每 30 秒轮询任务状态；任务成功后用 `downloadSearchTermReport()` 按 blob 下载文件，避免裸链接下载丢失登录态。
- 搜索词报告词库页面的流程固定为：先选店铺、输入 SPU 和报告日期范围，再查询父 ASIN；候选表展示店铺、SPU、站点、父 ASIN、项目标签、生命周期、一级分类、二级分类和匹配行数。候选表的店铺列以后端返回为准，当前后端按 `店铺 -> 品牌+站点 -> 全店铺` 真实匹配到父 ASIN 后才把筛选店铺作为展示店铺返回。父 ASIN 支持多选，候选只有一个时自动选择，多个时必须至少选择一个。生成报告不拉长 HTTP 请求，后端立即返回 `taskId`，页面展示 `queued/running/succeeded/failed` 状态；同一天内相同店铺 + 父 ASIN 组合 + 日期范围可能由后端直接命中历史并立即返回成功；成功后展示报告基础信息、汇总表和各 sheet 的前 50 行预览。页面用 localStorage 缓存店铺、SPU、日期范围、候选行、已选父 ASIN 和当前 `taskId`，刷新后恢复并继续查询任务状态。sheet 预览列由返回行动态生成，不写死 SDK 输出字段。
- 每个图片槽位有“AI生成”和“AI生成人物”两个复选框。生成 ZIP 时会额外写入 `image_ai_flags.json`，记录每张图片的文件名、业务类型、槽位、AI 标记和 AI 人物标记；该 JSON 会随图片一起打包。
- 选择图片后必须展示预览图；已有文件时按钮文案显示“更换文件”，避免用户误以为没有选择成功。预览 URL 通过 `URL.createObjectURL` 生成，重置时需要释放。
- 履约方式在界面隐藏；品牌卡媒体资产默认选择“重命名为 SPU-序号”。
- 在线 Listing 查询完成后，从返回行提取父 ASIN 下拉选项，并按所选父 ASIN 展示对应 ASIN 列表和 Listing 明细。查询前父 ASIN 下拉保留可操作状态，只显示提示项。
- Listing 明细表固定展示：父ASIN、ASIN、图片、MSKU、SKU、品名、店铺、国家、品牌、状态、负责人；Listing 代理当前返回中文列名，图片列优先读取 `图片`，兼容 `small_image_url`、对象、数组、JSON 字符串和 `//` 协议相对地址，并在候选字段未命中时从图片类字段名兜底提取 URL；品牌读取 `亚马逊品牌`，状态 1/true 显示在售，0/false 显示停售。图片加载失败显示空占位。
- 在线 Listing 查询本地开发使用 `/api/lingxing/listing/show-online` 经 Vite proxy 转到开发 FastAPI `localhost:8002`；非 localhost 环境使用 `https://api.junlee.top/api/lingxing/listing/show-online`，也就是正式后端 `localhost:8001` 的穿透地址。飞书任务上传同样按环境切换，本地使用 `/api/feishu/image-upload-tasks`，线上使用 `https://api.junlee.top/api/feishu/image-upload-tasks`。
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
- 用户角色、权限码、部门和管理成员维护。
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
- `admin` 和 `super` 可以修改角色、状态、部门、可访问模块和组员范围。
- “可访问模块”是否可编辑只取决于当前登录人是否为 `admin/super`，不取决于被编辑用户当前是什么角色。
- 角色变化或飞书登录后如果页面仍显示旧权限，需要重新登录刷新 `/user/info` 和 `/auth/codes`。

当前页面结构：

- 顶部为类目数、上新计划、成品率目标和运营人员汇总。
- `admin/super` 可看到新增类目、新增运营人员、类目阈值和运营组组织架构。
- 飞书用户权限卡片拆成“成员范围维护”和“管理员权限维护”两个页签；管理员权限维护页可编辑用户部门，用于分析页部门筛选兜底。保存用户权限时必须把 `department` 放入 `updateConfigUserAuth` payload，且仅 `admin/super` 可传该字段。
- 管理员权限维护页还可编辑“国家范围” `countryScope`。不选表示不限制国家；选择后后端会在 `main.py` 中把中文国家映射到站点或国家候选，并裁剪分析页、商品明细、新品详情和 FBA SKU 库存弹窗等接口的查询范围。
- 成员范围维护支持姓名、邮箱、部门、飞书 ID 搜索，并支持按角色、状态和登录方式过滤。
- `leader` 在成员范围维护页签只看到并保存自己的组员范围；`manager` 可以维护成员范围；`admin/super` 还能进入管理员权限维护页签修改角色、状态和可访问模块。

## 7. 已完成的主要开发

- 从旧页面方案迁移到 Vue Vben Admin。
- 接入 FastAPI 登录、本地账号和飞书登录。
- 增加用户默认首页、403 页面和动态权限菜单。
- 完成新品监控、广告监控、目标跟踪、SPU 管理和配置中心页面。
- 新增公司经营驾驶舱 `/analytics`，并接入底部商品维度明细报表。
- 在公司经营驾驶舱商品维度明细报表下方接入新品详情表组件，支持独立时间范围、负责人、国家、列配置、父 ASIN 链接和指定列点击排序。
- 为多个大表增加共用分页辅助 `src/views/kanban/shared/pagination.ts`。
- ASIN360 增加店铺名称下拉，接口继续发送 SID。
- 图片打包工具增加图片预览、AI 标记复选框、AI 标记 JSON 随 ZIP 打包，以及飞书任务上传所需 token 注入。
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
