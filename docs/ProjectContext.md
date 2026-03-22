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
- `docs/InterviewAgentArchitecture.md`：Web 端 AI 面试 Agent 架构设计（LangGraphJS / Hybrid RAG / Skills / Trace / Eval）
- `AGENTS.md`：协作约定与“每次改动后的必做清单”（避免忘记更新文档/跑规范）
- `env.example`：环境变量占位（DeepSeek 配置待确认）

## 待确认清单（会影响实现）

- DeepSeek 接口是否 OpenAI-compatible：Base URL、鉴权方式、模型名、是否支持 JSON 模式/工具调用
- 题库方向优先级：React/Vue/工程化/性能/网络 等
- 默认语言与风格：中文为主还是中英混合；“每题反馈”还是“结束统一总结”

## 对话摘要日志

### 2026-03-15

- 你确认题库“方向”与“标签”字段合并，仅保留标签（预置 + 自定义），方向字段从数据模型与后台 UI 中移除。
- 题库列表的“编辑”操作改为跳转独立页面 `/questions/[id]/edit`，不再使用弹窗编辑。

### 2026-03-21

- 你确认模板模块暂时不需要，后台移除模板管理相关页面与接口，模板表从数据库模型中删除，出题策略先在 Web 内置。
- 你进一步确认题库“上传题库”功能暂时不做，后台只保留单题新建/编辑/删除/筛选；后续若需要，再按“上传 markdown + AI 解析 + 批量导入”重做。

### 2026-03-22

- 生产上线策略已明确采用“GitHub-hosted runner + GHCR + 单机 Docker Compose + Caddy”的自动部署方案，先不让生产机充当 self-hosted runner。
- 该方案的目标是：`main` 合入后自动部署、构建与部署职责分离、数据库迁移进入镜像交付链，并为后续 `staging` / 回滚 / 蓝绿发布保留扩展空间。
- 已新增 `docs/ProductionDeploymentPlan.md` 作为后续部署落地的设计依据；正式实施前需要先补齐：生产 compose、Caddyfile、deploy workflow、migrate 镜像与健康检查接口。
- 生产部署骨架现已开始落地：
  - 新增了 `deploy/compose.prod.yml`、`deploy/Caddyfile`、`deploy/scripts/*.sh`
  - 新增了 `.github/workflows/deploy.yml`
  - Web/Admin 已补 `/api/health`
  - `Dockerfile` 已补 `migrator` 目标与最新 workspace 依赖清单
