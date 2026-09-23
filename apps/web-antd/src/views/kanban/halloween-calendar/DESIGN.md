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

以清楚的日期、数字、当前负责人和建议动作为阅读主体。七阶段时间轴接在筛选之后，完整商品、排期和来源通过弹窗按需展开；保留生产应用的 Ant Design Modal 行为。视觉规则以同目录 `style.css` 和 `index.vue` 的有效样式为依据，原型中未被生产组件使用的原生 `dialog` 样式不是生产弹窗规范。

**Key Characteristics:**

- 单一暖纸面板，深绿标题与细线分区。
- 五项摘要、六项分组和八条主区待办保持紧凑密度。
- 英文分类、当前归属与库存字段直接相邻。
- 日历进度、销售进度和处理确认使用各自明确的文字。

## Colors

深绿构成标题、主要操作和当前阶段，橙色承担链接与销售进度，浅绿承担分组和日历时间进度。frontmatter 是本文件的颜色值来源；下述名称只解释用法。

`.impeccable/design.json` 的八阶 OKLCH 色带仅供设计面板预览，由已用颜色合成，不是生产 CSS 新增的色阶。组件片段抽取现有有效样式，演示数字不代表实时数据。

### Primary

- **深绿墨色（ink）：** 页面文字、标题栏、主要按钮、选中维度和当前阶段圆点。
- **沉稳进度绿（group-progress）：** 分组完成率与阶段日历进度；文字必须继续说明其不同含义。

### Secondary

- **陶土橙（orange）：** 次要入口、总销售进度和键盘焦点。
- **深暖警示色（risk）：** 需要处理的建议、库存提醒值和提示徽标文字。
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

生产内容置于现有应用壳内，纸面板最大宽度 1180px，常规左右留白使用 desktop-gutter。结构顺序为标题、筛选、七阶段、当前安排、五项指标、销售进度、分组进度、优先待办与次要入口。

桌面分组两列，每页最多六项；主区最多八条待办。完整商品／待办清单通过 960px Ant Design Modal 打开，每页十行。业务来源、库存来源和目标来源按需展开，不把所有证据一次铺满主页面。

不超过 800px 时侧边内容收窄。不超过 600px 时，部门筛选独占一行，站点与负责人在下一行；分组变成单列；五项指标按三项加两项排列；待办操作移到事项内容下方。详情摘要与库存字段变为两列。

时间轴保持七阶段完整顺序，在桌面最小宽度 780px、手机 750px 的局部容器内横向滚动。滚动容器可获键盘焦点；当前阶段使用 `aria-current="step"`。普通表格保持局部滚动；运营排期表在手机固定列宽并换行，避免整个页面横溢。

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

七阶段紧接顶部筛选，日期、名称和当前阶段同时可读。2026-09-21 的第三阶段显示 6/15 天，旁注明“仅表示时间经过，不代表任务完成”。总销售进度使用橙色条；分组和日历时间使用绿色条。条宽限制在 0%—100%，业务数值仍按实际计算结果展示。

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

### Don't:

- **Don't** 把旧原型的刷新重置确认规则复制到生产模块。
- **Don't** 将确认状态说成真实调价、广告或消息已经执行。
- **Don't** 为简化摘要而把缺失值填零、混用目标范围或重复累加共享库存。
- **Don't** 将未被生产组件使用的原型样式宣称为正式弹窗规范。
