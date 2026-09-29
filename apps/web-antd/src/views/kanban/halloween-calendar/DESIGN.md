---
name: 万圣节运营日历
description: 生产看板中的紧凑季节运营界面，延续已批准的深绿与暖纸色视觉。
colors:
  ink: '#173b39'
  muted: '#586e65'
  line: '#ded8cc'
  paper: '#fffdf8'
  canvas: '#f2efe8'
  orange: '#ab522d'
  soft: '#f7f4ec'
  risk: '#913c24'
  positive: '#137333'
  positive-bg: '#e6f4ea'
  negative: '#c5221f'
  negative-bg: '#fce8e6'
  track: '#e3e9df'
  metric: '#f8f6f0'
  group: '#f0f3f0'
  group-hover: '#e6ece6'
  group-progress: '#507768'
  badge: '#fff0df'
  green-badge: '#eaf0e8'
  green-badge-text: '#315a43'
  gray-badge: '#eeeae1'
  button-hover: '#eee9df'
  button-active: '#e2e8df'
  primary-hover: '#285550'
  refresh-hover: '#315a51'
  refresh-border: '#69877d'
  mark: '#e37b4d'
  subtitle: '#c4d8ca'
  holiday: '#fff2dc'
  holiday-text: '#80502e'
  queue-border: '#e5e1d8'
  white: 'white'
typography:
  body:
    fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif'
    fontSize: '14px'
    lineHeight: 1.6
  title:
    fontSize: '24px'
    fontWeight: 600
    lineHeight: 1.4
  title-mobile:
    fontSize: '21px'
  section:
    fontSize: '18px'
  metric:
    fontSize: '22px'
  metric-mobile:
    fontSize: '20px'
  compact-body:
    fontSize: '13px'
  metadata:
    fontSize: '12px'
  small:
    fontSize: '11px'
  stage-date:
    fontSize: '10px'
rounded:
  track: '3px'
  badge: '4px'
  control: '7px'
  group: '8px'
  block: '10px'
  notice-mobile: '12px'
  notice: '16px'
spacing:
  tight: '8px'
  compact: '12px'
  mobile: '16px'
  section: '18px'
  regular: '20px'
  desktop-gutter: '30px'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.white}'
    rounded: '{rounded.control}'
    padding: '6px 12px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-default:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '6px 12px'
  button-link:
    backgroundColor: 'transparent'
    textColor: '{colors.orange}'
    padding: '4px 0'
  input:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '6px 12px'
  notice:
    backgroundColor: '{colors.paper}'
    rounded: '{rounded.notice}'
  group:
    backgroundColor: '{colors.group}'
    rounded: '{rounded.group}'
    padding: '12px 14px'
  metric:
    backgroundColor: '{colors.metric}'
    padding: '12px 14px'
  badge:
    backgroundColor: '{colors.badge}'
    textColor: '{colors.risk}'
    rounded: '{rounded.badge}'
    padding: '2px 7px'
---

# Design System: 万圣节运营日历

## Overview

**Creative North Star: "延续啤酒服运营通知"**

本文件记录正式万圣节模块的既有视觉实现：深绿标题、暖纸色内容、浅绿分组与克制橙色。它延续用户批准的紧凑运营通知方向，不定义其他看板或整个应用的样式。

以清楚的日期、数字、当前负责人和建议动作为阅读主体。七阶段时间轴接在筛选之后，以同款去年同期销量判断阶段快慢；点击阶段就地依次查看同期销量比较、目标完成和今年目标均摊参考。完整商品、排期和来源通过弹窗按需展开，保留生产应用的 Ant Design Modal 行为。视觉规则以同目录 `style.css`、`index.vue`、`StageSalesProgress.vue` 和 `YearSalesRanking.vue` 的有效样式为依据，原型中未被生产组件使用的原生 `dialog` 样式不是生产弹窗规范。

**Key Characteristics:**