- 已新增 `docs/ProductionDeploymentChecklist.md`，把服务器初始化、GHCR 登录、GitHub Secrets、DNS、首发验证与回滚步骤收敛成可执行清单，作为第一次真实上线的操作手册。
- 生产默认域名示例已从 `mianshitong.com` 统一修正为 `mianshitong.chat`；仓库里的 deploy/Caddy/Compose 逻辑本身不依赖写死域名，真正生效的仍是服务器上的 `.env.prod`。
- 首次真实触发 `deploy` workflow 时，发现 `Dockerfile` 仍残留对已移除包 `packages/question-bank` 的复制语句，导致 GHCR 构建在 `Build and push web image` 步骤失败；该过期依赖清单现已移除。
- Admin 端按 MVP 上线要求做了一轮加固：管理员登录增加服务端限流，并支持通过 `ADMIN_ALLOWED_IPS` 做可选 IP 白名单限制。
- 题库新建/编辑接口补充服务端字段校验，确保 `level`、`tags`、`order` 等核心字段不会写入非法值，避免污染 Web 端抽题逻辑。
- 用户详情页修复为 Next 16 兼容的异步 `params` 读取方式，并统一会话消息数统计口径，排除系统欢迎语。
- Admin 端又做了一轮提交前清理：删除未再使用的题目弹窗编辑组件、移除没有入口的 `/users/[userId]` 用户详情页链路，并收窄题库列表页不再使用的数据字段。
- Admin 端再做一次提交面收口：移除旧 `favicon.ico`，避免与当前 `icon.svg` 并存；同时清理 `AdminShell` 未使用的 `description` props、`apps/admin` 未使用的依赖声明，以及多余的 `transpilePackages` 配置。
- Web 端 AI 面试能力的目标进一步收敛为“核心链路 Agent 化，外围保持标准 Web 工程”：采用 LangGraphJS 编排简历画像、面试规划、题目检索、提问追问、评估与报告。
- 出题机制确定为 `ResumeProfile -> InterviewBlueprint -> Hybrid RAG -> QuestionPlan`，不采用纯数据库随机抽题，也不采用纯 RAG 直接决定所有题目。
- 技术展示重点确定为：`LangGraphJS`、`Hybrid RAG`、`Skills`、`Memory`、`Trace`、`Eval`，并新增 `docs/InterviewAgentArchitecture.md` 作为后续实现依据。
- Web 端 AI 面试 Agent 已开始落第一阶段骨架：`packages/interview-engine` 已接入 LangGraphJS 规划图，支持在“开始模拟面试”时基于历史输入生成 `ResumeProfile`、`InterviewBlueprint` 与题单，而不是在建会话时提前固化 `questionPlan`。
- `packages/agent-skills` 现已正式落地为显式 Skill 层，当前先承接 `ResumeProfileSkill` 与 `InterviewBlueprintSkill` 两个规划能力；`interview-engine` 的 LangGraph 节点现在通过 Skill 协议调用它们，而不是继续把画像/蓝图逻辑内嵌在节点函数里。
- `ResumeProfileSkill` 现已优先升级为“DeepSeek 结构化画像 + 规则 fallback”混合实现：当 `LLM_PROVIDER=deepseek` 且存在有效 `DEEPSEEK_API_KEY` 时，规划链路会先调用 DeepSeek 输出结构化候选人画像；若模型调用失败、结构无效或当前环境未启用 DeepSeek，则自动回退到原有规则版画像，不影响本地开发和 CI 稳定性。
- 为支撑这一能力，`packages/llm` 新增了轻量 `DeepSeekJsonCompletionProvider`，当前先服务于 `ResumeProfileSkill`；后续若继续升级 `AssessmentSkill` / `ReportSkill`，可沿用这条“结构化输出 provider + Skill 合并/兜底”的实现路径。
- 执行链路里的“是否追问”判定也已提升为 `FollowUpSkill`：流程层不再自己组装 `followUpTrace`，而是消费 Skill 输出的 `trace + shouldAskFollowUp` 结果；当前仍保持规则版实现，但后续切换到更复杂的 LLM/Tool 决策时不需要再改流程控制边界。
- 单题评分链路现也已提升为 `AssessmentSkill`：`process-session-message` 不再直接依赖 `scoring.ts` 里的内联评估逻辑，而是消费 Skill 输出的 `assessment + trace`。
- `AssessmentSkill` 现已进一步升级为“DeepSeek 结构化评分 + 规则 fallback”混合实现：当 `LLM_PROVIDER=deepseek` 且存在有效 `DEEPSEEK_API_KEY` 时，会优先让 DeepSeek 输出结构化维度评分、命中点、缺失点与总结；若模型调用失败、结构无效或当前环境未启用 DeepSeek，则自动回退为规则版评分。
- 由于题库里的 `keyPoints` 现在允许为空，规则 fallback 也已补齐无要点场景下的启发式评分，避免 `AssessmentSkill` 在本地/无模型环境里对“无要点题”系统性低估。
- 报告聚合链路现也已提升为 `ReportSkill`：完成面试和补报告两个入口都直接消费 Skill 输出的 `report + trace`；`scoring.ts` 仅保留兼容导出，内部改为复用 Skill helper。
- `ReportSkill` 现也已升级为“DeepSeek 结构化总结 + 规则 fallback”混合实现：数值层继续使用规则聚合，保证 `overallScore / level / dimensionSummary` 稳定可回归；叙述层则在 `LLM_PROVIDER=deepseek` 且存在有效 `DEEPSEEK_API_KEY` 时，优先让 DeepSeek 输出 `overallSummary / strengths / gaps / nextSteps`，失败时回退规则版模板。
- `ReportSkill` 的 LLM 输出不会直接覆盖 trace 的来源结构，而是先与现有 strengths/gaps sources 做对齐，尽量保留“哪一道题支撑了这个结论”的可解释性，当前“规划 Skill + 执行 Skill + 报告 Skill”三段边界与第一阶段 LLM 能力已经闭环。
- `packages/evals` 现已新增一层 Skill 级离线回归基线：通过代表性的结构化推断 fixture 来验证 `ResumeProfileSkill / AssessmentSkill / ReportSkill` 的 merge、canonicalize、trace 对齐与 fallback 稳定性。
- 这层新基线不依赖真实模型，也不尝试评估 prompt 的绝对好坏；它的职责是“在改 prompt / 改 merge 逻辑 / 改 fallback 逻辑后，及时发现 contract regression”，当前项目已经形成：
  - 题单规划 eval
  - 报告 trace eval
  - 三段 Skill regression eval
- `packages/evals` 现又补上一层手动触发的真实模型评测：通过 `RUN_LLM_EVALS=1` 显式开启，并要求 `LLM_PROVIDER=deepseek` 与有效 `DEEPSEEK_API_KEY`，用于本地验证三段 Skill 在真实 DeepSeek 下是否仍保留合理结构与区别于 fallback 的有效信号。
- 根脚本现已同步补齐：
  - `pnpm evals:skills:regression`
  - `pnpm evals:skills:live`
- 当前 Eval 体系已明确分层为：
  - 默认离线回归基线（进 CI）
  - 手动真实模型 smoke / capability check（不进默认 CI）
