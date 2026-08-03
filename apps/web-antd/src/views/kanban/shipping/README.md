# 圣诞款来货分配 ERP 前端

更新日期：2026-08-03

测试地址：`http://localhost:5666/kanban/shipping`

权限：`kanban:shipping`

## 1. 页面定位

该页面在 Vue Vben Admin 内复刻原本地 Demo 的六页签结构和主要视觉风格，用于来货、SKU 渠道目标、国家渠道计划和自动分配结果的统一操作。

当前页面是安全演算工作区，不代表领星或 WMS 已经执行库存锁定、创建货件、出库或物流下单。页面“锁定”只影响当前工作区后续演算。

后端接口与算法说明见：

```text
E:\junlee\Kanban\docs\圣诞来货分配-后端实现.md
```

业务规则、待确认口径和待接接口见：

```text
E:\junlee\Kanban\docs\圣诞来货分配.md
```

## 2. 文件位置

| 文件 | 职责 |
| --- | --- |
| `src/views/kanban/shipping/index.vue` | 六页签页面、表格、表单、工作区状态和交互 |
| `src/api/kanban/index.ts` | Shipping HTTP 请求函数和文件下载函数 |
| `src/api/kanban/types.ts` | Shipping 请求、响应、规则和工作区类型 |
| `src/router/routes/modules/kanban.ts` | `/kanban/shipping` 路由及权限 |

页面使用 Vue 3 Composition API 和 Ant Design Vue 的 `Spin`、`message`、`Modal`；主要表单和大表格使用原生 HTML 控件，以便保持 Demo 的紧凑布局和横向滚动行为。

## 3. 六个页签

### 3.1 总控看板

展示：

- 国家渠道总计划；
- 累计回货数量及良品数量；
- 已分配数量及锁定数量；
- 总计划完成率及未分配数量；
- 15 个国家渠道的计划、已分配、剩余、完成率、时效和规则。

操作：

- 修改统计/演算日期；
- 打印当前总控页；
- 导出包含四张工作表的 Excel。

### 3.2 来货录入

录入字段：来货日期、供应商、SPU、SKU、回货数量、良品数量、箱数和备注。

规则：

- SKU 必填；
- 良品数量必须大于 0；
- 回货数量为空或为 0 时使用良品数量；
- 箱数大于 0 时，前端按 `良品数量 / 箱数` 估算每箱数量；
- 保存后立即重新演算并保存工作区。

操作：

- 下载来货模板；
- 导入 `.xlsx`、`.xlsm` 或 `.csv`；
- 单条重新分配；
- 删除单条来货；
- 清空全部来货和锁定记录。

删除来货时，前端同时删除所有引用该 `receiptId` 的锁定分配，避免产生悬空锁定记录。

### 3.3 SKU 渠道计划

表格包含 `SPU + SKU + 15 个渠道目标量`。表格宽度固定并支持横向滚动，SPU 和 SKU 两列保持粘性定位。

操作：

- 下载 SKU 渠道计划模板；
- 导入 Excel/CSV；
- 新增和删除计划行；
- 保存后重新演算。

导入按 `SPU|SKU` 合并；同键的新数据覆盖页面中原有数据，其他行保留。

### 3.4 自动分配结果

展示每条建议分配的来货日期、SPU、SKU、渠道、数量、预计箱数、状态、规则提示和锁定状态。

操作：

- 按国家渠道筛选；
- 重新分配全部未锁定数据；
- 锁定或解锁单条结果。

锁定后，后端重算优先扣除锁定数量，并排除同一“来货 + 渠道”的再次建议分配。解锁后该数量重新参与演算。

### 3.5 国家渠道总计划

可维护：

- P0/P1/P2；
- 渠道名称；
- 海运、卡航或空运；
- 计划数量；
- 时效要求；
- 分配规则；
- 是否启用。

渠道代码只读，避免改码后使 SKU 计划和锁定记录失效。保存后重新演算全部未锁定数据。

### 3.6 规则设置

可维护：

- 美国海运最低箱数；
- 美国凑箱等待小时数；
- 英国 IEN 合并门槛；
- 仓库每日处理能力；
- 主市场完成率门槛；
- 美国统一凑箱截止日。

“恢复默认”只恢复规则，不清理来货和 SKU 计划。“重置工作区”会恢复默认渠道和规则，并清空来货、SKU 计划和锁定记录。

## 4. 页面状态和请求流程

初始化流程：

1. 并行请求 `fetchShippingAllocationMeta()` 和 `fetchShippingWorkspace()`；
2. 从元数据复制默认规则，用于“恢复默认”；
3. 使用工作区内容请求 `simulateShippingAllocation()`；
4. 渲染 KPI、渠道进度和分配结果。

保存类操作采用：

```text
修改本地工作区 -> 调用 simulate -> 调用 PUT workspace -> 更新 updatedAt
```

先演算、后保存可以保证无效渠道、重复来货编号、悬空锁定或锁定超量不会写入工作区。

页面不使用 `localStorage` 保存业务数据。刷新后从服务端重新读取当前登录用户工作区。

