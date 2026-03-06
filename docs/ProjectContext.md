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

### 2026-02-28

- 你确认要在当前项目架构内实现统一的产品化 UI 与核心交互体验，并先以 `apps/web` 完成闭环验证。
- 实现策略采用“先 Web 闭环、再真实模型与持久化”：先完成 `apps/web` 首页 + `/chat` + BFF API，再接入 DeepSeek 与数据库。
- 已落地的闭环能力：
  - `apps/web`：Landing 页、Chat 页（会话侧栏、New Chat、Private、快捷提问、模型切换、消息流）；
  - API：`/api/chat/sessions` + `.../[sessionId]` + `.../messages`；
  - `packages/interview-engine`：会话状态机、追问、评分与报告；
  - `packages/llm`：`LlmProvider` 抽象 + `MockLlmProvider`。
- 当前约束（已明确）：会话存储仍为内存态（重启即清空），属于 MVP 阶段可接受实现；下一步再接 Prisma + PostgreSQL。
- 工程同步调整：为 monorepo 的 TS 包补齐 ESLint TypeScript 解析（`typescript-eslint`），避免 packages 下 `.ts` lint 解析失败。
- UI 优化进展（第二轮）：已对 `apps/web` 的 Landing 与 `/chat` 进行高保真样式重构（布局、色值、间距、组件形态、侧栏折叠逻辑），从“基础可用”提升到“结构细节更完整”。

### 2026-03-02

- 你确认继续做 Web 端“像素级打磨”，并明确允许使用 `shadcn ui + tailwind css` 作为主要实现方案。
- 打磨方案选择为“先结构统一，再细节微调”：
  - 先统一首页与聊天页布局层级、组件语义和视觉 token；
  - 再在现有业务逻辑不变的前提下调整间距、尺寸、色板与响应式行为。
- `apps/web` 已进入 Tailwind + shadcn 主导的 UI 体系：
  - 首页与聊天页完成统一风格重构；
  - 新增 shadcn `sidebar/sheet/tooltip/skeleton` 等组件支撑侧栏与交互一致性；
  - 全局主题 token（`globals.css`）完成语义变量收敛。
- 当前阶段仍保持 MVP 约束不变：会话存储继续使用内存态，后续迭代再接 Prisma/PostgreSQL 持久化。
- 你确认移除仓库中与外部网站相关的命名、链接与描述，统一以“面试通”作为唯一品牌表达。
- 已完成清理范围包括：页面文案、外链入口、迭代文档叙述与拼写词典配置。
- 聊天页已完成第四轮微调：侧栏改为统一 off-canvas 过渡（含桌面端）、主区域高度与顶部层级边界进一步收敛。
- 聊天页已完成第五轮微调：快捷问题按钮与会话列表视觉密度进一步收敛，输入区控件简化为主链路操作。
- `/chat` 发送消息后的严重布局错乱已修复：消息区改为独立滚动容器，输入区固定在底部，避免输入卡片上浮到顶部。
- 聊天页已完成第六轮对齐：桌面侧栏默认展开，顶栏操作收敛，消息气泡/助手回复区改为更统一的双列形态，并通过 Playwright 再次确认“发送前后布局稳定”。
- 已接入本地 Ollama + SSE 流式聊天：`/chat` 发送消息后可增量渲染模型输出，服务端通过 Route Handler 把 Ollama NDJSON 转为 SSE 事件流，后续可按 Provider 抽象切换到付费 API。
- 已支持通过 `LLM_PROVIDER` 环境变量切换 `ollama/deepseek`：前端 SSE 协议保持不变，服务端按 provider 动态路由，便于本地联调与线上付费模型切换。
- 环境配置已进一步收敛为统一变量名方案：代码仅读取 `LLM_PROVIDER`、`OLLAMA_*`、`DEEPSEEK_*`，本地用 `.env.local`，线上由部署平台注入同名变量，降低维护复杂度。

### 2026-03-04

- 你确认继续推进“可维护性优先”的重构，要求在合理前提下将超长文件拆分（尽量单文件不超过 200 行）。
- 已完成 `apps/web/src/app/chat` 模块化重构：
  - `ChatClient` 拆分为 `components/hooks/lib` 多文件；
  - 发送链路与 SSE 解析从视图层抽离，降低组件耦合度。
