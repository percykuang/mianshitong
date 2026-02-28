# 项目上下文（面试通 / mianshitong）

目的：把我们对这个长期项目的关键决定与阶段性结论沉淀在这里，避免上下文丢失。后续每次对话产生的重要结论、变更点、待确认事项，都应追加到“对话摘要日志”。

## 一句话定位

面试通（mianshitong）：你的专属 AI Agent 面试官。专注编程领域，尤其前端开发；提供简历优化、模拟面试、面试题解答等全方位面试辅导服务。

## 当前已确定的关键决定

- 项目目录：`/Users/percy/Desktop/mianshitong`
- 模型：最终使用 DeepSeek；部署到国内服务器；需要 Provider 抽象以便替换/兼容不同接口形态
- MVP 优先级：先做“模拟面试（Interview Agent）”闭环（配置 -> 对话 -> 报告）
- 先写文档再开工：从 PRD/Rubric/PromptSpec 起步
- 技术栈（你已选定）：Next.js + Prisma + PostgreSQL + Docker
- 迭代记录：每次实现功能/改动都追加到 `docs/IterationLog.md`

## 已创建的文档

- `docs/PRD.md`：MVP 范围与里程碑
- `docs/Rubric.md`：评分维度与结构化评价建议
- `docs/PromptSpec.md`：面试官提示词与结构化输出协议
- `docs/IterationLog.md`：迭代改动记录（每次变更追加）
- `docs/GitConventions.md`：Git/Commit 规范（Conventional Commits）
- `AGENTS.md`：协作约定与“每次改动后的必做清单”（避免忘记更新文档/跑规范）
- `env.example`：环境变量占位（DeepSeek 配置待确认）

## 待确认清单（会影响实现）

- DeepSeek 接口是否 OpenAI-compatible：Base URL、鉴权方式、模型名、是否支持 JSON 模式/工具调用
- 题库方向优先级：React/Vue/工程化/性能/网络 等
- 默认语言与风格：中文为主还是中英混合；“每题反馈”还是“结束统一总结”

## 对话摘要日志

### 2026-02-26

- 你确认产品名为 mianshitong（面试通），定位“你的专属 AI Agent 面试官”，范围包含：简历优化、模拟面试、面试题解答；但 MVP 先做前端模拟面试闭环。
- 你确认最终会部署到国内服务器，并使用 DeepSeek 作为大模型。
- 已落地文档：PRD / Rubric / PromptSpec；并新增本文件用于长期沉淀上下文。
- 你确认 DeepSeek 为 OpenAI-compatible 接口：Base URL 为 `https://api.deepseek.com`，模型为 `deepseek-chat`；默认语言中文；反馈节奏为“结束统一总结”。（API Key 不写入仓库，仅放 `.env.local`）
- 你计划采用技术栈：Next.js + Prisma + PostgreSQL + Docker；并希望对比选择 LangChainJS vs LangGraphJS 作为 AI 编排框架。

### 2026-02-27

- 我们开始讨论项目总体架构与是否采用 monorepo。
- 备选方向：
  - 单体仓库 + 单个 Next.js 全栈应用：前端 + API Routes/Server Actions；适合 MVP 快速闭环、部署简单。
  - 轻量 monorepo（pnpm workspaces）：`apps/web`（Next.js）+ `packages/*`（db/llm/interview-engine/shared-types 等）；便于后续增加 admin、更多 Agent 模块、复用协议与类型。
- 结论：采用“轻量 monorepo（pnpm workspaces）”，但先不引入 Turborepo 等额外编排工具，保持简单。
- 已确认的约束：
  - 会做 admin/题库后台（因此需要多应用或至少多入口 UI）
  - 后端先全放在 Next.js 里（短期不单独拆 `apps/api`）
  - 未来有可能复用（Prompt/协议/Provider/题库/引擎等需要沉淀为可复用包）
- 对“前后端分离”的理解（项目约定）：
  - 前后端分离优先指“职责/边界分离”（UI 层、API 层、领域层、基础设施层），不强制要求不同仓库或不同进程部署。
  - 现阶段采用 Next.js 全栈形态更接近 BFF（Backend For Frontend）：`apps/web` 同时承载 UI 与服务端 API，但通过 `packages/*` 维持清晰分层；未来如需独立扩容/异构技术栈，再拆 `apps/api`。
- 推荐目录（可随实现微调）：
  - `apps/web`：主站（C 端 + API，作为“后端入口”）
  - `apps/admin`：管理端（题库/配置/会话查看等；通过调用 `apps/web` 的 API）
  - `packages/db`：Prisma schema/migrations/client（供 `apps/*` 复用）
  - `packages/llm`：Provider 抽象 + DeepSeekProvider + JSON 输出校验/修复与重试策略
  - `packages/interview-engine`：面试流程/状态机（选题、追问、收束、结束、报告聚合）
  - `packages/shared`：结构化协议 types +（可选）schema 校验（与 PromptSpec 对齐）
  - `packages/question-bank`：静态题库与选题策略（后续可替换为 DB/后台编辑）
- 工程落地（骨架阶段）：已搭建 pnpm workspaces 轻量 monorepo + Next.js 双应用（web/admin）+ `packages/*`，并跑通 Prettier/ESLint/cSpell/commitlint/Husky/lint-staged/Vitest/TypeScript typecheck 等工程规范工具链。
- 协作约定（防止上下文丢失）：新增 `AGENTS.md`，约定“每次做完改动必须更新 `docs/IterationLog.md`/`docs/ProjectContext.md` 并跑规范命令”。
- 协作约定（上下文优先）：开始任何实现/改动前，必须先阅读 `docs/ProjectContext.md`，作为项目单一事实来源（SSOT）之一，用于快速了解当前架构与迭代状态。
- 部署方向（Docker）：采用 Next.js `output: 'standalone'` 作为生产构建形态；用 Docker Compose 编排 `web`、`admin`、`db(PostgreSQL)` 多容器（当前阶段先暴露端口直连，后续可加 Nginx 反代）。
- 配置复用（收敛）：新增 `packages/config` 作为共享配置包（当前先共享 tsconfig 模板），减少 apps/packages 重复配置，降低后续维护漂移风险。