- `pnpm evals:skills:live` 现已补齐本地环境加载：命令会自动读取仓库根目录 `.env` 与 `.env.local`，并强制固定 `RUN_LLM_EVALS=1` 与 `LLM_PROVIDER=deepseek`，避免被日常开发里的 `LLM_PROVIDER=ollama` 等配置污染。
- 为便于排查本地配置问题，这个命令对应的启动脚本也支持 `node scripts/run-skill-live-evals.mjs --check-env`，只校验环境是否就绪，不发起真实模型请求。
- live eval 所调用的三段 Skill 现已支持 strict 模式：通过 `fallbackOnInferenceError=false` 可以禁止静默 fallback，让真实模型请求失败、结构化解析失败或推断器未启用时直接抛错；当前 `pnpm evals:skills:live` 已默认使用这条 strict 路径，方便定位真实问题。
- `ResumeProfileSkill` 的 live eval 断言现已明确收敛为 smoke 语义：允许 `mid | senior` 这类合理等级波动，重点校验“标签命中、evidence、confidence 是否合理”，避免把真实模型的轻微分级差异误判为链路失败。
- `/api/chat/stream` 当前也已补齐对“旧/不完整 local runtime”的兼容：`interview-engine` 的 `cloneRuntime` 现会为缺失的 `followUpTrace / assessmentTrace / planningTrace / reportTrace` 等字段自动兜底，避免本地旧会话或最小 session payload 因 `undefined.map` 直接打挂面试规划链路。
- Guest 本地流式链路现已和远端持久化会话一样支持切入 interview-engine：当用户开始模拟面试或已经处于 interviewing 状态时，本地 `/api/chat/stream` 也会直接返回 Agent 处理后的完整 session，普通聊天仍保留原有通用流式模型调用。
- `packages/retrieval` 已落地为 Hybrid RAG 第一阶段检索层：当前先使用“元数据过滤 + 词法召回 + 标签/难度重排”，并把题库检索从 `packages/interview-engine/src/interview-planning.ts` 中抽离出来，后续可平滑替换为 `pgvector + embeddings`。
- 当前题单生成已进入“规划层与检索层分离”状态：`interview-engine` 负责画像、蓝图、配额和编排，`retrieval` 负责候选文档构建、搜索、重排与补位。
- 规划链路已补齐 `planningTrace` 运行态快照：每个题位会记录目标难度、偏好标签、候选题 top 结果和最终选中题，为后续做可视化 Trace、管理端调试和离线 Eval 提供基础数据。
- Web 端已兼容旧会话/旧本地缓存中没有 `planningTrace` 的历史 runtime，读取时会自动补齐为 `null`，不需要额外数据迁移。
- `packages/evals` 已落地第一版离线评测基线，当前通过 fixture 校验两类典型候选人画像下的题单结果，评测重点是“标签覆盖 + 关键题命中 + planning trace 完整性”，而不是假设当前算法已经实现严格难度硬配额。
- `packages/retrieval` 已进一步抽象出 `QuestionRetriever` adapter 接口，当前默认实现为 `createLexicalQuestionRetriever`；`packages/interview-engine` 规划层现在只依赖接口，不再绑定具体检索函数，为后续接 `pgvector / embedding` 做好了替换边界。
- `packages/llm` 已补齐 `EmbeddingProvider` 协议，`packages/retrieval` 已新增 `createVectorQuestionRetriever` 与 `QuestionVectorStore` 契约；当前支持“向量候选召回 + lexical hybrid 重排 + lexical fallback”，但尚未接真实向量库。
- `pgvector` 真实持久化现已开始落地：数据库新增独立 `QuestionRetrievalDoc` 表，不把向量列直接塞进 `QuestionBankItem`，以便后续做 embedding 版本化与重建。
- 本地开发数据库容器已切换到 `pgvector/pgvector:pg16`；后续凡是初始化新环境，都需要执行题库 embedding 回填，入口脚本为 `pnpm retrieval:backfill`。
- Web 端当前会在 `EMBEDDING_PROVIDER=ollama` 且存在有效 embedding 时，自动切到 `hybrid-vector-v1`；否则继续使用 `hybrid-lexical-v1`，不影响现有出题链路。
- Admin 端题库新增/编辑已自动同步检索元数据，并在题目内容变化时清空旧 embedding，避免向量索引与题目正文不一致。
- 为了给 Hybrid RAG 做更贴近真实用户链路的验证，新增了 60 条前端题库 fixture 种子脚本与 `pnpm retrieval:seed-fixtures` 入口；当前推荐用“批量造数 + embedding 回填 + Web 端到端烟测”作为本地调优基线。
- 原先尝试的“纯向量最近邻 smoke”已被放弃，因为它无法代表真实线上链路；当前唯一保留的回归基线是 `/api/chat/stream` 驱动的 Hybrid RAG 端到端烟测。
- 这条 `/api/chat/stream` 驱动的 Web 端真实出题 smoke 现已补齐正式入口：
  - `pnpm evals:web:planning:check-env`
  - `pnpm evals:web:planning:smoke`
  - `pnpm retrieval:smoke` 作为兼容别名继续保留
- 该 smoke 命令会自动读取 `.env` / `.env.local`，并在运行时强制固定：
  - `LLM_PROVIDER=ollama`
  - `EMBEDDING_PROVIDER=ollama`
    目的是让“画像/蓝图”走确定性的规则 fallback，让 smoke 聚焦验证 Web 集成、题库检索与规划 trace，而不是把 DeepSeek 波动混进这条基线里。
- 这条 smoke 现在除了验证最终 `questionPlan` 外，也会校验：
  - `resumeProfile`
  - `interviewBlueprint`
  - `planningTrace`
    三段运行态是否完整且相互对齐。
