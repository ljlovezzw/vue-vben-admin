# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing Vue 3 + TypeScript + Vben Admin 5.7 application with Ant Design Vue.

## Users

Amazon beer-dress operators and their managers. Operators use the page each workday to decide which SKU/SPU needs a price, promotion, inventory, or sales-pacing action; managers use it to see unresolved P0/P1 exceptions and progress by owner.

## Product Purpose

The beer-dress sales calendar turns the supplied planning workbook into a live operational view. It combines the seasonal calendar, current phase, operator-level beer-dress sales targets, sales progress, price, inventory coverage, and actionable warnings so the team can act on the highest-risk items first.

## Operating Context

The page is expected to refresh daily around 09:30 and is used alongside the existing analytics, product-detail, FBA inventory, profit, and Feishu notification workflows. The supplied workbook at `E:/Download/啤酒服售价库存预警与飞书看板.xlsx` is an initialization/reference asset, not the production database.

## Capabilities and Constraints

- Keep the current Vben/Ant Design product UI and authentication/permission model.
- Use existing product-expression, product-life, FBA inventory, profit, and operator-target data wherever possible.
- Beer-dress scope is Germany and the existing `啤酒服` category/project-tag rules; preserve the shared shop-scope rule and do not permanently delete `Funspread-US` snapshot data.
- Sales targets come from the beer-dress operator target aggregation already represented in `operator_targets` (the workbook's `啤酒服定目标-数据源` concept).
- The page must show phase/calendar context, target-versus-actual progress, inventory coverage, price/promotion guidance, warning priority, and an action queue. Exact thresholds not already confirmed by code remain configurable or explicitly marked as provisional.
- Important states include loading, missing source data, normal/monitoring, P1 warning, P0 urgent, and completed action.

## Evidence on Hand

- Reference screenshot supplied by the user: beer-dress operations warning dashboard.
- Initialization workbook: `E:/Download/啤酒服售价库存预警与飞书看板.xlsx`.
- Existing backend beer-dress daily notification service: `E:/junlee/Kanban/beer_dress_product_detail_notification_service.py`.
- Existing seasonal planning service and schema: `E:/junlee/Kanban/seasonal_planning_service.py` and seasonal tables in `db.py`.

## Product Principles

- Put today's decisions before historical detail.
- Show the calculation basis beside every warning.
- Treat inventory and sales targets as time-series facts, not static labels.
- Keep operator ownership and follow-up state explicit.
- Preserve auditable source data and make provisional rules visible.
