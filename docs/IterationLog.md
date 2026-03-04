# 迭代改动记录（面试通 / mianshitong）

目的：长期项目需要可追溯性。这里记录“每次迭代我们做了什么功能/改动”，便于回看进度、定位回归、规划下一步。

约定：

- 每次完成一个可运行增量（哪怕很小），就在顶部追加一条新记录（新在上）。
- 每条记录尽量包含：目标、主要改动、破坏性变更/迁移、下一步。

---

## Iteration 2.12（2026-03-04）：聊天页模块化重构 + 输入/滚动/Markdown 体验增强

### 目标

- 提升聊天页与核心包的可维护性（控制单文件行数，避免超长文件持续膨胀）。
- 补齐关键交互体验：回车发送、自动滚底、Markdown + 代码高亮。

### 主要改动

- 聊天页重构（`apps/web/src/app/chat`）：
  - 将原 `ChatClient.tsx`（超长）拆分为 `components/*`、`hooks/*`、`lib/*`；
  - 新增 `use-chat-controller`、`use-send-message`，把会话状态、SSE 消费、发送流程从 UI 层抽离；
  - 新增 `use-auto-scroll`，在消息条数变化、最后一条内容变化、流式发送过程中都自动滚动到底部。
- 输入交互增强：
  - `Enter` 直接发送；
  - `Shift + Enter` 保留换行；
  - 处理输入法组合态（`isComposing`）避免误发送。
- Markdown 渲染与代码高亮：
  - 新增 `ChatMarkdown` 组件；
  - 接入 `react-markdown + remark-gfm + react-syntax-highlighter`；
  - 支持列表、标题、行内代码、fenced code block 语法高亮。
- 核心包拆分（控制文件规模）：
  - `packages/interview-engine` 拆分为 `session-core`、`scoring`、`process-helpers`、`process-session-message`、`session-factory`；
  - `packages/shared` 拆分为 `contracts/defaults/utils`；
  - `packages/question-bank` 拆分为 `question-data/plan-builder`。
- 验证：
  - 通过 Playwright 对 `/chat` 进行交互回归，确认回车发送、Shift+Enter 换行、自动滚底及 Markdown 渲染均生效。

### 迁移/破坏性变更

- 无外部 API 破坏性变更；主要是内部模块重组与前端体验增强。

### 下一步

- 增加聊天消息渲染层的单元测试（Markdown/code block/长文本回归）。
- 为 SSE 流程补充取消请求与重试策略（Abort + retry/backoff）。

## Iteration 2.11（2026-03-03）：环境配置收敛为统一变量名（同名变量、不同环境值）

### 目标

- 简化配置复杂度，移除代码中的 `DEV_*/PROD_*` 分流逻辑，改为“同名变量 + 不同环境注入值”。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`：
  - 移除 `APP_ENV` + `DEV_/PROD_` 读取逻辑；
  - 统一只读取 `LLM_PROVIDER`、`OLLAMA_*`、`DEEPSEEK_*`。
- `env.example`：
  - 重写为单一变量模板，明确“本地 `.env.local` / 线上平台同名变量”实践。
- 新增文档：
  - `docs/EnvDeployment.md`，补充本地配置与 Docker Compose 线上注入示例。
- 清理：
  - 删除 `env.development.example` 与 `env.production.example`，避免配置入口分散。

### 迁移/破坏性变更

- 若此前依赖 `DEV_*` / `PROD_*` 覆盖变量，需要改回同名通用变量。

### 下一步

- 增加 provider 启动时配置校验（缺少关键变量时输出更明确的错误提示）。

## Iteration 2.10（2026-03-03）：双环境配置（开发/线上）与 APP_ENV 分流

### 目标

- 支持本地开发与线上环境使用不同配置，并通过环境变量自动选择生效配置。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`：
  - 新增 `RuntimeProfile`（`development` / `production`）与 `resolveRuntimeProfile`。
  - 新增 `readEnvByProfile`：优先读取 `DEV_*` 或 `PROD_*`，不存在时回退通用变量。
  - provider 选择与模型参数读取统一走 profile 分流（Ollama / DeepSeek 均支持）。
  - SSE `start` 事件附带当前 profile，便于调试确认环境命中。
- 环境配置模板：
  - 重写 `env.example`，移除真实密钥并补齐 `APP_ENV + DEV_/PROD_` 变量约定。
  - 新增 `env.development.example`（本地示例）与 `env.production.example`（线上示例）。

### 迁移/破坏性变更