- 聊天交互增强已落地：
  - 支持 `Enter` 发送、`Shift+Enter` 换行，并处理输入法组合输入；
  - 对话区支持自动滚动到底部（含流式增量输出过程）。
- 消息渲染已支持 Markdown 与代码高亮：
  - 使用 `react-markdown + remark-gfm + react-syntax-highlighter`；
  - 支持标题/列表/行内代码/代码块高亮等常见内容形态。
- 包级别拆分同步完成：
  - `packages/interview-engine` 拆分为流程、评分、辅助模块；
  - `packages/shared` 与 `packages/question-bank` 按职责拆分，减小单文件规模并保持现有导出兼容。
- 聊天页体验补齐：
  - 侧栏 `Guest` 菜单已支持主题切换（浅色/深色/跟随系统）；
  - 发送消息后，在助手首个 token 到达前会显示“思考中” loading 态，再平滑过渡到流式内容。
- 页面入口与菜单继续收敛：
  - `/chat` 顶部“使用指南”入口已移除；
  - 首页 Hero 区“查看功能”按钮已移除，`立即开始` 按钮横向留白加大；
  - Guest 菜单进一步对齐为“主题切换 + 登录入口”的下拉结构，并新增 `/login` 占位页承接登录跳转。
- 首页入口一致性补齐：
  - 首页右上角 `Guest` 已改为与聊天页一致的下拉菜单，支持主题切换与登录跳转；
  - Guest 菜单组件已抽离为共享组件（`apps/web/src/components/guest-menu.tsx`），避免首页/聊天页重复实现。
- 首页主 CTA 视觉微调：
  - Hero 区“立即开始”按钮左右内边距已调整为 `32px`（`px-8`）。
- 首页主 CTA 样式覆盖问题已修复：
  - 由于 `Button` 默认样式含 `has-[>svg]:px-3`，在带图标按钮上会覆盖自定义 `px`；
  - 现已在首页按钮上显式覆盖为 `!px-8 + has-[>svg]:!px-8`，确保 32px 生效。
- 首页底部 CTA 宽度策略已修复：
  - “开始对话”按钮移除 `w-full / sm:w-auto`，改为默认 auto 宽度，随内容自适应伸展。
- 首页主 CTA 宽度策略已修复：
  - “立即开始”按钮同样移除 `w-full / sm:w-auto`，改为内容自适应宽度。
- 首页 CTA 宽度策略进一步显式化：
  - 首页两个 CTA 均补充 `w-fit + shrink-0`，显式固定为内容宽度，避免布局上下文造成视觉偏差。
- 首页 CTA 宽度优先级进一步提升：
  - 两个 CTA 已升级为 `!w-fit`，用于覆盖潜在的宽度冲突类，确保内容自适应宽度稳定生效。
- 首页底部 CTA 跳转方式已调整：
  - “开始对话”已从 `Link` 包裹按钮改为 `Button onClick + router.push('/chat')`，以满足交互实现要求。
- 首页底部 CTA 跳转方式已回退：
  - 按最新确认，“开始对话”恢复为 `Button asChild + Link` 导航实现。
- 工程规范补齐（保存/提交一致性）：
  - 已接入 `prettier-plugin-tailwindcss`，支持 Tailwind 类名自动排序（含 `cn(...)`）；
  - 已新增 Stylelint 及 `lint:css`，并在 `lint-staged` 中对 `*.css` 执行 `prettier + stylelint --fix`；
  - 已提供 VS Code 工作区设置，默认保存时使用 Prettier 自动格式化。
- 样式检查能力补充：
  - 已新增 `lint:style` / `lint:style:fix`（严格 Stylelint 配置）用于集中发现并收敛 CSS 告警项；
  - 默认 `lint` 仍保持兼容现状的 `lint:css`，避免一次性放大量历史样式告警阻断日常提交流程。
- 严格样式告警已完成一轮收敛：
  - 通过 `pnpm lint:style:fix` 修复了当前 CSS 报告项（admin/web 的字体、媒体查询、import 与颜色写法等）；
  - `pnpm lint:style` 当前可通过。