- 单一暖纸面板，深绿标题与细线分区。
- 五项摘要、六项分组和八条主区待办保持紧凑密度。
- 英文分类、当前归属与库存字段直接相邻。
- 日历进度、销售进度和处理确认使用各自明确的文字。

## Colors

深绿构成标题、主要操作和当前阶段，橙色承担链接与默认销售进度，鲜明绿色与红色承担增长／超前及下降／滞后状态，浅绿承担分组和日历时间进度。frontmatter 是本文件的颜色值来源；下述名称只解释用法。

`.impeccable/design.json` 的八阶 OKLCH 色带仅供设计面板预览，由已用颜色合成，不是生产 CSS 新增的色阶。组件片段抽取现有有效样式，演示数字不代表实时数据。

### Primary

- **深绿墨色（ink）：** 页面文字、标题栏、主要按钮、选中维度和当前阶段圆点。
- **沉稳进度绿（group-progress）：** 分组完成率与阶段日历进度；文字必须继续说明其不同含义。

### Secondary

- **陶土橙（orange）：** 次要入口、总销售进度和键盘焦点。
- **深暖警示色（risk）：** 需要处理的建议、库存提醒值和提示徽标文字。
- **增长绿／下降红（positive／negative）：** 同比及进度比较的正向／负向状态；分别配 positive-bg／negative-bg 浅底。持平、未知、去年为零及未开始不应用趋势底色。
- **橙色短标（mark）：** 标题旁的竖向识别标记。

### Neutral

- **暖画布／纸面（canvas／paper）：** 页面外部与主要内容表面。
- **柔和分区（soft／metric／group）：** 筛选和页脚、摘要、可下钻分组的不同底色。
- **灰绿辅助文字（muted）与暖分隔线（line）：** 元数据、来源提示、结构边界；不以降低透明度隐藏业务限制。

**The State Rule.** 颜色之外始终保留状态文字；日历经过、销售完成率与处理确认不能互相替代。

## Typography

使用 frontmatter 中的 Segoe UI、Microsoft YaHei 系统字体序列及 `font-variant-numeric: tabular-nums`。生产页标题为 title，手机使用 title-mobile；分区标题为 section，摘要主数字为 metric，手机为 metric-mobile。正文以 body 和 compact-body 组织，metadata、small 及 stage-date 只承载次要信息。

数字、单位与字段名相邻，英文分类允许换行。当前负责人和建议动作需要在密集行内仍然可辨；不要用空白或颜色替代文字标签。缺失数值使用“—”“待核对”或“待补齐”，有效零值保持 0。

## Layout

生产内容置于现有应用壳内，纸面板最大宽度 1180px，常规左右留白使用 desktop-gutter。结构顺序为标题、筛选、七阶段、当前安排、五项指标、销售进度、默认折叠的同比增减排名、分组进度、优先待办与次要入口。

桌面分组两列，每页最多六项；主区最多八条待办。完整商品／待办清单通过 960px Ant Design Modal 打开，每页十行。业务来源、库存来源和目标来源按需展开，不把所有证据一次铺满主页面。

不超过 800px 时侧边内容收窄。不超过 600px 时，部门筛选独占一行，站点与负责人在下一行；分组变成单列；五项指标按三项加两项排列；待办操作移到事项内容下方。详情摘要与库存字段变为两列。

时间轴保持七阶段完整顺序，在桌面最小宽度 780px、手机 750px 的局部容器内横向滚动。滚动容器可获键盘焦点；当前阶段使用 `aria-current="step"`。普通表格保持局部滚动；运营排期表在手机固定列宽并换行，避免整个页面横溢。

所选阶段销售详情接在日历时间进度下方，以细线分区。桌面为 `1fr 1fr 1fr` 三等分列：销量同比、目标完成、较均摊目标，列间距 20px；不超过 700px 时按相同优先顺序转为单列，间距 12px，各项下方加细线。阶段日期与截止日留在标题旁；取消可核对数量、去年比较日期和计算口径的常驻说明。