- 这条 smoke 现已进一步隔离 Next.js 开发态输出：运行时会为 `apps/web` 注入唯一的 `NEXT_DIST_DIR`，让 smoke 使用独立的 `.next-smoke/...` 目录启动 `next dev`，从而避免与你日常运行中的 `apps/web/.next/dev/lock` 冲突。
- 面试规划层已补一条更符合产品直觉的规则：当题量达到 4 题及以上时，`mustIncludeTags` 会覆盖前三个核心标签，而不是固定只保留前两个，避免 `React + TypeScript + 工程化` 这类复合画像下被“双标签重叠题”长期挤占。
- Admin 会话详情页已接入“面试规划 Trace”可视化面板，当前可以直接查看检索策略、候选人画像、题单蓝图、最终题单，以及每个题位的候选题与分数拆解，作为后续 RAG 调优和 LangGraph 链路展示的第一版观测面。
- Admin 端为此新增了独立的 runtime 解码 helper，不再在详情页里直接信任原始 JSON 结构；后续若继续展示评分 trace、追问 trace，可沿用这条取数边界继续扩展。
- 面试执行阶段现已补齐结构化 trace：每次用户作答后的“追问/不追问”决策都会写入 `followUpTrace`，每题最终评分会写入 `assessmentTrace`，这样运行态不再只有最终 `assessments/report` 结果，而是能回放决策过程。
- Admin 会话详情页现已形成“规划 Trace + 执行 Trace + 对话记录”的完整调试视图，可直接看到每题为什么追问、追问了什么、最后如何评分，为后续演示 Agent 能力和调试 Prompt/规则提供统一观测入口。
- 面试报告阶段现也已补齐结构化 `reportTrace`：运行态会记录维度均分来源、总分公式、等级判定、优势/短板来源、改进建议推导和总结模板分支，Admin 会话详情页现已具备“规划 -> 执行 -> 报告 -> 对话”的完整可观测链路。
- `packages/evals` 现已补齐 `reportTrace` 的离线评测基线，当前通过 3 组固定 `QuestionAssessment` fixture 覆盖 `needs-work / solid / strong` 三类报告输出，评测重点是“报告结果与 trace 一致性 + 维度来源结构完整性”，为后续调 prompt/规则提供稳定回归网。
- Admin 端现在已有一条真实浏览器烟测覆盖会话详情页三段 Trace；测试会通过临时种入管理员账号和完整 trace 会话来验证页面渲染，不依赖手工准备数据。Playwright 配置也已支持按 `PLAYWRIGHT_SCOPE` 只启动所需服务，避免单跑 Admin 用例时被 Web 服务拖慢或阻塞。
- 这条 Admin Trace 烟测现已接入 GitHub Actions 默认 CI：CI 会启 `pgvector` 数据库服务、非交互执行 `db:migrate:deploy`、安装 Playwright Chromium，并只运行 Admin 项目；同时 Playwright 配置已支持“本地用 Chrome、CI 用 Chromium”的环境分流，减少 CI 浏览器依赖风险。
- Web 侧 smoke 现也已拆成独立 CI job：通过 `pnpm test:e2e:web` 只运行 `web-chrome` 项目，和 `admin-e2e` 并行挂在 `test` 之后，避免后续 E2E 数量增长时单个 job 串行时间过长。
- CI 工作流现已补齐 `workflow_dispatch`，可在 GitHub Actions 页面手动触发；同时 `pnpm/action-setup` 不再单独声明版本，统一以根 `package.json` 的 `packageManager` 作为 pnpm 唯一版本源，避免再次出现版本冲突。
- CI 的 `test` job 现已显式执行 `pnpm db:generate`，根 `typecheck` 也统一先生成 Prisma Client，再做各 workspace 类型检查，避免远端环境因为缺少 `@prisma/client` 生成产物而在 `packages/db` 阶段失败。

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
- 你反馈 `schema.prisma` 提示 `datasource.url` 不再支持；已对齐 Prisma 7 配置规范：
  - `packages/db` 升级到 Prisma 7.4.2；
  - 新增 `packages/db/prisma.config.ts` 承载 `datasource.url`；
  - `schema.prisma` 中移除 `datasource.url`；
  - Prisma Client 改为 `@prisma/adapter-pg` 注入连接串，兼容 Prisma 7 的客户端配置方式。
- 你反馈聊天页发送快捷问题后会多出一条欢迎语；已按“保留 system 上下文、前端不展示”的策略修复：
  - `ChatMessageList` 仅渲染非 `system` 消息（过滤 `role/kind === system`）；
  - loading 末条判断改为基于可见消息集合，避免隐藏消息影响渲染；
  - Playwright 回归“点击 `可以帮我优化简历吗？`”已确认对话区不再出现该欢迎语。
- 你提出聊天页对齐需求（移除锁图标、侧栏删除全部/单条删除、游客 IndexDB、登录用户 DB）；已完成落地：
  - 顶部锁图标与私有切换逻辑已移除；
  - 侧栏头部改为删除全部入口，会话行支持 hover 显示删除图标并删除当前会话；
  - 游客会话改为浏览器 IndexDB 本地持久化（刷新可恢复）；
  - 登录用户会话改为 PostgreSQL 持久化（Prisma 新增 `ChatSessionRecord` + 迁移）。