- 无破坏性变更；旧的通用变量（如 `LLM_PROVIDER`、`DEEPSEEK_*`）仍可继续使用。

### 下一步

- 补充一页“部署环境变量清单”文档，包含 Vercel/服务器两套示例。

## Iteration 2.9（2026-03-02）：支持通过环境变量切换 Ollama / DeepSeek 付费 API

### 目标

- 在不改动前端 SSE 协议的前提下，通过环境变量切换底层模型提供方（本地 Ollama / DeepSeek 付费 API）。

### 主要改动

- `packages/llm/src/index.ts`：
  - 新增 `DeepSeekStreamChatProvider`，使用 OpenAI-compatible `chat/completions` 流式接口。
  - 解析 DeepSeek SSE chunk（`data: ...` + `[DONE]`），按 `choices[0].delta.content` 增量输出 token。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`：
  - 抽象 `createStreamProvider`，根据 `LLM_PROVIDER` 动态选择 `ollama` 或 `deepseek`。
  - 统一保留 SSE 事件协议（`start/delta/done/error/end`），前端无感切换。
  - 根据会话模型选择映射到 `DEEPSEEK_MODEL` / `DEEPSEEK_REASONER_MODEL`。
- `env.example`：
  - 明确 `LLM_PROVIDER` 可选值；
  - 增加 `DEEPSEEK_REASONER_MODEL`，补齐双模型映射配置。

### 迁移/破坏性变更

- 无破坏性变更；仅增加 provider 切换能力。

### 下一步

- 增加 provider 级重试与超时配置（按模型维度可配置）。
- 为 DeepSeek 流式解析补充单元测试。

## Iteration 2.8（2026-03-02）：接入 Ollama + SSE 流式聊天（基础对话能力）

### 目标

- 基于现有架构落地“可用的 AI 对话”主链路，支持服务端 SSE 流式输出，便于本地用 Ollama 调试。

### 主要改动

- 服务端流式接口：
  - 新增 `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`。
  - 使用 `ReadableStream + text/event-stream` 向前端持续推送 `start/delta/done/error/end` 事件。
  - 将 Ollama 的 NDJSON 流式响应（`/api/chat`）转换为 SSE delta 推送。
- LLM Provider 扩展：
  - `packages/llm/src/index.ts` 新增 `OllamaStreamChatProvider`，抽象 `streamChat` 能力。
  - 兼容 Ollama `message.content` / `response` 两种 chunk 字段格式。
- 会话存储扩展：
  - `apps/web/src/lib/server/chat-store.ts` 新增 `appendChatExchange`，用于把“用户消息 + 助手回复”持久化到会话内存存储。
- 前端流式渲染：
  - `apps/web/src/app/chat/ChatClient.tsx` 将发送逻辑改为调用 SSE 接口并按 `delta` 增量更新最后一条助手消息。
  - 保留发送中状态、错误提示与会话列表刷新。
- 配置与依赖：
  - `env.example` 新增 Ollama 相关变量（`OLLAMA_BASE_URL`、`OLLAMA_MODEL`、`OLLAMA_REASONER_MODEL`），默认 `LLM_PROVIDER=ollama`。
  - `apps/web/package.json` 增加 `@mianshitong/llm` 依赖。
  - `cspell.json` 补充 `ollama`、`ndjson` 词条。

### 迁移/破坏性变更

- `POST /api/chat/sessions/[sessionId]/messages` 仍保留（兼容旧逻辑），前端主链路已切换到新的 SSE 接口。

### 下一步

- 增加 DeepSeek 付费 API Provider，实现与 Ollama 同一接口下的可切换部署。
- 补充 SSE 解析与流式 provider 的单元测试覆盖。

## Iteration 2.7（2026-03-02）：/chat 消息区视觉对齐与发送后稳定性回归（第六轮）

### 目标

- 继续收敛 `/chat` 页面与目标样式的差异，重点修复“发送后排版观感不一致”的问题。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`：
  - 侧栏默认策略改为桌面端初始展开（移动端首屏自动收起），与主内容宽度分配一致。
  - 顶栏移除冗余 `New Chat` 按钮，收敛为“侧栏开关 + Private + 使用指南”主链路。
  - 消息区重构为更接近目标形态：
    - 用户消息：右侧小气泡 + 编辑/复制操作；
    - 助手消息：左侧图标 + 文本流 + 复制/反馈操作。
  - 保持“消息区滚动 + 底部输入区固定”结构不变，避免回归此前发送后输入区上浮问题。
- Playwright 回归验证：
  - 发送消息后再次核对输入区底部位置与消息区滚动边界，确认布局稳定。