## 5. API 函数映射

| 前端函数 | 方法与路径 | 用途 |
| --- | --- | --- |
| `fetchShippingAllocationMeta` | `GET /kanban/shipping/meta` | 规则版本和默认规则 |
| `simulateShippingAllocation` | `POST /kanban/shipping/simulate` | 执行纯演算 |
| `fetchShippingWorkspace` | `GET /kanban/shipping/workspace` | 读取当前用户工作区 |
| `saveShippingWorkspace` | `PUT /kanban/shipping/workspace` | 保存工作区 |
| `resetShippingWorkspace` | `DELETE /kanban/shipping/workspace` | 恢复初始工作区 |
| `importShippingReceipts` | `POST /kanban/shipping/import/receipts` | 解析来货文件 |
| `importShippingSkuPlans` | `POST /kanban/shipping/import/sku-plans` | 解析 SKU 计划文件 |
| `downloadShippingReceiptTemplate` | `GET /kanban/shipping/templates/receipt` | 下载来货模板 |
| `downloadShippingSkuPlanTemplate` | `GET /kanban/shipping/templates/sku-plan` | 下载 SKU 计划模板 |
| `exportShippingWorkspace` | `GET /kanban/shipping/export` | 导出完整工作区 |

文件导入使用原始 `ArrayBuffer`，请求头为：

```http
Content-Type: application/octet-stream
X-Filename: encodeURIComponent(file.name)
```

## 6. 关键类型

核心类型位于 `src/api/kanban/types.ts`：

- `ShippingChannelPlan`
- `ShippingReceipt`
- `ShippingSkuPlan`
- `ShippingLockedAllocation`
- `ShippingAllocationRules`
- `ShippingSimulationPayload`
- `ShippingSimulationResult`
- `ShippingWorkspaceState`
- `ShippingAllocationMeta`

新增字段时必须先更新后端 Pydantic 模型，再更新前端类型和页面默认/复制逻辑。规则对象使用显式 `cloneRules()`，不要对 Vue 响应式代理直接调用 `structuredClone()`。

## 7. 视觉和布局

页面视觉基准：

- 深蓝色业务标题栏；
- 白色六页签导航，当前页签使用高亮蓝；
- 四列 KPI，使用不同状态色左边框；
- 白色数据面板、浅蓝色粘性表头；
- 密集业务表格，长规则列允许换行；
- SKU 和渠道计划表使用稳定最小宽度及横向滚动；
- 卡片和面板圆角不超过 8px。

响应式规则：

- 1080px 以下 KPI 改为两列，表单改为四列，规则改为两列；
- 680px 以下 KPI 和规则改为单列，标题与工具栏纵向排列；
- 宽表格不压缩列内容，通过局部横向滚动查看。

打印样式只输出总控看板，隐藏系统标题栏、页签和操作按钮。

## 8. 错误处理

所有保存、演算、导入和导出错误通过 Ant Design Vue `message.error` 显示，优先读取：

```text
error.response.data.detail -> error.message -> 前端默认文案
```

删除、清空和重置必须使用确认对话框。加载和保存过程中分别使用 `loading` 和 `saving` 状态；标题栏显示最近服务端保存时间。

## 9. 本地运行和校验

启动前端：

```powershell
cd E:\desktop\vue-vben-admin
pnpm dev
```

开发前端监听 `5666`，`/api/*` 通过 Vite proxy 转发到测试后端 `8002`。

类型检查：

```powershell
pnpm --filter @vben/web-antd exec vue-tsc --noEmit --skipLibCheck
```

生产构建：

```powershell
pnpm --filter @vben/web-antd build
```

当前两项均已通过。

## 10. 浏览器回归清单

每次修改后至少检查：

1. 飞书登录后可打开 `/kanban/shipping`；
2. 总控页显示 `116,460` 总计划和 15 个渠道；
3. 新增一条来货后状态变为“已自动分配”；
4. 自动分配数量加未分配数量等于良品数量；
5. 锁定后不会出现同一来货、同一渠道的第二条建议行；
6. 新增并保存 SKU 计划后，目标为 0 的渠道不再获得数量；
7. 国家渠道和规则保存后刷新仍保留；
8. 来货模板、SKU 模板和完整导出可正常打开；
9. 重置工作区后回到零来货、零 SKU 计划、零锁定；
10. 测试结束后清理验收数据，不把 QA 数据留给业务用户。

2026-08-03 已在 `5666` 完成以上核心页面和写操作验收，并修复响应式对象复制及锁定渠道重复分配问题。

## 11. 尚未实现

以下能力需要后端取得接口后再设计页面，不应在当前页面伪造成功状态：

- 库存预占、释放及锁定失败处理；
- FBA 目的仓、货件号、FNSKU 标签和箱唛；
- WMS 出库单和实际装箱结果；
- 物流商、渠道报价、截单、运单和轨迹；
- 外部写操作审批、幂等状态、失败重试和回滚；
- 多人同时编辑的版本冲突提示。
