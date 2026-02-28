# 迭代改动记录（面试通 / mianshitong）

目的：长期项目需要可追溯性。这里记录“每次迭代我们做了什么功能/改动”，便于回看进度、定位回归、规划下一步。

约定：

- 每次完成一个可运行增量（哪怕很小），就在顶部追加一条新记录（新在上）。
- 每条记录尽量包含：目标、主要改动、破坏性变更/迁移、下一步。

---

## Iteration 1（2026-02-27）：Monorepo 工程骨架 + 规范工具落地

### 目标

- 搭建可持续迭代的仓库骨架：轻量 monorepo（pnpm workspaces）+ 两个 Next.js 应用（web/admin）+ 可复用 packages。
- 先把工程规范与质量工具跑通：格式化、Lint、拼写检查、提交规范、单测、TypeScript typecheck。

### 主要改动

- Monorepo 结构落地：`apps/web`、`apps/admin`、`packages/*`（含 placeholder）。
- 新增协作约定：根目录 `AGENTS.md`，约束“每次改动后必须更新文档 + 跑规范命令 + 第三方库使用 Context7 查最新文档”。
- 各 workspace 包支持绝对导入：为 `apps/*` 与 `packages/*` 的 `tsconfig.json` 增加 `baseUrl` + `paths`（`@/* -> ./src/*`），便于在各自 `src/` 下使用 `@/` 前缀导入。
- Docker 部署骨架：启用 Next.js `output: 'standalone'`，新增根 `Dockerfile` + `compose.yaml`（web/admin/db），并补充 `.dockerignore`。
- 调整默认模板：移除 `next/font/google`（避免构建时从 Google Fonts 拉取资源导致 `pnpm build`/Docker build 在受限网络下失败）。
- 配置复用收敛：新增 `packages/config`（共享 tsconfig 模板），apps/packages 的 `tsconfig.json` 统一 extend 该模板，减少重复配置与漂移。
- 规范工具：
  - Prettier：`.prettierrc.cjs`、`.prettierignore`、`pnpm format/*`
  - ESLint（flat config）：根 `eslint.config.mjs` + apps 内 `eslint.config.mjs`
  - cSpell：`cspell.json` + `pnpm spellcheck`
  - Git hooks：Husky（`.husky/*`）+ lint-staged（pre-commit）
  - 提交规范：commitlint（`commitlint.config.cjs` + commit-msg hook）
  - 单测：Vitest（`vitest.config.ts` + `packages/shared` 示例测试）
- 基础 TS 配置：`tsconfig.base.json`，apps 的 `tsconfig.json` 继承 base。
- Next.js monorepo 适配：在 `apps/*/next.config.ts` 配置 `outputFileTracingRoot`，并预留 `transpilePackages`。

### 迁移/破坏性变更

- 无

### 下一步

- 开始 MVP 闭环编码：以 `apps/web` 的 API 为入口，接入 `packages/interview-engine` + `packages/llm`（先 MockProvider）。

## Iteration 0.1（2026-02-27）：架构选型讨论记录（Monorepo vs 单体）

### 目标

- 开始讨论整体项目架构与仓库形态，并把讨论上下文沉淀到文档，避免后续反复对齐。

### 主要改动

- 更新 `docs/ProjectContext.md`：记录 monorepo 与单体架构的备选方案、初步倾向与待确认问题。

### 迁移/破坏性变更

- 无

### 下一步

- 已确认：会做 admin/题库后台；后端先放在 Next.js；未来可能复用。
- 下一步：落地 pnpm workspaces 的轻量 monorepo 目录结构（`apps/web` + `apps/admin` + `packages/*`），并以 `apps/web` 先跑通 MVP 闭环。

## Iteration 0（2026-02-26）：文档初始化 + 项目约束落地

### 目标

- 明确产品定位与 MVP 范围
- 固化评分与结构化输出协议
- 建立“上下文/迭代”沉淀机制

### 主要改动

- 新增 PRD：`docs/PRD.md`
- 新增评分 Rubric：`docs/Rubric.md`
- 新增 Prompt 规范：`docs/PromptSpec.md`
- 新增长期上下文沉淀：`docs/ProjectContext.md`
- 新增迭代记录：`docs/IterationLog.md`
- 新增 `env.example` 与 `.gitignore`（禁止提交 `.env.local` 等密钥文件）

### 关键决定（本迭代确认）

- 产品名与定位：面试通（mianshitong）= 你的专属 AI Agent 面试官；专注编程领域/前端；涵盖简历优化、模拟面试、面试题解答（MVP 先做模拟面试闭环）
- 模型与接口：DeepSeek，OpenAI-compatible，Base URL `https://api.deepseek.com`，模型 `deepseek-chat`
- 默认体验：中文；面试结束统一总结（非每题即时反馈）
- 规划技术栈：Next.js + Prisma + PostgreSQL + Docker

### 迁移/破坏性变更

- 无

### 下一步

- 决策 AI 编排框架：LangChainJS vs LangGraphJS（可组合）
- 进入编码迭代：搭建 Next.js + Prisma + PostgreSQL + Docker 的最小可运行闭环