### 迁移/破坏性变更

- 无，属于前端展示层与交互细节收敛。

### 下一步

- 继续优化移动端按钮触达面积与顶部间距，完成本轮像素级收尾。

## Iteration 2.6（2026-03-02）：/chat 发送后布局错乱修复

### 目标

- 修复 `/chat` 页面在发送消息后输入区上浮、消息区与输入区层级错乱的问题。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`：
  - 将聊天主体改为稳定的 `flex` 纵向布局：消息区 `flex-1 + overflow-y-auto`，输入区固定在底部容器。
  - 移除导致错位的 `absolute + sticky` 组合，改为“滚动消息区 + 底部输入区”结构。
  - 保留既有消息渲染逻辑与会话接口调用，确保仅修复布局，不影响业务流程。
- Playwright 验证：
  - 在本地复现“发送消息后布局错乱”问题并截图；
  - 修复后再次发送消息，确认布局稳定且输入区保持底部对齐。

### 迁移/破坏性变更

- 无，属于前端布局修复。

### 下一步

- 继续做移动端细节（按钮间距与触达面积）收尾优化。

## Iteration 2.5（2026-03-02）：聊天输入区与会话列表细节微调（第五轮）

### 目标

- 继续收敛聊天页细节，提升首屏观感一致性与交互紧凑度。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`：
  - 快捷问题按钮改为左对齐并优化行高，长文本可读性更稳定。
  - 会话列表项去除右侧时间标签，统一列表视觉节奏。
  - 输入区底部控件布局收紧，移除冗余文件入口显示，聚焦模型选择与发送动作。
  - 文本域补齐宽度约束，避免窄屏下出现输入区域错位。
  - 顶栏边框样式回收，保持与内容区过渡更自然。

### 迁移/破坏性变更

- 无业务协议变化，仅聊天页 UI 细节调整。

### 下一步

- 继续优化移动端侧栏开关与顶部按钮触达区域，完成本阶段像素级收尾。

## Iteration 2.4（2026-03-02）：聊天页侧栏与布局微调（第四轮）

### 目标

- 在不改动业务逻辑的前提下，继续优化聊天页布局细节与交互一致性。

### 主要改动

- 聊天页微调（`apps/web/src/app/chat/ChatClient.tsx`）：
  - 侧栏改为 `translate` 方式收起/展开，统一桌面与移动端 off-canvas 过渡表现。
  - 主区域增加最小高度约束，避免折叠状态下出现跳动感。
  - 顶部工具栏补齐底边框，强化层级分隔。
  - 根容器增加横向溢出保护，避免动画期间出现横向滚动条。

### 迁移/破坏性变更

- 无，均为样式与交互层微调。

### 下一步

- 继续细调消息卡片与输入区间距，完成最后一轮像素级打磨。

## Iteration 2.3（2026-03-02）：品牌与文案去竞品化清理

### 目标

- 移除仓库内与外部网站相关的命名、链接与描述，统一为面试通自身品牌表达。

### 主要改动

- 品牌文案统一：
  - 将页面与聊天页中的品牌名统一为“面试通”，移除历史命名。
- 外部链接清理：
  - 首页 CTA 与页脚外链改为项目内文案/占位链接，移除第三方站点引用。
  - 聊天页顶部入口统一为“使用指南”并指向站内页面。
- 文档去竞品化：
  - `docs/ProjectContext.md`、`docs/IterationLog.md` 中移除对外部网站与“仿站/对齐”描述，改为项目自有迭代叙述。
- 配置同步：
  - `cspell.json` 移除历史外部品牌词条，保持词库与当前品牌一致。

### 迁移/破坏性变更

- 无业务逻辑变更，属于文案与配置层清理。

### 下一步

- 继续进行 UI 微调与交互打磨，保持品牌文案与视觉规范一致。

## Iteration 2.2（2026-03-02）：Tailwind + shadcn UI 精修（第三轮）

### 目标

- 在不改动现有聊天业务闭环（会话 API / Interview Engine）的前提下，继续做高保真像素级打磨。
- 将前端样式体系统一到 Tailwind + shadcn 组件形态，减少手写样式偏差。

### 主要改动

- `apps/web` UI 继续优化：
  - 重写首页 `src/app/page.tsx`，统一容器节奏、Hero 结构、功能卡片、CTA 与页脚布局。
  - 重写聊天页 `src/app/chat/ChatClient.tsx`，统一侧栏/顶部工具栏/消息区/建议提问/输入卡片的尺寸与层级。
  - 将全局主题变量 `src/app/globals.css` 收敛为统一语义色板与圆角体系（Tailwind token 收敛）。