同比增减排名位于整体进度后，单个折叠入口保持主页面紧凑。展开后两榜为等宽两列、间距 28px；不超过 900px 时按增量、下滑的顺序堆叠，间距 12px。周期切换放在展开区内右侧；不增加常驻说明或日期行。

## Elevation & Depth

模块主内容不用卡片投影。暖纸面、浅底分区、细边线和留白建立层次；当前阶段用外圈加强定位。弹窗与消息反馈由现有 Ant Design Vue 组件承载，其外壳、遮罩与层级采用应用实现，不能从旧原型的原生 `dialog` 规则推导生产行为。

常规按钮只有 0.16s 背景色过渡，没有装饰性入场、连续运动或自动播放动画。

## Shapes

外层通知面板使用 notice 圆角，手机使用 notice-mobile；指标和待办使用 block，分组使用 group，输入与按钮使用 control，标签使用 badge，细进度条使用 track。标题短竖条延续原批准标记。阶段标记为 23px 圆点，当前点具有 4px 的浅绿外圈。边线一般为 1px。

## Components

### 筛选、按钮与维度切换

输入和常规按钮使用纸面底与细边线，最小高度 36px。主要按钮为深绿底，链接按钮为橙色下划线。刷新按钮保持标题栏内的浅色文字和边线。禁用时透明度为 0.55；键盘焦点使用 3px 橙色描边及 3px 外扩距离。维度切换采用 `aria-pressed`，选中状态为深绿底。

部门与站点改变后同步负责人选项，并清除不兼容值。分类通过分组下钻形成可移除条件。三个汇总维度使用同样的可比较业务范围。

### 时间轴与进度

七阶段紧接顶部筛选，日期、名称和当前阶段同时可读。2026-09-21 的第三阶段显示 6/15 天，旁注明“仅表示时间经过，不代表任务完成”。整体销量条按相对时间进度使用增长绿或下降红；分组和日历时间使用绿色条。条宽限制在 0%—100%，业务数值仍按实际计算结果展示。

每个阶段为原生按钮，附带“同比 +X%／-X%”或“持平”“未开始”“待核对”“去年为 0”“两年均为 0”短状态。阶段快慢的比较基准是去年同期同款销量。选中阶段用名称下划线和 `aria-pressed` 表达，悬停为柔和分区底色；当前日期所属阶段仍独立使用 `aria-current`。所选详情使用 `aria-live="polite"` 更新，保留键盘焦点样式。

阶段同比与目标完成主数为 22px，较均摊目标结论为 18px，标签及支持行为 12px。同比使用带符号百分比，支持行仅留“今年／去年”销量；目标以实际／目标件数显示；均摊差用“超前／滞后 X 个百分点”和应达比例、多／少件数显示。增长／超前为 positive，下降／滞后为 negative，均配同名浅底；这些状态数值使用 700 字重、3px 8px 内边距和 4px 圆角。持平、缺失、去年为零与未开始保持中性。独立统计范围及计算方式保留，主页面不再常驻显示范围数量或口径长句。

### 整体销量与时间对比

五项摘要下的整体进度使用双行等宽、8px 高轨道：销量进度、时间进度各保留文字和百分比，时间行补充已过天数 / 61 天。销量条按相对时间进度使用 positive 或 negative，时间条使用 muted。下方为可换行的两组短指标：“较时间进度”显示超前／滞后百分点和多／少件数，“销量同比”显示带符号百分比及今年／去年销量。主状态为 18px，正负状态应用上述 700 字重与浅底标签样式。手机保持双行，结果逐组排列，标题与截止日可换行；不增加卡片容器或解释段落。自然日时间与销量共用销售数据截止日，均摊参考与同比维持独立口径。

### 同比增减排名

