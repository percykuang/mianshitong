# Admin App

面试通管理后台。基于 Next.js，直接使用 Prisma 读取数据库，负责内容运营与后台分析。

## 主要能力

- 管理员登录
- 题库管理
- 知识文档管理
- 会话管理与 Trace 查看
- 知识检索概览分析

## 本地启动

在仓库根目录执行：

```bash
pnpm db:up
pnpm db:migrate:deploy
pnpm dev:admin
```

默认地址：`http://127.0.0.1:3001`

## 关键目录

- `src/app`：页面与 API 路由
- `src/components`：后台通用 UI 与业务组件
- `src/lib`：鉴权、分页、筛选与后台聚合逻辑
- `e2e`：后台 Playwright 用例

## 常用命令

```bash
pnpm -C apps/admin dev
pnpm -C apps/admin build
pnpm -C apps/admin lint
pnpm -C apps/admin typecheck
```

E2E 请在仓库根目录执行：

```bash
pnpm test:e2e:admin
```