- 聊天数据访问层已按身份拆分：
  - 登录态：`/api/chat/sessions*` 路由统一鉴权并读写数据库；
  - 游客态：前端读写本地仓库 + 调用无状态流式接口 `POST /api/chat/stream`。
- 登录态回归时发现并修复了聊天页模型选择器的 hydration warning（Radix Select id mismatch）；当前 Playwright 控制台未再出现该报错。
- 你继续要求优化聊天页细节展示；已完成以下收口：
  - 聊天代码块改为更接近 GitHub 的 light/dark 风格，并随主题切换同步更新；
  - 暗色主题下用户聊天气泡文字已改为纯白（`#fff`）；
  - 侧边栏“删除所有聊天记录 / 新建会话 / 删除当前会话”的 hover 提示已改为基于 shadcn Popover，并确认明暗主题下颜色跟随 `bg-popover / text-popover-foreground` 变量切换。
- 本轮回归已用 Playwright 验证：
  - 暗色主题下用户气泡文字计算样式为 `rgb(255, 255, 255)`；
  - 代码块背景在暗色/浅色下分别为 `rgb(13, 17, 23)` / `rgb(246, 248, 250)`；
  - Popover 在暗色/浅色下分别使用深色/浅色背景与前景色。
- 你继续收口聊天页交互细节；已进一步调整：
  - 用户消息气泡不再支持 markdown/代码片段渲染，统一按纯文本展示；
  - “删除当前会话”的 hover Popover 改为向下弹出，和侧栏其它头部图标提示方向保持一致。

### 2026-03-07（代码块对齐 zhitalk.chat/chat）

- AI 回复中的代码块不再只是纯高亮容器，而是升级为带顶部工具栏的独立组件：左侧显示语言名，右侧提供下载代码文件与一键复制代码。
- 代码块结构与交互参考 `https://zhitalk.chat/chat`：工具栏顺序为“语言标签 -> 下载 -> 复制”，下载文件名对齐为 `file.{ext}`。
- 主题从简单的内置高亮主题切换为自定义 GitHub 风格 light/dark token 映射，并在代码标签上统一设置 `tab-size: 2`。
- 为避免单文件继续膨胀，代码块逻辑已从 `chat-markdown.tsx` 中拆出到独立组件 `chat-code-block.tsx`。

### 2026-03-07（代码块交互细节继续对齐）

- 聊天代码块顶部的“下载代码 / 复制代码”按钮已补上 hover 提示，基于现有 shadcn Popover 实现，并保持主题切换一致。
- 复制代码后，按钮图标与提示文案会短暂切换为“已复制”，反馈层集中在代码块组件内部处理。
- 代码块工具栏的高度、图标按钮尺寸与 hover 背景已进一步收口，继续向 `zhitalk.chat/chat` 的头部细节靠拢。

### 2026-03-07（会话路由与新对话空白态对齐）

- 聊天会话已改为与页面路由一一对应：空白新对话使用 `/chat`，已存在会话使用 `/chat/[sessionId]`。
- 聊天页初始化不再默认打开最新会话；只有 URL 带会话 id 时才加载对应会话，这样“新对话”状态能稳定保持为空白页。
- 新建会话入口改为只重置当前状态并回到 `/chat`，真正的会话创建延迟到首条消息发送时发生。
- 预设问题点击流程已改为“直接发送，不占用输入框草稿”，对齐 `zhitalk.chat` 的首屏体验。

### 2026-03-07（会话路由稳定性修正）

- 会话路由接入后曾出现初始化 effect 被反复触发、会话列表接口刷屏和页面回跳的问题；根因是路由导航函数引用不稳定。
- 现已将聊天路由层改为返回稳定 callback，并在控制器中按函数粒度依赖，避免 bootstrap 与导航逻辑互相触发形成循环。

### 2026-03-07（动态路由参数读取改为 useParams）

- 聊天会话页的 `sessionId` 读取方式已从“page 服务端透传 prop”改为客户端直接使用 `useParams()` 获取，以保证 `/chat/[sessionId]` 下控制器始终能拿到当前路由段。
- `/chat` 与 `/chat/[sessionId]` 继续保持双页面文件结构，但都复用同一个 `ChatClient`，由客户端按当前 URL 决定是否加载具体会话。

### 2026-03-07（首条消息后的路由切换时机后移）

- 新对话的首条消息发送时，若先跳到 `/chat/[sessionId]` 再等待消息流写库，会导致新页面只接收到空会话而看不到刚发送的内容。
- 当前策略已调整为：先在当前页完成首条消息发送与最新会话同步，再把 URL 切换到对应会话页，从而保证路由和消息内容同时稳定。

### 2026-03-07（HoverPopover hydration 收敛）

- 直接打开会话页时发现由 hover Popover 触发的 hydration warning；根因是 Radix Popover 首帧生成的 `aria-controls` id 在 SSR/CSR 间不一致。
- 当前已将 `HoverPopover` 调整为“挂载后再启用 Popover”，从而规避这类首帧 id 漂移。

