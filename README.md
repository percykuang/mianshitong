# 面试通（mianshitong）

你的专属 AI Agent 面试官。当前仓库已覆盖 Web 端对话、Admin 管理后台、知识检索增强、题库与评测等能力。

## 仓库结构

- `apps/web`：主站，基于 Next.js App Router，承载用户页面与聊天/API 主链路
- `apps/admin`：管理后台，基于 Next.js，直接读取 Prisma 数据并维护题库、文档、会话与检索分析
- `packages/db`：Prisma Schema、数据库脚本与类型导出
- `packages/llm`：模型 Provider 抽象
- `packages/retrieval`：知识文档/题库检索与切块相关能力
- `packages/interview-engine`：模拟面试引擎
- `packages/shared`：共享类型、常量与通用工具
- `packages/evals`：离线评测与回归样例
- `docs`：项目上下文、迭代记录、架构与规范文档

## 本地开发

```bash
pnpm install
pnpm db:up
pnpm db:migrate:deploy
pnpm dev:web
pnpm dev:admin
```

默认端口

- web: 3000（绑定 127.0.0.1）
- admin: 3001（绑定 127.0.0.1）

首次进入仓库前，建议先阅读：

- `docs/ProjectContext.md`
- `docs/IterationLog.md`
- `AGENTS.md`

## 数据库快捷命令（PostgreSQL）

```bash
# 启动/停止/状态
pnpm db:up
pnpm db:down
pnpm db:status

# 查看日志
pnpm db:logs

# 进入 psql
pnpm db:psql

# 图形化查看数据（Prisma Studio）
pnpm db:studio

# 按迁移更新数据库结构（开发）
pnpm db:migrate

# 清空数据库并按迁移重建（危险操作）
pnpm db:reset

# 快速查看最近 50 条 AuthUser
pnpm db:users
```

## 质量校验

```bash
pnpm verify
pnpm test:e2e:web
pnpm test:e2e:admin
```

其中 `pnpm verify` 会统一执行格式、Lint、类型、单测与拼写检查。

## Docker（本地/部署）

本仓库使用 Next.js `output: 'standalone'` 构建最小运行产物，并用 Docker Compose 编排多个容器（web/admin/db）。

```bash
docker compose up --build
```

- web: `http://127.0.0.1:3000`
- admin: `http://127.0.0.1:3001`