采用原生 `details` / `summary`，默认收起，唯一入口标题为“同比增减前十”。柔和分区底色、细圆角和右侧箭头表达展开行为；入口最小高 44px、标题 18px，展开时箭头旋转 90°。内部“所选阶段 / 全阶段”按钮沿用深绿选中态及 `aria-pressed`，默认全阶段；按钮最小高 36px。入口与按钮均保留橙色键盘焦点。

两榜标题为 14px，表格使用 compact-body，列名为 metadata，辅助同比为 small；使用固定列布局：商品 40%、今年 17%、去年 17%、增减／同比 26%。商品与站点标签左对齐，所有数字列的表头、汇总与站点明细均居中并使用等宽数字。增长与下滑净件数分别使用 positive／negative 及其浅底，保留正负号。排名只展示可比站点汇总后去年合计大于 0 的 SPU；整体与阶段同比卡片的零值状态不受影响。表格仅呈现“商品、今年、去年、增减 / 同比”，不添加冗长标题、比较日期或解释段落。

SPU 是带下划线的展开按钮，以 `aria-expanded` 表达状态。站点明细在柔和浅底中展示当前负责人及两年件数，每站点使用同一表格的四个单元格，使数字与上方表头和汇总共用列中心；不使用跨列合并的“今年 / 去年”文本块。橙色文字入口打开现有商品明细。空榜显示简短状态。此组件沿用已有字体、颜色与信息层级，不引入新的视觉身份。

### 摘要、分组与待办

五项摘要使用紧接的分隔布局；分组使用浅绿可点击表面。待办保持负责人、商品、站点、分类、可用／可售、近七天销量、完成率和建议动作的邻近关系。库存总量、可用和可售分别标注，共享库存附加文字说明。

### 弹窗与来源

使用生产 Ant Design Modal 展示完整清单、商品明细、运营排期和数据口径；通过关闭控件或 Escape 退出。详情使用四项摘要与八个独立库存字段；目标原表负责人及当前主数据同时可追溯。目标来源、库存来源使用可展开区，表格数值右对齐且不折断。

### 生产确认与反馈

点击“确认处理”后显示“保存中…”，服务端成功响应后才采用确认人、确认时间并提示“已保存处理确认”。当日同一动作刷新后仍保持确认，待办中移除、完整清单保留；新日期、负责人变化或建议动作变化产生新待办键。请求失败展示错误提示，不伪造成功状态。

这里明确替代的是旧独立 HTML 原型的“本页确认、刷新后重置”演示语义；旧原型文档仍描述其原有行为。本生产模块的确认保存到后端 `halloween_calendar_actions`，只记录处理状态，不会执行调价、广告变更或消息推送。业务细节及测试证据边界见本目录 `PRODUCT.md`。

初次读取使用加载状态；刷新失败保留上次数据并显示警示与重试；筛选空结果、搜索空结果、库存缺失和来源缺失均使用明确文案。主内容以 `aria-busy` 表示读取状态，错误以 `role="alert"` 表达。

## Do's and Don'ts

### Do:

- **Do** 保留批准的深绿、暖纸色、紧凑层级和顶部七阶段顺序。
- **Do** 把当前归属、数据范围、库存字段与动作条件放在对应信息附近。
- **Do** 用文字区分日历时间、销售进度和持久化确认。
- **Do** 保留键盘焦点、局部横向滚动和按需展开的完整来源。
- **Do** 将同比增减两榜放在一个默认折叠入口中，内部默认全阶段，展开后桌面并列、手机堆叠。

### Don't:

- **Don't** 把旧原型的刷新重置确认规则复制到生产模块。
- **Don't** 将确认状态说成真实调价、广告或消息已经执行。
- **Don't** 为简化摘要而把缺失值填零、混用目标范围或重复累加共享库存。
- **Don't** 将未被生产组件使用的原型样式宣称为正式弹窗规范。
- **Don't** 给同比排名增加常驻日期或解释长句，或把缺失值和去年为零显示为虚构增长率。