### 2026-03-07（会话切换空白态收敛与纯 hash 会话 id）

- 侧栏切换会话时，若目标会话尚在加载，聊天区不再回退到“面试通 / AI 智能面试官，优化简历，模拟面试”的空白欢迎态。
- 新创建的会话 id 已统一改为纯 hash 风格，不再带 `session_` 前缀；该规则同时覆盖登录态数据库会话、游客本地会话与引擎侧会话工厂。
- 旧会话 id 仍保持兼容，不需要做数据迁移即可继续访问。

### 2026-03-07（旧会话 id 自动升级为纯 hash）

- 之前“纯 hash 会话 id”只覆盖了新建会话，历史数据库记录和本地 IndexDB 里的旧 `session_` 会话仍会在路由中暴露前缀。
- 当前已补齐旧数据升级链路：登录态会在读取会话列表时自动迁移数据库中的旧 id，游客态会在读取本地会话列表时自动迁移 IndexDB 中的旧 id。
- 聊天路由层已加入旧 id 规范化与前端地址替换逻辑，因此点击历史会话或直接打开旧链接后，地址栏都会收敛到纯 hash 风格。

### 2026-03-07（行内反引号与代码块判定收敛）

- 聊天 markdown 渲染里，之前曾依赖 `react-markdown` 的 `inline` 字段区分行内代码与代码块；这在当前版本下不稳定，导致部分 `count` / `createCounter` 之类的行内反引号文本被误识别为代码块。
- 当前已改为更稳妥的判定方式：优先识别 `language-*` 类名，再结合源码行号跨度与内容换行判断是否为 block code；普通行内代码恢复为轻量 `code` 标签展示。

### 2026-03-07（会话切换时预设问题闪回收敛）

- 之前已收掉消息区欢迎态闪烁，但输入区的 4 个预设问题仍只依赖 `hasConversation` 控制，因此在切换会话的过渡瞬间会短暂回到首屏样式。
- 当前已将输入区预设项与消息区欢迎态统一接入同一套“会话路由正在接管”抑制条件，切换会话时不再闪出 4 个预设问题。

### 2026-03-07（会话切换统一骨架屏）

- 之前对聊天页切换态的处理主要是“隐藏欢迎态和预设项”，虽然能消除闪烁，但过渡期会偏空。
- 当时曾引入统一的 `ChatConversationSkeleton` 方案，在目标会话接管前同时覆盖消息区与输入区，用于快速收掉切换闪烁。

### 2026-03-07（骨架屏不再覆盖输入区）

- 第一版统一骨架屏虽然收掉了闪烁，但把输入区也一起替换掉了，和 `zhitalk.chat` 的交互不完全一致。
- 当前已调整为“仅消息区切换骨架、输入区保持真实控件常驻”，因此切换会话时底部输入框、模型选择器和发送按钮会保持稳定位置，只替换上方会话内容区域。

### 2026-03-07（输入区常驻后的首帧切换态补齐）

- 当输入区改为常驻后，如果用户是从 `/chat` 空白页点击进入已有会话，路由尚未切换完成的首帧里，预设项仍有机会短暂出现。
- 当前已把“目标会话已被选中但详情尚未返回”也纳入切换态，因此从点击侧栏会话的那一刻起，消息区骨架和输入区预设项抑制都会立即生效。

### 2026-03-07（会话列表状态与当前会话状态拆分）

- 左侧会话列表此前之所以在每次切换会话时都闪骨架，根因不是 UI 判断本身，而是聊天 store 绑定在页面实例上，路由切换会导致整份 store 重建，`sessions` 短暂回到空数组。
- 当前已按职责拆分为两份模块级 Zustand vanilla store：一份负责 `sessions / sessionsLoading`，一份负责 `activeSession / activeSessionId / activeSessionLoading / sending / selectedModelId`。
- 这样左侧列表状态可以跨会话路由稳定保留，切换右侧会话时不会再误触发左侧列表骨架；右侧详情加载态也不再污染左侧列表展示。

### 2026-03-07（侧栏激活项删除图标显隐收敛）

- 侧栏单条会话右侧的删除图标之前只在 `hover` 下显示，因此点击切换会话时如果 hover 状态短暂丢失，会出现删除图标闪烁一下的问题。
- 当前已改为“hover 或当前激活项均可见”，从而保证切换中的目标会话项不会因为 hover 抖动而闪烁删除图标。

### 2026-03-07（侧栏删除图标改为显式 hover 状态）

- 仅靠 CSS `group-hover` 控制侧栏删除图标会在会话切换重渲染时产生一帧 hover 抖动；而把它做成激活项常驻又不符合需求。
- 当前已改为使用组件内 `hoveredSessionId` 显式管理 hover 状态：删除图标重新收回为“仅 hover 时显示”，同时避免因重渲染导致的闪烁。

- 侧栏单条会话右侧删除图标的 hover 显隐逻辑进一步收口：移除 React 本地 hover 状态，改为纯 CSS `group-hover` + `visibility/pointer-events` 控制，以消除点击切换会话时因状态更新滞后造成的一帧补闪，并让行为更接近 `zhitalk.chat`。