- VS Code Tailwind 语法提示收敛：
  - 工作区设置已将 `*.css` 关联为 `tailwindcss` 语言模式；
  - 已设置 `css.lint.unknownAtRules: ignore`，减少 Tailwind v4 自定义 at-rule 的误报噪音。
- 拼写词典同步：
  - 已补充 `Segoe` 到 `cspell.json`，避免 `Segoe UI` 字体名在编辑器中误报 unknown。
- 首页 Tailwind 类名规范补齐：
  - `apps/web/src/app/page.tsx` 已按 canonical 写法收敛（`px-8!`、`w-fit!`、`aspect-video`）；
  - 同步移除底部 CTA 的 `flex-1`，与 `w-fit!` 宽度策略保持一致。
- Tailwind CSS 导入兼容性修复：
  - `apps/web/src/app/globals.css` 已恢复为 `@import 'tailwindcss'` / `@import 'tw-animate-css'`；
  - 严格样式配置已禁用 `import-notation`，避免自动修复将包导入改为 `url(...)` 后触发模块解析错误。
- 聊天区用户消息操作补齐：
  - “编辑”已支持回填到输入框并自动聚焦到末尾，便于二次改写后重发；
  - “复制”已增加非安全上下文回退复制逻辑（`execCommand`），降低点击复制无反馈问题。
- 基于 Playwright 对参考 chat 页的实测，聊天区“编辑/复制”已进一步对齐：
  - 用户消息“编辑”改为气泡内就地编辑（`Cancel/Send`），并在发送后截断被编辑消息后的历史，按新内容重新流式生成后续回复；
  - “复制”反馈改为顶部短时 toast（`Copied to clipboard!`），与参考交互节奏保持一致。
- 聊天页状态管理已开始从本地 `useState` 收敛到 `zustand`：
  - 新增 chat store 统一管理会话、输入、发送态、提示态、侧栏态和编辑态；
  - `use-chat-controller` 已迁移为基于 selector 的状态读取，降低后续多入口 UI 扩展时的状态分散风险。
- 按“职责边界分离”进一步细化 chat 状态层：
  - 已从单体 chat store 拆分为 `session/ui/edit` 三个 store，避免状态容器过粗；
  - `use-chat-controller` 进一步拆为 `store/effects/actions` 组合层，关键文件已回到 200 行约束内。

### 2026-03-05

- 你反馈 `/chat` 出现 hydration mismatch（SSR HTML 与客户端属性不一致）。
- 已按 zustand 最新 Next.js 建议完成 SSR 安全改造：
  - `chat-session/chat-ui/chat-edit` 三个 store 从模块级 `create(...)` 改为 `createStore` 工厂（vanilla store）；
  - `use-chat-controller-store` 改为组件实例级 store 初始化（`useState` 懒初始化 + `useStore(storeApi, selector)`），避免跨请求/跨渲染共享模块状态导致的水合不一致。
- 该修复保持了既有“多 store 拆分”结构与 200 行文件约束，不回退为单体 store。
- 你继续反馈发送消息后出现编译/页面持续刷新与请求死循环问题。
- 已修复 `use-chat-controller` 中 effects 入参的非稳定函数引用（去除包装函数，直接传递 store setter），初始化 effect 不再因依赖抖动反复触发。
- 已用 Playwright 回归“发送一条消息”场景，确认请求链路恢复正常，不再出现 `/api/chat/sessions` 无限请求；同时清理了 `format:check` 的 12 个存量文件并恢复通过。
- 你提出补齐可点击元素的鼠标指针反馈；已采用“全局 + 局部兜底”方案：
  - 在通用 `Button` 基类统一添加 `cursor-pointer`；
  - 对 `guest-menu` 与 `chat-sidebar` 的原生 `<button onClick>` 补齐 `cursor-pointer`，确保图标按钮与会话项点击反馈一致。