- shadcn 组件增强：
  - 新增 `sidebar/sheet/tooltip/skeleton/use-mobile` 相关组件与 hook。
  - 同步更新 `button/input/separator` 以匹配 shadcn 最新生成结构。
- 文案与细节同步：
  - `packages/shared/src/index.ts` 的快捷提问文案统一为项目默认提示。
  - `cspell.json` 新增 `shadcn`、`nums` 词典，修复拼写检查报错。

### 迁移/破坏性变更

- 无业务协议变更（API 与数据结构保持兼容）。
- UI 结构有较大改动，属于前端展示层重构。

### 下一步

- 继续做细节打磨：侧栏折叠动画、输入区微间距、移动端按钮排序与 hover/active 态。
- 补齐剩余像素差异（尤其 chat 首屏和会话项状态样式）。

## Iteration 2.1（2026-02-28）：UI 高保真优化（第二轮）

### 目标

- 将 `apps/web` 的视觉与交互进一步统一，从“风格接近”提升到“结构与细节更完整”。

### 主要改动

- Landing 页二次重构：
  - 调整为更完整的产品版式（顶部导航、居中 Hero、四个亮点标签、核心功能卡片、演示区、深色 CTA、底部链接区）。
  - 统一字体尺寸、边框半径、色值与间距节奏，移除上一版偏强的渐变风格。
- `/chat` 页二次重构：
  - 新增可折叠左侧栏（含品牌、会话列表、Guest 区域），并按桌面/移动端适配显示。
  - 顶部工具栏样式优化为统一布局（图标按钮 + Private 标签 + 功能入口）。
  - 调整消息区与输入区结构：快捷提问胶囊、文件入口、输入卡片、上下文按钮、模型选择与发送圆按钮。
- 全局视觉变量微调：
  - `apps/web/src/app/globals.css` 更新为统一的中性色与边框体系。

### 迁移/破坏性变更

- 无

### 下一步

- 继续做“像素级”细节打磨（图标、hover 动效、阴影层级、响应式断点下的间距微调）。

## Iteration 2（2026-02-28）：Web UI + 面试闭环（Mock Provider）

### 目标

- 按既有 monorepo 架构实现可运行的“首页 + Chat + 面试流程 + 报告”闭环。
- 在不引入后端独立服务的前提下，用 `apps/web` BFF 路由串起会话与面试状态。

### 主要改动

- `apps/web`：
  - 重做首页 UI（Hero、功能卡片、CTA、页脚链接），统一视觉与信息架构。
  - 新增 `/chat` 页面（侧边会话列表、New Chat、Private 切换、快捷提问、模型选择、文件选择入口、消息流）。
  - 新增 API 路由：`/api/chat/sessions`、`/api/chat/sessions/[sessionId]`、`/api/chat/sessions/[sessionId]/messages`。
  - 新增服务端内存会话存储：`src/lib/server/chat-store.ts`（MVP 阶段无数据库依赖）。
- `packages/shared`：
  - 落地领域类型：会话、消息、面试配置、评分维度、报告结构、API 请求/响应协议。
  - 增加默认配置与快捷提示词常量。
- `packages/question-bank`：
  - 落地静态题库（前端/React/Vue/工程化/性能/网络/安全/Node）。
  - 增加按 topic + level + questionCount 的选题计划函数。
- `packages/llm`：
  - 增加 `LlmProvider` 抽象与 `MockLlmProvider`，支持普通问答、开场、追问、单题反馈、总结报告文案生成。
- `packages/interview-engine`：
  - 实现会话状态机：`idle -> interviewing -> completed`。
  - 实现追问判定、单题评估、维度评分聚合、报告生成、会话摘要转换。
  - 新增单元测试覆盖“启动面试 + 追问 + 完成总结”主流程。
- 工程配置：
  - 根 `eslint.config.mjs` 增加 TypeScript 解析能力（`typescript-eslint`），修复 packages 下 `.ts` lint 解析问题。
  - `apps/web` / `apps/admin` 补充 `tsconfig` 路径别名，确保 `@/*` 在 App Router 中可解析。

### 迁移/破坏性变更

- 无破坏性变更。
- 当前会话存储为内存态，服务重启后会话会清空（MVP 预期行为）。

### 下一步

- 对接 `DeepSeekProvider`（真实模型调用、失败重试、结构化输出校验）。
- 接入 Prisma + PostgreSQL 持久化会话与题库，并在 `apps/admin` 实现题库 CRUD。

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
