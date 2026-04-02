# 迭代改动记录（面试通 / mianshitong）

目的：长期项目需要可追溯性。这里记录“每次迭代我们做了什么功能/改动”，便于回看进度、定位回归、规划下一步。

约定：

- 每次完成一个可运行增量（哪怕很小），就在顶部追加一条新记录（新在上）。
- 每条记录尽量包含：目标、主要改动、破坏性变更/迁移、下一步。

## Iteration 6.11（2026-04-02）：补齐 Web E2E 题库初始化并收掉 CI 上的删除会话 flaky

### 目标

- 修复 CI 上 `web-e2e` 在 fresh DB 环境里跑面试相关用例时，因题库未初始化而直接返回“当前题库里没有匹配你画像的可用题目”的问题。
- 顺手收掉删除当前会话用例在 CI 上偶发拿不到侧边栏按钮的 flaky。

### 主要改动

- `apps/web/e2e/support/chat-e2e-fixtures.ts`
  - 新增 `ensureInterviewQuestionBankFixtures`
  - 在 `createConfiguredSession` 前自动检查是否已有 `rag_fixture_` 题库夹具；若当前数据库为空，则主动执行 `pnpm retrieval:seed-fixtures`
  - 这样 Web E2E 不再隐式依赖“本机数据库刚好之前跑过 seed”
- `apps/web/e2e/chat-smoke.spec.ts`
  - 删除当前会话用例在 `hover` 前先等待对应会话按钮可见，降低 CI 上侧边栏尚未稳定渲染时的时序抖动
- `.github/workflows/ci.yml`
  - `web-e2e` job 在 `db:migrate:deploy` 后显式执行 `pnpm retrieval:seed-fixtures`
  - 让 CI 日志和测试前置条件更直观，而不是把题库准备隐含在测试运行期

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只补齐 E2E 前置数据与测试稳定性，不影响业务链路。

### 验证

- 待执行：
  - 清空题库 fixtures 后回归相关 Web E2E
  - 回归删除当前会话用例

### 下一步

- 当前 Web E2E 已不再依赖本地脏数据库。如果后续还有新的面试类端到端用例依赖题库，应继续复用这层显式 fixture 初始化，而不是让测试默认假设 DB 里已有题。

## Iteration 6.10（2026-04-02）：新增 verify:full 统一入口用于全量回归

### 目标

- 保持 `pnpm verify` 继续聚焦格式、Lint、类型、单测和拼写检查，不把日常开发入口直接变成重型命令。
- 同时补一个统一的全量回归入口，避免每次都靠人工记忆再额外补跑 Admin/Web E2E。

### 主要改动

- `package.json`
  - 新增 `verify:full`
  - 当前语义为：
    - 先执行 `pnpm verify`
    - 再执行 `pnpm test:e2e:admin`
    - 最后执行 `pnpm test:e2e:web`
- 文档
  - 本条迭代记录明确区分：
    - `verify`：日常快速自检
    - `verify:full`：包含 Playwright 的全量回归入口

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 不改变现有 `verify` 的行为，只新增一个更重的统一脚本入口。

### 验证

- 待执行：
  - `pnpm verify`
  - `pnpm verify:full`

### 下一步

- 当前如果后续 CI 也想统一入口，可以直接复用 `pnpm verify:full`，而不是在工作流里分散维护多段命令。

## Iteration 6.09（2026-04-02）：修复模拟面试停止生成时被远端草稿覆盖的问题

### 目标

- 修复模拟面试链路里“用户在 assistant 已开始流式输出后点击停止生成，但当前页和刷新后仍然看到完整回复、没有 `已停止生成` 标识”的问题。
- 保持普通聊天已有的 stop 语义一致：只要本地已经收到 assistant 部分内容，中断后就应该保留这段部分内容，并以 `interrupted` 状态持久化。

### 主要改动

- `apps/web/src/app/chat/hooks/use-send-message.ts`
  - 调整 abort 后的远端会话采信逻辑：
    - 以前只要远端消息数比本地基线多，就直接信任远端
    - 现在如果本地 optimistic assistant 已经收到部分内容，而远端最后一条 assistant 还不是 `interrupted`，就不再直接采用远端 completed 草稿，而是优先走本地 `interrupted` 收口与持久化
- `apps/web/src/lib/server/chat-session-model.ts`
  - 新增 `finalizePersistedInterruptedTurn`
  - 用来处理“本轮 user / assistant 草稿已经先落库，但随后又发生中断”的场景：
    - 若已有部分 assistant 内容，则把最后一条 assistant 收成该部分内容并标记为 `interrupted`
    - 若中断前还没有可见 assistant 输出，则移除已先落库的 assistant 草稿
- `apps/web/src/lib/server/chat-session-repository.ts`
  - `appendActorInterruptedTurn` 不再在“当前消息数已大于 expectedMessageCount”时直接短路返回
  - 现在会优先尝试把已落库的当前 turn 收成 interrupted 结果，再保存回会话
- 测试
  - `apps/web/src/app/chat/hooks/use-send-message.dom.test.ts`
    - 新增回归：本地已有 assistant 部分内容时，不应被远端已落库但仍是 completed 的草稿覆盖
  - `apps/web/src/lib/server/chat-session-model.test.ts`
    - 新增回归：锁住“已落库草稿转 interrupted 部分内容”和“无输出时移除 assistant 草稿”两种场景
  - `apps/web/e2e/chat-smoke.spec.ts`
    - 面试 stop 用例改为等 assistant 真正开始输出正文后再点击停止，避免误点到尚未进入可中断窗口的状态

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只修复中断竞态与会话持久化语义，不影响正常完成态的消息结构与面试阶段推进。

### 验证

- 已执行：
  - `pnpm exec vitest run apps/web/src/app/chat/hooks/use-send-message.dom.test.ts apps/web/src/lib/server/chat-session-model.test.ts`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在真实流式回复中停止生成后，仍应保留已输出的 assistant 部分内容'`

### 下一步

- 当前 stop 竞态已补到“先落草稿再流式”的面试链路。后续如果编辑重生成、报告生成或其他流式链路也开始采用“先持久化草稿再流式”的模式，应该优先复用同类 interrupted 收口，而不是再各自补一套竞态判断。

## Iteration 6.08（2026-04-01）：修复首条超长消息发送后的自动滚动丢失问题

### 目标

- 修复聊天页里“用户发送第一条很长的消息时，消息区不会自动滚动到底部，assistant 开始回复后也不继续跟随”的交互问题。
- 保留原有交互语义：如果用户在流式阶段主动上滑，系统仍然不应该强行把用户拉回底部。

### 主要改动

- `apps/web/src/app/chat/hooks/use-auto-scroll.ts`
  - 新增显式的 `followLock` 语义，用来区分：
    - 用户刚主动发送消息，系统应继续跟随到底部
    - 用户真的手动上滑，系统应停止跟随
  - 修复了首条超长消息场景下的时序问题：
    - 以前会在长消息先把内容撑高后，立刻根据当前位置算出“已经不在底部”，从而提前把 follow 关掉
    - 现在在发送期间，只要 follow lock 还在，就不会因为一次内容高度突增而误判为“用户离开底部”
  - 同时在发送结束时补了一次收尾滚动，然后再释放 follow lock。
- `apps/web/src/app/chat/components/chat-message-list.tsx`
  - 为消息滚动容器补了 `data-testid="chat-scroll-container"`，用于 Playwright 直接验证真实滚动位置。
- 测试
  - `apps/web/src/app/chat/hooks/use-auto-scroll.dom.test.ts`
    - 新增首条超长消息场景，锁住“先请求 follow、后消息瞬间撑高”时仍保持自动跟随。
  - `apps/web/e2e/chat-smoke.spec.ts`
    - 新增超长首消息回归，直接验证真实页面中滚动容器与底部的距离会持续保持在阈值内。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整聊天页自动滚动策略和测试辅助选择器，不影响消息协议、会话模型或页面结构本身。

### 验证

- 已执行：
  - `pnpm exec vitest run apps/web/src/app/chat/hooks/use-auto-scroll.dom.test.ts`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '首条超长消息发送后，聊天区应持续自动跟随到底部'`
  - `pnpm verify`

### 下一步

- 当前首条长消息导致的自动滚动丢失已经补上。后续如果聊天区引入图片、附件预览或折叠代码块，更值得继续验证的是动态内容二次撑高时是否仍然能稳定跟随，而不是首条消息时序本身。

- 补充一条真实场景回归增强：`apps/web/e2e/chat-smoke.spec.ts` 里的超长首消息输入，当前已经从压缩版示例扩成更接近真实用户测试的完整简历结构，覆盖个人优势、工作经历、多个项目和补充说明，减少“测试数据太短、时序刚好没触发问题”的侥幸空间。

## Iteration 6.07（2026-04-01）：收紧首轮简历开场格式，禁止先点评并统一标签同行输出

### 目标

- 修复模拟面试首轮收到完整简历时仍然先输出一段“点评”式总结的问题。
- 继续收紧 `**点评**：` 和 `**第X个问题：**` 的格式，要求标签后直接接正文，不再单独换行。
- 让真实流式、引擎首题题面和 mock / fallback 链路在开场口吻上保持一致，避免不同链路再出现割裂。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - 开场首题进一步收口为更自然的简历承接：
    - 改成 `你好，我看过你的简历了...现在我们开始模拟面试吧。`
    - `**第一个问题：**` 改为与题干同行输出。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 面试专用 system prompt 新增两条硬规则：
    - 开场破冰第一题若内部计划没有 feedback，禁止模型自行补 `**点评**：`
    - `**点评**：` / `**第X个问题：**` 标签后必须直接接正文，不要换行
  - `replyShapeInstruction` 现在会区分“warmup 首题且无 feedback”的场景，明确要求：
    - 先用 1 到 2 句简短自然的话承接简历
    - 不要长篇评价简历
    - 然后直接进入 `**第一个问题：**`
  - 同步把 warmup / technical / project 的 main question 口吻示例改成与目标格式一致，减少模型继续学到旧的分行写法。
- `packages/llm/src/mock-provider.ts`
  - mock / fallback 的主问题文案也收成 `**第X个问题：** ...` 同行格式，避免降级链路回退到旧题面。
- 测试
  - `packages/interview-engine/src/index.test.ts`
    - 锁住新的首轮承接文案与同行题面格式。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 锁住 warmup 首题不得自补 `**点评**：`
    - 锁住标签后直接接正文、不换行的 prompt 约束
    - 更新 main question few-shot 断言，防止回退到旧分行格式
  - `packages/llm/src/mock-provider.test.ts`
    - 锁住 mock 主问题改为粗体编号同行输出
  - `apps/web/e2e/chat-smoke.spec.ts`
    - 锁住首轮收到简历后先自然开场、不先点评
    - 锁住 warmup 回答不完整时仍先追问，再进入 `第二个问题`

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只继续收紧用户可见口吻与格式协议，不影响阶段推进、评分和流式协议本身。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts' packages/llm/src/mock-provider.test.ts`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖|模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 当前首轮简历开场已经不再先做“简历点评”，格式也被硬约束住了。下一轮如果还要继续打磨，更值得看的会是主问题后的点评篇幅是否还能再短一点，以及不同模型下首段承接是否还存在轻微模板感。

- 补充一条更细的产品格式要求：如果题目后面带有括号提示，这段提示不仅要保留，而且必须独占一行展示，不能被模型省掉，也不能接在问题句后面。
- 因此当前真实流式 prompt 又加了一层更硬的约束：内部计划里如果已经带了括号提示，最终输出必须原样保留并落成单独一行。

## Iteration 6.03（2026-04-01）：把技术题追问承接句继续收成更像现场口吻

## Iteration 6.04（2026-04-01）：把项目深挖追问承接句继续收成更像现场追问

## Iteration 6.06（2026-04-01）：收紧面试回复格式协议并修复题号重置问题

### 目标

- 修复模拟面试真实对话里两类高优先级问题：
  - 回复段落结构不稳定，没能稳定落成“承接 / 点评 / 第 X 个问题 / 可选提示”这种可预期格式
  - 模型在继续往下出题时，偶发把题号重置回 `第一个问题`
- 让引擎首题题面更贴近用户期望，同时把真实流式 prompt 的格式与题号规则收成硬约束，而不再只靠 few-shot 学习。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - 开场首题的本地题面重写为更接近目标格式：
    - 去掉 `我当前对你的理解是...` 这类系统分析句
    - 改成 `好的，我看了你的简历。`
    - 主问题改成粗体 `**第一个问题：**`
    - 轻提示单独落成括号行
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 在面试专用 system prompt 里新增硬约束：
    - 如果这一轮是新主问题，优先按“承接 -> **点评** -> **第X个问题：** -> （提示）”输出
    - 如果这一轮是追问，禁止输出新的 `**第X个问题：**`
    - 如果内部计划已经给出题号，例如 `第二个问题`，输出里的题号必须完全一致，不得改写、跳号或重置
  - 新增按回合类型生成的 `replyShapeInstruction`，把格式规则显式传给真实模型，而不是只靠 few-shot 暗示。
- 测试
  - `packages/interview-engine/src/index.test.ts`
    - 锁住首题题面不再出现 `我当前对你的理解是`
    - 锁住 warmup 转技术题时不会重新出现 `第一个问题`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 锁住新的格式协议文案与题号硬约束
    - 锁住追问回合不能重新编号
  - `apps/web/e2e/chat-smoke.spec.ts`
    - 新增断言：进入 `第二个问题` 后，最后一条 assistant 不应再包含 `第一个问题`

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整首题题面和真实流式的输出约束，不影响阶段状态机、评分和流式协议本身。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 当前面试主链上“段落结构失稳”和“题号重置”的高优问题已补上。如果后续还要继续打磨，更值得看的会是总结收口在真实模型下是否还会偶发偏长或偏教练式，而不是继续补格式层硬规则。

## Iteration 6.05（2026-04-01）：把开场首题与总结收口里剩余的系统播报感继续压掉

### 目标

- 继续清理用户第一眼就能感知到的系统播报感，避免开场主问里还出现“我们先热个身”、项目题里还出现“能力上限”、mock 总结里还出现“面试结束，总分”。
- 让首题、项目主问和总结收口更像真人面试官说话，而不是训练器或评分器回显。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 开场主问示例继续收口：
    - `我先根据你刚才给的信息，从自我介绍开始` -> `我们先从自我介绍开始`
    - `我们先热个身` 直接去掉
  - 项目主问第二示例继续收口：
    - `最能体现能力上限的项目` -> `最能代表你的项目`
    - `按背景、挑战、方案、结果这条线展开` -> `把背景、挑战、方案和结果讲清楚`
- `packages/llm/src/mock-provider.ts`
  - mock / fallback 总结开头从 `面试结束，总分 ...` 收成更自然的 `今天这轮我会给你 ...，当前更接近 ...`
- 测试
  - `packages/llm/src/mock-provider.test.ts`
    - 更新总结断言，防止回退到 `面试结束，总分`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 新增开场主问和项目主问断言，锁住去 `热个身`、去 `能力上限` 后的新口吻。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整开场主问、项目主问和 mock 总结的用户可见文案，不影响阶段状态机、评分或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 当前面试主链上最明显的“系统/训练器播报感”已经基本收口。如果后续还要继续打磨，更值得看的会是总结收口在真实模型场景下的整体篇幅和节奏，而不再是单个词句替换。

### 目标

- 继续降低项目深挖追问里的动作播报感，避免真实流式 few-shot 和 mock/fallback 继续使用“我继续追一个细节”“这次你重点补清楚”这类训练器口吻。
- 让项目题追问更像面试官顺着项目细节往下压，而不是先说明自己正在做追问动作。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 项目深挖 follow-up 的 few-shot 承接句继续收短：
    - 背景复杂度：`我继续追一个点` -> `那背景和边界这块你讲具体一点`
    - 收益验证：`我继续追一个细节` -> `那结果怎么验证，你讲具体一点`
    - 方案取舍：`我继续追一个关键点` -> `那为什么这么选，你展开一下`
  - 同时把“代价”类第二示例也收成更自然的 `那代价这块你也说一下`。
- `packages/llm/src/mock-provider.ts`
  - mock / fallback 的项目深挖追问同步收口，避免 fallback 场景继续回退到旧的训练式承接句。
  - 项目题结尾提示也统一从 `这次你重点补清楚` 收成更自然的 `你这次就把 XXX 这块讲具体一点。`
- 测试
  - `packages/llm/src/mock-provider.test.ts`
    - 更新项目题 context / outcome 断言，锁住新的承接句与结尾提示。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 更新项目题方案取舍夹具，并新增背景 / 结果型 few-shot 断言，防止旧承接句回退。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整项目深挖追问的用户可见口吻，不影响阶段状态机、评分、追问焦点或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查总结收口里是否还保留过强的“系统报告感”，例如过于固定的“面试结束，总分”这类表述是否还要继续收口。

### 目标

- 继续降低技术题追问里的脚本承接感，避免真实流式 few-shot 和 mock/fallback 继续使用“我继续追问一下”“我继续追一个点”这类训练器口吻。
- 让技术题追问更像面试官顺着回答往下压细节，而不是先播报“现在要追问了”。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 技术题 follow-up 的 few-shot 承接句继续收短：
    - 场景题：`我继续追一个点` -> `那你往下拆一下`
    - 工程题：`我继续追一个点` -> `那取舍这块你展开一下`
    - 原理题：`你接着说说` 收成更直接的 `那你把机制再往下讲一层`
- `packages/llm/src/mock-provider.ts`
  - mock / fallback 的技术题追问同步收口，避免 fallback 场景继续回退到旧的训练式承接句。
  - 同时把 `这次你重点补充` 统一收成更自然的 `你这次就把 XXX 这块补具体一点。`
- 测试
  - `packages/llm/src/mock-provider.test.ts`
    - 更新三类技术题追问断言，锁住新的承接句与补充引导。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 更新原理题追问夹具，并新增工程题 few-shot 断言，防止旧承接句回退。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整技术题追问的用户可见口吻，不影响阶段状态机、评分、追问焦点或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查项目深挖 follow-up 的承接句，例如“我继续追一个细节”这类半句，是否也还可以继续收短。

## Iteration 6.02（2026-04-01）：把 warmup 切技术题的承接句继续收成更自然的现场转场

### 目标

- 继续降低 warmup 结束后切到技术题时的“说明状态再发问”感，避免真实流式 few-shot 继续教模型说出过长的转场播报。
- 让模型更容易学到“先接一句，再直接进题”的现场感，而不是“先做阶段总结，再解释题型”。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 原理机制题的转场示例继续收短：
    - `好，我大概知道你的背景了。第二个问题，我们先聊一道基础原理题` -> `好，背景我先记住了。第二个问题`
    - `下面我想先确认一下你的基础深度` -> `我们直接看基础深度`
  - 同时把主问题拆成更像现场追问的短句，例如把 `以及为什么会这样安排` 收成单独一句 `为什么会这样安排？`
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
  - 更新 few-shot 断言，锁住新的短转场表达，并防止旧的书面承接句回退。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整真实流式从 warmup 切到技术题的口吻示例，不影响阶段状态机、评分、题面或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查技术题 follow-up few-shot 里的追问承接句，例如“我继续追问一下”“我想继续往工程实践里压一层”这类半句是否也还可以继续收短。

## Iteration 6.01（2026-04-01）：把 warmup few-shot 里的解释性半句继续压短

### 目标

- 继续降低真实流式 warmup 追问示例里的“解释性播报”感，避免模型学到过长的承接半句。
- 让真实模型更容易学到“先打断、再直问”的开场追问口吻，而不是“先解释流程，再抛问题”。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - warmup follow-up 的 few-shot 第二示例继续收短：
    - 经历主线：`我知道你做过前端，但我还想再压实一点` -> `我再压实一点`
    - 求职动机：`技术题我们等一下再进。我想先听清一件事` -> `先不聊技术`
    - 代表项目：`我们先别往后跳，先把代表作听实一点` -> `我们先别往后跳`
  - 同时把示例问题本身也继续往更口语的现场追问收口，例如 `最想解决现在的什么问题`、`最能代表你的项目，先展开讲`。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
  - 新增/更新断言，锁住新的短承接表达，并防止旧的解释性半句回退。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整真实流式 warmup few-shot 的用户可见口吻示例，不影响阶段状态机、评分、追问分类或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查 warmup 首题后的第一句点评和技术题承接句之间，是否还有类似“先说明状态再发问”的完整书面句残留。

## Iteration 6.00（2026-04-01）：把 warmup 追问第二句继续收成更像现场打断式提问

### 目标

- 继续降低 warmup 追问里的书面感，避免第二句问题还写得过满、过完整，像准备好的问答稿。
- 让开场追问更接近真人现场打断式提问：问题更短，压重点更直接，但原有追问焦点不变。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - warmup 内置追问继续收短：
    - 经历主线：`最稳定的一条主线是什么` -> `主线更偏哪条`
    - 代表项目：`如果现在就展开讲一个项目，你会先讲哪个？为什么先讲它？` -> `那如果现在就展开一个项目，你先讲哪个？`
    - 求职动机：`最关注的是什么` -> `最在意哪层`
- `packages/llm/src/mock-provider.ts`
  - mock / fallback 的 warmup 追问同步收成更短的现场问法，避免 fallback 场景继续回退到完整书面句。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 真实流式 warmup follow-up few-shot 同步收口：
    - 追经历主线和代表项目的主问题更短、更像现场打断
    - 求职动机的第二示例也改成更自然的“我想先听清一件事”
    - 代表项目的第二示例也改成“先把代表作听实一点”
- 测试
  - `packages/llm/src/mock-provider.test.ts`
    - 更新 warmup 三类追问断言，锁住新的短问法。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 更新 warmup 主线 / 代表项目 / 求职动机的 few-shot 断言，防止旧句型回退。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整 warmup 追问第二句和 few-shot 示例的用户可见文案，不影响阶段状态机、评分、追问分类或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查 warmup 第二示例里的解释性半句还要不要继续压缩，让整条追问更接近真人打断式问法，而不是“主问题 + 解释句”双句都比较完整。

## Iteration 5.99（2026-04-01）：把 warmup 追问结尾从“标签提示”收成更自然的现场引导

### 目标

- 继续降低 warmup 追问里的标签感，避免最后还继续说“这次你重点补清楚：XXX”这种像训练器在贴标签的收尾。
- 让 warmup 追问最后一句更像面试官现场引导，把用户往“继续讲具体一点”推，而不是像 checklist 提示。

### 主要改动

- `packages/llm/src/mock-provider.ts`
  - warmup 三类追问的结尾提示统一从：
    - `这次你重点补清楚：XXX`
  - 收成：
    - `你这次就重点把 XXX 这块讲具体一点。`
  - 当前只调整 warmup 追问的收尾口吻，不改缺失点分类和追问焦点。
- 测试
  - `packages/llm/src/mock-provider.test.ts`
    - 更新 warmup 三类追问断言，锁住新的收尾引导。
    - 同时防止 warmup 回退到 `这次你重点补清楚` 这种标签式说法。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整 warmup 追问末尾的用户可见文案，不影响阶段状态机、评分、追问分类或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查 warmup 追问里的第二句提问是否还可以继续收短，让整条追问更接近真人现场打断式提问，而不是两句都写得很完整。

## Iteration 5.98（2026-04-01）：把 warmup 追问里的点评首句继续收成更自然的现场反馈

### 目标

- 继续降低 warmup 追问里的训练器味，避免追问前的点评首句还停留在“你的基本背景已经有了，但……还没有立起来”“沿着什么主线在积累”这类明显带训练痕迹的说法。
- 让 warmup 追问前的点评更像面试官现场听完回答后的即时反馈，再自然承接下一句追问。

### 主要改动

- `packages/llm/src/mock-provider.ts`
  - warmup 三类追问的点评首句同步收口：
    - 经历主线：强调“真正串起来的主线，我还没有完全听出来”
    - 代表项目：强调“最该先展开讲的那个项目，还没有落下来”
    - 求职动机：强调“为什么出来看机会，现在还不够具体”
  - 当前没有改 warmup 的缺失点判断和追问焦点，只调整追问前的反馈说法。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 真实流式 warmup follow-up few-shot 同步收口，确保真实流式和 mock / fallback 的评语继续保持一致，不再混用旧的训练式点评。
- 测试
  - `packages/llm/src/mock-provider.test.ts`
    - 更新 warmup 三类追问断言，锁住新的点评首句，并防止旧表达回退。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 更新 warmup 主线 / 代表项目 / 求职动机的 few-shot 断言，锁住新的点评首句。
  - `apps/web/e2e/chat-smoke.spec.ts`
    - 更新“开场回答不完整时，应先追问再进入技术题”的 Web 回归断言，页面里现在会出现“真正串起来的主线”，且不再出现“沿着什么主线在积累”。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整 warmup 追问前的点评文案，不影响阶段状态机、评分、追问分类或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查 warmup 追问后面的结尾提示是否也还偏训练器，例如“这次你重点补清楚：XXX”这类标签式收尾，要不要继续收成更自然的现场引导。

## Iteration 5.97（2026-04-01）：把 warmup 追问前缀从“脚本承接”收成更像现场口吻

### 目标

- 继续降低 warmup 追问里的脚本味，避免在追问前继续出现“我先追一个点 / 我继续追一个点 / 先不急着进技术题 / 我先不往后切题”这类明显像流程控制器在播报的句子。
- 让开场追问更像真人面试官现场压细节，而不是先报一个控制动作，再问问题。

### 主要改动

- `packages/llm/src/mock-provider.ts`
  - warmup 追问前缀统一收口：
    - `我先追一个点` -> `我先确认一下`
    - `我继续追一个点` -> `我再确认一下`
  - 当前没有改 warmup 的缺失点分类和追问焦点，只调整承接口吻。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 真实流式 warmup follow-up few-shot 同步收口：
    - `我先追一个点` -> `我先确认一下`
    - `我继续追一个点` -> `我再确认一下`
    - `先不急着进技术题` -> `技术题我们等一下再进`
    - `我先不往后切题` -> `我们先别往后跳`
  - 这样用户看到的 warmup 追问会更像现场承接，而不是状态机在解释自己接下来要做什么。
- 测试
  - `packages/llm/src/mock-provider.test.ts`
    - 更新 warmup 三类追问断言，锁住新的承接前缀。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 更新 warmup 主线 / 代表项目 / 求职动机的 few-shot 断言，防止旧前缀回退。
  - `apps/web/e2e/chat-smoke.spec.ts`
    - 更新“开场回答不完整时，应先追问再进入技术题”的 Web 断言，页面里现在应出现“我先确认一下”，不再出现“我先追一个点”。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整 warmup 追问承接口吻，不影响阶段状态机、评分、追问分类或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查 warmup 追问里的点评首句本身要不要再收一层，例如“你的基本背景已经有了，但……还没有立起来”这类明显带训练痕迹的评语，是否也可以继续往更自然的现场反馈推进。

## Iteration 5.96（2026-04-01）：把 warmup 追问从“训练句型”收成更像现场追问

### 目标

- 继续降低开场追问的训练感，避免 warmup 里继续出现“如果只选一个项目来证明你的能力上限”“如果只用一两句话概括”这类太像答题教练的话。
- 让开场追问更像面试官现场压细节：仍然追经历主线、代表项目和求职动机，但换成更自然的问法。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - warmup 内置追问改成更自然的表达：
    - 经历主线：改成“最稳定的一条主线是什么”
    - 代表项目：改成“如果现在就展开讲一个项目，你会先讲哪个”
    - 求职动机：改成“你这次出来看机会，最关注的是什么”
  - 当前没有改 warmup 的缺失点判断和推进逻辑，只调整用户可见追问文案。
- `packages/llm/src/mock-provider.ts`
  - mock / fallback 的 warmup 追问同步改口吻，避免 fallback 场景继续暴露旧的训练句型。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 真实流式 warmup follow-up few-shot 同步收口：
    - 不再用“如果只用一两句话概括”
    - 不再用“证明你的能力上限”
  - 仍保持原有三类 warmup 追问语义，只把说法收得更像现场对话。
- 测试
  - `packages/interview-engine/src/index.test.ts`
    - 新增 warmup 不完整回答后的追问断言，锁住“最稳定的一条主线是什么”，并防止旧句型回退。
  - `packages/llm/src/mock-provider.test.ts`
    - 新增 warmup 主线追问断言，并更新代表项目、求职动机断言。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 新增 warmup 主线追问 few-shot 断言，并更新代表项目 / 求职动机示例断言。
  - `apps/web/e2e/chat-smoke.spec.ts`
    - 更新“开场回答不完整时，应先追问再进入技术题”的 Web 回归断言，确保页面里出现新的主线追问，不再出现旧的训练式话术。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整 warmup 追问的用户可见文案，不影响阶段状态机、评分、追问分类和流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在开场回答不完整时，应先追问再进入技术题|模拟面试应按阶段依次进入破冰、技术题和项目深挖'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查 warmup 追问里的点评前缀本身要不要再收一层，例如“我先追一个点 / 我继续追一个点”是否也可以进一步变成更口语化的现场承接。

## Iteration 5.95（2026-04-01）：把 warmup 点评从“教学提示”收成更像现场反馈

### 目标

- 继续降低模拟面试开场阶段的“训练器味”，避免用户答完自我介绍后，系统继续用“建议后面按三段来讲”“补一句 X 是 Y”这种教学模板说话。
- 让 warmup 完成后的点评更接近真人面试官现场反馈，再更自然地承接到下一道技术题。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - 调整 warmup 完成后的本地点评文案：
    - 过短回答：不再说“按三段来讲”，改成更自然的“把最近主线、代表项目和看机会原因讲实一点”
    - 中等长度回答：不再举 `X / Y` 占位例子，改成“把项目名称、关键动作和结果先拎出来”
    - 完整回答：从“量化结果和个人角色”扩成“个人角色、关键取舍和结果量化”
  - 当前没有改 warmup 的阶段推进、覆盖判断和追问规则，只调整用户可见反馈文案。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 真实流式 few-shot 里，从 warmup 切到原理机制题的承接示例也同步收口：
    - 从“你刚才的自我介绍主线是清楚的”
    - 改成“好，我大概知道你的背景了”
  - 这一步的目的不是换语气词，而是减少“模板点评 + 固定切题”的训练器味。
- 测试
  - `packages/interview-engine/src/index.test.ts`
    - 新增 warmup 点评文案断言，锁住：
      - 会出现“你的基本背景我大概知道了”
      - 不再回退到 `我最有代表性的项目是 X`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 新增从 warmup 进入原理机制题时的 few-shot 承接断言。
  - `apps/web/e2e/chat-smoke.spec.ts`
    - Web 回归断言同步补一条，确保页面不再出现旧的占位式 warmup 提示文案。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整 warmup 点评和承接示例的用户可见文案，不影响状态机、评分或流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts`
  - `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查 warmup 追问本身是否还需要再压一层，比如把“如果只选一个项目来证明你的能力上限”这类明显带训练感的句子再收成更像面试官现场追问的表达。

## Iteration 5.94（2026-04-01）：把 warmup 首题从“三条提纲”收成一句真人主问

### 目标

- 继续降低模拟面试开场第一句的“脚本播报感”，避免 warmup 首题一上来就用“三件事 + 编号提纲”教用户答题。
- 让破冰首题更接近真人面试官现场开问：先抛一个自然主问，再用一句轻引导点出经历主线、代表项目和求职动机。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - warmup 首题从：
    - `请你先用 1 到 2 分钟做个自我介绍，重点讲清三件事`
    - `1. ... 2. ... 3. ...`
  - 收成一句更自然的主问：
    - `你先做个简短自我介绍吧。重点讲讲最近几段经历的主线、最能代表你的项目，以及你这次为什么看机会。`
  - 当前没有改 `keyPoints`、追问逻辑和阶段推进，只调整用户可见题面。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 真实流式 warmup few-shot 同步收口，不再继续示范“1 到 2 分钟”“重点讲清楚”这类训练器式话术。
- 测试
  - `packages/interview-engine/src/index.test.ts`
    - 新增断言，锁住 warmup 首题会保留“第一个问题”但不再出现：
      - `重点讲清三件事`
      - `1.`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 同步更新 warmup 主问题测试，锁住 few-shot 已切到更自然的首题口吻。
  - `apps/web/e2e/chat-smoke.spec.ts`
    - Web 回归断言同步更新，确保页面首题不再回退到旧的提纲式题面。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整 warmup 首题和 few-shot 的用户可见文案，不影响阶段状态机、评分或报告结构。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts`
  - `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖'`
  - `pnpm verify`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先检查 warmup 反馈文案本身是否也还有“教学提示感”，尤其是过短回答后的建议话术，看看要不要继续收成更像现场点评的口吻。

## Iteration 5.93（2026-04-01）：把项目深挖主问题从五条提纲，收成短主问 + 轻引导

### 目标

- 继续降低项目深挖阶段的“答题大纲感”，避免主问题一上来就把 5 条回答结构全部写给用户。
- 让项目题更像真人面试官现场发问：先抛一个短主问，再给一句轻引导，结构感更多交给后续追问去补。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - 项目深挖主问题仍然保留原有三类画像和性能子类型分类，但题面从条目式提纲改成“短主问 + 轻引导”：
    - 工程化项目：强调“为什么要做 / 你主导了什么 / 怎么证明做成了”
    - 性能项目：强调“问题怎么暴露 / 怎么定位和取舍 / 怎么验证优化有效”
    - 业务项目：强调“目标是什么 / 你负责什么 / 怎么证明结果成立”
  - 当前没有改 `keyPoints` 和 `followUps`，只是把结构感从首题题面里收掉，交给现有追问机制继续承接。
- `packages/interview-engine/src/index.test.ts`
  - 同步更新断言，锁住：
    - 项目题面仍然会按画像分型
    - 题面不再出现 `1.` 这种五条编号提纲
    - 关键产品语义仍然保留，例如工程化题会追“为什么做”和“怎么证明做成了”

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只调整项目深挖主问题的用户可见题面，不影响现有阶段推进、追问分类和评分逻辑。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先考虑把 warmup 首题也再收短一档，减少“重点讲清三件事”这种显式提示，让开场更接近真人自然开问。

## Iteration 5.92（2026-04-01）：把报告正文从固定字段顺排，收成更像口头反馈的结构

### 目标

- 继续降低报告阶段的模板感，不只让收口语气分型，还要让正文结构本身更像真人口头反馈，而不是固定输出“优势 / 短板 / 下一步建议”三行。
- 保持现有 `InterviewReport` 数据结构不变，只调整 mock / fallback 下用户可见的组织方式。

### 主要改动

- `packages/llm/src/mock-provider.ts`
  - `generateReportMessage()` 不再固定输出：
    - `优势：...`
    - `短板：...`
    - `下一步建议：...`
  - 当前会根据 `report.level` 和现有 `strengths / gaps / nextSteps` 生成更自然的短段落：
    - `strong`：先强调最能拉开区分度的亮点，再说如何继续拉上限
    - `solid`：先点亮点，再指出最影响说服力的问题，最后给出优先准备顺序
    - `needs-work`：先明确当前最先该补什么，再给出更直接的准备顺序
  - 这次仍然没有修改 `InterviewReport` 结构，只是把已有字段重新组织成更像人说话的报告正文。
- `packages/llm/src/mock-provider.test.ts`
  - 新增断言，锁住：
    - 高分报告会出现“这轮最能拉开区分度的……”
    - 待提升报告会出现“当前最先要补的……”
    - 文案不再回退到固定的 `优势：/短板：` 字段顺排

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只影响 mock / fallback / stop 场景下报告正文的组织方式，不影响评分、报告结构和真实流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先考虑让项目深挖阶段的“主问题题面”进一步缩短，减少条目式提示，让模型更多通过上下文自然追问，而不是在题面里把回答结构写得太满。

## Iteration 5.91（2026-04-01）：把总结收口继续细分成亮点型 / 平衡型 / 补短板型

### 目标

- 继续降低模拟面试最后一段“统一模板总结”的假感，避免所有面试结束语都长得差不多。
- 让总结阶段更像真人面试官的现场收口：表现好时先肯定亮点，表现一般时做平衡反馈，表现偏弱时直接指出先补什么。

### 主要改动

- `packages/llm/src/mock-provider.ts`
  - mock provider 的总结文案不再只有一套统一收尾，而是根据 `report.level` 细分成三种收口方式：
    - `strong`：肯定亮点型
    - `solid`：平衡反馈型
    - `needs-work`：补短板型
  - 这样在 mock / fallback / stop 场景里，最后一段也不会再退化成同一套统一总结模板。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 给真实模型的 report few-shot 同步补了三类收口示例，直接复用现有 `session.report.level` 做轻量推断，不新增状态字段。
  - 当前 report 阶段至少会区分：
    - 高分时先肯定亮点，再补“怎么继续拉上限”
    - 中间档时先肯定一部分，再指出最该提升的表达问题
    - 待提升时直接说明当前最该补什么，不再泛泛鼓励
- 测试
  - `packages/llm/src/mock-provider.test.ts`
    - 新增高分报告和待提升报告的文案断言。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 新增高分 / 待提升报告会注入对应收口示例的断言。
    - 同步更新已有总结测试，锁住默认平衡反馈型示例。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只是在 report 阶段补充更细的语言语义，不影响面试状态推进、评分与报告结构本身。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖'`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先收“报告正文内部结构”，例如把优势、短板和下一步建议的排序做得更像真人口头反馈，而不是固定字段顺排。

## Iteration 5.90（2026-04-01）：把技术题继续细分成原理机制 / 场景设计 / 工程实践三类口吻

### 目标

- 继续降低模拟面试在技术题阶段的“统一模板感”，避免所有技术题都共享同一套点评后承接和追问口吻。
- 让技术题的自然度更接近真人面试官：聊原理题时追机制和边界，聊场景题时追方案拆解和边界条件，聊工程题时追约束与取舍。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 新增轻量技术题分类：
    - `mechanism`：原理机制题
    - `scenario`：场景设计题
    - `engineering`：工程实践题
  - 分类仍然坚持低侵入原则，不改数据库和 runtime 结构，只根据当前题目的用户可见题干文本做轻量推断。
  - 真实模型的 few-shot 现在会按技术题类型切不同示例：
    - 原理机制题：更强调底层原因、执行顺序和边界差异
    - 场景设计题：更强调方案拆解、数据流和边界条件
    - 工程实践题：更强调工具链取舍、落地约束和迁移成本
- `packages/llm/src/mock-provider.ts`
  - mock provider 里的技术题追问也同步按三类技术题切口吻，不再统一返回“关键细节还不够展开”。
  - 这样在 mock / stop / fallback 场景下，技术题也不会再显得像一条模板换皮。
- 测试
  - `packages/llm/src/mock-provider.test.ts`
    - 新增三条测试，分别锁住原理机制题、场景设计题、工程实践题的追问口吻。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 新增技术题场景设计主问题和工程实践追问的 few-shot 注入断言。
    - 同步更新已有断言，确保工程题不再使用通用技术题示例，原理题也不再回退到统一“点评后继续追问”口吻。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只是在真实模型 prompt 和 mock 文案层补技术题语义，不影响现有阶段推进、评分和报告结构。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先把总结收口也做分型，例如“整体表现总结”“给出改进建议”“明确下一轮准备重点”，避免 report 阶段也只用同一套收尾口吻。

## Iteration 5.89（2026-04-01）：让开场破冰也能先追问，再自然进入技术题

## Iteration 5.88（2026-04-01）：把性能优化项目继续拆成加载 / 渲染 / 构建三种问法

### 目标

- 继续提升模拟面试的真人感，修复当前 warmup 阶段“回答完就一定直接进技术题”的脚本味问题。
- 让开场也具备更像 HR / 一面面试官的节奏：回答不完整时，先点评并追问经历主线、代表项目或求职动机；回答足够完整时，再自然切到下一题。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - 开场破冰不再只是静态首题字符串，而是补成了一道轻量的 runtime 虚拟问题 `warmup_self_intro`。
  - warmup 现在会在本地生成一条和正式题一致结构的 `followUpTrace`，但仍坚持低侵入原则：
    - 不新增数据库字段
    - 不改状态机大结构
    - 只复用现有 `followUpTrace / followUpRound / activeQuestionAnswers`
  - 新增 warmup 语义判断：
    - `经历主线`
    - `代表项目`
    - `求职动机`
  - 开场回答不完整时会先留在 `warmup` 阶段追问；回答足够完整时才切到 `technical` 阶段。
  - 为了避免追问过度，这次额外补了一层阈值收口：如果候选人已经覆盖了大部分关键信息，且回答长度足够，就不再为了缺一个点强行追问。
- `packages/llm/src/mock-provider.ts`
  - mock provider 现在也为 warmup 追问单独分了三种口吻：
    - 追经历主线
    - 追代表项目
    - 追求职动机
  - 这样在 mock / fallback / stop 场景下，开场追问也不会再退化成技术题式的统一追问模板。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 给真实模型的 few-shot 新增 warmup follow-up 专用示例，按上面三类缺失点切不同表达方式。
  - 这样真实流式回复在开场阶段也更像真人面试官，而不是只会泛泛说“方向对了，再展开一点”。
- 测试
  - `packages/interview-engine/src/index.test.ts`
    - 新增 warmup 不完整回答时会先追问、再进入技术题的回归。
    - 同步调整已有 trace 断言，适配 warmup 也会写入 `followUpTrace` 的新语义。
  - `packages/llm/src/mock-provider.test.ts`
    - 新增 warmup 追代表项目 / 追求职动机的 mock 文案断言。
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 新增 warmup follow-up few-shot 注入断言。
  - `apps/web/e2e/chat-smoke.spec.ts`
    - 新增真实 Web E2E：开场回答不完整时，应先追问再进入技术题。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只是在已有面试 runtime 上补 warmup 追问语义，不影响原有流式协议、报告结构和项目深挖阶段。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖|模拟面试在开场回答不完整时，应先追问再进入技术题'`

### 下一步

- 如果继续往“更像真人面试官”推进，下一轮优先细分技术题之后的自然承接语义，例如“点评后继续追机制”“点评后切场景题”“点评后转项目”，减少不同题型之间共用同一套过渡口吻。

## Iteration 5.87（2026-04-01）：把项目深挖主问题分成工程化 / 性能 / 业务三种问法

## Iteration 5.86（2026-04-01）：把项目深挖追问细分成背景 / 取舍 / 验证三类

## Iteration 5.85（2026-04-01）：继续去掉模拟面试里的脚本味标签与模板话术

### 目标

- 继续提升项目深挖阶段的真实感，避免“性能优化项目”仍然只有一套泛化题面。
- 让模型更像真人面试官那样，根据候选人的性能项目类型追不同重点，而不是只问“怎么定位、怎么验证”。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - 在现有 `engineering / performance / delivery` 三分类之上，继续把 `performance` 细分成：
    - `loading`：加载性能
    - `rendering`：渲染性能
    - `build`：构建性能
  - 子分类仍然坚持低侵入原则，直接复用 `ResumeProfile` 里的 `primaryTags / projectTags / strengths / evidence` 与用户输入文本做轻量信号推断，不新增数据库字段。
  - 为了减少“构建优化”被误判成纯工程化项目，这次给“构建性能优化”额外补了一层性能语义加权：如果同时出现构建链路词和明显的优化收益词，会优先进入性能项目分支，再在内部细分为构建性能。
  - 项目深挖主问题、关键点和追问现在会按三类性能子场景切不同问法：
    - 加载性能：更强调首屏、白屏、FCP/LCP、资源加载顺序和缓存策略
    - 渲染性能：更强调卡顿、FPS、无效重渲染、长列表和交互流畅度
    - 构建性能：更强调冷启动、增量构建、编译器替换、兼容性风险和研发反馈速度
- `packages/interview-engine/src/index.test.ts`
  - 把原来的统一“性能画像”测试细分成三条单测，分别锁住加载 / 渲染 / 构建三类题面和追问，避免后续回退成统一模板。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前只是在运行时生成项目深挖题时补充更细的语义推断，不影响现有面试状态机、报告结构和流式协议。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts`

### 下一步

- 如果继续沿“更像真人面试官”的方向推进，下一轮优先把 warmup / HR 追问也继续细分，例如单独区分“离职原因”“求职动机”“职业规划”“团队协作冲突”，而不是继续沿用统一的开场追问口吻。

### 目标

- 继续提升项目深挖阶段的真实感，不再只用一个通用项目题覆盖所有候选人。
- 让用户可见文案里的项目标签更自然，避免再把 `engineering` 这种内部 canonical tag 直接展示出来。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - 新增轻量项目类型推断：
    - `engineering`
    - `performance`
    - `delivery`
  - 推断信号直接复用现有 `ResumeProfile` 的 `primaryTags / projectTags / strengths / evidence`，不新增持久化字段。
  - 项目深挖主问题现在会按类型切三套题面：
    - 工程化项目：更强调系统痛点、技术决策、推进落地和研发效率收益
    - 性能优化项目：更强调现象、瓶颈定位、优化手段与指标验证
    - 业务项目：更强调业务目标、协作、约束与交付效果
  - 同时补了一层 tag 展示映射，把 `engineering / performance / javascript` 这类内部标签翻成更自然的中文展示文案。
- `packages/interview-engine/src/index.test.ts`
  - 新增三条测试，覆盖三类画像分别会生成对应风格的项目深挖题。
  - 同时补断言，确保工程化项目题面里不再出现 `engineering` 这类裸标签。
- `apps/web/e2e/chat-smoke.spec.ts`
  - 阶段式面试 E2E 新增断言：
    - 首轮不应出现 `重点经历集中在 engineering`
    - 项目深挖阶段应出现 `工程化或基础设施项目`
    - 页面里不应再出现 `engineering`

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 这次仍然只是在生成项目题时做轻量推断，不影响已有面试状态机、评分和报告结构。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts`
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖'`
  - `pnpm verify`

### 下一步

- 下一轮如果继续做自然度，优先把“性能优化项目”的主问题再拆成“加载性能 / 渲染性能 / 构建性能”三种子问法，这样会比继续堆统一性能题更像真人追项目。

### 目标

- 继续提升项目深挖阶段的“真人面试官感”，避免所有项目追问都落成一种泛化口吻。
- 在不改状态机和数据库结构的前提下，让现有项目追问能根据缺失点自动切换语义焦点。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 新增基于 `followUpTrace.askedMissingPoint` 的轻量分类：
    - `context`：追背景复杂度 / 职责边界
    - `tradeoff`：追方案取舍 / 权衡
    - `outcome`：追结果验证 / 收益闭环
  - 项目深挖追问的 few-shot 不再只有一组，而是会按上面的分类切换不同示例。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 面试流式桥接现在把当前最新一条 `followUpTrace` 一起传给 `buildInterviewReplyTurns()`，让真实模型不仅知道“现在在追问”，还知道“这次在追什么”。
- `packages/llm/src/mock-provider.ts`
  - mock 项目追问口吻也同步按 `missingPoint` 做轻量分类，和真实模型 prompt 尽量保持同一产品语义。
- 新增 `packages/llm/src/mock-provider.test.ts`
  - 锁住：
    - 题目头不再带 topic 标签
    - 项目追背景复杂度的 mock 口吻
    - 项目追收益验证的 mock 口吻
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
  - 新增断言，覆盖项目深挖追问在三种子类型下会注入不同示例。
- `apps/web/e2e/chat-smoke.spec.ts`
  - stop 用例的中止触发改为浏览器原生 `element.click()`，同时放宽阶段推进断言超时，降低关键 E2E 的时序抖动。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 这次改动完全建立在现有 `followUpTrace` 和项目题 `keyPoints` 上，不新增持久化字段。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/llm/src/mock-provider.test.ts`
  - `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖|模拟面试在真实流式回复中停止生成后，仍应保留已输出的 assistant 部分内容'`
  - `pnpm verify`

### 下一步

- 如果继续做自然度，下一轮可以把项目深挖主问题也按“工程化项目 / 业务项目 / 性能优化项目”再细分主问方式，这样后续追问会更顺。

### 目标

- 继续收口模拟面试里用户还能明显感知到的“脚本味”，尤其是 stop / fallback / mock 场景下残留的题目标签和项目题模板术语。
- 让项目深挖更像真人面试官追项目，而不是要求候选人机械套 STAR 模板。

### 主要改动

- `packages/llm/src/mock-provider.ts`
  - `generateQuestionMessage()` 不再生成 `第 N 个问题（engineering）` 这种带 topic 标签的文案，统一改成自然的 `第 N 个问题：`。
  - `generateFollowUpMessage()` 针对项目深挖题单独分支：
    - 不再沿用技术题追问口吻
    - 改成更像项目复盘的“背景和动作讲到了，但取舍过程还不够完整，我继续追一个细节……”
- `packages/interview-engine/src/process-helpers.ts`
  - 项目深挖主问题从“按 STAR 的思路讲清楚”改成更自然的“你可以按这条主线来讲”，保留结构感，但降低模板感。
- `packages/interview-engine/src/index.test.ts`
  - 新增断言，覆盖：
    - 技术题题干不再带 `(javascript)` 之类 topic 标签
    - 项目深挖题干不再出现 `STAR`
- `apps/web/e2e/chat-smoke.spec.ts`
  - 阶段式面试 E2E 新增断言：
    - 首轮不应出现 `（engineering）`
    - 项目深挖提示里不应出现 `按 STAR 的思路讲清楚`

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 当前改动主要作用于 mock / stop / fallback 可见文案和项目深挖题面，不影响真实模型流式协议与状态推进。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts`
  - `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖|模拟面试在真实流式回复中停止生成后，仍应保留已输出的 assistant 部分内容'`
  - `pnpm verify`

### 下一步

- 后续如果继续往“更像真人”推进，优先考虑把项目深挖追问再细分成“追背景复杂度 / 追方案取舍 / 追收益验证”三类，而不是继续在同一条追问文案里兼顾所有目的。

## Iteration 5.84（2026-04-01）：让面试真实流式感知阶段语义，并屏蔽内部规划播报

### 目标

- 继续降低模拟面试里“虽然在流，但说话还是偏通用模板”的感觉，让真实模型明确知道当前是破冰、技术题、项目深挖还是总结阶段。
- 修复内部 `system` 规划片段在 mock / 早停场景下可能漏进用户可见草案的问题，避免再次出现“已根据你的输入生成本场面试计划”这种出戏文本。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - `buildInterviewReplyTurns()` 现在会显式接收 `interviewStage`，并把它组装进给真实模型的回合上下文。
  - 面试专用 few-shot 继续细分，新增/强化：
    - 开场破冰主问题
    - 技术题主问题
    - 项目深挖主问题
    - 技术题追问
    - 项目深挖追问
    - 总结收口
  - `buildDeterministicInterviewReplyDraft()` 现在会过滤 `kind = system` 的内部计划片段，确保用户可见草案只保留真正应该说出口的内容。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 真实模型流式分支现在把 `interviewResult.session.runtime.currentStage` 一起传给面试流式桥接，避免 prompt 只能看到“这一轮要干什么”，却看不到“当前已经处在哪个阶段”。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
  - 新增断言，覆盖：
    - warmup 阶段会注入破冰式口吻示例
    - project 阶段会注入项目复盘式主问/追问示例
    - 用户可见草案会过滤内部 `system` 片段
- `apps/web/e2e/chat-smoke.spec.ts`
  - 阶段式面试 E2E 新增断言：首轮页面不应出现 `已根据你的输入生成本场面试计划`。
- `playwright.config.ts`
  - Web E2E 的 mock stream 分片延迟从 `120ms` 再调整为 `180ms`，进一步稳住 stop 类串跑回归。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 这次仍然没有改状态机的题目推进逻辑，只是让真实模型在同样的节奏下更清楚自己“现在是在什么阶段说话”。

### 验证

- 已执行：
  - `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖|模拟面试在真实流式回复中停止生成后，仍应保留已输出的 assistant 部分内容'`
  - `pnpm verify`

### 下一步

- 下一轮如果继续做自然度，优先把项目深挖和 HR 面继续拆成更细的 few-shot 子类型，例如“项目复盘追结果”“项目追取舍”“HR 追离职原因”“HR 追职业规划”，而不是回到一套大而全的统一示例。

## Iteration 5.83（2026-04-01）：增强面试真实流式口吻，并统一快捷流的 mock 节奏

### 目标

- 继续把模拟面试的用户可见回复从“像内部计划改写”往“像真人面试官现场说话”推进。
- 修复面试 stop E2E 背后的根因，让面试专用快捷流和普通 mock 流一样受统一的分片延迟配置控制。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 为真实模型的面试专用 prompt 新增更细的口吻约束：
    - 减少空泛口头禅
    - 提问要更像顺着现场交流往下追
  - 按回合类型注入差异化 few-shot：
    - 点评后进入下一道主问题
    - 点评后继续追问
    - 总结收口
    - 点评后继续推进
  - 这样做的目的不是再加规则，而是把“自然说法”交给真实模型模仿，减少模板痕迹。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
  - 新增断言，覆盖不同回合类型会看到不同的 few-shot 示例，避免后续 prompt 回退成单一模板。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - `emitShortcutReplyAsStream()` 现在也会读取 `MOCK_STREAM_DELTA_DELAY_MS`。
  - 这意味着面试 mock 流和普通 mock provider 的流式节奏终于统一，Playwright 的 stop 用例不再依赖运气抢点击窗口。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - 新增单测，锁住“配置 `MOCK_STREAM_DELTA_DELAY_MS` 时，快捷流也会按该延迟输出”的行为。
- `playwright.config.ts`
  - Web E2E 的 mock stream 分片延迟从 `72ms` 提高到 `120ms`，给“停止生成”类用例更稳定的操作窗口。
- `apps/web/e2e/chat-smoke.spec.ts`
  - 调整模拟面试 stop 用例的触发方式：
    - 在按钮进入“停止生成”状态后立即触发中止
    - 重点断言最终的 `已停止生成` 持久化结果，而不是继续和首段输出时机抢 race

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 真实环境仍由实际 `streamChat()` 逐 token 输出；这次只增强 prompt 质量，并统一测试环境下的 mock 流节奏。

### 验证

- 已执行：
  - `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts' 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在真实流式回复中停止生成后，仍应保留已输出的 assistant 部分内容'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖'`
  - `pnpm verify`

### 下一步

- 如果后续继续做 HR 面、算法题或更多项目深挖场景，优先沿用“按回合类型补 few-shot”的方式扩面，不要重新回到大段规则和硬模板。

## Iteration 5.82（2026-04-01）：补强面试编号上下文，并为真实流式中止加回归保护

### 目标

- 进一步降低模拟面试中“主问题 / 追问”口吻混杂的风险，让真实模型更稳定地区分“继续追问”与“进入下一题”。
- 为新的面试真实流式链路补一条停止生成回归，确保中断时已输出内容可保留。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - 追问消息的 `kind` 从 `question` 改成显式的 `follow_up`，避免主问题和追问在后续 prompt 组装时语义混淆。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 新增回合上下文推断：
    - `当前回合类型：进入下一道主问题 / 继续追问 / 总结收口 / 点评后继续推进`
    - `当前关联主问题编号：第 N 个问题`
  - 组装给真实模型的 prompt 时，把这层上下文和内部计划片段一起传入，降低模型在追问时误重新编号、或在切题时沿用追问口吻的概率。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
  - 新增追问场景断言，覆盖：
    - `follow_up` 回合会被识别为“继续追问”
    - 会正确继承上一道主问题的编号
- `apps/web/e2e/chat-smoke.spec.ts`
  - 新增真实 Web E2E：
    - `模拟面试在真实流式回复中停止生成后，仍应保留已输出的 assistant 部分内容`
  - 覆盖面试专用流式链路在 stop 时的用户可见行为与刷新后持久化表现。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- `ChatMessage.kind = follow_up` 在面试链路中的使用范围扩大，但前端渲染仍兼容现有 assistant 消息展示，不影响普通聊天链路。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试在真实流式回复中停止生成后，仍应保留已输出的 assistant 部分内容|模拟面试应按阶段依次进入破冰、技术题和项目深挖'`
  - `pnpm test:e2e:web`

## Iteration 5.81（2026-04-01）：让模拟面试改走真实模型流式回复，而不是本地脚本整段返回

### 目标

- 解决当前模拟面试“虽然流程像面试，但回复看起来不是模型逐 token 生成，而是本地脚本整段返回”的问题。
- 保持现有 `interview-engine` 的状态推进、追问判定、评分与报告骨架不变，只把用户可见的面试官话术切到真实模型流式生成。

### 主要改动

- 新增 `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.ts`
  - 负责把 `interview-engine` 生成的内部回合计划包装成给真实模型使用的 prompt：
    - 可见对话历史
    - 当前用户回答
    - 内部计划片段（点评 / 追问 / 下一题 / 总结）
  - 新增“同一回合多条 assistant 计划片段折叠为一条最终消息”的 helper，适配当前前端“一次请求只流一个 assistant 气泡”的协议。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 面试分支不再直接把 `processSessionMessage()` 返回的整段 assistant 文本一次性落库后 `done`。
  - 现在的链路改成：
    - 先由 `interview-engine` 推进状态，产出内部计划片段
    - 先持久化一份折叠后的草案消息，确保会话状态已前进
    - 再调用当前 `StreamChatProvider`（DeepSeek / Ollama）对用户可见文本做真实流式生成
    - 流式结束后，用最终模型文本覆盖草案消息再落库
  - `mock` 环境下继续走可控的测试流式文本，确保 Playwright / Vitest 稳定。
- 新增测试：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts`
    - 覆盖草案折叠
    - 覆盖给模型的 prompt 拼装
    - 覆盖多条 assistant 计划合并为单条最终消息

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 前端 SSE 协议仍保持单 assistant 气泡流式更新，不需要额外改客户端协议。
- 当前真实模型流式仅接管“用户可见的面试官回复”，而不是重写状态机本身；也就是说：
  - 追问/切题/报告时机仍由 `interview-engine` 决策
  - 但具体说出来的话，已改成真实模型流式生成

### 验证

- 已执行：
  - `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/interview-streaming.test.ts' packages/interview-engine/src/index.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖'`
  - `pnpm test:e2e:web`

## Iteration 5.80（2026-04-01）：把模拟面试从系统播报改成真人式逐问逐答

### 目标

- 修正当前模拟面试“太像系统配置播报、不像真人面试官”的问题。
- 让用户发来简历并说“开始面试”后，直接进入一问一答节奏，而不是先看到“本场共几题 / 反馈模式”这类出戏文案。

### 主要改动

- `packages/interview-engine/src/process-helpers.ts`
  - 启动面试时不再额外插入 kickoff 播报消息。
  - 开场破冰题改成直接在首条问题里自然接住简历内容，并明确以“第一个问题”开问。
  - 热身点评不再附带“我们继续进入技术题”这类系统提示，改成只保留点评本身。
  - 技术题与项目深挖题的显示序号统一按“热身题也算一道题”推进：
    - 热身题：第一个问题
    - 第一技术题：第二个问题
    - 项目深挖：继续顺延
- `packages/interview-engine/src/process-session-message.ts`
  - 技术题和项目深挖题在回答收口后，都会先输出点评，再决定是否进入下一题或最终报告，不再受 `feedbackMode` 影响而跳过点评。
  - 下一道主问题的显示序号同步改成新的自然编号规则。
- `packages/llm/src/mock-provider.ts`
  - `generateQuestionMessage()` 从 `问题 1/4` 改成 `第一个问题 / 第二个问题` 风格。
  - `generateFollowUpMessage()` 从生硬的“我补一个追问”改成“点评 + 我继续追问一下”。
  - `generateQuestionFeedback()` 去掉“本题反馈 / 评分”式系统口吻，改成更像真人面试官的点评语气。
  - kickoff 兜底文案也同步收敛，不再暴露总题数和反馈模式。
- `apps/web/e2e/chat-smoke.spec.ts`
  - 模拟面试 E2E 断言切换到新预期：
    - 页面不应出现 `本场共` / `反馈模式`
    - 开场应直接进入 `第一个问题`
    - 热身后应出现 `点评：` 和 `第二个问题`
- `packages/interview-engine/src/index.test.ts`
  - 补单测断言，覆盖：
    - 首题显示为 `第一个问题`
    - 不再出现 `本场共`
    - 第一技术题显示为 `第二个问题`
    - 追问文案带有新的点评式语气

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- `InterviewConfig.feedbackMode` 暂时仍保留在配置层，但不再决定每题结束后是否展示点评；当前面试主链统一采用“结题先点评，再继续”的对话体验。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖'`
  - `pnpm test:e2e:web`

## Iteration 5.79（2026-04-01）：收口知识检索缓存串扰与面试流程 E2E 稳定性

### 目标

- 解决 Web 全量 E2E 并发场景下，技术问答偶发命中 `interview_playbook` 而不是 `tech_knowledge` 的回归。
- 收口模拟面试与多轮真实聊天 fixture 的等待策略，避免流式未结束时就进入下一轮断言。

### 主要改动

- `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - 继续保留知识分片内存缓存，但从“仅 TTL”升级为“TTL + 已发布文档元信息校验”：
    - 新增 published 文档 `count`
    - 新增 published 文档最新 `updatedAt`
  - 只要知识文档有新增、删除或更新，就会主动失效缓存并重新拉取 chunk，避免并发 E2E 和真实后台维护场景拿到过期知识集。
- `apps/web/e2e/support/chat-e2e-fixtures.ts`
  - 新增 `waitForCompletedAssistantTurn`，统一等待：
    - 用户消息出现
    - assistant 预期内容出现
    - 发送按钮恢复为“发送消息”
  - `createRemoteSession` 与 `createRemoteConversationSession` 统一复用，降低多轮真实聊天链路的时序抖动。
- `apps/web/e2e/chat-smoke.spec.ts`
  - 阶段式面试 E2E 不再假设“每次回答后都必须立即出现本题反馈”，改为：
    - 每轮先等待流式结束
    - 再判断是否已进入“项目深挖”阶段
  - 将阶段推进尝试轮数放宽，避免被追问轮次影响。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 知识检索缓存行为更及时，后台更新已发布文档后无需再等待固定 TTL 才能被新请求感知。

### 验证

- 已执行：
  - `pnpm exec vitest run apps/web/src/lib/server/chat-general-policy.test.ts apps/web/src/lib/server/knowledge-document-retriever.test.ts`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '命中文档知识时应把知识上下文注入到真实聊天链路'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖'`
  - `pnpm test:e2e:web`

## Iteration 5.78（2026-04-01）：模拟面试执行链路升级为阶段式流程首版

### 目标

- 不推翻现有 `ResumeProfile / InterviewBlueprint / QuestionPlan / Report` 骨架，先把面试执行体验从“顺排技术题”升级为更像真实面试官的阶段式流程。
- 首版收口到 `warmup -> technical -> project -> wrap_up` 四段，优先改善开场体验与项目深挖能力。

### 主要改动

- `packages/shared/src/types/index.ts`
  - 为 `InterviewRuntimeState` 新增：
    - `currentStage`
    - `projectQuestion`
  - 明确面试执行阶段语义，继续复用现有 runtime JSON 持久化结构。
- `packages/interview-engine/src/process-helpers.ts`
  - 启动面试后不再直接进入第一道技术题，而是：
    - 先生成开场破冰问题
    - 再根据用户输入切入技术题
  - 新增项目深挖问题构建与阶段切换 helper。
  - 收紧项目深挖触发条件：只有用户提供了较完整背景信息时，才会在技术题后进入项目深挖。
- `packages/interview-engine/src/process-session-message.ts`
  - 面试执行链路改为按 `currentStage` 分支：
    - `warmup`：轻点评后进入技术题
    - `technical`：沿用原有追问、评分与题单推进
    - `project`：对动态生成的项目题继续做追问与评分
    - `wrap_up`：生成最终报告
- 兼容与默认值同步补齐：
  - `packages/interview-engine/src/session-core.ts`
  - `apps/web/src/lib/server/chat-session-model.ts`
  - `apps/web/src/app/chat/lib/chat-session-draft.ts`
  - `apps/web/src/lib/server/chat-session-ui-state.ts`
  - `apps/admin/src/lib/chat-session-runtime.ts`
- 补充与调整测试：
  - `packages/interview-engine/src/index.test.ts`
    - 新增阶段式流转断言
    - 覆盖“简历更完整时会进入项目深挖”
  - 同步更新 Web/Admin 侧依赖旧 runtime 字段的测试用例。
  - `apps/web/e2e/chat-smoke.spec.ts`
    - 新增一条真实 Web E2E，覆盖：
      - `warmup` 开场破冰
      - `technical` 技术题切入
      - `project` 项目深挖阶段出现
  - `apps/web/e2e/support/chat-e2e-fixtures.ts`
    - 新增 `createConfiguredSession`，用于在同一访客身份下创建带自定义 config 的远端会话，减少阶段式面试 E2E 的不稳定因素。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 会话 runtime JSON 新增可选字段：
  - `currentStage`
  - `projectQuestion`
- 已补兼容兜底，旧会话缺少这两个字段时会自动回落到默认值。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '模拟面试应按阶段依次进入破冰、技术题和项目深挖'`

## Iteration 5.77（2026-04-01）：统一会话更新后的缓存与激活态同步 helper

### 目标

- 继续收口聊天 hooks 中“会话更新成功后同步缓存、可选刷新列表、同步当前激活会话”这组重复流程，避免 `pin / rename / message feedback` 各自维护一份几乎相同的收尾逻辑。

### 主要改动

- `apps/web/src/app/chat/lib/chat-session-sync-helpers.ts`
  - 新增 `syncChatSessionUpdate`，统一处理：
    - 写入会话缓存
    - 按需刷新会话列表
    - 仅当当前激活会话匹配时替换 active session
- `apps/web/src/app/chat/lib/chat-session-sync-helpers.test.ts`
  - 新增纯单测，覆盖：
    - 提供列表刷新能力时会缓存并同步最新列表
    - 仅在当前激活会话匹配时替换 active session
- 以下 hooks 改为复用同一 helper：
  - `apps/web/src/app/chat/hooks/use-chat-session-pin.ts`
  - `apps/web/src/app/chat/hooks/use-chat-session-rename.ts`
  - `apps/web/src/app/chat/hooks/use-chat-message-feedback.ts`

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅统一会话更新后的同步逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.76（2026-04-01）：收口额度初始化状态切换 helper

### 目标

- 继续沿着聊天 hooks 的低风险整理推进，把 `use-chat-storage` 中额度初始化时的 loading / bootstrapped 状态切换收口成局部 helper，减少 effect 内部重复的状态更新语句。

### 主要改动

- `apps/web/src/app/chat/hooks/use-chat-storage.ts`
  - 新增 `markUsageBootstrapPending`，统一处理额度初始化开始时的：
    - `usageLoading = true`
    - `usageBootstrapped = false`
  - 新增 `markUsageBootstrapSettled`，统一处理额度初始化结束时的：
    - `usageLoading = false`
    - `usageBootstrapped = true`
  - `useEffect` 中只保留异步流程与成功/失败分支，不再重复拼接同一组状态切换。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续整理聊天存储 hook 内部状态切换逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.75（2026-04-01）：统一聊天 hooks 的错误消息 fallback helper

### 目标

- 继续做聊天页内部的低风险收口，把多个 hooks 里重复出现的 `error instanceof Error ? error.message : fallback` 统一到纯 helper，减少错误兜底规则散落在各处的重复代码。

### 主要改动

- `apps/web/src/app/chat/lib/chat-error-message.ts`
  - 新增 `getChatErrorMessage`，统一把未知错误转换为“优先取 `Error.message`，否则回退到指定文案”的规则。
- `apps/web/src/app/chat/lib/chat-error-message.test.ts`
  - 新增纯单测，覆盖：
    - `Error` 实例时返回原始错误消息
    - 非 `Error` 输入时返回 fallback 文案
- 以下 hooks 改为复用同一 helper：
  - `apps/web/src/app/chat/hooks/use-chat-controller-effects.ts`
  - `apps/web/src/app/chat/hooks/use-chat-delete-actions.ts`
  - `apps/web/src/app/chat/hooks/use-send-message.ts`
  - `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - `apps/web/src/app/chat/hooks/use-chat-storage.ts`
  - `apps/web/src/app/chat/hooks/use-chat-message-feedback.ts`
  - `apps/web/src/app/chat/hooks/use-chat-session-pin.ts`
  - `apps/web/src/app/chat/hooks/use-chat-session-rename.ts`

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅统一聊天 hooks 内部错误兜底逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.74（2026-04-01）：收口删除链路中的会话选择重复逻辑

### 目标

- 延续聊天控制器内部的小范围收口，把 `use-chat-delete-actions` 中删除会话后的“应用当前会话选择”和“清空当前会话选择”步骤统一到局部 helper，减少删除转场分支里的重复 setter 调用。

### 主要改动

- `apps/web/src/app/chat/hooks/use-chat-delete-actions.ts`
  - 新增 `applyActiveSessionSelection`，统一处理：
    - 删除当前会话后直接切换到已缓存的下一会话
    - 删除当前会话后拉取远端下一会话并同步当前选择状态
  - 新增 `clearActiveSessionSelection`，统一处理：
    - 删除当前会话且没有剩余会话时清空当前选择状态
    - 删除全部会话后的当前选择清理
  - 删除转场逻辑本身保持不变，仅减少重复状态同步代码。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续整理聊天删除链路内部逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.73（2026-04-01）：收口聊天控制器 effect 中的会话选择重复逻辑

### 目标

- 继续沿着聊天页控制器低风险收口，把 `use-chat-controller-effects` 里重复出现的“应用当前会话选择”和“清空当前会话选择”步骤统一到局部 helper，减少 effect 分支里的重复 setter 调用。

### 主要改动

- `apps/web/src/app/chat/hooks/use-chat-controller-effects.ts`
  - 新增 `applyActiveSessionSelection`，统一处理：
    - 应用缓存会话到当前选择状态
    - 远端加载成功后同步当前选择状态
  - 新增 `clearActiveSessionSelection`，统一处理：
    - 无路由会话时重置当前选择状态
    - 远端加载失败后的当前选择清理
  - effect 主体只保留 hydration 计划判断与异步加载流程，不再重复拼接相同的会话同步步骤。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续整理聊天控制器内部 effect 逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.72（2026-04-01）：收口聊天控制器编辑态重置逻辑

### 目标

- 在前几轮完成聊天页命名与视图/helper 收口后，继续清理 `use-chat-controller*` 中重复的编辑态清理步骤，把 `setEditingMessageId(null)` 与 `setEditingValue('')` 统一收口为局部 helper，降低后续维护时的遗漏风险。

### 主要改动

- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 新增局部 `resetEditingState`，统一用于：
    - 编辑目标失效后的清理
    - 提交编辑前的清理
    - 手动取消编辑
- `apps/web/src/app/chat/hooks/use-chat-controller-actions.ts`
  - 新增同名局部 helper，统一用于：
    - 切换会话时清理编辑态
    - 新建会话时清理编辑态
    - 取消编辑时清理编辑态
- `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
  - 补充断言，覆盖“新建会话时会同步清理编辑态”。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续收口聊天控制器内部重复逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.71（2026-04-01）：抽离 ChatClient 事件处理 helper

### 目标

- 在完成聊天页视图派生逻辑下沉后，继续收口 `ChatClient` 里重复的事件处理步骤，把“发送前是否请求 follow”和“编辑成功后 requestFollow + 聚焦输入框”这类重复动作抽成 helper，进一步减轻主组件事件函数里的重复语句。

### 主要改动

- `apps/web/src/app/chat/lib/chat-client-action-helpers.ts`
  - 新增 `shouldRequestFollowBeforeSend`，集中判断发送前是否需要请求 follow。
  - 新增 `requestFollowAndFocusComposer`，集中处理“requestFollow + 下一帧聚焦输入框”。
- `apps/web/src/app/chat/lib/chat-client-action-helpers.test.ts`
  - 新增轻量单测，覆盖：
    - 仅在未发送且内容非空时请求 follow
    - 编辑成功后先 requestFollow，再聚焦输入框
- `apps/web/src/app/chat/ChatClient.tsx`
  - `handleSubmitMessage` 改为使用 `shouldRequestFollowBeforeSend`。
  - `handleSubmitEditUserMessage` 改为使用 `requestFollowAndFocusComposer`。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续整理 `ChatClient` 的事件处理重复逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.70（2026-04-01）：抽离消息项视图派生 helper

### 目标

- 继续把聊天页里的纯视图判断从组件内部剥离出去，让 `ChatMessageItem` 不再同时承担“消息气泡渲染”和“动作区/中断态/反馈 pending 判定”两类职责，进一步降低组件阅读负担。

### 主要改动

- `apps/web/src/app/chat/lib/chat-message-item-view-state.ts`
  - 新增 `getChatMessageItemViewState`，集中派生：
    - `isUserMessage`
    - `shouldShowActions`
    - `isInterruptedAssistantMessage`
    - `messageFeedbackPending`
    - `canShowEditAction`
- `apps/web/src/app/chat/lib/chat-message-item-view-state.test.ts`
  - 新增纯单测，覆盖：
    - 普通用户消息显示动作区且允许编辑按钮
    - 流式中的 assistant 消息不显示动作区
    - 中断 assistant 消息的中断态与反馈 pending 判定
- `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 改为消费新的 view-state helper，组件本身只保留消息项布局与内容渲染。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续整理消息项组件的内部视图派生逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.69（2026-04-01）：抽离消息列表项视图派生 helper

### 目标

- 继续把聊天页里的纯视图判断从组件 JSX 中下沉出去，让 `ChatMessageList` 不再直接拼接 `isLoading / isStreaming / isEditing / canEditUserMessage` 这组消息项派生逻辑，进一步收敛为“数据准备 + 渲染”的清晰分层。

### 主要改动

- `apps/web/src/app/chat/lib/chat-message-list-view-state.ts`
  - 新增 `getChatMessageListViewState`，集中派生：
    - 过滤后的 `visibleMessages`
    - 每条消息的 `isLoading`
    - 每条消息的 `isStreaming`
    - 每条消息的 `isEditing`
    - 每条消息的 `canEditUserMessage`
- `apps/web/src/app/chat/lib/chat-message-list-view-state.test.ts`
  - 新增纯单测，覆盖：
    - 过滤系统消息
    - 仅最后一条用户消息可编辑
    - 最后一条空 assistant 消息在发送中同时进入 loading 和 streaming
    - 最后一条非空 assistant 消息在发送中只保持 streaming
- `apps/web/src/app/chat/components/chat-message-list.tsx`
  - 改为消费新的 view-state helper，组件本身只保留空态和消息项渲染逻辑。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续整理消息列表的内部视图派生逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.68（2026-04-01）：抽离 ChatClient 视图派生状态 helper

### 目标

- 继续减少 `ChatClient` 主组件里的本地派生状态和条件拼装，把“是否展示过渡态 / 是否保留编辑态 / 是否显示回到底部按钮 / 顶部反馈条样式”等纯视图判断抽成单一 helper，降低主组件阅读负担并让分支逻辑可单测。

### 主要改动

- `apps/web/src/app/chat/lib/chat-client-view-state.ts`
  - 新增 `getChatClientViewState`，集中派生：
    - `hasUserMessages`
    - `shouldShowConversationTransition`
    - `latestMessageContent`
    - `visibleEditingMessageId`
    - `activeBannerFeedback`
    - `bannerFeedbackToneClassName`
    - `shouldShowScrollToBottomButton`
- `apps/web/src/app/chat/lib/chat-client-view-state.test.ts`
  - 新增纯单测，覆盖：
    - 普通可见会话时的派生结果
    - 路由切换加载中的过渡态判断
    - 编辑目标消息已不在当前消息列表时应清空可见编辑态
- `apps/web/src/app/chat/ChatClient.tsx`
  - 改为消费新的 view-state helper，主组件只保留事件处理和组件拼装。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续整理 `ChatClient` 的内部视图派生逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.67（2026-04-01）：继续收正 ChatClient 本地派生状态命名

### 目标

- 在上一轮完成聊天页跨组件透传命名收口后，继续把 `ChatClient` 内部剩余的派生状态名收正为更直接的职责语义，减少 render 分支里的阅读负担。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`
  - 将 `showConversationTransition` 收正为 `shouldShowConversationTransition`。
  - 将 `activeEditingMessageId` 收正为 `visibleEditingMessageId`。
  - 将 `lastMessageContent` 收正为 `latestMessageContent`。
  - 将顶部反馈条局部派生从 `bannerFeedbackContent / bannerFeedbackClassName` 收正为 `activeBannerFeedback / bannerFeedbackToneClassName`。
  - 将“回到底部按钮是否显示”显式收敛为 `shouldShowScrollToBottomButton`，避免 JSX 内继续拼接多条件判断。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续收正 `ChatClient` 本地派生状态命名。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.66（2026-04-01）：收正聊天页“已开始会话”派生状态命名

### 目标

- 继续清理聊天页里“变量名比真实判断更宽泛”的语义偏差，把当前实际含义为“已经存在用户消息”的 `hasConversation` 收正为更精确的命名，避免后续阅读时误以为“只要存在任意消息就算开始会话”。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`
  - 将聊天页派生状态从 `hasConversation` 收正为 `hasUserMessages`。
  - 对应地，回到底部按钮和输入区快捷提示的显示条件改为消费更准确的命名。
- `apps/web/src/app/chat/components/chat-message-list.tsx`
  - 空态显示判断 props 从 `hasConversation` 收正为 `hasUserMessages`。
  - 否定式 props 从 `suppressEmptyState` 收正为更直接的 `hideEmptyState`。
- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 快捷提示显示判断 props 从 `hasConversation` 收正为 `hasUserMessages`。
  - 否定式 props 从 `suppressQuickPrompts` 收正为更直接的 `hideQuickPrompts`。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续收正聊天页派生状态命名。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.65（2026-04-01）：收正顶部统一反馈条状态命名

### 目标

- 继续清理聊天页里“`feedback` 同时指代顶部反馈条和消息反馈”的语义冲突，把控制器层和展示层中顶部统一反馈条的状态明确收正为 `bannerFeedback`，避免后续阅读时再和消息点赞/点踩反馈混淆。

### 主要改动

- `apps/web/src/app/chat/hooks/chat-controller.types.ts`
  - 将顶部反馈条类型从 `ChatFeedback / ChatFeedbackTone` 收正为 `ChatBannerFeedback / ChatBannerFeedbackTone`。
  - 控制器对外状态从 `feedback` 收正为 `bannerFeedback`。
- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 顶部反馈条本地状态从 `feedback` 收正为 `bannerFeedback`。
  - 信息/错误反馈 helper 继续保留原有职责，仅改为驱动新的顶部反馈条状态命名。
- `apps/web/src/app/chat/hooks/use-chat-controller-effects.ts`
  - 顶部反馈条自动清理 effect 同步改为消费 `bannerFeedback / setBannerFeedback`。
- `apps/web/src/app/chat/ChatClient.tsx`
  - 顶部反馈条展示层同步改为使用 `bannerFeedbackContent / bannerFeedbackClassName`。
- `apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
  - 同步更新控制器单测断言，改为校验 `bannerFeedback`。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续收正顶部统一反馈条的内部状态命名。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.64（2026-04-01）：统一会话弹窗草稿状态与关闭逻辑

### 目标

- 继续收口聊天页会话弹窗这组实现，把关闭弹窗、提交成功后关闭、重置重命名输入草稿的重复逻辑统一到单一出口，同时把重命名输入态命名改得更清晰，降低后续维护时的理解成本。

### 主要改动

- `apps/web/src/app/chat/hooks/use-chat-session-dialog.ts`
  - 将重命名输入态从 `renameValue` 收正为 `renameDraftTitle`。
  - 新增统一 `resetDialog`，把“关闭弹窗 + 清空重命名草稿”逻辑集中管理。
  - 重命名、删除单个会话、删除全部会话提交成功后统一走同一套关闭/重置逻辑。
- `apps/web/src/app/chat/components/chat-session-dialog.tsx`
  - 组件 props 同步改为 `renameDraftTitle / onRenameDraftTitleChange`，与当前职责保持一致。
- `apps/web/src/app/chat/ChatClient.tsx`
  - 同步更新会话弹窗相关透传命名。
- `apps/web/src/app/chat/hooks/use-chat-session-dialog.dom.test.ts`
  - 新增 hook 测试，覆盖：
    - 打开重命名弹窗时写入当前标题
    - 关闭时清空草稿
    - 提交成功后关闭并清空草稿
    - 提交中禁止提前关闭

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见功能变化，仅统一会话弹窗内部状态命名与关闭逻辑。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.63（2026-04-01）：统一侧边栏会话项菜单实现

### 目标

- 继续收口聊天侧边栏里残留的交互实现分叉，把会话项“更多操作”从手工 `Popover` 菜单统一到仓库已有的标准 `DropdownMenu`，与访客菜单保持一致的菜单语义和实现方式。

### 主要改动

- `apps/web/src/app/chat/components/chat-sidebar-session-item.tsx`
  - 将会话项“更多操作”从 `Popover` 收口为 `DropdownMenu`。
  - 菜单项改为标准 `DropdownMenuItem`，保留置顶、重命名、删除三项原有行为。
  - 保留 `menuOpen` 状态，仅继续用于侧边栏悬浮操作按钮的显隐控制，不改视觉交互。
- `apps/web/src/app/chat/components/chat-sidebar-session-item.dom.test.tsx`
  - 新增 DOM 测试，覆盖“更多操作”打开后应展示标准菜单项。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见功能变化，仅统一侧边栏会话菜单的实现与语义。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '删除当前会话后应回到空聊天页'`

## Iteration 5.62（2026-04-01）：移除侧边栏顶部按钮残留的 HoverTooltip

### 目标

- 继续对齐聊天页当前“不展示 hover tooltip”的交互口径，把侧边栏顶部“删除所有会话记录 / 新建会话”按钮上残留的 `HoverTooltip` 一并清掉，避免同一页面不同区域仍混用两套交互约定。

### 主要改动

- `apps/web/src/app/chat/components/chat-sidebar.tsx`
  - 删除“删除所有会话记录”和“新建会话”按钮外层残留的 `HoverTooltip` 包装。
  - 保留按钮本身的 `aria-label`，不影响可访问性语义和点击功能。
- `apps/web/src/app/chat/components/chat-sidebar.dom.test.tsx`
  - 新增 DOM 测试，覆盖侧边栏顶部操作按钮 hover 时不再出现 tooltip 的当前行为。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 用户可见变化仅为：侧边栏顶部按钮 hover 时不再显示 tooltip，点击行为不变。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '侧边栏顶部按钮 hover 时不再显示 tooltip'`

## Iteration 5.61（2026-04-01）：拆分消息反馈与顶部反馈条的局部命名

### 目标

- 继续清理聊天页内部“`feedback` 一词同时指代两类不同概念”的阅读负担，让消息点赞/点踩反馈与顶部统一反馈条在局部变量和组件透传层面彻底区分开，降低后续维护时的误判概率。

### 主要改动

- `apps/web/src/app/chat/hooks/use-chat-message-feedback.ts`
  - 将局部状态从 `pendingMessageId` 收正为 `pendingFeedbackTargetMessageId`。
  - 将提交函数从 `setMessageFeedback` 收正为 `submitMessageFeedback`。
- `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 同步改为使用 `messageFeedbackPending`、`activeMessageFeedback`、`onSubmitMessageFeedback` 等更明确的透传命名。
- `apps/web/src/app/chat/components/chat-message-actions.tsx`
  - 将 `activeFeedback / feedbackPending / onSetMessageFeedback` 收正为更明确的消息反馈语义命名。
  - 将局部 helper 从 `resolveNextFeedback / feedbackButtonClass` 收正为消息反馈语义命名，避免与顶部反馈条状态混淆。
- 测试同步更新：
  - `apps/web/src/app/chat/components/chat-message-actions.dom.test.tsx`
  - `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续收正消息反馈相关的局部命名。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.60（2026-04-01）：收正聊天页统一反馈文案命名

### 目标

- 继续消除聊天页里“历史实现名词”和“当前职责语义”之间的偏差，让统一反馈文案配置的命名也与当前模型保持一致，避免状态已经收口为 `feedback`，但文案常量仍停留在 `toast` 语义。

### 主要改动

- `apps/web/src/app/chat/lib/chat-copy.ts`
  - 将 `CHAT_TOAST_COPY` 收正为 `CHAT_FEEDBACK_COPY`。
- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 发送中重复提交时的信息反馈改为使用 `CHAT_FEEDBACK_COPY.replyInProgress`。
- `apps/web/src/app/chat/components/chat-message-actions.tsx`
  - 复制失败提示改为使用 `CHAT_FEEDBACK_COPY.clipboardFailure`。
- `apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
  - 同步改为断言新的统一反馈文案常量。
- `apps/web/e2e/chat-smoke.spec.ts`
  - 复制按钮回归用例标题同步改为“顶部反馈条”口径，避免测试名继续沿用旧 `toast` 语义。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅统一共享文案命名与测试口径。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '消息复制应仅更新局部 copied 状态，不切换基础文案也不触发顶部反馈条'`

## Iteration 5.59（2026-04-01）：继续收正聊天页底层错误反馈命名

### 目标

- 在上一轮对外接口命名收正的基础上，继续把聊天页底层 hook 和事件处理里的错误反馈入口统一到 `error feedback` 语义，避免内外命名不一致导致的维护成本。

### 主要改动

- `apps/web/src/app/chat/hooks/use-send-message.ts`
  - 发送链路依赖项从 `setNotice` 收正为 `setErrorFeedback`。
- `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - 编辑链路依赖项从 `setNotice` 收正为 `setErrorFeedback`。
- `apps/web/src/app/chat/hooks/use-chat-delete-actions.ts`
  - 删除链路依赖项从 `setNotice` 收正为 `setErrorFeedback`。
- `apps/web/src/app/chat/hooks/stream-event-handler.ts`
  - SSE 错误回调从 `setNotice` 收正为 `setErrorFeedback`。
- `apps/web/src/app/chat/hooks/use-chat-message-feedback.ts`
  - 消息反馈错误回调从 `onError` 收正为 `onErrorFeedback`。
- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 控制器对接发送、编辑、删除链路时同步使用 `setErrorFeedback`。
- `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 消息反馈 hook 的错误回调同步改为 `onErrorFeedback`。
- 测试同步更新：
  - `apps/web/src/app/chat/hooks/use-send-message.dom.test.ts`
  - `apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts`
  - `apps/web/src/app/chat/hooks/use-chat-delete-actions.dom.test.ts`
  - `apps/web/src/app/chat/hooks/stream-event-handler.test.ts`
  - `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续统一底层错误反馈命名。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.58（2026-04-01）：收正聊天页错误反馈相关对外命名

### 目标

- 继续清理聊天页接口里残留的历史语义命名，让控制器和组件对外暴露的错误反馈入口与当前真实职责保持一致，减少阅读和维护时的误导。

### 主要改动

- `apps/web/src/app/chat/hooks/chat-controller.types.ts`
  - `ChatController` 对外接口从 `showNotice` 收正为 `showErrorFeedback`。
- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 同步把控制器返回值改为 `showErrorFeedback`。
- `apps/web/src/app/chat/hooks/use-chat-controller-actions.ts`
  - actions 层对应入口从 `showNotice` 收正为 `showErrorFeedback`。
- `apps/web/src/app/chat/ChatClient.tsx`
  - 会话重命名、置顶以及消息列表透传统一改为使用 `showErrorFeedback`。
- `apps/web/src/app/chat/components/chat-message-list.tsx`
  - 组件透传 prop 从 `onNotice` 收正为 `onErrorFeedback`。
- `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 组件透传 prop 从 `onNotice` 收正为 `onErrorFeedback`。
  - 消息反馈错误回调同步对齐新命名。
- `apps/web/src/app/chat/components/chat-message-actions.tsx`
  - 复制失败回调 prop 从 `onNotice` 收正为 `onErrorFeedback`。
- `apps/web/src/app/chat/hooks/use-chat-session-pin.ts`
  - 对外错误回调命名改为 `onErrorFeedback`。
- `apps/web/src/app/chat/hooks/use-chat-session-rename.ts`
  - 对外错误回调命名改为 `onErrorFeedback`。
- 测试同步更新：
  - `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
  - `apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
  - `apps/web/src/app/chat/components/chat-message-actions.dom.test.tsx`
  - `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见行为变化，仅继续清理对外命名语义。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.57（2026-03-31）：统一聊天页反馈状态并同步回归口径

### 目标

- 继续清理聊天控制器里的历史状态包袱，把原先分散的两套顶部反馈状态收口为一套统一反馈模型，减少重复 effect、重复清理逻辑与展示层分支判断。

### 主要改动

- `apps/web/src/app/chat/hooks/chat-controller.types.ts`
  - 新增统一反馈类型 `ChatFeedback` 与 `ChatFeedbackTone`。
  - `ChatController` 从暴露两套分离反馈状态改为暴露单一 `feedback`。
- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 用单一 `feedback` 状态替代原有双反馈状态。
  - 新增内部 `setErrorFeedback / setInfoFeedback`，分别承接错误反馈与普通提示反馈。
  - 保留 `showNotice` 作为现有错误反馈入口，避免外围调用方一起改散。
- `apps/web/src/app/chat/hooks/use-chat-controller-effects.ts`
  - 将原本两套重复的 1.8 秒自动清理 effect 合并为统一的 `feedback` 自动清理逻辑。
  - 会话加载失败、初始化失败等错误场景改为走统一错误反馈入口。
- `apps/web/src/app/chat/ChatClient.tsx`
  - 顶部反馈条改为直接消费 `controller.feedback`，不再通过旧状态组合和双色分支拼装展示。
- `apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
  - 同步改为断言统一反馈对象。
- `apps/web/e2e/chat-smoke.spec.ts`
  - 同步更新复制按钮回归用例，明确当前产品口径为：
    - 复制后仅更新局部 `copied` 状态
    - 不再把按钮基础文案切换为成功提示文案
    - 不触发顶部反馈条

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 用户可见交互语义不变，仅统一内部反馈状态模型并同步测试口径。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '删除当前会话后应回到空聊天页|消息复制应仅更新局部 copied 状态，不切换基础文案也不触发顶部反馈条'`

## Iteration 5.56（2026-03-31）：继续清理聊天控制器与共享文案残留接口

### 目标

- 在不改变聊天页任何用户可见行为的前提下，继续收口已经没有调用方的控制器接口与共享文案残留，减少后续维护时的误导成本。

### 主要改动

- `apps/web/src/app/chat/hooks/chat-controller.types.ts`
  - 删除已无调用方的 `showToast` 控制器接口定义。
- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 删除 `showToast` 的本地实现与返回值暴露，保持内部 `toast` 状态仅服务当前实际使用场景。
- `apps/web/src/app/chat/lib/chat-copy.ts`
  - 删除在 tooltip 方案下线后已无人使用的 `like / dislike` 文案常量。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见交互变化，仅继续清理死接口与无用常量。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.55（2026-03-31）：清理聊天按钮残留的空壳 HoverTooltip 包装

### 目标

- 对齐当前聊天页“不展示 hover tooltip”的交互口径，移除消息动作区与代码块操作按钮上已经被禁用的 `HoverTooltip` 空壳包装，减少误导性的实现残留与无意义包裹层。

### 主要改动

- `apps/web/src/app/chat/components/chat-message-actions.tsx`
  - 删除复制、赞同、不赞同按钮外层已禁用的 `HoverTooltip` 包装。
  - 保留按钮自身 `aria-label`，不影响可访问性语义。
- `apps/web/src/app/chat/components/chat-code-block.tsx`
  - 删除代码块复制、下载按钮外层已禁用的 `HoverTooltip` 包装。
  - 保留按钮自身 `aria-label` 与图标状态切换逻辑。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 用户可见功能不变，仅清理不会实际渲染 tooltip 的包装层。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '删除当前会话后应回到空聊天页'`

## Iteration 5.54（2026-03-31）：移除聊天页残留的成功提示文案

### 目标

- 对齐当前聊天页交互口径，移除复制成功、下载成功这类不再需要的成功提示文案，仅保留失败提示与必要的图标状态反馈，避免和既有产品决策冲突。

### 主要改动

- `apps/web/src/app/chat/hooks/use-chat-controller-actions.ts`
  - 删除未被生产链路使用的复制成功 `toast` 残留逻辑。
- `apps/web/src/app/chat/hooks/chat-controller.types.ts`
  - 移除控制器对外暴露但已无调用方的 `handleCopy` 接口，减少死代码。
- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 同步清理已删除的复制动作透传。
- `apps/web/src/app/chat/lib/chat-copy.ts`
  - 删除 `clipboardSuccess` 与消息动作区 `copied` 成功文案。
  - 为代码块操作补齐稳定的基础按钮文案常量。
- `apps/web/src/app/chat/components/chat-message-actions.tsx`
  - 复制后不再把按钮文案切换为“已复制”，仅保留图标态变化。
  - 复制失败时继续通过 `notice/toast` 链路提示用户。
- `apps/web/src/app/chat/components/chat-code-block.tsx`
  - 下载/复制代码按钮不再切换为“已下载 / 已复制”文案，仅保留图标态变化。
- `apps/web/src/app/chat/components/chat-message-actions.dom.test.tsx`
  - 新增断言，确保复制后按钮文案仍保持为基础文案，不回退为成功提示文案。
- `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
  - 删除与已移除复制成功 `toast` 残留逻辑对应的测试。
- `apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
  - 同步清理控制器 mock 中已删除的复制动作接口。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 用户可见交互仅减少成功提示文案，不影响复制、下载等功能本身。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '删除当前会话后应回到空聊天页'`

## Iteration 5.53（2026-03-31）：集中管理聊天页默认错误与提示文案

### 目标

- 在不改变聊天业务流程的前提下，把聊天页分散在 hooks、API 工具层和消息动作区里的默认错误提示、toast 文案与基础动作文案继续集中管理，降低后续中文化调整与回归修改成本。

### 主要改动

- `apps/web/src/app/chat/lib/chat-copy.ts`
  - 扩展聊天页共享文案配置，新增并集中维护：
    - 默认错误文案
    - 默认 toast 文案
    - 消息动作区基础文案
- `apps/web/src/app/chat/lib/chat-api.ts`
  - 请求失败、删除会话失败、发送失败、编辑失败、空流响应等默认错误改为使用共享文案。
- `apps/web/src/app/chat/lib/chat-message-feedback-api.ts`
  - 反馈接口请求失败默认错误改为使用共享文案。
- `apps/web/src/app/chat/lib/chat-session-settings-api.ts`
  - 会话设置接口请求失败默认错误改为使用共享文案。
- `apps/web/src/app/chat/lib/chat-message-mutations.ts`
  - 可编辑消息校验相关默认提示改为使用共享文案。
- `apps/web/src/app/chat/hooks/stream-event-handler.ts`
  - 流式错误兜底文案改为使用共享文案。
- `apps/web/src/app/chat/hooks/use-send-message.ts`
  - 发送失败默认提示改为使用共享文案。
- `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - 编辑失败与不可编辑消息提示改为使用共享文案。
- `apps/web/src/app/chat/hooks/use-chat-message-feedback.ts`
  - 反馈失败默认提示改为使用共享文案。
- `apps/web/src/app/chat/hooks/use-chat-session-pin.ts`
  - 置顶失败默认提示改为使用共享文案。
- `apps/web/src/app/chat/hooks/use-chat-session-rename.ts`
  - 重命名失败默认提示改为使用共享文案。
- `apps/web/src/app/chat/hooks/use-chat-delete-actions.ts`
  - 删除当前会话 / 删除全部会话失败提示改为使用共享文案。
- `apps/web/src/app/chat/hooks/use-chat-controller-effects.ts`
  - 初始化失败默认提示改为使用共享文案。
- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 生成中提示与编辑限制提示改为使用共享文案。
- `apps/web/src/app/chat/hooks/use-chat-storage.ts`
  - 使用额度初始化失败提示改为使用共享文案。
- `apps/web/src/app/chat/components/chat-message-actions.tsx`
  - 复制失败提示、复制/已复制、编辑消息、赞同/不赞同等动作区文案改为使用共享文案。
- `apps/web/src/app/chat/components/chat-message-actions.dom.test.tsx`
  - 新增共享动作文案断言，避免后续回退到组件内联字符串。
- `apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
  - 同步改为断言共享 toast 文案。
- `apps/web/src/app/chat/hooks/use-send-message.dom.test.ts`
  - 同步改为断言共享错误文案。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 用户可见功能不变，仅统一默认提示文案维护位置。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '删除当前会话后应回到空聊天页|访客菜单应展示中文入口项'`

## Iteration 5.52（2026-03-31）：集中管理聊天页框架层文案

### 目标

- 把聊天页框架层的用户可见文案从组件内联字符串中抽离，减少后续统一语气、文案调整与中文化回归时的分散修改成本。

### 主要改动

- `apps/web/src/app/chat/lib/chat-copy.ts`
  - 新增聊天页框架层共享文案配置，集中维护：
    - 顶部侧栏按钮文案
    - 侧边栏操作文案
    - 会话菜单文案
    - 会话弹窗文案
    - 复制 toast 文案
- `apps/web/src/app/chat/components/chat-header.tsx`
  - 改为使用共享文案配置。
- `apps/web/src/app/chat/components/chat-sidebar.tsx`
  - 改为使用共享文案配置。
- `apps/web/src/app/chat/components/chat-sidebar-session-item.tsx`
  - 改为使用共享文案配置。
- `apps/web/src/app/chat/components/chat-session-dialog.tsx`
  - 改为使用共享文案配置。
- `apps/web/src/app/chat/hooks/use-chat-controller-actions.ts`
  - 复制成功/失败提示改为使用共享文案配置。
- `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
  - 同步改为断言共享文案常量。

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 用户可见功能不变，仅收口文案维护位置。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '删除当前会话后应回到空聊天页|访客菜单应展示中文入口项'`

## Iteration 5.50（2026-03-31）：收口认证文案维护与补齐基础开发文档

### 目标

- 在不改变业务功能的前提下，降低认证页文案维护成本与回归风险。
- 把仓库 README 从脚手架默认内容收口到当前真实工程结构，减少协作误解。

### 主要改动

- `apps/web/src/components/auth/auth-copy.ts`
  - 新增认证页共享文案配置，集中维护登录/注册页面文案。
- `apps/web/src/app/login/login-form.tsx`
  - 改为消费共享认证文案配置，减少页面内联文案。
- `apps/web/src/app/register/page.tsx`
  - 改为消费共享认证文案配置，减少页面内联文案。
- `README.md`
  - 重写根文档，补齐真实仓库结构、启动顺序与质量校验入口。
- `apps/web/README.md`
  - 替换默认 Next.js 模板说明，改为 Web 端的真实职责与常用命令。
- `apps/admin/README.md`
  - 替换默认 Next.js 模板说明，改为 Admin 端的真实职责与常用命令。
- `apps/web/e2e/auth-smoke.spec.ts`
  - 新增认证页 smoke E2E，覆盖：
    - 登录页中文文案
    - 登录页到注册页跳转
    - 注册页中文文案
    - 注册页到登录页跳转

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 无用户可见业务流程变更，仅降低维护成本并补齐基础回归。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '登录页应展示中文文案并可跳转到注册页|注册页应展示中文文案并可跳转到登录页'`

## Iteration 5.51（2026-03-31）：将访客菜单收口为标准下拉菜单组件

### 目标

- 在不改变访客/登录菜单功能的前提下，移除手写外部点击关闭逻辑，改用标准下拉菜单 primitive，提升可访问性与交互稳态。

### 主要改动

- `apps/web/src/components/ui/dropdown-menu.tsx`
  - 新增 Web 端共享下拉菜单封装，基于 Radix Dropdown Menu primitive。
- `apps/web/src/components/guest-menu.tsx`
  - 访客菜单从手写 `open state + click outside` 切换为标准下拉菜单组件。
  - 保持现有菜单项、文案与登录/退出逻辑不变。
  - `up/down` 两种菜单朝向继续保留。
- `apps/web/e2e/guest-menu.spec.ts`
  - 新增访客菜单 smoke E2E，覆盖：
    - 访客按钮显示
    - 菜单可打开
    - 主题切换入口可见
    - 登录入口可见

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。
- 用户可见功能不变，仅实现方式调整。

### 验证

- 已执行：
  - `pnpm verify`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '访客菜单应展示中文入口项'`

## Iteration 5.49（2026-03-31）：补齐 Web 端 NextAuth CredentialsProvider 中文文案

### 目标

- 把 Web 端 NextAuth `CredentialsProvider` 里残留的英文标签同步改为中文，统一认证链路的代码与配置口径。

### 主要改动

- `apps/web/src/lib/server/auth-options.ts`
  - `CredentialsProvider.name` 从 `Credentials` 改为 `邮箱密码登录`
  - `credentials.email.label` 从 `Email` 改为 `邮箱`
  - `credentials.password.label` 从 `Password` 改为 `密码`
- `apps/web/src/components/guest-menu.tsx`
  - 将访客菜单中的 `Guest` 改为 `访客`
  - 头像 `alt` 从 `User Avatar` 改为 `用户头像`
- `apps/web/src/components/auth/auth-card.tsx`
  - 共享认证卡片的默认字段文案改为中文默认值，避免后续新增调用方时再次漏出英文
- `apps/web/src/app/chat/hooks/use-chat-controller-actions.ts`
  - 复制成功提示改为 `已复制到剪贴板`
  - 复制失败提示改为 `复制失败，请手动复制。`
- `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
  - 同步更新复制提示断言

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。

### 验证

- 已执行：
  - `pnpm verify`

## Iteration 5.48（2026-03-31）：将 Web 登录/注册页文案改为中文

### 目标

- 消除 Web 登录/注册页面向用户暴露的英文文案，统一为中文界面表达。
- 保持认证卡片组件的复用性，避免把共享字段文案直接写死成单一语言。

### 主要改动

- `apps/web/src/components/auth/auth-card.tsx`
  - 为邮箱/密码字段标题与占位文案新增可选 props：
    - `emailLabel`
    - `emailPlaceholder`
    - `passwordLabel`
    - `passwordPlaceholder`
  - 默认值保持原有行为，不影响其他调用方。
- `apps/web/src/app/login/login-form.tsx`
  - 登录页标题改为 `登录`
  - 描述改为 `使用邮箱和密码登录面试通`
  - 提交按钮改为 `登录`
  - 字段文案改为 `邮箱 / 密码`
  - 占位文案改为 `请输入邮箱地址 / 请输入密码`
  - 底部跳转文案改为 `还没有账号？立即注册`
- `apps/web/src/app/register/page.tsx`
  - 注册页标题改为 `注册`
  - 描述改为 `使用邮箱和密码创建面试通账号`
  - 提交按钮改为 `注册`
  - 字段文案改为 `邮箱 / 密码`
  - 占位文案改为 `请输入邮箱地址 / 请设置登录密码`
  - 底部跳转文案改为 `已经有账号？立即登录`
- `.prettierignore`、`.gitignore`
  - 新增 `.playwright-mcp` 忽略规则，避免手动 Playwright 验证产生的临时产物污染校验与工作区状态

### 迁移/破坏性变更

- 无数据库 migration。
- 无接口协议变更。

### 验证

- 已执行：
  - `pnpm verify`
  - Playwright 手动验证：打开 `http://127.0.0.1:3000/login`，确认页面显示 `登录 / 使用邮箱和密码登录面试通 / 邮箱 / 密码 / 立即注册`

## Iteration 5.47（2026-03-31）：增强知识检索 Trace 回填的时间窗口与报告能力

### 目标

- 让知识检索 trace 回填脚本更适合大库或线上分批迁移，不必每次都扫完整历史。
- 让 dry-run 与正式执行都能产出结构化结果，便于评估影响面和留存迁移记录。

### 主要改动

- `packages/db/scripts/backfill-knowledge-trace-records.mjs`
  - 新增 `--created-after=<ISO>` 与 `--created-before=<ISO>`，按 trace 自身的 `createdAt` 做窗口过滤。
  - 新增 `--report-json=<path>`，会输出结构化 JSON 报告。
  - summary 当前新增 `filteredOutByCreatedAt`，明确显示被时间窗口排除的 trace 数量。
- `packages/db/src/knowledge-trace-backfill.test.ts`
  - 补充时间窗口过滤和结构化报告生成的测试。

### 迁移/破坏性变更

- 无数据库 migration。
- 当前时间窗口过滤针对的是 runtime trace 自身的 `createdAt`，不是 `ChatSessionRecord.updatedAt`；这样语义更准确，但大窗口场景仍需要扫描会话 runtime。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/db/src/knowledge-trace-backfill.test.ts`
  - `pnpm trace:knowledge:backfill -- --dry-run --created-after=2026-03-01T00:00:00.000Z --report-json=/tmp/knowledge-trace-backfill-report.json`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 5.46（2026-03-31）：补齐知识检索 Trace 历史回填脚本

### 目标

- 把已经留存在 `ChatSession.runtime.knowledgeRetrievalTrace` 里的历史检索记录补回新表，避免 Admin 概览页切流后看不到旧会话中的有效样本。
- 保证回填脚本可重复执行且幂等，不会因为二次运行把同一批历史 trace 写出重复数据。

### 主要改动

- `packages/db/scripts/backfill-knowledge-trace-records.mjs`
  - 新增知识检索 trace 历史回填脚本。
  - 会按批次扫描 `ChatSessionRecord.runtime.knowledgeRetrievalTrace`，将缺失的新表记录补写到 `KnowledgeRetrievalTraceRecord / KnowledgeRetrievalTraceResultRecord`。
  - 脚本支持：
    - `--dry-run`
    - `--batch-size=<n>`
    - `--limit-sessions=<n>`
    - `--session-id=<id>`
  - 幂等策略使用稳定去重键：
    - `sessionId + triggerKind + createdAt + intentKind + mode + queryHash + queryPreview`
- `packages/db/src/knowledge-trace-backfill.test.ts`
  - 新增最小单测，覆盖历史 `queryHash` 回填、runtime 提取、去重键稳定性与参数解析。
- `packages/db/package.json`
  - 新增 `pnpm -C packages/db run trace:backfill` 入口。
- `package.json`
  - 根脚本新增 `pnpm trace:knowledge:backfill`。

### 迁移/破坏性变更

- 无新增数据库 migration。
- 历史 runtime trace 的两个兼容边界需要明确：
  - 旧 runtime 没有 `triggerKind`，回填时统一按 `new_message` 落库
  - 旧 runtime 若缺失 `queryHash`，回填时会基于 `queryPreview` 生成近似 hash；若原始 query 当时已被截断，则聚合精度会低于新链路上的实时双写

### 验证

- 已执行：
  - `pnpm exec vitest run packages/db/src/knowledge-trace-backfill.test.ts`
  - `pnpm trace:knowledge:backfill -- --dry-run --limit-sessions=20`
  - `pnpm trace:knowledge:backfill`
  - `pnpm trace:knowledge:backfill -- --dry-run`

## Iteration 5.45（2026-03-31）：知识检索 Trace 独立事件表第一版

### 目标

- 把知识检索 trace 从 `ChatSession.runtime` 的临时观测形态，演进为可跨会话分析的独立事件表。
- 保持 Web 主链路低风险：先双写新表，`runtime` 暂时兼容保留，不做一次性切断。
- 收口 Admin E2E 的运行时隔离，避免复用旧 Prisma Client 进程导致假失败。

### 主要改动

- `packages/db/prisma/schema.prisma`
  - 新增 `KnowledgeRetrievalTraceRecord`、`KnowledgeRetrievalTraceResultRecord`。
  - 新增 `KnowledgeRetrievalIntentKind`、`KnowledgeRetrievalMode`、`KnowledgeRetrievalTriggerKind` 枚举。
  - 为 `AuthUser`、`UserActor`、`ChatSessionRecord` 补齐新 trace 表关联。
- `packages/db/prisma/migrations/20260331220000_add_knowledge_retrieval_trace_records/migration.sql`
  - 新增知识检索独立事件表与结果表迁移。
- `packages/db/src/index.ts`
  - 导出新增 Prisma model / enum 类型。
- `packages/shared/src/types/index.ts`
  - `KnowledgeRetrievalTraceEntry` 新增可选 `queryHash`，用于跨会话聚合同一 query。
- `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - 新增 query hash 构建逻辑。
  - 生成 trace 时写入 `queryHash`。
- `apps/web/src/lib/server/knowledge-trace-record-repository.ts`
  - 新增独立 trace 表写入仓库层。
  - 采用 best-effort 持久化，失败只记日志，不阻塞聊天主链路。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 新消息聊天链路接入 trace 双写。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - 编辑重生成链路接入 trace 双写。
- `apps/admin/src/app/knowledge-retrieval/page.tsx`
  - 知识检索概览页改为直接读取新 trace 表。
- `apps/admin/src/lib/knowledge-trace.ts`
  - 高频 query、回归候选改为按 `queryHash` 聚合，而不是 `queryPreview` 文案本身。
- `apps/admin/src/components/knowledge-trace-summary-cards.tsx`
  - 概览统计口径从“会话数”收口为“检索记录数”。
- `apps/admin/src/components/knowledge-trace-table-card.tsx`
  - 列表行主键改为独立 trace record id。
- `apps/admin/e2e/support/admin-e2e-fixtures.ts`
  - Admin E2E fixture 改为直接写入新 trace 表数据。
- `apps/admin/next.config.ts`
  - 支持通过 `NEXT_DIST_DIR` 指定独立构建目录。
- `playwright.config.ts`
  - Admin E2E 改为使用独立端口 `3101` 与独立 `distDir`。
  - 不再复用已有 Admin dev server，避免测试命中旧 Prisma Client 进程。

### 迁移/破坏性变更

- 需要执行数据库迁移：
  - `pnpm db:migrate:deploy`
- 需要重新生成 Prisma Client：
  - `pnpm db:generate`
- 历史 `ChatSession.runtime.knowledgeRetrievalTrace` 暂不回填到新表。
- Admin 概览页现阶段只分析新表中的 trace 记录；旧 runtime trace 继续仅作为兼容与会话内上下文保留。

### 验证

- 已执行：
  - `pnpm db:migrate:deploy`
  - `pnpm db:generate`
  - `PLAYWRIGHT_SCOPE=admin pnpm test:e2e:admin --grep '管理员可查看知识检索概览页中的 summary 与 trace 记录'`
  - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '命中文档知识时应把知识上下文注入到真实聊天链路|简历优化里夹带技术关键词时，真实聊天链路仍应命中 project resume 文档|面试流程问题应命中 interview playbook 文档'`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 5.43（2026-03-31）：为知识文档补 contentShape，并按文档形态决定上下文注入策略

## Iteration 5.44（2026-03-31）：收口知识检索 Trace 并发安全、编辑语义与检索热点

### 目标

- 修复知识检索 Trace 在并发请求下可能被旧 runtime 覆盖的问题，避免真实会话排查时出现静默丢记录。
- 收口“编辑最后一条用户消息”后的知识检索 Trace 语义，避免 Admin 继续展示已失效问题的旧检索记录。
- 先用低侵入方式优化知识文档检索热点，减少普通聊天每次全量查库并重新 tokenize 的开销。

### 主要改动

- 知识检索 Trace 合并逻辑下沉到共享/仓库层：
  - `packages/shared/src/utils/index.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/index.test.ts`
  - `apps/web/src/lib/server/chat-session-repository.ts`
  - 当前新增 `mergeKnowledgeRetrievalTraceEntries`
  - Web 会话写回时不再直接用请求起点的 `runtime` 全量覆盖，而是基于最新会话 runtime 合并 `knowledgeRetrievalTrace`
  - 这样在连续发送消息、编辑重生成等并发场景下，后到达请求不会把先到达请求刚写进去的 Trace 覆盖掉
- 编辑最后一条用户消息后的旧 Trace 语义已收口：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - 当前会在进入编辑截断前，先判断被编辑的原消息是否属于知识检索意图
  - 若属于知识检索意图，则先裁掉该轮旧 Trace，再基于编辑后的新内容重新生成并写入新的 Trace
  - 这样 Admin 会话详情里不会继续保留已失效问题的旧检索记录
- 知识文档检索已补短 TTL 进程内缓存：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - 当前会缓存已发布知识文档的可搜索 chunk 及其 tokens，避免普通聊天每次都重新从数据库拉取全部已发布 chunk 并逐条 tokenize
  - 现阶段采用 `15s` TTL，优先以最低侵入方式降低热点开销，同时把文档更新后的可见延迟控制在较短窗口内
- 补齐回归：
  - `apps/web/src/lib/server/knowledge-document-retriever.test.ts`
  - `packages/shared/src/index.test.ts`
  - 当前新增测试明确覆盖：
    - 并发场景下 Trace 合并不丢条目
    - 编辑知识检索消息时会移除该轮旧 Trace
    - 编辑非知识检索消息时不会误删已有 Trace

### 迁移/破坏性变更

- 无数据库 migration。
- 知识检索 Trace 的持久化语义有一处重要收口：
  - 编辑最后一条知识检索消息后，对应旧问题的最新 Trace 不再保留在会话当前 runtime 中
  - 当前会话详情更偏“展示当前有效会话链路”，而不是“保留所有已失效版本的历史检索快照”

### 验证

- `pnpm exec vitest run packages/shared/src/index.test.ts apps/web/src/lib/server/knowledge-document-retriever.test.ts packages/retrieval/src/knowledge-document-retrieval.test.ts apps/web/src/lib/server/knowledge-document-context.test.ts`
- `pnpm verify`

### 下一步

- 若后续需要更强的会话审计能力，可考虑把知识检索 Trace 从 runtime JSON 演进为独立事件流或单独分析表，而不是继续只靠会话当前快照。
- 若知识文档规模继续上涨，下一步应优先把当前短 TTL 内存缓存升级为更稳定的候选集裁剪或 hybrid/vector 召回，而不是继续扩大应用层全量排序范围。

### 目标

- 把“流程类文档按顺序展开”这件事从意图硬编码里抽出来，升级为知识文档自身的内容形态能力。
- 避免后续继续靠分类名称、`TopK` 或额外意图分支去兜“流程文档后半段丢失”的问题。

### 主要改动

- 为知识文档新增 `contentShape`：
  - `packages/db/prisma/schema.prisma`
  - `packages/db/prisma/migrations/20260331103000_add_knowledge_document_content_shape/migration.sql`
  - 当前支持：
    - `reference`
    - `process`
    - `checklist`
    - `template`
  - 默认值为 `reference`，现有数据迁移后不会丢失
- Admin 文档管理页已支持编辑和展示内容形态：
  - `apps/admin/src/components/knowledge-document-options.ts`
  - `apps/admin/src/components/knowledge-document-editor-form.tsx`
  - `apps/admin/src/components/knowledge-document-create-view.tsx`
  - `apps/admin/src/components/knowledge-document-edit-view.tsx`
  - `apps/admin/src/components/knowledge-documents-table-card.tsx`
  - `apps/admin/src/app/documents/page.tsx`
  - `apps/admin/src/app/documents/[id]/edit/page.tsx`
  - `apps/admin/src/lib/knowledge-document-validation.ts`
  - 现在后台可以直接把“面试流程 / 阶段说明”这类文档标成“流程型内容”
- Retrieval 数据结构补齐 `contentShape` 透传：
  - `packages/retrieval/src/knowledge-document-retrieval.ts`
  - `packages/retrieval/src/index.ts`
  - `apps/admin/src/lib/knowledge-document-chunks.ts`
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - `packages/evals/src/knowledge-rag-evals.ts`
  - Web / Admin / Evals 现在都能拿到统一的文档形态元数据
- Web 检索策略从“按意图名判断流程展开”切到“按命中文档形态判断”：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - `apps/web/src/lib/server/knowledge-document-context.ts`
  - 当前规则收口为：
    - Top1 命中文档若为 `process`，则先选文档，再按原始 `chunkOrder` 顺序展开
    - 非 `process` 仍保持普通 TopK chunk 注入
  - 这意味着后续是否需要顺序展开，不再由 `interview_playbook` 这个意图名直接决定
- 补齐回归：
  - `packages/retrieval/src/knowledge-document-retrieval.test.ts`
  - `apps/web/src/lib/server/knowledge-document-retriever.test.ts`
  - `apps/web/src/lib/server/knowledge-document-context.test.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - 单测现在已经明确覆盖：
    - `process` 文档会按原顺序展开
    - 非 `process` 文档仍走普通 TopK

### 迁移/破坏性变更

- 新增数据库 enum 与字段：
  - `KnowledgeDocumentContentShape`
  - `KnowledgeDocument.contentShape`
- 本地已应用迁移 `20260331103000_add_knowledge_document_content_shape`
- 现有文档默认会被视为 `reference`；若希望享受顺序展开效果，需要在 Admin 中把对应文档改成 `process`

### 验证

- `pnpm exec vitest run packages/retrieval/src/knowledge-document-retrieval.test.ts apps/web/src/lib/server/knowledge-document-retriever.test.ts apps/web/src/lib/server/knowledge-document-context.test.ts packages/evals/src/knowledge-rag-evals.test.ts`
- `pnpm typecheck`
- `pnpm verify`
- Playwright 手动真页验证：
  - Admin：
    - 登录后台
    - 新建文档，选择“分类=面试打法、内容形态=流程型内容”
    - 保存后在列表页确认“形态=流程型内容”
    - 进入编辑页确认“内容形态”会正确回填
  - Web：
    - 在 mock Web 服务中发送“前端面试流程一般是怎么样的？”
    - 再到 Admin 的“知识检索”页确认最新 Trace 为“强命中”，Top1 文档为 `Playwright 面试流程手册`

### 下一步

- 可以逐步把现有“流程/步骤/阶段”类知识文档回填为 `contentShape=process`，尤其是：
  - 面试流程
  - HR 面
  - offer 阶段
  - 面试准备步骤
- `checklist` / `template` 目前先只做数据层标注；后续若要进一步差异化注入策略，再基于真实 trace 决定是否值得继续演进。

## Iteration 5.42（2026-03-31）：把面试流程类知识检索升级为“先选文档，再按顺序展开”

### 目标

- 彻底收口“面试流程文档明明写了三面，但回答里只剩两面”这类问题，不再靠反复调 `TopK` 撑命中完整度。
- 把 `interview_playbook` 这类流程型知识，从“chunk 抢排名”升级为更接近业内常见 parent-document / small-to-big 的注入方式。

### 主要改动

- 调整 `interview_playbook` 的知识注入策略：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - 检索阶段仍保留 chunk 级打分，方便判断哪个文档最相关
  - 但注入阶段不再直接取 TopK chunk，而是：
    - 先按 chunk 结果聚合出最相关文档
    - 再按该文档原始 `chunkOrder` 顺序展开
    - 在固定上下文预算内持续注入，避免流程后半段因为排名靠后被截掉
- 明确区分“trace 排序结果”和“实际注入上下文”：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - Admin / trace 仍保留真实检索排序，方便定位为什么命中这篇文档
  - 真正给模型的上下文则按文档顺序展开，避免流程信息残缺
- 补强流程型知识的 prompt 约束：
  - `apps/web/src/lib/server/chat-general-policy-instruction.ts`
  - 当前已明确要求：如果知识背景里已经给出 `一面 / 二面 / 三面 / HR 面 / offer` 这样的阶段顺序，不要自行删减或合并轮次
- 补强流程型上下文的 system 提示：
  - `apps/web/src/lib/server/knowledge-document-context.ts`
  - 当注入的是同一篇 `interview_playbook` 文档的多段内容时，会额外提示“这些流程型知识已按原始文档顺序整理”
- 补齐回归：
  - `apps/web/src/lib/server/knowledge-document-retriever.test.ts`
  - `apps/web/src/lib/server/knowledge-document-context.test.ts`
  - `apps/web/e2e/chat-smoke.spec.ts`
  - 新增单测直接验证：`interview_playbook` 命中文档后，注入结果应按原始顺序保留 `投递简历 -> 一面 -> 二面 -> 三面`
  - Web Playwright 回归当前也已兼容“真实最优文档可能优先于测试 fixture 文档”的场景，避免假失败

### 迁移/破坏性变更

- 无数据库 schema 变更。
- `interview_playbook` 的上下文拼装语义发生变化：现在更偏“文档级顺序展开”，而不是“纯 TopK chunk 注入”。

### 验证

- `pnpm exec vitest run apps/web/src/lib/server/knowledge-document-retriever.test.ts apps/web/src/lib/server/knowledge-document-context.test.ts apps/web/src/lib/server/chat-general-policy.test.ts`
- `DATABASE_URL="${DATABASE_URL:-postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public}" PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '面试流程问题应命中 interview playbook 文档'`
- `pnpm verify`

### 下一步

- 若后续继续沉淀 `HR 面 / offer / 面试准备 checklist` 这类内容，可考虑给知识文档再补一层“内容形态”字段，例如 `reference / process / checklist / template`，让不同文档形态走不同注入策略，而不是继续靠分类推断。

## Iteration 5.41（2026-03-30）：为“面试流程/面试打法”问题补独立知识检索意图

### 目标

- 解决“面试流程是怎么样的”“前端面试流程一般怎么走”这类问题明明有知识文档，但普通聊天完全不触发检索的问题。
- 不把这类问题硬塞进 `technical_question`，而是补一条更清晰、可扩展的 `interview_playbook` 意图链路。

### 主要改动

- 新增普通聊天意图：
  - `apps/web/src/lib/server/chat-general-policy.types.ts`
  - `apps/web/src/lib/server/chat-general-policy.constants.ts`
  - `apps/web/src/lib/server/chat-general-policy-intent.ts`
  - 当前新增 `interview_playbook`，专门覆盖：
    - `面试流程`
    - `一面 / 二面 / 三面`
    - `HR 面`
    - `offer`
    - `面试准备 / 面试打法`
- 为新意图补齐 prompt 约束、few-shot 和 fallback：
  - `apps/web/src/lib/server/chat-general-policy-instruction.ts`
  - `apps/web/src/lib/server/chat-general-policy-examples.ts`
  - `apps/web/src/lib/server/chat-general-policy-fallback.ts`
  - 目标不是让它退化成泛泛百科，而是明确按“技术一面 / 技术二面 / HR 面 / offer”这样的前端面试语境来组织回答
- 把知识检索链路接上新意图：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - `interview_playbook` 当前只检索 `interview_playbook` 分类，避免把“面试流程”误打到 `project_resume` 或 `tech_knowledge`
  - 新意图的检索偏好标签会默认补 `面试`
- 扩展共享 trace 契约和 Admin 展示：
  - `packages/shared/src/types/index.ts`
  - `packages/shared/src/utils/index.ts`
  - `packages/shared/src/index.test.ts`
  - `apps/admin/src/lib/knowledge-trace.ts`
  - `apps/admin/src/lib/knowledge-trace.test.ts`
  - `apps/admin/src/components/session-knowledge-trace-card.tsx`
  - `apps/admin/src/components/knowledge-trace-filter.tsx`
  - `apps/admin/src/components/knowledge-trace-table-card.tsx`
  - `apps/admin/src/components/knowledge-trace-candidate-card.tsx`
  - 现在后台 trace 会把这类记录显示为“面试打法”，不会再落成未知类型或错误标签
- 补齐回归：
  - `apps/web/src/lib/server/chat-general-policy.test.ts`
  - `apps/web/src/lib/server/knowledge-document-retriever.test.ts`
  - `apps/web/e2e/support/chat-e2e-fixtures.ts`
  - `apps/web/e2e/chat-smoke.spec.ts`
  - 新增 Web Playwright 真页回归：发送“前端面试流程一般是怎么样的？”时，真实聊天链路应命中 `interview_playbook` 文档

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 对知识文档的使用口径有一个重要收口：
  - “面试流程 / 面试打法 / HR 面 / offer”类文档应归到 `interview_playbook`
  - 不应继续放在 `project_resume`

### 验证

- `pnpm exec vitest run apps/web/src/lib/server/chat-general-policy.test.ts apps/web/src/lib/server/knowledge-document-retriever.test.ts packages/shared/src/index.test.ts apps/admin/src/lib/knowledge-trace.test.ts`
- `DATABASE_URL="${DATABASE_URL:-postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public}" PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '面试流程问题应命中 interview playbook 文档|简历优化里夹带技术关键词时，真实聊天链路仍应命中 project resume 文档|命中文档知识时应把知识上下文注入到真实聊天链路'`
- `pnpm verify`

### 下一步

- 若后续继续补“HR 面会聊什么”“offer 阶段怎么谈”“一面二面有什么区别”，优先继续复用 `interview_playbook` 意图，而不是再往 `technical_question` 里塞规则。

## Iteration 5.40（2026-03-30）：为知识库增强补齐会话级检索 Trace 与后台可观测性

### 目标

- 在现有“知识命中 -> prompt 注入”的 MVP 基线上，补一层真实会话可观测性，方便判断线上每次普通聊天到底检索了什么、命中强弱如何、最终拿了哪些 chunk。
- 先用最低风险的方案把数据留住并看得见，而不是立即引入新的分析表或埋点系统。

### 主要改动

- 扩展共享会话 runtime 契约：
  - `packages/shared/src/types/index.ts`
  - 新增 `KnowledgeRetrievalTraceEntry / KnowledgeRetrievalTraceResult`
  - `InterviewRuntimeState` 新增 `knowledgeRetrievalTrace`
- 补齐 runtime 兼容与默认值：
  - `apps/web/src/lib/server/chat-session-model.ts`
  - `apps/web/src/lib/server/chat-session-ui-state.ts`
  - `apps/admin/src/lib/chat-session-runtime.ts`
  - `packages/interview-engine/src/session-core.ts`
  - `apps/web/src/app/chat/lib/chat-session-draft.ts`
  - 若旧 runtime 缺少该字段，会自动回落为空数组，不影响历史会话读取
- 在知识检索层生成可持久化 trace：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - 当前会记录：
    - `createdAt`
    - `intentKind`
    - `mode`
    - `categories`
    - `preferredTags`
    - `queryPreview`
    - TopK `results`
  - 即使最终是 `none`，只要本次存在检索计划，也会留下 trace，便于观察“为什么没命中”
  - trace 数量当前按会话保留最近 `12` 条，避免 runtime JSON 无限制膨胀
- 普通聊天与消息编辑链路现在会把检索 trace 一起持久化到会话 runtime：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - `apps/web/src/lib/server/chat-session-repository.ts`
  - 不新增 Prisma 表，也不做 migration；仍复用 `ChatSessionRecord.runtime` JSON
- Admin 会话详情新增“知识检索 Trace”卡片：
  - `apps/admin/src/components/session-knowledge-trace-card.tsx`
  - `apps/admin/src/components/session-detail-view.tsx`
  - `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - 当前可直接查看每次检索的意图、命中模式、Query 摘要、分类标签，以及命中的文档标题 / 路径 / score
- Admin 端当前又继续补了一层“跨会话聚合视角”：
  - `apps/admin/src/app/knowledge-retrieval/page.tsx`
  - `apps/admin/src/components/knowledge-trace-filter.tsx`
  - `apps/admin/src/components/knowledge-trace-summary-cards.tsx`
  - `apps/admin/src/components/knowledge-trace-table-card.tsx`
  - 现在管理员不需要逐个点开会话，已经可以直接看最近一段时间内的知识检索 summary、Top Query、Top 文档，以及最近 trace 列表并跳转到对应会话
- 新增离线分析脚本：
  - `scripts/report-knowledge-trace.mjs`
  - `package.json`
  - 现在可以直接运行 `pnpm trace:knowledge:report -- --days 30 --max-sessions 20` 之类的命令，快速看 `strong / weak / none` 分布和高频 query / 文档
- 为了把“真实 trace -> eval”这一步也补齐，当前又继续加了一层回归候选能力：
  - `apps/admin/src/lib/knowledge-trace.ts`
  - `apps/admin/src/components/knowledge-trace-candidate-card.tsx`
  - `scripts/report-knowledge-trace.mjs`
  - Admin 概览页现在会额外给出“高优先级回归候选”，优先列出 `none / weak` 的 query，方便人工挑选并回灌到 eval
  - 命令行脚本现在也支持 `--fixture-suggestions`，会直接打印可复制的 `KnowledgeRetrievalEvalCase` 草稿
- 补齐回归：
  - `apps/web/src/lib/server/knowledge-document-retriever.test.ts`
  - `apps/admin/src/lib/knowledge-trace.test.ts`
  - `apps/admin/e2e/support/admin-e2e-fixtures.ts`
  - `apps/admin/e2e/session-detail-trace.spec.ts`
  - `apps/admin/e2e/knowledge-retrieval.spec.ts`
  - 现在不仅有 Web 侧知识链路回归，也有 Admin 详情页和知识检索概览页的真页回归

### 迁移/破坏性变更

- 无数据库 schema 变更。
- `ChatSession.runtime` JSON 新增 `knowledgeRetrievalTrace` 字段；旧会话按兼容默认值读取。

### 验证

- `pnpm exec vitest run apps/web/src/lib/server/knowledge-document-retriever.test.ts apps/web/src/lib/server/chat-general-policy.test.ts`
- `pnpm exec vitest run apps/admin/src/lib/knowledge-trace.test.ts apps/web/src/lib/server/knowledge-document-retriever.test.ts`
- `DATABASE_URL="${DATABASE_URL:-postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public}" pnpm trace:knowledge:report -- --days 30 --max-sessions 20 --candidate-limit 5 --fixture-suggestions`
- `DATABASE_URL="${DATABASE_URL:-postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public}" PLAYWRIGHT_SCOPE=admin pnpm test:e2e:admin --grep '管理员可查看知识检索概览页中的 summary 与 trace 记录|管理员可查看会话详情中的规划、执行、报告与知识检索 Trace'`
- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '简历优化里夹带技术关键词时，真实聊天链路仍应命中 project resume 文档'`
- `pnpm verify`

### 下一步

- 若后续想继续提高知识库质量，优先基于这些真实 trace 看“哪些 query 长期落在 weak/none”，再决定是否值得切 hybrid / vector，而不是盲目继续扩样例。

## Iteration 5.39（2026-03-30）：修复“简历优化 + 技术关键词”被误判为技术问答的问题

### 目标

- 解决真实聊天链路里一个更高价值的产品问题：当用户在“改简历/改写项目经历”的诉求里夹带技术关键词时，不应被错误路由到技术问答检索。
- 把这类混合输入的意图收口和知识命中补成浏览器级回归，而不只停留在离线 fixture。

### 主要改动

- 收口简历优化意图识别规则：
  - `apps/web/src/lib/server/chat-general-policy.constants.ts`
  - `RESUME_REQUEST_PATTERN` 现在额外覆盖更自然的写作诉求表达，例如 `怎么写 / 怎么改 / 如何写 / 如何改 / 改`
  - 目标是识别“我在改简历，这段项目经历怎么改写得更有亮点”这类真实输入，而不是只识别“优化简历”模板句
- 补齐对应单测：
  - `apps/web/src/lib/server/chat-general-policy.test.ts`
  - 新增“简历修改诉求里即使夹带技术关键词，也应优先识别为简历优化”
- 把知识检索计划抽成纯函数并补混合意图测试：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - `apps/web/src/lib/server/knowledge-document-retriever.test.ts`
  - 现在可以直接验证：
    - 自我介绍 + 项目亮点混杂输入，会优先走 `self_intro`
    - 简历优化 + 技术关键词混杂输入，会优先走 `resume_optimize`
- 在补 Web E2E 的过程中，还顺手抓出并修掉了一个真实服务端回归：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - 抽 helper 后 `resolveKnowledgeDocumentContext()` 里遗漏了一处 `categories` 变量替换，真实聊天链路会直接抛 `ReferenceError`
  - 该问题已修复，并通过新增 E2E 真实验证
- 新增 Web Playwright 回归：
  - `apps/web/e2e/support/chat-e2e-fixtures.ts`
  - `apps/web/e2e/chat-smoke.spec.ts`
  - 新增 `project_resume` 知识文档 fixture，并验证“改简历 + React 性能优化经历”这类消息会命中 `E2E 项目亮点提炼模板`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- Web 端普通聊天的意图识别边界有小幅调整：部分原本会落到 `technical_question` 的“简历修改 + 技术关键词”消息，现在会正确走 `resume_optimize` 链路。

### 验证

- `pnpm exec vitest run apps/web/src/lib/server/chat-general-policy.test.ts apps/web/src/lib/server/knowledge-document-retriever.test.ts`
- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '简历优化里夹带技术关键词时，真实聊天链路仍应命中 project resume 文档'`
- `pnpm verify`

### 下一步

- 后续若继续完善混合输入处理，优先再补“自我介绍 + 项目亮点 + 简历修改顾虑”三者混杂的输入，而不是继续细抠单意图样例。

## Iteration 5.38（2026-03-30）：补长输入与噪声样例，逼近真实用户提问分布

### 目标

- 让知识库离线评测不只依赖短问句，而是开始覆盖多句口语描述、带背景信息和个人顾虑的真实用户输入。
- 检查当前轻量检索在较长输入下是否仍能守住正确文档和合理的强弱命中级别。

### 主要改动

- 继续扩展知识库检索评测样例：
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - 新增长技术问法：围绕 `React 性能优化`，带“容易讲散”“担心说成过度结论”等噪声信息
  - 新增长简历优化问法：围绕“项目经历写成流水账、看不出业务价值”的真实困扰
  - 新增长自我介绍问法：带“目标岗位更高级、怕讲成流水账”的背景信息
- 继续扩展知识库回答评测样例：
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - 新增对应的长输入回答样例，要求回答仍能收口到知识库中的结构化核心点，而不是被噪声带偏
- 顺手收口了一条回答评测中的禁用短语：
  - 避免简单的 substring 匹配把“不要讲成某个错误结论”误判成真的错误结论

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无线上运行时变更；这是一次离线评测样例扩充。

### 验证

- `pnpm evals:knowledge:rag`
- `pnpm verify`

### 下一步

- 后续若要继续提升评测质量，优先补“多意图混杂”的真实用户输入，例如同一条消息里同时提到“自我介绍 + 项目亮点 + 简历修改顾虑”，观察当前意图路由与知识检索会如何收口。

## Iteration 5.37（2026-03-30）：补灰区检索样例，固定当前词法检索的真实边界

### 目标

- 不只验证“明显该命中的问题”和“完全无关的问题”，还要把“语义相关但词法不够直接”的灰区样例固化下来。
- 为后续 hybrid / vector 检索升级预留同一批对照样例，避免将来只凭主观感觉判断召回是否变好。

### 主要改动

- 继续扩展知识库检索评测样例：
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - 新增两条当前应稳定落在 `weak` 的灰区样例：
    - 项目表述类：`简历里怎么把自己做过的事写得不那么像记流水账`
    - 面试开场类：`面试开头怎么说会更顺一点`
- 这两条样例刻意避免直接复用文档里的标题词和主句式，只保留最少量的意图标签信号，用来描述当前轻量词法检索的真实边界，而不是为现有实现“量身定制”命中词。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无线上运行时变更；这是一次离线评测边界样例补齐。

### 验证

- `pnpm evals:knowledge:rag`
- `pnpm verify`

### 下一步

- 若后续升级为 hybrid / vector 检索，应优先观察这两类灰区样例是否从 `weak` 提升为更稳定的 `strong`，以及是否仍保持正确文档排序，而不是只看强命中样例。

## Iteration 5.36（2026-03-30）：继续扩充知识库评测，覆盖简历优化与意译问法

### 目标

- 让知识库离线评测更贴近真实用户输入，不只覆盖“标准标题式问法”，还覆盖简历优化与开场式意译问法。
- 继续提高对当前轻量检索策略的回归约束，尤其是“意图补充标签是否真的帮助召回”这一点。

### 主要改动

- 继续扩展知识库检索评测样例：
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - 新增 `resume_optimize` 场景，验证“简历里的项目经历怎么写”会优先命中 `项目亮点提炼模板`
  - 新增“前端面试开场 1 分钟，怎么把自己讲清楚”这类自我介绍意译问法，验证在意图补充 `面试 / 自我介绍` 标签后仍能稳定命中 `前端自我介绍面试打法`
- 继续扩展知识库回答评测样例：
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - 新增“简历项目经历怎么写更有说服力”的回答评测，要求覆盖 `背景 / 目标 / 动作 / 结果 / 量化 / 业务价值`
  - 新增“面试开场 1 分钟怎么讲清楚自己”的回答评测，要求仍能收口到三段式结构，而不是退化成通用套话

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无线上运行时变更；这是一次离线评测样例扩充。

### 验证

- `pnpm evals:knowledge:rag`
- `pnpm verify`

### 下一步

- 后续应优先补：
  - 更长、更口语化的真实用户问法
  - “知识库里有但当前词法容易漏召回”的灰区样例
  - 后续 hybrid/vector 检索升级前后的 A/B 对照样例

## Iteration 5.35（2026-03-30）：扩充知识库高价值评测样例，覆盖项目亮点与 weak 边界

### 目标

- 把知识库离线评测从“只有技术问答和自我介绍”扩展到更接近真实使用的高价值场景。
- 补齐 `project_resume` 场景和 `weak` 边界样例，避免后续只会验证强命中和完全不命中。

### 主要改动

- 扩展知识库检索评测样例：
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - 新增 `project_highlight` 场景，验证项目亮点类问法会优先命中 `项目亮点提炼模板`
  - 新增一条更模糊、口语化的表达类问题，验证在只有部分标签和词法重叠时，当前检索会稳定判为 `weak`
- 扩展知识库回答评测样例：
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - 新增项目亮点回答样例，要求回答覆盖“背景 / 动作 / 结果 / 业务价值”，并优于无知识基线
- 继续维持当前样例设计原则：
  - 问法尽量贴近真实用户输入
  - 不把 fixture 写成只对单一关键词模板生效的“测试句”

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无线上运行时变更；这是一次评测覆盖面扩充。

### 验证

- `pnpm evals:knowledge:rag`
- `pnpm verify`

### 下一步

- 后续应继续补：
  - `resume_optimize` 场景
  - 同义表达 / 意译问法
  - “知识库里有，但词法容易漏召回”的灰区样例

## Iteration 5.34（2026-03-30）：统一知识命中模式判定并补单独评测入口

### 目标

- 避免知识库评测和 Web 生产链路各自维护一套 `strong / weak / none` 判定规则，导致后续阈值漂移。
- 给知识库离线评测补一个固定脚本入口，方便后续单独回归，不再手写文件路径。

### 主要改动

- 把知识命中模式判定抽到检索层统一管理：
  - `packages/retrieval/src/knowledge-document-retrieval.ts`
  - `packages/retrieval/src/index.ts`
  - 新增 `resolveKnowledgeDocumentHitMode(results)`，由检索层统一输出 `strong / weak / none`
- Web 生产链路改为复用统一判定 helper：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - 不再在 Web 侧内联维护阈值和条件判断
- 扩展知识库评测覆盖面：
  - `packages/retrieval/src/knowledge-document-retrieval.test.ts`
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - `packages/evals/src/knowledge-rag-evals.ts`
  - 新增 `expectedMode` 校验，并补一条“无关问题应返回 none”的离线样例
- 新增根脚本：
  - `package.json`
  - `pnpm evals:knowledge:rag`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无线上行为变更；这是一次规则收口与评测入口补齐。

### 验证

- `pnpm exec vitest run packages/retrieval/src/knowledge-document-retrieval.test.ts`
- `pnpm exec vitest run packages/evals/src/knowledge-rag-evals.test.ts`
- `pnpm verify`

### 下一步

- 后续若切到 hybrid / vector 检索，应继续复用这套 `expectedMode + TopK + 覆盖增益` fixture，对比新旧检索策略的真实收益，而不是只看主观回答观感。

## Iteration 5.33（2026-03-30）：补齐知识库检索与回答关联度的离线评测骨架

### 目标

- 为知识文档增强补一组可进 CI 的离线评测基线，不再只靠 Web E2E 验证“链路通了”。
- 把“问题是否命中正确知识”“回答是否真正吸收知识并优于无知识基线”拆成可持续扩展的 fixture + eval runner。

### 主要改动

- 新增知识库评测 fixtures 与执行器：
  - `packages/evals/src/knowledge-rag-fixtures.ts`
  - `packages/evals/src/knowledge-rag-evals.ts`
  - `packages/evals/src/knowledge-rag-evals.test.ts`
  - 当前第一版采用“分层但低成本”的离线方案：
    - 检索评测：验证 Top1 文档、TopK 命中、分数阈值与排除项
    - 回答评测：验证回答覆盖关键事实、避免禁用结论，并支持和无知识基线做 A/B 覆盖增益比较
- 补齐 `packages/evals` 的 workspace 依赖与导出：
  - `packages/evals/package.json`
  - `packages/evals/src/index.ts`
  - 允许 `evals` 直接复用 `@mianshitong/retrieval` 的知识文档分块与检索逻辑
- 第一版样例当前覆盖两类高频场景：
  - 技术问答：`React 性能优化`
  - 面试话术：`前端自我介绍`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无线上运行时变更；这是一次离线评测能力补齐。

### 验证

- `pnpm exec vitest run packages/evals/src/knowledge-rag-evals.test.ts`

### 下一步

- 后续可继续把当前 `answer` 评测从“规则短语覆盖”升级为“规则基线 + LLM judge”双层方案，但应保留现有确定性基线，避免 CI 受模型波动影响。
- 若知识库后续升级到 `pgvector + embeddings` 或 hybrid RAG，这组 fixtures 应继续复用，用于对比检索与回答增益是否真的提升。

## Iteration 5.32（2026-03-30）：补齐 Playwright 自测命令模板

### 目标

- 把“需要做 Playwright 自测”进一步落成可直接执行的命令模板，避免每次临时翻 `package.json` 或 `playwright.config.ts`。
- 降低后续交付前执行浏览器回归的心智成本，让这条流程真正可复用。

### 主要改动

- 扩展项目级协作约定：
  - `AGENTS.md`
  - 新增 `Playwright 自测命令模板` 小节
  - 固定收录以下常用命令：
    - `pnpm test:e2e:web`
    - `pnpm test:e2e:admin`
    - `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '<关键字>'`
    - `PLAYWRIGHT_SCOPE=admin pnpm test:e2e:admin --grep '<关键字>'`
    - `PLAYWRIGHT_SKIP_WEBSERVER=1 ...`
  - 同时补充默认选择原则：优先跑能精准覆盖本次改动面的 `--grep`，影响范围大时再跑对应端全量 E2E
- 同步更新项目上下文：
  - `docs/ProjectContext.md`
  - 记录 Playwright 自测命令模板已成为当前仓库的固定协作资产

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无运行时行为变更；这是一次协作模板补全。

### 验证

- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '命中文档知识时应把知识上下文注入到真实聊天链路'`
- `pnpm verify`

### 下一步

- 若后续 Web/Admin 的高频回归场景继续增加，可再把“推荐回归矩阵”沉淀成单独文档，而不是继续堆在协作约定里。

## Iteration 5.31（2026-03-30）：把 Playwright 自测收口进项目级协作约定

### 目标

- 把“代码改完后要做 Playwright 自测”从口头要求收口为项目级固定约束，避免后续只跑单测和静态检查就交付。
- 让前端交互、聊天链路、流式输出这类真实用户路径在每次迭代后都有最小浏览器验证。

### 主要改动

- 更新项目级协作约定：
  - `AGENTS.md`
  - 在“每次改动后的必做清单”里新增 Playwright 自测要求
  - 约定为：
    - 对任何影响 Web/Admin 交互、页面行为、聊天链路、流式输出或用户可见流程的改动，交付前默认还需要做至少一轮 Playwright 自测
    - 若仓库已有对应用例，优先直接运行
    - 若没有现成用例，至少做一轮手动 Playwright 浏览器验证，并在交付说明里写清验证路径
- 同步更新项目上下文：
  - `docs/ProjectContext.md`
  - 记录“`pnpm verify` + Playwright 自测”已成为当前项目的默认交付口径

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无运行时行为变更；这是一次项目协作流程收口。

### 验证

- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '命中文档知识时应把知识上下文注入到真实聊天链路'`
- `pnpm verify`

### 下一步

- 若后续某条功能经常需要手动 Playwright 才能验证，优先把它沉淀成正式 E2E，而不是长期依赖口头自测。

## Iteration 5.30（2026-03-30）：收口知识增强的产品口径，默认不自曝文档来源

### 目标

- 让知识文档增强继续作为“隐式能力”存在，而不是在用户主回复里频繁暴露“根据某文档/资料”的实现痕迹。
- 保持可解释性边界，但把默认产品感收口为“像资深面试官自然回答”，而不是“检索系统在复述内部资料”。

### 主要改动

- 收口知识文档注入 prompt 的角色表达：
  - `apps/web/src/lib/server/knowledge-document-context.ts`
  - 强命中时改为“以下是与当前问题高度相关的内部知识背景”
  - 弱命中时改为“以下是与当前问题可能相关的内部知识背景”
  - 明确新增约束：默认不要在正文里主动提到“根据某文档/资料/知识库”，也不要直接报出文档标题；只有用户明确追问依据时，才允许再说明来源
- 弱化注入块里的显式实现痕迹：
  - `apps/web/src/lib/server/knowledge-document-context.ts`
  - `参考资料` -> `知识背景`
  - `来源分类` -> `背景分类`
  - `文档标题` -> `知识主题`
  - `标题路径` -> `主题路径`
- 同步更新测试与 mock 兼容逻辑：
  - `apps/web/src/lib/server/knowledge-document-context.test.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - mock provider 继续支持从知识注入块里提取命中文档标题，但现在兼容 `知识主题` 和旧 `文档标题` 两种标签，避免影响现有 Web E2E

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；这是一次知识注入提示词与产品口径收口。

### 验证

- `pnpm exec vitest run 'apps/web/src/lib/server/knowledge-document-context.test.ts' 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`
- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '命中文档知识时应把知识上下文注入到真实聊天链路'`
- `pnpm verify`

### 下一步

- 若后续要增强可信度，优先做“可展开的来源卡片 / 查看依据”而不是把来源写进正文首段。
- 若用户主动问“这个结论依据是什么”，再考虑在回答链路里按需显式引用知识主题，而不是恢复默认自报来源。

## Iteration 5.29（2026-03-30）：为文档知识增强补齐 Web E2E 防回归

### 目标

- 把“知识文档检索命中后会增强聊天回复”这件事沉淀成稳定的浏览器级回归，而不是只靠手工验证。
- 避免这条链路后续改 prompt、改检索、改 mock provider 时静默失效。

### 主要改动

- 为 Web Playwright 测试环境补知识命中回显开关：
  - `playwright.config.ts`
  - Web E2E 启动命令新增 `MOCK_STREAM_ECHO_KNOWLEDGE=1`
  - 仅在测试环境打开，不影响真实模型链路
- 增强 mock stream provider 的测试可观测性：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - 当输入消息里存在知识文档 system context，且开启测试开关时，会从 `文档标题：...` 里提取命中文档标题，并在 mock 回复里附加 `知识命中：...`
- 补充对应单元测试：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - 新断言覆盖“开启测试开关后，mock provider 会回显知识命中的文档标题”
- 新增知识文档 E2E fixture 与浏览器回归：
  - `apps/web/e2e/support/chat-e2e-fixtures.ts`
  - `apps/web/e2e/chat-smoke.spec.ts`
  - 测试会直接种入一篇已发布 `tech_knowledge` 文档及其 chunks
  - 然后通过 Web 聊天真实 `/api/chat/sessions/*/messages/stream` 发起技术问题
  - 最终断言回复中同时包含用户问题和 `知识命中：E2E React 性能优化面试手册`
- 在这次 Playwright 实测里，还额外修掉了后台文档列表页的一个运行时稳态问题：
  - `apps/admin/src/app/documents/page.tsx`
  - `chunkCount` 读取改为 `document._count?.chunks ?? 0`
  - 避免 dev 进程挂着旧 Prisma Client 或运行时结果缺失时，`Documents` 页直接崩在 `.count`

### 迁移/破坏性变更

- 无新增数据库 schema 变更。
- 无线上行为变更；新增的知识命中回显仅在 Web E2E 的 mock 环境启用。

### 验证

- `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`
- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '命中文档知识时应把知识上下文注入到真实聊天链路'`
- `pnpm verify`

### 下一步

- 若后续想把后台文档管理也纳入自动回归，可继续补一条 Admin E2E，覆盖“新建/编辑文档后 chunk 数变化”。
- 若后续产品需要在 UI 上展示引用来源，可在当前 Web E2E 的基础上继续补“回答里显示引用块/来源卡片”的断言，而不是重写整条测试基建。

## Iteration 5.28（2026-03-30）：落地后台文档知识库与聊天定向检索增强

### 目标

- 用尽量轻量的实现方式，为面试通补一条“后台文档管理 -> 自动分块 -> 检索增强 -> 聊天回答”的领域知识增强链路。
- 在不引入重型知识中台、向量库和复杂审核流的前提下，让前端技术问答、项目亮点、简历优化、自我介绍等场景先获得更强的领域性。

### 主要改动

- 新增知识文档数据模型与迁移：
  - `packages/db/prisma/schema.prisma`
  - `packages/db/prisma/migrations/20260330103000_add_knowledge_documents/migration.sql`
  - `packages/db/src/index.ts`
  - 新增 `KnowledgeDocument / KnowledgeDocumentChunk`
  - 文档分类当前只保留 `tech_knowledge / interview_playbook / project_resume`
  - 文档使用 `isPublished` 控制是否参与线上检索，不引入复杂状态机
- 落地 Markdown 自动分块与轻量检索层：
  - `packages/retrieval/src/knowledge-document-retrieval.ts`
  - `packages/retrieval/src/knowledge-document-retrieval.test.ts`
  - `packages/retrieval/src/index.ts`
  - 保存文档时按 Markdown 标题切 section，保留 `headingPath`
  - chunk 切分时避免在 fenced code block 中间截断，超长内容再按句子和长度拆分
  - 检索先采用“词法召回 + heading 加权 + tag 加权”，为后续接 `pgvector` 预留边界
- 新增后台文档管理模块：
  - `apps/admin/src/app/documents/page.tsx`
  - `apps/admin/src/app/documents/new/page.tsx`
  - `apps/admin/src/app/documents/[id]/edit/page.tsx`
  - `apps/admin/src/app/api/knowledge-documents/items/route.ts`
  - `apps/admin/src/app/api/knowledge-documents/items/[id]/route.ts`
  - `apps/admin/src/components/knowledge-document-*.tsx`
  - `apps/admin/src/lib/knowledge-document-*.ts`
  - 支持文档列表、分类筛选、新建、编辑、发布开关与保存时自动重建 chunk
  - `apps/admin/src/components/admin-shell.tsx` 已补 `Documents` 导航入口
- 把知识检索接入普通聊天主链路：
  - `apps/web/src/lib/server/knowledge-document-retriever.ts`
  - `apps/web/src/lib/server/knowledge-document-context.ts`
  - `apps/web/src/lib/server/knowledge-document-context.test.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - 仅在命中特定意图时检索，不对所有聊天请求默认检索
  - 当前命中映射为：
    - `technical_question` -> `tech_knowledge + interview_playbook`
    - `project_highlight / resume_optimize` -> `project_resume + interview_playbook`
    - `self_intro` -> `interview_playbook + project_resume`
- 明确知识注入的三层策略：
  - 强命中：优先依据资料回答
  - 弱命中：资料仅作辅助背景，不强行引用
  - 未命中：不注入资料，直接回落到现有通用 prompt、意图策略与 few-shot

### 迁移/破坏性变更

- 需要执行新增 Prisma migration，数据库会新增 `KnowledgeDocument` 与 `KnowledgeDocumentChunk` 两张表。
- 当前第一版只支持 Markdown/纯文本资料录入；PDF、Word、审批、版本管理、引用展示 UI 暂不在 MVP 范围内。

### 验证

- `pnpm exec vitest run packages/retrieval/src/knowledge-document-retrieval.test.ts apps/web/src/lib/server/knowledge-document-context.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`
- `pnpm typecheck`
- `pnpm verify`

### 下一步

- 如果后台资料规模继续增大，优先升级检索层为 `pgvector + embeddings`，而不是先扩张复杂工作流。
- 若后续产品确认需要“回答时展示引用来源”，可在当前 `KnowledgeDocumentContext` 输出结构上继续补前端引用展示，而不需要重做检索主链。

## Iteration 5.26（2026-03-30）：收口用户消息手动复制时的额外空行

### 目标

- 修复 Web 聊天里用户手动框选消息文本再复制时，粘贴结果可能夹带多余空行的问题。
- 在不改变视觉样式和消息动作能力的前提下，减少浏览器把动作区一并纳入选区造成的纯文本换行噪音。

### 主要改动

- 收紧用户消息的文本选区边界：
  - `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 用户消息正文容器从段落标签收口为纯文本 `div`
  - 显式为正文添加 `select-text`，保留原有 `whitespace-pre-wrap` 换行语义
- 将消息动作区排除出文本选区：
  - `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 为动作区容器补 `select-none`，避免用户手动复制正文时把“编辑 / 复制”等按钮区域一起卷入选区，导致浏览器在转纯文本时插入多余空行
- 补充组件级回归测试：
  - `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
  - 新增断言覆盖“正文节点可选中、动作区不可选中”的结构约束

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；这是一次前端 DOM 结构和选择行为修正。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
- `pnpm verify`

### 下一步

- 若后续继续增强消息交互，可优先维持“正文可选中、附属动作不可选中”的边界，避免再次因为 UI 装饰节点进入复制选区而引入文本噪音。

## Iteration 5.27（2026-03-30）：提升普通技术问答的默认展开深度

### 目标

- 让 Web 端普通聊天里的技术问答默认回答得更充分，而不是只停留在“提纲式短答”。
- 保持闲聊和高频入口仍然轻量，不把所有场景都拉成长回复。

### 主要改动

- 放宽技术问答基础策略的长度约束：
  - `apps/web/src/lib/server/chat-general-policy.constants.ts`
  - 明确技术问答在用户未要求简短时，默认按“中等偏详细”深度回答
  - 结构重点从“结论、原理或差异、示例、常见误区或面试追问、总结”扩展到补充“适用场景”
- 提升技术问答专属 system prompt 的展开要求：
  - `apps/web/src/lib/server/chat-general-policy-instruction.ts`
  - 要求首段结论后补充核心原因
  - 要求主要小节尽量补“为什么 / 什么时候 / 边界条件 / 常见误用”
  - 示例从“一个最小短示例”放宽为“1 到 2 个最小示例或业务场景”
- 拉长技术问答 few-shot 和 fallback：
  - `apps/web/src/lib/server/chat-general-policy-examples.ts`
  - `apps/web/src/lib/server/chat-general-policy-fallback.ts`
  - 对 comparison / mechanism / concept 三类问题都补入“为什么重要、什么时候没必要用、边界条件、常见误区”等更完整信号，降低模型继续模仿短答模板的概率
- 同步补回归测试：
  - `apps/web/src/lib/server/chat-general-policy.test.ts`
  - 新断言覆盖“技术问答默认中等偏详细”“不要只给提纲式短答”和更完整的 comparison 示例

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；这是一次提示词策略与 few-shot 深度调整。

### 验证

- `pnpm exec vitest run apps/web/src/lib/server/chat-general-policy.test.ts`
- `pnpm verify`

### 下一步

- 若后续仍觉得技术问答偏短，下一步优先评估“扩大 technical_question 命中范围”，而不是继续无差别放大所有普通聊天场景的回复长度。

## Iteration 5.25（2026-03-30）：清理聊天编辑与 follow 触发的冗余逻辑

### 目标

- 在不改变当前产品行为的前提下，降低聊天编辑和自动 follow 相关代码的重复度与维护成本。
- 清理已经没有调用方的 controller API，并同步修正文档里的事实漂移。

### 主要改动

- 删除无调用的编辑 API：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - `apps/web/src/app/chat/hooks/chat-controller.types.ts`
  - 移除了没有实际调用方的 `editUserMessage` 暴露接口，避免 controller surface 持续膨胀
- 抽离共享编辑校验 helper：
  - `apps/web/src/app/chat/lib/chat-message-mutations.ts`
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - 新增 `getEditableUserMessage / getEditableUserMessageError`
  - 把“目标消息是否存在”和“是否仍是最后一条可编辑用户消息”的重复判断收口到共享 helper，避免 controller 与底层编辑 hook 各自维护一套分支
- 收口 follow 触发入口：
  - `apps/web/src/app/chat/ChatClient.tsx`
  - 把发送消息、快捷提问、编辑后重生成三处重复的 `setFollowRequestKey + scrollToBottom` 合并成统一 `requestFollow()`，减少后续继续扩散的复制逻辑
- 修正文档中的当前事实描述：
  - `docs/ProjectContext.md`
  - 把仍在描述“编辑局部错误态”的旧结论改为历史方案说明，避免与当前“确定即重生成”的实现冲突

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无运行时行为变更；这是一次纯粹的结构整理与文档收口。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts apps/web/src/app/chat/hooks/use-auto-scroll.dom.test.ts`
- `pnpm -C apps/web typecheck`
- `pnpm verify`

### 下一步

- 若后续继续演进聊天交互，可优先沿着共享 helper 和统一 follow 入口扩展，而不要再回到 controller / UI / hook 多处各自维护相同分支。

## Iteration 5.24（2026-03-30）：移除“恢复原回复”能力并清理废弃链路

### 目标

- 删除 Web 聊天里低频且增加心智负担的“恢复原回复”入口。
- 让编辑语义彻底收口为“点确定就按当前用户消息重新生成”，不再维护额外的回复回退版本。

### 主要改动

- 删除前端恢复入口与状态：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - `apps/web/src/app/chat/hooks/chat-controller.types.ts`
  - `apps/web/src/app/chat/ChatClient.tsx`
  - `apps/web/src/app/chat/components/chat-message-list.tsx`
  - `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 移除了 `restorableEditSnapshots / canRestoreOriginalReply / restoringOriginalReply / restoreOriginalReply`
  - assistant 中断消息现在仅保留“已停止生成”状态标识，不再展示“恢复原回复”按钮
- 删除无入口的恢复接口与请求 helper：
  - `apps/web/src/app/chat/lib/chat-api.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/restore/route.ts`
  - 同步清理 `apps/web/src/lib/server/chat-session-repository.ts` 中仅为该链路保留的废弃方法
- 更新测试与当前文档：
  - `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
  - `docs/ProjectContext.md`
  - `docs/IterationLog.md`
  - 补充“中断消息不再出现恢复原回复按钮”的断言，并把当前产品语义改为已移除该能力

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 前端交互上移除了“恢复原回复”入口；这是一次刻意的产品收口，不是回归。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/components/chat-message-item.dom.test.tsx apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts`
- `pnpm verify`

### 下一步

- 若后续真的出现“多版本回复回退”需求，应直接设计“消息版本 / 分支会话”能力，而不是重新加回单点快照恢复按钮。

## Iteration 5.23（2026-03-30）：将聊天编辑交互收口为“确定即重生成”

### 目标

- 把 Web 聊天的编辑交互从“前端校验并阻止提交”收口为更顺滑的“点击确定即重生成”。
- 对齐既定产品基线：即使用户输入空白字符，或根本没改内容直接点确定，也应该继续触发 AI 重新生成。

### 主要改动

- 调整编辑提交语义：
  - `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - 底层编辑链路不再因为空白内容或与原消息等价而直接返回
  - 当前规则改为：
    - 若编辑后内容 `trim()` 为空，沿用原消息内容发起重生成
    - 若编辑后内容与原消息 `trim()` 后等价，也沿用原消息内容发起重生成
    - 只有存在实质改动时，才提交新的编辑内容
- 清理前端局部错误态：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - `apps/web/src/app/chat/components/chat-message-list.tsx`
  - `apps/web/src/app/chat/components/chat-message-item.tsx`
  - `apps/web/src/app/chat/ChatClient.tsx`
  - 删除编辑态的 `editingError`、`invalid/no_change` 返回分支及就地错误展示
  - 编辑输入框的“确定”按钮现在只在真正发送中禁用，不再因为空白内容禁用
- 同步补齐回归测试：
  - `apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts`
  - `apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
  - `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
  - 新断言覆盖“空白编辑也会重生成”“等价编辑也会重生成”“编辑 UI 不再展示局部校验错误”

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；此次为前端交互策略与提交流程收口。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
- `pnpm -C apps/web typecheck`
- `pnpm verify`

### 下一步

- 若后续继续对齐竞品编辑体验，可在当前“确定即重生成”语义上继续评估是否补充“编辑中重新聚焦输入框”“滚动保留位置”等细节，而不要再回到多层拦截式校验。

## Iteration 5.22（2026-03-30）：修复首条消息流式阶段的自动滚动抢焦点问题

### 目标

- 修复 Web 聊天在“第一条消息发送后、assistant 正在流式回复时”用户上滑仍会被自动拉回底部的问题。
- 让聊天滚动策略与主流产品一致：只有当前仍贴底时才跟随流式输出，用户一旦主动离开底部就优先尊重用户滚动意图。

### 主要改动

- 重构自动滚动 hook：
  - `apps/web/src/app/chat/hooks/use-auto-scroll.ts`
  - 用户主动发送消息、触发快捷提问、编辑后重生成、恢复原回复时，会显式重新进入 follow，而不再只依赖一次即时滚底副作用
  - 自动滚动不再在发送开始时无条件重置为 pinned
  - assistant 流式输出期间只要检测到用户向上滚动，就会立即退出 follow 状态并取消所有待执行的补滚任务
  - 会话切换补滚继续保留，但不会再和“首条消息发送中的本地草稿会话”混用
  - 滚动监听从“运行时推断 window 或容器”收口为固定监听真实消息容器，避免首轮流式阶段监听目标漂移
- 编辑态错误提示收口为就地反馈：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 编辑内容为空时，不再走顶部全局 notice，而是在编辑输入框附近显示“编辑内容不能为空”
  - 用户继续输入或取消编辑时，会自动清掉这条局部错误
  - 编辑输入框现已补齐 `aria-invalid` 与 `aria-describedby`，并在错误态增加更明确的红色边框/浅红背景，便于视觉识别与辅助技术读取
- 补充自动滚动回归测试：
  - `apps/web/src/app/chat/hooks/use-auto-scroll.dom.test.ts`
  - 新增“首条消息流式生成时用户上滑后不会再被自动拉回底部”用例

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；这是一次前端交互策略修复。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/hooks/use-auto-scroll.dom.test.ts`
- `pnpm -C apps/web typecheck`
- `pnpm verify`

### 下一步

- 若后续继续增强聊天体验，可在当前 follow 状态基础上补“新消息提示 / 未读计数”，而不是再回到多处无条件强制滚底的实现。

## Iteration 5.21（2026-03-30）：让 CI 与本地统一使用 pnpm verify

### 目标

- 消除“本地执行的是一套检查，CI 跑的是另一套拆散命令”带来的认知偏差。
- 让根级 `pnpm verify` 成为本地和 CI 共用的默认验证入口。

### 主要改动

- 调整 CI 的 `test` job：
  - `.github/workflows/ci.yml`
  - 由原来的多条离散命令：
    - `pnpm db:generate`
    - `pnpm format:check`
    - `pnpm lint`
    - `pnpm typecheck`
    - `pnpm test`
    - `pnpm spellcheck`
  - 收口为单条：
    - `pnpm verify`
- 之所以可以收口，是因为：
  - `pnpm verify` 已串联 `format:check / lint / typecheck / test / spellcheck`
  - 其中 `pnpm typecheck` 自身已包含 `pnpm db:generate`

### 迁移/破坏性变更

- 无运行时行为变更。
- 无接口或数据库变更；仅统一 CI 与本地的验证入口。

### 验证

- `pnpm verify`
- 检查 `.github/workflows/ci.yml` 中 `test` job 已改为调用 `pnpm verify`

### 下一步

- 若后续继续扩展默认校验范围，应优先更新 `pnpm verify`，再让 CI 复用，而不是重新在 workflow 里拆散维护。

## Iteration 5.20（2026-03-30）：补齐 ESLint 对 Next 测试产物的忽略

### 目标

- 避免 `pnpm verify` 和日常 `pnpm lint` 被 `.next-playwright` 生成产物污染。
- 让统一验证入口在跑过 Playwright 后依然保持可用、可预期。

### 主要改动

- 调整 Next app 的 ESLint 忽略范围：
  - `apps/web/eslint.config.mjs`
  - `apps/admin/eslint.config.mjs`
  - 在原有 `.next/**`、`out/**`、`build/**` 之外，补充忽略 `.next-playwright/**`
- 这样 Playwright 使用自定义 `distDir` 生成的开发产物不会再被 ESLint 当成源码扫描

### 迁移/破坏性变更

- 无运行时行为变更。
- 无接口或数据库变更；仅收口 lint 的扫描边界。

### 验证

- `pnpm verify`

### 下一步

- 若后续还有其他工具生成的临时产物进入源码扫描范围，继续优先在工具配置层收口忽略，而不是靠人工清理目录。

## Iteration 5.19（2026-03-30）：统一提交前验证入口为 pnpm verify

### 目标

- 把提交前默认要跑的 5 条检查收敛为一个统一入口，减少人工和 AI 的遗漏概率。
- 让仓库级 AI 协作规则从“建议执行”升级为“默认执行”。

### 主要改动

- 新增根脚本：
  - `package.json`
  - 增加 `pnpm verify`，顺序串联：
    - `pnpm format:check`
    - `pnpm lint`
    - `pnpm typecheck`
    - `pnpm test`
    - `pnpm spellcheck`
- 强化仓库协作约定：
  - `AGENTS.md`
  - 明确规定：对任何实际代码、配置、脚本、文档改动，默认在交付前主动执行上述 5 条检查
  - 明确优先使用 `pnpm verify` 作为统一入口，避免漏跑单项

### 迁移/破坏性变更

- 无运行时行为变更。
- 无接口或数据库变更；仅新增统一验证脚本并强化协作规范。

### 验证

- `pnpm verify`

### 下一步

- 如果后续希望把 `web/admin` 的 Playwright 也纳入提交前默认校验，可再评估是否新增 `pnpm verify:e2e`，避免当前入口过重。

## Iteration 5.18（2026-03-30）：将 Next 的 next-env.d.ts 收口为生成文件

### 目标

- 去掉每次运行 Next / Playwright 后都要手动 `git restore apps/web/next-env.d.ts` 的额外心智负担。
- 让仓库对齐 Next 官方约定：`next-env.d.ts` 作为生成文件存在，但不再进入提交面。

### 主要改动

- 调整仓库忽略规则：
  - `.gitignore`
  - 新增 `apps/*/next-env.d.ts`，统一覆盖 `apps/web` 和 `apps/admin` 两个 Next 应用
- 明确工程约定：
  - `next-env.d.ts` 仍然保留在各自 `tsconfig.json` 的 `include` 中，由 Next 在 `next dev / next build / next typegen` 时自动生成
  - 仓库不再跟踪这两个文件，避免临时 `distDir`、Playwright 专用 `.next-playwright` 路径把工作区反复弄脏

### 迁移/破坏性变更

- 无运行时行为变更。
- Git 层面会把 `apps/web/next-env.d.ts` 与 `apps/admin/next-env.d.ts` 从版本控制中移除，后续由本地/CI 按需自动生成。

### 验证

- 临时移除 `apps/web/next-env.d.ts` 与 `apps/admin/next-env.d.ts` 后分别执行：
  - `pnpm -C apps/web typecheck`
  - `pnpm -C apps/admin typecheck`
  - 结果均通过，说明文件不入库不会阻断现有类型检查链路

### 下一步

- 后续如果再新增 Next app，沿用同一规则即可，不要再把 `next-env.d.ts` 纳入版本控制。

## Iteration 5.17（2026-03-30）：稳定“停止生成 partial 持久化”的 Web E2E

### 目标

- 修复 Web 端“停止生成后应保留并持久化已输出的 assistant 部分内容”这条 Playwright 用例的时序不稳定问题。
- 不改变当前产品行为，只提升 mock 流式测试环境与断言时机的确定性。

### 主要改动

- 调整 Playwright Web 测试环境的 mock 流式节奏：
  - `playwright.config.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - mock provider 现在支持通过 `MOCK_STREAM_DELTA_DELAY_MS` 配置分片延迟
  - Web E2E 启动命令中为 mock stream 显式注入了更稳定的分片延迟，确保“停止生成”按钮有稳定可点击窗口
- 调整停止生成相关 E2E 的等待顺序：
  - `apps/web/e2e/chat-smoke.spec.ts`
  - 用例现在先等待“停止生成”按钮进入可操作状态，再等待 assistant 已输出首段内容并点击中止
  - 这样更贴近真实交互，也更符合 Playwright 的 auto-wait 断言方式

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无产品行为变更；这次只影响测试环境下的 mock 流式节奏与 E2E 断言时机。

### 验证

- `pnpm -C apps/web exec vitest run src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
- `pnpm -C apps/web typecheck`
- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '停止生成后应保留并持久化已输出的 assistant 部分内容|只有最后一条用户消息显示编辑按钮|编辑最后一条用户消息后仍可正常重生成'`

### 下一步

- 如果后续再补更多“流式中止”类 E2E，可以继续复用 `MOCK_STREAM_DELTA_DELAY_MS`，避免每条用例单独堆 `waitForTimeout`。

## Iteration 5.16（2026-03-30）：收口最后一条消息编辑链路的实现边界

### 目标

- 在不改变现有产品行为的前提下，删掉一部分已经不会被当前 UI 触发的过渡逻辑。
- 让“仅最后一条用户消息可编辑”不仅体现在前端按钮显示上，也体现在前端编辑状态机和服务端编辑接口上。

### 主要改动

- 收口前端编辑实现：
  - `apps/web/src/app/chat/lib/chat-message-mutations.ts`
  - `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - optimistic 编辑会话不再保留“历史消息 tail 替换”逻辑，而是按当前产品规则只重建最后一轮
  - “是否可编辑”判断被提取为共享 helper，避免 UI 和 controller 自己各写一套规则
- 收口服务端编辑实现：
  - `apps/web/src/lib/server/chat-session-model.ts`
  - `apps/web/src/lib/server/chat-session-repository.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - 服务端现也会拒绝非最后一条用户消息的编辑请求
  - 编辑落库改回“truncate 当前最后一轮后重新 append”，删除了不再需要的 tail 保留实现
- 调整 controller 与 actions hook 的职责边界：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - `apps/web/src/app/chat/hooks/use-chat-controller-actions.ts`
  - 编辑状态机继续集中在 `use-chat-controller`
  - `use-chat-controller-actions` 不再保留一套已失活的编辑提交逻辑
- 同步整理测试：
  - `apps/web/src/app/chat/lib/chat-message-mutations.test.ts`
  - `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
  - `apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无产品行为变更；这是一次实现收口与服务端规则对齐。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/lib/chat-message-mutations.test.ts apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
- `pnpm -C apps/web exec eslint src/app/chat/lib/chat-message-mutations.ts src/app/chat/lib/chat-message-mutations.test.ts src/app/chat/hooks/use-edit-message.ts src/app/chat/hooks/use-chat-controller.ts src/app/chat/hooks/use-chat-controller-actions.ts src/app/chat/hooks/use-chat-controller-actions.dom.test.ts src/app/chat/hooks/use-chat-controller.dom.test.ts src/app/chat/components/chat-message-list.tsx src/app/chat/components/chat-message-item.tsx src/app/chat/components/chat-message-item.dom.test.tsx 'src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts' src/lib/server/chat-session-model.ts src/lib/server/chat-session-repository.ts`
- `pnpm -C apps/web typecheck`
- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '只有最后一条用户消息显示编辑按钮|编辑最后一条用户消息后仍可正常重生成|停止生成后应保留并持久化已输出的 assistant 部分内容'`
  - 其中两条编辑相关用例通过
  - “停止生成后应保留并持久化已输出的 assistant 部分内容”仍稳定卡在等待“停止生成”按钮出现，表现更像既有时序不稳定，而不是这次编辑链路收口导致的回归

### 下一步

- 若后续要继续提升测试稳态，可单独调整“停止生成”相关 E2E，让它不再依赖页面里必须能抢到停止按钮这一时序窗口。

## Iteration 5.15（2026-03-30）：聊天编辑能力收口为“仅最后一条用户消息可编辑”

### 目标

- 将聊天页消息编辑规则与豆包一类产品对齐：只有最后一条用户消息展示编辑入口。
- 避免用户继续从 UI 触发“编辑非最后一条消息”带来的语义分歧和复杂链路。

### 主要改动

- 调整聊天页编辑入口显示规则：
  - `apps/web/src/app/chat/lib/chat-message-mutations.ts`
  - `apps/web/src/app/chat/components/chat-message-list.tsx`
  - `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 当前会先解析当前会话里的最后一条用户消息，仅该消息显示“编辑消息”按钮
- 调整前端编辑拦截逻辑：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 即使通过前端状态尝试编辑非最后一条消息，当前也会直接提示“当前仅支持编辑最后一条用户消息”
  - 最后一条消息仍保留原有编辑和重生成链路
- 调整测试：
  - `apps/web/src/app/chat/lib/chat-message-mutations.test.ts`
  - `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
  - `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
  - `apps/web/e2e/chat-smoke.spec.ts`
  - 覆盖“非最后一条消息不显示编辑按钮”“最后一条消息仍可正常编辑重生成”两类场景

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；这是一次前端产品规则收口，聊天页不再暴露历史消息编辑入口。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/lib/chat-message-mutations.test.ts apps/web/src/app/chat/components/chat-message-item.dom.test.tsx apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
- `pnpm -C apps/web exec eslint src/app/chat/lib/chat-message-mutations.ts src/app/chat/lib/chat-message-mutations.test.ts src/app/chat/components/chat-message-item.tsx src/app/chat/components/chat-message-list.tsx src/app/chat/components/chat-message-item.dom.test.tsx src/app/chat/hooks/use-chat-controller.ts src/app/chat/hooks/use-chat-controller-actions.dom.test.ts src/app/chat/hooks/use-chat-controller-actions.ts e2e/chat-smoke.spec.ts`
- `pnpm -C apps/web typecheck`
- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '只有最后一条用户消息显示编辑按钮|编辑最后一条用户消息后仍可正常重生成'`

### 下一步

- 如果后续还要支持“编辑历史消息”，建议不要直接恢复当前入口，而是单独设计为“分支会话 / 版本快照”能力，避免再次混入主链会话语义。

## Iteration 5.14（2026-03-30）：修复编辑非最后一条消息时误清空后续消息

### 目标

- 修复聊天页在编辑“不是最后一条”的用户消息后，只要本轮 assistant 开始返回内容，就把该消息后面的历史消息一起清空的问题。
- 让编辑语义收口为“只替换当前轮次的用户消息和 assistant 回复，保留后续 tail 消息不变”。

### 主要改动

- 调整前端编辑 optimistic 更新：
  - `apps/web/src/app/chat/lib/chat-message-mutations.ts`
  - `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - 新增“替换编辑轮次并保留 tail”的本地消息变换 helper
  - 编辑非最后一条用户消息时，不再通过 `slice(0, targetIndex + 1)` 截断后续消息
- 调整服务端编辑后会话重建逻辑：
  - `apps/web/src/lib/server/chat-session-model.ts`
  - `apps/web/src/lib/server/chat-session-repository.ts`
  - 编辑持久化从“truncate 后重新 append”改为“替换当前轮次并拼回 tail”
  - 普通完成态与 interrupted partial 持久化都会保留被编辑轮次之后的历史消息
- 同步修正本地 draft helper 与测试：
  - `apps/web/src/app/chat/lib/chat-session-draft.ts`
  - `apps/web/src/app/chat/lib/chat-message-mutations.test.ts`
  - `apps/web/src/app/chat/lib/chat-session-draft.test.ts`
  - `apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整编辑某一轮消息后的前后端会话替换语义。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/lib/chat-message-mutations.test.ts apps/web/src/app/chat/lib/chat-session-draft.test.ts apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts`
- `pnpm -C apps/web exec eslint src/app/chat/lib/chat-message-mutations.ts src/app/chat/lib/chat-message-mutations.test.ts src/app/chat/lib/chat-session-draft.ts src/app/chat/lib/chat-session-draft.test.ts src/app/chat/hooks/use-edit-message.ts src/lib/server/chat-session-model.ts src/lib/server/chat-session-repository.ts`
- `PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '编辑非最后一条用户消息'`
  - 其中“编辑非最后一条用户消息并完成生成时，不应清空其后的消息”已通过
  - 同组的“0 字停止 / partial 停止”用例仍失败，表现为停止时机与预期语义未完全对齐，属于相邻但未在本次修复内收口的问题

### 下一步

- 若继续收口编辑链路，可单独处理“编辑非最后一条消息时的停止生成”语义，确保 0 字停止与 partial 停止在真实页面里也能稳定命中预期状态。

## Iteration 5.13（2026-03-30）：编辑重生成切换为“确认即退出编辑态 + 可恢复原回复”

### 目标

- 把编辑消息后的交互从“确认后仍停留在编辑框里等待生成完成”切换为更清晰的产品语义：
  - 点击“确定”后立即退出编辑态
  - 生成中只保留“停止生成”，不再让用户依赖“取消”收尾
  - partial 中止后补充“恢复原回复”动作

### 主要改动

- 调整前端编辑提交流程：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - 编辑确认后现在会立即清理编辑态，并为当前会话保存一份“编辑前快照”
  - 如果生成完整完成、无变化或 0 字中止，快照会被清理
  - 如果生成 partial 后中止，则保留快照，供后续“恢复原回复”使用
- 调整编辑中止交互：
  - `apps/web/src/app/chat/components/chat-message-item.tsx`
  - `apps/web/src/app/chat/components/chat-message-actions.tsx`
  - 用户确认编辑后，生成中的用户消息不再继续暴露“编辑消息”入口
  - assistant interrupted 消息现在可显示“恢复原回复”按钮
- 新增恢复原回复接口：
  - `apps/web/src/app/chat/lib/chat-api.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/restore/route.ts`
  - 恢复动作会把编辑前快照重新保存到服务端，而不是只在本地临时回退
- 调整测试：
  - `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
  - `apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts`
  - 覆盖“恢复原回复”按钮展示、生成中隐藏编辑入口，以及新的编辑结果状态语义

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 破坏；仅新增会话恢复接口，并调整编辑重生成的前端交互语义。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts apps/web/src/app/chat/components/chat-message-item.dom.test.tsx apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
- `pnpm -C apps/web exec eslint src/app/chat/lib/chat-api.ts src/app/chat/hooks/use-edit-message.ts src/app/chat/hooks/use-edit-message.dom.test.ts src/app/chat/hooks/use-chat-controller.ts src/app/chat/components/chat-message-item.tsx src/app/chat/components/chat-message-item.dom.test.tsx src/app/chat/components/chat-message-actions.tsx src/app/chat/components/chat-message-list.tsx src/app/chat/ChatClient.tsx 'src/app/api/chat/sessions/[sessionId]/restore/route.ts' 'src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts' src/lib/server/chat-session-repository.ts`

### 下一步

- 如果后续希望把“恢复原回复”能力跨刷新保留得更完整，可以再评估是否把编辑前版本显式建模为正式版本记录，而不是只保留当前页面内快照。

## Iteration 5.12（2026-03-30）：收口编辑重生成的中止语义

### 目标

- 修复用户编辑消息后重新生成时，“停止生成”没有真正中止编辑流、以及中止后旧 assistant 回复被错误丢失的问题。
- 让编辑场景的中止语义与产品预期对齐：
  - assistant 尚未输出任何内容时，中止后可回到原会话
  - assistant 已输出部分内容时，保留部分回复并标记为 `interrupted`

### 主要改动

- 调整前端编辑流请求：
  - `apps/web/src/app/chat/lib/chat-api.ts`
  - `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 编辑流现在会注册 `AbortController`，统一接入全局“停止生成”按钮
  - 编辑流中止时会读取当前 optimistic assistant 内容：
    - 若尚无输出，则恢复为提交前的原会话快照
    - 若已有输出，则优先同步服务端中断态；若远端尚未来得及返回，再退回本地 interrupted 态
- 调整服务端编辑流持久化语义：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - `apps/web/src/lib/server/chat-session-repository.ts`
  - 编辑流不再在开始生成前就把远端会话截断写库
  - 现在只在真正拿到成功回复或中断 partial 后，才用“替换编辑点之后的会话内容”方式持久化
  - 因此“0 字中止”不会把旧 assistant 回复提前删掉；“有字中止”则会稳定落库为 interrupted
- 调整测试：
  - `apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts`
  - 新增“0 字中止恢复原会话”和“partial 中止保留 interrupted 回复”两类回归断言

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整编辑重生成链路的中止处理与服务端持久化时机。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
- `pnpm -C apps/web exec eslint src/app/chat/lib/chat-api.ts src/app/chat/hooks/use-edit-message.ts src/app/chat/hooks/use-edit-message.dom.test.ts src/app/chat/hooks/use-chat-controller.ts 'src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts' src/lib/server/chat-session-repository.ts`
- `pnpm exec prettier -c apps/web/src/app/chat/lib/chat-api.ts apps/web/src/app/chat/hooks/use-edit-message.ts apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts apps/web/src/app/chat/hooks/use-chat-controller.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts' apps/web/src/lib/server/chat-session-repository.ts`

### 下一步

- 如果后续还要继续细化编辑体验，可以再评估是否为“0 字中止后的编辑态”增加更明确的 UI 提示，例如“已取消本次重生成，原回复已恢复”。

## Iteration 5.11（2026-03-30）：编辑消息时拦截空白提交与无效重生成

### 目标

- 修复聊天页编辑用户消息时，“空白内容”或“内容未变化”仍可能触发 AI 重新生成的问题。
- 让编辑确认语义收口为“只有内容发生有效变化时才真正重新生成”。

### 主要改动

- 调整 `apps/web/src/app/chat/hooks/use-chat-controller-actions.ts`
  - 在 `submitEditingUserMessage()` 入口增加空白内容硬拦截
  - 若编辑内容 `trim()` 后为空，直接提示“编辑内容不能为空”，不再继续提交
- 调整 `apps/web/src/app/chat/hooks/use-edit-message.ts`
  - 在真正发起编辑流式请求前，追加两类 no-op 判断：
    - 空白内容：直接返回失败并提示，不发请求
    - 与原消息内容等价：直接返回成功，交由上层退出编辑态，但不触发重新生成
  - 这样无论是点击按钮还是未来新增其它提交入口，都不会把无效编辑送到服务端
- 调整测试：
  - `apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts`
  - `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
  - 新增“空白不提交”“内容未变化不重生成”两类回归

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整前端编辑提交流程的拦截与 no-op 收口逻辑。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/hooks/use-edit-message.dom.test.ts apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
- `pnpm -C apps/web exec eslint src/app/chat/hooks/use-edit-message.ts src/app/chat/hooks/use-edit-message.dom.test.ts src/app/chat/hooks/use-chat-controller-actions.ts src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`

### 下一步

- 如果后续要继续完善编辑体验，可以再评估是否在“内容未变化”时给出轻量提示，或直接把确认按钮文案在 no-op 场景下收口成“完成”。

## Iteration 5.10（2026-03-30）：收口 fallback 流式回复被中止时的未处理 AbortError

### 目标

- 修复普通聊天与“编辑后重新生成”链路里，快捷 fallback 流式回复在请求被中止时抛出未处理 `AbortError` 的问题。
- 让这类中止从“服务端未处理拒绝”收口为可预测的正常取消语义。

### 主要改动

- 调整 `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - `emitShortcutReplyAsStream()` 不再在中止时直接把 `AbortError` 抛给外层，而是返回 `{ aborted, content }`
  - 若流式过程中被中止，会保留已经输出的部分内容，供上层路由决定是否持久化为 `interrupted`
- 调整两条聊天流路由：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - fallback 流式回复若被中止：
    - 已输出部分内容时，落库为中断消息
    - 尚未输出内容时，回滚额度
    - 不再让 abort 从 `catch` 分支里再次逃逸并形成 `unhandledRejection`
- 调整测试：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - 新增“开始前已中止”和“流式中途被中止”两类回归断言

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整服务端 fallback 流式回复的异常收口方式。

### 验证

- `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`
- `pnpm -C apps/web exec eslint 'src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts' 'src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts' 'src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts' 'src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts'`

### 下一步

- 如果后续还要继续强化“停止生成 / 编辑重生成”的一致性，可以把普通流式与 fallback 流式的中止持久化逻辑再进一步抽成共享 helper，减少双路由重复分支。

## Iteration 5.09（2026-03-28）：停止生成后的中断消息持久化与状态展示

### 目标

- 把“AI 已经输出部分内容，用户点击停止”的链路从纯前端临时状态升级为可持久化的正式消息状态。
- 让聊天页与 Admin 对这类中断消息看到的是同一份数据，而不是“前端能看见、刷新或后台看不见”。

### 主要改动

- 扩展共享消息类型：
  - `packages/shared/src/types/index.ts`
  - 新增 `ChatMessageCompletionStatus = 'completed' | 'interrupted'`
  - `ChatMessage` 新增可选字段 `completionStatus`
- 调整服务端会话写入模型：
  - `apps/web/src/lib/server/chat-session-model.ts`
  - `apps/web/src/lib/server/chat-session-repository.ts`
  - assistant 正常落库时写入 `completed`
  - 新增 `appendActorInterruptedTurn()`，用于持久化“仅用户消息”或“用户消息 + interrupted assistant 部分回复”
  - 因为消息本来就存于 `ChatSessionRecord.messages` 的 JSONB 中，本次无需 Prisma migration
- 新增中断持久化接口：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/interrupted/route.ts`
  - 前端停止生成后，如果远端尚未推进，会显式调用这条接口把当前中断态写回服务端
  - 接口支持 `expectedMessageCount`，避免前端补写与原 SSE 路由收尾同时发生时重复落库
- 调整停止生成前端链路：
  - `apps/web/src/app/chat/hooks/use-send-message.ts`
  - 本地仍会立即保留用户消息，并在已有部分 assistant 内容时把本地消息标成 `interrupted`
  - 之后再显式同步到服务端；成功后用远端会话覆盖本地 optimistic ID，保证刷新与 Admin 一致
- 调整展示层：
  - `apps/web/src/app/chat/components/chat-message-item.tsx`
  - `apps/admin/src/lib/session-messages.ts`
  - `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - `apps/admin/src/components/session-detail-view.tsx`
  - Web 与 Admin 都会对 `completionStatus === 'interrupted'` 的 assistant 消息显示“已停止生成”轻量标识
- 额外修复 SSE 中断时的服务端异常噪音：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - 普通聊天在用户中止后，`ReadableStream` 控制器可能已关闭；之前路由继续 `enqueue error/end` 会触发 `Controller is already closed`
  - 现在统一通过安全 `enqueue / finalize` helper 收口，避免未处理异常污染日志
- 调整测试：
  - `apps/web/src/app/chat/hooks/use-send-message.dom.test.ts`
  - `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
  - `apps/web/src/app/chat/lib/chat-message-mutations.test.ts`
  - `apps/web/src/app/chat/lib/chat-session-draft.test.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - `apps/admin/src/lib/session-messages.test.ts`
  - `apps/web/e2e/chat-smoke.spec.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 历史消息没有 `completionStatus` 也不会受影响；前端与 Admin 会把缺失状态视为普通已完成消息。

### 验证

- `pnpm exec vitest run 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts' apps/web/src/app/chat/hooks/use-send-message.dom.test.ts apps/web/src/app/chat/lib/chat-message-mutations.test.ts apps/web/src/app/chat/components/chat-message-item.dom.test.tsx apps/web/src/app/chat/lib/chat-session-draft.test.ts apps/admin/src/lib/session-messages.test.ts`
- `pnpm -C apps/web exec eslint 'src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts' 'src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts' 'src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts' 'src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts' src/app/chat/hooks/use-send-message.ts src/app/chat/lib/chat-api.ts src/app/chat/lib/chat-message-mutations.ts src/app/chat/components/chat-message-item.tsx src/lib/server/chat-session-model.ts src/lib/server/chat-session-repository.ts 'src/app/api/chat/sessions/[sessionId]/messages/interrupted/route.ts'`
- `pnpm exec prettier -c 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts' 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts' 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts' 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts'`
- `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e:web --grep '停止生成'`

### 下一步

- 若后续要支持“继续生成”，可直接基于 `completionStatus: 'interrupted'` 扩展，而不需要再为这类消息重新设计数据结构。

## Iteration 5.08（2026-03-28）：终止生成时保留已发送的用户消息

### 目标

- 修复聊天页在“AI 仍在生成中，用户点击终止”时把本轮用户消息一起移除的问题。
- 让终止语义收口为“取消 assistant 继续生成”，而不是“整轮消息回滚”。

### 主要改动

- 调整 `apps/web/src/app/chat/hooks/use-send-message.ts`
  - 修复“已有远端会话时，停止生成后又拉回远端旧会话，导致本轮用户消息被覆盖”的竞态
  - 当前中止分支会先判断远端会话是否真的已经推进
  - 若远端没有推进，则保留本地用户消息；若远端其实已落库，则优先采用远端完整结果
- 调整 `apps/web/src/app/chat/lib/chat-message-mutations.ts`
  - 新增 `finalizeInterruptedAssistantMessage()`
  - 终止生成时会：
    - 保留已发送的用户消息
    - 仅在 assistant 仍为空占位时移除该占位
    - 若 assistant 已有部分流式内容，则保留这段部分回复
    - 把会话状态收口为 `idle`
    - 若这是首条用户消息，则同步收口本地标题
- 调整测试：
  - `apps/web/src/app/chat/lib/chat-message-mutations.test.ts`
  - `apps/web/src/app/chat/hooks/use-send-message.dom.test.ts`
  - `apps/web/e2e/chat-smoke.spec.ts`
  - 覆盖“终止时保留用户消息”“保留部分 assistant 回复”以及“已有远端会话时不被旧远端数据覆盖”三类回归

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整前端本地 optimistic 状态在中止生成时的收口策略。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/lib/chat-message-mutations.test.ts apps/web/src/app/chat/hooks/use-send-message.dom.test.ts`
- `pnpm -C apps/web exec eslint src/app/chat/lib/chat-message-mutations.ts src/app/chat/lib/chat-message-mutations.test.ts src/app/chat/hooks/use-send-message.ts src/app/chat/hooks/use-send-message.dom.test.ts`
- `pnpm exec prettier -c apps/web/src/app/chat/lib/chat-message-mutations.ts apps/web/src/app/chat/lib/chat-message-mutations.test.ts apps/web/src/app/chat/hooks/use-send-message.ts apps/web/src/app/chat/hooks/use-send-message.dom.test.ts`
- Playwright 手工复核：真实浏览器下复现“已有远端会话 -> 发送第二条消息 -> 立刻停止”，确认用户消息保留且不再被远端旧会话覆盖

### 下一步

- 如果后续还想继续完善“终止生成”体验，可再评估是否在 UI 上显式标注“已停止生成”，但应避免把这类提示做成打断阅读的强提醒。

## Iteration 5.07（2026-03-28）：统一普通聊天的 AI 身份口径

### 目标

- 把 Web 端普通聊天里 AI 的默认身份，从“面试通的 AI 助手”统一收口为“面试通，一个互联网大公司的资深程序员和面试官，专注于前端技术领域”。
- 避免 system prompt、问候语示例和 fallback 之间出现“助手 / 面试官 / 资深程序员”混用。

### 主要改动

- 调整 `apps/web/src/lib/server/chat-general-policy.constants.ts`
  - 更新全局 system prompt 的首句角色定义
  - 将“通用百科助手”对比语境下的目标角色同步收口为“资深从业者、技术顾问与面试官”
- 调整 `apps/web/src/lib/server/chat-general-policy-instruction.ts`
  - 更新问候语意图里的自我介绍要求，显式要求模型按新身份开场
- 调整 `apps/web/src/lib/server/chat-general-policy-examples.ts`
  - 更新问候语 few-shot 示例的自我介绍文案
  - 同步把简单算术意图里的“前端面试助手”改为更中性的“作为面试通”
- 调整 `apps/web/src/lib/server/chat-general-policy-fallback.ts`
  - 更新问候语、简历优化、简单算术 fallback 的自我身份表述
- 调整测试：
  - `apps/web/src/lib/server/chat-general-policy.test.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整普通聊天 prompt 与 fallback 的角色文案。

### 验证

- `pnpm exec vitest run apps/web/src/lib/server/chat-general-policy.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`
- `pnpm -C apps/web exec eslint src/lib/server/chat-general-policy.constants.ts src/lib/server/chat-general-policy-instruction.ts src/lib/server/chat-general-policy-examples.ts src/lib/server/chat-general-policy-fallback.ts src/lib/server/chat-general-policy.test.ts 'src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`

### 下一步

- 如果后续还要继续打磨产品口吻，可再把首页空态、欢迎文案与普通聊天 prompt 的身份表述统一抽成共享常量，避免同类文案再次分叉。

## Iteration 5.06（2026-03-28）：聊天 Markdown 分割线补充垂直间距

### 目标

- 让聊天区 Markdown 分割线在上下都保留稳定留白，避免贴近正文导致视觉上过紧。

### 主要改动

- 调整 `apps/web/src/app/chat/components/chat-markdown.tsx`
  - 为 `react-markdown` 的 `hr` 节点新增自定义渲染
  - 给聊天区分割线显式补上 `my-6`，将留白收口在聊天 Markdown 渲染层，而不是放到全局样式
- 调整 `apps/web/src/app/chat/components/chat-table-block.dom.test.tsx`
  - 新增 Markdown 分割线渲染断言，校验 `hr` 节点存在且保留 `my-6` class

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整聊天区 Markdown 分割线的展示样式。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/components/chat-table-block.dom.test.tsx`
- `pnpm -C apps/web exec eslint src/app/chat/components/chat-markdown.tsx src/app/chat/components/chat-table-block.dom.test.tsx`

### 下一步

- 如果后续还要继续打磨 Markdown 阅读节奏，可再统一收口 `blockquote / list / table / hr` 的垂直间距比例，形成一套聊天区排版节奏规范。

## Iteration 5.05（2026-03-28）：移除普通聊天对分割线与 mermaid 的输出限制

### 目标

- 去掉 Web 端普通聊天 prompt 中“不要使用 Markdown 分割线”和“不要输出 mermaid 图”的限制。
- 确保服务端后处理不会再把模型生成的 Markdown 分割线清洗掉，真正放开这类输出。

### 主要改动

- 调整 `apps/web/src/lib/server/chat-general-policy.constants.ts`
  - 移除全局 system prompt 中对 Markdown 分割线与 mermaid 图的显式禁止
- 调整 `apps/web/src/lib/server/chat-general-policy-instruction.ts`
  - 移除简历优化、项目亮点、技术问答、技术机制题等意图指令里对分割线与 mermaid 图的限制文案
- 调整 `apps/web/src/lib/server/chat-response-format.ts`
  - `normalizeAssistantMarkdown()` 不再额外清洗普通文本中的 Markdown 分割线
  - 保留既有 fenced code block 包装、语言修正与不平衡 fence 清理逻辑
- 调整测试：
  - `apps/web/src/lib/server/chat-general-policy.test.ts`
  - `apps/web/src/lib/server/chat-response-format.test.ts`
  - 同步改为断言相关限制文案已移除，并补充分割线保留回归

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整普通聊天的 prompt 约束与 Markdown 规范化策略。

### 验证

- `pnpm exec vitest run apps/web/src/lib/server/chat-general-policy.test.ts apps/web/src/lib/server/chat-response-format.test.ts`
- `pnpm -C apps/web exec eslint src/lib/server/chat-general-policy.constants.ts src/lib/server/chat-general-policy-instruction.ts src/lib/server/chat-general-policy.test.ts src/lib/server/chat-response-format.ts src/lib/server/chat-response-format.test.ts`

### 下一步

- 如果后续还想继续放开更丰富的 Markdown 能力，可再评估是否允许更复杂的表格、引用块或流程图说明，但应单独定义渲染与回归边界。

## Iteration 5.04（2026-03-28）：点赞与点踩按钮补充轻量反馈动效

### 目标

- 让 AI 回复下方的点赞、点踩按钮在状态切换时有更明确的交互反馈，但不引入喧宾夺主的重动画。

### 主要改动

- 调整 `apps/web/src/app/chat/components/chat-message-actions.tsx`
  - 按钮本身新增轻量 `hover / active` 缩放反馈
  - 点赞与点踩图标在“线框 / 填充”状态切换时会重新挂载，并通过 `animate-in + zoom-in` 播放一次短促 pop 动效
  - 新增 `message-upvote-icon`、`message-downvote-icon` 测试钩子，便于稳定回归
- 新增 `apps/web/src/app/chat/components/chat-message-actions.dom.test.tsx`
  - 覆盖反馈状态切换时图标重挂载与动画 class 保留的断言

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整 AI 回复动作区里点赞、点踩按钮的视觉反馈。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/components/chat-message-actions.dom.test.tsx apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
- `pnpm -C apps/web exec eslint src/app/chat/components/chat-message-actions.tsx src/app/chat/components/chat-message-actions.dom.test.tsx`
- `pnpm exec prettier -c apps/web/src/app/chat/components/chat-message-actions.tsx apps/web/src/app/chat/components/chat-message-actions.dom.test.tsx apps/web/src/app/globals.css`

### 下一步

- 若后续还想继续增强反馈感，可再评估是否给“复制成功”图标也补同等级别的轻动画，但应保持整个动作区动画节奏统一。

## Iteration 5.03（2026-03-28）：聊天页通用图标按钮移除 hover 文案提示

### 目标

- 去掉聊天页里一批语义已足够明确的通用图标按钮 hover 提示，减少不必要的视觉噪音。
- 保留图标按钮的可访问性标签，不影响读屏和按钮语义。

### 主要改动

- 调整 `apps/web/src/components/ui/hover-tooltip.tsx`
  - 新增 `disabled` 开关，允许在具体场景关闭 tooltip，而不影响其它仍需提示的入口
- 调整 `apps/web/src/app/chat/components/chat-message-actions.tsx`
  - 关闭 AI 回复下方复制、点赞、点踩按钮的 hover 文案提示
  - 关闭用户消息气泡下方复制按钮的 hover 文案提示
- 调整 `apps/web/src/app/chat/components/chat-code-block.tsx`
  - 关闭代码块下载、复制按钮的 hover 文案提示
- 新增 `apps/web/src/components/ui/hover-tooltip.dom.test.tsx`
  - 覆盖 tooltip 启用与禁用两种行为，避免后续回归

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整聊天页部分图标按钮的 hover 提示展示。

### 验证

- `pnpm exec vitest run apps/web/src/components/ui/hover-tooltip.dom.test.tsx apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
- `pnpm -C apps/web exec eslint src/components/ui/hover-tooltip.tsx src/components/ui/hover-tooltip.dom.test.tsx src/app/chat/components/chat-message-actions.tsx src/app/chat/components/chat-code-block.tsx`

### 下一步

- 若后续还要继续收口交互噪音，可统一盘点“哪些按钮保留 tooltip，哪些按钮只保留 aria-label”，形成一套聊天页动作区规范。

## Iteration 5.02（2026-03-28）：额度弹层进度条颜色加深

### 目标

- 提升聊天输入区额度弹层内进度条的可见性，避免当前前景色过浅看起来接近灰底。

### 主要改动

- 调整 `apps/web/src/app/chat/components/chat-composer-usage.tsx`
  - 额度弹层进度条前景色从 `bg-zinc-400` 加深为 `bg-zinc-500`
  - 不调整进度条尺寸、圆角、布局和文案，仅收口颜色层级

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整额度弹层进度条的视觉颜色。

### 验证

- `pnpm -C apps/web exec eslint src/app/chat/components/chat-composer-usage.tsx`

### 下一步

- 若后续还觉得弱，可继续把轨道色与触发器圆环一起纳入统一色板收口，但这次先维持最小改动。

## Iteration 5.01（2026-03-28）：会话列表更多操作按钮改为严格 hover 才显示

### 目标

- 修复左侧会话列表项在点击后即使鼠标移出仍残留显示 `...` 操作按钮的问题。
- 让会话项操作按钮只在 `hover` 或菜单已打开时显示，不再受焦点状态影响。

### 主要改动

- 调整 `apps/web/src/app/chat/components/chat-sidebar-session-item.tsx`
  - 移除操作区展开逻辑中的 `group-focus-within/session:*`
  - 移除按钮可点击逻辑中的 `group-focus-within/session:pointer-events-auto`
  - 当前行为收口为：仅 `hover` 会话项时显示 `...`，或菜单已打开时保持可见

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整会话列表项操作按钮的显隐条件。

### 验证

- `pnpm -C apps/web exec eslint src/app/chat/components/chat-sidebar-session-item.tsx`
- `pnpm exec prettier -c apps/web/src/app/chat/components/chat-sidebar-session-item.tsx`

### 下一步

- 若后续要兼顾键盘可访问性，可单独为列表项补一版不影响 hover 视觉的键盘操作入口，而不是继续复用 `focus-within` 展示逻辑。

## Iteration 5.00（2026-03-28）：聊天页消息编辑操作文案改为中文

### 目标

- 统一聊天页消息编辑表单的中文文案，避免在中文界面里混入英文按钮文字。

### 主要改动

- 调整 `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 编辑态按钮文案从 `Cancel / Send` 改为 `取消 / 确定`
- 调整 `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
  - 新增编辑态中文文案断言，防止后续回归到英文

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整聊天页消息编辑表单的展示文案。

### 验证

- `pnpm exec vitest run apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
- `pnpm -C apps/web exec eslint src/app/chat/components/chat-message-item.tsx src/app/chat/components/chat-message-item.dom.test.tsx`

### 下一步

- 若后续继续做中文化收口，可统一扫一遍聊天页残留的英文 tooltip、空态与按钮文案，而不是逐处被动修补。

## Iteration 4.99（2026-03-28）：聊天页会话列表改为 hover 时才显示更多操作占位

### 目标

- 让聊天页左侧会话列表默认尽量给标题文本更多宽度，不再被右侧操作按钮预留空位。
- 让 hover 某一项时再显示 `...` 操作入口，并让长标题在此时自然收缩为单行省略。

### 主要改动

- 调整 `apps/web/src/app/chat/components/chat-sidebar-session-item.tsx`
  - 右侧操作区从“固定 `w-8` 占位 + 透明隐藏”改为“默认 `w-0` 零占位，`hover / focus-within / menuOpen` 时扩展到 `w-8`”
  - 移除列表项常驻 `gap`，改为仅在操作区展开时补 `ml-1`
  - 标题文本从 `line-clamp-1` 收口为标准单行 `truncate`，确保 hover 后能稳定出现 `...` 省略
  - 操作按钮图标统一为 `MoreHorizontal`，避免置顶会话在非 hover 状态下仍占据右侧空间

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅调整聊天页左侧会话列表项的显示与 hover 交互。

### 验证

- `pnpm -C apps/web exec eslint src/app/chat/components/chat-sidebar-session-item.tsx`
- `pnpm -C apps/web typecheck`

### 下一步

- 若后续还要继续打磨会话列表，可再评估是否为“置顶状态”补一个不占布局的弱提示，但不应回退到常驻操作位占宽的实现。

## Iteration 4.98（2026-03-27）：技术问答增加深度档位并接入 reasoner 路由与流式调参

### 目标

- 提升普通技术问答在“讲一下 / 详细讲解”场景下的信息密度与结构化深度。
- 对机制题、对比题和 deep 档位问题优先使用 `deepseek-reasoner`，改善回答完整度。
- 给 DeepSeek 流式调用补齐 `max_tokens / temperature` 可配置能力，便于线上调优。

### 主要改动

- 技术问答意图新增深度档位：
  - `apps/web/src/lib/server/chat-general-policy.types.ts`
  - `apps/web/src/lib/server/chat-general-policy.constants.ts`
  - `apps/web/src/lib/server/chat-general-policy-intent.ts`
  - `technical_question` 从 `{ style }` 扩展为 `{ style, detailLevel }`，`detailLevel` 支持 `standard | deep`。
- 技术问答提示词、few-shot 与 fallback 同步支持 deep 场景：
  - `apps/web/src/lib/server/chat-general-policy-instruction.ts`
  - `apps/web/src/lib/server/chat-general-policy-examples.ts`
  - `apps/web/src/lib/server/chat-general-policy-fallback.ts`
- 普通聊天流式路由新增“模型选择 + 采样参数”策略：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 技术机制题、技术对比题、deep 技术题会将 `deepseek-chat` 自动切到 `deepseek-reasoner`。
  - 新增环境变量读取：`DEEPSEEK_TECH_MAX_TOKENS`、`DEEPSEEK_TECH_TEMPERATURE`、`DEEPSEEK_TECH_DEEP_MAX_TOKENS`、`DEEPSEEK_TECH_DEEP_TEMPERATURE`（deep 默认兜底 `2200 / 0.25`）。
- DeepSeek Stream Provider 支持透传调参：
  - `packages/llm/src/contracts.ts`
  - `packages/llm/src/deepseek-stream-provider.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - `streamChat` 输入新增 `maxTokens / temperature`，并映射到 `max_tokens / temperature` 请求字段。
- 测试与断言同步补齐：
  - `apps/web/src/lib/server/chat-general-policy.test.ts`
  - 增加“讲一下 JS 的事件循环 => mechanism + deep”断言。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无外部 API 破坏性变更；仅调整普通聊天技术问答的模型选择与输出策略。

### 验证

- `pnpm exec vitest run apps/web/src/lib/server/chat-general-policy.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`
- `pnpm typecheck`
- `pnpm lint`

### 下一步

- 上线后观察“技术题平均回复长度、用户继续追问率、满意度反馈”，按数据微调 deep 档位默认 `max_tokens / temperature`。

## Iteration 4.97（2026-03-27）：对齐四类快捷入口的真实产品话术骨架

### 目标

- 基于对四个预置入口的真实重复采样，提炼更稳定的话术结构与版式骨架。
- 把这些骨架映射到我方快捷入口提示词，减少“像固定模板”或“结构过散”的回复。

### 主要改动

- 前期采样结论已转译为两层约束：
  - `apps/web/src/lib/server/chat-general-policy-instruction.ts`
  - `apps/web/src/lib/server/chat-general-policy-examples.ts`
  - `apps/web/src/lib/server/chat-general-policy-fallback.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
- `简历优化` 快捷入口现在更明确收口为：
  - 先确认可帮助
  - 明确说明“尚未看到简历内容”
  - 使用 `**请确保：**` + 有序列表索取完整简历
  - 使用 `**我会重点帮你看这些方面：**` + 无序列表说明评审维度
  - 最后给明确 CTA
- `开始模拟面试` 快捷入口的开场自然化约束进一步加强：
  - 优先输出“欢迎语 / 过渡语 / **第一个问题：** / 可选括号提示”四段式轻量 Markdown
  - 禁止回退成“准备好了吗”“技术栈：React”“系统播报规则”这类旁白式表达
- `前端面试自我介绍` 快捷入口已从“先追问一串背景信息”改为：
  - 先给 60 到 90 秒可直接套用的结构
  - 再给常见误区
  - 再给一句简短模板
  - 最后引导用户贴自己的版本继续打磨
- `项目亮点提炼` 快捷入口已对齐为“先索取简历/项目经历，再声明评审维度”的模式，不再只给抽象四象限建议。
- 相关测试已同步更新：
  - `apps/web/src/lib/server/chat-general-policy.test.ts`
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口 contract 变更；仅影响四类快捷入口在真实模型环境和 fallback 下的回复风格。

### 验证

- `pnpm exec vitest run apps/web/src/lib/server/chat-general-policy.test.ts 'apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts'`
- 仓库级自检继续作为提交前基线。

### 下一步

- 如果线上观察仍觉得某个快捷入口过于“教程化”或“像运营文案”，下一轮应继续把四类入口拆成更细的专属 few-shot，而不是再靠单条系统指令硬压风格。

## Iteration 4.96（2026-03-27）：让预置模拟面试走真实流式回复并更新默认快捷文案

### 目标

- 修复“点击开始模拟面试后整块吐出固定模板”的体验问题，让面试开场与第一问回到逐步流式输出。
- 把默认快捷入口文案从 Vue 技术栈切到 React 技术栈。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 面试链路不再只在 `done` 时一次性回完整 session。
  - 新增“可见 assistant 消息合并 + delta 流式推送”逻辑。
  - `mock` 环境继续输出稳定测试前缀，真实模型环境会把面试引擎的内部动作改写成自然面试官口吻后再流式输出。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - 新增 mock 回复构造、provider 流式转发、面试内部意图转隐藏提示词等 helper。
  - 自然化约束进一步收紧：禁止把已选定问题改写成“你想先聊哪个项目”，并要求一次只保留一个核心问题。
  - 针对“开始模拟面试但尚未拿到足够自我介绍”的场景，新增更强的开场风格约束和 few-shot 示例，禁止出现“面试官视角”“准备好了吗”“技术栈：React”这类不自然话术。
  - 同时为这个开场场景增加固定的轻量 Markdown 版式约束：欢迎语、过渡语、`**第一个问题：**`、括号补充说明分段输出，避免再挤成一整段。
- `packages/interview-engine/src/interview-planning.ts`
  - `project_probe` 不再让候选人自己选项目，而是优先锁定“最近且足够有信号”的具体项目。
  - 会从简历项目经历中提取项目名和亮点条目，并生成单问题的项目深挖题。
  - 当前已进一步收口为“先基础、后项目”的出题顺序；项目题策略改为稳定随机，允许在“AI 指定具体项目”与“候选人自选代表项目”之间切换，但仍保持一次只问一个问题。
  - `skill_probe` 也已从偏方案设计的问题改为更接近基础知识核验的单问题，用来补齐题库未覆盖的简历技能点。
- `packages/shared/src/constants/index.ts`
  - 默认快捷文案改为 `开始模拟面试，我是前端工程师 React 技术栈`
- 回归测试补充：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - `packages/interview-engine/src/interview-planning.test.ts`
  - `packages/shared/src/index.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 历史会话不做迁移；仅新触发的面试回复会使用新的流式与自然化输出链路。

### 验证

- 优先运行与流式接口、共享常量直接相关的单测。
- 完整仓库检查继续作为提交前基线。

### 下一步

- 若线上观察仍觉得面试官开场过于模式化，可继续把“开场白 / 项目追问 / 收尾总结”拆成更细粒度的专用提示词模板，而不是共用一层自然化改写。

## Iteration 4.95（2026-03-27）：将压力题升级为时序化事故演练

### 目标

- 不让压力题只停留在“单轮问你怎么处理事故”，而是进一步验证候选人在事故升级后的二次决策能力。
- 让后台和 Trace 能明确区分“补边界”与“进入事故升级推演”。

### 主要改动

- `packages/shared/src/types/index.ts`
  - `InterviewFollowUpSignal` 新增 `pressure_timeline_shift`
- `packages/agent-skills/src/follow-up-skill.ts`
  - `pressure_probe` 在基础止损、协同、边界、取舍都覆盖后，第一轮不再直接结束，而是触发 `pressure_timeline_shift`
  - 新增事故升级信号识别，允许把“10 分钟后继续恶化/影响面扩大”等回答视为有效增量，而不是误判成无增量
- `packages/llm/src/mock-provider.ts`
  - 新增事故升级后的二次决策追问文案
- `apps/admin/src/components/session-execution-trace-card.tsx`
  - 执行 Trace 新增 `事故升级推演` 信号标签
- 回归测试补充：
  - `packages/agent-skills/src/follow-up-skill.test.ts`
    - 覆盖“进入事故升级推演”
    - 覆盖“升级回答被视为有效增量并正常收尾”

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 旧压力题追问记录不会回填 `pressure_timeline_shift`，仅新执行链路会产生该信号。

### 验证

- `pnpm exec vitest run packages/agent-skills/src/follow-up-skill.test.ts`
- 完整仓库检查作为提交前基线继续执行。

### 下一步

- 下一阶段可把压力题升级为多节点事故脚本，例如引入“监控恢复但投诉增加”“回滚失败”“依赖方延迟响应”等分支事件。

## Iteration 4.94（2026-03-27）：细化 pressure_test 的专属追问信号

### 目标

- 让压力题不再只复用通用 `missing_key_point / tradeoff_gap`，而是能更明确地暴露真实事故面试中的关键短板。
- 把压力题追问收口到更贴近现场处理的几个固定焦点。

### 主要改动

- `packages/shared/src/types/index.ts`
  - `InterviewFollowUpSignal` 新增：
    - `pressure_boundary_gap`
    - `pressure_rollback_gap`
    - `pressure_incident_command_gap`
- `packages/agent-skills/src/follow-up-skill.ts`
  - 新增压力题专属模式识别：
    - 边界判断
    - 止损 / 回滚 / 降级
    - 现场分工与信息同步
  - `pressure_probe` 现优先按以下顺序触发追问：
    - rollback
    - incident-command
    - boundary
    - tradeoff
- `packages/llm/src/mock-provider.ts`
  - 新增压力题三类专属追问文案
- `apps/admin/src/components/session-execution-trace-card.tsx`
  - 执行 Trace 新增三类压力题专属信号标签展示
- 回归测试补充：
  - `packages/agent-skills/src/follow-up-skill.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 旧 follow-up trace 不会补出这些新信号，仅新执行的压力题会产生对应追问记录。

### 验证

- `pnpm exec vitest run packages/agent-skills/src/follow-up-skill.test.ts`
- 完整仓库检查作为提交前基线继续执行。

### 下一步

- 下一阶段可继续把压力题追问从“单轮焦点确认”升级到“多角色现场协同 + 时序推进”的更复杂场景模拟。

## Iteration 4.93（2026-03-27）：将 pressure_test 落地为独立压力题

### 目标

- 把 `pressure_test` 从“阶段占位标签”升级为真正的独立题源。
- 让长时长场次能稳定覆盖事故止损、排查路径、取舍边界这类更接近真实高级面试的问题。

### 主要改动

- `packages/shared/src/types/index.ts`
  - `InterviewQuestionSource` 新增 `pressure_probe`
- `packages/interview-engine/src/interview-planning.ts`
  - 新增 `pressure_probe` 生成逻辑
  - 规则收口为：
    - 仅 `45` 分钟及以上场次插入
    - 题位放在题单末段
    - 聚焦止损优先级、排查路径、方案取舍、边界预案
- `packages/interview-engine/src/process-helpers.ts`
  - `pressure_probe` 现会映射到 `pressure_test` 阶段
- `packages/llm/src/mock-provider.ts`
  - 新增压力题专属提问与追问文案
- `packages/agent-skills/src/assessment-skill.ts`
  - 压力题纳入统一评分，权重设为 `1.1`
- Admin 展示层同步更新：
  - `apps/admin/src/components/session-planning-trace-card.tsx`
  - `apps/admin/src/components/session-execution-trace-card.tsx`
  - 现可明确展示“压力题”
- 回归测试补充：
  - `packages/interview-engine/src/interview-planning.test.ts`
  - `packages/interview-engine/src/index.test.ts`
  - `packages/agent-skills/src/assessment-skill.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 旧会话不会自动补压力题，仅新规划的长时长场次会生成 `pressure_probe`。

### 验证

- `pnpm exec vitest run packages/interview-engine/src/interview-planning.test.ts packages/interview-engine/src/index.test.ts packages/agent-skills/src/assessment-skill.test.ts`
- 完整仓库检查作为提交前基线继续执行。

### 下一步

- 下一阶段可继续把压力题的追问信号细化成 `boundary / rollback / incident-command` 等更明确的类型，而不是先复用通用追问信号。

## Iteration 4.92（2026-03-27）：落地预算感知的动态追问约束

### 目标

- 让追问更像真实面试，而不是“命中规则就一直追问”。
- 把追问约束接入题型差异和时间预算，避免短时长场次被追问拖住。

### 主要改动

- `packages/shared/src/types/index.ts`
  - `InterviewFollowUpDecision` 新增：
    - `skip_budget_exhausted`
    - `skip_no_signal_gain`
  - `InterviewFollowUpSignal` 新增：
    - `budget_exhausted`
    - `no_signal_gain`
- `packages/agent-skills/src/follow-up-skill.ts`
  - 增加题型差异化追问上限：
    - `standard / skill_probe` 最多 `1` 次
    - `project_probe` 最多 `2` 次
  - 增加“无增量证据则切题”规则：
    - 若连续追问后没有新增关键点或新增项目/技能信号，则结束当前题
  - 增加整场追问预算输入，支持由流程层按时长控制追问总量
- `packages/interview-engine/src/process-helpers.ts`
  - 新增按时长推导的整场追问预算：
    - `15` 分钟 `1` 次
    - `30` 分钟 `2` 次
    - `45` 分钟 `3` 次
    - `60+` 分钟 `4` 次
  - `maybeAskFollowUp` 现会同时传入“当前题上限”和“整场剩余追问预算”
- `apps/admin/src/components/session-execution-trace-card.tsx`
  - 执行 Trace 新增“追问预算耗尽 / 无增量切题”两类决策和信号展示
- 回归测试补充：
  - `packages/agent-skills/src/follow-up-skill.test.ts`
  - `packages/interview-engine/src/index.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 旧 follow-up trace 缺少新决策和信号时，不影响运行；仅历史展示不会出现新标签。

### 验证

- `pnpm exec vitest run packages/agent-skills/src/follow-up-skill.test.ts packages/interview-engine/src/index.test.ts`
- 完整仓库检查作为提交前基线继续执行。

### 下一步

- 下一阶段可继续把 `pressure_test` 做成真正独立的压力追问/边界题，而不是只在阶段层保留占位状态。

## Iteration 4.91（2026-03-27）：落地时间预算驱动的阶段切换与提前结束

### 目标

- 让模拟面试不再只按固定题数顺序机械执行，而是能围绕时间预算推进阶段、估算耗时，并在合适时机提前结束。
- 为 Admin Trace 和前端历史会话兼容层补齐新的运行态字段，避免新状态机落地后旧会话直接失配。

### 主要改动

- 扩展共享运行态类型：
  - `InterviewRuntimeState` 新增 `currentStage / stagePlan / visitedStages / estimatedMinutesUsed / completionReason`
  - 新增 `InterviewStage`、`InterviewCompletionReason`
- 面试引擎补齐预算驱动状态机：
  - 根据题目来源映射 `project_deep_dive / fundamental_check / skill_validation / pressure_test / wrap_up`
  - 生成 `stagePlan` 并在每题结束后推进 `currentStage`
  - 引入 `estimateQuestionMinutes`，按题型和追问轮次估算耗时
  - 引入 `resolveCompletionReason`，支持 `plan_exhausted / time_budget_reached / early_stop_low_signal / early_stop_high_confidence`
- 兼容层同步更新：
  - `packages/interview-engine/src/session-core.ts`
  - `apps/admin/src/lib/chat-session-runtime.ts`
  - `apps/web/src/app/chat/lib/chat-session-draft.ts`
  - `apps/web/src/lib/server/chat-session-model.ts`
  - `apps/web/src/lib/server/chat-session-ui-state.ts`
- Admin 观测面补充：
  - `session-planning-trace-card` 新增阶段、预算耗时、完成原因展示
- 回归测试补充：
  - `packages/interview-engine/src/index.test.ts`
  - `packages/interview-engine/src/interview-planning.test.ts`
  - `apps/web/src/lib/server/chat-session-ui-state.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无环境变量变更。
- 旧 runtime 读取路径已补默认值与类型兼容，不需要数据迁移脚本。

### 验证

- `pnpm exec vitest run packages/interview-engine/src/index.test.ts packages/interview-engine/src/interview-planning.test.ts apps/web/src/lib/server/chat-session-ui-state.test.ts`
- 完整仓库检查作为提交前基线继续执行。

### 下一步

- 下一阶段可继续把“时间预算”更深地接入开场文案、追问强度和最终报告总结，而不是只用于状态切换与提前结束。

## Iteration 4.90（2026-03-27）：补充模拟面试流程重构方案文档

### 目标

- 将下一阶段模拟面试重构方向正式沉淀为可执行设计，而不是继续停留在口头讨论。
- 统一明确开场、自我介绍、时间预算、问题来源、追问、评分和落地顺序。

### 主要改动

- 新增文档：
  - `docs/InterviewFlowRedesign.md`
- 文档内容覆盖：
  - 时间驱动的面试状态机
  - 自我介绍与自然开场策略
  - `standard / skill_probe / project_probe` 三类问题来源
  - 评估驱动的动态追问设计
  - 主问题 + 追问组成评估单元的统一评分方案
  - 分阶段落地计划（Phase 1 ~ Phase 4）
- 同步更新：
  - `docs/ProjectContext.md`
    - 补充该文档入口
    - 追加 2026-03-27 的关键决策摘要

### 迁移/破坏性变更

- 无代码变更。
- 无数据库变更。
- 当前仅完成设计收口与文档沉淀。

### 验证

- 后续以完整仓库检查通过为提交前基线。

### 下一步

- 进入 Phase 1：先重构开场与面试状态机，再落地结构化评估和动态追问，不建议一开始就同时改完整个出题与报告链路。

## Iteration 4.89（2026-03-26）：修复 Web E2E 在 CI 中缺少数据库依赖的问题

### 目标

- 修复 GitHub Actions 中 `web-e2e` job 的环境配置缺口，避免 Web 端 E2E 在接入游客持久化和额度逻辑后因缺少数据库而稳定失败。

### 主要改动

- 更新 `/.github/workflows/ci.yml`
  - 为 `web-e2e` job 补齐 `pgvector/pgvector:pg16` 数据库服务。
  - 为 `web-e2e` 注入 `DATABASE_URL`。
  - 在运行 Playwright 前新增 `pnpm db:migrate:deploy`。
- 根因说明：
  - Web 端当前在游客访问时会创建 `UserActor`、读取额度与会话记录，因此不再是“纯前端 mock UI”链路。
  - 原 `web-e2e` 仍沿用旧配置，没有数据库服务，导致 CI 中 Prisma 报 `P1001 Can't reach database server at 127.0.0.1:5432`。

### 迁移/破坏性变更

- 无业务代码变更。
- 无数据库 schema 新增，仅修正 CI 运行环境。

### 验证

- 本地已根据 GitHub Actions 失败日志完成根因定位。
- 后续以 GitHub Actions `web-e2e` job 重新运行通过作为最终验收。

### 下一步

- 后续凡是 Web E2E 覆盖到服务端持久化能力，都默认按“需要数据库”的前提维护 CI，而不是再假设 Web 端 smoke 只依赖 mock LLM。

## Iteration 4.88（2026-03-26）：抽离 Admin Trace 视图共享展示 helper

### 目标

- 收口 Admin 会话详情页三张 Trace 卡片中的重复展示逻辑，减少重复维护成本。
- 在不改动数据流和页面结构的前提下，抽出共享的“难度格式化 / 标签列表 / 空态卡片”能力。

### 主要改动

- 新增共享组件：
  - `apps/admin/src/components/session-trace-shared.tsx`
- 抽出的共享能力：
  - `formatInterviewLevel`
  - `renderTraceTagList`
  - `renderTraceNamedTagList`
  - `TraceEmptyCard`
- 应用到以下组件：
  - `apps/admin/src/components/session-planning-trace-card.tsx`
  - `apps/admin/src/components/session-execution-trace-card.tsx`
  - `apps/admin/src/components/session-report-trace-card.tsx`

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 无 UI 行为变更，仅重复展示逻辑抽离。

### 验证

- 定向校验通过：
  - 共享组件与三张 Trace 卡片的 ESLint
  - `apps/admin` TypeScript 检查

### 下一步

- 三张 Trace 卡片当前仍然偏大，但这轮已经先把最稳定的共享展示层抽出；后续如果继续拆，建议优先抽“折叠面板项构建函数”，而不是把 JSX 结构切得太碎。

## Iteration 4.86（2026-03-26）：清理临时文件，并拆分 chat-composer 组件

### 目标

- 在不影响现有功能和 UI 的前提下，做一轮低风险代码整理，降低聊天输入区组件的维护成本。
- 清理由本地 UI 对齐调试留下的无用截图文件，避免工作区继续堆积临时产物。

### 主要改动

- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 将原本混在主组件中的“快捷问题网格”和“额度按钮/弹层”拆出。
  - 主文件从 `288` 行收敛到 `173` 行，仅保留输入区主流程和表单交互。
- 新增：
  - `apps/web/src/app/chat/components/chat-composer-quick-prompts.tsx`
  - `apps/web/src/app/chat/components/chat-composer-usage.tsx`
- 删除本地临时截图产物：
  - 多个 `chat-* / current-* / reference-* / 基线对照-* / mianshitong-*` 调试 PNG
  - 这些文件不参与运行时、测试和文档引用

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 无 UI 行为变更，属于纯结构整理与临时文件清理。

### 验证

- `chat-composer` 拆分后的三个文件均通过独立 ESLint 校验。
- 后续将继续以完整项目检查作为提交前基线。

### 下一步

- 当前不继续硬拆 `use-chat-controller.ts`，因为它已经通过 `actions / effects / store / navigation / storage` 分层；再拆的收益暂时低于回归风险。

## Iteration 4.87（2026-03-26）：拆分 chat-general-policy 服务端策略模块

### 目标

- 将 Web 端普通聊天策略文件 `chat-general-policy.ts` 从超大单文件拆成按职责分层的多个纯模块。
- 在不改变现有行为的前提下，让“意图识别、prompt 指令、few-shot 示例、fallback 回复、Markdown 清理、类型定义”边界更清晰。

### 主要改动

- 新增策略模块：
  - `apps/web/src/lib/server/chat-general-policy.types.ts`
  - `apps/web/src/lib/server/chat-general-policy.constants.ts`
  - `apps/web/src/lib/server/chat-general-policy-intent.ts`
  - `apps/web/src/lib/server/chat-general-policy-instruction.ts`
  - `apps/web/src/lib/server/chat-general-policy-examples.ts`
  - `apps/web/src/lib/server/chat-general-policy-fallback.ts`
  - `apps/web/src/lib/server/chat-general-policy-format.ts`
  - `apps/web/src/lib/server/chat-general-policy-prompt.ts`
- 原入口文件：
  - `apps/web/src/lib/server/chat-general-policy.ts`
  - 现仅作为统一出口保留，负责 re-export，主文件体量已从超大单文件收口到 `15` 行。
- 这次拆分后的职责边界：
  - `intent`：意图识别与算术格式化
  - `instruction`：system 指令生成
  - `examples`：few-shot 示例
  - `prompt`：将指令/示例拼装进消息列表
  - `fallback`：兜底回复
  - `format`：Markdown 分割线清理

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 对外导出保持兼容，现有调用方无需改动 import 路径。

### 验证

- 定向测试通过：
  - `apps/web/src/lib/server/chat-general-policy.test.ts`
  - `apps/web/src/lib/server/chat-response-format.test.ts`
- 新模块通过独立 ESLint 校验。

### 下一步

- `chat-general-policy-examples.ts` 目前仍略大，但其主体是 few-shot 数据，不属于高耦合逻辑；当前不再为了“低于 200 行”机械拆分，避免把示例数据切得过碎。

## Iteration 4.83（2026-03-26）：将聊天页“回到底部”按钮位置对齐到既定产品基线

### 目标

- 修正聊天页长会话场景里“回到底部”按钮的垂直位置，使其贴近 footer 上沿，而不是悬在消息区中部。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`
  - 将“回到底部”按钮容器的底部偏移从大额 `pb-46/md:pb-42` 收敛为 `pb-4`。
  - 保留按钮的居中挂载方式、显隐逻辑和三段式骨架，不改动消息滚动模型。

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 仅聊天页“回到底部”按钮的视觉定位调整。

### 验证

- Playwright 对比参考页后确认：
  - 当前按钮底边到 footer 顶边间距为 `16px`；
  - 与既定产品基线实测间距一致。

### 下一步

- 如果后续继续收口聊天页细节，应继续通过实际坐标和滚动行为对比，不要再用经验值去猜按钮偏移。

## Iteration 4.84（2026-03-26）：为聊天消息列补齐底部显式 spacer

### 目标

- 让聊天区底部留白协议与既定产品基线保持一致，不再只依赖外层布局，而是在消息列末尾显式插入一个固定高度占位块。

### 主要改动

- `apps/web/src/app/chat/components/chat-message-list.tsx`
  - 在消息列末尾新增一个 `24px` 高宽的 shrink spacer（代码采用 canonical Tailwind 写法 `min-h-6 min-w-6 shrink-0`）。
  - 该 spacer 位于所有消息节点之后，作为消息区与输入区之间的稳定底部留白。

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 仅聊天消息列底部留白结构调整。

### 验证

- Playwright 复核确认：
  - 本地消息列最后一个子节点已为 `24px` 的 shrink spacer；
  - 结构和参考页一致。

### 下一步

- 如果后续继续调整输入区高度或 footer 间距，优先保留这类显式 spacer 协议，而不是把底部留白重新散落到多处 `padding-bottom`。

## Iteration 4.85（2026-03-26）：修正用户长消息气泡被横向撑满的问题

### 目标

- 修复用户发送长文本时，气泡被横向拉宽、文本像整行右对齐铺开的布局问题。
- 让用户气泡恢复为“整体右对齐，但气泡本身按最大宽度自然收缩，文本在气泡内正常换行”。

### 主要改动

- `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 用户消息外层容器改为 `ml-auto + items-end + sm:max-w-[80%]`，由容器承担右对齐与最大宽度约束。
  - 用户消息气泡去掉 `w-fit + text-right` 组合，改为 `max-w-full + self-end + text-left`。
  - 用户消息正文继续沿用项目内统一的 `wrap-break-word` 换行策略，避免超长词片段把气泡再次撑开。
- `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
  - 新增长用户消息 DOM 回归测试，锁定：
    - 气泡本身 `self-end`
    - 文本左对齐
    - 外层使用 `items-end`

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 仅用户消息气泡的宽度与文本排版策略调整。

### 验证

- 组件测试通过：
  - `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`

### 下一步

- 如果后续继续对齐聊天页视觉细节，用户气泡这层应继续遵守“容器负责右对齐，气泡负责自然收缩”的分工，不要再把 `fit-content` 和右对齐文本混在同一层。

## Iteration 4.82（2026-03-26）：将聊天页重构回严格的上中下三段式骨架

### 目标

- 按最新产品要求，把聊天页从“页面整体滚动 + 固定底栏浮层”改回“header / 可滚动消息区 / footer”三段式骨架。
- 让布局协议重新与既定产品交互基线对齐：页面本身不滚，中间消息区独立滚动，footer 在布局流中承载输入框。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`
  - 移除整页滚动和 `fixed` footer 方案。
  - 主内容区改为 `h-dvh + flex-col + overflow-hidden`。
  - 中间消息区维持 `relative flex-1 min-h-0`，footer 改为布局流里的 `sticky bottom-0` 区块。
- `apps/web/src/app/chat/components/chat-message-list.tsx`
  - 消息列表改回独立滚动容器：`absolute inset-0 overflow-y-auto`。
  - 移除旧的底部安全区 spacer 协议。
- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 去掉内部的宽度外壳，由父级 footer 统一承担宽度与定位。
- `apps/web/src/app/chat/components/chat-header.tsx`
  - header 改为固定高度的普通布局行，不再使用页面级 sticky。
- `apps/web/src/app/chat/components/chat-conversation-transition.tsx`
  - 过渡态同步切换为消息区内部滚动协议，避免切换会话时布局断层。

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 聊天页滚动模型从“浏览器页面滚动”切换回“中间消息区滚动”。

### 验证

- Playwright 复核确认：
  - 空态下页面为标准上中下布局。
  - footer 不再是脱离布局流的全局 `fixed` 浮层。
  - 中间消息区存在独立的 `overflow-y-auto` 滚动容器，页面整体高度保持在视口内。

### 下一步

- 后续聊天页若继续调视觉细节，应优先在这套三段式骨架上做样式收口，不要再把滚动责任切回浏览器页面。

## Iteration 4.80（2026-03-26）：收敛聊天表格冗余操作，并延后 AI 消息反馈入口显示时机

### 目标

- 移除聊天表格顶部的复制/下载按钮，减少无必要的操作噪音。
- 修复 AI 流式生成过程中，复制/点赞/点踩按钮过早出现的交互问题。

### 主要改动

- `apps/web/src/app/chat/components/chat-table-block.tsx`
  - 删除表格顶部的复制与下载操作区，仅保留表格容器和横向滚动能力。
- `apps/web/src/app/chat/components/chat-message-list.tsx`
  - 为最后一条正在流式生成的 assistant 消息补充 `isStreaming` 判定并下发给消息项。
- `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 将 assistant 消息动作区显示条件从“非 loading”收紧为“非 loading、非编辑、非流式生成中”。
- `apps/web/src/app/chat/components/chat-table-block.dom.test.tsx`
  - 调整为校验表格正常渲染且不再出现复制/下载按钮。
- `apps/web/src/app/chat/components/chat-message-item.dom.test.tsx`
  - 新增 DOM 回归测试，覆盖：
    - assistant 消息生成中不显示复制/反馈按钮
    - assistant 消息生成完成后才显示复制/反馈按钮

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 聊天表格交互从“可复制/下载”收敛为纯展示。

### 验证

- 组件测试通过：
  - `chat-table-block.dom.test.tsx`
  - `chat-message-item.dom.test.tsx`

### 下一步

- 若后续确实需要导出能力，建议优先做“整条回答复制”或“代码块局部复制”，不要把表格单独导出入口重新塞回主阅读流中。

## Iteration 4.81（2026-03-26）：修复历史会话切换后未自动定位到底部的问题

### 目标

- 修复从 `/chat` 空页直接点击历史会话时，长会话不会自动滚动到最新消息位置的问题。
- 同时覆盖“远端会话异步加载完成后再渲染”和“已缓存会话立即切换”两类链路。

### 主要改动

- `apps/web/src/app/chat/hooks/use-auto-scroll.ts`
  - 为“会话切换后的首次滚底”新增显式待执行状态，不再只依赖一次性的 session change effect。
  - 当会话真正可见后，会通过“立即执行 + 双 `requestAnimationFrame` + 短延时补滚”的方式连续尝试滚到底部，避免被异步渲染、固定底栏测量或后续 DOM 高度变化覆盖。
  - 原有发送消息、普通流式追踪、用户手动脱离底部等逻辑保持不变。
- `apps/web/src/app/chat/hooks/use-auto-scroll.dom.test.ts`
  - 新增 DOM 回归测试，覆盖：
    - 远端会话加载完成后自动滚到底部
    - 直接切到已缓存会话时自动滚到底部

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 仅聊天页会话切换后的滚动时机增强。

### 验证

- Hook DOM 测试通过：
  - `use-auto-scroll.dom.test.ts`

### 下一步

- 后续如果聊天页继续引入图片、富媒体卡片或更复杂的异步块级内容，优先沿用这条“会话切换待执行滚底 + 多阶段补滚”策略，不要把滚动职责分散到页面层。

## Iteration 4.79（2026-03-26）：聊天消息区改为按底栏真实高度预留安全区

### 目标

- 修复聊天页长会话场景下“最后一段消息被底部输入区遮住”的回归问题。
- 保留浏览器右侧滚动条，不回退到内部滚动容器，也不再依赖固定 `pb-*` 常量猜测底部留白。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`
  - 为底部固定输入区增加真实高度测量，使用 `useLayoutEffect + ResizeObserver` 监听高度变化。
  - 将测量到的底栏高度加上额外安全间距后，下发给消息列表作为底部安全区。
- `apps/web/src/app/chat/components/chat-message-list.tsx`
  - 移除消息列固定底部 padding。
  - 改为在消息列表底部追加动态 spacer，保证最后一条消息、反馈按钮等内容不会被输入区覆盖。
- `apps/web/src/app/chat/components/chat-layout.ts`
  - 将消息列基础布局与底部安全区常量拆开，保留 SSR 首屏 fallback 高度，避免首屏闪动过大。

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 仅聊天页消息区与底栏的布局协作方式调整。

### 验证

- Playwright 实测确认：
  - 长会话滚到底部后，最后一条消息不再被输入区遮挡。
  - 输入区仍固定在视口底部，浏览器右侧滚动条继续生效。
  - 与既定交互基线相比，最后一条消息与输入区之间保留了稳定安全间距。

### 下一步

- 后续如果继续调输入区样式或加入新提示条，应继续沿用“测量底栏真实高度 -> 同步消息区安全区”的方式，不要再回到固定 `padding-bottom`。

## Iteration 4.78（2026-03-26）：将聊天输入区固定到底部，兼容浏览器级滚动

### 目标

- 继续修复聊天页输入区在长内容场景下被正文流挤出视口的问题。
- 保留浏览器右侧滚动条，不退回到内部消息容器滚动。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`
  - 将输入区外层从 `sticky` 收敛为 `fixed bottom-0`
  - 根据侧边栏状态增加桌面端左侧偏移，避免固定输入区压到侧边栏
- `apps/web/src/app/chat/components/chat-layout.ts`
  - 为消息列增加额外底部留白，避免最后一条消息被底部固定输入区遮挡

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 仅聊天页底部输入区定位策略调整。

### 验证

- Playwright 实测确认：
  - 空会话下输入框在首屏可见
  - 人工拉高消息区内容并滚动页面后，输入框仍保持在视口底部可见
  - `document.body.scrollHeight` 仍正常增长，浏览器右侧滚动条继续生效

### 下一步

- 后续如需再调聊天页 UI，应继续避免改动滚动骨架；输入区、额度入口、快捷提示等能力优先在固定底栏内部做增量调整。

## Iteration 4.77（2026-03-26）：恢复聊天页稳定布局，撤销内部滚动回归

### 目标

- 修复聊天页最近一轮样式调整后出现的两个回归：
  - 输入框区域观感被破坏
  - 聊天内容重新退化成内部滚动，而不是浏览器右侧滚动条

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`
  - 移除会锁死页面高度的 `overflow-hidden`
  - 将主内容容器从 `h-dvh` 改回 `min-h-svh`，允许页面高度随消息内容自然增长
- `apps/web/src/app/chat/components/chat-message-list.tsx`
  - 移除消息区 `overflow-y-auto`，不再把聊天列表作为内部滚动容器
- `apps/web/src/app/chat/components/chat-conversation-transition.tsx`
  - 同步移除过渡态内部滚动，避免切会话时布局协议不一致
- `apps/web/src/app/chat/hooks/use-auto-scroll.ts`
  - 自动滚底逻辑从“仅支持内部容器滚动”改为“优先容器、否则退回浏览器页面滚动”
  - 保留原有回到底部与发送时自动滚底行为
- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 恢复输入框表单的稳定尺寸和内边距
  - 保留额度按钮，但不再用更激进的表单布局改动去挤压输入区

### 迁移/破坏性变更

- 无数据库变更。
- 无 API 协议变更。
- 仅聊天页布局与滚动策略修复。

### 验证

- Playwright 实测确认：
  - 输入框重新稳定可见
  - 聊天消息区不再存在独立的 `overflow-y-auto` 滚动容器
  - 临时拉高内容后，`document.body.scrollHeight` 可正常超过视口高度，由浏览器右侧滚动条接管滚动

### 下一步

- 后续聊天页的 UI 增强，应尽量避免继续改动页面骨架；优先通过独立子组件增强能力，减少再次把滚动和输入区布局带坏。

## Iteration 4.76（2026-03-26）：聊天表格补齐复制/下载操作，并收敛首列宽度

### 目标

- 让聊天区 Markdown 表格具备“复制表格/下载表格”操作，补齐与既定交互基线一致的可操作性。
- 解决表格首列视觉过宽问题，避免第一列挤占可读空间。

### 主要改动

- `apps/web/src/app/chat/components/chat-table-block.tsx`
  - 新增独立表格渲染组件，统一承接：
    - 表格容器结构（操作区 + 横向滚动区）
    - 复制表格（复制 Markdown）
    - 下载表格（导出 `table.md`）
  - 按钮状态支持短暂反馈（`已复制表格` / `已下载表格`）。
- `apps/web/src/app/chat/components/chat-markdown.tsx`
  - 将 `react-markdown` 的 `table/thead/tbody/tr/th/td` 渲染切换为自定义组件映射。
  - 表格布局调整为固定列布局，并给首列增加 `22%` 宽度约束，缓解首列过宽。
  - 移除旧的全局 `[&_table]` 选择器样式，改为标签级渲染样式，减少样式冲突。
- `apps/web/src/app/chat/components/chat-table-block.dom.test.tsx`
  - 新增 DOM 回归测试，覆盖：
    - 复制/下载按钮存在性
    - 复制动作写入剪贴板
    - 下载动作触发文件导出

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无 API 协议变更。
- 仅聊天区表格渲染与交互增强。

### 验证

- 组件测试：`chat-table-block.dom.test.tsx` 通过。
- Playwright 实测：
  - 表格操作按钮可见并可点击，下载实际触发 `table.md` 导出。
  - 复制按钮可进入“已复制表格”状态。
  - 首列表头宽度占比约 `0.22`，不再出现首列明显偏宽。

### 下一步

- 若后续要进一步贴近基线，可继续补“表格 hover/焦点态细节”和“复杂长表格滚动阴影提示”。

## Iteration 4.75（2026-03-26）：修复 Markdown 标题与表格在聊天区“可渲染但不可读”的样式问题

### 目标

- 解决技术问答内容里 `h2/h3` 与对比表格“结构已渲染但视觉层级不明显”的问题。
- 让聊天区 Markdown 呈现和既定产品交互基线在标题层级、表格边框与单元格间距上保持一致。

### 主要改动

- `apps/web/src/app/chat/components/chat-markdown.tsx`
  - 为 Markdown 容器补齐标题样式：
    - `h2`: `24px / 600 / mt-6 / mb-2`
    - `h3`: `20px / 600 / mt-6 / mb-2`
    - 同时补齐 `h1/h4` 的层级样式，避免模型偶发输出时退回默认样式。
  - 补齐表格样式：
    - `table` 增加边框、折叠布局和间距
    - `th/td` 增加 `8px 16px` 内边距
    - `thead/tr` 增加背景与分隔线
  - 同步补充 `blockquote/li` 的基础可读性样式，保证技术回答中的引用和列表层次稳定可见。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无 API 协议变更。
- 仅聊天消息 Markdown 呈现样式变化，不影响消息内容与存储结构。

### 验证

- 使用 Playwright 对比本地与既定产品交互基线同题回答的计算样式：
  - `h2` 从 `14px/400` 修复为 `24px/600`
  - `table` 边框恢复可见
  - `th/td` 内边距恢复为 `8px 16px`
- 验证后本地消息中 `h2`、表格已经达到目标视觉层级，可直接识别结构。

### 下一步

- 若后续还需继续贴近交互基线，可再补“表格暗色主题细节（行 hover / 分隔线对比度）”和“代码块与正文行距统一性”。

## Iteration 4.74（2026-03-26）：为普通技术问答补齐结构化意图与分层输出

### 目标

- 解决 Web 端普通技术问答“格式偏平、标题层级弱、面试导向不足”的问题。
- 让技术解释类问题更稳定地输出 `H2/H3 + 示例 + 常见追问/误区 + 收口引导`，而不是继续被通用聊天策略压平成短段落。

### 主要改动

- `apps/web/src/lib/server/chat-general-policy.ts`
  - 为普通聊天新增 `technical_question` 意图，并细分三种技术问答风格：
    - `concept`
    - `mechanism`
    - `comparison`
  - 新增低成本规则识别，当前可识别：
    - 概念题，如 `JS闭包是什么`
    - 机制题，如 `事件循环是什么`
    - 对比题，如 `React useMemo 和 useCallback 的区别`
  - 调整全局系统策略：
    - 普通闲聊仍保持轻量排版
    - 技术问答允许使用必要的二、三级标题
    - 明确禁止 H1、emoji 标题、Markdown 分割线和 mermaid 图
  - 为技术问答新增专属 system instruction 与最小 few-shot，明确要求按以下结构回答：
    - 概念题：`定义 / 核心特点 / 示例 / 常见误区或面试追问 / 一句话总结`
    - 机制题：`核心结论 / 执行流程或工作原理 / 示例 / 常见追问 / 面试回答建议`
    - 对比题：`一句话区别 / 核心差异 / 什么时候用 / 示例 / 面试里怎么回答`
  - 新增技术问答失败兜底文案，保证模型主链路不可用时仍能给出结构化引导，而不是直接退回报错或泛泛回复。
- `apps/web/src/lib/server/chat-general-policy.test.ts`
  - 新增技术问答意图识别测试
  - 新增技术问答专属 instruction / few-shot 注入测试
  - 新增技术问答兜底回复结构测试

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无 API 协议字段变更。
- 普通聊天中的“技术解释类问题”回复风格已变化，后续如果要继续调优，应优先改技术意图 prompt 和 few-shot，而不是重新加重全局聊天策略。

### 验证

- 已通过 `vitest` 验证技术问答意图识别、结构化指令注入与兜底回复。
- 已使用 Playwright 本地抽查真实页面，确认：
  - `React useMemo 和 useCallback 的区别` 现会输出 `H2` 级标题、示例和常见误区/面试追问
  - `事件循环是什么` 现会输出 `核心结论 / 执行流程 / 示例 / 常见追问 / 面试回答建议`
  - 输出中未再出现本轮重点规避的分割线与 emoji 标题

### 下一步

- 如果后续还要继续对齐更成熟的技术助手体验，优先补“技术追问链路”和“技术题回答版本切换（简版 / 面试版 / 实战版）”，不要继续用全局 prompt 去硬压所有普通聊天。

## Iteration 4.73（2026-03-26）：补齐 Web 端高频入口的真实 AI 主路径 E2E 防回归

### 目标

- 补一条浏览器级回归测试，明确卡住“高频入口必须走真实 AI 主路径，不能退化回固定模板兜底”。
- 顺手把 Web 端旧的 IndexedDB 游客伪链路 E2E 辅助函数迁到当前真实服务端会话接口。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - 新增仅供测试环境使用的 `mock` 流式 provider
  - 当 `LLM_PROVIDER=mock` 时，普通聊天主路径会返回基于用户最后一条消息生成的流式内容，避免 E2E 再依赖浏览器层伪造聊天接口
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - 新增 `mock` provider 回归测试，确保它能稳定输出基于用户消息的流式回复
- `playwright.config.ts`
  - Web E2E 启动 `pnpm dev:web` 时，显式注入 `LLM_PROVIDER=mock`
  - 让浏览器测试命中真实页面、真实服务端路由，但不会依赖外部模型服务
- `apps/web/e2e/support/chat-e2e-fixtures.ts`
  - 删除旧的 IndexedDB 造会话 helper
  - 改为通过 `Page.request` 直接调用 `/api/chat/sessions` 与 `/api/chat/sessions/:id/messages/stream` 创建真实远端会话
- `apps/web/e2e/chat-smoke.spec.ts`
  - 首条 smoke 现会同时断言：
    - 预设问题点击后确实请求了真实流式接口
    - 请求体包含正确的 `content / modelId`
    - 页面最终展示的是 `mock` provider 输出，而不是简历优化兜底模板
  - 其余会话切换、删除、复制、点赞/点踩用例也统一迁到真实服务端会话数据

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无线上运行逻辑变更。
- `LLM_PROVIDER=mock` 仅在 Playwright Web E2E 的本地测试服务器命令里启用，不会影响正常开发和生产环境。

### 验证

- 新增单元测试覆盖 `mock` stream provider。
- Web E2E smoke 已改为走当前真实会话接口，而不是旧游客本地存储链路。

### 下一步

- 如果后续还要继续加这类产品行为回归，优先沿用“服务端 mock provider + 浏览器真实链路”模式，不要再回退到前端直接 mock 整个聊天接口。

## Iteration 4.71（2026-03-26）：普通聊天改为意图提示词驱动的真实 AI 流式回复

### 目标

- 解决“高频入口像固定模板直吐、打字效果不像真实 AI”的产品割裂问题。
- 将普通聊天高频入口从“模板主路径”切换为“意图识别 + AI 实时生成”为主，固定模板只保留为兜底。

### 主要改动

- `apps/web/src/lib/server/chat-general-policy.ts`
  - 新增 `GeneralChatIntent` 结构，统一描述：
    - 问候语
    - 简历优化入口
    - 简单算术轻度跑题
    - 自我介绍
    - 项目亮点提炼
  - 原先直接返回完整模板文案的逻辑，改为：
    - `resolveGeneralChatIntent()` 负责识别意图
    - `prependGeneralChatIntentInstruction()` 负责向模型注入意图专属 system 指令
    - `buildGeneralChatFallbackReply()` 仅在主链路失败时兜底
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - `toChatTurns()` 支持接收普通聊天意图，并把意图专属 system 指令叠加到通用产品策略之前
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 普通聊天不再命中固定模板直出，而是默认走真实模型流式
  - 若模型主链路在高频入口场景下失败，才退回到模板兜底回复
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - 编辑重答链路同步切到“AI 主路径 + 模板兜底”
- `apps/web/src/lib/server/chat-general-policy.test.ts`
  - 回归测试从“模板直出文案”改为验证：
    - 意图识别
    - 意图专属 system 指令注入
    - 兜底回复生成

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无 API 协议字段变更。
- 普通聊天高频入口的回复来源已变化：
  - 主路径现在来自真实模型生成
  - 固定模板仅在主路径不可用时兜底

### 验证

- 已通过外部行为调研确认：
  - 预置项点击会触发后台聊天接口
  - 相同问题重复发送时，回复文案存在明显差异
  - 这更接近“模型生成 + 强意图约束”，而不是单一固定模板
- 已补充本地单元测试，确保意图识别与兜底逻辑可回归

### 下一步

- 后续如果还要继续贴近成熟产品体验，优先补强“意图专属 few-shot 示例”，而不是继续打磨固定模板的假流式节奏。

## Iteration 4.72（2026-03-26）：为高频意图补充最小 few-shot 示例

### 目标

- 在普通聊天已切回真实 AI 流式的基础上，继续收紧高频入口回复的稳定性。
- 用最小 token 成本为高频意图补充 few-shot，减少模型回复风格漂移。

### 主要改动

- `apps/web/src/lib/server/chat-general-policy.ts`
  - 为以下意图各补充 1 组最小 few-shot：
    - 问候语
    - 简历优化入口
    - 简单算术轻度跑题
    - 自我介绍
    - 项目亮点提炼
  - few-shot 与意图专属 system 指令共同注入到普通聊天上下文中
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - 调整普通聊天上下文拼接顺序，明确为：
    - 通用系统策略
    - 意图专属 system 指令
    - few-shot 示例
    - 历史消息
- `apps/web/src/lib/server/chat-general-policy.test.ts`
  - 新增 few-shot 注入断言，防止后续被改回只剩 system 指令

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无 API 协议字段变更。
- 普通聊天高频入口的上下文 token 数会小幅增加，但换来更稳定的产品风格。

### 验证

- 已补充单元测试，验证意图 system 指令和对应 few-shot 会一起注入上下文。

### 下一步

- 若后续还要继续增强普通聊天稳定性，建议优先微调 few-shot 内容本身，而不是继续无上限堆 system prompt。

## Iteration 4.69（2026-03-26）：清理仓库中的具体竞品名称痕迹

### 目标

- 清理仓库内直接出现的具体竞品名称，避免在文档、词典或临时素材中暴露对照来源。
- 保留必要的设计演进信息，但将表述统一收口为中性的“既定产品基线 / 既定产品交互基线”。

### 主要改动

- `docs/ProjectContext.md`
  - 将历史记录中的具体竞品名称替换为中性基线表述
- `docs/IterationLog.md`
  - 同步替换迭代记录中的具体竞品名称与直接链接
- `cspell.json`
  - 移除不再需要的竞品专有词
- 删除 3 张本地临时参考截图。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无运行时代码逻辑变更。
- 仅清理仓库文字痕迹与临时素材。

### 验证

- 已全仓搜索确认仓库内无已清理的具体竞品名称残留。

### 下一步

- 后续新增文档、截图、测试记录时，继续统一使用中性表述，不再写入具体竞品名称。

## Iteration 4.70（2026-03-26）：让普通聊天模板回复也走流式与额度扣减

### 目标

- 修正普通聊天高频模板回复的产品行为，使其不再表现为“一次性吐出整段固定文案”。
- 统一用户心智：无论是预置问题、简单算术问题，还是其他普通聊天消息，只要进入回复链路，都应表现为流式输出并计入当日额度。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`
  - 新增模板回复分片工具，将整段文本切成多个 `delta`
  - 新增模板回复流式发送 helper，带轻量节奏控制，确保前端能看到连续增量输出，而不是单次完整落地
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 普通聊天短路回复改为先扣额度，再走分片 SSE 输出
  - 若短路回复在真正输出前失败，会回滚当次额度
  - 若输出过程中中断，则沿用普通流式链路的思路，尽量保留已生成的部分内容
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - 编辑重答链路同步收敛到同一套短路流式与额度逻辑
- 新增回归测试：
  - `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.test.ts`
  - 覆盖模板回复分片后的无损还原与换行结构保留

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无 API 协议字段变更。
- 但普通聊天模板回复的运行行为已变化：
  - 现在会消耗每日额度
  - 现在会通过多个 `delta` 流式返回

### 验证

- 已通过代码检查确认：
  - 模板短路分支不再一次性发送完整 `delta`
  - 模板短路分支已纳入 `consumeChatUsage()` / `rollbackChatUsage()` 口径
- 已补充纯函数回归测试，防止后续把流式分片退化回单次整包输出

### 下一步

- 如果后续还要继续增强普通聊天的“打字机体感”，优先调节分片节奏和粒度，而不是重新把模板回复塞回前端本地模拟。

## Iteration 4.68（2026-03-26）：继续收紧普通聊天入口模板的产品感

### 目标

- 基于 Playwright 对 `既定产品交互基线` 的真实对照，再把普通聊天里的“问候语”和“自我介绍入口”往产品助手风格收一层。
- 让首轮回复在“权威感、领域边界、下一步引导”上更接近成熟的 AI 面试产品。

### 主要改动

- `apps/web/src/lib/server/chat-general-policy.ts`
  - 问候语模板改为更明确的“资深程序员 + 前端 AI 面试官”身份表述
  - 问候语补充“简历文本直接粘贴即可”的行动引导，减少用户在上传方式上的犹豫
  - “前端面试时，如何正确的自我介绍”模板改为混合式回复：
    - 先索取用户的求职状态 / 目标岗位级别 / 年限与技术栈
    - 再给一版可直接使用的 3 段式通用结构
- `apps/web/src/lib/server/chat-general-policy.test.ts`
  - 同步补齐上述模板行为断言，避免回归

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- 仅收紧普通聊天高频入口模板文案与引导策略。

### 验证

- 已通过 Playwright 对照验证：
  - `既定产品交互基线`
  - `http://127.0.0.1:3000/chat`
- 重点核对场景：
  - `你好`
  - `可以帮我优化简历吗？`
  - `前端面试时，如何正确的自我介绍`
  - `1+2等于几？`

### 下一步

- 如果后续还要继续对齐 `既定产品基线`，优先继续补“项目亮点提炼 / 简历改写 / 面试复盘”这几类入口模板，而不是一开始就无限扩 prompt。

## Iteration 4.67（2026-03-26）：引入 Web 端通用回复策略，对齐 既定产品基线 的产品化回答

### 目标

- 收紧 Web 端普通聊天回复的产品风格，让它更像“前端 AI 面试官”，而不是通用聊天机器人。
- 对齐 `既定产品基线` 在几个高频场景下的观感：
  - 简历优化入口先索取简历正文
  - 简单算术题先回答，再轻量回拉到主域
  - 问候语回复直接介绍能力边界
  - 尽量不输出横线分割

### 主要改动

- 新增 `apps/web/src/lib/server/chat-general-policy.ts`
  - 增加普通聊天的系统策略提示词，明确：
    - 前端面试官 / 简历优化助手角色
    - 非领域问题的“简答 + 回拉”策略
    - 缺少简历正文时先索取内容
    - 禁止使用 Markdown 分割线
  - 新增高频短路回复能力：
    - 新会话问候语
    - 简历优化入口
    - 简单算术问题
    - 自我介绍问题
    - 项目亮点提炼问题
  - 新增横线分割清洗逻辑，保留代码块内容不受影响
- `apps/web/src/lib/server/chat-response-format.ts`
  - 普通聊天的 system prompt 改为接入新的通用回复策略
  - `normalizeAssistantMarkdown()` 增加对分割线的兜底清理
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 普通聊天链路新增高频模板短路
  - 命中短路时直接走同一条 SSE 返回流程并落库，不再调用模型
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`
  - 编辑重答链路同步接入高频模板短路
- 新增回归测试：
  - `apps/web/src/lib/server/chat-general-policy.test.ts`
  - 覆盖问候语、简历优化、算术回拉、自我介绍、项目亮点和分割线清洗
- 使用 Playwright 对比验证：
  - `既定产品交互基线`
  - `http://127.0.0.1:3000/chat`
  - 已手动确认本地两条关键链路：
    - `可以帮我优化简历吗？`
    - `1+2等于几？`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- 仅收紧 Web 端普通聊天回复策略与输出风格。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 后续如果还要继续贴近 `既定产品基线`，建议继续补：
  - 更细的意图分类
  - 更多高频入口模板
  - “产品感”专项 eval，而不是只看技术正确性

## Iteration 4.66（2026-03-26）：统一后台筛选按钮为尾部图标交互

### 目标

- 收紧后台列表页筛选按钮样式，让“筛选”按钮本身更统一、更克制。
- 满足新的交互要求：
  - 图标放在按钮最后面
  - 有筛选条件时，hover 尾部筛选图标替换为清空图标
  - 点击尾部清空图标快速清空条件，同时不丢失按钮主体打开 Drawer 的入口

### 主要改动

- 新增 `apps/admin/src/components/admin-filter-action-button.tsx`
  - 抽出后台通用筛选按钮组件
  - 按钮主体始终负责打开 Drawer
  - 尾部图标默认显示筛选图标
  - 当存在筛选条件且 hover 时，尾部图标替换为清空图标
  - 点击尾部清空图标时会阻止冒泡，只执行清空，不会误打开 Drawer
- `apps/admin/src/components/sessions-filter.tsx`
  - 替换原先“按钮 + 额外浮层清空按钮”实现
  - 统一接入新的尾部图标筛选按钮
- `apps/admin/src/components/questions-filter.tsx`
  - 同步接入新的尾部图标筛选按钮

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- 仅调整 Admin 会话管理页、题库管理页的筛选按钮交互样式。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如果后续用户管理、日志管理等列表页也改成 Drawer 高级筛选，可以直接复用这一按钮组件，避免继续出现样式漂移。

## Iteration 4.65（2026-03-26）：题库管理筛选重构为标题搜索 + Drawer

### 目标

- 让题库管理页与会话管理页保持一致的筛选交互范式，避免列表页顶部继续堆积 inline 表单控件。
- 明确题库页的主搜索意图为“按标题搜索”，而不是继续混用全文关键词筛选。

### 主要改动

- `apps/admin/src/components/questions-filter.tsx`
  - 重构为“标题搜索框 + 筛选按钮”布局
  - 标题搜索改为 `300ms` 防抖实时筛选
  - 高级筛选统一收进右侧 Drawer
  - Drawer 中当前支持：
    - 标签
    - 难度
    - 状态
  - Drawer 右上角关闭图标移除，仅保留“取消 / 确定”和点击蒙层关闭
  - 在存在筛选条件时，顶部“筛选”按钮 hover 会显示尾部清空图标，可一键清空标题与全部高级筛选
  - 采用与会话筛选一致的表单同步边界：
    - `Form initialValues`
    - Drawer 打开后再 `setFieldsValue`
- `apps/admin/src/app/questions/page.tsx`
  - 服务端主查询参数从旧 `keyword` 语义收敛为 `title`
  - 标题筛选现在只匹配 `QuestionBankItem.title`
  - 旧 `keyword` / `topic` 仍保留兼容读取，避免历史链接立刻失效
  - 分页透传新的 `title / tags / level / status` 参数

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- 题库管理页的筛选交互从 inline 表单改为“标题搜索 + Drawer 高级筛选”。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如果后续题库维度继续增加，可继续往 Drawer 里扩展，不需要再挤压列表页顶部空间。

## Iteration 4.64（2026-03-26）：修复会话筛选 Drawer 的 Form 告警与 hydration 回归

### 目标

- 修复 Admin 会话管理页在筛选 Drawer 上同时出现的两个前端问题：
  - `Form.useForm()` 未连接 `Form` 的控制台告警
  - 为消除告警临时加入 `forceRender` 后导致的 hydration mismatch

### 主要改动

- `apps/admin/src/components/sessions-filter.tsx`
  - 移除 `Drawer forceRender`
  - `Form` 改为通过 `initialValues` 提供首次打开时的默认值
  - 表单值同步逻辑改为“仅在 Drawer 打开后执行 `form.setFieldsValue`”
  - “清空所有筛选条件”不再在 Drawer 关闭态下直接操作 `form` 实例，避免再次触发未挂载告警

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- 仅修正 Admin 会话管理页前端渲染行为。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 当前 Drawer + Form 的同步边界已经稳定；后续如果后台其他页也采用同类“抽屉表单”结构，应沿用“打开后同步值”的模式，而不是优先使用 `forceRender`。

## Iteration 4.63（2026-03-26）：收紧会话筛选 Drawer 关闭入口并补齐一键清空

### 目标

- 去掉会话筛选 Drawer 右上角冗余的关闭图标，统一收口到“取消”按钮和点击蒙层关闭。
- 在筛选已生效时，为顶部“筛选”按钮补一个更轻量的一键清空入口，减少反复打开 Drawer 还原条件的操作成本。

### 主要改动

- `apps/admin/src/components/sessions-filter.tsx`
  - `Drawer` 显式设置 `closeIcon={false}`，移除右上角关闭图标
  - `Drawer` 补充 `forceRender`，避免 `Form.useForm()` 创建的实例在抽屉首次打开前未挂载而触发 Ant Design 控制台告警
  - “筛选”按钮在存在任意生效条件时，hover 后会在按钮尾部显示清空图标
  - 点击尾部清空图标后会一次性清空：
    - 标题搜索
    - 用户 ID
    - 用户名 / 邮箱
    - 用户类型
    - 会话状态
    - 更新时间范围
  - 清空后通过 `router.replace` 回到第一页，避免旧分页参数残留

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- 仅调整 Admin 会话管理页筛选交互细节。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如果后续还要继续细化筛选体验，可以再补“快捷时间范围”和“筛选条件摘要”，但当前这一版已经把高频清空动作收口了。

## Iteration 4.62（2026-03-26）：重构会话管理筛选交互为搜索框 + Drawer

### 目标

- 避免会话管理页顶部堆积过多 inline 筛选控件，为后续扩展更多筛选维度预留空间。
- 按新的交互方案支持：
  - 标题实时搜索
  - Drawer 高级筛选
  - 会话状态筛选
  - 时间范围筛选

### 主要改动

- `apps/admin/src/components/sessions-filter.tsx`
  - 重构为“标题搜索框 + 筛选按钮”主布局
  - 标题搜索改为输入即筛选，使用 `300ms` 防抖，并通过 `router.replace` 避免产生过多历史记录
  - 点击“筛选”后从右侧打开 Drawer
  - Drawer header 为左对齐“筛选”
  - Drawer footer 只保留：
    - `取消`
    - `确定`
  - Drawer 内筛选项改为纵向排列，当前支持：
    - 用户 ID
    - 用户名 / 邮箱
    - 用户类型
    - 会话状态
    - 更新时间范围
  - 新增高级筛选计数，筛选按钮在存在条件时展示 `筛选（N）`
- `apps/admin/src/app/sessions/page.tsx`
  - 新增服务端参数解析：
    - `status`
    - `updatedFrom`
    - `updatedTo`
  - 增加白名单归一化：
    - `actorType`
    - `status`
    - 日期字符串
  - Prisma 查询新增：
    - `status` 精确过滤
    - `updatedAt` 时间范围过滤
  - 分页透传新增的筛选参数，保证翻页后条件不丢失
- `apps/admin/package.json`
  - 显式补充 `dayjs`
  - 用于稳定处理 antd `RangePicker` 的初始值与提交值

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- Admin 会话管理页的筛选交互从“全部 inline 表单”改为“标题搜索 + Drawer 高级筛选”。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 若后续筛选条件继续增加，可在 Drawer 中继续扩展，而无需再挤压列表页顶部空间；当前结构已经适合作为后台列表页通用筛选范式。

## Iteration 4.61（2026-03-26）：会话管理支持按用户类型筛选

### 目标

- 为 Admin 会话管理页补齐“按用户类型筛选”的能力，支持快速区分访客会话和注册用户会话。

### 主要改动

- `apps/admin/src/components/sessions-filter.tsx`
  - 新增“用户类型”下拉筛选
  - 支持：
    - 全部用户
    - 访客
    - 注册用户
  - 筛选参数会和已有的 `userId / 用户名 / 会话标题` 一起联动提交
- `apps/admin/src/app/sessions/page.tsx`
  - 新增 `actorType` 查询参数解析
  - 增加 `normalizeActorType()`，只接受：
    - `guest`
    - `registered`
  - 服务端 Prisma 查询新增 `actor.type` 过滤条件
  - 分页组件透传 `actorType`，保证翻页后筛选条件不丢失

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- 仅扩展 Admin 会话管理页的筛选参数与查询条件。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如后续需要更强的后台检索能力，可继续补“按会话状态”或“按时间范围”筛选，但当前 MVP 已覆盖最关键的身份维度。

## Iteration 4.60（2026-03-26）：对齐聊天页额度按钮位置与弹层样式

### 目标

- 修正 Web 聊天页“次数查询”入口位置不对的问题。
- 参考 `既定产品交互基线`，将额度触发器从输入框底部工具栏迁移到输入框右上角，并同步收紧弹层样式。

### 主要改动

- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 新增 `UsageTriggerIcon`
  - 额度入口从底部工具栏移到输入框右上角
  - 入口 UI 由百分比 pill 改为 `28x28` 的环形进度按钮
  - 输入框增加右侧留白，避免文字与额度按钮重叠
  - 底部工具栏仅保留模型选择器与发送按钮
  - 额度弹层收紧为更接近参考页的小尺寸卡片：
    - `align="end"`
    - `side="top"`
    - 更轻的圆角、阴影和间距
  - 环形按钮改为与参考页同结构的双圆 SVG：
    - 外圈为低透明度底环
    - 内圈按 `used / max` 比例递进填充
    - 额度耗尽时整圈填满
- 使用 Playwright 对比了：
  - `既定产品交互基线`
  - `http://127.0.0.1:3000/chat`
  - 重点校验输入区结构、触发器锚点和弹层相对位置

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- 仅调整聊天输入区前端 UI 结构与样式。

### 验证

- 已执行：
  - Playwright 视觉对比验证
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 若后续还要继续贴近参考产品，可再单独微调输入框圆角、阴影和发送按钮底部留白，但当前结构已经对齐到同一布局语义。

## Iteration 4.59（2026-03-26）：清理游客旧本地会话残留命名与无用模块

### 目标

- 把 Web 聊天链路里最后残留的 `local` 命名从生产代码中移除，避免与当前“服务端匿名身份 + 服务端会话”架构继续冲突。
- 删除已经没有真实运行价值的 IndexedDB 本地会话模块，降低后续维护噪音。

### 主要改动

- `apps/web/src/app/chat/lib/chat-session-draft.ts`
  - 将原 `chat-local-session.ts` 重命名为中性 helper
  - `createDraftLocalSession` 改为 `createDraftChatSession`
  - 保留草稿会话构造、消息构造、标题派生、流式上下文转换等测试基线能力
- `apps/web/src/app/chat/hooks/use-chat-controller.ts`
  - 乐观创建会话改为依赖 `createDraftChatSession`
  - 生产链路不再引用任何 `chat-local-*` 文件
- `apps/web/src/app/chat/lib/chat-message-mutations.ts`
  - `buildStoredLocalSession` 改为 `buildStoredChatSession`
  - 统一当前命名语义，避免继续暗示“本地持久化”
- 删除已无生产引用、仅服务旧游客本地存储方案的文件：
  - `apps/web/src/app/chat/lib/chat-local-storage.ts`
  - `apps/web/src/app/chat/lib/chat-local-storage.test.ts`
- 同步更新相关单测与测试基线：
  - `chat-session-draft.test.ts`
  - `use-chat-controller-actions.dom.test.ts`
  - `use-chat-delete-actions.dom.test.ts`
  - `stream-event-handler.test.ts`
  - `chat-message-mutations.test.ts`
  - `chat-remote-session-sync.test.ts`
  - `chat-active-session-store.test.ts`
  - `chat-session-cache-store.test.ts`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无线上接口协议变更。
- 仅删除已废弃的本地 IndexedDB 会话工具与对应测试，当前 Web 聊天功能不再保留任何“游客本地会话持久化”实现。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 若后续要补离线模式，应以独立能力重新设计，而不是恢复旧的 `chat-local-*` 会话分支。

## Iteration 4.58（2026-03-26）：统一游客服务端身份与每日额度，并补齐聊天页额度 UI

### 目标

- 解决 Web 端游客会话不入库、Admin 无法查询游客数据、消息调用次数无限制的问题。
- 将游客链路从“本地 localStorage”收敛为“服务端匿名身份 + 数据库会话 + 每日额度控制”。

### 主要改动

- `packages/db/prisma/schema.prisma`
  - 新增：
    - `UserActor`
    - `DailyUsageCounter`
    - `UserActorType`
  - `ChatSessionRecord` 新增 `actorId`
  - `ChatSessionRecord.userId` 改为可空，支持游客会话
- `packages/db/prisma/migrations/20260326100000_add_user_actor_and_usage/migration.sql`
  - 补齐匿名/注册统一 actor 层的数据迁移与历史数据回填
- `packages/shared`
  - 新增：
    - `ActorType`
    - `ChatUsageSummary`
- `apps/web`
  - 新增服务端匿名身份解析：
    - `apps/web/src/lib/server/chat-actor.ts`
  - 新增每日额度服务：
    - `apps/web/src/lib/server/chat-usage.ts`
  - 注册用户创建时同步创建 `registered` actor
  - 全量重构 chat session repository 为 `actorId` 语义：
    - 会话列表
    - 会话详情
    - 新建/保存
    - 编辑截断
    - 置顶/重命名
    - 消息反馈
  - 新增：
    - `/api/chat/usage`
  - 现有 chat API 全部改为通过 `getCurrentChatActor({ createGuest: true })` 解析身份
  - 发送/编辑消息接入每日额度：
    - 游客 `10 次/天`
    - 注册用户 `30 次/天`
  - 旧 `/api/chat/stream` 本地游客接口改为返回 `410 Gone`
  - 前端 `useChatStorage` 改为统一走服务端会话，不再区分游客本地存储
  - 聊天输入区新增额度百分比按钮与弹层，样式对齐 `既定产品基线` / `image.png`
  - 删除已废弃的游客本地运行链路代码：
    - `use-local-send-message`
    - `use-local-edit-message`
    - `chat-local-stream-handler`
    - `chat-local-message-feedback`
    - 旧内存态 `chat-store`
  - 新增额度用尽提示条：
    - 游客显示登录 / 注册入口
    - 注册用户显示明日重置提示
- `apps/admin`
  - 会话管理与会话详情页改为读取 `actor`
  - 会话列表可区分：
    - `访客`
    - `注册用户`
  - 游客会话现在可在 Admin 中查看

### 迁移/破坏性变更

- 数据库新增 actor / usage 两张表，并要求 `ChatSessionRecord` 必须关联 `actorId`。
- Web 端旧游客本地会话不再作为主链路；已有浏览器 localStorage 中的游客会话不会自动迁移到服务端。
- 本次变更依赖执行数据库迁移：
  - `pnpm db:up`
  - `pnpm db:migrate:deploy`

### 验证

- 已执行：
  - `pnpm db:generate`
  - `pnpm typecheck`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如需进一步减小维护成本，可继续删除已废弃的本地游客会话 helper / hook / storage 代码。

## Iteration 4.57（2026-03-23）：将 deploy 切换为可配置镜像仓库，当前优先支持 ACR

### 目标

- 解决国内服务器在 `Trigger remote deploy` 阶段拉取 `ghcr.io` 镜像过慢的问题，把当前 deploy 链路收敛为“镜像仓库可配置，优先使用阿里云 ACR”。

### 主要改动

- `.github/workflows/deploy.yml`
  - `Compute image metadata` 改为支持：
    - `REGISTRY_HOST`
    - `REGISTRY_NAMESPACE`
  - 本地镜像登录不再写死 GHCR，改为：
    - GHCR 默认回退
    - 自定义仓库显式校验 `REGISTRY_USERNAME / REGISTRY_PASSWORD`
  - Web/Admin/Migrate 三个镜像 tag 改为基于 `${registry_host}/${image_namespace}` 生成
  - 新增远程 `docker login` 步骤，部署前会通过 SSH 在服务器执行一次镜像仓库登录
- `deploy/scripts/deploy.sh`
  - 默认拉取镜像收敛为：
    - `web`
    - `admin`
    - `migrate`
  - 不再每次都拉 `caddy`
  - 如需显式刷新基础设施镜像，可通过 `PULL_INFRA_IMAGES=1` 打开
- `deploy/.env.prod.example`
  - `IMAGE_NAMESPACE` 改为通用仓库格式示例
  - 增加 ACR 个人版与 GHCR 的示例注释
- `docs/ProductionDeploymentPlan.md`
  - 生产部署设计从“默认 GHCR”调整为“镜像仓库可配置，当前推荐 ACR”
  - 补充 ACR 个人版与企业版的取舍边界
- `docs/ProductionDeploymentChecklist.md`
  - 首发清单改为以 ACR 为主线
  - 删除服务器 `cp .env.prod.example` 与手工登录 GHCR 的过期步骤
  - 新增 `REGISTRY_*` GitHub Secrets 说明

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无应用代码变更。
- deploy workflow 新增仓库级 secrets 依赖：
  - `REGISTRY_HOST`
  - `REGISTRY_NAMESPACE`
  - `REGISTRY_USERNAME`
  - `REGISTRY_PASSWORD`
- 服务器 `.env.prod` 需要把 `IMAGE_NAMESPACE` 改成 ACR 实际命名空间。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`
  - `bash -n deploy/scripts/deploy.sh`

### 下一步

- 你在阿里云 ACR 控制台创建个人版实例、命名空间和三个仓库，并配置 `REGISTRY_*` GitHub Secrets 后，再触发一次 deploy workflow 验证远端拉取速度改善。

## Iteration 4.56（2026-03-23）：补齐容器内 OpenSSL 依赖，消除 Prisma 警告

### 目标

- 修复生产首发后在 `migrate` 容器中出现的 Prisma OpenSSL/libssl 探测警告，避免把运行时系统依赖问题继续留在线上镜像里。

### 主要改动

- `Dockerfile`
  - 新增 `os-base` 公共基础层
  - 在公共基础层安装：
    - `openssl`
    - `ca-certificates`
  - `base` 与 `runner` 统一改为复用 `os-base`
  - 覆盖范围包括：
    - builder
    - migrator
    - web/admin runner

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无部署命令变更。
- 仅调整镜像内系统依赖，镜像体积会小幅增加，但换来 Prisma CLI/Client 运行环境更稳定。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`
  - `docker build --target migrator -t mianshitong-migrate-smoke .`
  - `docker run --rm --entrypoint bash mianshitong-migrate-smoke -lc 'cd /repo && DATABASE_URL=postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public pnpm db:generate'`
  - `docker run --rm --entrypoint bash mianshitong-migrate-smoke -lc 'openssl version && cd /repo && DATABASE_URL=postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public pnpm db:generate'`

### 下一步

- 验证镜像内 Prisma 命令不再输出 OpenSSL 探测警告后，重新提交并触发一次 deploy workflow，让线上环境回到“全自动部署也能一把过”的状态。

## Iteration 4.55（2026-03-22）：修复生产构建期过早初始化 Prisma / NextAuth

### 目标

- 修复真实 `deploy` workflow 在 `Build and push web image` 阶段失败的问题，避免 `next build` 在收集 `/api/auth/register`、`/api/health` 等路由数据时，因为顶层初始化 Prisma 或鉴权配置而提前要求 `DATABASE_URL` / `AUTH_SECRET`。

### 主要改动

- `.github/workflows/deploy.yml`
  - `Sync deploy files to server` 步骤不再上传 `deploy/.env.prod.example`
  - 服务器真正依赖的是手工维护的 `.env.prod`，示例文件不再参与生产同步
- `.gitignore`
  - 新增 `!deploy/.env.prod.example`
  - 允许部署示例环境文件进入版本库，避免本地存在但远端仓库缺失
- `Dockerfile`
  - builder 阶段在构建前新增：
    - `mkdir -p apps/${APP}/public`
  - 解决空 `public` 目录未被 Git 跟踪时，运行时镜像层 `COPY --from=builder /repo/apps/${APP}/public ...` 直接失败的问题
- `packages/db/src/client.ts`
  - Prisma Client 改为惰性初始化：
    - 新增 `getPrismaClient()`
    - `prisma` 改为 `Proxy` 代理，在首次属性访问时才真正构造客户端
  - 保留开发态单例复用，避免热更新下重复创建连接
- `packages/db/src/index.ts`
  - 补充导出 `getPrismaClient`
- `apps/web/src/lib/server/auth-options.ts`
  - `authOptions` 顶层常量改为 `getAuthOptions()` 工厂函数
  - `AUTH_SECRET` 解析与生产校验改为运行时触发
- `apps/web/src/app/api/auth/[...nextauth]/route.ts`
  - 改为在每次请求进入时调用 `NextAuth(request, context, getAuthOptions())`
  - 不再在模块加载阶段创建 NextAuth handler
- `apps/web/src/lib/server/auth-session.ts`
  - `getServerSession()` 改为读取 `getAuthOptions()`
- `apps/web/src/app/login/page.tsx`
  - 登录页改为服务端 page 读取 `searchParams`
  - `callbackUrl` 通过 props 传给新的客户端表单组件，移除 page 组件里的 `useSearchParams()`，兼容 Next 16 生产构建
- `apps/web/src/app/login/login-form.tsx`
  - 新增独立客户端登录表单组件，承接 `signIn`、跳转与错误处理

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无接口协议变更。
- 构建阶段不再要求生产环境变量齐全；但运行阶段仍要求：
  - `DATABASE_URL`
  - `AUTH_SECRET` / `NEXTAUTH_SECRET`

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`
  - `pnpm -C apps/web build`
  - `pnpm -C apps/admin build`
  - `docker build --build-arg APP=web -t mianshitong-web-smoke .`

### 下一步

- 完成五件套与 `apps/web build` 验证后，重新触发 `deploy` workflow，确认 GHCR 镜像构建恢复正常。

## Iteration 4.54（2026-03-22）：修复生产镜像构建残留的 `question-bank` 依赖

### 目标

- 修复第一次真实触发 `deploy` workflow 时，在 `Build and push web image` 步骤因为 `packages/question-bank/package.json` 不存在而导致的 Docker 构建失败。

### 主要改动

- `Dockerfile`
  - 删除过期的：
    - `COPY packages/question-bank/package.json packages/question-bank/package.json`
  - 当前镜像构建依赖清单与仓库现状重新对齐，不再引用已移除的 `packages/question-bank`
- `docs/ProjectContext.md`
  - 记录本次真实部署中暴露出的构建脚本陈旧问题及修复结果

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无运行时代码行为变更。
- 本次仅修复生产镜像构建链。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 重新触发 `deploy` workflow，继续观察后续镜像构建与远程部署步骤。

## Iteration 4.53（2026-03-22）：修正生产默认域名示例为 `mianshitong.chat`

### 目标

- 修正生产部署文档与默认配置示例中的域名占位，避免继续误导为 `mianshitong.com`，与当前真实域名 `mianshitong.chat` 保持一致。

### 主要改动

- `deploy/.env.prod.example`
  - 默认 `WEB_DOMAIN` 改为 `mianshitong.chat`
  - 默认 `ADMIN_DOMAIN` 改为 `admin.mianshitong.chat`
  - 默认 `NEXTAUTH_URL` 改为 `https://mianshitong.chat`
- `docs/ProductionDeploymentPlan.md`
  - 文档中的主站/Admin 域名示例统一调整为 `.chat`
- `docs/ProductionDeploymentChecklist.md`
  - `.env.prod` 模板、DNS 验证、健康检查 URL、页面验证 URL 统一调整为 `.chat`
- `docs/ProjectContext.md`
  - 记录本次修正的边界：仓库逻辑不依赖写死域名，真正线上值仍以服务器 `.env.prod` 为准

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无代码运行逻辑变更。
- 需要你手动把服务器 `/opt/mianshitong/.env.prod` 中的域名从 `.com` 改成 `.chat`。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 你在服务器上修正 `.env.prod` 后，继续配置 `mianshitong.chat` 与 `admin.mianshitong.chat` 的 DNS 解析。

## Iteration 4.51（2026-03-22）：落地生产自动部署骨架

### 目标

- 把上一轮确定的“GitHub Actions + GHCR + Docker Compose + Caddy”方案从纯设计稿推进到可执行骨架，补齐部署编排、远程脚本、数据库迁移入口和应用健康检查。

### 主要改动

- `Dockerfile`
  - 补齐最新 workspace 依赖清单：
    - `packages/retrieval`
    - `packages/agent-skills`
  - `builder` 阶段在构建前显式执行 `pnpm db:generate`
  - 新增 `migrator` 目标，用于生产执行 `pnpm db:migrate:deploy`
- `apps/web/src/app/api/health/route.ts`
- `apps/admin/src/app/api/health/route.ts`
  - 为 Web/Admin 新增最小健康检查接口
  - 当前检查内容为：
    - 路由可用
    - Prisma 数据库连通
- `deploy/`
  - 新增 `compose.prod.yml`
    - 包含：
      - `db`
      - `migrate`
      - `web`
      - `admin`
      - `caddy`
    - 补齐：
      - 应用 healthcheck
      - `depends_on` 健康依赖
      - `host.docker.internal:host-gateway`
  - 新增 `Caddyfile`
  - 新增 `.env.prod.example`
  - 新增远程脚本：
    - `deploy/scripts/deploy.sh`
    - `deploy/scripts/rollback.sh`
- `.github/workflows/deploy.yml`
  - 新增生产部署 workflow
  - 在 `main` push / `workflow_dispatch` 时：
    - 构建并推送 `web/admin/migrate` 镜像到 GHCR
    - 通过 SSH 同步 `deploy/` 文件到服务器
    - 触发远程部署脚本

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无现有本地开发命令变更。
- 本次新增的是生产部署骨架；要真正上线，还需要你在服务器侧补：
  - `.env.prod`
  - GHCR 登录
  - Docker / Compose / Caddy 运行环境
  - GitHub Secrets

### 验证

- 已执行：
  - `docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod config`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 继续完成服务器侧初始化与首次真实发布：
  - 配 DNS
  - 配 GitHub Secrets
  - 在服务器创建 `.env.prod`
  - 登录 GHCR
  - 触发第一次 deploy workflow

## Iteration 4.52（2026-03-22）：补齐生产首发操作清单

### 目标

- 为第一次真实发布补一份可直接照着执行的服务器与 GitHub 配置清单，避免部署骨架已经存在，但落地时还要临时猜目录、Secrets、命令和验证步骤。

### 主要改动

- 新增 [`docs/ProductionDeploymentChecklist.md`](/Users/percy/Desktop/mianshitong/docs/ProductionDeploymentChecklist.md)
  - 明确了首次上线的执行顺序：
    - 服务器安装 Docker / Compose
    - 初始化 `/opt/mianshitong`
    - 创建 `.env.prod`
    - 服务器登录 GHCR
    - GitHub Secrets 配置
    - DNS 配置
    - 手动触发第一次 `deploy` workflow
  - 给出 `.env.prod` 建议模板
  - 给出 `PROD_SSH_*` 与 `PROD_DEPLOY_PATH` 的具体说明
  - 补充首发后的验证动作、常见故障排查与回滚命令
- 更新 [`docs/ProjectContext.md`](/Users/percy/Desktop/mianshitong/docs/ProjectContext.md)
  - 记录当前已经有一份面向首次上线的执行清单

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无代码运行行为变更。
- 本次为交付操作文档补全。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 你按清单完成服务器与 GitHub 配置后，我再继续协助你做第一次真实 deploy 联调。

## Iteration 4.50（2026-03-22）：补齐生产自动部署设计稿

### 目标

- 为“面试通”补一套可落地的生产自动部署设计，目标是让 `main` 分支合入后能自动触发线上发布，同时保持构建、测试、发布、部署职责分离。

### 主要改动

- 新增 [`docs/ProductionDeploymentPlan.md`](/Users/percy/Desktop/mianshitong/docs/ProductionDeploymentPlan.md)
  - 明确对比三种方案：
    - 服务器直接 `git pull`
    - GitHub Actions + GHCR + Docker Compose
    - self-hosted runner
  - 结论收敛为：
    - `GitHub-hosted runner -> GHCR -> 单机 Docker Compose -> Caddy`
  - 补齐了面向当前仓库的生产部署设计：
    - 域名规划
    - 容器拓扑
    - 镜像命名与 tag 策略
    - CI/CD 流程
    - GitHub Secrets / Environment 设计
    - 数据库迁移策略
    - 回滚、健康检查、备份建议
    - 分阶段落地清单
- 更新 [`docs/ProjectContext.md`](/Users/percy/Desktop/mianshitong/docs/ProjectContext.md)
  - 记录当前已确定的生产部署方向与后续实施前置项

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无运行时代码变更。
- 本次为设计与文档沉淀，不直接改变现有部署行为。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 进入部署落地阶段，优先顺序：
  - `deploy/compose.prod.yml`
  - `deploy/Caddyfile`
  - `.github/workflows/deploy.yml`
  - `migrate` 镜像与健康检查接口

## Iteration 4.49（2026-03-22）：修复 Web planning smoke 的 Next.js dev lock 冲突

### 目标

- 修复 `pnpm evals:web:planning:smoke` 在本机已有 `apps/web` 的 `next dev` 运行时，因为 `.next/dev/lock` 被占用而无法并存启动的问题。

### 主要改动

- `apps/web/next.config.ts`
  - 支持通过 `NEXT_DIST_DIR` 覆盖 Next.js 构建输出目录。
  - 默认行为不变；仅 smoke 等显式注入该环境变量的场景会使用独立输出目录。
- `scripts/smoke-hybrid-rag.mjs`
  - 每次运行自动生成唯一的 `NEXT_DIST_DIR`，形如 `.next-smoke/web-planning-<pid>-<timestamp>`
  - smoke 启动的 `next dev` 现在会写入独立构建目录，不再与日常开发使用的 `.next/dev/lock` 冲突
  - 每次启动前会自动清理历史 `.next-smoke` 目录，避免积累旧的 smoke 构建产物
  - Web 服务改为直接通过 Node 启动 Next CLI，脚本可稳定结束子进程，不再依赖 `pnpm exec next dev` 的进程层级
  - smoke 结束后会恢复 `apps/web/next-env.d.ts` 并清理 `.next-smoke` 目录，避免工作区被 Next.js 生成文件污染
  - `--check-env` 输出新增 `NEXT_DIST_DIR`，便于排查当前 smoke 使用的隔离目录

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无新增必填环境变量。
- `apps/web` 默认开发命令与构建行为保持不变。

### 验证

- 已执行：
  - `node scripts/smoke-hybrid-rag.mjs --check-env`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 你本机重新执行 `pnpm evals:web:planning:smoke`
- 如果仍失败，下一层排查重点就会回到：
  - Ollama embedding 服务
  - PostgreSQL / 题库 embedding 数据
  - smoke 场景本身的断言

## Iteration 4.48（2026-03-22）：修复 Web planning smoke 的旧 runtime 兼容问题

### 目标

- 修复 `pnpm evals:web:planning:smoke` 进入 `/api/chat/stream` 后，因为 local session runtime 缺少 `followUpTrace / assessmentTrace` 等字段而触发的 `undefined.map` 运行时错误。

### 主要改动

- `packages/interview-engine/src/session-core.ts`
  - `cloneRuntime(...)` 改为防御式兼容旧 runtime：
    - `questionPlan`
    - `activeQuestionAnswers`
    - `assessments`
    - `followUpTrace`
    - `assessmentTrace`
    - `planningTrace`
    - `reportTrace`
  - 对这些字段缺失或为旧结构时，统一补默认空数组 / `null`
  - 同时对 `questionPlan` 里的题目结构也补了数组字段收口，避免后续 `tags / keyPoints / followUps` 再次出现类似问题
- `packages/interview-engine/src/index.test.ts`
  - 新增回归用例，验证“缺少 trace 数组字段的旧 runtime 会话”仍可正常启动面试
- `scripts/smoke-hybrid-rag.mjs`
  - `buildSession(...)` 现也显式补齐：
    - `followUpTrace`
    - `assessmentTrace`
  - 保证 smoke 脚本自己构造的最小 session 与当前运行时协议一致

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无环境变量变更。
- 本次是纯兼容性增强，对现有正常 session 无行为破坏。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts`
  - `pnpm evals:web:planning:smoke`
    - 当前已不再报 `undefined.map`
    - 当前失败原因已前进到更明确的前置条件：`Ollama embedding 服务不可达`

### 下一步

- 你本机启动 Ollama 后，重新执行 `pnpm evals:web:planning:smoke`
- 若仍失败，优先检查：
  - `OLLAMA_BASE_URL`
  - embedding 模型是否已拉取
  - 数据库里是否已有题库 embedding 回填
  - smoke 返回的检索策略是否退回 `hybrid-lexical-v1`

## Iteration 4.47（2026-03-22）：正式收敛 Web 端真实出题 smoke 命令

### 目标

- 把现有 `/api/chat/stream` 驱动的 Hybrid RAG 端到端 smoke 收敛为“可直接手动运行、定位更清晰”的正式验证入口，用来覆盖 `简历输入 -> 画像 -> 蓝图 -> 检索 -> 题单 -> planningTrace` 全链路。

### 主要改动

- `scripts/smoke-hybrid-rag.mjs`
  - 自动读取仓库根目录 `.env` / `.env.local`
  - 运行时强制固定：
    - `LLM_PROVIDER=ollama`
    - `EMBEDDING_PROVIDER=ollama`
    - `DATABASE_URL` 缺失时自动回落到本地默认值
  - 新增 `--check-env`
    - 只校验环境与最终生效配置，不启动 Web、不发起 smoke 请求
  - 在真正启动 smoke 前，新增 Ollama embedding 服务可达性检查
  - 场景校验范围从“只看 questionPlan 标签”扩大为：
    - `resumeProfile` 标签命中
    - `interviewBlueprint` 标签命中
    - `questionPlan` 标签命中
    - `planningTrace` 是否存在、步数是否与题单一致、`selectedQuestionId` 是否与题单逐题对齐
  - 当策略退回 `hybrid-lexical-v1` 时，会给出更明确的诊断提示，帮助定位是 embedding 未回填、Ollama 不可达，还是 embedding 配置不匹配
- 根脚本
  - 新增 `pnpm evals:web:planning:check-env`
  - 新增 `pnpm evals:web:planning:smoke`
  - 原 `pnpm retrieval:smoke` 改为兼容别名，继续可用
- 文档
  - 补充 Web 端真实出题 smoke 的正式入口与运行语义
  - 明确该 smoke 是“确定性规划 + 真实检索集成”的链路验证，不与 DeepSeek live eval 混用

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无新增环境变量。
- `retrieval:smoke` 仍可继续使用；推荐后续统一使用更明确的：
  - `pnpm evals:web:planning:check-env`
  - `pnpm evals:web:planning:smoke`

### 验证

- 已执行：
  - `pnpm evals:web:planning:check-env`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm spellcheck`
  - `pnpm typecheck`
- 本轮未在当前沙箱里实际执行 `pnpm evals:web:planning:smoke`
  - 原因：该命令依赖本地 PostgreSQL + 题库 embedding 数据 + Ollama embedding 服务
  - 代码侧已补齐前置检查与更明确的失败提示，建议你在本机直接执行

### 下一步

- 你本机可以直接跑：
  - `pnpm evals:web:planning:check-env`
  - `pnpm evals:web:planning:smoke`
- 如果 smoke 成功，下一阶段就可以考虑把其中 1 到 2 个最稳的场景抽成更正式的回归基线或 GitHub Actions 手动工作流。

## Iteration 4.46（2026-03-22）：收敛 ResumeProfile live eval 断言强度

### 目标

- 修复 `ResumeProfileSkill` live eval 对 `seniority` 断言过严的问题，避免把 `mid / senior` 这类合理波动误判为失败。

### 主要改动

- `packages/evals/src/skill-live-evals.test.ts`
  - `ResumeProfileSkill` 的 live eval 断言由固定 `senior` 收敛为允许 `mid | senior`
  - 该用例继续保留对以下信号的校验：
    - 核心标签命中数
    - `evidence`
    - `confidence`

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无运行时行为变化；仅影响 live eval 的 smoke 断言策略。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm spellcheck`
  - `pnpm typecheck`
- `pnpm evals:skills:live`
  - 当前本地真实联网执行由你手动验证更可靠；本次调整针对你提供的真实返回结果 `mid` 做了断言收敛

### 下一步

- 后续如果要继续提升画像稳定性，应该优先调 prompt / merge 逻辑，而不是继续把 smoke 断言写成固定等级。

## Iteration 4.45（2026-03-22）：live eval 切换为 strict 模式，禁止静默 fallback

### 目标

- 让 `pnpm evals:skills:live` 在真实模型不可用、请求失败或结构化解析失败时，直接暴露根因，而不是被 Skill 内部 fallback 吞掉后变成“结果和 fallback 一样”的误导性断言失败。

### 主要改动

- `packages/agent-skills`
  - `createResumeProfileSkill`
  - `createAssessmentSkill`
  - `createReportSkill`
  - 三者均新增 `fallbackOnInferenceError` 选项，默认值保持 `true`，因此线上/默认运行时行为不变。
  - 当 `fallbackOnInferenceError=false` 时：
    - 若未启用可用推断器，会直接抛错
    - 若模型请求失败，会直接抛错
    - 若结构化结果为空/无效，会直接抛错
- `packages/evals/src/skill-live-evals.test.ts`
  - live eval 现在显式使用 strict 模式，不再接受静默 fallback。
  - 断言从“必须与 fallback 不同”调整为：
    - 结构有效
    - 关键字段存在
    - 报告数值层仍与规则聚合保持一致
  - 这样可以显著降低“模型恰好生成了与 fallback 类似内容”带来的误报，同时保留 live eval 的诊断价值。
- `packages/agent-skills` 单测
  - 为三段 Skill 各新增一条 strict 模式用例，验证推断异常会被重新抛出。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 默认运行时无行为变化；仅 live eval 或显式传入 `fallbackOnInferenceError=false` 的调用方会看到严格模式。

### 验证

- 已执行：
  - `pnpm evals:skills:live`
    - 当前环境已不再报“缺少环境变量”
    - 当前环境下真实失败原因已收敛为 `fetch failed / getaddrinfo ENOTFOUND api.deepseek.com`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm spellcheck`
  - `pnpm typecheck`

### 下一步

- 如果 strict live eval 下仍失败，就可以直接根据真实错误区分：
  - DeepSeek 网络不可达
  - API Key 无效
  - 模型返回结构不满足当前 schema
  - prompt / parse 逻辑需要继续收敛

## Iteration 4.44（2026-03-22）：live eval 命令自动加载本地环境变量

### 目标

- 修复 `pnpm evals:skills:live` 在本地明明配置了 `.env.local`，但仍读不到 `DEEPSEEK_API_KEY` 的问题，避免每次手动 `source` 环境变量。

### 主要改动

- 新增 `scripts/run-skill-live-evals.mjs`
  - 启动时会自动加载仓库根目录的 `.env` 与 `.env.local`
  - 自动补齐：
    - 强制 `RUN_LLM_EVALS=1`
    - 强制 `LLM_PROVIDER=deepseek`
  - `DEEPSEEK_API_KEY` 仍保持“shell 优先，其次读 .env / .env.local”
  - 在真正启动 Vitest 前，先显式校验 `DEEPSEEK_API_KEY` 是否存在，报错信息更直接
  - 支持 `--check-env`，可只校验环境是否加载成功而不发起真实模型请求
- 根脚本 `pnpm evals:skills:live`
  - 不再依赖当前 shell 已提前注入环境变量
  - 改为统一走 `node scripts/run-skill-live-evals.mjs`
- `env.example`
  - 同步补充该命令会自动加载 `.env` / `.env.local` 的说明

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无新增必填环境变量。
- `DEEPSEEK_API_KEY` 若已在 shell 中显式设置，会继续优先使用 shell 的值。
- `RUN_LLM_EVALS` 与 `LLM_PROVIDER` 会被命令强制固定为 live eval 所需值，不再受日常开发环境配置影响。

### 验证

- 已执行：
  - `node scripts/run-skill-live-evals.mjs --check-env`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 你本地可直接再次执行 `pnpm evals:skills:live`；若仍失败，下一层就不是“环境变量未加载”，而是网络访问、Key 权限或模型调用本身的问题。

## Iteration 4.43（2026-03-22）：补齐手动触发的真实模型 Skill Eval

### 目标

- 在现有离线 regression baseline 之外，再补一层“显式触发、真实调用 DeepSeek”的 live eval，用来做本地 smoke / capability check，同时不污染默认 CI 绿线。

### 主要改动

- `packages/evals`
  - 新增 `skill-live-evals.test.ts`：
    - 覆盖 `ResumeProfileSkill`
    - 覆盖 `AssessmentSkill`
    - 覆盖 `ReportSkill`
  - 使用 Vitest 4 的条件执行能力：
    - 仅在 `RUN_LLM_EVALS=1` 时进入 live suite
    - 仅在 `LLM_PROVIDER=deepseek` 且存在 `DEEPSEEK_API_KEY` 时执行真实模型用例
  - 为整份 live eval 文件设置了更高的 test timeout，避免真实网络请求被 Vitest 默认 5 秒超时误杀。
  - live eval 的断言策略刻意保持“弱约束”：
    - 不要求模型输出逐字稳定
    - 只校验关键结构、基础质量与“应区别于 fallback”的最小信号
- 根脚本
  - 新增 `pnpm evals:skills:regression`
  - 新增 `pnpm evals:skills:live`
- `env.example`
  - 新增 `RUN_LLM_EVALS` 说明，明确该开关只用于手动真实模型评测。
- `docs/InterviewAgentArchitecture.md`
  - 补充当前 Eval 体系已经分层为“默认离线回归 + 手动真实模型评测”。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无新增必填环境变量；`RUN_LLM_EVALS` 仅为可选手动开关。
- 默认 `pnpm test` 仍不会发起真实模型请求。

### 验证

- 已执行：
  - `pnpm exec tsc -p packages/evals/tsconfig.json --noEmit`
  - `pnpm exec vitest run packages/evals/src/skill-regression-evals.test.ts`
  - `pnpm exec vitest run packages/evals/src/skill-live-evals.test.ts`
    - 当前 shell 未显式开启 `RUN_LLM_EVALS`，因此该 suite 处于预期的 skipped 状态
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 后续可以按同一方式继续补：
  - 检索链路 live eval
  - 真实面试全链路 smoke eval
  - prompt 版本对比评测

## Iteration 4.41（2026-03-22）：ReportSkill 接入 LLM 结构化总结

### 目标

- 把 `ReportSkill` 从纯规则模板升级为“LLM 结构化总结 + 规则 fallback”，让面试结束报告更像真实面试官反馈，同时继续保持分数与等级的稳定可回归。

### 主要改动

- `packages/agent-skills`
  - `ReportSkill` 现支持注入 `inferReport` runner。
  - 实现策略采用“数值 deterministic，叙述 AI 化”：
    - `dimensionSummary / overallScore / level / levelReason / dimensionTraces` 继续沿用规则聚合。
    - `overallSummary / strengths / gaps / nextSteps` 允许由 DeepSeek 结构化生成。
  - 默认情况下：
    - 当 `LLM_PROVIDER=deepseek` 且存在有效 `DEEPSEEK_API_KEY` 时，会调用 DeepSeek 输出结构化总结 JSON。
    - 若模型调用失败、结构无效、当前环境未启用 DeepSeek，或本场没有 `assessment`，则自动回退到规则版报告。
  - LLM 输出的 `strengths / gaps / nextSteps` 会和现有 trace source 做 canonicalize / 对齐，尽量保留题目来源关系，避免 Admin Trace 丢失可解释性。
  - 新增测试覆盖：
    - LLM 总结成功时优先使用结构化叙述结果
    - LLM 总结失败时回退规则版报告
- `docs/InterviewAgentArchitecture.md`
  - 当前进展补充为：`ReportSkill` 已升级为真实 LLM + fallback 的混合实现。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无新增必填环境变量。
- `InterviewReport` / `InterviewReportTrace` 数据结构保持不变。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一阶段更自然的是补一层更明确的 `Prompt/Eval` 回归基线，让三段 LLM Skill 的输出质量都可离线对比。

## Iteration 4.42（2026-03-22）：补齐三段 LLM Skill 的离线回归基线

### 目标

- 为 `ResumeProfileSkill / AssessmentSkill / ReportSkill` 补齐一层可进入 CI 的离线回归网，避免后续改 prompt、改 merge 逻辑或调整 fallback 时，输出质量悄悄退化。

### 主要改动

- `packages/evals`
  - 新增 `skill-regression-fixtures.ts`
    - 提供三类代表性 fixture：
      - `ResumeProfileSkill`
      - `AssessmentSkill`
      - `ReportSkill`
  - 新增 `skill-regression-evals.ts`
    - 提供统一的 Skill 级回归执行器。
    - 当前评测重点不是“真实联网调用模型”，而是验证：
      - 结构化推断结果的 merge / canonicalize 行为
      - trace 与最终结果的一致性
      - fallback 在无推断/推断失败场景下的稳定性
  - 新增 `skill-regression-evals.test.ts`
    - 使用 Vitest 的 table-driven 方式跑完整套 fixture suite。
  - `packages/evals/package.json`
    - 新增对 `@mianshitong/agent-skills` 的 workspace 依赖，允许 eval 包直接验证三段 Skill 的输出协议。
- `docs/InterviewAgentArchitecture.md`
  - 当前进展补充为：现已具备“规划题单 eval + 报告 trace eval + 三段 Skill regression eval”三层离线回归基线。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无环境变量变更。
- 本轮新增的是离线 contract/regression 基线，不会触发真实 LLM 请求。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一阶段可以补一层“手动触发的真实模型评测”，把离线 contract/regression baseline 与真实 LLM 表现评测分层管理。

## Iteration 4.40（2026-03-22）：AssessmentSkill 接入 LLM 结构化评分

### 目标

- 把 `AssessmentSkill` 从纯规则版升级为“LLM 结构化评分 + 规则 fallback”，提升每题评分、追问收束和最终报告的基础质量，同时保证在本地/CI/无模型环境下行为稳定。

### 主要改动

- `packages/agent-skills`
  - 新增 `deepseek-skill-helpers.ts`，统一封装 DeepSeek 结构化输出 provider 的环境判断与构造逻辑，避免多个 Skill 重复读取环境变量。
  - `AssessmentSkill` 现支持注入 `inferAssessment` runner。
  - 默认情况下：
    - 当 `LLM_PROVIDER=deepseek` 且存在有效 `DEEPSEEK_API_KEY` 时，会调用 DeepSeek 生成结构化评分 JSON。
    - 若模型调用失败、结构无效，或当前环境未启用 DeepSeek，则自动回退到规则版评分。
  - 评分 JSON 会合并到现有 `assessment + trace` 结构中，不改 `interview-engine` 调用边界。
  - 规则 fallback 额外补了一层启发式评分：
    - 当题目没有 `keyPoints` 时，不再因为覆盖率恒为 0 而系统性低分。
    - 会结合回答长度、结构化表达、工程化关键词、trade-off 关键词做基础判断。
  - 新增测试覆盖：
    - LLM 评分成功时优先使用结构化结果
    - `keyPoints` 为空且模型不可用时，fallback 评分仍能维持合理分数区间
- `docs/InterviewAgentArchitecture.md`
  - 当前进展补充为：`AssessmentSkill` 已升级为真实 LLM + fallback 的混合实现。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无新增必填环境变量。
- `QuestionAssessment` 与 `InterviewAssessmentTrace` 结构保持不变。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一阶段应继续升级 `ReportSkill`，让最终总结与建议建立在更高质量的结构化 `assessment` 之上。

## Iteration 4.39（2026-03-22）：ResumeProfileSkill 接入 LLM 结构化画像

### 目标

- 把 `ResumeProfileSkill` 从纯规则版升级为“LLM 结构化画像 + 规则 fallback”，优先改善面试规划链路最上游的候选人画像质量，同时不破坏当前本地开发与 CI 稳定性。

### 主要改动

- `packages/llm`
  - 新增 `DeepSeekJsonCompletionProvider`，用于调用 DeepSeek OpenAI-compatible chat completion 的 JSON 输出模式。
  - 新增对应单测，覆盖：
    - `response_format: { type: 'json_object' }` 请求格式
    - 模型返回非法 JSON 时的报错行为
- `packages/agent-skills`
  - `ResumeProfileSkill` 现支持注入 `inferProfile` 推断器。
  - 默认情况下：
    - 当 `LLM_PROVIDER=deepseek` 且存在有效 `DEEPSEEK_API_KEY` 时，会调用 DeepSeek 做结构化画像。
    - 若模型调用失败、返回无效结构，或当前环境未启用 DeepSeek，则自动回退到原有规则版画像。
  - 新增标签 canonicalize / 合并逻辑，确保 LLM 即使返回中文别名标签，也会归一成当前题库检索侧可消费的 canonical tags。
  - 新增测试覆盖：
    - LLM 推断成功时优先使用结构化画像
    - LLM 推断失败时回退规则版画像
- `docs/InterviewAgentArchitecture.md`
  - 当前进展补充为：`ResumeProfileSkill` 已优先升级为真实 LLM + fallback 的混合实现。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无新增必填环境变量。
- 当前仅在 `LLM_PROVIDER=deepseek` 时启用该能力，`ollama` / 无 key / 本地测试环境都会继续走规则版，不影响现有链路。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 更自然的后续是沿同一模式继续升级：
  - `AssessmentSkill` 接 LLM / Rubric 评分
  - `ReportSkill` 接 LLM 总结与个性化建议
  - 必要时再把 `packages/llm` 抽成更通用的结构化生成 provider

## Iteration 4.38（2026-03-22）：显式落地 ReportSkill

### 目标

- 把“面试报告聚合 + reportTrace 生成”从 `interview-engine` 的内联聚合逻辑提升为显式 `ReportSkill`，完成“规划 -> 执行 -> 报告”三段 Skills 边界闭环。

### 主要改动

- `packages/agent-skills`
  - 新增 `ReportSkill`、`ReportSkillInput`、`ReportSkillResult`。
  - 当前规则版实现会输出：
    - `report`
    - `trace`
  - 同时导出 `buildReportSkillResult(...)`，供 `interview-engine` 兼容层复用。
- `packages/interview-engine/src/process-helpers.ts`
  - `completeInterview(...)` 改为直接执行 `defaultReportSkill`，把结果写回 `session.report` 与 `session.runtime.reportTrace`。
- `packages/interview-engine/src/process-session-message.ts`
  - `ensureCompletedReport(...)` 改为直接执行 `defaultReportSkill`，不再依赖 `scoring.ts` 的内联报告聚合。
- `packages/interview-engine/src/scoring.ts`
  - `buildInterviewReportResult(...)` 改为复用 `buildReportSkillResult(...)`，保留既有导出兼容 `evals` 与其他调用方。
- `docs/InterviewAgentArchitecture.md`
  - 当前进展补充为：`ReportSkill` 已提前落地第一版规则实现。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无用户可见行为变化。
- 本次仅收敛报告生成边界，现有报告规则与 `reportTrace` 结构保持一致。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一阶段更自然的是：把 `Skills` 层进一步接入真实 LLM / Tool 实现，而不是继续扩大规则版 Skill 的数量。

## Iteration 4.37（2026-03-22）：显式落地 AssessmentSkill

### 目标

- 继续沿着 `Skills` 方向收敛执行链路，把“单题评分 + assessment trace”从 `interview-engine` 内联逻辑提升为显式 `AssessmentSkill`，为后续接入 LLM 评分器、Rubric Tool 和可解释打分留出稳定边界。

### 主要改动

- `packages/agent-skills`
  - 新增 `AssessmentSkill`、`AssessmentSkillInput`、`AssessmentSkillResult`。
  - 当前规则版实现会输出：
    - `assessment`
    - `trace`
  - 同时导出 `buildAssessmentSkillResult(...)`，供 `interview-engine` 旧兼容函数复用。
- `packages/interview-engine/src/process-session-message.ts`
  - 单题作答完成后，改为执行 `defaultAssessmentSkill`，再把 `assessment + trace` 写入 runtime。
- `packages/interview-engine/src/scoring.ts`
  - 删除内嵌的单题评分规则实现，改为复用 `buildAssessmentSkillResult(...)`。
  - 报告聚合逻辑保持在 `scoring.ts` 中，当前只把单题评估边界前移到 Skill 层。
- `docs/InterviewAgentArchitecture.md`
  - “能力增强版本”的当前进展补充为：`AssessmentSkill` 已提前落地第一版规则实现。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无用户可见行为变化。
- 本次仅收敛“单题评估”内部边界，现有评分规则保持一致。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 可继续把 `报告生成` 提升为显式 `ReportSkill`，完成“规划 -> 执行 -> 报告”三段 Skills 链路。

## Iteration 4.36（2026-03-22）：显式落地 FollowUpSkill

### 目标

- 继续沿着 `Skills` 方向收敛执行链路，把“是否追问”的判定从流程层内联逻辑提升为显式 `FollowUpSkill`，为后续切换到 LLM / Tool 版追问判定保留稳定边界。

### 主要改动

- `packages/agent-skills`
  - 新增 `FollowUpSkill`、`FollowUpSkillInput`、`FollowUpSkillResult`。
  - 当前规则版实现会输出：
    - `trace`
    - `shouldAskFollowUp`
  - 同时保留 `askedMissingPoint`，供流程层继续复用现有 `provider.generateFollowUpMessage(...)` 发出追问。
- `packages/interview-engine/src/process-helpers.ts`
  - 删除内嵌 `buildFollowUpTrace`。
  - 改为执行 `defaultFollowUpSkill`，再把 trace 写回 runtime。
- `packages/interview-engine/src/process-session-message.ts`
  - `processInterviewingSession` 改为异步，以支持等待追问 Skill 结果。
- `docs/InterviewAgentArchitecture.md`
  - “Phase 2” 中原本规划的 `追问 Skill` 现已前移落地为第一版规则实现。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无用户可见交互变化。
- 本次仅收敛执行链路内部边界，追问行为保持与之前一致。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 可继续把 `答案评估` 与 `报告生成` 提升为显式 Skill，形成“规划 Skill + 执行 Skill + 报告 Skill”的完整链路。

## Iteration 4.35（2026-03-22）：显式落地规划 Skills 边界

### 目标

- 把 `ResumeProfile` 与 `InterviewBlueprint` 两段规划能力从 `interview-engine` 内部函数提升为显式 Skill，补齐 `Skills` 这一层工程边界，同时保持现有面试规划行为不变。

### 主要改动

- `packages/agent-skills`
  - 新增独立 workspace 包。
  - 定义通用 `AgentSkill` 协议与 `SkillExecutionContext`。
  - 新增两类规划 Skill：
    - `ResumeProfileSkill`
    - `InterviewBlueprintSkill`
  - 当前实现仍是规则版，但已统一为异步 `execute()` 协议，后续可平滑替换为真实 LLM / Tool 版本。
- `packages/interview-engine/src/interview-planning.ts`
  - 删除内嵌的画像与蓝图构建函数，改为在 LangGraph 节点中调用：
    - `defaultResumeProfileSkill`
    - `defaultInterviewBlueprintSkill`
  - 题库检索、配额编排、Trace 生成逻辑保持不变，确保业务行为稳定。
- `packages/interview-engine/package.json`
  - 新增对 `@mianshitong/agent-skills` 的 workspace 依赖。
- `docs/InterviewAgentArchitecture.md`
  - “当前已落地”补充为：`packages/agent-skills` 已承接第一版显式 Skill 协议与规划 Skill。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无前端交互变更。
- 本次是内部架构收敛，当前规划结果与现有规则保持一致。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 可继续把 `追问生成`、`答案评估`、`报告生成` 逐步提升为显式 Skill，并在 LangGraph 子图内统一调度。

## Iteration 4.34（2026-03-22）：修复 CI test job 的 Prisma Client 生成前置条件

### 目标

- 修复 GitHub Actions `test` job 在 `typecheck` 阶段找不到 `@prisma/client` 导出类型的问题，消除 Prisma Client 生成产物对环境状态的隐式依赖。

### 主要改动

- `package.json`
  - 根 `typecheck` 脚本改为先执行 `pnpm db:generate`，再递归执行 workspace `typecheck`。
  - 这样无论在本地还是 CI，只要跑根 `pnpm typecheck`，都会先保证 Prisma Client 已生成。
- `.github/workflows/ci.yml`
  - `test` job 在 `pnpm install --frozen-lockfile` 后显式新增 `pnpm db:generate`。
  - 这样即使后续有人单独调整 `typecheck` 脚本，CI 仍保留一层明确的初始化步骤。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无业务逻辑变更。
- 仅补齐 Prisma 生成流程与 CI 初始化顺序。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 推送到 GitHub 后，优先观察 `test` job 是否已越过 `packages/db` 的类型错误；如果通过，再继续看后续远端 E2E 节点是否有环境差异问题。

## Iteration 4.33（2026-03-22）：补齐 CI 手动触发并消除 pnpm 版本冲突

### 目标

- 让 GitHub Actions 的 `ci` 工作流支持页面手动触发，并修复 `pnpm/action-setup` 与 `packageManager` 同时声明版本导致的启动失败。

### 主要改动

- `.github/workflows/ci.yml`
  - 在 `on` 下新增 `workflow_dispatch`，支持在 GitHub Actions 页面手动运行 `ci`。
  - 移除三个 job 中 `pnpm/action-setup@v4` 的 `with.version` 配置。
  - 现在统一以根 `package.json` 中的 `packageManager: pnpm@10.18.2` 作为 pnpm 唯一版本来源，避免 CI 与仓库声明漂移。

### 迁移/破坏性变更

- 无业务逻辑变更。
- 无数据库 schema 变更。
- 仅调整 CI 触发方式与 pnpm 版本解析策略。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 推送到 GitHub 后，可直接在 `Actions -> ci -> Run workflow` 手动验证远端执行是否通过。

## Iteration 4.32（2026-03-22）：将 Web smoke 烟测拆为独立 CI Job

### 目标

- 把 Web 侧 Playwright smoke 也纳入默认 CI，并与 Admin E2E 分离，降低单个 job 串行耗时与排障复杂度。

### 主要改动

- `package.json`
  - 新增 `pnpm test:e2e:web`，固定以 `PLAYWRIGHT_SCOPE=web` 仅运行 `web-chrome` 项目。
- `.github/workflows/ci.yml`
  - 在现有 `test`、`admin-e2e` 之外新增 `web-e2e` job。
  - Web job 当前执行步骤为：
    - `pnpm install --frozen-lockfile`
    - `pnpm db:generate`
    - `pnpm exec playwright install chromium --with-deps`
    - `pnpm test:e2e:web`
  - 失败时同样上传 `playwright-report` 与 `test-results`，便于定位 Web 端回归。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无业务逻辑变更。
- 仅补充 CI 编排与 Web 端浏览器回归入口。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`
  - `pnpm test:e2e:web`

### 下一步

- 如后续 Web / Admin E2E 继续增长，可再评估抽取公共 CI 步骤或按 smoke / regression 继续分层。

## Iteration 4.31（2026-03-22）：将 Admin Trace 烟测接入 CI

### 目标

- 把已经落地的 Admin 会话详情页烟测接入默认 CI，避免只在本地手动回归。

### 主要改动

- `.github/workflows/ci.yml`
  - 在现有 `test` job 之外新增 `admin-e2e` job。
  - 使用 `pgvector/pgvector:pg16` 作为 GitHub Actions service database。
  - CI 中会顺序执行：
    - `pnpm install --frozen-lockfile`
    - `pnpm db:generate`
    - `pnpm db:migrate:deploy`
    - `pnpm exec playwright install chromium --with-deps`
    - `pnpm test:e2e:admin`
  - 失败时会上传 `playwright-report` 与 `test-results`。
- `playwright.config.ts`
  - 在 CI 环境下，Playwright 项目自动使用 `chromium` channel；
  - 本地继续保持 `chrome` channel，保证开发体验不变。
- `package.json`
  - 新增 `pnpm db:migrate:deploy`，供 CI 非交互应用已有迁移。

### 迁移/破坏性变更

- 无数据库 schema 变更。
- 无业务功能变更。
- 仅补强 CI 流程与测试基础设施。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`
- 本地附加验证：
  - Admin Trace Playwright 用例已在上一轮真实浏览器环境中通过。

### 下一步

- 如需进一步收口，可再把 Web 侧 smoke 也拆成独立 CI job，避免未来 E2E 规模增长后单 job 串行时间过长。

## Iteration 4.30（2026-03-22）：补齐 Admin 会话详情 Trace 的 Playwright 烟测

### 目标

- 用真实浏览器把 Admin 会话详情页的 `规划 Trace / 执行 Trace / 报告 Trace` 串起来回归，避免后续 UI 或运行态协议调整后页面静默失效。

### 主要改动

- `playwright.config.ts`
  - E2E 配置从单一 Web 项目扩展为：
    - `web-chrome`
    - `admin-chrome`
  - 支持通过环境变量控制只启动所需服务：
    - `PLAYWRIGHT_SCOPE=web|admin`
    - `PLAYWRIGHT_SKIP_WEBSERVER=1`
- `package.json`
  - 新增 `pnpm test:e2e:admin`，用于只跑 Admin 侧浏览器烟测。
- `apps/admin/e2e/support/admin-e2e-fixtures.ts`
  - 新增 Admin E2E 测试辅助：
    - 创建临时管理员账号
    - 构造并写入一条带完整 `planningTrace / followUpTrace / assessmentTrace / reportTrace` 的测试会话
    - 通过 API 登录 Admin
    - 测试结束后清理临时数据
- `apps/admin/e2e/session-detail-trace.spec.ts`
  - 新增 Admin 会话详情页烟测。
  - 当前覆盖：
    - 进入会话详情页
    - 查看规划 Trace
    - 展开执行 Trace
    - 查看报告 Trace
    - 校验对话记录正常渲染

### 迁移/破坏性变更

- 无数据库迁移。
- 无业务协议变更。
- 仅补充测试与本地 E2E 配置能力。

### 验证

- 已执行：
  - `pnpm exec playwright test admin/e2e/session-detail-trace.spec.ts --project admin-chrome`（带 `PLAYWRIGHT_SCOPE=admin PLAYWRIGHT_SKIP_WEBSERVER=1`）
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.29（2026-03-22）：为面试报告 Trace 建立离线评测基线

### 目标

- 把 `reportTrace` 纳入可回归的离线评测，避免后续调整评分规则、总结模板或 trace 结构时静默回归。

### 主要改动

- `packages/interview-engine/src/index.ts`
  - 对外导出 `buildInterviewReportResult`，供 `packages/evals` 直接复用纯函数聚合逻辑。
- `packages/evals/src/report-trace-evals.ts`
  - 新增报告评测执行器。
  - 当前会校验：
    - `report` 与 `reportTrace` 的 level / summary / strengths / gaps / nextSteps 一致性
    - `assessmentCount`、`dimensionTraces`、point source 数量等结构正确性
    - 各 case 的等级、分数区间、优势项、短板项、改进建议数量是否符合预期
- `packages/evals/src/report-trace-fixtures.ts`
  - 新增 3 组稳定 fixture：
    - `needs-work`
    - `solid`
    - `strong`
- `packages/evals/src/report-trace-evals.test.ts`
  - 新增逐 case 与整套 suite 两层测试。
- `packages/evals/src/index.ts`
  - 导出新的 report trace eval API 与 fixtures。

### 迁移/破坏性变更

- 无数据库迁移。
- 无运行时协议变更。
- 本次仅补强离线评测基线。

### 验证

- 已执行：
  - `pnpm test -- packages/evals/src/report-trace-evals.test.ts`
  - `pnpm typecheck`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.28（2026-03-22）：Admin 会话详情补齐面试报告 Trace

### 目标

- 在“规划 Trace + 执行 Trace”基础上，再把最终面试报告的聚合过程结构化落地，避免 Admin 端只能看到结果、看不到报告如何推导。

### 主要改动

- `packages/shared/src/types/index.ts`
  - 新增 `InterviewReportTrace` 及其子结构：
    - `InterviewReportDimensionTrace`
    - `InterviewReportPointTrace`
    - `InterviewReportNextStepTrace`
  - `InterviewRuntimeState` 新增 `reportTrace`。
- `packages/interview-engine/src/scoring.ts`
  - 新增 `buildInterviewReportResult`，评分聚合时同时产出：
    - 原有 `InterviewReport`
    - 新的结构化 `InterviewReportTrace`
  - trace 现会记录：
    - 维度均分来源
    - 总分聚合公式
    - level 判定原因
    - strengths / gaps 来源题目
    - nextSteps 从哪些 gaps 推导
    - overallSummary 选中了哪条模板分支
- `packages/interview-engine/src/process-helpers.ts`
  - 完成面试时把 `reportTrace` 写入 runtime。
  - 重新开始面试规划时会清空旧 `report` 与 `reportTrace`，避免跨轮污染。
- `packages/interview-engine/src/process-session-message.ts`
  - 已完成但尚未持久化报告的 completed 会话，现在会一起补写 `reportTrace`。
  - 题目评分完成后会先清空旧 `reportTrace`，确保重新聚合时不会误读脏数据。
- `apps/web`
  - 会话 runtime 的创建、解码、本地缓存标准化逻辑已兼容 `reportTrace`，旧会话自动补 `null`。
- `apps/admin/src/components/session-report-trace-card.tsx`
  - 新增“面试报告 Trace”卡片。
  - 展示内容包括：
    - 总分、等级、聚合规则、模板分支
    - 五个维度均分及每题来源
    - strengths / gaps 来源
    - nextSteps 推导来源
- `apps/admin/src/components/session-detail-view.tsx`
  - 会话详情页更新为：
    - `面试规划 Trace`
    - `面试执行 Trace`
    - `面试报告 Trace`
    - `对话记录`

### 迁移/破坏性变更

- 无数据库迁移。
- 运行态 JSON 新增 `reportTrace` 字段。
- 旧会话与旧本地缓存读取时会自动兼容，不需要手动迁移。

### 验证

- 已执行：
  - `pnpm test -- packages/interview-engine/src/index.test.ts apps/web/src/lib/server/chat-session-ui-state.test.ts`
  - `pnpm typecheck`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.27（2026-03-22）：Admin 会话详情补齐追问与评分执行 Trace

### 目标

- 在已有题单规划 Trace 基础上，把会话执行阶段也接入可视化观测，形成“规划 -> 执行 -> 对话记录”的完整 Agent 调试链路。

### 主要改动

- `packages/shared/src/types/index.ts`
  - 新增 `InterviewFollowUpTrace`、`InterviewAssessmentTrace` 及追问决策枚举。
  - `InterviewRuntimeState` 新增 `followUpTrace`、`assessmentTrace`。
- `packages/interview-engine/src/process-helpers.ts`
  - 追问判定逻辑现在会记录每一轮的决策 trace，包括：
    - 回答摘要
    - 命中/缺失要点
    - 覆盖率
    - 是否触发追问
    - 跳过原因
- `packages/interview-engine/src/scoring.ts`
  - 评分逻辑抽出 `buildAssessmentResult`，同时产出：
    - 原有 `QuestionAssessment`
    - 新的 `InterviewAssessmentTrace`
- `packages/interview-engine/src/process-session-message.ts`
  - 在每题完成评分时，把 `assessmentTrace` 写入 runtime。
- `apps/web`
  - 会话 runtime 的创建、解码、本地缓存标准化逻辑已兼容 `followUpTrace` / `assessmentTrace`，旧会话会自动补默认空数组。
- `apps/admin/src/components/session-execution-trace-card.tsx`
  - 新增“面试执行 Trace”卡片。
  - 按题目聚合展示：
    - 题目元信息
    - 每轮追问决策
    - 最终评分摘要与维度分数
- `apps/admin/src/components/session-detail-view.tsx`
  - 会话详情页接入新的执行 Trace 卡片。

### 迁移/破坏性变更

- 无数据库迁移。
- 运行态 JSON 新增 `followUpTrace` / `assessmentTrace` 字段。
- 旧会话与旧本地缓存已在读取时自动兼容，不需要手动迁移。

### 验证

- 已执行：
  - `pnpm typecheck`
  - `pnpm test -- packages/interview-engine/src/index.test.ts apps/web/src/lib/server/chat-session-ui-state.test.ts`
  - Playwright 实际登录 Admin，并验证会话详情页新的执行 Trace 卡片可正常渲染、展开且控制台无 warning/error
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.26（2026-03-22）：Admin 会话详情接入面试规划 Trace 面板

### 目标

- 让 Admin 会话详情页可以直接查看题单规划过程，作为 Hybrid RAG / LangGraph 调试与展示入口，而不是只能看最终聊天记录。

### 主要改动

- `apps/admin/src/lib/chat-session-runtime.ts`
  - 新增 Admin 侧 runtime 解码 helper。
  - 统一把数据库里的会话 runtime 规范化为可安全展示的结构，后续可继续扩展评分 trace、追问 trace。
- `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - 会话详情页新增 runtime 解析并传给客户端视图。
  - 详情页消息归一化逻辑改为复用 `isSystemMessage`，避免欢迎语判定重复实现。
- `apps/admin/src/components/session-planning-trace-card.tsx`
  - 新增“面试规划 Trace”卡片。
  - 展示内容包括：
    - 检索策略、生成时间、难度配额、必考/可选标签
    - 候选人画像、识别证据、出题说明
    - 最终题单
    - 每个题位的候选题列表、命中题目、标签命中情况和分数拆解
- `apps/admin/src/components/session-detail-view.tsx`
  - 会话详情页接入新的 Trace 卡片。
  - 概览区同步收敛到 antd v5 推荐的 `Descriptions items` 写法。
- `apps/admin/package.json`
  - 补齐 `@mianshitong/shared` workspace 依赖声明，避免 Admin 端直接引用共享类型但未声明依赖。

### 迁移/破坏性变更

- 无数据库迁移。
- 本次仅为 Admin 可视化增强，不影响 Web 端会话写入协议。

### 验证

- 已执行：
  - `pnpm db:generate`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.25（2026-03-22）：Hybrid RAG 烟测基线与核心标签覆盖修正

### 目标

- 为 Hybrid RAG 建立更接近真实线上行为的端到端烟测基线，并修正“四题场景下核心标签覆盖不足”的规划问题。

### 主要改动

- `packages/db/scripts/seed-question-bank-rag-fixtures.mjs`
  - 新增题库检索测试种子脚本，可批量生成 60 条前端题库 fixture，并支持 `--reset / --cleanup`。
- `scripts/smoke-hybrid-rag.mjs`
  - 新增基于真实 `/api/chat/stream` 的 Hybrid RAG 端到端烟测。
  - 校验项从“底层向量召回”提升为“Web 实际题单规划结果 + `planningTrace.strategy`”，更符合真实用户链路。
- `package.json`
  - `retrieval:smoke` 改为运行新的端到端烟测脚本。
- `packages/interview-engine/src/interview-planning.ts`
  - 调整 `mustIncludeTags` 生成规则：
    - `1` 题场景覆盖前 `1` 个核心标签
    - `2-3` 题场景覆盖前 `2` 个核心标签
    - `4` 题及以上场景覆盖前 `3` 个核心标签
  - 修复 `React + TypeScript + 工程化` 这类复合画像下，题单长期被“多标签重合题”挤占，导致 React 核心方向不出题的问题。
- `packages/interview-engine/src/interview-planning.test.ts`
  - 新增回归测试，锁定“四题场景覆盖前三个核心标签”的行为。

### 迁移/破坏性变更

- 无新增数据库迁移。
- 若要在本地复现 Hybrid RAG 烟测，需要先保证：
  - `pnpm db:up`
  - `pnpm db:migrate`
  - `pnpm retrieval:seed-fixtures -- --reset`
  - `EMBEDDING_PROVIDER=ollama pnpm retrieval:backfill`
- 当前不再把“纯向量最近邻排序”视为有效回归基线，因为真实线上链路是“向量候选召回 + hybrid 重排 + 规划层多题编排”。

### 验证

- 已执行：
  - `pnpm test -- packages/interview-engine/src/interview-planning.test.ts packages/interview-engine/src/index.test.ts packages/evals/src/question-planning-evals.test.ts`
  - `pnpm retrieval:smoke`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.24（2026-03-22）：pgvector 持久化与 Web 侧自动向量检索接入

### 目标

- 把 Hybrid RAG 从“只有向量契约”推进到“数据库可持久化 + Web 端可自动启用”的可运行状态，为后续真实 embedding 回填与 RAG 调优打基础。

### 主要改动

- `packages/db/prisma/schema.prisma`
  - 新增 `QuestionRetrievalDoc` 模型，独立维护题目检索文本、标准化标签、embedding 元数据与向量列。
  - `QuestionBankItem` 与检索文档建立一对一关系，删除题目时级联删除索引文档。
- `packages/db/prisma/migrations/20260322183000_add_question_retrieval_doc/migration.sql`
  - 自定义迁移中启用 `vector` extension。
  - 新建 `QuestionRetrievalDoc` 表与检索元数据索引。
- `compose.yaml`
  - 本地数据库镜像切换为 `pgvector/pgvector:pg16`，保证开发环境可执行 `vector` 扩展迁移。
- `packages/llm`
  - 新增 `OllamaEmbeddingProvider`，基于 Ollama `/api/embed` 生成批量 embedding。
- `packages/interview-engine`
  - `planInterviewFromSource` / `processSessionMessage` 支持注入 `QuestionRetriever` 与 `retrievalStrategy`。
  - 规划 trace 的 `strategy` 现在可以区分 `hybrid-lexical-v1` 与 `hybrid-vector-v1`。
- `apps/web/src/lib/server/question-retriever.ts`
  - 新增 Web 侧 retriever resolver。
  - 当 `EMBEDDING_PROVIDER=ollama` 且库中存在当前模型版本的有效 embedding 时，自动启用 `pgvector + hybrid rerank`。
  - 若 embedding 未回填或检索无结果，则自动回退 lexical retriever。
- `apps/admin`
  - 题库新增/编辑后自动同步 `QuestionRetrievalDoc` 元数据。
  - 当题目内容变更时，会主动清空旧 embedding，避免读到脏向量。
- `packages/db/scripts/backfill-question-embeddings.mjs`
  - 新增 embedding 回填脚本。
  - 根脚本入口增加 `pnpm retrieval:backfill`，用于批量生成或重建题库向量。
- `env.example`
  - 新增 `EMBEDDING_PROVIDER`、`EMBEDDING_VERSION`、`OLLAMA_EMBED_MODEL`、`OLLAMA_EMBED_DIMENSIONS` 配置占位。

### 迁移/破坏性变更

- 本次引入了新的数据库迁移。拉取后需要执行：
  - `pnpm db:up`
  - `pnpm db:migrate`
  - `pnpm retrieval:backfill`
- 只有完成回填后，Web 端才会自动切到向量检索；否则仍保持 lexical 模式，不影响现有功能。
- 当前未加 `ivfflat/hnsw` 向量索引，原因是现阶段列维度按“可变维度 + 版本化”设计，题库规模在 MVP 阶段也足以先接受顺序扫描；后续确定单一 embedding 模型后再补高性能索引更稳。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`
  - `pnpm db:generate`

## Iteration 4.23（2026-03-22）：Vector Retriever 契约与 Fallback 机制落地

### 目标

- 在不引入数据库迁移的前提下，把向量召回所需的接口、分数协议与 fallback 机制提前收口，为后续 `pgvector` 接入做最后一层准备。

### 主要改动

- `packages/llm/src/contracts.ts`
  - 新增 `EmbeddingProvider` 与 `EmbeddingInput` 协议，明确 embedding 能力归属 `packages/llm`。
- `packages/retrieval/src/question-retrieval.ts`
  - 检索分数拆解新增 `semantic` 字段。
  - `searchQuestionDocs` 支持接收可选的 `semanticScoresByQuestionId`，便于做混合重排。
  - 提供统一的 query text 构造函数，供 lexical 与 vector 检索共用。
- `packages/retrieval/src/vector-question-retriever.ts`
  - 新增 `QuestionVectorStore` 与 `createVectorQuestionRetriever`。
  - 支持：
    - embedding query
    - vector 候选召回
    - semantic 分数注入
    - 无结果时回退 lexical retriever
- `packages/retrieval/src/index.ts`
  - 导出 vector retriever 相关接口。
- `packages/retrieval/src/question-retrieval.test.ts`
  - 新增两类回归测试：
    - vector 候选经标签/难度重排后命中更合适题目
    - vector 无结果时自动 fallback 到 lexical 检索
- `packages/interview-engine/src/interview-planning.ts`
  - planning trace 分数拆解同步增加 `semantic` 字段，保证未来切换向量召回时 trace 协议不需要再变。

### 迁移/破坏性变更

- 当前默认出题仍走 lexical retriever。
- 新增的 vector retriever 还只是接口与组装层，未接真实 `pgvector` 存储。

### 验证

- 已执行：
  - `pnpm --filter @mianshitong/llm typecheck`
  - `pnpm --filter @mianshitong/shared typecheck`
  - `pnpm --filter @mianshitong/retrieval typecheck`
  - `pnpm --filter @mianshitong/interview-engine typecheck`
  - `pnpm test -- packages/retrieval/src/question-retrieval.test.ts packages/interview-engine/src/index.test.ts packages/evals/src/question-planning-evals.test.ts`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.22（2026-03-22）：Retriever Adapter 抽象落地

### 目标

- 把规划层对具体检索实现的依赖进一步隔离，使后续接入 `pgvector / embeddings` 时只需要新增检索 adapter，而不用重写 `interview-planning`。

### 主要改动

- `packages/retrieval/src/question-retrieval.ts`
  - 新增 `QuestionRetriever` 接口。
  - 新增 `createLexicalQuestionRetriever`，把当前词法检索包装成异步 adapter。
- `packages/retrieval/src/index.ts`
  - 导出 retriever 接口与 lexical adapter。
- `packages/retrieval/src/question-retrieval.test.ts`
  - 新增 adapter 回归测试，确认 lexical 检索可以通过统一接口异步调用。
- `packages/interview-engine/src/interview-planning.ts`
  - `pickNextQuestion` / `buildQuestionPlanFromBlueprint` 改为依赖 `QuestionRetriever`。
  - 规划层不再直接调用具体词法检索函数，只在入口处创建默认 lexical retriever。

### 迁移/破坏性变更

- 无外部行为变化，本次是内部架构收敛。
- 当前默认检索实现仍是 lexical hybrid；后续只需新增 vector retriever adapter 即可替换。

### 验证

- 已执行：
  - `pnpm --filter @mianshitong/retrieval typecheck`
  - `pnpm --filter @mianshitong/interview-engine typecheck`
  - `pnpm test -- packages/retrieval/src/question-retrieval.test.ts packages/interview-engine/src/index.test.ts packages/evals/src/question-planning-evals.test.ts`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.21（2026-03-22）：题单规划离线 Eval 基线落地

### 目标

- 为 `ResumeProfile -> InterviewBlueprint -> Retrieval -> QuestionPlan` 链路建立第一版离线回归评测，确保后续优化检索或接入向量召回时有稳定基线。

### 主要改动

- `packages/evals`
  - 新增独立 workspace 包，承载题单规划评测逻辑与样例。
- `packages/evals/src/question-planning-evals.ts`
  - 新增题单规划评测执行器，支持逐条 case 运行与整套 suite 运行。
  - 当前校验维度包括：题目数量、关键标签覆盖、难度下限/上限、关键题命中、planning trace 存在性。
- `packages/evals/src/question-planning-fixtures.ts`
  - 新增两组题单评测样例：
    - 初级 React 候选人
    - 资深工程化/性能候选人
  - 样例刻意按“当前策略真实行为”建模，强调标签相关性优先，而不是伪造严格配额。
- `packages/evals/src/question-planning-evals.test.ts`
  - 新增参数化回归测试，校验单 case 与整套 suite 都能通过。
- `packages/evals/src/index.ts`
  - 导出评测执行器与内置样例，便于后续接 CLI 或 CI。
- `pnpm-lock.yaml`
  - 同步 workspace 新增包。

### 迁移/破坏性变更

- 无线上链路变更，本次仅新增离线 Eval 能力。

### 验证

- 已执行：
  - `pnpm --filter @mianshitong/evals typecheck`
  - `pnpm test -- packages/evals/src/question-planning-evals.test.ts`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.20（2026-03-22）：面试规划 Trace Snapshot 落地

### 目标

- 为题单规划过程补齐可持久化的结构化 trace，记录“每个题位为什么选到这道题”，为后续调试页、Eval 与向量检索演进打基础。

### 主要改动

- `packages/shared/src/types/index.ts`
  - 新增 `InterviewPlanningTrace`、`InterviewPlanningStepTrace`、`InterviewPlanningCandidateTrace` 等运行态协议。
  - `InterviewRuntimeState` 新增 `planningTrace` 字段。
- `packages/interview-engine/src/interview-planning.ts`
  - 题单规划现在会为每个题位记录目标难度、检索模式、偏好标签、未覆盖必考标签、候选题 top 5 与最终选中结果。
  - `planInterviewFromSource` 返回 `planningTrace`，和 `questionPlan` 一起进入运行态。
- `packages/interview-engine/src/process-helpers.ts`
  - 会话从 `idle` 切到 `interviewing` 时，把本次规划 trace 写入 `runtime.planningTrace`。
- `packages/interview-engine/src/session-core.ts`
  - 运行态初始化与克隆逻辑补齐 `planningTrace` 深拷贝。
- `apps/web/src/lib/server/chat-session-ui-state.ts`
  - 解码数据库 runtime 时兼容旧会话：缺少 `planningTrace` 的历史数据会自动补为 `null`。
- `apps/web/src/app/chat/lib/chat-local-session.ts`
  - 本地缓存会话标准化时补齐 `planningTrace`，避免旧 IndexedDB 数据结构不一致。
- `apps/web/src/lib/server/chat-session-ui-state.test.ts`
  - 新增旧 runtime 兼容测试。
- `packages/interview-engine/src/index.test.ts`
  - 新增规划 trace 回归断言。

### 迁移/破坏性变更

- 运行态 JSON 新增 `planningTrace` 字段。
- 旧数据库会话与旧本地缓存已在读取时自动兼容，无需手动迁移。

### 验证

- 已执行：
  - `pnpm --filter @mianshitong/shared typecheck`
  - `pnpm --filter @mianshitong/interview-engine typecheck`
  - `pnpm --filter @mianshitong/web typecheck`
  - `pnpm test -- packages/interview-engine/src/index.test.ts apps/web/src/lib/server/chat-session-ui-state.test.ts`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.19（2026-03-22）：Hybrid RAG 第一阶段检索层落地

### 目标

- 把题库检索从 `interview-planning` 内嵌规则里抽出来，形成一个可继续演进到向量检索的独立检索层。

### 主要改动

- `packages/retrieval`
  - 新增独立 workspace 包，承载题库检索文档构建与检索排序逻辑。
  - 提供 `buildQuestionRetrievalDocs` 与 `searchQuestionDocs` 两个核心接口，先落地“元数据过滤 + 词法召回 + 标签/难度重排”。
  - 检索结果保留 `score`、`matchedTags`、`lexicalOverlap` 等结构化信息，便于后续接入 Trace、Eval 和向量召回。
- `packages/interview-engine/src/interview-planning.ts`
  - 删除内嵌候选题打分逻辑，改为通过 `@mianshitong/retrieval` 完成每个题位的候选检索。
  - 规划层只保留蓝图生成、难度配额编排、必须标签覆盖与标签均衡控制。
  - 当前题单生成链路正式收敛为 `ResumeProfile -> InterviewBlueprint -> Retrieval -> QuestionPlan`。
- `packages/interview-engine/package.json`
  - 新增对 `@mianshitong/retrieval` 的依赖。
- `packages/retrieval/src/question-retrieval.test.ts`
  - 新增检索包测试，覆盖文档构建、必须标签优先、排除题目与相邻难度补位等核心行为。
- `pnpm-lock.yaml`
  - 同步 workspace 依赖关系。

### 迁移/破坏性变更

- 当前 Hybrid RAG 第一阶段仍是词法检索实现，尚未接入 `pgvector/embedding`；但 `packages/retrieval` 的接口已按“可替换检索后端”设计，后续可以在不改规划层的情况下切换向量召回。

### 验证

- 已执行：
  - `pnpm install --no-frozen-lockfile`
  - `pnpm --filter @mianshitong/retrieval typecheck`
  - `pnpm --filter @mianshitong/interview-engine typecheck`
  - `pnpm test -- packages/retrieval/src/question-retrieval.test.ts packages/interview-engine/src/index.test.ts`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.15（2026-03-22）：Admin 提交面二次收口

## Iteration 4.16（2026-03-22）：Web 端 AI 面试 Agent 架构设计

## Iteration 4.17（2026-03-22）：AI 面试 Agent Phase 1 骨架落地

## Iteration 4.18（2026-03-22）：统一 Guest 本地链路到 Agent 流程

### 目标

- 让未登录 Guest 本地会话也能走与远端持久化会话相同的 AI 面试 Agent 主链路，避免“远端可用、本地仍是旧聊天模式”的体验割裂。

### 主要改动

- `apps/web/src/app/api/chat/stream/route.ts`
  - 新增对本地 `session` 载荷的识别。
  - 当本地会话开始模拟面试或已处于 interviewing 状态时，直接调用 `processSessionMessage` 和题库规划逻辑，返回完整 session。
  - 普通聊天仍走原有通用模型流式分支。
- `apps/web/src/app/chat/hooks/use-local-send-message.ts`
  - 调用 Guest 流式接口时附带本地完整 session。
  - 优先消费 SSE `done` 事件中的完整 session，再回落到旧的 `assistantContent` 拼装逻辑。
- `apps/web/src/app/chat/lib/chat-local-stream-handler.ts`
  - 支持缓存 `done` 事件返回的完整 session。
- `apps/web/src/app/chat/lib/chat-local-stream-handler.test.ts`
  - 新增完整 session 场景测试。
- `apps/web/src/app/chat/lib/chat-api.ts`
  - Guest 流式请求类型新增可选 `session` 字段。

### 迁移/破坏性变更

- Guest 本地会话在“开始模拟面试”后不再仅依赖通用流式模型回复，而会切入与远端一致的 interview-engine 主链路。
- 普通聊天链路保持不变。

### 验证

- 已执行：
  - `pnpm typecheck`
  - `pnpm test`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 目标

- 把 Web 端模拟面试从“建会话时就生成固定题单”升级为“开始面试时由 Agent 规划题单”的第一阶段骨架。

### 主要改动

- `packages/interview-engine/package.json`
  - 新增 `@langchain/langgraph` 与 `@langchain/core` 依赖，用于承载 Phase 1 图编排骨架。
- `packages/shared/src/types/index.ts`
  - 新增 `ResumeProfile`、`InterviewBlueprint`、`WeightedTag` 等类型。
  - 扩展 `InterviewRuntimeState`，补充画像、蓝图、规划摘要与生成时间字段。
- `packages/interview-engine/src/interview-planning.ts`
  - 新增 LangGraphJS 规划图。
  - 第一阶段用规则节点实现 `ResumeProfile -> InterviewBlueprint -> QuestionPlan`，为后续真实 LLM Skill/RAG 节点预留图结构。
- `packages/interview-engine/src/process-helpers.ts`
  - `idle -> interviewing` 改为先调用规划图，再写入 `runtime.questionPlan`、画像与蓝图。
  - 新增规划摘要消息与题库为空时的兜底提示。
- `packages/interview-engine/src/process-session-message.ts`
  - 改为异步，支持在开始面试时注入题库参与规划。
- `packages/interview-engine/src/session-core.ts`
  - 建会话时不再预生成 `questionPlan`。
  - 新增面试启动命令清洗逻辑。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/route.ts`
  - 在非流式消息接口中按需加载题库，并接入异步 `processSessionMessage`。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`
  - 远端持久化会话的流式链路新增 interview-engine 分支。
  - 当用户开始模拟面试或已处于 interviewing 状态时，直接返回 Agent 生成后的完整会话。
- `apps/web/src/lib/server/chat-session-model.ts`
  - 草稿会话创建时不再生成题单。
- `apps/web/src/lib/server/chat-session-repository.ts`
  - 新增 `saveOrCreateUserSession`，兼容首次发消息时前端只有草稿会话 ID 的场景。
  - 移除建会话与普通消息追加时不再需要的题库查询。
- `apps/web/src/app/chat/lib/chat-local-session.ts`
  - 同步扩展本地会话 runtime 结构。

### 迁移/破坏性变更

- Web 端远端持久化会话链路中，“开始模拟面试”现在会在开始时即时生成题单，而不是依赖建会话时预生成的题单。
- Guest 本地流式链路当前尚未接入同一套 Agent 骨架，后续需要再统一。

### 验证

- 已执行：
  - `pnpm typecheck`
  - `pnpm test`
- 待执行完整检查：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 目标

- 在正式实现 Web 端“基于简历和标签的出题机制”前，先确定一个既能体现 AI Agent 工程能力、又兼顾产品可用性的整体架构方案。

### 主要改动

- `docs/InterviewAgentArchitecture.md`
  - 新增 Web 端 AI 面试 Agent 架构设计文档。
  - 明确采用“核心链路 Agent 化，外围保持标准 Web 工程”的总体方案。
  - 设计 `ResumeProfile -> InterviewBlueprint -> Hybrid RAG -> QuestionPlan` 的出题链路。
  - 设计 LangGraphJS 主图、子图、状态模型、Skills、Memory、Trace 与 Eval 方案。
  - 给出与当前代码的衔接点以及分阶段落地计划。
- `docs/ProjectContext.md`
  - 同步记录新的架构结论，并将新文档加入项目文档清单。

### 迁移/破坏性变更

- 暂无代码级破坏性变更，本次仅完成设计收敛。
- 后续实现时，Web 端抽题主控制轴需要从固定 `topics` 迁移到 `tags`，且 `questionPlan` 生成时机需要从“创建会话时”调整为“开始模拟面试时”。

### 验证

- 待执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 目标

- 在进入 Web 出题机制设计前，再清理一轮 Admin 提交面，去掉明显多余的配置和遗留文件。

### 主要改动

- `apps/admin/src/app/layout.tsx`
  - 更新后台 metadata，移除过时的“模型配置管理”描述。
- `apps/admin/src/components/admin-shell.tsx`
  - 删除未使用的 `description` props，保留仍被题目新建/编辑页使用的 `hideHeader`，收窄页面壳层 API。
- `apps/admin/src/app/globals.css`
  - 移除未使用的 `tw-animate-css` 全局导入与无实际用途的 `dark` 自定义变体声明。
- `apps/admin/next.config.ts`
  - 收窄 `transpilePackages`，只保留实际被 Admin 引用的 `@mianshitong/db`。
- `apps/admin/package.json`
  - 删除未实际使用的 `@mianshitong/shared`、`tw-animate-css` 依赖声明。
- `apps/admin/src/app/favicon.ico`
  - 删除旧 favicon 文件，避免与 `icon.svg` 图标约定冲突。

### 验证

- 待同步 lockfile 后执行完整检查。

### 下一步

- 若本轮检查通过，则 Admin 可作为当前阶段的可提交基线。

## Iteration 4.13（2026-03-22）：Admin MVP 上线前加固

### 目标

- 补足 Admin 端最关键的上线前安全与稳定性问题。

### 主要改动

- `apps/admin/src/lib/admin-security.ts`
  - 新增管理员安全助手，提供登录失败限流、来源 IP 提取、可选 IP 白名单校验。
- `apps/admin/src/app/api/admin/login/route.ts`
  - 登录接口增加来源校验与失败限流，成功登录后清理失败计数。
- `apps/admin/src/app/api/admin/logout/route.ts`
  - 退出接口增加来源校验。
- `apps/admin/src/app/api/question-bank/items/route.ts`
  - 新建题目接口改为使用统一校验逻辑，严格校验难度、标签、序号与布尔字段。
- `apps/admin/src/app/api/question-bank/items/[id]/route.ts`
  - 编辑题目接口改为使用统一校验逻辑，拒绝非法字段值。
- `apps/admin/src/app/api/question-bank/batch-delete/route.ts`
  - 批量删除接口增加来源校验。
- `apps/admin/src/app/api/users/[userId]/route.ts`
  - 删除用户接口增加来源校验。
- `apps/admin/src/app/api/sessions/[sessionId]/route.ts`
  - 删除会话接口增加来源校验。
- `apps/admin/src/lib/question-bank-validation.ts`
  - 新增题库请求体验证助手，复用新建/编辑接口的数据校验逻辑。
- `apps/admin/src/lib/session-messages.ts`
  - 抽离系统欢迎语识别与可见消息计数逻辑。
- `apps/admin/src/app/sessions/page.tsx`
  - 会话列表改为复用统一消息统计逻辑。
- `apps/admin/src/app/users/[userId]/page.tsx`
  - 修复为 Next 16 兼容的异步 `params` 读取，并统一消息数统计口径。
- `apps/admin/src/components/question-bank-options.ts`
  - 新增 `QuestionLevelValue` 与难度校验函数，并收紧标签规范化逻辑。
- `env.example`
  - 新增可选环境变量 `ADMIN_ALLOWED_IPS` 示例说明。

### 迁移/破坏性变更

- 如需启用 Admin 访问白名单，需在环境变量中配置 `ADMIN_ALLOWED_IPS`。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.14（2026-03-22）：Admin 提交前清理

### 目标

- 清理 Admin 中已失效的旧组件、孤儿路由和多余数据字段，确保提交面干净。

### 主要改动

- `apps/admin/src/components/question-editor-modal.tsx`
  - 删除旧的题目弹窗编辑组件，当前题目编辑已统一为独立页面。
- `apps/admin/src/app/users/[userId]/page.tsx`
  - 删除没有入口的用户详情页，当前“查看会话”统一跳转到会话列表并自动按用户 ID 过滤。
- `apps/admin/src/components/user-sessions-table.tsx`
  - 随用户详情页一并删除其专用表格组件。
- `apps/admin/src/components/questions-table-card.tsx`
  - 移除题库列表行模型中不再使用的字段。
- `apps/admin/src/app/questions/page.tsx`
  - 列表查询结果仅保留表格实际需要的数据，减少无用序列化字段。

### 迁移/破坏性变更

- `/users/[userId]` 页面不再提供。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.12（2026-03-21）：移除题库上传功能

### 目标

- 后台题库暂时只保留单题维护能力，移除“上传题库”功能。

### 主要改动

- `apps/admin/src/components/questions-table-card.tsx`
  - 移除“上传题库”入口按钮。
  - 题库空状态文案改为“题库暂无题目，请先新建。”。
- `apps/admin/src/app/questions/upload/page.tsx`
  - 删除上传题库页面。
- `apps/admin/src/app/questions/upload/upload-form.tsx`
  - 删除上传表单实现。
- `apps/admin/src/components/question-upload-view.tsx`
  - 删除上传视图组件。
- `apps/admin/src/app/api/question-bank/import/route.ts`
  - 删除题库导入接口。
- `docs/QuestionBank.md`
  - 当前能力调整为单题新建，上传 markdown + AI 解析改为后续扩展项。

### 迁移/破坏性变更

- `/questions/upload` 页面与 `/api/question-bank/import` 接口不再提供。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.05（2026-03-15）：题库方向并入标签

### 目标

- 合并题库“方向/标签”，仅保留标签字段并支持预置 + 自定义。

### 主要改动

- `packages/db/prisma/schema.prisma`
  - 移除 `QuestionBankItem.topic` 字段。
- `packages/db/prisma/migrations/20260315130000_merge_question_topic_into_tags/migration.sql`
  - 迁移历史 `topic` 到 `tags` 并清理后删除列。
- `packages/shared/src/types/index.ts`
  - `InterviewQuestion` 改为可选 `topic`，题目主字段以 `tags` 为准。
- `packages/interview-engine/src/question-plan.ts`
  - 抽题逻辑改为按标签匹配配置方向并派生主方向。
- `packages/interview-engine/src/scoring.ts`
  - 评分记录支持可选 `topic`。
- `apps/admin/src/app/questions/page.tsx`
  - 列表筛选改为标签过滤。
- `apps/admin/src/components/question-editor-form.tsx`
  - 移除方向字段，标签支持预置 + 自定义。
- `apps/admin/src/components/question-bank-options.ts`
  - 统一标签预置与规范化函数。
- `apps/admin/src/app/api/question-bank/*`
  - 新建/更新/导入接口移除方向字段并规范化标签。
- `apps/web/src/lib/server/question-bank-repository.ts`
  - 题库读取去除 `topic` 字段映射。

### 迁移/破坏性变更

- 需要执行 Prisma 迁移以删除 `QuestionBankItem.topic` 列并回填标签。

### 下一步

- 如需更精细的标签分层，再考虑标签分组与统计。

## Iteration 4.04（2026-03-14）：新建题目页滚动条贴边

### 目标

- 新建题目页主滚动条贴近浏览器右侧边框。

### 主要改动

- `apps/admin/src/app/questions/new/page.tsx`
  - 内容区移除右侧内边距，避免滚动条内缩。
- `apps/admin/src/components/question-create-view.tsx`
  - 将内边距下沉到内容容器，保持标题与卡片对齐。

### 迁移/破坏性变更

- 无。

### 下一步

- 无。

## Iteration 4.03（2026-03-14）：去除控件聚焦阴影

### 目标

- 进一步减弱表单控件聚焦时的厚重感。

### 主要改动

- `apps/admin/src/app/globals.css`
  - 将 Ant Design 控件聚焦时的 `box-shadow` 置为 `none`。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需轻微聚焦提示，可改为 1px 半透明描边。

## Iteration 4.02（2026-03-14）：收敛表单聚焦外圈

### 目标

- 降低表单控件聚焦外圈的视觉厚度。

### 主要改动

- `apps/admin/src/app/globals.css`
  - 覆盖 Ant Design 输入/选择/按钮等聚焦样式，减少 box-shadow 厚度并调整边框色。

### 迁移/破坏性变更

- 无。

### 下一步

- 如仍偏厚，可进一步移除按钮聚焦阴影。

## Iteration 4.01（2026-03-14）：移除全局聚焦外圈

### 目标

- 去掉全局 `outline` 聚焦外圈，避免表单边框显得过粗。

### 主要改动

- `apps/admin/src/app/globals.css`
  - 移除 `outline-ring/50` 的全局应用。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需保留可访问性焦点样式，可改为仅对非 antd 元素启用 `:focus-visible`。

## Iteration 4.00（2026-03-14）：题目标签下拉预选项

### 目标

- 新建题目标签下拉提供与列表筛选一致的预选项。

### 主要改动

- `apps/admin/src/components/question-bank-options.ts`
  - 新增 `QUESTION_TAG_OPTIONS`，基于方向选项生成标签预选。
- `apps/admin/src/components/question-editor-form.tsx`
  - 标签选择器接入预选项，保持可自由输入。

### 迁移/破坏性变更

- 无。

### 下一步

- 无。

## Iteration 3.98（2026-03-14）：新建题目页改为 Flex 布局

### 目标

- 头部高度 56px、标题 20px。
- 页面使用 Flex 布局，header/footer 固定高度，中间主体可滚动。

### 主要改动

- `apps/admin/src/components/question-create-view.tsx`
  - 新建题目页改为 Flex 布局，header/footer 定高，主区域滚动。
  - 底部操作按钮水平居中。
- `apps/admin/src/app/questions/new/page.tsx`
  - 自定义内容区样式，避免外层滚动干扰。
- `apps/admin/src/components/admin-shell.tsx`
  - 支持传入 `contentStyle` 覆盖内容区样式。
- `apps/admin/src/components/question-create-form.tsx`
  - 删除旧的表单容器组件（已合并到视图组件）。

### 迁移/破坏性变更

- 无。

### 下一步

- 无。

## Iteration 3.97（2026-03-14）：新建题目页头部固定定位调整

### 目标

- 新建题目页头部固定在内容区顶部，返回与标题合并展示。

### 主要改动

- `apps/admin/src/components/question-create-view.tsx`
  - 头部改为固定定位并补充背景/分隔线。
  - 调整容器偏移，避免与内容区顶边距叠加。

### 迁移/破坏性变更

- 无。

### 下一步

- 无。

## Iteration 3.96（2026-03-14）：新建题目页组件拆分与渲染修复

### 目标

- 修复新建题目页渲染时组件类型异常问题。

### 主要改动

- `apps/admin/src/components/question-create-view.tsx`
  - 新增客户端视图组件，承载头部与卡片布局。
- `apps/admin/src/app/questions/new/page.tsx`
  - 页面改为引用客户端视图组件，避免在服务端直接渲染 Antd 组件。

### 迁移/破坏性变更

- 无。

### 下一步

- 无。

## Iteration 3.95（2026-03-14）：新建题目页头部与底部操作区调整

### 目标

- 返回按钮使用图标并与会话详情一致。
- 新建题目页头部改为绝对定位，底部操作按钮水平居中。
- 去掉表单底部额外留白。

### 主要改动

- `apps/admin/src/components/back-button.tsx`
  - 返回按钮改为 `LeftOutlined` 图标。
- `apps/admin/src/app/questions/new/page.tsx`
  - 自定义绝对定位头部，包含返回按钮与标题。
  - 通过 `hideHeader` 关闭默认头部渲染。
- `apps/admin/src/components/admin-shell.tsx`
  - 新增 `hideHeader` 以支持页面自定义头部。
- `apps/admin/src/components/question-create-form.tsx`
  - 移除底部 `padding-bottom`，按钮居中显示。

### 迁移/破坏性变更

- 无。

### 下一步

- 无。

## Iteration 3.94（2026-03-14）：题库新建页返回与底部操作栏对齐

### 目标

- 新建题目页返回按钮与会话详情一致。
- 底部操作按钮改为固定 footer，不随页面滚动。

### 主要改动

- `apps/admin/src/components/back-button.tsx`
  - 返回按钮仅显示 `<`，与会话详情页保持一致。
- `apps/admin/src/components/question-create-form.tsx`
  - 保存操作区改为底部 footer 包裹并固定在底部。

### 迁移/破坏性变更

- 无。

### 下一步

- 无。

## Iteration 3.93（2026-03-14）：题库管理一期（模型字段 + 管理端 CRUD）

### 目标

- 题库模型扩展为可运营/可评分结构，并在后台完成基础 CRUD 与筛选。

### 主要改动

- `packages/db/prisma/schema.prisma`
  - 题库新增 `answer/tags/rubric/order` 字段。
- `packages/db/prisma/migrations/20260314120000_question_bank_upgrade/migration.sql`
  - 新增题库字段迁移。
- `packages/shared/src/types/index.ts`
  - `InterviewQuestion` 增加 `answer/tags/rubric` 可选字段。
- `apps/web/src/lib/server/question-bank-repository.ts`
  - 题库读取增加 `tags/rubric/answer` 映射与排序字段。
- `apps/admin/src/app/questions/page.tsx`
  - 题库列表支持筛选与分页。
- `apps/admin/src/components/questions-filter.tsx`
  - 新增筛选表单（方向/难度/状态/关键词）。
- `apps/admin/src/components/questions-table-card.tsx`
  - 新增新建/编辑/删除/批量删除/启用开关与表格展示。
- `apps/admin/src/components/question-editor-modal.tsx`
  - 新增题目编辑弹窗。
- `apps/admin/src/components/question-editor-form.tsx`
  - 表单字段拆分以控制文件规模。
- `apps/admin/src/components/question-row-actions.tsx`
  - 行操作菜单组件。
- `apps/admin/src/app/api/question-bank/items/route.ts`
  - 新增创建题目接口。
- `apps/admin/src/app/api/question-bank/items/[id]/route.ts`
  - 新增更新/删除题目接口。
- `apps/admin/src/app/api/question-bank/batch-delete/route.ts`
  - 新增批量删除接口。
- `apps/admin/src/app/api/question-bank/import/route.ts`
  - 导入支持 `answer/tags/rubric/order` 字段。
- `docs/QuestionBank.md`
  - 同步更新题库设计（字段与阶段方案）。

### 迁移/破坏性变更

- 需要执行 Prisma 迁移以新增题库字段。

### 下一步

- 如果需要简历匹配与 RAG，进入题库二期。

## Iteration 3.92（2026-03-12）：移除管理员 name 字段

### 目标

- 管理员账号仅保留邮箱与密码，不再存储 name。

### 主要改动

- `packages/db/prisma/schema.prisma`
  - 移除 `AdminUser.name`。
- `packages/db/prisma/migrations/20260312164000_remove_admin_user_name/migration.sql`
  - 新增迁移，删除 `AdminUser.name` 列。
- `apps/admin/src/lib/admin-auth.ts`
  - 移除 `name` 相关类型与 token 字段。
- `apps/admin/src/app/api/admin/login/route.ts`
  - 查询与 session payload 不再包含 `name`。
- `scripts/create-admin-user.mjs`
  - 移除 `name` 参数与写入。
- `apps/admin/src/components/admin-shell.tsx`
  - `adminUser` 类型不再包含 `name`。

### 迁移/破坏性变更

- 需要执行一次 Prisma 迁移以删除 `AdminUser.name` 列。

### 下一步

- 若已有旧脚本或数据依赖 name，需同步清理。

## Iteration 3.91（2026-03-12）：移除表格标题列的 Antd Tooltip 以修复水合

### 目标

- 修复会话表格标题列的 hydration mismatch。

### 主要改动

- `apps/admin/src/components/sessions-table.tsx`
  - 标题列改为原生省略 + `title`，不再用 Antd `Typography.Text` 的 tooltip。
- `apps/admin/src/components/user-sessions-table.tsx`
  - 标题列改为原生省略 + `title`。
- `apps/admin/src/app/globals.css`
  - 新增 `.admin-ellipsis` 统一省略样式。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要自定义 tooltip，可改为客户端渲染或受控组件。

## Iteration 3.90（2026-03-12）：会话标题存全，UI 负责省略

### 目标

- 会话标题不再在数据层写入 `...`，仅在 UI 中做省略展示。

### 主要改动

- `packages/interview-engine/src/session-core.ts`
  - 会话标题生成不再截断。
- `apps/web/src/app/chat/lib/chat-message-mutations.ts`
  - 前端会话标题生成不再截断。
- `apps/web/src/lib/server/chat-store.ts`
  - 服务端会话标题生成不再截断。
- `apps/web/src/lib/server/chat-session-model.ts`
  - 持久化会话标题生成不再截断。
- `apps/web/src/app/chat/lib/chat-local-session.ts`
  - 游客会话标题生成不再截断。
- `apps/web/src/app/api/chat/sessions/[sessionId]/route.ts`
  - 标题重命名不再强制截断。
- `apps/web/src/app/chat/lib/chat-local-storage.ts`
  - 本地重命名不再强制截断。
- `apps/admin/src/components/sessions-table.tsx`
  - 标题列改为 UI 省略展示（Tooltip 提示完整内容）。
- `apps/admin/src/components/user-sessions-table.tsx`
  - 标题列改为 UI 省略展示（Tooltip 提示完整内容）。
- `apps/web/src/app/chat/lib/chat-message-mutations.test.ts`
  - 测试断言调整为完整标题。

### 迁移/破坏性变更

- 既有会话标题仍为历史截断值，无法自动恢复。

### 下一步

- 如需修复历史标题，可按“首条用户消息”回填一次性脚本。

## Iteration 3.89（2026-03-12）：账号菜单样式强制覆盖

### 目标

- 确保账号下拉菜单为黑底白字，不被 Antd 主题覆盖。

### 主要改动

- `apps/admin/src/app/globals.css`
  - 对账号下拉菜单背景、边框、阴影增加 `!important`。
  - 菜单项颜色与背景强制覆盖，避免还原为白底。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需更细化，仅对退出项做高亮可再加 class。

## Iteration 3.88（2026-03-12）：账号名称省略与菜单黑底白字

### 目标

- 账号名称超长时省略显示。
- 退出菜单项黑底白字。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 账号按钮结构拆分为图标、名称、箭头，便于文本省略。
- `apps/admin/src/app/globals.css`
  - 账号区域新增专用样式，确保省略生效并增强菜单文字对比度。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需箭头随展开状态旋转，可改为受控 `open` 状态。

## Iteration 3.87（2026-03-12）：侧栏账号箭头与菜单配色调整

### 目标

- 账号名称超长保持省略显示，右侧箭头向上。
- 下拉菜单黑底白字。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 账号区域箭头图标改为向上。
- `apps/admin/src/app/globals.css`
  - 下拉菜单背景与文字色调整为黑底白字。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需箭头随展开状态旋转，可再加受控 `open` 状态。

## Iteration 3.86（2026-03-12）：禁止 Body 滚动避免侧栏留白

### 目标

- 页面滚动时左侧导航不出现底部留白。

### 主要改动

- `apps/admin/src/app/globals.css`
  - `html/body` 设为 `height: 100%` 且 `overflow: hidden`，仅内容区滚动。

### 迁移/破坏性变更

- 无。

### 下一步

- 若仍出现空白，可进一步检查内容区高度计算与内层滚动容器。

## Iteration 3.85（2026-03-12）：侧栏账号信息固定到底部

### 目标

- 账号信息始终贴在左侧导航的浏览器窗口最底部。

### 主要改动

- `apps/admin/src/app/globals.css`
  - 为 Sider 子容器设置纵向 flex，确保底部区域可以吸底。

### 迁移/破坏性变更

- 无。

### 下一步

- 若仍有偏移，考虑关闭侧栏内容区域的滚动或进一步收敛内边距。

## Iteration 3.84（2026-03-12）：侧栏账号信息对齐参考样式

### 目标

- 登录后账号信息固定在左侧导航最底部，样式与 image1.png/image2.png 对齐。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 账号块放到侧栏底部，按钮结构增加用户图标与下拉指示。
  - Dropdown 调整为 `topLeft` 弹出，并使用自定义 class。
- `apps/admin/src/app/globals.css`
  - 新增账号按钮与下拉菜单样式（背景、边框、hover）。

### 迁移/破坏性变更

- 无。

### 下一步

- 若仍需更精细的像素对齐，可微调按钮高度与内边距。

## Iteration 3.59（2026-03-12）：后台会话详情展示系统消息

### 目标

- 会话详情页的对话记录包含 system 角色消息，便于完整排查上下文。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - 新增 system 角色展示：使用灰色 Tag 标记为“系统”。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要，可进一步按角色提供筛选/折叠能力。

## Iteration 3.60（2026-03-12）：后台导航水合一致性修复

### 目标

- 修复 Admin 侧栏导航在 SSR/CSR 首帧选择态不一致导致的 hydration warning。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 首帧不渲染选中态，等待客户端挂载后再设置 `selectedKeys`。

### 迁移/破坏性变更

- 无。

### 下一步

- 若仍出现 hydration warning，进一步定位具体组件与差异 DOM。

## Iteration 3.61（2026-03-12）：移除 question-bank 包并收敛到 interview-engine

### 目标

- 彻底移除 `packages/question-bank`，避免和“题库入库”路线冲突。

### 主要改动

- 新增 `packages/interview-engine/src/question-plan.ts`，承接题目规划算法。
- `apps/web` 与 `packages/interview-engine` 改为引用 `interview-engine` 内部的 `buildQuestionPlan`。
- 移除 `packages/question-bank` 包与 `apps/web` 的 transpile 配置。

### 迁移/破坏性变更

- 需要重新执行 `pnpm install` 以刷新 lockfile 中的 workspace 依赖。

### 下一步

- 如需对题目规划算法做可视化调参，可再补后台配置入口。

## Iteration 3.62（2026-03-12）：会话详情将系统提示与对话记录拆分展示

### 目标

- 避免会话记录首条显示系统提示造成“AI 先发起”的误解。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - system 消息改为“系统提示”独立展示，不再混入对话记录列表。
  - “消息数”统计仅计算用户与 AI 消息。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需彻底隐藏系统提示，可直接移除该区块。

## Iteration 3.63（2026-03-12）：后台详情页隐藏 system 消息

### 目标

- 系统提示不混入对话记录，避免产生“AI 先发起”的误解。

### 主要改动

- `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - 归一化消息时保留 `kind` 字段。
- `apps/admin/src/components/session-detail-view.tsx`
  - 过滤 `role === 'system'` 或 `kind === 'system'` 的消息。
  - “消息数”统计仅含用户与 AI 消息。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需展示系统提示，可改为折叠区块或开关。

## Iteration 3.64（2026-03-12）：兼容历史会话的 system 欢迎语过滤

### 目标

- 兼容历史会话中缺少 `kind=system` 的欢迎语，避免统计与展示异常。

### 主要改动

- `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - 在归一化阶段识别欢迎语内容并强制标记为 `kind=system`。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需彻底去掉系统欢迎语，可考虑迁移数据时清理该消息。

## Iteration 3.65（2026-03-12）：移除会话初始系统欢迎语

### 目标

- 新建会话不再写入系统欢迎语，数据库只保留真实对话内容。

### 主要改动

- `apps/web/src/lib/server/chat-session-model.ts`
  - 新建会话默认消息列表改为空数组。
- `apps/web/src/app/chat/lib/chat-local-session.ts`
  - 游客会话不再注入系统消息。
- `packages/interview-engine/src/session-factory.ts`
  - 引擎新会话默认消息列表为空。
- `apps/admin/src/app/sessions/page.tsx`
  - 会话列表消息数排除 system / 欢迎语。
- 测试同步调整：
  - `apps/web/src/app/chat/lib/chat-local-session.test.ts`
  - `packages/interview-engine/src/index.test.ts`

### 迁移/破坏性变更

- 无。

### 下一步

- 如需清理历史记录中的欢迎语，可额外补一次性清理脚本。

## Iteration 3.66（2026-03-12）：会话列表操作按钮改为 hover 显示

### 目标

- 会话列表的操作按钮仅在 hover/聚焦时显示，降低视觉噪音。

### 主要改动

- `apps/admin/src/components/sessions-table.tsx`
  - 操作按钮包裹 `admin-row-actions` 容器。
- `apps/admin/src/app/globals.css`
  - 表格行 hover/聚焦时展示操作按钮。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需统一用户列表操作显示方式，可复用同一规则。

## Iteration 3.67（2026-03-12）：会话列表操作菜单改为 hover 触发

### 目标

- 会话列表操作菜单与用户列表一致，hover 即展开。

### 主要改动

- `apps/admin/src/components/session-row-actions.tsx`
  - Dropdown 触发方式由 click 改为 hover。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要更精细的 hover 延迟，可补 `mouseEnterDelay`/`mouseLeaveDelay`。

## Iteration 3.68（2026-03-12）：移除侧栏提示文案并收紧全局圆角

### 目标

- 去掉“仅限内部管理使用”文案。
- 全局圆角略微收紧，减少过圆视觉。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 移除侧栏底部提示文案。
- `apps/admin/src/components/admin-providers.tsx`
  - ConfigProvider `borderRadius` 从 10 调整为 6。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要细化到组件级圆角，可在 `theme.components` 中覆盖。

## Iteration 3.69（2026-03-12）：Admin 侧栏固定，内容区独立滚动

### 目标

- 滚动时仅右侧内容区滚动，左侧导航栏保持不动。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - Layout 设为 `100vh` 且 `overflow: hidden`。
  - 侧栏固定高度并 `position: sticky`。
  - 内容区开启独立滚动 `overflow: auto`。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需侧栏折叠，可在此基础上补充。

## Iteration 3.70（2026-03-12）：总数文案移动到分页器

### 目标

- 用户/会话列表的“共 X 条”文案放到分页器区域展示。

### 主要改动

- `apps/admin/src/components/admin-pagination.tsx`
  - 新增 `totalLabel` 并使用 `showTotal` 显示总数文案。
- `apps/admin/src/app/users/page.tsx`
  - 传入 `totalLabel="位用户"`。
- `apps/admin/src/app/sessions/page.tsx`
  - 传入 `totalLabel="条会话"`。
- `apps/admin/src/components/users-table.tsx`
  - 移除表格上方总数文案。
- `apps/admin/src/components/sessions-table.tsx`
  - 移除表格上方总数文案。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需 showTotal 同时展示区间范围，可扩展 `showTotal` 格式。

## Iteration 3.71（2026-03-12）：移除页面描述文案

### 目标

- 去掉各页面标题下的说明文案，保持界面简洁。

### 主要改动

- 移除以下页面的 `description`：
  - `apps/admin/src/app/page.tsx`
  - `apps/admin/src/app/users/page.tsx`
  - `apps/admin/src/app/sessions/page.tsx`
  - `apps/admin/src/app/questions/page.tsx`
  - `apps/admin/src/app/templates/page.tsx`
  - `apps/admin/src/app/users/[userId]/page.tsx`
  - `apps/admin/src/app/sessions/[sessionId]/page.tsx`

### 迁移/破坏性变更

- 无。

### 下一步

- 如需对某些页面保留轻量提示，可改为分区标题或空状态提示。

## Iteration 3.72（2026-03-12）：分页器右下对齐

### 目标

- 分页器放在表格右下角对齐展示。

### 主要改动

- `apps/admin/src/components/admin-pagination.tsx`
  - 使用容器 `flex-end` 对齐，确保分页器在右下角。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需与表格左右边距进一步对齐，可加统一的表格容器 padding。

## Iteration 3.73（2026-03-12）：会话筛选右对齐与分页器可选页数

### 目标

- 会话筛选表单右对齐。
- 分页器支持 10/20/30/50/100 的页数切换。

### 主要改动

- `apps/admin/src/components/sessions-filter.tsx`
  - 表单 `justifyContent: flex-end` 右对齐。
- `apps/admin/src/components/admin-pagination.tsx`
  - 启用 `showSizeChanger`，并设置 `pageSizeOptions`。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要记住用户的 pageSize 偏好，可引入 query 或本地存储。

## Iteration 3.74（2026-03-12）：筛选清空自动触发

### 目标

- 筛选项清空时自动触发筛选。

### 主要改动

- `apps/admin/src/components/sessions-filter.tsx`
  - 增加 `onValuesChange`，字段变更（含清空）即触发筛选。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需避免频繁跳转，可加防抖。

## Iteration 3.75（2026-03-12）：会话/用户操作文案与详情滚动

### 目标

- 统一操作菜单文案，并限制对话记录区域高度。

### 主要改动

- `apps/admin/src/components/user-row-actions.tsx`
  - 删除文案改为“删除用户”。
- `apps/admin/src/components/session-row-actions.tsx`
  - 查看改为“查看详情”，删除改为“删除会话”。
- `apps/admin/src/components/session-detail-view.tsx`
  - 对话记录加入可滚动容器，避免页面滚动过长。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需可配置高度，可抽成常量或 token。

## Iteration 3.76（2026-03-12）：对话记录滚动条贴边

### 目标

- 对话记录滚动条贴近右侧边框展示。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - 去掉滚动容器右侧内边距。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要滚动条样式优化，可增加自定义 scrollbar 样式。

## Iteration 3.77（2026-03-12）：对话记录滚动容器改为 Card body

### 目标

- 滚动条贴近卡片右边框，同时保留内容内边距。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - 使用 `Card` 的 `bodyStyle` 取消默认内边距。
  - 将滚动容器放在卡片 body，内容内边距移入内层包裹。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要统一滚动高度，可抽出常量。

## Iteration 3.78（2026-03-12）：对话记录内边距调整

### 目标

- 对话记录内容内边距从 16 调整为 24。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - 内层容器 padding 改为 24。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需进一步统一卡片内边距，考虑抽取到样式变量。

## Iteration 3.79（2026-03-12）：Card bodyStyle 迁移为 styles.body

### 目标

- 修复 Antd Card `bodyStyle` 弃用警告。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - `bodyStyle` 替换为 `styles.body`。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需统一卡片样式，考虑抽为共享样式对象。

## Iteration 3.80（2026-03-12）：后台整体背景改为白色

### 目标

- 全局背景色从 `#f5f7fb` 调整为 `#fff`。

### 主要改动

- `apps/admin/src/components/admin-providers.tsx`
  - `colorBgBase` 改为 `#ffffff`。
- `apps/admin/src/app/layout.tsx`
  - `body` 背景改为 `#ffffff`。
- `apps/admin/src/components/admin-shell.tsx`
  - Layout 背景改为 `#ffffff`。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需统一卡片与页面留白层级，可再做微调。

## Iteration 3.81（2026-03-12）：用户/会话表格显示边框

### 目标

- 用户与会话表格开启边框显示。

### 主要改动

- `apps/admin/src/components/users-table.tsx`
  - 表格 `bordered` 开启。
- `apps/admin/src/components/sessions-table.tsx`
  - 表格 `bordered` 开启。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需统一表格 header 背景色，可在主题 token 里微调。

## Iteration 3.82（2026-03-12）：对话记录高度按视口计算

### 目标

- 对话记录滚动区域高度按视口计算，底部与窗口保持 24px 间距。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - 使用 `useLayoutEffect` 根据元素位置与窗口高度计算 `maxHeight`。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要随内容区滚动实时更新，可补充滚动监听。

## Iteration 3.83（2026-03-12）：对话记录高度基于内容区计算

### 目标

- 避免全局滚动条，改为基于内容滚动容器计算对话记录高度。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 内容区域增加 `admin-content-scroll` 标识。
- `apps/admin/src/components/session-detail-view.tsx`
  - 使用内容容器高度计算 `maxHeight`，并监听容器尺寸变化。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需更精细的高度控制，可改为 CSS `calc` 常量方案。

## Iteration 3.84（2026-03-12）：对话记录底部留白容错

### 目标

- 避免偶发全局滚动条，允许底部留白略大于 24px。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - 计算高度时额外收紧底部间距（从 24 调整为 48）。

### 迁移/破坏性变更

- 无。

### 下一步

- 若仍出现滚动条，可改为固定 max-height 或改为 CSS `calc`。

## Iteration 3.85（2026-03-12）：操作菜单去除图标

### 目标

- 操作菜单项不显示前置图标，保持简洁。

### 主要改动

- `apps/admin/src/components/user-row-actions.tsx`
  - 去掉“查看会话 / 删除用户”菜单图标。
- `apps/admin/src/components/session-row-actions.tsx`
  - 去掉“查看详情 / 删除会话”菜单图标。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需调整菜单项间距，可继续微调。

## Iteration 3.86（2026-03-12）：侧栏导航图标与配色优化

### 目标

- 左侧导航加入图标并优化配色层级。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 导航项增加图标，侧栏背景与文字色调整。
- `apps/admin/src/app/globals.css`
  - 优化暗色侧栏的 hover/selected 背景与文字色。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需折叠侧栏或收起仅图标模式，可继续扩展。

## Iteration 3.87（2026-03-12）：侧栏标题左内边距调整

### 目标

- 侧栏标题“面试通”左侧内边距改为 28px。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 标题 padding-left 调整为 28px。

### 迁移/破坏性变更

- 无。

## Iteration 3.88（2026-03-12）：会话操作按钮常驻

### 目标

- 会话管理表格的“...”操作按钮常驻显示。

### 主要改动

- `apps/admin/src/components/sessions-table.tsx`
  - 移除 `admin-row-actions` 容器，操作按钮常驻。

### 迁移/破坏性变更

- 无。

## Iteration 3.89（2026-03-12）：侧栏菜单水合告警规避

### 目标

- 修复 antd Menu 在 SSR/CSR 生成 Tooltip id 不一致导致的 hydration warning。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 仅在客户端挂载后渲染 Menu，避免首帧 id 不一致。

### 迁移/破坏性变更

- 无。

## Iteration 3.90（2026-03-12）：后台管理员登录与侧栏显示

### 目标

- 后台加入登录能力（无注册），管理员由数据库预置。
- 登录后在侧栏底部展示管理员信息，并支持退出登录。

### 主要改动

- Prisma 新增 `AdminUser` 模型，并增加迁移。
- 新增后台登录页与登录/退出 API：
  - `apps/admin/src/app/login/page.tsx`
  - `apps/admin/src/app/api/admin/login/route.ts`
  - `apps/admin/src/app/api/admin/logout/route.ts`
- 新增管理员会话签名与校验逻辑：
  - `apps/admin/src/lib/admin-auth.ts`
- 新增密码哈希辅助脚本：
  - `scripts/hash-admin-password.mjs`
- 新增管理员账号创建脚本：
  - `scripts/create-admin-user.mjs`
- 所有后台页面与操作 API 加入管理员校验，并把管理员信息传入侧栏：
  - `apps/admin/src/components/admin-shell.tsx`
  - `apps/admin/src/app/**/*`
- `env.example` 新增 `ADMIN_AUTH_SECRET`。

### 迁移/破坏性变更

- 新增 `AdminUser` 表，需要执行数据库迁移。

### 下一步

- 如需更强安全策略，可加登录失败次数限制与日志审计。

## Iteration 3.91（2026-03-12）：管理员创建脚本修复依赖解析

### 目标

- 修复 `create-admin-user` 脚本无法解析 `@prisma/client` 的问题。

### 主要改动

- `scripts/create-admin-user.mjs`
  - 使用 `createRequire` 指向 `packages/db` 的 `package.json` 来解析 Prisma Client。

### 迁移/破坏性变更

- 无。

## Iteration 3.92（2026-03-12）：管理员创建脚本适配 Prisma 7

### 目标

- 修复 Prisma 7 需要 Adapter 配置导致的初始化失败。

### 主要改动

- `scripts/create-admin-user.mjs`
  - 使用 `PrismaPg` 并传入连接串初始化 `PrismaClient`。

### 迁移/破坏性变更

- 无。

## Iteration 3.93（2026-03-12）：管理员会话读取兼容 Next 16

### 目标

- 修复 Next 16 `cookies()` 返回 Promise 导致的 `get is not a function` 报错。

### 主要改动

- `apps/admin/src/lib/admin-auth.ts`
  - `getAdminSession` 改为异步并 `await cookies()`。
  - 相关调用链改为 await。

### 迁移/破坏性变更

- 无。

## Iteration 3.94（2026-03-12）：登录页 message 上下文修复

### 目标

- 修复 antd message 静态方法导致的上下文告警。

### 主要改动

- `apps/admin/src/app/login/page.tsx`
  - 使用 `App.useApp().message` 替代静态 `message`。

### 迁移/破坏性变更

- 无。

## Iteration 3.95（2026-03-12）：侧栏管理员信息区样式优化

### 目标

- 优化侧栏底部管理员信息区的排版与间距。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 调整管理员信息区的布局、文字溢出与退出按钮样式。

### 迁移/破坏性变更

- 无。

## Iteration 3.96（2026-03-12）：管理员信息改为邮箱 + 退出菜单

### 目标

- 侧栏只显示管理员邮箱，点击后弹出退出菜单。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 管理员信息改为邮箱按钮 + Dropdown 菜单，仅含“退出登录”。

### 迁移/破坏性变更

- 无。

## Iteration 3.97（2026-03-12）：修复 Dropdown TS 语法兼容

### 目标

- 修复 Turbopack 不支持 `satisfies` 的解析错误。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 移除 `satisfies MenuProps`，改为直接传 `menu`。

### 迁移/破坏性变更

- 无。

## Iteration 3.73（2026-03-12）：会话概览标签列宽与去冒号

### 目标

- 会话概览 label 固定宽度 100px，去掉 label 后的冒号。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - `Descriptions` 设置 `colon={false}` 与 `styles.label` 宽度。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要更细粒度的对齐，可改为 `items` API 并逐项设置 span。

## Iteration 3.74（2026-03-12）：详情页标题与返回按钮同排

### 目标

- 优化会话详情页返回按钮样式，并将其放在标题左侧。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 标题与 `headerPrefix` 同排布局。
- `apps/admin/src/components/back-button.tsx`
  - 调整按钮尺寸与内边距，增强对齐效果。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需进一步调整 icon 与标题间距，可微调 `gap`。

## Iteration 3.75（2026-03-12）：返回按钮改为纯图标

### 目标

- 返回按钮仅显示图标，不显示“返回”文字。

### 主要改动

- `apps/admin/src/components/back-button.tsx`
  - 使用 `LeftOutlined` 图标，移除文字内容。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需改为圆形背景按钮，可在此基础上增加样式。

## Iteration 3.76（2026-03-12）：返回图标改为箭头并放大

### 目标

- 返回按钮使用 “<-” 风格图标，并调整尺寸为 16px。

### 主要改动

- `apps/admin/src/components/back-button.tsx`
  - 图标改为 `ArrowLeftOutlined`，并设置 `fontSize: 16`。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需 hover 背景或圆角按钮，再补样式。

## Iteration 3.77（2026-03-12）：返回按钮尺寸调整

### 目标

- 返回按钮宽度改为 32px，图标更粗体。

### 主要改动

- `apps/admin/src/components/back-button.tsx`
  - 宽度设为 32px，高度保持 24px，图标字号 16px，并设置 `fontWeight: 700`。

### 迁移/破坏性变更

- 无。

### 下一步

- 如需更明显的粗体效果，可更换为 `ArrowLeftFilled` 或自定义 SVG。

## Iteration 3.58（2026-03-11）：后台改用 shadcn ui + Tailwind

### 目标

- Admin 与 Web 技术栈对齐，统一使用 shadcn/ui 与 Tailwind CSS。

### 主要改动

- `apps/admin` 接入 Tailwind v4：
  - 新增 `postcss.config.mjs`，更新 `globals.css` 使用 `@import 'tailwindcss'`。
- 新增 admin 侧 shadcn ui 组件与工具：
  - `components/ui/*`（button/card/badge/input/textarea/table/select/checkbox）
  - `lib/utils.ts`（`cn`）
- Admin 页面改为 Tailwind + shadcn 组件：
  - 概览、用户、会话、题库、模板页统一改为 Card/Table/Badge/Button 结构。
  - 表单与上传入口改为 shadcn Input/Select/Checkbox。
- 移除 admin 原有 CSS Modules 样式文件。

### 迁移/破坏性变更

- 无接口变更，仅前端渲染层重构。

### 下一步

- 可补 admin 主题切换与响应式收敛。

## Iteration 3.57（2026-03-11）：后台 MVP 初始化与题库数据库化

### 目标

- 按“用户管理 + 会话管理 + 题库上传 + 模板配置”的顺序落地后台最小可用能力。
- 题库不再放在单独 package 数据里，转为数据库存储。

### 主要改动

- 后台页面结构与基础功能：
  - 新增 `AdminShell` 与统一布局，覆盖概览/用户/会话/题库/模板页面。
  - 概览页展示用户、会话、题库、模板数量。
  - 用户页与会话页支持基础列表查看。
  - 题库页支持上传入口与题目列表查看。
  - 模板页支持创建模板与模板列表查看。
- 题库数据库化：
  - Prisma 新增 `QuestionBankItem`、`InterviewTemplate` 模型。
  - 新增后台上传接口 `/api/question-bank/import` 写入题库。
  - `buildQuestionPlan` 支持传入题库数据，默认不再内置题库。
  - `createDraftSession` 在服务端创建会话时加载题库并生成 `questionPlan`。
- 清理题库 package 中的本地存储与 JSON 数据文件，避免数据冗余。

### 迁移/破坏性变更

- 新增 Prisma 模型需要执行迁移后才能在本地数据库生效。

### 下一步

- 根据需要补齐题库删除/禁用、模板编辑与筛选能力。
- 增加后台权限与审计日志。

## Iteration 3.56（2026-03-11）：新增面试通 favicon SVG

### 目标

- 为面试通提供一个与产品定位匹配的 favicon，并直接接入 Next.js App Router 的 `icon.svg`。

### 主要改动

- 新增 `apps/web/src/app/icon.svg`：
  - 蓝色渐变底 + 白色对话气泡 + 勾选符号，表达“对话 + 通过/认可”的产品语义。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需要 `.ico` 或多尺寸打包，可基于该 SVG 再生成并替换 `apps/web/src/app/favicon.ico`。

## Iteration 3.55（2026-03-11）：本地化 cspell schema

### 目标

- 解决 VS Code 无法加载远程 cspell schema 的问题，避免提示“Location ... is untrusted”。

### 主要改动

- 新增本地 schema 文件：
  - `schemas/cspell.schema.json`
- `cspell.json` 改为引用本地 schema：
  - `$schema: "./schemas/cspell.schema.json"`

### 迁移/破坏性变更

- 无。

### 下一步

- 若升级 cspell 版本，可重新拉取 schema 以保持一致。

## Iteration 3.54（2026-03-11）：调整浅色主题删除项 hover 背景

### 目标

- 修正浅色主题下会话菜单“删除”项 hover 背景色过重的问题。

### 主要改动

- `apps/web/src/app/chat/components/chat-sidebar-session-item.tsx`
  - 删除项 hover 背景从 `hover:bg-destructive/80` 调整为 `hover:bg-destructive/10`，保留红色文字与暗色主题样式。

### 迁移/破坏性变更

- 无。

### 下一步

- 若需继续对齐参考图，可再微调为 `hover:bg-destructive/20`。

## Iteration 3.53（2026-03-11）：聊天页错误提示从底部迁移到顶部 Toast

### 目标

- 去掉聊天页底部“请求失败”类红字提示，改为更轻量的顶部 toast 展示，降低打断感与视觉噪音。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`
  - 移除底部 `notice` 文本渲染。
  - 统一在顶部 toast 展示 `notice/ toast`，`notice` 用红色样式区分错误态。
- `apps/web/src/app/chat/hooks/use-chat-controller-effects.ts`
  - 为 `notice` 增加与 `toast` 一致的 1.8s 自动清理机制，避免错误提示常驻。

### 迁移/破坏性变更

- 无。

### 下一步

- 若后续需要区分“可恢复错误/致命错误”，可在 `notice` 上增加错误等级并扩展 toast 样式。

## Iteration 2.48（2026-03-06）：聊天页对齐 既定产品基线（删除交互 + 游客本地存储 + 登录态 DB 存储）

### 目标

- 对齐聊天页交互：
  - 去掉右上角锁图标与私有切换能力；
  - 侧栏支持“删除全部会话”和“单条会话删除”；
  - 游客会话落浏览器 IndexDB，登录用户会话落 PostgreSQL。

### 主要改动

- 聊天页 UI 与交互调整：
  - 移除 `ChatHeader` 的锁图标按钮及对应切换逻辑；
  - 侧栏头部将设置图标替换为删除图标（`title/aria-label: 删除所有聊天记录`），点击执行全部删除；
  - 侧栏会话项改为 hover 显示右侧删除图标，支持单条删除。
- 游客本地会话存储（IndexDB）：
  - 新增本地会话仓库：`chat-local-storage.ts`（`list/get/save/delete/clear`）；
  - 新增本地会话构建与流式上下文工具：`chat-local-session.ts`；
  - 新增游客发送/编辑流式 hooks：`use-local-send-message.ts`、`use-local-edit-message.ts`；
  - 游客模式下刷新页面后，会话可从本地恢复。
- 登录用户数据库会话存储（PostgreSQL + Prisma）：
  - Prisma 新增 `ChatSessionRecord` 模型，并关联 `AuthUser`；
  - 新增迁移：`20260306035454_add_chat_session_record`；
  - 聊天 API 路由改为鉴权后读写 DB（含列表、详情、单删、全删、流式发送、流式编辑）。
- 新增游客无状态流式接口：
  - `POST /api/chat/stream`，接收游客本地上下文 `messages`，仅做模型流式返回，不落库。
- 水合稳定性修复：
  - 为聊天页模型选择器增加 SSR 安全渲染策略，清除登录态下 Radix Select 的 hydration warning。

### 迁移/破坏性变更

- `GET/POST/DELETE /api/chat/sessions` 及相关子路由现在要求登录态（未登录返回 `401`）。
- 游客模式不再依赖服务端会话列表接口，改为浏览器 IndexDB 本地持久化。

### 下一步

- 如需更完整对齐 既定产品基线，可继续补“删除确认弹窗”和“游客登录后本地会话一键导入账号”。

## Iteration 2.47（2026-03-06）：修复聊天页误显示 system 欢迎语

### 目标

- 修复 `/chat` 点击快捷提问后，消息列表额外显示“欢迎语”导致的对话内容错位问题。

### 主要改动

- 前端消息渲染层增加可见消息过滤：
  - `apps/web/src/app/chat/components/chat-message-list.tsx` 新增 `visibleMessages`；
  - 对 `role === 'system'` 或 `kind === 'system'` 的消息不再渲染到对话区。
- 加载态判断同步对齐：
  - `isLoading` 的末条消息判断改为基于 `visibleMessages`，避免隐藏消息干扰 loading 气泡定位。
- 回归验证：
  - `pnpm -C apps/web lint`、`pnpm -C apps/web typecheck` 通过；
  - Playwright 实测点击“可以帮我优化简历吗？”后，仅显示用户消息与 AI 回复，不再出现 system 欢迎语。

### 迁移/破坏性变更

- 无接口变化；仅调整前端展示层消息过滤逻辑。

### 下一步

- 若你希望侧边栏会话摘要也隐藏 system 内容，可进一步在 summary 计算处过滤首条 system 消息。

## Iteration 2.46（2026-03-06）：修复 `schema.prisma` 的 Prisma 7 配置报错

### 目标

- 消除 `schema.prisma` 中 `datasource.url` 的 Prisma 7 报错，并保持现有 PostgreSQL 认证链路可用。

### 主要改动

- Prisma 升级到 v7：
  - `packages/db` 升级为 `prisma@7.4.2`、`@prisma/client@7.4.2`；
  - 新增 `@prisma/adapter-pg@7.4.2` 与 `pg@8.16.3`。
- 配置迁移到 `prisma.config.ts`：
  - 新增 `packages/db/prisma.config.ts`，在配置文件中声明 `datasource.url`；
  - `packages/db/prisma/schema.prisma` 的 `datasource db` 移除 `url` 字段，仅保留 `provider`。
- Prisma Client 初始化方式调整：
  - `packages/db/src/client.ts` 从 `datasources.db.url` 切换为 `PrismaPg adapter` 注入连接串；
  - 保留既有开发默认连接串与生产环境显式配置校验逻辑。
- 回归验证：
  - `pnpm db:migrate` 在 PostgreSQL 下可正常执行（`Already in sync`）；
  - `packages/db` 与 `apps/web` typecheck 均通过。

### 迁移/破坏性变更

- Prisma 运行时模型从“schema 内 `datasource.url` + Client datasources”迁移为“`prisma.config.ts` + `adapter`”。

### 下一步

- 若你希望进一步收敛，可以把 `packages/db` 内部 `prisma:*` 脚本也统一改为走根 `db:*` 包装脚本，减少入口分散。

## Iteration 2.45（2026-03-06）：修复“数据库删用户后仍保持登录态”问题

### 目标

- 当用户记录被删除后，刷新页面应自动退出登录，避免前端仍显示已登录态。

### 主要改动

- 服务端会话校验增强：
  - `apps/web/src/lib/server/auth-user-repository.ts` 新增 `findUserById`；
  - `apps/web/src/lib/server/auth-options.ts` 的 `session callback` 改为每次读取会话时校验 `token.sub` 对应用户是否仍存在；
  - 若用户不存在，清空 `session.user`，避免继续向客户端暴露已失效用户信息。
- 客户端自动清理会话 cookie：
  - `apps/web/src/components/guest-menu.tsx` 新增 effect：
    - 当 `status === 'authenticated'` 但 `session.user` 已为空时，自动执行 `signOut({ redirect: false })` 并 `router.refresh()`；
    - 保障前端状态与服务端真实用户状态一致。
- 回归验证：
  - 登录后手动删除 `AuthUser` 记录并刷新页面，已自动回到 `Guest`。

### 迁移/破坏性变更

- 无接口变化；仅会话有效性校验逻辑增强。

### 下一步

- 若后续需要减少每次 `session` 读取的数据库查询，可引入“短周期校验缓存”策略（例如 token 中记录最近校验时间）。

## Iteration 2.44（2026-03-06）：补齐 `db:migrate` / `db:reset` 数据库脚本

### 目标

- 在已有 `db:*` 基础上补齐“迁移更新”和“清库重建”能力，降低数据库维护门槛。

### 主要改动

- 根脚本增强：
  - 新增 `db:migrate`：执行 `prisma migrate dev`（按迁移更新数据库结构）；
  - 新增 `db:reset`：执行 `prisma migrate reset --force --skip-seed`（清空并按迁移重建）；
  - `db:studio` 改为“优先读取外部 `DATABASE_URL`，未配置时回退本地默认 PG URL”，提升环境兼容性。
- 文档更新：
  - `README.md` 新增 `db:migrate` / `db:reset` 使用说明与风险提示（`db:reset` 为危险操作）。
- 脚本验证：
  - `pnpm db:migrate` 已验证通过（当前提示 `Already in sync`）。

### 迁移/破坏性变更

- `db:reset` 会删除当前数据库数据，请仅在确认需要清库时使用。

### 下一步

- 若你需要，我可以再补一个 `db:seed` 和 `db:reset:seed` 脚本，把“重建 + 初始化测试账号”串成一条命令。

## Iteration 2.43（2026-03-06）：新增数据库一键脚本（启动/连接/查看数据）

### 目标

- 提供统一、低记忆成本的数据库操作入口，支持“快速启动 PostgreSQL 与查看当前数据”。

### 主要改动

- 在仓库根 `package.json` 新增 `db:*` 脚本：
  - `db:up`：启动 `compose` 中的 `db` 服务；
  - `db:down`：停止 `db` 服务；
  - `db:restart`：重启 `db`；
  - `db:status`：查看 `db` 容器状态；
  - `db:logs`：跟踪数据库日志；
  - `db:psql`：进入 PostgreSQL 命令行；
  - `db:studio`：启动 Prisma Studio；
  - `db:users`：快速查看最近 50 条 `AuthUser`。
- `README.md` 新增“数据库快捷命令（PostgreSQL）”章节，统一说明启动与查看数据方式。
- 已实测新脚本：
  - `pnpm db:status` 可正常返回容器健康状态；
  - `pnpm db:users` 可正常查询到当前用户数据。

### 迁移/破坏性变更

- 无破坏性变更；仅新增开发辅助命令。

### 下一步

- 若你希望进一步降低手工操作，可追加 `db:reset`（重建库）与 `db:migrate`（显式执行迁移）脚本。

## Iteration 2.42（2026-03-06）：认证数据层从 SQLite 切回 PostgreSQL

### 目标

- 按项目既定技术栈，把认证数据层从 SQLite 过渡实现切回 PostgreSQL，统一本地与后续线上环境形态。

### 主要改动

- Prisma 数据源切换：
  - `packages/db/prisma/schema.prisma` 的 `datasource db.provider` 从 `sqlite` 改为 `postgresql`；
  - `env.example` 的 `DATABASE_URL` 改为本地 compose 对应连接串：
    - `postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public`
- Prisma 客户端连接策略收敛：
  - `packages/db/src/client.ts` 移除 SQLite 文件路径探测逻辑；
  - 统一优先读取 `DATABASE_URL`，开发环境无显式配置时回退到本地 PostgreSQL 默认连接串；
  - 非开发环境缺失 `DATABASE_URL` 时显式抛错，避免静默连错库。
- 迁移历史重建（Provider 切换要求）：
  - 清理旧的 SQLite 迁移历史与 `dev.db`；
  - 新建并应用 PostgreSQL 初始迁移：
    - `packages/db/prisma/migrations/20260306015753_init_auth_postgres/migration.sql`
  - `migration_lock.toml` 已更新为 `provider = "postgresql"`。

### 迁移/破坏性变更

- 本地开发需启动 PostgreSQL（可用 `compose.yaml` 的 `db` 服务）。
- 旧 SQLite 数据文件不再使用；若有历史测试数据，需按需导入到 PostgreSQL。

### 下一步

- 建议补一条认证 E2E（注册/登录/退出）在 PostgreSQL 环境下执行，防止回归。

## Iteration 2.41（2026-03-06）：修复首页/聊天页用户菜单潜在 hydration mismatch

### 目标

- 消除 `pnpm dev:web` 下偶发的 React hydration warning（SSR HTML 与客户端属性不一致）。

### 主要改动

- 定位并收敛 `GuestMenu` 的水合风险点：
  - `apps/web/src/components/guest-menu.tsx` 移除基于主题切换头像 `src` 的分支渲染；
  - 头像改为固定 `src` + `dark:invert` 样式，避免服务端与客户端首帧属性差异；
  - 保留主题切换逻辑，仅在菜单展开后读取 `resolvedTheme/theme` 计算目标主题。
- 参考 `next-themes` 文档“避免 hydration mismatch”的建议，统一采用“首帧不依赖不稳定主题属性”的渲染策略。
- Playwright 回归：
  - 首页与 `/chat` 首屏加载；
  - 强制深色媒体模式下再次加载；
  - 控制台均未出现 hydration warning。

### 迁移/破坏性变更

- 无接口变化，仅前端渲染细节调整。

### 下一步

- 若你本机浏览器仍提示 hydration mismatch，建议提供完整报错堆栈（含组件路径），我会继续定点清理其余触发源。

## Iteration 2.40（2026-03-06）：对齐 既定产品基线 的注册/登录闭环并修复本地会话漂移

### 目标

- 参考 `既定产品基线` 落地 Email + Password 的注册/登录/退出流程，并保证本地开发（`127.0.0.1`）会话稳定。

### 主要改动

- 认证能力落地（Web + DB）：
  - `apps/web` 新增 NextAuth Credentials 配置与路由；
  - 新增 `/login`、`/register` 页面及复用认证卡片组件；
  - 新增 `/api/auth/register` 注册接口（`zod` 校验 + `bcryptjs` 哈希）；
  - `guest-menu` 接入真实会话状态，已登录显示邮箱并支持退出登录。
- 数据层落地（Prisma）：
  - `packages/db/prisma/schema.prisma` 新增 `AuthUser` 模型；
  - 新增 Prisma client 导出与迁移脚本，完成初始迁移。
- 本地稳定性修复：
  - 修复 `signIn/signOut` 在 `127.0.0.1` 与 `localhost` 间的回跳漂移，统一使用安全相对路径跳转；
  - `auth-options` 补充 `AUTH_SECRET` 读取与开发环境默认值，避免 `NO_SECRET/JWT_SESSION_ERROR`；
  - `env.example` 补充 `NEXTAUTH_URL`；
  - `cspell.json` 补充 `cuid`，恢复拼写检查通过。
- 回归验证（Playwright）：
  - 注册成功后自动登录并回首页；
  - 顶部菜单显示登录邮箱；
  - 退出后恢复 `Guest`；
  - 错误密码登录显示错误提示。

### 迁移/破坏性变更

- 新增认证相关环境变量：
  - `AUTH_SECRET`
  - `NEXTAUTH_URL`
  - `DATABASE_URL`

### 下一步

- 若要完全对齐线上部署，建议将 SQLite 切回项目既定 PostgreSQL，并补充认证 E2E 用例（注册/登录/退出/错误分支）。

## Iteration 2.39（2026-03-05）：回退 chat 局部 UI/编辑状态到 `useState`

### 目标

- 按“仅跨路由/跨层级共享状态才用全局状态”的约束，清理 chat 模块中不必要的 `zustand` 使用。

### 主要改动

- 保留会话域全局状态：
  - `apps/web/src/app/chat/stores/chat-session-store.ts` 继续使用 `zustand` 管理会话主状态（session/model/sending/loading）。
- 回退局部状态到组件内：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 新增本地 `useState` 管理 `inputValue/notice/toast/sidebarOpen/editingMessageId/editingValue`；
  - `apps/web/src/app/chat/hooks/use-chat-controller-store.ts` 收敛为仅聚合 `session` store，不再混入 UI/编辑域。
- 删除不再需要的 store：
  - 删除 `apps/web/src/app/chat/stores/chat-ui-store.ts`；
  - 删除 `apps/web/src/app/chat/stores/chat-edit-store.ts`。

### 迁移/破坏性变更

- 无接口破坏；仅状态管理实现方式调整（局部状态从 zustand 回退为 React 本地状态）。

### 下一步

- 若后续 chat 页面再次出现跨多个分支组件共享局部状态的场景，可优先考虑“局部 context + reducer”，再评估是否上升为 store。

## Iteration 2.38（2026-03-05）：补齐可点击图标/按钮的 `cursor-pointer`

### 目标

- 统一可点击元素的鼠标指针反馈，避免“可点但光标不提示”的交互不一致问题。

### 主要改动

- 全局按钮收敛：
  - `apps/web/src/components/ui/button.tsx` 的 `buttonVariants` 基类新增 `cursor-pointer`，覆盖绝大部分图标按钮与普通按钮。
- 原生按钮补齐：
  - `apps/web/src/components/guest-menu.tsx`：用户菜单触发按钮新增 `cursor-pointer`；
  - `apps/web/src/app/chat/components/chat-sidebar.tsx`：
    - 移动端侧栏遮罩关闭按钮新增 `cursor-pointer`；
    - 会话列表项按钮新增 `cursor-pointer`。

### 迁移/破坏性变更

- 无；仅样式交互提示增强。

### 下一步

- 若你希望范围扩大到 `apps/admin`，可按同样策略补齐后台可点击元素。

## Iteration 2.37（2026-03-05）：清理仓库根目录调试 PNG 截图

### 目标

- 清理未被项目引用的临时截图文件，减少仓库噪音。

### 主要改动

- 删除仓库根目录 3 个未引用的 PNG 文件：
  - `chat-after-send.png`
  - `chat-fixed-after-send.png`
  - `chat-fixed-before-send.png`
- 通过全局搜索确认当前仓库无 `.png` 文件残留，也无代码/文档引用这些截图。

### 迁移/破坏性变更

- 无；仅删除调试产物文件。

### 下一步

- 若后续仍会频繁产出调试截图，可考虑补充 `.gitignore` 规则（例如仅忽略约定命名的截图文件）。

## Iteration 2.36（2026-03-05）：修复发送后会话请求死循环并完成格式化清理

### 目标

- 解决 `/chat` 发送消息后出现“编译/页面持续刷新、请求死循环”的问题，并清理当前 Prettier 存量文件。

### 主要改动

- 死循环根因修复：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 中，传给 `useChatControllerEffects` 的 setter 由包装函数改为直接传递稳定引用（移除 render 期新建函数）；
  - 避免 `useChatControllerEffects` 初始化 effect 因依赖引用变化被重复触发，导致 `fetchSessions` 循环调用。
- 回归验证（Playwright）：
  - 打开 `/chat` 并发送一条消息后，网络请求恢复为预期链路（创建会话、拉会话、流式消息），未再出现 `/api/chat/sessions` 无限请求；
  - 页面未出现持续刷新现象。
- 格式化清理：
  - 已对此前 `format:check` 提示的 12 个文件执行 `prettier --write`；
  - `pnpm format:check` 已恢复通过。

### 迁移/破坏性变更

- 无接口破坏；仅修复 hooks 依赖稳定性与代码格式。

### 下一步

- 可继续补一条端到端用例（发送消息后断言不会重复请求会话列表）防止回归。

## Iteration 2.35（2026-03-05）：修复 chat 页 hydration mismatch（SSR 安全的 zustand 实例化）

### 目标

- 解决 `/chat` 页面出现的 hydration mismatch（服务端 HTML 属性与客户端初始属性不一致）报错。

### 主要改动

- 按 zustand 最新 Next.js 指南，把 chat 三个 store 从模块级全局 `create(...)` 改为实例工厂：
  - `apps/web/src/app/chat/stores/chat-session-store.ts`
  - `apps/web/src/app/chat/stores/chat-ui-store.ts`
  - `apps/web/src/app/chat/stores/chat-edit-store.ts`
  - 三个文件统一改为 `createStore`（`zustand/vanilla`）并导出 `*StoreApi` 类型。
- `apps/web/src/app/chat/hooks/use-chat-controller-store.ts` 改为组件实例级初始化：
  - 使用 `useState` 懒初始化 3 个 store API（每个 `ChatClient` 实例独立）；
  - 使用 `useStore(storeApi, selector)` 订阅状态，保留原有 selector 拆分与行为。
- 保持既有“多 store 拆分”结构，不回退到单体 store；关键文件仍控制在 200 行以内。

### 迁移/破坏性变更

- 无接口破坏；仅 store 初始化策略从“模块级共享”改为“组件实例级隔离”。

### 下一步

- 建议在本地启动 `apps/web` 后手动回归 `/chat` 的首屏与路由往返，确认 hydration 报错不再出现。

## Iteration 2.34（2026-03-05）：拆分 chat store 并收敛文件行数（<=200）

### 目标

- 解决“单一 chat store 过粗”和 `use-chat-controller.ts` 超 200 行的问题，按职责拆分状态管理并保持行为不变。

### 主要改动

- store 按职责拆分：
  - 新增 `apps/web/src/app/chat/stores/chat-session-store.ts`：会话域状态（session/model/sending/loading）；
  - 新增 `apps/web/src/app/chat/stores/chat-ui-store.ts`：UI 域状态（input/notice/toast/sidebar）；
  - 新增 `apps/web/src/app/chat/stores/chat-edit-store.ts`：编辑域状态（editingMessageId/editingValue）；
  - 新增 `apps/web/src/app/chat/stores/types.ts`（共享 `Updater` 类型）；
  - 删除旧的单体 `chat-store.ts`。
- 控制器继续模块化：
  - 新增 `apps/web/src/app/chat/hooks/use-chat-controller-store.ts` 统一聚合多 store selector；
  - 新增 `apps/web/src/app/chat/hooks/use-chat-controller-effects.ts` 管理初始化/响应式副作用；
  - 新增 `apps/web/src/app/chat/hooks/use-chat-controller-actions.ts` 管理事件处理器；
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 收敛为组装层（153 行）。
- 行数约束结果：
  - `use-chat-controller.ts` 与新增模块文件均控制在 200 行以内，符合 AGENTS 约束。

### 迁移/破坏性变更

- 无接口破坏；仅状态管理结构调整（单 store -> 多 store）。

### 下一步

- 可继续按同样方式把 chat 子组件中的 props 进一步收敛，逐步减少跨层参数传递。

## Iteration 2.33（2026-03-05）：聊天页状态迁移到 zustand（全局状态收敛）

### 目标

- 在不改变现有业务行为的前提下，把聊天页分散的本地状态收敛为统一的全局状态管理，降低后续扩展成本。

### 主要改动

- 引入 zustand：
  - `apps/web/package.json` 新增依赖 `zustand`；
  - `apps/web/src/app/chat/stores/chat-store.ts` 新增 chat store，统一管理会话、输入、发送态、提示态、侧栏态、编辑态。
- 控制器改造：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 从 `useState` 迁移为基于 zustand 的 selector + actions（`useShallow`）；
  - 保留原有发送/编辑/复制业务逻辑，仅替换状态读写来源。
- 编辑态进一步收敛：
  - `apps/web/src/app/chat/ChatClient.tsx` 移除本地编辑状态，改为由 controller（底层 store）统一提供；
  - 新增 `start/cancel/submit` 编辑动作，避免页面层散落状态逻辑。
- 类型同步：
  - `apps/web/src/app/chat/hooks/chat-controller.types.ts` 补充编辑态与编辑动作类型，保证组件侧类型约束一致。

### 迁移/破坏性变更

- 无接口破坏；前端行为保持一致，仅状态管理实现方式从 React 本地状态改为 zustand。

### 下一步

- 可继续把 `ChatComposer` / `ChatMessageList` 逐步改为直接按 selector 读取 store，进一步减少 props drilling。

## Iteration 2.32（2026-03-05）：消息“就地编辑 + 复制 Toast”对齐参考交互

### 目标

- 使用 Playwright 对比参考 chat 页后，将用户消息“编辑/复制”行为对齐为更接近目标站点的交互体验。

### 主要改动

- 编辑交互改为“消息气泡内就地编辑”：
  - `apps/web/src/app/chat/components/chat-message-item.tsx` 新增编辑态（输入框 + `Cancel/Send`）；
  - `apps/web/src/app/chat/ChatClient.tsx` 增加编辑态管理；
  - `apps/web/src/app/chat/hooks/use-edit-message.ts` 新增编辑发送链路（流式）。
- 编辑后重生成能力补齐：
  - 新增 API：`apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`；
  - `apps/web/src/lib/server/chat-store.ts` 新增 `truncateSessionFromUserMessage`，用于从被编辑消息处截断会话，再基于新内容重生成后续回复。
- 流式能力复用与收敛：
  - 新增 `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`，抽离 provider 选择、SSE 事件格式化等通用逻辑；
  - 新增 `apps/web/src/app/chat/hooks/stream-event-handler.ts`，统一前端 SSE 事件处理。
- 复制反馈对齐：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 增加短暂 toast 状态；
  - 复制成功/失败改为顶部短时 toast（`Copied to clipboard!` / `Copy failed...`），不再依赖底部文案提示。

### 迁移/破坏性变更

- 新增编辑流式接口路径：`/api/chat/sessions/:sessionId/messages/:messageId/edit/stream`。
- 旧的“编辑后回填到底部输入框”交互已替换为“消息气泡内就地编辑”。

### 下一步

- 可继续补齐“编辑中键盘快捷键（Enter 提交 / Shift+Enter 换行）”与操作按钮 hover 动效，以进一步贴近参考站点细节。

## Iteration 2.31（2026-03-05）：补齐用户消息“编辑/复制”交互

### 目标

- 修复聊天区用户消息的“编辑/复制”交互不可用或体验不一致问题，并向目标站点交互靠齐。

### 主要改动

- 编辑能力补齐：
  - `apps/web/src/app/chat/ChatClient.tsx` 新增输入框 ref；
  - 点击用户消息“编辑”后会把原文填入输入框，并自动聚焦到输入框末尾，便于直接改写重发。
- 复制能力增强：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 增加 `copyToClipboard`；
  - 优先使用 `navigator.clipboard`，在非安全上下文下自动回退到 `document.execCommand('copy')`，减少“点击复制无效果”问题。
- 组件能力补齐：
  - `apps/web/src/components/ui/textarea.tsx` 改为 `forwardRef`，支持从父组件进行聚焦与光标控制；
  - `apps/web/src/app/chat/components/chat-composer.tsx` 支持透传 `inputRef`。

### 迁移/破坏性变更

- 无；仅交互增强与兼容性修复。

### 下一步

- 可继续对齐“消息操作区”的 hover/显隐动画与反馈样式（例如 toast 样式与持续时间）。

## Iteration 2.30（2026-03-05）：修复 `tw-animate-css` 模块解析失败

### 目标

- 解决 `pnpm dev:web` 报错 `Module not found: Can't resolve 'tw-animate-css'`。

### 主要改动

- 根因修复：
  - `apps/web/src/app/globals.css` 的导入被自动改成 `@import url(...)` 后，包级 CSS 导入解析异常；
  - 已回退为 Tailwind v4 推荐写法：
    - `@import 'tailwindcss';`
    - `@import 'tw-animate-css';`
- 规则收敛：
  - `stylelint.strict.config.mjs` 将 `import-notation` 设为 `null`，避免严格修复再次把上述导入改坏。
- 验证：
  - 本地首页可正常返回 200，样式可编译输出（不再出现该模块找不到错误）。

### 迁移/破坏性变更

- 无；仅 CSS 导入写法与样式规则兼容性修复。

### 下一步

- 若后续继续做样式自动修复，优先保留 Tailwind v4 官方导入语法，避免与通用 CSS 规则冲突。

## Iteration 2.29（2026-03-05）：修复首页 `suggestCanonicalClasses` 提示

### 目标

- 清理 `apps/web/src/app/page.tsx` 中 Tailwind IntelliSense 的 canonical class 提示，保持类名写法规范一致。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 将 `!px-8` 改为 `px-8!`；
  - 将 `!w-fit` 改为 `w-fit!`；
  - 将 `aspect-[16/9]` 改为语义等价的 `aspect-video`。
- 同步收敛：
  - 底部“开始对话”按钮移除 `flex-1`，避免与 `w-fit!` 产生宽度策略冲突。

### 迁移/破坏性变更

- 无；仅样式类名规范化与轻微布局收敛。

### 下一步

- 若继续提示 canonical class，可在其他页面按同一规则批量收敛。

## Iteration 2.28（2026-03-05）：补充 cSpell 词典词条（Segoe）

### 目标

- 消除编辑器中 `Segoe` 的拼写误报，统一 CLI 与 VS Code 体验。

### 主要改动

- 更新 `cspell.json` 词典：
  - 新增 `Segoe` 到 `words` 列表，避免 `Segoe UI` 字体名被标记为 unknown。

### 迁移/破坏性变更

- 无；仅拼写词典增强。

### 下一步

- 若后续出现其他字体/品牌词误报，按同样方式补充到词典即可。

## Iteration 2.27（2026-03-05）：VS Code Tailwind 语法提示噪音收敛

### 目标

- 解决 VS Code 中 `Unknown at rule @custom-variant css(unknownAtRules)` 的编辑器提示噪音。

### 主要改动

- 更新 `.vscode/settings.json`：
  - 新增 `files.associations`：`*.css -> tailwindcss`；
  - 新增 `css.lint.unknownAtRules: ignore`，避免内置 CSS 校验误报 Tailwind v4 at-rule。

### 迁移/破坏性变更

- 无；仅编辑器工作区体验优化。

### 下一步

- 若个别成员仍有提示噪音，建议确认已安装并启用 Tailwind CSS IntelliSense 扩展。

## Iteration 2.26（2026-03-05）：修复当前 CSS 严格检查告警（lint:style）

### 目标

- 先把 `lint:style` 当前报出的样式告警清掉，确保严格检查可通过。

### 主要改动

- 执行 `pnpm lint:style:fix` 并落地修复：
  - `apps/web/src/app/globals.css`：规范 `@import` 写法、hex 长度、font-family 引号与空行规则；
  - `apps/admin/src/app/globals.css`：修复 `font-family-name-quotes`；
  - `apps/admin/src/app/page.module.css`：媒体查询改为区间语法（`width <= 900px`）。
- 验证：
  - `pnpm lint:style` 现已通过（0 报错）。

### 迁移/破坏性变更

- 无；仅样式规范修复，不涉及业务逻辑。

### 下一步

- 后续可将 `lint:style` 纳入 CI 非阻断检查，持续收敛样式规范。

## Iteration 2.25（2026-03-05）：新增 `lint:style` 严格样式检查命令

### 目标

- 提供一个可单独执行的样式检查命令，用于集中发现当前 CSS 规范问题（包括你提到的 warning/告警项）。

### 主要改动

- 新增严格 Stylelint 配置：
  - `stylelint.strict.config.mjs`（基于 `stylelint-config-standard`）；
  - 保留 Tailwind 自定义 at-rule 白名单，避免误报。
- 新增脚本命令：
  - `pnpm lint:style`：使用严格配置扫描 `**/*.css`；
  - `pnpm lint:style:fix`：在严格配置下尝试自动修复可修复问题。
- 保持现有流程不变：
  - `lint:css` 继续走当前“兼容现状”的配置，用于日常提交流程稳定性。

### 迁移/破坏性变更

- 无；新增命令，不影响原有命令行为。

### 下一步

- 可按 `lint:style` 报告逐步收敛规则，再决定是否把严格检查并入默认 `lint`。

## Iteration 2.24（2026-03-05）：补齐 CSS 格式化/Lint 与 Tailwind 类名自动排序

### 目标

- 支持 CSS 的 Prettier 与 lint，并让 Tailwind 类名在保存和提交时自动按规范顺序整理。

### 主要改动

- Prettier（根配置）：
  - `/.prettierrc.cjs` 接入 `prettier-plugin-tailwindcss`；
  - 配置 `tailwindFunctions: ['cn']`，支持 `cn(...)` 内 class 排序；
  - 配置 Tailwind v4 样式入口 `tailwindStylesheet: './apps/web/src/app/globals.css'`。
- CSS lint：
  - 新增 `stylelint.config.mjs`（基于 `stylelint-config-standard`）；
  - 对 Tailwind 自定义 at-rule（如 `@theme`、`@custom-variant`、`@apply`）做白名单兼容。
- 脚本与提交流程：
  - `package.json` 新增 `lint:css` / `lint:css:fix`；
  - 根 `lint` 串联 `pnpm lint:css`；
  - `lint-staged` 新增 `*.css`：`prettier --write` + `stylelint --fix`，提交时自动修复。
- 保存即格式化（VS Code）：
  - 新增 `.vscode/settings.json`，开启 `formatOnSave` 并默认使用 Prettier；
  - 新增 `.vscode/extensions.json` 推荐 Prettier 与 Tailwind CSS 插件。

### 迁移/破坏性变更

- 无 API 变更；仅工程配置增强。

### 下一步

- 可选：若你希望提交前同时跑 CSS 检查，可把 `pnpm lint` 挂到 CI 必跑链路。

## Iteration 2.23（2026-03-05）：回退“开始对话”为 Link 跳转实现

### 目标

- 按最新确认，撤回 `Button onClick` 跳转方案，恢复为 `Link` 导航实现。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 底部 CTA 从 `<StartChatButton />` 回退为 `Button asChild + Link`；
  - 保持现有样式（`!w-fit + shrink-0 + px-8`）不变，仅回退跳转方式。
- 删除不再需要的组件：
  - `apps/web/src/components/start-chat-button.tsx`。

### 迁移/破坏性变更

- 无；仅页面跳转实现方式回退。

### 下一步

- 如需继续定位宽度展示异常，建议在本地清理旧进程后做一次浏览器无缓存验证。

## Iteration 2.22（2026-03-05）：首页“开始对话”改为 Button onClick 跳转

### 目标

- 按最新交互要求，移除“开始对话”按钮内的 `Link`，改为 `Button` 直接 `onClick` 跳转。

### 主要改动

- 新增客户端组件 `apps/web/src/components/start-chat-button.tsx`：
  - 使用 `useRouter`（`next/navigation`）实现 `onClick => router.push('/chat')`；
  - 保持 `secondary` 视觉样式与 `!w-fit + px-8` 宽度/内边距策略。
- `apps/web/src/app/page.tsx`：
  - 底部 CTA 区由 `Button asChild + Link` 改为 `<StartChatButton />`。

### 迁移/破坏性变更

- 无；仅按钮跳转实现方式调整。

### 下一步

- Playwright MCP 恢复后补首页按钮点击跳转与宽度样式的自动化回归。

## Iteration 2.21（2026-03-05）：首页 CTA 宽度改为强制 `!w-fit`

### 目标

- 继续收敛首页 CTA 宽度问题，避免任何潜在宽度类覆盖导致按钮看起来仍为整行宽度。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 将两个 CTA 的 `w-fit` 升级为 `!w-fit`（高优先级）；
  - 保持 `shrink-0` 与 `px-8`，确保按钮按内容宽度渲染且左右内边距稳定。

### 迁移/破坏性变更

- 无；仅样式优先级增强。

### 下一步

- Playwright MCP 可用后，补首页 CTA 的截图与像素对比验收。

## Iteration 2.20（2026-03-05）：显式固定首页 CTA 为 `w-fit` 规避按钮宽度歧义

### 目标

- 在“去掉固定宽度”基础上，进一步显式约束首页两个 CTA 为内容宽度，避免样式继承或布局上下文导致误解。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - Hero 区“立即开始”按钮增加 `w-fit shrink-0`；
  - 底部“开始对话”按钮增加 `w-fit shrink-0`；
  - 两者均保留 `px-8`（32px）与现有视觉样式。
- 验证方式：
  - 通过本地渲染 HTML 确认两个按钮 class 已包含 `w-fit` 且不再含 `w-full/sm:w-auto`。

### 迁移/破坏性变更

- 无；仅样式行为收敛。

### 下一步

- 若需严格像素验收，可在 Playwright MCP 恢复后补一组首页 CTA 的截图回归。

## Iteration 2.19（2026-03-04）：首页主 CTA 宽度改为内容自适应

### 目标

- 修复首页主按钮“立即开始”仍然占满容器宽度的问题，改为自适应内容宽度。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 移除 Hero 区“立即开始”按钮上的 `w-full` 与 `sm:w-auto`；
  - 保留 `!px-8 + has-[>svg]:!px-8`，确保按钮宽度由内容与内边距共同决定。

### 迁移/破坏性变更

- 无；仅样式行为修复。

### 下一步

- 若后续希望首页 CTA 行为统一，可继续明确“主按钮/次按钮在移动端是否都保持内容宽度”规范。

## Iteration 2.18（2026-03-04）：首页“开始对话”按钮宽度改为内容自适应

### 目标

- 修复首页“开始对话”按钮宽度不符合预期的问题，改为不指定固定宽度，随内容自动伸展。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 移除底部 CTA “开始对话”按钮的 `w-full` 与 `sm:w-auto`；
  - 保留 `h-11` 与 `px-8`，按钮宽度改为组件默认 auto 行为（随内容自适应）。

### 迁移/破坏性变更

- 无；仅样式调整。

### 下一步

- 若需要同一视觉规范，可继续统一首页两个 CTA 的宽度策略（都内容自适应或都容器对齐）。

## Iteration 2.17（2026-03-04）：修复首页主 CTA padding 被按钮基类覆盖

### 目标

- 解决“立即开始”按钮设置 `px-8` 后视觉仍未生效的问题，确保左右内边距稳定为 32px。

### 主要改动

- 根因定位：
  - `Button` 默认尺寸样式包含 `has-[>svg]:px-3`，而“立即开始”按钮内含 `ArrowRight` 图标，导致原 `px-8` 被覆盖。
- 修复：
  - 在 `apps/web/src/app/page.tsx` 为该按钮增加强制覆盖类：
    - `!px-8`
    - `has-[>svg]:!px-8`
  - 这样无论是否包含图标，横向内边距都固定为 32px。

### 迁移/破坏性变更

- 无；仅首页按钮样式修复。

### 下一步

- 如需全站统一，可评估是否调整 `Button` 基类的 `has-[>svg]:px-*` 策略，避免类似覆盖问题重复出现。

## Iteration 2.16（2026-03-04）：首页主 CTA 横向内边距调整为 32px

### 目标

- 按设计要求把首页“立即开始”按钮左右内边距统一为 32px。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 将 Hero 区“立即开始”按钮 class 从 `px-10 sm:px-12` 调整为 `px-8`（即 32px）。

### 迁移/破坏性变更

- 无；仅样式调整。

### 下一步

- 如需继续视觉对齐，可再微调按钮高度、字重与图标间距。

## Iteration 2.15（2026-03-04）：首页 Guest 菜单补齐主题切换与登录入口

### 目标

- 让首页右上角 Guest 入口与聊天页保持一致，支持主题切换和登录跳转，统一用户入口体验。

### 主要改动

- 抽离并复用 Guest 菜单组件：
  - 新增 `apps/web/src/components/guest-menu.tsx`；
  - 支持 `menuPlacement`（上弹/下弹）以适配侧栏与首页头部两种布局。
- 首页头部接入 Guest 下拉菜单：
  - `apps/web/src/app/page.tsx` 右上角由静态按钮改为可交互菜单；
  - 支持 `Toggle light/dark mode` 与 `Login to your account`（跳转 `/login`）。
- 聊天页侧栏改为使用共享 Guest 组件：
  - `apps/web/src/app/chat/components/chat-sidebar.tsx` 改为引用 `@/components/guest-menu`；
  - 删除原聊天目录下重复实现，减少维护分叉。

### 迁移/破坏性变更

- 无 API 变更；仅前端组件复用与交互增强。

### 下一步

- 真实认证接入后，为 Guest 菜单补充登录态头像、用户信息与 Sign out 分支。

## Iteration 2.14（2026-03-04）：按钮精简与 Guest 菜单二次对齐

### 目标

- 继续收敛页面入口与交互，移除冗余按钮，并把侧栏 Guest 菜单进一步对齐到目标样式与行为。

### 主要改动

- 聊天页顶部精简：
  - 移除 `/chat` 顶部“使用指南”按钮及对应入口，保留核心聊天操作链路。
- Guest 菜单二次对齐（`apps/web/src/app/chat/components/guest-menu.tsx`）：
  - 按目标站结构调整为：用户入口按钮 + 下拉菜单；
  - 菜单项改为 `Toggle light/dark mode` 单项切换；
  - 增加认证动作入口 `Login to your account`（跳转 `/login`）；
  - 增加访客状态加载占位（头像/文本 pulse + spinner）。
- 首页 CTA 精简与视觉优化：
  - 移除 Hero 区“查看功能”按钮；
  - “立即开始”按钮左右内边距加大（`px-10 / sm:px-12`）以提升视觉平衡。
- 新增登录占位页：
  - `apps/web/src/app/login/page.tsx`，避免 Guest 菜单登录入口落入 404。

### 迁移/破坏性变更

- 无 API 变更；仅页面结构与入口调整。

### 下一步

- 若后续接入真实认证（如 Auth.js），可直接复用当前 Guest 菜单结构替换登录/登出动作。

## Iteration 2.13（2026-03-04）：主题切换与助手回复 Loading 体验补齐

### 目标

- 对齐聊天页的体验细节：补齐访客菜单内主题切换能力、补齐 AI 首段回复前的 loading 态。

### 主要改动

- 主题系统：
  - `apps/web/src/app/layout.tsx` 接入全局 `ThemeProvider`，支持 `light/dark/system`；
  - 新增 `apps/web/src/components/theme-provider.tsx`（基于 `next-themes`）；
  - 聊天侧栏访客菜单新增主题切换入口：`apps/web/src/app/chat/components/guest-menu.tsx`；
  - `Guest` 按钮点击后弹出菜单，可切换浅色 / 深色 / 跟随系统。
- 回复 loading：
  - 新增 `apps/web/src/app/chat/components/chat-loading-indicator.tsx`；
  - 当发送后助手占位消息还未收到首个 token 时，显示“思考中”动态 loading；
  - 一旦收到流式内容，自动切换为正常 Markdown 消息渲染。
- 依赖：
  - `apps/web/package.json` 新增 `next-themes`。

### 迁移/破坏性变更

- 无外部 API 变更；仅前端展示与主题管理增强。

### 下一步

- 可选：把主题切换入口同步到首页头部，保证全站入口一致。

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

## Iteration 2.80（2026-03-08）

### 目标

- 把聊天页自动滚动行为向 `既定产品基线` 对齐，避免流式生成时抢走用户滚动控制权。

### 主要改动

- 通过 Playwright 实测确认参考站行为：AI 回复持续生成时，若用户手动上滚离开底部，页面不会再强制自动跟随到底部。
- `use-auto-scroll` 新增“是否贴底”判断：仅当用户仍停留在底部附近时，消息流式更新才自动跟随；用户手动上滚超过阈值后，自动跟随立即暂停。
- 会话切换时仍然保持自动定位到底部，保证进入已有长会话时的默认阅读位置不受影响。

### 迁移/破坏性变更

- 无。

### 下一步

- 如果后续还要继续向参考站收口，可以再补一个“回到底部”按钮作为离底状态下的显式恢复入口。

## Iteration 2.81（2026-03-08）

### 目标

- 继续向 `既定产品基线` 收口，补充离底状态下的“回到底部”按钮。

### 主要改动

- `use-auto-scroll` 现在对外暴露 `isPinnedToBottom` 与 `scrollToBottom`，用于驱动离底状态下的显式恢复入口。
- 聊天页在“已有对话且用户离开底部”时，会在输入区上方显示圆形“回到底部”按钮；点击后立即回到底部，并恢复自动跟随。
- 按钮仅在当前不贴底、且不是会话切换空白过渡时出现，避免无意义干扰。

### 迁移/破坏性变更

- 无。

### 下一步

- 如果后续还要继续微调，可以再根据体验决定按钮位置是否更靠中间，或是否补极轻的显隐动效。

## Iteration 2.82（2026-03-08）

### 目标

- 修复“生成中轻微上滚仍会被自动滚动抢回去”的剩余问题。

### 主要改动

- 根因确认：此前虽然加入了贴底阈值判断，但只要用户仍处于底部附近，系统仍会继续视为“可自动跟随”，这与参考站“用户一旦开始向上滚就立即让权”的行为不一致。
- `use-auto-scroll` 现改为更严格的用户优先策略：在 AI 流式生成期间，只要检测到滚动容器的 `scrollTop` 出现向上变化，就立刻退出自动跟随；只有用户重新滚回底部附近或点击“回到底部”按钮时，才恢复自动跟随。
- 同时保留“切换会话时自动定位到底部”的独立逻辑，避免影响已有会话的默认进入体验。

### 迁移/破坏性变更

- 无。

### 下一步

- 继续观察是否还需要为移动端触摸拖拽补更细的体验微调，但当前基于 `scrollTop` 向上变化的策略已经能覆盖主流输入方式。

## Iteration 2.83（2026-03-08）

### 目标

- 修复“长会话中用户离底发送消息不会自动回到底部”以及“回到底部按钮位置与参考站不一致”的问题。

### 主要改动

- 聊天页提交消息时不再只依赖 `use-auto-scroll` 的被动 effect，而是在用户点击发送或点击预设问题时主动执行一次 `scrollToBottom`，确保长会话离底发送时会立刻跳到最新消息区域。
- 将“回到底部”按钮改为相对输入区定位，使其位置更接近 `既定产品基线` 的“底部居中、悬浮于输入框上方”样式。
- 本地用 Playwright 复测：发送前将会话区滚到顶部后再发送，发送瞬间已能直接滚到底部。

### 迁移/破坏性变更

- 无。

### 下一步

- 继续观察真实流式回复场景下的滚动行为，如果后续还有极端场景，再决定是否把滚动触发进一步下沉到消息流控制层。

## Iteration 2.84（2026-03-08）

### 目标

- 修复“AI 返回纯代码文本时，前端无法展示为代码块”的问题。

### 主要改动

- 新增服务端公共工具 `chat-response-format.ts`，统一负责两件事：向模型注入“代码必须使用 fenced code block 输出”的系统指令，以及在回复完成后对“整段几乎全是代码”的纯文本进行保守兜底包裹。
- 登录态消息流、游客消息流、编辑消息重生成三条链路都接入该工具，保证最终落库内容和前端最终展示内容保持一致。
- 兜底策略仅处理“代码占比很高、说明性语句极少”的回复，避免把普通解释性段落误判成代码块。

### 迁移/破坏性变更

- 无。

### 下一步

- 如果后续要进一步提升稳定性，可以考虑把这套格式约束继续下沉到更明确的 Prompt 模板或模型输出协议层。

## Iteration 2.85（2026-03-08）

### 目标

- 继续提升纯代码文本兜底时的语言识别准确率，并修复“半残 fenced code”导致的代码块脏内容问题。

### 主要改动

- 扩展服务端格式化规则，对 `vue / yaml / sql / bash / css / html / jsx / tsx / typescript / json` 等常见代码类型补充更细的特征识别。
- 增加对“不成对 fenced code”的清洗：如果模型只输出了开头的残缺 fence 而未正确闭合，服务端会先去除残缺 fence，再做语言推断和安全包裹，避免最终代码块里出现裸露的反引号字面量。
- 用 Playwright 做多组真实聊天回归，`javascript / vue / sql / bash / yaml / tsx` 场景均已验证代码块可正确展示。

### 迁移/破坏性变更

- 无。

### 下一步

- 如果后续还要继续收口，可以考虑在渲染层把 `typescript + JSX` 的展示标签进一步细化为 `tsx`，但这不影响当前代码块展示与复制下载功能。

## Iteration 2.86（2026-03-08）

### 目标

- 收敛侧边栏会话列表的信息密度，不再展示最近一条 AI 回复摘要，改为展示会话发起时间。

### 主要改动

- 侧边栏会话列表从“标题 + 最近 AI 摘要”改为“标题 + 创建时间”。
- 视觉上保留简洁单列布局，减少摘要信息带来的噪音。

### 迁移/破坏性变更

- 无。

### 下一步

- 继续观察时间展示是否真的优于更简洁的列表，如果用户偏好更强的做减法，可以进一步去掉时间展示。

## Iteration 2.87（2026-03-08）

### 目标

- 让侧边栏会话列表排序更稳定，避免旧会话因为新回复而频繁跳动。

### 主要改动

- 会话列表排序改为按 `createdAt desc` 为主，而不是按最近 `updatedAt` 变化排序。
- 用 Playwright 验证：旧会话即使收到新消息，也不会直接跳到顶部，列表位置更稳定。

### 迁移/破坏性变更

- 无。

### 下一步

- 在更简洁的产品方向下，继续评估是否彻底去掉时间并补充置顶能力。

## Iteration 2.88（2026-03-08）：侧边栏会话列表做减法并补充置顶能力

### 目标

- 侧边栏会话列表向更简洁的产品思路收口：去掉时间展示与“最近会话”标题，并补充会话置顶能力。

### 主要改动

- 侧边栏列表展示收敛：
  - 去掉会话创建时间展示；
  - 去掉“最近会话”标题文案；
  - 会话列表默认按 `createdAt desc` 稳定排序，不再因为最近回复时间变化而频繁跳动。
- 新增会话置顶能力：
  - 单条会话 `...` 菜单增加“置顶 / 取消置顶”；
  - 置顶后该会话提升到列表最上方；
  - 置顶项标题尾部常驻展示图钉图标。
- 置顶状态持久化策略：
  - 游客态写入浏览器 IndexDB；
  - 登录态复用服务端会话持久化链路，把 `pinnedAt` 编码进现有 `runtime.__chatUi`，避免本轮额外引入 Prisma schema 迁移。
- 排序规则统一：
  - 置顶组按 `pinnedAt desc`；
  - 非置顶组按 `createdAt desc`；
  - 前后端与本地存储共用同一比较器，避免排序漂移。

### 迁移/破坏性变更

- 无数据库 schema 迁移；服务端现有会话会在后续保存时自然带上 UI 状态字段。

### 下一步

- 如果后续还要继续打磨侧边栏体验，可以再评估是否补“拖拽排序”或“置顶分组分隔线”，但当前版本优先保持简洁与稳定。

## Iteration 2.89（2026-03-08）：收敛共享契约漂移并恢复全仓 TypeScript 编译

### 目标

- 清理此前阻塞 `pnpm typecheck` 的跨包类型漂移，让 monorepo 回到全量可编译状态。

### 主要改动

- 收敛 `packages/shared` 与下游领域包的契约差异：
  - `FeedbackMode` 恢复兼容 `per_question | end_summary`；
  - `MessageKind` 恢复兼容 `feedback`；
  - `InterviewQuestion` 补回 `level / title / keyPoints` 等题库与引擎依赖字段；
  - `QuestionAssessment` 与 `InterviewReport` 补齐 `questionTitle / answer / feedback / overallScore / level / summary` 等旧链路仍在使用的字段。
- 题库顺序常量收口：移除未被共享主题类型覆盖的 `frontend` 项，避免无效 topic 继续污染编译。
- `packages/interview-engine/src/scoring.ts` 输出结构补齐新旧两套摘要字段，保证共享类型与 mock provider、引擎实现一致。
- 最终恢复全仓 `pnpm typecheck` 通过。

### 迁移/破坏性变更

- 无运行时破坏性迁移；本轮以类型兼容恢复为主。

### 下一步

- 如果后续要继续收口领域模型，可以再单独做一轮“共享契约瘦身”，把当前兼容字段分阶段淘汰，而不是再次让下游包静态失配。

## Iteration 2.90（2026-03-08）：共享契约瘦身第一阶段

### 目标

- 在不破坏现有聊天与面试链路的前提下，收缩 `packages/shared` 中明确重复的契约字段，降低后续继续演化时的认知负担。

### 主要改动

- 收敛 `QuestionAssessment`：移除重复的 `answer / feedback` 字段，仅保留 `summary` 作为题目级总结字段。
- 收敛 `InterviewReport`：移除与 `overallSummary` 语义重复的 `summary` 字段，统一使用 `overallSummary`。
- 收敛 `InterviewQuestion`：移除未被任何下游实际使用的 `expectedPoints`，统一保留 `keyPoints`。
- 清理 `packages/shared/src/contracts.ts` 中未被导出的死代码：删除重复定义的 `InterviewSettings / DEFAULT_INTERVIEW_SETTINGS / QUICK_PROMPTS / normalizeInterviewConfig`，避免共享契约文件继续承担默认值与工具函数职责。
- 下游同步切换到单一 canonical 字段：
  - `packages/interview-engine/src/scoring.ts` 只输出 `summary / overallSummary`；
  - `packages/llm/src/mock-provider.ts` 改为读取 `assessment.summary` 与 `report.overallSummary`。

### 迁移/破坏性变更

- 当前仓库内无破坏性影响；但如果未来有外部消费者直接依赖被删除的冗余字段，需要同步改为读取 `summary / overallSummary / keyPoints`。

### 下一步

- 第二阶段可以继续评估是否把 `contracts.ts` 中剩余的“纯常量/纯默认值”进一步外移，只保留真正的共享契约类型定义。

## Iteration 2.91（2026-03-08）：共享契约瘦身第二阶段

### 目标

- 让 `packages/shared/src/contracts.ts` 回归“只定义共享类型”，进一步清晰 shared 包内部职责边界。

### 主要改动

- 新增 `packages/shared/src/constants.ts`：承载 `APP_NAME / APP_SLUG / MODEL_OPTIONS / INTERVIEW_TOPICS / QUICK_PROMPTS` 等纯常量。
- `packages/shared/src/contracts.ts` 只保留类型定义与响应体类型，不再混放常量。
- `packages/shared/src/defaults.ts` 收敛为单一职责，仅保留 `DEFAULT_INTERVIEW_CONFIG`。
- `packages/shared/src/index.ts` 重新整理对外导出：
  - 类型从 `contracts.ts` 暴露；
  - 常量从 `constants.ts` 暴露；
  - 默认配置从 `defaults.ts` 暴露；
  - 工具函数继续从 `utils.ts` 暴露。

### 迁移/破坏性变更

- 对仓库内现有调用方无破坏性影响；shared 包的公共导出名保持不变。

### 下一步

- 如果后续还要继续收口，可以再评估是否为 `shared` 增加更细的目录分层（如 `types / constants / defaults / utils`），但当前扁平文件数仍可接受。

## Iteration 2.92（2026-03-08）：shared 包目录结构升级

### 目标

- 将 `packages/shared/src` 从“多文件并列”升级为更清晰的职责目录结构，同时保持公共导出方式不变。

### 主要改动

- 新建目录：
  - `packages/shared/src/types`
  - `packages/shared/src/constants`
  - `packages/shared/src/defaults`
  - `packages/shared/src/utils`
- 文件迁移：
  - 共享类型迁入 `types/index.ts`
  - 常量迁入 `constants/index.ts`
  - 默认配置迁入 `defaults/index.ts`
  - 工具函数迁入 `utils/index.ts`
- 根出口 `packages/shared/src/index.ts` 保持统一导出职责，因此仓库内现有 `@mianshitong/shared` 调用方式无需调整。
- 删除旧的并列文件：`contracts.ts / constants.ts / defaults.ts / utils.ts`。

### 迁移/破坏性变更

- 对仓库内无破坏性影响；若外部未来直接引用 shared 内部文件路径，需要改为新的目录路径，但当前项目内未发现此类用法。

### 下一步

- 当前 shared 包已经具备继续扩展的基本目录骨架；后续如新增 schema 校验或 response mapper，可直接按职责落到对应目录，而不需要再堆到根目录。

## Iteration 2.94（2026-03-08）：微调侧栏会话项的置顶位与激活态

### 目标

- 针对侧栏单条会话项，按参考图细调右侧操作位、置顶图钉展示方式、激活态背景与三点热区大小。

### 主要改动

- 置顶会话项的图钉从标题尾部移动到右侧操作位，与 `...` 共用同一位置；默认显示图钉，hover 时切换为 `...`。
- 会话项激活态改为纯背景高亮，不再使用边框与阴影强调。
- 右侧 `...` 操作按钮的热区缩小，收口到更接近参考图的轻量小方块尺寸。

### 迁移/破坏性变更

- 无功能性破坏，仅样式细调。

### 下一步

- 如果还要继续压细节，可以再按截图逐项微调激活态背景明度、右侧图标垂直位置与 hover 过渡时长。

## Iteration 2.95（2026-03-09）：本地 Ollama 默认模型切换为 DeepSeek R1 8B

### 目标

- 让本地免费调试时的默认模型风格更接近线上 DeepSeek 方向，降低每次都要手动覆写 Ollama 模型的成本。

### 主要改动

- 将聊天流式链路里的 Ollama 默认模型从 `llama3.2:latest` 调整为 `deepseek-r1:8b`。
- 将 `packages/llm` 内部 `OllamaStreamChatProvider` 的默认模型同步调整为 `deepseek-r1:8b`。
- 更新 `env.example` 中的 `OLLAMA_MODEL / OLLAMA_REASONER_MODEL` 推荐值，统一为 `deepseek-r1:8b`。

### 迁移/破坏性变更

- 仅影响未显式配置 `OLLAMA_MODEL` 的本地默认行为；如果已有 `.env.local` 指定模型，则仍以本地环境变量为准。

### 下一步

- 如果后续需要进一步贴近生产效果，建议直接补一套 `LLM_PROVIDER=deepseek` 的本地联调配置，并在 UI 上增加当前实际 provider / model 的调试展示。

## Iteration 2.96（2026-03-09）：聊天代码块主题向 既定产品基线 收口

### 目标

- 让 AI 回复中的代码块背景色、边框与亮暗主题更贴近 `既定产品基线` 当前实现。

### 主要改动

- 新增 `chat-code-theme.ts`，将代码高亮主题从分散的全局 CSS 变量收口为两套固定主题对象。
- 聊天代码块改为使用更接近 `既定产品基线` 的容器结构：`rounded-xl border` 外框、独立头部工具条、代码区顶部单独分隔线。
- 亮色主题代码区改为 `#ffffff / #24292e`；暗色主题代码区改为 `#24292e / #e1e4e8`，并同步收紧关键词、字符串、函数名、参数等 token 颜色。
- 代码块工具按钮改为更轻量的图标按钮视觉，弱化 hover 背景，保留下载与复制能力。

### 迁移/破坏性变更

- 无接口变更；仅调整聊天代码块的视觉样式与高亮主题。

### 下一步

- 如仍需继续逼近 `既定产品基线`，下一步可再针对滚动条样式、横向滚动行为与代码字体做像素级微调。

## Iteration 2.97（2026-03-09）：聊天代码块切换到 Shiki GitHub 双主题

### 目标

- 用现成的 GitHub 系主题替换手写 token 配色，让聊天代码块更稳定地贴近 `既定产品基线`，并降低后续维护成本。

### 主要改动

- `@mianshitong/web` 新增 `shiki`，移除 `react-syntax-highlighter` 及其类型依赖。
- 新增 `chat-shiki.ts`，使用 `shiki/bundle/web` 的 `codeToHtml` 生成双主题高亮 HTML。
- 代码块主题切换改为 `github-light + github-dark` 组合，通过 Shiki 官方双主题 CSS 变量实现，不再手写整套 token 颜色。
- `globals.css` 中删除旧的 `.hljs` 大段主题规则，收敛为少量 Shiki 容器样式与 dark mode 覆写。

### 迁移/破坏性变更

- 无接口变更；代码块渲染实现从 `react-syntax-highlighter` 切换为 `shiki`。

### 下一步

- 如果后续仍需进一步逼近 `既定产品基线`，可以继续微调 `github-dark` 与 `github-dark-default / dimmed` 的取舍，或再细调工具条尺寸与间距。

## Iteration 2.98（2026-03-09）：修复 markdown 包裹代码块与继续收口代码块细节

### 目标

- 修复 AI 回复把真正的 fenced code 包在外层 `markdown` fence 中时，前端显示成“代码里的代码”问题。
- 继续把聊天代码块的头部按钮和代码区排版向 `既定产品基线` 做像素级收口。

### 主要改动

- 新增 `chat-markdown-normalization.ts`，统一处理“外层 `markdown/md` 包裹内层 Markdown 内容”的解包逻辑。
- 服务端 `normalizeAssistantMarkdown` 接入该解包逻辑，确保新生成的回复在落库前就被规范化。
- 客户端 `ChatMarkdown` 渲染前也接入同样的解包逻辑，兼容历史会话中的旧数据。
- 代码块样式继续微调：
  - 工具按钮去掉圆角，与参考站保持一致；
  - 代码区行高收口到 `12px / 16px`；
  - 补齐 monospace 字体栈，保持与参考站更接近的密度与观感。
- 使用 Playwright 复测“用 JS 写一个冒泡排序，返回 markdown 代码块”场景，确认现在会直接展示为 `js` 代码块，不再出现外层 `markdown` 包裹。

### 迁移/破坏性变更

- 无接口变更；仅调整 Markdown 规范化与代码块视觉细节。

### 下一步

- 如果后续仍发现极少数模型回复以异常 fence 形式输出，可继续补更细的 fence 恢复规则，但当前主路径问题已被双层兜底覆盖。

## Iteration 2.99（2026-03-09）：清理未使用的代码与静态资源

### 目标

- 删除当前仓库中已不再被代码引用的孤儿源码文件与模板静态资源，降低噪音与后续维护成本。

### 主要改动

- 删除未被任何运行链路引用的源码文件：
  - `apps/web/src/lib/server/chat-response-code-detection.ts`
  - `apps/web/src/app/chat/components/chat-conversation-skeleton.tsx`
- 删除 `apps/web/public` 下未被项目引用的默认模板 SVG：
  - `window.svg`
  - `globe.svg`
  - `next.svg`
  - `vercel.svg`
  - `file.svg`
- 删除仓库根目录下未被项目引用的临时截图参考文件：
  - `image.png`
  - `image2.png`
  - `既定产品基线-code-block-ref.png`

### 迁移/破坏性变更

- 无运行时破坏；本轮仅清理已确认无引用的孤儿文件。

### 下一步

- 如果后续还要继续做减法，可以再单独评估“未使用导出函数/类型”的粒度，但这类清理需要更强的静态分析，不建议和本轮文件级清理混做。

## Iteration 3.00（2026-03-09）：侧栏会话标题左侧基线对齐品牌标题

### 目标

- 让左侧会话列表标题的文字起点与顶部“面试通”品牌标题左端对齐，降低侧栏视觉上的轻微参差感。

### 主要改动

- 收紧 `chat-sidebar-session-item` 的左侧内边距：
  - 去掉会话项外层多余的水平内边距；
  - 去掉会话按钮自身的水平内边距；
- 通过 Playwright 实测对比，当前首条会话标题与“面试通”标题的左边距差值已从 `8px` 收敛为 `0px`。

### 迁移/破坏性变更

- 无，仅为侧栏会话项的视觉微调。

### 下一步

- 如果后续还要继续打磨左侧栏，可再单独评估会话项 hover/active 状态的纵向节奏是否还要进一步压缩。

## Iteration 3.01（2026-03-09）：侧栏会话项 hover 与激活态背景再加深一档

### 目标

- 让左侧会话项的 hover 与选中态背景更有存在感，同时保持当前布局和间距不变。

### 主要改动

- 将会话项选中态背景从 `bg-sidebar-accent/65` 调整为 `bg-sidebar-accent/78`。
- 将会话项 hover 背景从 `hover:bg-sidebar-accent/45` 调整为 `hover:bg-sidebar-accent/58`。

### 迁移/破坏性变更

- 无，仅为侧栏会话项背景色细调。

## Iteration 3.02（2026-03-09）：侧栏会话项背景色拉满到 accent 基准色

### 目标

- 直接查看侧栏会话项在当前主题色板下的“最实色” hover 与选中态效果，便于后续决定是否回退到更浅的透明度版本。

### 主要改动

- 将会话项选中态背景从 `bg-sidebar-accent/78` 调整为 `bg-sidebar-accent`。
- 将会话项 hover 背景从 `hover:bg-sidebar-accent/58` 调整为 `hover:bg-sidebar-accent`。

### 迁移/破坏性变更

- 无，仅为会话项背景色试验性微调。

## Iteration 3.03（2026-03-09）：补齐 apps/web 聊天核心纯逻辑测试覆盖

### 目标

- 在不改动聊天 UI 交互的前提下，先为 `apps/web` 的关键纯逻辑模块补上回归保护，降低后续继续拆分聊天主控层时的回归风险。

### 主要改动

- Vitest 配置扩展到 `apps/web`：
  - 根 `vitest.config.ts` 新增 `./apps/web/vitest.config.ts` 项目；
  - 新增 `apps/web/vitest.config.ts`，为 Web 侧测试补充 `@ -> src` 别名解析。
- 新增 `apps/web` 关键单测：
  - `apps/web/src/lib/chat-markdown-normalization.test.ts`
  - `apps/web/src/lib/chat-session-id.test.ts`
  - `apps/web/src/lib/chat-session-order.test.ts`
  - `apps/web/src/lib/server/chat-response-format.test.ts`
  - `apps/web/src/lib/server/chat-response-language.test.ts`
- 顺带修复两处被测试暴露出的低风险问题：
  - `chat-response-language.ts` 中 JavaScript 语言检测正则异常，导致普通 JS 代码识别不稳定；
  - `chat-response-fence.ts` 未将 `+=` 等复合赋值语句稳定识别为代码行，影响无 fenced code block 的代码回复自动包裹。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮主要是测试补强与代码识别规则的小幅修正。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一轮可继续沿着“先测试、后收口”的方向推进：
  - 优先补 `send-message / 会话持久化 / 排序与置顶` 的更多纯逻辑测试；
  - 再考虑把 `use-chat-controller` 继续拆薄，而不是直接做大重构。

## Iteration 3.04（2026-03-09）：补齐游客会话与 SSE 解析测试覆盖

### 目标

- 在不触碰聊天 UI 的前提下，继续补强游客会话本地数据层与 SSE 解析层的回归保护，降低后续继续优化发送链路时的回归风险。

### 主要改动

- 新增游客会话与发送基础层测试：
  - `apps/web/src/app/chat/lib/chat-local-session.test.ts`
  - `apps/web/src/app/chat/lib/chat-api.test.ts`
  - `apps/web/src/app/chat/stores/chat-session-cache-store.test.ts`
- 覆盖的关键行为包括：
  - 新会话欢迎消息与标题生成；
  - 编辑首条用户消息后的会话重建；
  - 构造流式上下文时过滤 `report` 消息；
  - SSE 跨 chunk 解析；
  - SSE 最后一个事件无空行结尾时的兜底消费；
  - 会话缓存的写入、覆盖、删除与清空。
- 顺带修复一处被测试暴露出的低风险问题：
  - `apps/web/src/app/chat/lib/chat-api.ts` 在流结束时会丢失未以 `\n\n` 结尾的最后一个 SSE 事件；现已在结束时补充 flush 剩余 buffer。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮为测试补强与 SSE 解析健壮性修正。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一轮如果继续走低风险路径，建议补：
  - `chat-local-storage.ts` 的本地会话读写与迁移；
  - `chat-session-list-store / chat-active-session-store` 的状态更新测试；
  - 然后再评估是否拆 `use-chat-controller`。

## Iteration 3.06（2026-03-09）：补齐发送链路底层辅助模块测试覆盖

### 目标

- 在不触碰发送 hook 主体与聊天 UI 的前提下，继续补强发送链路底层辅助模块的回归保护，为后续拆薄 `use-send-message` 提前打基础。

### 主要改动

- 新增发送链路辅助模块测试：
  - `apps/web/src/app/chat/lib/chat-helpers.test.ts`
  - `apps/web/src/app/chat/lib/chat-route-bootstrap-bypass.test.ts`
  - `apps/web/src/app/chat/hooks/stream-event-handler.test.ts`
- 覆盖的关键行为包括：
  - 临时消息创建时的默认 `kind` 与时间戳；
  - SSE payload 的 JSON 解析与无效输入兜底；
  - 路由 bootstrap bypass 的标记、查询与清除；
  - 流式 `delta` 事件对 optimistic assistant 消息的追加；
  - `done` 事件的服务端会话同步；
  - `error` 事件的 notice 提示。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮仅新增测试。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一轮可开始评估如何把 `use-send-message / use-local-send-message` 中的 optimistic update 与错误恢复逻辑进一步下沉成可测试函数，再决定是否拆 hook 主体。

## Iteration 3.07（2026-03-09）：下沉发送链路消息变换逻辑并补测试

### 目标

- 在不改变现有聊天交互的前提下，把发送与本地编辑链路中可测试的消息变换逻辑从 hook 中下沉出来，降低 hook 复杂度并继续补齐回归保护。

### 主要改动

- 新增消息变换辅助模块：
  - `apps/web/src/app/chat/lib/chat-message-mutations.ts`
  - `apps/web/src/app/chat/lib/chat-local-stream-handler.ts`
- 新增对应测试：
  - `apps/web/src/app/chat/lib/chat-message-mutations.test.ts`
  - `apps/web/src/app/chat/lib/chat-local-stream-handler.test.ts`
- 将以下重复逻辑从 hook 中下沉到 helper：
  - 会话标题生成；
  - optimistic 消息追加；
  - assistant delta 追加；
  - optimistic 消息移除；
  - 本地会话持久化前的最终会话构造；
  - 本地流式回复的 delta/done/error 事件处理；
  - 可编辑用户消息定位。
- 相关 hook 已改为复用上述 helper：
  - `use-local-send-message.ts`
  - `use-send-message.ts`
  - `use-local-edit-message.ts`
  - `use-edit-message.ts`
- 顺带修正一个潜在回归点：
  - 本地发送在中途中止时，仍会保留已生成的部分 assistant 内容并落到本地会话，而不是丢失中途已生成的回复片段。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮为小步重构与测试补强。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一轮可开始评估是否继续把 `use-send-message` 中的“同步服务端会话 / 失败恢复”再下沉一层；若继续保持当前节奏，可在有测试保护的前提下再决定是否拆 `use-chat-controller`。

## Iteration 3.08（2026-03-09）：下沉服务端会话同步与失败恢复逻辑

### 目标

- 继续小步拆薄远端发送/编辑链路，把“服务端会话同步与失败恢复”从 hook 中抽离出来，降低重复逻辑与后续维护成本。

### 主要改动

- 新增服务端会话同步辅助模块：
  - `apps/web/src/app/chat/lib/chat-remote-session-sync.ts`
- 新增对应测试：
  - `apps/web/src/app/chat/lib/chat-remote-session-sync.test.ts`
- 抽离出的能力包括：
  - 同步已拿到的远端会话到当前 UI 状态；
  - 按 `sessionId` 拉取并同步远端会话；
  - 失败时的兜底尝试同步。
- 相关 hook 已改为复用该 helper：
  - `use-send-message.ts`
  - `use-edit-message.ts`
- 这样做后，`use-send-message` 中内联的 `syncPersistedSession` 已移除，成功态与失败恢复态都改为走统一 helper，减少重复状态写入分支。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮为小步重构与测试补强。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一轮如果继续保持当前节奏，可开始评估 `use-chat-controller.ts` 中是否还存在可继续下沉的“组合但可复用”的逻辑；若没有明显收益，再考虑转向补更高层的交互级测试。

## Iteration 3.09（2026-03-09）：下沉路由会话加载决策并补测试

### 目标

- 继续小步拆薄 controller 周边逻辑，把 `use-chat-controller-effects` 中最容易回归的“路由会话加载决策”提炼为纯函数，降低分支复杂度并提升可测试性。

### 主要改动

- 新增路由会话加载决策 helper：
  - `apps/web/src/app/chat/lib/chat-route-hydration.ts`
- 新增对应测试：
  - `apps/web/src/app/chat/lib/chat-route-hydration.test.ts`
- 抽离出的决策包括：
  - 未 ready 时是否只展示 loading；
  - 无路由 session 时是否重置当前会话；
  - 有缓存时是否立即应用缓存；
  - 是否需要展示 loading；
  - 是否需要继续远端加载；
  - pending route bootstrap bypass 时是否跳过远端加载。
- `use-chat-controller-effects.ts` 已改为复用该 helper，使 effect 本身更偏向“执行副作用”，而不是混合状态判断与副作用。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮为纯逻辑下沉与测试补强。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 下一轮如果继续做减法，可评估：
  - `use-chat-delete-actions.ts` 中删除后切换会话的决策是否值得提炼；
  - 或者转向补一层更接近真实交互的测试，避免继续做收益递减的纯逻辑拆分。

## Iteration 3.10（2026-03-09）：下沉删除后会话切换决策并补测试

### 目标

- 继续小步拆薄 controller 周边逻辑，把删除单个会话后“接下来切到哪里”的分支决策从 hook 中抽成纯函数，降低后续维护与回归风险。

### 主要改动

- 新增删除后会话切换决策 helper：
  - `apps/web/src/app/chat/lib/chat-delete-transition.ts`
- 新增对应测试：
  - `apps/web/src/app/chat/lib/chat-delete-transition.test.ts`
- 抽离出的决策包括：
  - 删除的不是当前激活会话时无需切换；
  - 删掉当前会话且无剩余会话时重置到新会话页；
  - 有缓存的下一个会话时直接切缓存；
  - 无缓存时走远端拉取。
- `use-chat-delete-actions.ts` 已改为复用该 helper，并把编辑态清理收敛为局部 `resetEditorState`，减少重复赋值分支。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮为纯逻辑下沉与测试补强。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 当前 controller 周边最明显的纯逻辑已基本收口。下一轮如果继续优化，更建议转向更高层的交互级测试或局部组件测试，而不是继续做边际收益更低的纯逻辑拆分。

## Iteration 3.11（2026-03-09）：为聊天交互补齐首批 jsdom Hook 测试

### 目标

- 在已有纯逻辑测试保护的基础上，开始补一层更接近真实用户动作的交互级测试，验证聊天关键 Hook 在 DOM 环境下的行为，而不直接上整页 E2E。

### 主要改动

- 为 `apps/web` 增加最小组件测试基建：
  - 安装 `@testing-library/react`
  - 安装 `@testing-library/jest-dom`
  - 安装 `jsdom`
- 调整 `apps/web/vitest.config.ts`，纳入 `*.dom.test.ts(x)` 测试文件。
- 新增 DOM 测试基础 setup：
  - `apps/web/vitest.setup.ts`
- 新增交互级测试：
  - `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts`
  - `apps/web/src/app/chat/hooks/chat-controller-helpers.dom.test.ts`
- 覆盖的关键交互包括：
  - 选中已缓存会话时立即应用缓存并在移动端关闭侧栏；
  - 选中未缓存会话时进入 loading；
  - 新建会话时重置输入与编辑态；
  - 提交编辑成功/失败时的编辑态收口；
  - 移动端侧栏自动关闭；
  - 复制按钮在安全上下文与回退 `execCommand` 两种路径下的行为。
- 本轮采用 Vitest 官方支持的 `@jest-environment jsdom` 文件级配置，避免为少量 DOM 测试引入更重的多项目测试编排复杂度。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮主要新增测试基建与交互测试。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 当前项目已同时具备：
  - 纯逻辑单测；
  - Hook/DOM 交互测试。
- 下一轮如果继续优化，建议优先补“会话切换 / 新建会话 / 删除会话 / 复制代码块”这类用户最敏感的交互测试，而不是再继续做边际收益更低的纯逻辑拆分。

## Iteration 3.13（2026-03-09）：补齐快速提示词、复制与编辑态交互测试

### 目标

- 继续沿着 Hook/DOM 交互测试方向推进，覆盖聊天页中用户直接可感知的细节行为，减少高频交互改动的回归风险。

### 主要改动

- 扩展 `apps/web/src/app/chat/hooks/use-chat-controller-actions.dom.test.ts` 覆盖范围：
  - 快速提示词点击后直接触发发送；
  - 复制成功时展示成功 toast；
  - 复制失败时展示失败 toast；
  - 开始编辑、取消编辑、展示 notice 时的状态更新；
  - 已保留原有的选会话、新建会话、提交编辑成功/失败等测试。
- 这样做后，`useChatControllerActions` 这一层的关键用户动作已经有较完整的交互回归保护。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮仅新增交互测试。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 当前聊天页的 Hook/DOM 交互测试覆盖已经具备相当密度。下一轮如果继续优化，更建议开始用更贴近真实页面的自动化测试去验证：
  - 新建会话后首条发送；
  - 会话切换时的状态稳定；
  - 删除后界面收口；
  - 长消息滚动与定位。

## Iteration 3.14（2026-03-09）：补齐发送分发与停止生成的 Hook/DOM 测试

### 目标

- 继续补聊天页高频交互测试，覆盖 `useChatController` 层的发送分发、发送中阻止重复发送与停止生成行为。

### 主要改动

- 新增 DOM 测试：
  - `apps/web/src/app/chat/hooks/use-chat-controller.dom.test.ts`
- 覆盖的关键交互包括：
  - 登录用户发送时走远端发送；
  - 游客发送时走本地发送；
  - 发送中再次发送非空内容时阻止发送并展示 toast；
  - 点击停止生成时中止当前流并清除 `sending` 状态。
- 本轮测试通过模块 mock 的方式聚焦 `useChatController` 自身的行为分发，不依赖整页渲染，保持测试成本可控。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮仅新增交互测试。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 当前聊天关键交互的 Hook/DOM 测试已较完整。下一轮如果继续优化，更建议开始引入更贴近真实页面的自动化测试，优先覆盖：
  - 新建会话后首条发送；
  - 会话切换时状态稳定；
  - 长消息滚动到底部；
  - 删除后页面收口。

## Iteration 3.15（2026-03-09）：接入聊天页最小 Playwright 页面烟测

### 目标

- 在现有单测与 Hook/DOM 测试之外，补一层更贴近真实页面的自动化回归保护，优先覆盖聊天页最容易引发体感回归的关键链路。

### 主要改动

- 新增 Playwright 页面级测试基建：
  - 根目录新增 `playwright.config.ts`
  - 根脚本新增 `pnpm test:e2e`
  - 新增 `apps/web/e2e/chat-smoke.spec.ts`
  - 新增 `apps/web/e2e/support/chat-e2e-fixtures.ts`
- 测试策略保持最小、稳定、低侵入：
  - 复用本机已安装的 Google Chrome channel，避免强依赖 Playwright 自带浏览器下载；
  - 通过浏览器侧写入 IndexDB 来构造游客态会话数据；
  - 通过 `page.route()` mock `/api/chat/stream`，避免依赖真实模型与数据库。
- 当前已落地并通过的烟测链路：
  - 新建会话后点击预设项发送，生成独立路由并完成回复；
  - 会话切换后展示对应会话内容；
  - 删除当前会话后页面回到空聊天页。
- `.gitignore` 已补充 Playwright 产物目录，避免测试输出污染仓库。

### 迁移/破坏性变更

- 无运行时破坏性变更；本轮仅新增测试基建与仓库脚本。

### 验证

- 已执行并通过：
  - `pnpm test:e2e`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如果继续补自动化测试，优先级建议为：
  - 发送中停止生成与重复发送提示；
  - 长消息滚动到底与“用户手动上滚后不再抢滚动”；
  - 代码块复制/下载与主题切换。

## Iteration 3.16（2026-03-09）：对齐极简 like/dislike 消息反馈

### 目标

- 先按 `既定产品基线` 的极简思路补齐 AI 回复的 like/dislike 反馈闭环，仅记录正负反馈，不提前引入点踩原因或后台分析。

### 主要改动

- 共享契约扩展：
  - `packages/shared` 为 `ChatMessage` 新增可选 `feedback` 字段，类型为 `like | dislike | null`。
- 持久化策略采用“消息内嵌反馈”而不是独立反馈表：
  - 登录用户：反馈写入数据库中的会话 `messages` JSON；
  - 游客：反馈写入本地 IndexDB 会话数据；
  - 这样无需新增 Prisma 表迁移，改动范围更小，也更贴合当前仅做极简对齐的目标。
- 新增通用反馈更新能力：
  - `apps/web/src/lib/chat-message-feedback.ts`
  - `apps/web/src/app/chat/lib/chat-local-message-feedback.ts`
  - `apps/web/src/lib/server/chat-message-feedback-repository.ts`
- 新增远端反馈接口：
  - `PATCH /api/chat/sessions/[sessionId]/messages/[messageId]/feedback`
- 前端交互对齐：
  - AI 回复区域的“赞同回复 / 不赞同回复”不再只是提示文案；
  - 点击后会真正写入反馈；
  - 再次点击当前已选中的反馈可取消；
  - 当前已选中的按钮会有激活态样式。
- 新增单测：
  - `apps/web/src/lib/chat-message-feedback.test.ts`

### 迁移/破坏性变更

- 无 Prisma schema 变更，无数据库迁移。
- 旧消息数据没有 `feedback` 字段时按“未反馈”处理，兼容历史会话。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm spellcheck`

### 下一步

- 后续如果继续增强该能力，再考虑：
  - 点踩原因；
  - 后台反馈查询；
  - 模型/场景维度的反馈统计。

## Iteration 3.17（2026-03-09）：对齐 既定产品基线 的 like/dislike 可感知反馈

### 目标

- 修复 AI 回复 like/dislike 点击后“像没反应”的体感问题，并把交互细节向 `既定产品基线` 靠拢。

### 主要改动

- 使用 Playwright 对比确认 `既定产品基线` 的真实行为：
  - 点击后立即出现 toast；
  - 当前选中的按钮进入禁用态；
  - 另一侧按钮仍可点击切换；
  - 不再支持点击同一按钮取消反馈。
- 对齐前端交互实现：
  - 新增 `showToast` 能力，从消息项触发页面顶部 toast；
  - `message-upvote` / `message-downvote` 增加 `data-testid`，并按当前反馈状态切换禁用态；
  - 点赞提示文案为 `Upvoted Response!`，点踩提示文案为 `Downvoted Response!`。
- 新增一条页面烟测：
  - 校验 like/dislike 点击后 toast 可见；
  - 校验按钮禁用/可切换状态与 `既定产品基线` 对齐。

### 迁移/破坏性变更

- 无数据结构迁移；仅交互层行为调整。

### 验证

- 已执行并通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm spellcheck`

### 下一步

- 当前 like/dislike 已完成极简对齐。后续若继续增强，再考虑点踩原因与反馈后台。

## Iteration 3.18（2026-03-09）：AI 回复反馈改为三态切换

### 目标

- 把 AI 回复的点赞/点踩从“双态切换”改为“三态切换”：默认态、点赞态、点踩态。
- 让激活态图标使用填充视觉，提升状态可感知性。

### 主要改动

- 前端反馈交互改为三态：
  - 点击点赞：进入点赞态；
  - 再次点击点赞：回到默认态；
  - 点踩同理；
  - 点赞与点踩之间仍可直接互相切换。
- 复用现有 `feedback: null` 协议，不新增后端字段或接口。
- 激活态图标改为填充样式，并保留按钮高亮背景。
- 新增/更新测试覆盖：
  - 单测覆盖 `like -> dislike` 切换；
  - E2E 覆盖三态切换、`aria-pressed` 状态与填充图标样式。
- 组件拆分：将消息操作区从 `chat-message-item` 中拆出，避免单文件继续膨胀。

### 迁移/破坏性变更

- 无数据库迁移。
- 旧数据仍兼容：没有 `feedback` 字段时按默认态处理。

### 验证

- 已执行并通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm spellcheck`

### 下一步

- 如果后续继续演进，可再评估：
  - 默认态是否显示“取消反馈”单独文案；
  - 点踩原因收集；
  - 反馈数据在后台的统计与分析。

## Iteration 3.19（2026-03-09）：图标库从 Lucide 迁移到 Remix Icon

### 目标

- 将 `apps/web` 中的图标依赖从 `lucide-react` 迁移到 `@remixicon/react`，并完成对应图标替换。
- 在不破坏现有交互的前提下，统一全站图标风格并降低后续维护成本。

### 主要改动

- 依赖调整：
  - 新增 `@remixicon/react`；
  - 移除 `lucide-react`。
- 新增统一图标映射层：
  - `apps/web/src/components/icons.ts`
  - 将项目已使用的 Lucide 图标名映射到对应的 Remix Icon 组件，降低业务文件改动面。
- 全量替换 `apps/web/src` 下原有 `lucide-react` 导入，统一改为项目内部图标映射层。
- 点赞/点踩激活态继续保留“填充图标”效果，但实现方式改为直接切换到 Remix Icon 的 `fill` 版本，而不是依赖 CSS 填充描边图标。
- 更新 E2E 断言：从 Lucide 专属 class 判断，改为与图标库无关的状态属性判断，避免后续再次被图标库实现细节绑死。

### 迁移/破坏性变更

- 无数据库迁移。
- `apps/web` 的图标实现依赖已从 Lucide 切换为 Remix Icon；如后续新增图标，优先在统一映射层中补充。

### 验证

- 已执行并通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm lint`
- `pnpm format:check` 在迁移后发现格式化差异，已补做格式修复并继续校验。

### 下一步

- 如果后续你要继续优化视觉一致性，可以再单独做一轮：
  - 聊天页高频图标的粗细/尺寸微调；
  - 首页营销区图标的风格统一；
  - 侧边栏操作图标的 hover/激活态细化。

## Iteration 3.20（2026-03-09）：清理图标兼容命名

### 目标

- 去掉 Remix Icon 映射层中沿用自 Lucide 的历史兼容命名，统一项目内部图标命名风格。

### 主要改动

- 将以下兼容命名统一替换为更干净的项目内命名：
  - `Code2 -> Code`
  - `Trash2 -> Trash`
  - `Loader2 -> Loader`
  - `CheckIcon -> Check`
  - `XIcon -> X`
  - `PanelLeftIcon -> SidebarToggle`
  - `ChevronDownIcon -> ChevronDown`
  - `ChevronUpIcon -> ChevronUp`
- 同步更新 `apps/web/src` 下所有引用，避免继续暴露 Lucide 风格的别名。
- 保持 `icons.ts` 作为统一图标映射层不变，后续新增图标继续在该层收敛。

### 迁移/破坏性变更

- 无数据库迁移。
- 仅项目内部代码命名调整，无运行时协议变化。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm spellcheck`

### 下一步

- 如果后续继续清理，可以再统一审视一轮 `icons.ts` 的语义命名，减少与具体库实现的耦合。

## Iteration 3.21（2026-03-09）：整理统一图标映射层

### 目标

- 提升 `icons.ts` 的可维护性，让后续新增图标时能快速定位到合适分组。

### 主要改动

- 将 `apps/web/src/components/icons.ts` 按用途分组：
  - 导航与布局；
  - 选择与反馈；
  - 内容与对话；
  - 通用操作。
- 补充极简注释，保留现有导出名不变，避免影响业务层引用。

### 迁移/破坏性变更

- 无。仅文件结构整理，不涉及运行时行为变化。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如果后续图标继续增多，可以再考虑拆成 `chat-icons.ts` / `ui-icons.ts` 两个文件。

## Iteration 3.22（2026-03-09）：将纯提示类 Hover Popover 改为 Tooltip

### 目标

- 将聊天页中仅用于 hover 提示的交互从 `Popover` 调整为 `Tooltip`，使交互语义更符合 UI 规范。

### 主要改动

- 新增 `apps/web/src/components/ui/hover-tooltip.tsx`，基于 Radix Tooltip 封装统一的 hover 提示组件。
- 删除旧的 `hover-popover` 封装，避免继续用 Popover 承担纯提示职责。
- 替换以下场景的提示实现：
  - 侧栏顶部“删除所有会话记录”；
  - 侧栏顶部“新建会话”；
  - 代码块“复制代码”；
  - 代码块“下载代码”。
- 保留菜单型交互（例如会话项 `...` 操作）继续使用 `Popover`，不混淆职责。

### 迁移/破坏性变更

- 无数据库迁移。
- 仅前端提示组件实现调整，无接口或数据结构变化。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm spellcheck`

### 下一步

- 如果后续继续收敛交互规范，可以再统一梳理一轮项目中所有“纯提示”和“带操作浮层”的组件边界。

## Iteration 3.23（2026-03-09）：统一 Tooltip 视觉风格

### 目标

- 让聊天页及通用 UI 的 Tooltip 与当前浮层体系在颜色、边框、圆角和阴影上保持一致。

### 主要改动

- 调整 `apps/web/src/components/ui/tooltip.tsx` 的基础样式：
  - 使用 `bg-popover` / `text-popover-foreground`；
  - 增加边框与柔和阴影；
  - 圆角统一为 `rounded-lg`；
  - 增加轻微 `backdrop-blur`；
  - 文本尺寸统一为 `13px` 中号提示文案。
- 将 Tooltip 默认延迟调整为 `120ms`，降低闪现感。
- 同步收窄 `hover-tooltip` 中的重复样式，让基础样式更多收敛到 Tooltip 基类。

### 迁移/破坏性变更

- 无。仅视觉样式调整。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如果后续继续微调，可再分别细化聊天页 Tooltip 和全局 Tooltip 的尺寸层级。

## Iteration 3.24（2026-03-09）：收紧 Tooltip 与触发元素的间距

### 目标

- 让 Tooltip 的尖角和触发元素更贴近，减少视觉上的悬浮距离。

### 主要改动

- 依据 Radix Tooltip 的 `sideOffset` 机制，将 `hover-tooltip` 的 `sideOffset` 从 `6` 调整为 `4`。
- 保持箭头绘制方式不变，避免引入不同方向下的定位偏差。

### 迁移/破坏性变更

- 无。仅视觉间距微调。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 下一步

- 如果你还觉得距离偏大，可以继续将 `sideOffset` 再收紧到 `3`，但会更贴近触发元素边缘。

## Iteration 3.25（2026-03-09）：消息复制改为局部提示态

### 目标

- 将 AI 消息和用户消息的复制交互改为局部反馈：hover 显示 Tooltip，点击后按钮临时切换为对勾，不再触发全局 toast。

### 主要改动

- 在 `chat-message-actions` 内为消息复制按钮新增局部 `copied` 状态与超时恢复逻辑。
- 用户消息与 AI 消息复制按钮统一接入 `HoverTooltip`：
  - hover 显示“复制消息”或“复制回复”；
  - 复制成功后按钮图标切换为对勾，Tooltip/`aria-label` 切换为“已复制”。
- 消息复制失败时改为通过 `notice` 告知，不再依赖全局 toast。
- 移除消息列表对全局 `onCopy` 的透传，避免消息复制继续走控制器中的全局 toast 链路。
- 新增一条 E2E 烟测，校验消息复制的 Tooltip、局部 copied 状态与“无全局 copy toast”。

### 迁移/破坏性变更

- 无数据库迁移。
- 仅消息复制交互从全局 toast 改为局部提示态。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm spellcheck`

### 下一步

- 如果后续继续对齐细节，可再考虑给消息复制按钮补一个更轻的 hover 高亮态，和代码块操作按钮保持完全一致。

## Iteration 3.26（2026-03-09）：统一复制成功态为主题蓝

### 目标

- 将消息复制和代码块复制的“已复制”成功态统一为主题蓝，增强状态感知的一致性。

### 主要改动

- 消息复制按钮在 `copied` 态下，按钮前景色切换为 `--color-blue-600`。
- 代码块复制按钮在 `copied` 态下，同步切换为 `--color-blue-600`。
- 成功态仍保留对勾图标，仅统一视觉主题色，不改交互时长和逻辑。

### 迁移/破坏性变更

- 无。仅成功态视觉样式调整。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 下一步

- 如果后续还要继续收口，可以把所有“成功态”图标都统一成同一套主题色策略。

## Iteration 3.27（2026-03-09）：统一点赞/点踩激活态为主题蓝

### 目标

- 将 AI 消息点赞/点踩的激活态与复制成功态统一到同一套主题蓝视觉语言。

### 主要改动

- 点赞/点踩按钮在激活态下：
  - 前景色切换为 `--color-blue-600`；
  - 背景切换为基于主题蓝的轻度染色底；
  - hover 时保持同一主题蓝语义，不再回退到中性色。
- 保持原有三态切换、填充图标和禁用逻辑不变，仅调整样式表现。

### 迁移/破坏性变更

- 无。仅激活态视觉样式调整。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 下一步

- 如果后续继续统一交互语言，可再决定是否把其他“已选中”按钮也统一到这套主题蓝策略。

## Iteration 3.28（2026-03-09）：撤回主题蓝样式收口

### 目标

- 撤回最近两次与主题蓝相关的视觉收口，避免在主题色尚未定稿前继续扩大样式改动面。

### 主要改动

- 撤回代码块复制按钮 `copied` 态的主题蓝前景色，恢复为上一版中性样式。
- 撤回消息复制按钮 `copied` 态的主题蓝前景色，恢复为上一版局部对勾反馈但不绑定主题色。
- 撤回点赞/点踩激活态的主题蓝前景和蓝色染色底，恢复为中性色激活态样式。
- 保留前面已经完成的功能改动：
  - 消息复制的局部 copied 状态；
  - Tooltip 提示；
  - 不再使用全局 copy toast；
  - 点赞/点踩三态逻辑。

### 迁移/破坏性变更

- 无。仅样式回退。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 后续如需统一主题色，建议等全局主题策略确定后再集中处理，避免反复返工。

## Iteration 3.29（2026-03-09）：移除点赞/点踩 toast

### 目标

- 去掉 AI 消息点赞/点踩后的全局 toast，减少多余打扰，保留按钮自身的状态反馈即可。

### 主要改动

- 移除 `use-chat-message-feedback` 中点赞/点踩成功后的 toast 触发逻辑。
- 清理消息列表与消息项中不再需要的 `onToast` 透传。
- 更新 E2E：不再断言 `Upvoted Response!` / `Downvoted Response!` / `Cleared Response Feedback!` 文案。
- 保留原有功能不变：
  - 点赞/点踩三态切换；
  - 按钮激活态与填充图标；
  - 反馈失败时仍通过 `notice` 提示。

### 迁移/破坏性变更

- 无。仅移除反馈成功时的全局 toast。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm spellcheck`

### 下一步

- 如果后续继续做减法，可再评估是否要把反馈失败提示也收敛成更轻量的局部反馈。

## Iteration 3.30（2026-03-09）：去掉点赞/点踩激活态背景

### 目标

- 让点赞/点踩激活态只通过填充图标表达状态，不再额外叠加按钮背景。

### 主要改动

- 移除点赞/点踩激活态下的 `bg-muted` / `hover:bg-muted` 背景样式。
- 保留原有三态切换、填充图标和禁用逻辑不变，仅做视觉减法。

### 迁移/破坏性变更

- 无。仅按钮样式调整。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 下一步

- 如果后续还想继续做减法，可以再评估消息操作区的 hover 反馈是否也要统一减弱。

## Iteration 3.31（2026-03-09）：代码下载增加局部成功态

### 目标

- 让代码块“下载代码”按钮在点击后也像“复制代码”一样，短暂显示对勾反馈。

### 主要改动

- 为代码块下载按钮新增局部 `downloaded` 状态。
- 下载成功后：
  - 按钮图标短暂切换为对勾；
  - Tooltip 文案切换为“已下载”。
- 复用与复制按钮一致的 1500ms 恢复时长，保持交互一致性。

### 迁移/破坏性变更

- 无。仅代码块下载按钮的局部反馈增强。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如果后续继续补齐交互一致性，可再考虑给下载按钮补充独立的 E2E 烟测。

## Iteration 3.32（2026-03-09）：补充点赞/点踩 Tooltip 文案

### 目标

- 为消息操作区的点赞/点踩按钮补充明确的 hover 文案，降低图标理解成本。

### 主要改动

- 点赞按钮 hover 时显示 Tooltip 文案“喜欢”。
- 点踩按钮 hover 时显示 Tooltip 文案“不喜欢”。
- 不改动原有三态切换、填充图标和局部复制反馈逻辑。

### 迁移/破坏性变更

- 无。仅提示文案增强。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 下一步

- 如果后续继续统一文案语气，可再决定“喜欢 / 不喜欢”是否要与其他产品文案统一成同一套词汇风格。

## Iteration 3.33（2026-03-09）：统一消息复制文案为“复制”

### 目标

- 简化消息复制按钮文案，减少“复制消息 / 复制回复”的冗余区分。

### 主要改动

- 将用户消息与 AI 消息复制按钮的默认 Tooltip/`aria-label` 文案统一为“复制”。
- 保留代码块的“复制代码”文案不变，避免与普通消息复制混淆。

### 迁移/破坏性变更

- 无。仅文案调整。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 下一步

- 如果后续继续收口，可再统一审视聊天页里所有 hover 文案的词汇长度和风格。

## Iteration 3.34（2026-03-09）：补充代码输出风格约束

### 目标

- 约束大模型在输出代码块时尽量遵守统一的代码风格，减少前端展示时的风格漂移。

### 主要改动

- 在统一聊天回复格式系统提示词中新增两条代码风格约束：
  - 代码缩进一律使用 2 个空格；
  - 对于通常使用分号结尾的语言，语句结束必须补上分号。
- 保持该约束只作用于“模型生成提示词”层，不对模型输出再做二次代码重写，避免后处理误改代码。
- 更新单测，锁定这两条约束文案，防止后续被误删。

### 迁移/破坏性变更

- 无。仅系统提示词增强。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 如果后续发现模型仍偶尔不遵守，可再评估是否对代码块增加更强的后处理格式化，但当前不建议优先走这条路。

## Iteration 3.35（2026-03-09）：修复 AI 消息区与输入框右边界未对齐

### 目标

- 修复聊天页中 AI 回复内容区右边界比底部输入框更靠右的问题，保证消息区与输入区横向边界一致。

### 主要改动

- 调整 `apps/web/src/app/chat/components/chat-message-item.tsx` 中 AI 消息内容容器的宽度策略：
  - 将助手消息在横向 `flex` 布局里的容器类从 `w-full` 改为 `min-w-0 flex-1`；
  - 避免“头像宽度 + 内容 100%”共同参与布局后把消息内容挤出父容器，导致代码块等内容右边界超出输入框。
- 本地页面校验：
  - 通过浏览器读取元素边界，代码块容器与输入框表单的 `right` 值已对齐，差值为 `0`。

### 迁移/破坏性变更

- 无。

### 下一步

- 若后续继续调整聊天区版式，优先保持消息区与输入区复用一致的横向容器约束，避免再次出现边界漂移。

## Iteration 3.36（2026-03-09）：统一聊天页横向容器约束

### 目标

- 将聊天页消息区、过渡空白态、输入区的横向宽度与内边距约束收口到同一来源，降低后续样式漂移和重复维护风险。

### 主要改动

- 新增共享布局常量文件：
  - `apps/web/src/app/chat/components/chat-layout.ts`
- 抽出两组横向容器样式常量：
  - `CHAT_CONTENT_SHELL_CLASS`：统一 `max-w-4xl` 与左右 `px`；
  - `CHAT_MESSAGE_COLUMN_CLASS`：统一消息区列表列布局。
- 将以下组件改为复用共享常量，而不是各自手写一套相近 class：
  - `chat-message-list.tsx`
  - `chat-composer.tsx`
  - `chat-conversation-transition.tsx`
- 保持现有交互与视觉行为不变，仅收敛布局来源。

### 迁移/破坏性变更

- 无。仅聊天页内部样式约束重构。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- 浏览器页面校验：
  - 代码块容器与输入框表单右边界差值 `delta = 0`。

### 下一步

- 若后续继续调整聊天页宽度，只需要修改共享布局常量即可，不再需要分散改多处组件。

## Iteration 3.37（2026-03-09）：对齐新建会话空态标题区样式与轻量动效

### 目标

- 将新建会话时聊天区顶部空态文案“面试通 / AI 智能面试官，优化简历，模拟面试”的样式与呈现方式向 `既定产品基线` 对齐。

### 方案对比

- 方案 1（采用）：只对齐标题区的排版与轻量进入动效。
  - 优点：改动小、性能成本几乎为零、不影响现有聊天流程。
- 方案 2：继续细化为与快捷提问区联动的整段分层动效。
  - 缺点：实现复杂度与回归风险更高，这次需求范围不值得放大。

### 主要改动

- 新增独立空态组件：
  - `apps/web/src/app/chat/components/chat-empty-state.tsx`
- `chat-message-list.tsx` 改为引用新组件，避免空态样式继续堆在消息列表文件内。
- 样式对齐 `既定产品基线`：
  - 标题改为 `text-3xl md:text-4xl`、`font-semibold`、`text-blue-600`；
  - 副标题改为 `text-xl md:text-2xl`、`text-zinc-500`、`mt-4`；
  - 容器改为 `max-w-3xl` 的居中布局。
- 进入动效：
  - 基于仓库已使用的 `tw-animate-css`，为标题与副标题补充轻量 `animate-in fade-in slide-in-from-bottom-2` 动画；
  - 未引入任何新依赖。

### 迁移/破坏性变更

- 无。仅聊天空态展示层样式调整。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Playwright 对比结果：
  - 本地空态标题与 `既定产品基线` 均为 `36px / 600 / blue-600`；
  - 本地空态副标题与 `既定产品基线` 均为 `24px / 400 / zinc-500 / mt-4`；
  - 本地额外补充了轻量 enter 动画，用于提升新建会话时的进入感。

### 下一步

- 若你后续还想继续抠细节，可以再对齐快捷提问区与空态标题之间的纵向节奏，但建议保持现在这种轻量级改动方式。

## Iteration 3.38（2026-03-09）：调整新建会话空态标题区为左对齐

### 目标

- 将新建会话空态中的标题与副标题由居中改为左对齐，使其与下方内容区的阅读起点更一致。

### 方案对比

- 方案 1（采用）：只调整标题区文本对齐方式为左对齐。
  - 优点：改动最小，不影响整体容器宽度与现有动效。
- 方案 2：连同空态整体容器基线一起继续往左收紧。
  - 缺点：会进一步影响与预设按钮、输入区之间的整体节奏，这次先不扩大范围。

### 主要改动

- `apps/web/src/app/chat/components/chat-empty-state.tsx`
  - 将空态容器从 `text-center` 调整为 `text-left`；
  - 保留上一轮已对齐的字号、颜色和轻量进入动效不变。

### 迁移/破坏性变更

- 无。仅文本对齐方式调整。

### 验证

- 已执行并通过：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

### 下一步

- 若你后续还觉得左边界不够贴近，可再单独评估是否要把空态容器的 `max-w-3xl` 或 `px` 再向输入区左边缘收紧。

## Iteration 3.39（2026-03-09）：收敛 AI 回复头像与 loading UI 到 既定产品基线 风格

### 目标

- 缩小聊天页 AI 回复 UI 与 `既定产品基线` 的差异，重点对齐头像尺寸、消息列间距、loading 形态与轻量进场动效。

### 方案对比

- 方案 1（采用）：轻量对齐方案。
  - 对齐头像尺寸与外圈样式；
  - 收敛 AI 回复列间距；
  - 将 loading 从“思考中 + 点”改为更极简的点阵占位；
  - 只改展示层组件，不动聊天状态流。
- 方案 2：深度重做 AI 回复整行与流式阶段时序。
  - 更像 `既定产品基线`，但会扩大到消息流时序和显隐逻辑，回归风险更高。

### 主要改动

- 新增 AI 头像组件：
  - `apps/web/src/app/chat/components/chat-assistant-avatar.tsx`
  - 头像外壳改为 `size-8`、`-mt-1`、`ring-1 ring-border`；
  - 图标尺寸保持约 `14px`，与 `既定产品基线` 基线一致。
- 收敛 AI 消息项展示：
  - `apps/web/src/app/chat/components/chat-message-item.tsx`
  - AI 消息列间距从原先更松散的本地风格调整为更接近 `既定产品基线` 的节奏；
  - 为 AI 消息行补充轻量 `fade-in + slide-in` 进入动画。
- loading UI 收敛：
  - `apps/web/src/app/chat/components/chat-loading-indicator.tsx`
  - 移除可见的“思考中”文案，仅保留极简点阵占位；
  - 保留无障碍 `sr-only` 文案，避免可访问性回退；
  - loading 外层加入轻量进入动画。

### 对标结果

- Playwright 读取 `既定产品基线` 得到的关键基线：
  - AI 头像外壳：`32x32`；
  - 头像样式：`-mt-1`、`rounded-full`、`bg-background`、`ring-1 ring-border`；
  - 图标尺寸约 `14px`；
  - AI 行主结构：`flex w-full items-start gap-2 md:gap-3`。
- 本地页面校验结果：
  - AI 头像外壳已调整为 `32x32`；
  - 图标尺寸与外圈样式已对齐到同一基线；
  - loading 可见文案已去除，仅保留点阵占位与无障碍文本。

### 迁移/破坏性变更

- 无。仅聊天页 AI 回复展示层调整。

### 验证

- 已执行并通过：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm format:check`

### 下一步

- 若你后续还要继续向 `既定产品基线` 抠细节，可以再单独收敛“AI 回复 action 区的出现时机”和“流式首 token 前的占位表现”，但建议继续保持小步改动。

## Iteration 3.40（2026-03-09）：对齐输入框文案、模型菜单与发送按钮

### 目标

- 将聊天页输入区的占位文案、模型菜单和发送按钮进一步向 `既定产品基线` 对齐。

### 方案对比

- 方案 1（采用）：轻量对齐方案。
  - 修改占位文案；
  - 模型菜单改为顶部弹出，并补齐两行菜单项内容；
  - 发送按钮收敛到与 `既定产品基线` 相同的圆形尺寸和状态表现。
- 方案 2：继续深挖输入区内所有附属元素（上下文百分比、文件按钮等）的全部细节。
  - 缺点：范围扩大，不是这次需求重点。

### 主要改动

- 占位文案：
  - `apps/web/src/app/chat/components/chat-composer.tsx`
  - 将输入框占位从英文 `Send a message...` 调整为中文 `发消息...`。
- 模型菜单：
  - `packages/shared/src/constants/index.ts`
    - 为 `MODEL_OPTIONS` 增加 `description`，并将模型名称文案对齐为 `Deepseek Chat` / `Deepseek Reasoner`；
  - `apps/web/src/app/chat/components/chat-composer.tsx`
    - 模型下拉改为 `side="top" + align="start" + position="popper"`，使菜单从顶部弹出；
    - 触发器增加前置图标；
    - 菜单项改为“两行文案”结构，标题与说明对齐 `既定产品基线`。
- 发送按钮：
  - `apps/web/src/components/icons.ts`
    - 新增 `ArrowUp` 图标导出；
  - `apps/web/src/app/chat/components/chat-composer.tsx`
    - 未输入时按钮禁用并保持灰态；
    - 可发送时显示深色圆形按钮和上箭头图标；
    - 生成中保持深色圆形按钮，并切换为停止图标。

### 对标结果

- Playwright 验证 `既定产品基线`：
  - 模型菜单位于触发器上方；
  - 菜单宽度不小于 `260px`；
  - 菜单项为两行文本，标题约 `12px medium`，描述约 `10px muted`；
  - 发送按钮在空态/可发送态均为 `32x32` 圆形按钮。
- 本地验证结果：
  - 占位文案已为 `发消息...`；
  - 模型菜单 `placement = top`；
  - 发送按钮空态为灰色禁用，输入后为深色上箭头，发送中为深色停止按钮。

### 迁移/破坏性变更

- 无。仅输入区展示层与共享模型文案调整。

### 验证

- 已执行并通过：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm format:check`

### 下一步

- 若你后续还要继续和 `既定产品基线` 抠细节，可以再单独处理输入区上方的上下文百分比按钮与文件上传按钮，但建议继续小步推进。

## Iteration 3.41（2026-03-09）：修正模型触发器字号与重复下拉箭头

### 目标

- 修复输入区模型选择器与 `既定产品基线` 仍存在的细节偏差：
  - 文字偏大；
  - 重复出现两个向下箭头；
  - 触发器内部图标与文字节奏不够贴近参考实现。

### 主要改动

- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 移除手动添加的 `ChevronDown`，只保留共享 `SelectTrigger` 内置的默认下拉图标；
  - 将模型名称文案收敛为 `text-xs font-medium`，与 `既定产品基线` 基线一致；
  - 维持前置图标为 `16px`，并简化触发器内部结构，避免视觉上显得过重。
- 对标结果：
  - 本地触发器当前为 2 个图标（前置图标 + 默认箭头），不再重复渲染箭头；
  - 文本字号已与 `既定产品基线` 对齐到 `text-xs` 级别。

### 迁移/破坏性变更

- 无。仅模型触发器展示微调。

### 验证

- 已执行并通过：
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm typecheck`

### 下一步

- 若后续还要继续抠细节，可再评估是否替换前置图标 glyph 本身；当前已对齐尺寸和节奏，但未引入站点私有图标资产。

## Iteration 3.42（2026-03-09）：将模型菜单选中对勾移到左侧

### 目标

- 修复模型菜单选中项的对勾位置，使其与参考实现一致，显示在菜单项前侧而不是后侧。

### 主要改动

- `apps/web/src/components/ui/select.tsx`
  - 将 `SelectItem` 的选中指示器位置从 `right-2` 调整为 `left-2`；
  - 同步将菜单项内边距从 `pr-8 pl-2` 调整为 `pr-2 pl-8`，为左侧对勾预留空间。

### 迁移/破坏性变更

- 无。仅共享下拉项布局微调。

### 验证

- 已执行并通过：
  - `pnpm lint`
  - `pnpm format:check`
- Playwright 本地验证：
  - 模型菜单选中项的对勾已显示在前侧。

## Iteration 3.43（2026-03-09）：收敛模型触发器的焦点边框样式

### 目标

- 修复聊天输入区模型选择器在选中/回焦后仍可能出现的粗边框视觉问题，使其与 `既定产品基线` 的轻量触发器样式保持一致。

### 主要改动

- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 仅对聊天页内的模型 `SelectTrigger` 做局部覆盖；
  - 显式移除普通态、`focus`、`focus-visible`、`data-[state=open]` 下的边框、阴影与 ring；
  - 保留 hover 背景反馈，不修改共享 `Select` 组件默认行为，避免影响项目内其它下拉框。

### 迁移/破坏性变更

- 无。仅聊天页模型触发器样式微调。

### 验证

- 已通过 Playwright 读取聊天页模型触发器 computed style，确认选中后：
  - `border` 为 `0px`；
  - `box-shadow` 未产生可见 ring；
  - `outline` 未产生可见描边。

### 下一步

- 若你后续仍观察到边框问题，再继续针对截图对应状态补充 `active` / 浏览器原生焦点样式排查，但当前代码已优先收敛本组件自身样式来源。

## Iteration 3.44（2026-03-09）：补充模型触发器的指针样式

### 目标

- 修复聊天输入区模型选择按钮在 hover 时未显示可点击指针的问题。

### 主要改动

- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 为模型 `SelectTrigger` 补充 `cursor-pointer`，使 `Deepseek Chat / Deepseek Reasoner` 触发器在 hover 时具备明确的可点击反馈。

### 迁移/破坏性变更

- 无。仅局部交互样式调整。

### 验证

- 计划执行：`pnpm format:check && pnpm lint && pnpm typecheck`

## Iteration 3.45（2026-03-09）：统一下拉菜单项的手型指针反馈

### 目标

- 修复模型菜单项在 hover 时未显示可点击手型的问题。

### 主要改动

- `apps/web/src/components/ui/select.tsx`
  - 将共享 `SelectItem` 的默认鼠标样式从 `cursor-default` 调整为 `cursor-pointer`；
  - 为禁用项补充 `data-[disabled]:cursor-not-allowed`，避免交互语义混淆。

### 迁移/破坏性变更

- 无。仅共享下拉菜单项交互样式调整。

### 验证

- 计划执行：`pnpm format:check && pnpm lint && pnpm typecheck`

## Iteration 3.46（2026-03-09）：清理调试截图并收敛 Tailwind important 写法

### 目标

- 清理仓库中未被项目使用的临时文件。
- 修复 VS Code 中 `suggestCanonicalClasses` 类问题，并增加后续防回归检查。

### 主要改动

- 删除仓库根目录下未被项目引用的临时调试截图：
  - `composer-current.png`
  - `image.png`
  - `local-ai-loading.png`
  - `local-ai-loading-2.png`
  - `model-trigger-after-fix.png`
  - `既定产品基线-ai-ui.png`
- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 将 `!border-none`、`!border-0`、`!shadow-none` 等旧式 important 写法，统一改为 Tailwind 官方推荐的后缀 `!` 语法。
- `scripts/check-tailwind-canonical.mjs`
  - 新增基于 TypeScript AST 的轻量检查脚本；
  - 仅检查 `className` / `class` / `cn()` / `cva()` 中的 Tailwind 类字符串；
  - 若出现 `!border-none` 这类前缀 important 写法，会在 lint 阶段直接报错。
- `package.json`
  - 新增 `lint:tailwind`；
  - 将该检查并入根脚本 `pnpm lint`，防止后续再引入同类问题。

### 迁移/破坏性变更

- 无。仅清理无用文件并收紧样式规范检查。

### 验证

- 计划执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

### 下一步

- 若后续还想进一步清理“未使用源码文件”，建议单独做一轮静态引用分析与人工复核，避免误删运行时动态引用文件。

## Iteration 3.47（2026-03-09）：补齐剩余 Tailwind canonical 类修复

### 目标

- 清理 VS Code 中剩余的 `suggestCanonicalClasses` 提示，并扩展仓库检查规则，覆盖常见可收敛类名。

### 主要改动

- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 将 `min-w-[260px]` 改为 `min-w-65`。
- `apps/web/src/app/chat/components/chat-message-item.tsx`
  - 将 `dark:text-[#fff]` 改为 `dark:text-white`；
  - 将 `break-words` 改为 `wrap-break-word`。
- `apps/web/src/app/chat/components/chat-markdown.tsx`
  - 将 `break-words` 改为 `wrap-break-word`。
- `scripts/check-tailwind-canonical.mjs`
  - 新增对以下 canonical 场景的检查：
    - `text-[#fff]` -> `text-white`
    - `break-words` -> `wrap-break-word`
    - `min-w-[Npx]` 且 `N` 可按 Tailwind spacing scale 收敛时 -> `min-w-{N/4}`

### 迁移/破坏性变更

- 无。仅类名规范收敛与 lint 规则增强。

### 验证

- 计划执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`

## Iteration 3.48（2026-03-10）：统一暗黑主题下侧栏按钮图标颜色

### 目标

- 修复暗黑主题下「新建会话」与「折叠侧边栏」图标颜色与其它图标不一致的问题。

### 主要改动

- `apps/web/src/app/chat/components/chat-sidebar.tsx`
  - 新建会话按钮补充 `text-foreground/62` 与 hover 颜色，保持与其它图标一致。
- `apps/web/src/app/chat/components/chat-header.tsx`
  - 侧栏折叠按钮补充 `text-foreground/62` 与 hover 颜色，避免暗黑主题图标偏亮。

### 迁移/破坏性变更

- 无。仅样式一致性调整。

### 验证

- 计划执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`

## Iteration 3.49（2026-03-10）：去除暗黑主题输入区与模型按钮蒙层

### 目标

- 暗黑主题下移除输入框背景与模型切换按钮的灰色蒙层。

### 主要改动

- `apps/web/src/app/chat/components/chat-composer.tsx`
  - 为输入框与模型选择按钮补充 `dark:bg-transparent`，避免暗黑主题下出现背景叠色。

### 迁移/破坏性变更

- 无。仅样式一致性调整。

### 验证

- 计划执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`

## Iteration 3.50（2026-03-10）：增强暗黑主题删除色对比度

### 目标

- 提升暗黑主题下删除按钮的红色亮度，对齐参考图效果。

### 主要改动

- `apps/web/src/app/chat/components/chat-sidebar.tsx`
  - 删除所有会话按钮 hover 色在暗黑主题提升为更亮的 red。
- `apps/web/src/app/chat/components/chat-sidebar-session-item.tsx`
  - 会话菜单删除项在暗黑主题使用更亮 red，并调整 hover 背景。

### 迁移/破坏性变更

- 无。仅样式调整。

### 验证

- 计划执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`

## Iteration 3.51（2026-03-10）：调整删除项暗黑 hover 背景强度

### 目标

- 修正暗黑主题下删除项 hover 背景深度，使其更接近参考图表现。

### 主要改动

- `apps/web/src/app/chat/components/chat-sidebar-session-item.tsx`
  - 删除项 hover 背景从 `dark:hover:bg-red-500/10` 调整为 `dark:hover:bg-red-500/20`。

### 迁移/破坏性变更

- 无。仅样式调整。

### 验证

- 计划执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`

## Iteration 3.52（2026-03-10）：更新主题切换文案

### 目标

- 将主题切换菜单文案改为中文描述。

### 主要改动

- `apps/web/src/components/guest-menu.tsx`
  - `Toggle dark mode` 改为 `切换深色主题`。
  - `Toggle light mode` 改为 `切换浅色主题`。

### 迁移/破坏性变更

- 无。仅文案调整。

### 验证

- 计划执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`

## Iteration 3.59（2026-03-11）：补齐 Prisma 生成以修复 Admin 启动报错

### 目标

- 修复 `pnpm dev:admin` 运行时报 `Cannot read properties of undefined (reading 'count')` 的问题。
- 避免因 Prisma Client 未生成导致 Admin 页面无法启动。

### 主要改动

- `package.json`
  - `dev:admin` 增加 `pnpm db:generate` 前置执行，确保 Prisma Client 与最新 schema 同步。
  - 新增 `db:generate` 脚本，便于单独生成 Prisma Client。

### 迁移/破坏性变更

- 无。仅补充脚本。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.60（2026-03-11）：补齐 Prisma 生成时的 DATABASE_URL 默认值

### 目标

- 修复 `pnpm db:generate` 因 `DATABASE_URL` 缺失导致的失败。

### 主要改动

- `package.json`
  - `db:generate` 增加默认 `DATABASE_URL`，与 `db:migrate` 保持一致。

### 迁移/破坏性变更

- 无。仅脚本调整。

### 验证

- 未执行（建议运行）：
  - `pnpm db:generate`

## Iteration 3.61（2026-03-11）：用户详情页参数兜底

### 目标

- 修复 `/users/[userId]` 进入时 `params.userId` 缺失导致的 Prisma 校验错误。

### 主要改动

- `apps/admin/src/app/users/[userId]/page.tsx`
  - 在调用 Prisma 前校验 `userId`，缺失时直接 `notFound()`。

### 迁移/破坏性变更

- 无。仅兜底处理。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.62（2026-03-11）：用户/会话列表分页

### 目标

- 用户列表与会话列表统一使用 Table 渲染，并支持分页。

### 主要改动

- `apps/admin/src/components/ui/pagination.tsx`
  - 新增 shadcn 风格分页组件（Next.js Link 适配）。
- `apps/admin/src/lib/pagination.ts`
  - 新增分页参数解析与分页元数据工具。
- `apps/admin/src/app/users/page.tsx`
  - 支持 `page/pageSize` 查询参数分页。
  - 页脚增加分页导航。
- `apps/admin/src/app/sessions/page.tsx`
  - 支持 `page/pageSize` 查询参数分页。
  - 页脚增加分页导航。

### 迁移/破坏性变更

- 无。仅列表展示逻辑更新。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.63（2026-03-11）：分页按钮可点击性修正

### 目标

- 修复分页“上一页/下一页”点击无响应的问题。

### 主要改动

- `apps/admin/src/components/ui/pagination.tsx`
  - `PaginationLink` 增加 `size` 参数，`Previous/Next` 使用 `size="default"`，避免固定宽度影响点击区域。
- `apps/admin/src/app/users/page.tsx`
  - 数字页码明确使用 `size="icon"`。
- `apps/admin/src/app/sessions/page.tsx`
  - 数字页码明确使用 `size="icon"`。

### 迁移/破坏性变更

- 无。仅样式/交互调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.64（2026-03-11）：修复 Next 16 searchParams 异步访问警告

### 目标

- 解决 `/users` 与 `/sessions` 访问分页参数时出现的 `searchParams is a Promise` 警告。

### 主要改动

- `apps/admin/src/app/users/page.tsx`
  - 使用 `await searchParams` 后再读取分页参数。
- `apps/admin/src/app/sessions/page.tsx`
  - 使用 `await searchParams` 后再读取分页参数。

### 迁移/破坏性变更

- 无。仅兼容 Next 16 动态 API 访问方式。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.65（2026-03-11）：Admin favicon 对齐 Web 图标

### 目标

- Admin favicon 使用 Web 的 `icon.svg` 造型，并改为后台深色背景。

### 主要改动

- `apps/admin/src/app/icon.svg`
  - 新增与 Web 同款 M 字图标，但背景改为深色渐变。

### 迁移/破坏性变更

- 无。仅新增静态资源。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.66（2026-03-11）：后台侧栏品牌文案调整

### 目标

- 左上角品牌文案从“面试通 Admin”改为“面试通”。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 更新侧栏标题文案。

### 迁移/破坏性变更

- 无。仅文案调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.67（2026-03-11）：用户列表展示数据库 ID

### 目标

- 用户列表增加数据库 `id` 展示，便于定位数据。

### 主要改动

- `apps/admin/src/app/users/page.tsx`
  - 新增 ID 列并使用等宽字体显示。

### 迁移/破坏性变更

- 无。仅表格展示调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.68（2026-03-11）：会话列表筛选与用户跳转筛选

### 目标

- 会话列表展示会话 ID，并支持按用户 ID、用户名（邮箱）、标题筛选。
- 用户列表点击“查看会话”时跳转到会话页并携带用户 ID 过滤。

### 主要改动

- `apps/admin/src/app/sessions/page.tsx`
  - 增加会话 ID 列与筛选表单。
  - `userId/user/title` 查询参数驱动筛选与分页保持。
- `apps/admin/src/app/users/page.tsx`
  - “查看会话”跳转改为 `/sessions?userId=...`。
- `apps/admin/src/lib/pagination.ts`
  - `buildPageHref` 支持附加筛选参数。

### 迁移/破坏性变更

- 无。仅展示与筛选逻辑更新。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.69（2026-03-11）：用户列表操作菜单与删除

### 目标

- 用户列表操作改为“...菜单”，支持“查看会话/删除”。
- 删除需要二次确认，确认后删除数据库用户与会话记录。

### 主要改动

- `apps/admin/src/components/ui/dropdown-menu.tsx`
  - 新增 Dropdown Menu 组件。
- `apps/admin/src/components/ui/alert-dialog.tsx`
  - 新增 Alert Dialog 组件。
- `apps/admin/src/components/user-row-actions.tsx`
  - 新增用户操作菜单与删除确认逻辑。
- `apps/admin/src/app/api/users/[userId]/route.ts`
  - 新增删除用户 API（级联删除会话）。
- `apps/admin/src/app/users/page.tsx`
  - 操作列改为菜单组件。
- `apps/admin/package.json`
  - 新增 radix 依赖：`@radix-ui/react-dropdown-menu`、`@radix-ui/react-alert-dialog`。

### 迁移/破坏性变更

- 无。仅新增 UI 与 API。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.70（2026-03-11）：修正 Radix 依赖版本

### 目标

- 修正 `@radix-ui/react-alert-dialog` 与 `@radix-ui/react-dropdown-menu` 版本号，避免安装失败。

### 主要改动

- `apps/admin/package.json`
  - `@radix-ui/react-alert-dialog` 固定为 `1.1.15`。
  - `@radix-ui/react-dropdown-menu` 固定为 `2.1.16`。

### 迁移/破坏性变更

- 无。仅依赖版本调整。

### 验证

- 未执行（建议运行）：
  - `pnpm install`

## Iteration 3.71（2026-03-11）：Admin UI 切换为 Ant Design

### 目标

- Admin 不再使用 shadcn/ui，统一改为 Ant Design，并启用暗黑主题。
- 用户列表操作改为 Ant Design Dropdown + Modal 确认删除。

### 主要改动

- `apps/admin/package.json`
  - 新增 `antd`、`@ant-design/icons`、`@ant-design/nextjs-registry`。
  - 移除 shadcn/ui 相关依赖（Radix、cva、clsx、tailwind-merge）。
- `apps/admin/src/app/layout.tsx`
  - 接入 `AntdRegistry` + `ConfigProvider` 暗黑主题。
- `apps/admin/src/components/admin-providers.tsx`
  - 新增 Ant Design 主题与 App provider。
- `apps/admin/src/components/admin-shell.tsx`
  - 侧栏与布局改为 Ant Design `Layout/Menu`。
- `apps/admin/src/app/page.tsx`
  - 使用 Ant Design `Card/Statistic/List` 重构概览页。
- `apps/admin/src/app/users/page.tsx`
  - 使用 Ant Design `Table/Tag` 重构用户列表。
- `apps/admin/src/components/user-row-actions.tsx`
  - 使用 Ant Design `Dropdown/Modal` 实现“查看会话/删除”。
- `apps/admin/src/app/users/[userId]/page.tsx`
  - 使用 Ant Design `Table/Tag/Button` 重构用户详情。
- `apps/admin/src/app/sessions/page.tsx`
  - 使用 Ant Design `Table/Tag` 重构会话列表与筛选。
- `apps/admin/src/components/sessions-filter.tsx`
  - 新增会话筛选表单（Ant Design Form）。
- `apps/admin/src/components/admin-pagination.tsx`
  - 新增分页组件（Ant Design Pagination）。
- `apps/admin/src/app/questions/page.tsx`
  - 使用 Ant Design `Card/Table` 重构题库页。
- `apps/admin/src/app/questions/upload/page.tsx`
  - 使用 Ant Design `Card/Typography/Button` 重构上传页。
- `apps/admin/src/app/questions/upload/upload-form.tsx`
  - 使用 Ant Design `Upload/Button` 实现文件上传。
- `apps/admin/src/app/templates/page.tsx`
  - 使用 Ant Design `Card/Table` 重构模板页。
- `apps/admin/src/app/templates/template-form.tsx`
  - 使用 Ant Design `Form/Input/Select/Checkbox` 重构模板表单。
- `apps/admin/src/components/ui/*`
  - 删除 shadcn/ui 组件文件。

### 迁移/破坏性变更

- Admin UI 组件切换为 Ant Design，需重新安装依赖并更新 lockfile。

### 验证

- 未执行（建议运行）：
  - `pnpm install`
  - `pnpm dev:admin`

## Iteration 3.72（2026-03-12）：修复 Server/Client 函数传递错误

### 目标

- 解决 Ant Design Table columns `render` 作为函数在 Server Component 中定义导致的报错。

### 主要改动

- `apps/admin/src/components/users-table.tsx`
- `apps/admin/src/components/sessions-table.tsx`
- `apps/admin/src/components/user-sessions-table.tsx`
- `apps/admin/src/components/questions-table-card.tsx`
- `apps/admin/src/components/templates-panel.tsx`
  - 将包含 `columns.render` 的表格定义下沉到 Client Components。
- `apps/admin/src/app/users/page.tsx`
- `apps/admin/src/app/sessions/page.tsx`
- `apps/admin/src/app/users/[userId]/page.tsx`
- `apps/admin/src/app/questions/page.tsx`
- `apps/admin/src/app/templates/page.tsx`
  - 改为传递序列化后的数据到 Client Components 渲染。
- `apps/admin/src/lib/format.ts`
  - `formatDateTime` 支持 `string | Date`。

### 迁移/破坏性变更

- 无。仅渲染层拆分。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.73（2026-03-12）：概览页 List 渲染改为 Client

### 目标

- 解决概览页 `List` 的 `renderItem` 函数在 Server Component 中定义导致的报错。

### 主要改动

- `apps/admin/src/components/admin-overview.tsx`
  - 新增 Client 组件封装统计卡片与建议列表。
- `apps/admin/src/app/page.tsx`
  - Server 仅传递数据，渲染交给 `AdminOverview`。

### 迁移/破坏性变更

- 无。仅渲染拆分。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.74（2026-03-12）：优化 Admin 暗黑主题配色

### 目标

- 调整 Admin 暗黑主题色板，使整体更柔和、更统一。

### 主要改动

- `apps/admin/src/components/admin-providers.tsx`
  - 更新 Ant Design 主题 token（背景、文本、边框、主色）。
- `apps/admin/src/components/admin-shell.tsx`
  - 侧栏与布局背景色调整为新暗黑色板。
- `apps/admin/src/app/layout.tsx`
  - body 背景/文字色与主题一致。

### 迁移/破坏性变更

- 无。仅主题配色调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.75（2026-03-12）：Admin 切回浅色主题

### 目标

- 将 Admin 主题切换为浅色，并优化主色、背景与边框层次。

### 主要改动

- `apps/admin/src/components/admin-providers.tsx`
  - 使用浅色 token 配置 Ant Design 主题。
- `apps/admin/src/components/admin-shell.tsx`
  - 侧栏改为浅色样式并补充细边框。
- `apps/admin/src/app/layout.tsx`
  - body 背景/文字色切换为浅色。

### 迁移/破坏性变更

- 无。仅主题配色调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.78（2026-03-12）：侧栏 hover 背景增强

### 目标

- 提升左侧暗色导航 hover 背景对比度，确保可见性。

### 主要改动

- `apps/admin/src/app/globals.css`
  - 针对 `ant-menu-dark` 增强 hover / selected 背景色。

### 迁移/破坏性变更

- 无。仅样式调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.79（2026-03-12）：侧栏 hover/selected 背景强制生效

### 目标

- 修复侧栏 hover 与选中态背景未生效的问题。

### 主要改动

- `apps/admin/src/app/globals.css`
  - 增加 `.ant-menu-item-active` 与 `.ant-menu-item-selected` 的强制背景色，并提高样式优先级。

### 迁移/破坏性变更

- 无。仅样式调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.80（2026-03-12）：会话管理操作与详情页

### 目标

- 会话列表增加操作列（查看/删除）并支持删除确认。
- 新增会话详情页，展示用户与 AI 对话记录（只读）。

### 主要改动

- `apps/admin/src/components/session-row-actions.tsx`
  - 新增会话操作菜单（查看/删除）。
- `apps/admin/src/components/sessions-table.tsx`
  - 增加操作列。
- `apps/admin/src/app/api/sessions/[sessionId]/route.ts`
  - 新增删除会话 API。
- `apps/admin/src/components/session-detail-view.tsx`
  - 新增会话详情展示组件（只读消息列表）。
- `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - 新增会话详情页。

### 迁移/破坏性变更

- 无。仅新增功能。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.81（2026-03-12）：会话详情 404 兜底与菜单跳转修复

### 目标

- 修复会话详情点击进入 404 的问题。

### 主要改动

- `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - 移除 `notFound()`，缺失或不存在时展示友好提示。
- `apps/admin/src/components/session-row-actions.tsx`
  - “查看”菜单改为 `router.push` 跳转，避免菜单内 Link 失效。

### 迁移/破坏性变更

- 无。仅交互与兜底调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.82（2026-03-12）：会话详情 ID 编码修复

### 目标

- 修复会话详情页因 ID 含特殊字符导致查询不到的问题。

### 主要改动

- `apps/admin/src/app/sessions/page.tsx`
  - 会话 ID 在列表中编码为 URL 安全格式。
- `apps/admin/src/components/session-row-actions.tsx`
  - “查看”跳转时对 sessionId 编码。
- `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - 详情页解码 sessionId 再查询。

### 迁移/破坏性变更

- 无。仅 URL 编解码调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.83（2026-03-12）：修复会话详情 params Promise 警告

### 目标

- 解决 `/sessions/[sessionId]` 读取 `params` 时的 Promise 警告。

### 主要改动

- `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - `params` 改为 Promise 并通过 `await` 解包。

### 迁移/破坏性变更

- 无。仅兼容 Next 16 动态 API 访问方式。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.84（2026-03-12）：会话详情返回按钮调整

### 目标

- 将“返回会话列表”按钮改为左上角的“< 返回”样式，点击返回上一页。

### 主要改动

- `apps/admin/src/components/session-detail-view.tsx`
  - 顶部新增返回按钮，使用 `router.back()`。
  - 移除卡片右上角返回按钮。

### 迁移/破坏性变更

- 无。仅 UI 调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.85（2026-03-12）：返回按钮上移到标题上方

### 目标

- 将会话详情页的返回按钮放到标题上方。

### 主要改动

- `apps/admin/src/components/back-button.tsx`
  - 新增可复用的返回按钮组件。
- `apps/admin/src/components/admin-shell.tsx`
  - 增加 `headerPrefix` 插槽，用于标题上方的内容。
- `apps/admin/src/app/sessions/[sessionId]/page.tsx`
  - 通过 `headerPrefix` 注入返回按钮。
- `apps/admin/src/components/session-detail-view.tsx`
  - 移除卡片内部返回按钮。

### 迁移/破坏性变更

- 无。仅 UI 调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.86（2026-03-12）：修复 AdminShell headerPrefix 引用

### 目标

- 修复 `AdminShell` 中 `headerPrefix` 未解构导致的运行时报错。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 在组件参数中解构 `headerPrefix`。

### 迁移/破坏性变更

- 无。仅运行时修复。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.76（2026-03-12）：修复 Ant Design React 19 兼容警告

### 目标

- 解决 antd v5 在 React 19 下的兼容性警告提示。

### 主要改动

- `apps/admin/package.json`
  - 新增 `@ant-design/v5-patch-for-react-19` 依赖。
- `apps/admin/src/app/layout.tsx`
  - 引入 `@ant-design/v5-patch-for-react-19`。

### 迁移/破坏性变更

- 无。仅兼容补丁引入。

### 验证

- 未执行（建议运行）：
  - `pnpm install`
  - `pnpm dev:admin`

## Iteration 3.77（2026-03-12）：补丁迁移到 Client 入口

### 目标

- 解决补丁未进入客户端 bundle 导致的 antd React 19 兼容警告。

### 主要改动

- `apps/admin/src/components/admin-providers.tsx`
  - 在 Client Provider 中引入 `@ant-design/v5-patch-for-react-19`。
- `apps/admin/src/app/layout.tsx`
  - 移除 server 入口处的补丁 import。

### 迁移/破坏性变更

- 无。仅补丁加载位置调整。

### 验证

- 未执行（建议运行）：
  - `pnpm dev:admin`

## Iteration 3.94（2026-03-14）：Prisma 读取根目录环境变量

### 目标

- 解决在 `packages/db` 执行 Prisma 命令时无法读取根目录 `.env.local` 导致的 `DATABASE_URL` 缺失问题。

### 主要改动

- `packages/db/prisma.config.ts`
  - 自动加载仓库根目录的 `.env.local` / `.env`。

### 迁移/破坏性变更

- 无。

### 验证

- 未执行（建议运行）：
  - `pnpm -C packages/db exec prisma migrate dev --schema prisma/schema.prisma`

## Iteration 3.95（2026-03-14）：题库与测试稳定性收敛

### 目标

- 修复类型检查与单测失败，保证题库与会话逻辑改动后的工程检查可通过。

### 主要改动

- `packages/db/package.json`
  - 新增 `dotenv` 依赖，确保 Prisma 配置可解析根目录环境变量。
- `packages/shared/src/types/index.ts`
  - `InterviewQuestion` 增加可选 `order` 字段。
- `apps/admin/src/app/api/question-bank/*`
  - 题库 `rubric` 字段使用 Prisma JSON 输入类型，避免类型报错。
- `apps/admin/src/app/api/sessions/[sessionId]/route.ts`
  - 路由参数按 Promise 读取，匹配 Next 16 动态 API 约束。
- `apps/admin/src/app/api/users/[userId]/route.ts`
  - 路由参数按 Promise 读取，匹配 Next 16 动态 API 约束。
- `apps/admin/src/app/page.tsx`
  - 概览卡片移除 `as const`，避免只读数组类型报错。
- `packages/interview-engine/src/index.test.ts`
  - 调整题目样例类型与追问触发条件。
- `apps/web/src/app/chat/lib/chat-local-session.test.ts`
  - 更新编辑消息后的消息数断言。
- `apps/web/src/app/chat/lib/chat-message-mutations.test.ts`
  - 更新移除 optimistic 消息后的长度断言。
- `cspell.json`
  - 增补 `sider`、`upserted` 词条。

### 迁移/破坏性变更

- 无。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 3.96（2026-03-14）：题库字段收敛（去评分规则、可选要点/追问）

### 目标

- 去掉题库评分规则字段；
- 要点与追问改为可选；
- 题目描述改为可选；
- 标签改为必填。

### 主要改动

- `packages/db/prisma/schema.prisma`
  - 移除 `rubric` 字段。
  - `prompt` 改为可空。
  - `tags` 改为必填并设置默认值 `[]`。
  - `keyPoints` / `followUps` 设置默认值 `[]`。
- `packages/db/prisma/migrations/20260314170000_question_bank_adjust/migration.sql`
  - 删除 `rubric` 列并调整 `prompt/tags` 约束与默认值。
- `packages/shared/src/types/index.ts`
  - `InterviewQuestion` 中移除 `rubric`，`keyPoints/followUps/prompt` 改为可选，`tags` 改为必填。
- `apps/admin/src/components/question-editor-form.tsx`
  - 题目描述可选，标签必填；要点/追问改为可选；移除评分规则输入。
- `apps/admin/src/components/question-editor-modal.tsx`
  - 删除 rubric 处理与校验，调整标签校验与 prompt 逻辑。
- `apps/admin/src/app/api/question-bank/*`
  - 去除 rubric 读写；导入与增删改支持可选要点/追问，标签必填。
- `apps/web/src/lib/server/question-bank-repository.ts`
  - 题库读取去除 rubric 映射，prompt 兜底标题，标签必填输出。
- `packages/interview-engine/src/process-helpers.ts`
  - 没有要点时不触发追问。
- `packages/interview-engine/src/scoring.ts`
  - 没有要点时按空列表评分。
- `packages/llm/src/mock-provider.ts`
  - 题目描述缺失时回退标题，追问缺失时使用默认文案。
- `docs/QuestionBank.md`
  - 字段说明更新为“题目描述可选、要点/追问可选、标签必填”。

### 迁移/破坏性变更

- 题库 `rubric` 字段已移除（需要执行 Prisma 迁移）。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 3.97（2026-03-14）：题库新建页与连续添加

### 目标

- 新建题目使用独立页面而非弹窗；
- 支持“保存并继续添加”，并保留方向/难度/标签/启用字段。

### 主要改动

- `apps/admin/src/app/questions/new/page.tsx`
  - 新增题库新建页面。
- `apps/admin/src/components/question-create-form.tsx`
  - 新建题目表单逻辑，支持“保存并继续添加”保留指定字段。
- `apps/admin/src/components/questions-table-card.tsx`
  - 新建按钮改为跳转新建页面，编辑仍使用弹窗。
- `apps/admin/src/components/question-editor-modal.tsx`
  - 新建/编辑提示词描述可空，保存时传入 `null`。
- `apps/admin/src/app/api/question-bank/items/[id]/route.ts`
  - 更新时 `prompt` 空值写入 `null`，不再强制回填标题。
- `apps/admin/src/app/api/question-bank/items/route.ts`
  - 创建题目时由系统生成 `questionId`，不再接受用户输入。
- `apps/admin/src/app/api/question-bank/import/route.ts`
  - 导入题库时 `id` 改为可选，由系统生成 `questionId`。
- `apps/admin/src/components/question-editor-form.tsx`
  - 移除题目 ID 输入框。
- `apps/admin/src/components/question-editor-modal.tsx`
  - 创建/编辑不再提交题目 ID。

### 迁移/破坏性变更

- 无。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- `pnpm spellcheck`

## Iteration 4.06（2026-03-15）：题库编辑改为独立页面

### 目标

- 题库列表“编辑”跳转到独立页面，移除弹窗编辑。

### 主要改动

- `apps/admin/src/components/questions-table-card.tsx`
  - 编辑操作改为跳转 `/questions/[id]/edit`，移除编辑弹窗。
- `apps/admin/src/app/questions/[id]/edit/page.tsx`
  - 新增题库编辑页面，服务端加载题目数据。
- `apps/admin/src/components/question-edit-view.tsx`
  - 复用表单组件构建编辑视图，保存后返回题库列表。

### 迁移/破坏性变更

- 无。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- `pnpm spellcheck`

## Iteration 4.07（2026-03-15）：题库参考答案默认高度

### 目标

- 参考答案文本域默认最小高度为 10 行。

### 主要改动

- `apps/admin/src/components/question-editor-form.tsx`
  - 参考答案文本域默认 `rows=10`。

### 迁移/破坏性变更

- 无。

### 验证

- 未执行（按需运行 `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm spellcheck`）。

## Iteration 4.08（2026-03-15）：题库表格序号列

### 目标

- 题库表格首列显示序号（排序序号），不展示题目 ID。
- 新建/编辑页“排序序号”字段改名为“序号”。

### 主要改动

- `apps/admin/src/components/questions-table-card.tsx`
  - 表格首列改为“序号”，移除“题目 ID”列。
- `apps/admin/src/components/question-editor-form.tsx`
  - 排序序号字段 label 改为“序号”。

### 迁移/破坏性变更

- 无。

### 验证

- 未执行（按需运行 `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm spellcheck`）。

## Iteration 4.09（2026-03-15）：分页与题库菜单文案

### 目标

- 表格分页的 “page” 文案改为中文“页”。
- 题库操作菜单文案调整为“编辑题目 / 删除题目”。

### 主要改动

- `apps/admin/src/components/admin-pagination.tsx`
  - Pagination 使用 antd 的中文 locale（`antd/locale/zh_CN`），统一分页文案。
- `apps/admin/src/components/question-row-actions.tsx`
  - 调整题库操作菜单项文案。

### 迁移/破坏性变更

- 无。

### 验证

- 未执行（按需运行 `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm spellcheck`）。

## Iteration 4.10（2026-03-21）：移除模板模块

### 目标

- 管理端移除模板管理模块，题库为唯一后台功能入口。
- 数据库模型移除 `InterviewTemplate`。

### 主要改动

- `apps/admin/src/components/admin-shell.tsx`
  - 侧栏移除模板导航项。
- `apps/admin/src/app/page.tsx`
  - 概览卡片移除模板数量，调整建议文案。
- `apps/admin/src/app/templates/*`
  - 移除模板页面与表单实现。
- `apps/admin/src/app/api/interview-templates/route.ts`
  - 移除模板管理 API。
- `packages/db/prisma/schema.prisma`
  - 删除 `InterviewTemplate` 模型。
- `packages/db/prisma/migrations/20260321120000_remove_interview_template/migration.sql`
  - 新增迁移删除 `InterviewTemplate` 表。
- `packages/db/src/index.ts`
  - 移除 `InterviewTemplate` 类型导出。

### 迁移/破坏性变更

- 需要执行 Prisma 迁移以删除 `InterviewTemplate` 表。

### 验证

- 未执行（按需运行 `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm spellcheck`）。

## Iteration 4.11（2026-03-21）：修复题库上传页渲染异常

### 目标

- 修复“上传题库”页面打开即报 `Element type is invalid` 的问题。

### 主要改动

- `apps/admin/src/app/questions/upload/page.tsx`
  - 上传页 Server Component 仅保留鉴权与页面壳，具体上传 UI 改为独立 Client 组件承载。
- `apps/admin/src/components/question-upload-view.tsx`
  - 新增题库上传视图组件，承载 antd 的 `Card`、`Typography.Paragraph`、返回按钮与 `UploadForm`。

### 迁移/破坏性变更

- 无。

### 验证

- 已执行：
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.12（2026-03-27）：模拟面试流程 Phase 1 落地

### 目标

- 落地“先自我介绍，再自然开场”的第一阶段流程重构。
- 为后续按时长驱动出题、动态追问和统一评分补齐共享状态字段。

### 主要改动

- `packages/shared/src/types/index.ts`
  - `InterviewConfig` 新增 `durationMinutes`。
  - 新增 `InterviewPhase`，并为 runtime 增加 `interviewPhase / introductionCompletedAt / introductionText`。
- `packages/shared/src/defaults/index.ts`
  - 默认面试时长设为 `30` 分钟。
- `packages/shared/src/utils/index.ts`
  - `normalizeInterviewConfig` 新增时长归一化，并按时长推导默认题量。
- `packages/interview-engine/src/process-helpers.ts`
  - 空闲态开始面试时，若缺少有效自我介绍则先进入 `awaiting_intro`。
  - 若开始命令中已包含足够背景信息，则直接完成规划并进入自然开场。
  - 题库无可用题目时回退为 `idle`，避免进入假开场状态。
- `packages/interview-engine/src/process-session-message.ts`
  - 增加 `awaiting_intro` 分支，接收自我介绍后再进入正式提问。
- `packages/interview-engine/src/session-core.ts`
  - 补齐 runtime 兼容与克隆逻辑，并增加自我介绍启发式识别。
- `packages/llm/src/contracts.ts`
  - provider 契约新增 `generateInterviewIntroRequest`。
- `packages/llm/src/mock-provider.ts`
  - 开场文案不再向用户暴露固定题数、反馈模式和内部追问机制。
- `apps/admin/src/lib/chat-session-runtime.ts`
  - Admin 端 runtime 解码补齐新阶段字段兼容。
- `apps/web/src/app/chat/lib/chat-session-draft.ts`
  - Web 端草稿会话默认 runtime 补齐新字段。
- `packages/interview-engine/src/index.test.ts`
  - 单测改为覆盖 `awaiting_intro -> questioning -> closing` 新流程。

### 迁移/破坏性变更

- 无数据库迁移。
- 旧会话 runtime 若缺少新字段，当前已由兼容层自动补默认值。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/index.test.ts packages/shared/src/index.test.ts packages/interview-engine/src/interview-planning.test.ts packages/agent-skills/src/planning-skills.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.13（2026-03-27）：混合出题第一版

### 目标

- 让面试规划不再只依赖题库标准题。
- 在保证性能和稳定性的前提下，先落地项目深挖题与技能验证题。

### 主要改动

- `packages/shared/src/types/index.ts`
  - 新增 `InterviewQuestionSource`。
  - `InterviewQuestion` 增加 `sourceType / probeTarget / generationReason`。
  - `InterviewPlanningStepTrace` 增加 `sourceType / reason`，并支持 `generated_probe`。
- `packages/interview-engine/src/interview-planning.ts`
  - 规划器现在会在标准题之外，按规则插入：
    - `project_probe`：项目深挖题
    - `skill_probe`：技能验证题
  - 四题及以上时，优先补项目题；检测到题库未覆盖或标准题未覆盖的技能时，再补技能题。
  - 即使题库为空，只要候选人信息充分，也能生成最小可用的混合题单。
  - `planningSummary` 不再包含固定题数表述。
- `packages/agent-skills/src/planning-skills.ts`
  - 简历画像规则标签扩展到 `reactnative / electron / microfrontend / miniprogram` 等题库外技能。
- `packages/llm/src/mock-provider.ts`
  - 根据题目来源切换更自然的提问引导文案。
- `apps/admin/src/components/session-planning-trace-card.tsx`
  - 规划 Trace 增加题目来源与生成原因展示。
- `apps/admin/src/components/session-execution-trace-card.tsx`
  - 执行 Trace 增加题目来源、探针目标与生成原因展示。
- `packages/interview-engine/src/interview-planning.test.ts`
  - 新增项目题、技能题、空题库混合题单回归测试。

### 迁移/破坏性变更

- 无数据库迁移。
- 旧会话没有 `sourceType` 等字段时，仍按兼容默认值处理。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/interview-engine/src/interview-planning.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.14（2026-03-27）：评估驱动追问第一版

### 目标

- 让追问不再只依赖题目预设追问数组或单一 keyPoints 覆盖率。
- 先按题目来源和回答信号做稳定的规则分流，为后续模型化追问做接口准备。

### 主要改动

- `packages/shared/src/types/index.ts`
  - 新增 `InterviewFollowUpSignal`。
  - `InterviewFollowUpTrace` 新增 `signal / reason` 字段。
- `packages/agent-skills/src/follow-up-skill.ts`
  - 重构为 `v2` 规则：
    - `standard`：优先追缺失关键点
    - `skill_probe`：优先追机制深度与工程取舍
    - `project_probe`：优先追职责边界、结果验证和方案取舍
  - 追问决策会结合回答长度、机制信号、取舍信号、项目 ownership/evidence 信号。
- `packages/llm/src/contracts.ts`
  - `generateFollowUpMessage` 契约补充 `signal / reason`。
- `packages/llm/src/mock-provider.ts`
  - 按追问信号输出更自然的项目题/技能题追问文案。
- `packages/interview-engine/src/process-helpers.ts`
  - 透传新的追问信号与原因给 provider。
- `apps/admin/src/components/session-execution-trace-card.tsx`
  - 执行 Trace 增加追问信号与决策原因展示。
- `packages/agent-skills/src/follow-up-skill.test.ts`
  - 新增项目题与技能题追问回归测试。

### 迁移/破坏性变更

- 无数据库迁移。
- 旧追问 trace 若缺少 `signal / reason`，只影响旧会话展示，不影响主链路执行。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/agent-skills/src/follow-up-skill.test.ts packages/interview-engine/src/index.test.ts packages/interview-engine/src/interview-planning.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`

## Iteration 4.15（2026-03-27）：统一评分权重第一版

### 目标

- 让 `standard / skill_probe / project_probe` 全部进入统一评分体系。
- 避免项目题和技能题“问了但不真正影响最终结论”。

### 主要改动

- `packages/shared/src/types/index.ts`
  - `QuestionAssessment` 新增 `sourceType / scoreWeight / weightReason`。
  - 报告 Trace 的维度来源与要点来源新增权重信息。
- `packages/agent-skills/src/assessment-skill.ts`
  - 评估阶段按题目来源写入显式权重：
    - `standard = 1.0`
    - `skill_probe = 1.15`
    - `project_probe = 1.25`
- `packages/agent-skills/src/report-skill.ts`
  - 维度均分与总分改为按题目权重聚合，不再简单平均。
  - 优势/短板提炼与排序也改为按加权来源聚合。
  - 报告聚合公式说明同步更新到 Trace。
- `packages/interview-engine/src/session-core.ts`
  - 运行时克隆逻辑补齐新权重字段兼容。
- `apps/admin/src/components/session-report-trace-card.tsx`
  - 报告 Trace 现可展示每个维度来源的权重，以及优势/短板来源的权重标签。
- `packages/agent-skills/src/assessment-skill.test.ts`
  - 新增项目题权重回归测试。
- `packages/agent-skills/src/report-skill.test.ts`
  - 新增强权重聚合回归测试。
- `packages/evals/src/report-trace-fixtures.ts`
  - 报告评测 fixture 补齐默认权重字段，保持契约完整。

### 迁移/破坏性变更

- 无数据库迁移。
- 历史 assessment/report trace 缺少权重字段时，会按兼容默认值 `1.0` 处理。

### 验证

- 已执行：
  - `pnpm exec vitest run packages/agent-skills/src/assessment-skill.test.ts packages/agent-skills/src/report-skill.test.ts packages/evals/src/report-trace-evals.test.ts`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm spellcheck`