- 你进一步确认“局部状态优先使用 `useState`，仅跨路由/跨层级共享场景才使用全局状态管理”。
- 已按该原则收敛 chat 模块状态层：
  - 保留 `session` 域使用 `zustand`；
  - `ui/edit` 两个域回退为 `useState`（输入、提示、toast、侧栏开关、消息编辑态等）；
  - 删除 `chat-ui-store.ts` 与 `chat-edit-store.ts`，减少不必要的全局状态复杂度。

### 2026-03-06

- 你要求参照 `zhitalk.chat` 在当前项目实现注册/登录功能，并允许先用 Playwright 调研后复刻。
- 方案结论采用 `NextAuth Credentials + Prisma(AuthUser)`：
  - 相比自建 JWT，复用成熟会话与 CSRF 机制，安全边界更清晰；
  - 相比外部托管认证，保持数据与认证逻辑在仓库内，便于后续按业务扩展。
- 已落地认证闭环：
  - 页面：`/login`、`/register`；
  - 接口：`/api/auth/register`、`/api/auth/[...nextauth]`；
  - 数据：`packages/db` 新增 `AuthUser` 模型与 Prisma 迁移；
  - UI：`guest-menu` 已按会话态显示邮箱/Guest，并支持退出登录。
- 本地联调中发现并修复了 host 漂移问题：
  - `signIn/signOut` 返回 URL 会在 `localhost` 与 `127.0.0.1` 间漂移，导致“注册成功但看起来仍是 Guest”；
  - 已改为安全相对路径跳转，确保当前 host 下会话连续性。
- 认证稳定性增强：
  - `auth-options` 统一读取 `AUTH_SECRET`（兼容 `NEXTAUTH_SECRET`），开发环境提供稳定默认 secret，生产环境缺失 secret 时显式报错；
  - `env.example` 新增 `NEXTAUTH_URL=http://127.0.0.1:3000` 建议值。
- 通过 Playwright 回归确认：注册自动登录、退出回 Guest、登录成功与错误密码提示均符合预期。
- 你随后反馈 `pnpm dev:web` 出现 hydration mismatch 提示；已对 `GuestMenu` 做渲染收敛：
  - 移除基于主题切换头像 `src` 的分支首帧渲染，改为固定 `src + dark:invert`；
  - 目标是确保 SSR 与客户端首帧属性一致，降低因主题解析时序导致的属性不匹配风险。
- 已在浅色/深色媒体模式下用 Playwright 回归首页与 `/chat`，未再看到 hydration warning。
- 你确认“切回 PostgreSQL”；已完成认证数据层切换：
  - Prisma datasource 从 `sqlite` 改为 `postgresql`；
  - `env.example` 的 `DATABASE_URL` 已改为 compose 对应本地连接串；
  - 依据 Prisma provider 切换要求，已清理旧 SQLite 迁移并重建 PostgreSQL 迁移历史（`init_auth_postgres`）。
- 认证模块当前数据库基线：
  - 本地开发默认走 PostgreSQL（`compose.yaml` 的 `db` 服务）；
  - 认证表 `AuthUser` 已在 PostgreSQL 建表并通过迁移管理。
- 你要求“方便启动数据库并查看数据”；已在仓库根新增统一 `db:*` 脚本：
  - `db:up/down/restart/status/logs/psql/studio/users`；
  - 统一通过 `pnpm db:...` 调用，减少命令记忆成本。
- `README.md` 已新增数据库快捷命令章节，并实测 `db:status` 与 `db:users` 可正常执行。
- 你继续要求支持“清库”；已补齐数据库维护脚本：
  - 新增 `db:migrate`（`prisma migrate dev`）用于结构变更落库；
  - 新增 `db:reset`（`prisma migrate reset --force --skip-seed`）用于清空并按迁移重建；
  - `db:studio` 调整为“优先使用外部 `DATABASE_URL`，否则回退本地默认 PG URL”，兼容更多环境。
- 你反馈“删除数据库中的当前登录用户后，刷新仍保持登录态”；已完成一致性修复：
  - 服务端 `session callback` 增加用户存在性校验（用户不存在则清空 `session.user`）；
  - 客户端检测到“authenticated 但 user 为空”时自动 `signOut + refresh`；
  - 实测删除用户后刷新页面已自动恢复 `Guest`。