- 聊天页消息区滚动策略已细分为两类场景：切换到已有会话时，必须在会话加载完成后自动定位到底部；当前会话内新增消息时，继续自动跟随到底部。实现上采用 `useLayoutEffect` + 双 `requestAnimationFrame` 兜底，避免长内容在布局完成前滚动失效。

- 聊天输入框的发送体验已改为乐观清空：用户点击发送后，输入框立即清空，不再等待流式回复结束；若发送失败，仅在用户尚未输入新草稿时才恢复原文，避免覆盖新的输入。

- 输入区发送中交互已收紧：发送消息或会话仍在加载时，`textarea` 会进入只读态，模型切换与预设问题入口同步禁用，避免用户在异步提交期间误以为仍可修改本次待发送内容。

- 输入区发送中交互已收紧：发送消息或会话仍在加载时，`textarea` 会进入只读态，模型切换与预设问题入口同步禁用，避免用户在异步提交期间误以为仍可修改本次待发送内容。

- 聊天输入区已进一步向 `zhitalk.chat` 对齐：AI 生成中不再把输入框锁死，而是允许继续输入新草稿；发送按钮改为可中断当前流式请求的“停止生成”，若用户在当前回复未结束时再次尝试发送，则通过 toast 明确提示先停止当前回复。

- 聊天页首发发送链路新增了一条重要状态约束：当用户还停留在 `/chat` 空态页、但本地已经创建出新会话并准备跳到 `/chat/:id` 时，controller 不能再按普通空态 bootstrap 去清空 `activeSession`。当前已通过 route bootstrap bypass 标记把这段“待切路由的新会话过渡期”显式保护起来，避免乐观消息被自己覆盖，导致 AI 回复完成后页面才突然闪出对话内容。

- 聊天页首发发送链路已进一步对齐 `zhitalk.chat`：不是点击“新建会话”时预创建空会话，而是在用户首次发送时由客户端先生成 `sessionId`，同一拍内把地址栏切到 `/chat/:id`，并直接渲染 optimistic 用户消息与 assistant loading 态；服务端流式接口再按该 id 在缺失时创建并持久化会话。这样既避免了空会话污染，也从根上收掉了首发发送时因路由延后切换导致的闪烁。

- 在首发发送链路切到 `window.history` 后，又暴露出一个重要约束：聊天页内部读取当前会话 id 不能继续依赖 `useParams`，否则地址栏已经变了但组件内部仍可能读到旧会话；当前已统一改为 `usePathname` 派生 `routeSessionId`。同时，“新建会话”后会强制要求下一次发送创建全新的 session，避免上一轮异步收尾把旧 session 基线带入新会话，导致多个会话共用同一份聊天内容。

- 2026-03-08：针对聊天页持续存在的“会话切换闪烁 / AI 完成瞬间轻闪”，已把实现进一步收口到“路由驱动的单一详情加载流”。关键结论：
  - 侧栏点击会话时，action 不再自己请求详情，只负责切路由和命中缓存时的同步展示；详情网络请求统一由 route effect 接管，避免 action + effect 双写同一状态源造成的二次 loading。
  - 新增独立的会话详情缓存 store，用于承载真正跨路由复用的数据；`inputValue / toast / editing` 等局部 UI 状态继续保留在组件本地 `useState`，符合“只把跨路由/跨层级状态放全局”的约束。
  - 消息区骨架屏的触发条件已收紧为“当前路由有 sessionId 且该 session 尚无可用详情缓存并仍在加载”，因此已访问会话切换时应优先秒切缓存内容，而不是反复骨架。
  - 远端 SSE `done` 阶段已避免在回调中和流结束后重复整包写入 session；同时消息列表渲染 key 改为“sessionId + index”维度稳定 key，以降低临时消息 id 切换为真实 id 时的 remount 闪烁。

- 2026-03-08：聊天会话 id 生成策略已从“时间戳 + Math.random”切换为 `crypto.randomUUID().replace(/-/g, \"\")` 的纯随机 32 位十六进制串。这样新会话 URL 不再暴露明显时间前缀（例如 `mmg` / `mmh`），更接近真正的 hash 风格；旧会话 id 与历史链接继续兼容，无需迁移。

- 2026-03-08：聊天页侧栏会话操作已从“直接删除”升级为“Popover 菜单 + 页面级统一 Dialog”。当前结论：这类只服务于单页交互的 UI 状态，不进入 zustand；zustand 继续只承载跨路由/跨层级共享的会话列表、当前会话与详情缓存。会话重命名链路已同时支持登录用户（数据库）和游客（IndexDB）。

- 2026-03-08：聊天页侧边栏会话列表已进一步做减法并补充置顶能力。当前结论：侧边栏不展示时间、不展示“最近会话”标题；默认排序按 `createdAt desc` 保持稳定，避免旧会话因新回复频繁跳位。新增的“置顶”属于会话元数据而非纯局部 UI 状态，因此做成可持久化属性：游客态写入 IndexDB，登录态暂存于服务端 `runtime.__chatUi.pinnedAt`，无需本轮追加 Prisma 迁移。

