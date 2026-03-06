# 面试通（mianshitong）

你的专属 AI Agent 面试官（MVP：模拟面试闭环）。

## Repo 结构（轻量 Monorepo）

- `apps/web`: 主站（Next.js，全栈：UI + API，作为后端入口）
- `apps/admin`: 管理端（Next.js UI，通过调用 `apps/web` 的 API）
- `packages/*`: 可复用能力（db/llm/interview-engine/shared/question-bank 等）

## 本地开发

```bash
pnpm install
pnpm dev:web
pnpm dev:admin
```

默认端口：

- web: 3000（绑定 127.0.0.1）
- admin: 3001（绑定 127.0.0.1）

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

## Docker（生产形态）

本仓库使用 Next.js `output: 'standalone'` 构建最小运行产物，并用 Docker Compose 编排多个容器（web/admin/db）。

```bash
docker compose up --build
```

- web: `http://127.0.0.1:3000`
- admin: `http://127.0.0.1:3001`

## 规范工具

```bash
pnpm lint
pnpm format
pnpm spellcheck
pnpm test
```