- 2026-03-08：仓库内 `shared -> question-bank / interview-engine / llm / web` 曾出现一轮共享契约收窄过快导致的类型漂移。当前处理原则已明确：在领域模型仍未统一前，优先通过共享包向后兼容字段恢复全仓可编译，避免单个包先行收窄类型后拖垮整个 monorepo 的 `typecheck`。

- 2026-03-08：共享契约瘦身已进入第一阶段。当前原则不是激进删字段，而是先删除“语义重复且仓库内部已可统一替代”的字段，例如 `QuestionAssessment.feedback -> summary`、`InterviewReport.summary -> overallSummary`、`InterviewQuestion.expectedPoints -> keyPoints`。这样可以逐步把 `packages/shared` 收敛回“契约中心”，同时避免再次触发大面积类型回归。

- 2026-03-08：共享包 `packages/shared` 的内部职责边界已进一步明确。当前约定：`contracts.ts` 只放共享类型；`constants.ts` 放纯常量；`defaults.ts` 放默认配置；`utils.ts` 放纯函数。对外仍统一从 `packages/shared/src/index.ts` 暴露，保证使用方式稳定，同时降低 shared 内部继续膨胀的风险。

- 2026-03-08：`packages/shared` 已从扁平文件结构升级为目录化结构。当前目录约定为：`types/` 放契约类型，`constants/` 放纯常量，`defaults/` 放默认值，`utils/` 放纯函数，根 `index.ts` 仅作为统一出口。这样既保留了外部使用稳定性，也为后续继续拆分 shared 职责预留了空间。

### 2026-03-09（孤儿文件清理）

- 已删除一批确认无引用的孤儿文件，包括旧的 `chat-response-code-detection.ts`、未再接入的 `ChatConversationSkeleton` 组件、`apps/web/public` 下默认模板 SVG，以及根目录残留的临时截图素材。
- 本轮清理目标仅限“文件级、可证实无引用”项，避免把仍在演进中的模块误删。

- 2026-03-09：仓库已正式接入聊天页最小 Playwright 页面烟测，定位是补足“真实页面链路”的回归保护，而不是替代现有 Vitest。当前覆盖 3 条高风险链路：首发预设消息发送、会话切换、删除当前会话。测试实现刻意收敛为游客态 + IndexDB 种子数据 + `/api/chat/stream` 路由 mock，并复用本机 Google Chrome channel，避免把测试稳定性绑定到真实模型、数据库或额外浏览器下载上。

- 2026-03-09：AI 回复消息的 like/dislike 反馈已先按极简闭环落地，目标是优先对齐 `zhitalk.chat` 的基础体验而不是一步到位做运营后台。当前采用“反馈直接存入 `ChatMessage.feedback`，随整个会话一起持久化”的策略：登录用户落到数据库会话 JSON，游客落到本地 IndexDB。这样无需新增 Prisma 表迁移，后续若要演进为独立反馈表，再按分析/运营诉求升级。

### 2026-03-11

- 你确认后台按“用户管理 + 会话管理 + 题库上传 + 模板配置”推进，并要求题库不再存放在单独 package，改为后台上传写入数据库。
- Admin 端技术栈与 Web 对齐，统一使用 shadcn/ui + Tailwind CSS。
- 后续调整为：Admin 端改用 Ant Design，并启用暗黑主题（不再使用 shadcn/ui）。

### 2026-03-12

- 后台新增管理员登录能力（无注册），管理员账号由数据库预置。
- 后台侧栏底部显示管理员信息并支持退出登录。
- Prisma 新增 `AdminUser` 表，后台页面与管理 API 全部要求管理员登录。
- 后台侧栏账号区样式对齐参考图，账号按钮与下拉菜单的视觉细节收敛。
- 后台侧栏子容器改为纵向 flex，确保账号信息固定在窗口最底部。
- 后台禁用 `html/body` 滚动，避免侧栏底部出现留白。
- 后台侧栏账号菜单改为黑底白字，箭头向上。
- 后台账号按钮支持超长邮箱省略显示，菜单文字强制白色。
- 后台账号菜单样式加 `!important` 覆盖，防止被主题变量还原为白底。
- 会话标题改为“数据存全 + UI 省略”，不再在数据层写入 `...`。
- 会话标题列使用原生省略样式，避免 Antd Tooltip 引发水合不一致。
- 管理员账号移除 `name` 字段，仅保留邮箱 + 密码。

### 2026-03-14

- 题库模型扩展为可运营结构（answer/tags/order）。
- 后台题库管理支持筛选、分页、增删改与批量删除。
- 题库导入支持可选字段，并按 `order` + `updatedAt` 排序。
- Prisma 在 `packages/db` 执行时自动读取根目录 `.env.local/.env`，并补充 `dotenv` 依赖。
- 调整会话/题库相关测试断言，确保 `pnpm test` 通过。
- 题库字段收敛：移除 `rubric`，`prompt/keyPoints/followUps` 改为可选，`tags` 改为必填。
- 题库新建题目改为独立页面，支持“保存并继续添加”保留方向/难度/标签/启用。
- 题库题目 ID 由系统自动生成，管理端不再手动输入；导入文件的 `id` 改为可选。
