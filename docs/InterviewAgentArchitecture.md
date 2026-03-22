# Web 端 AI 面试 Agent 架构设计

目的：在保证产品可用性的前提下，把面试通升级为一个真正能体现 AI Agent 工程能力的项目。该设计重点服务于两件事：

- 产品侧：让模拟面试、简历分析、面后复盘真正可用，而不是“套壳聊天”。
- 展示侧：明确体现 `LangGraphJS`、`Hybrid RAG`、`Skills`、`Memory`、`Trace`、`Eval` 等 AI 常用技术的工程化应用。

## 1. 设计目标

### 1.1 产品目标

- 基于用户简历、目标岗位、工作年限与技术标签，生成更贴合候选人的面试题单。
- 在面试过程中动态决定提问、追问、切题与总结，而不是固定脚本问答。
- 输出结构化、可回放、可解释的面试过程与结果。

### 1.2 展示目标

- 项目需要明确体现“Agent orchestration”而不只是“调用一次模型接口”。
- 项目需要明确体现“RAG 检索增强”而不只是“数据库随机抽题”。
- 项目需要明确体现“Skill-based architecture”而不只是“单个超长 Prompt”。
- 项目需要明确体现“可观测与可评估”而不只是“能跑起来”。

## 2. 方案比较

### 方案 A：产品优先，AI 只做辅助

- 做法：继续沿用当前 Web 对话 + 题库抽题模式，只在少量环节加一点 Prompt 或 RAG。
- 优点：实现快，风险低。
- 缺点：AI 亮点弱，求职时很难证明自己做过真正的 Agent 工程。

### 方案 B：全量 Agent 化

- 做法：几乎所有链路都迁移到 LangGraphJS，所有流程都做图编排。
- 优点：AI 味足，技术展示强。
- 缺点：容易过度设计，很多不需要图的 CRUD 场景也会被复杂化，产品稳定性和交付速度都会变差。

### 方案 C：核心链路 Agent 化，外围保持标准 Web 工程

- 做法：把真正需要多步推理、工具调用、状态流转、人工介入的链路放进 LangGraphJS；后台管理、题库维护、普通会话 CRUD 继续按标准 Next.js 工程实现。
- 优点：展示效果与产品实用性平衡最好。
- 缺点：需要清晰划分边界，避免图编排和传统服务层职责混乱。

### 推荐结论

选择方案 C。

原因：

- 对求职展示最有价值的是“你知道哪些地方该用 Agent，哪些地方不该用”。
- 面试场景天然适合状态机、子图、工具调用、检索、人工中断恢复。
- 后台管理与普通会话存储并不需要强行 Agent 化，保留标准 Web 工程更稳。

## 3. 总体设计原则

### 3.1 核心链路必须 Agent 化

以下链路由 `LangGraphJS` 驱动：

- 简历画像
- 面试规划
- 题目检索与选题
- 提问与追问
- 回答评估
- 面后报告

### 3.2 检索采用 Hybrid RAG，而不是纯向量召回

原因：

- 面试题选择天然存在结构化约束：难度、标签、启用状态、去重、覆盖均衡、题量配额。
- 纯向量召回适合“找相关内容”，不适合直接决定“本场面试问哪几道题”。

因此检索分两层：

- 元数据控制：难度、标签、启用状态、去重、配额。
- 语义增强：向量召回、重排、补位。

### 3.3 Skills 必须显式建模

不要把所有能力写进一个巨大的 Prompt。

应该把能力拆成可复用的 `Skill`：

- 简历画像
- 面试蓝图规划
- 题目选择
- 追问生成
- 回答评估
- 报告生成
- 简历改写

### 3.4 结果必须可观测、可回放、可评估

Agent 项目如果没有 Trace 和 Eval，展示效果会明显下降。至少需要：

- 每次运行可追踪节点输入输出
- 检索结果可回放
- 面试规划可解释
- 能跑离线评测集

## 4. 总体架构

## 4.1 系统边界

- `apps/web`
  - 用户侧 Web、简历上传/输入、模拟面试、报告展示
- `apps/admin`
  - 题库管理、题目维护、启用状态控制
- `packages/interview-engine`
  - 升级为面试 Agent 编排核心
- `packages/retrieval`
  - 新增，承载题库 RAG 与知识 RAG
- `packages/agent-skills`
  - 新增，承载 Skill 协议与能力实现
- `packages/evals`
  - 新增，承载评测样例、指标、回归测试
- `packages/llm`
  - 模型调用、Embedding 调用、重排器抽象
- `packages/shared`
  - 类型、Schema、常量、运行态协议

### 4.2 逻辑分层

1. `UI/BFF 层`

- 接收用户输入
- 渲染面试过程
- 展示报告

2. `Agent Orchestration 层`

- 用 LangGraphJS 编排状态图
- 控制节点流转、分支、重试、人工中断恢复

3. `Skills 层`

- 对每个能力做输入输出协议化封装
- 统一工具和 Prompt 入口

4. `Retrieval 层`

- 题库检索
- 知识检索
- 重排与补位

5. `Persistence/Observability 层`

- 会话状态
- Trace
- 检索快照
- Eval 结果

## 5. 运行时主链路

### 5.1 从产品角度看

1. 用户提交简历、岗位目标、工作年限、技术栈偏好
2. 系统生成 `ResumeProfile`
3. 系统生成 `InterviewBlueprint`
4. 系统检索题单并生成 `QuestionPlan`
5. 系统逐题提问、按需追问
6. 系统评估每题回答
7. 系统生成整场报告

### 5.2 从 Agent 角度看

1. 输入路由
2. 简历画像
3. 面试蓝图规划
4. 检索与选题
5. 当前轮提问
6. 回答评估
7. 追问或切题判断
8. 最终报告生成

## 6. LangGraphJS 主图设计

`LangGraphJS` 官方强调的生产能力包括状态图、checkpointing、streaming、subgraphs、human-in-the-loop 与持久化恢复。这些能力正适合模拟面试场景中的“多轮状态 + 可中断 + 可恢复”需求。

推荐主图如下：

```text
START
  -> intake_router
  -> resume_profile_subgraph
  -> interview_plan_subgraph
  -> question_retrieval_subgraph
  -> interview_turn_subgraph
  -> assessment_subgraph
  -> report_subgraph
  -> END
```

### 6.1 `intake_router`

职责：

- 判断用户当前想做什么
- 路由到不同能力链路

建议识别的意图：

- 简历优化
- 开始模拟面试
- 继续上次面试
- 单题问答
- 面后复盘

### 6.2 `resume_profile_subgraph`

职责：

- 读取简历、岗位目标、工作年限、补充输入
- 输出结构化 `ResumeProfile`

关键能力：

- 识别候选人主技术栈
- 判断 seniority
- 抽取项目标签
- 识别技术亮点与薄弱项

### 6.3 `interview_plan_subgraph`

职责：

- 基于 `ResumeProfile` 生成本场 `InterviewBlueprint`

输出建议包含：

- 题量
- 难度分布
- 标签分布
- 必须覆盖标签
- 可选补位标签
- 排除标签
- 结束条件

### 6.4 `question_retrieval_subgraph`

职责：

- 基于 `InterviewBlueprint` 做 Hybrid RAG 检索
- 生成最终 `QuestionPlan`

### 6.5 `interview_turn_subgraph`

职责：

- 提出当前题
- 判断是否需要追问
- 决定继续追问、切下一题还是结束

### 6.6 `assessment_subgraph`

职责：

- 对本题回答做结构化评估
- 记录证据、亮点、缺口、建议追问方向

### 6.7 `report_subgraph`

职责：

- 汇总整场面试结果
- 生成结构化报告与改进建议

### 6.8 `interrupt / human-in-the-loop`

适合使用 LangGraphJS interrupt 的场景：

- 简历画像后展示画像摘要，允许用户确认/修正
- 面试蓝图生成后展示方向概览，允许用户调整
- 检索到的题单不理想时，允许用户选择“更偏基础/更偏框架/更偏工程化”

这是非常适合展示 Agent 工程能力的设计点。

## 7. 状态模型设计

建议在运行态维护一个统一的 `AgentSessionState`：

```ts
interface AgentSessionState {
  sessionId: string;
  userId: string;
  intent: 'resume_review' | 'mock_interview' | 'qa' | 'review_report';
  resumeText?: string;
  resumeProfile?: ResumeProfile;
  interviewBlueprint?: InterviewBlueprint;
  questionPlan: PlannedQuestion[];
  currentQuestionIndex: number;
  currentFollowUpRound: number;
  currentAnswerDrafts: string[];
  assessments: QuestionAssessment[];
  report?: InterviewReport;
  traceId: string;
}
```

设计原则：

- `ResumeProfile` 是候选人画像，不是题目计划
- `InterviewBlueprint` 是本场策略，不是最终题单
- `QuestionPlan` 是最终可执行题单
- `Assessment` 是过程产物，最终汇总成 `Report`

## 8. ResumeProfile 设计

```ts
interface ResumeProfile {
  role: 'frontend';
  targetRole?: string;
  seniority: 'junior' | 'mid' | 'senior';
  yearsOfExperience?: number | null;
  primaryTags: Array<{ tag: string; weight: number }>;
  secondaryTags: Array<{ tag: string; weight: number }>;
  projectTags: string[];
  strengths: string[];
  riskFlags: string[];
  evidence: string[];
  confidence: number;
}
```

用途：

- 给规划节点提供稳定输入
- 给报告节点提供“是否符合岗位画像”的参照
- 给简历优化场景复用

## 9. InterviewBlueprint 设计

```ts
interface InterviewBlueprint {
  questionCount: number;
  difficultyDistribution: {
    junior: number;
    mid: number;
    senior: number;
  };
  tagDistribution: Array<{ tag: string; weight: number }>;
  mustIncludeTags: string[];
  optionalTags: string[];
  avoidTags: string[];
  strategyNotes: string[];
}
```

建议默认策略：

- 初级前端：`junior 60% + mid 30% + senior 10%`
- 中级前端：`junior 30% + mid 50% + senior 20%`
- 高级前端：`junior 10% + mid 40% + senior 50%`

后续可根据岗位方向再细分：

- 偏 React
- 偏工程化
- 偏性能优化
- 偏中后台业务

## 10. Skills 设计

### 10.1 为什么要做 Skills

如果所有链路都依赖某一个超长 Prompt：

- 难以复用
- 难以测试
- 难以替换模型
- 难以做节点级别追踪

所以建议显式定义 `Skill`：

```ts
interface AgentSkill<I, O> {
  id: string;
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
  tools: string[];
  execute(input: I, context: SkillContext): Promise<O>;
}
```

### 10.2 第一阶段需要的 Skill

1. `resume_profiler`

- 输入：简历文本、岗位目标
- 输出：`ResumeProfile`

2. `interview_planner`

- 输入：`ResumeProfile`
- 输出：`InterviewBlueprint`

3. `question_selector`

- 输入：`InterviewBlueprint`、候选题集
- 输出：`QuestionPlan`

4. `followup_generator`

- 输入：当前题、当前回答、知识检索结果
- 输出：追问

5. `answer_assessor`

- 输入：题目、用户回答、参考答案、要点
- 输出：结构化评分

6. `report_writer`

- 输入：整场评估结果
- 输出：报告

7. `resume_rewriter`

- 输入：简历片段、目标岗位
- 输出：优化建议

## 11. Hybrid RAG 设计

### 11.1 为什么不能做纯 RAG

纯 RAG 的问题：

- 无法稳定控制难度比例
- 无法稳定控制标签覆盖
- 难以做同用户多场面试去重
- 无法精确处理“启用状态/下架题目/后台筛选约束”

因此必须做 `Hybrid RAG`。

### 11.2 检索分为两个知识域

#### 题库检索

用途：

- 决定“问什么”

数据源：

- `QuestionBankItem`

#### 知识检索

用途：

- 辅助“怎么追问”
- 辅助“怎么评估”
- 辅助“怎么生成改进建议”

数据源建议：

- 前端知识文档
- 项目案例模板
- 常见误区库
- 追问策略知识片段

### 11.3 题库检索链路

推荐流程：

1. 元数据过滤

- `isActive = true`
- 难度落在目标范围内
- 标签与蓝图有交集
- 排除近期已问过题目

2. 向量召回

- 取与当前题位目标最相关的 `topK`

3. 重排

- 综合考虑：
  - 标签匹配度
  - 难度匹配度
  - 语义相关度
  - 题目区分度
  - 与已选题的相似度惩罚

4. 配额满足

- 先满足难度配额
- 再满足必须覆盖标签

5. 补位

- 若某标签题量不足，扩展到邻近标签
- 若某难度不足，扩展到相邻难度

### 11.4 检索文档设计

建议将题目拆成检索文档：

- 标题
- 题目描述
- 参考答案摘要
- 要点摘要
- 追问摘要
- 规范化标签
- 难度

向量化文本建议不是只用标题，而是拼成检索文本：

```text
标题 + 描述 + 标签 + 要点摘要 + 参考答案摘要
```

### 11.5 标签设计

标签需要分层：

1. 规范标签

- `javascript`
- `typescript`
- `react`
- `vue`
- `nextjs`
- `engineering`
- `performance`
- `network`
- `browser`
- `node`

2. 自定义标签

- 业务特征、场景特征、项目经验特征

策略：

- 抽题主逻辑优先依赖规范标签
- 自定义标签作为增强信号，不直接成为主控制轴

## 12. 数据模型建议

### 12.1 现有表保留

- `QuestionBankItem`
- `ChatSessionRecord`
- `AuthUser`
- `AdminUser`

### 12.2 新增建议表

#### `QuestionRetrievalDoc`

用途：

- 维护题目检索文本与向量索引

建议字段：

- `id`
- `questionItemId`
- `searchText`
- `normalizedTags`
- `embedding`
- `embeddingModel`
- `embeddingVersion`
- `contentHash`
- `updatedAt`

#### `ResumeArtifact`

用途：

- 存简历原文与结构化画像快照

建议字段：

- `id`
- `userId`
- `sourceText`
- `parsedProfile`
- `createdAt`

#### `AgentRunTrace`

用途：

- 保存一次 Agent 运行的节点轨迹

建议字段：

- `id`
- `sessionId`
- `graphName`
- `nodeName`
- `inputSnapshot`
- `outputSnapshot`
- `startedAt`
- `finishedAt`
- `status`

#### `EvalRun`

用途：

- 记录离线评估结果

建议字段：

- `id`
- `suiteName`
- `caseId`
- `score`
- `metrics`
- `createdAt`

## 13. Memory 设计

### 13.1 短期记忆

存储位置：

- `ChatSessionRecord.runtime`

内容：

- 当前题号
- 当前追问轮次
- 当前回答草稿
- 当前评估结果

### 13.2 中期记忆

存储位置：

- 最近几场面试记录

内容：

- 最近已问过题
- 最近薄弱标签
- 最近面试报告摘要

用途：

- 防止重复题
- 生成连续训练计划

### 13.3 长期记忆

存储位置：

- `ResumeArtifact`

内容：

- 候选人技术画像
- 稳定标签偏好
- 历史成长轨迹

## 14. Trace 与 Eval 设计

### 14.1 Trace

每次运行至少记录：

- 简历画像输入/输出
- 面试蓝图输入/输出
- 题目候选集与最终题单
- 每轮追问决策
- 每题评分证据
- 最终报告

### 14.2 Eval

建议建立固定评测集：

- 初级前端简历
- 中级 React 简历
- 偏工程化简历
- 偏性能优化简历
- 偏中后台业务简历

评估指标建议：

- 难度匹配度
- 标签覆盖合理性
- 重复题率
- 检索命中率
- 报告一致性
- 追问质量

## 15. 与当前代码的衔接

当前代码需要重点调整的地方：

### 15.1 抽题时机调整

当前是“创建会话时即生成 `questionPlan`”。

建议改为：

- 创建空会话时不生成题单
- 用户提交简历并点击“开始模拟面试”时，再触发 `resume_profile -> blueprint -> retrieval -> question_plan`

### 15.2 从 `topics` 迁移到 `tags`

当前 `packages/interview-engine/src/question-plan.ts` 仍以固定 `InterviewTopic` 为主。

建议改为：

- 抽题主控制轴从 `topics` 切到 `tags`
- `topics` 仅作为兼容字段或 UI 级配置，不再主导选题算法

### 15.3 `packages/interview-engine` 职责升级

从：

- 简单题单生成 + 会话流程辅助

升级为：

- LangGraphJS graph 入口
- 子图定义
- 状态协议
- 节点执行器

### 15.4 新增 Retrieval 与 Skills 包

- `packages/retrieval`
- `packages/agent-skills`
- `packages/evals`

## 16. 分阶段实施建议

### Phase 1：最小可展示版本

目标：

- 先把“AI Agent 的骨架”跑起来，同时不把项目搞崩

范围：

- LangGraphJS 主图接入
- `ResumeProfile`
- `InterviewBlueprint`
- 题库 `Hybrid RAG`
- `questionPlan` 延迟生成
- 基础 Trace

当前已落地：

- `packages/interview-engine` 已用 LangGraphJS 承接 `ResumeProfile -> InterviewBlueprint -> QuestionPlan` 的规划骨架。
- `packages/agent-skills` 已落地第一版显式 Skill 协议，当前先承接：
  - `ResumeProfileSkill`
  - `InterviewBlueprintSkill`
  - 后续可以在不改 LangGraph 节点边界的前提下，替换为真实 LLM / Tool 驱动实现
- `ResumeProfileSkill` 已优先升级为第一条“真实 LLM + fallback”链路：
  - 当 `LLM_PROVIDER=deepseek` 且存在有效 `DEEPSEEK_API_KEY` 时，会调用 DeepSeek JSON 输出生成结构化候选人画像
  - 若模型调用失败、结构无效或当前环境未启用 DeepSeek，则自动回退为规则版画像
  - 当前 `packages/llm` 已补齐轻量 `DeepSeekJsonCompletionProvider`，后续可复用于 `AssessmentSkill` / `ReportSkill`
- `packages/retrieval` 已落地 Hybrid RAG 第一阶段检索层，当前采用：
  - 元数据过滤
  - 词法召回
  - 标签权重重排
  - 难度配额补位
- 规划阶段的 trace snapshot 已落地到运行态：
  - 每个题位保留目标难度
  - 保留候选题 topN 与分数拆解
  - 保留最终入选结果
- 检索层已补 `retriever adapter` 边界：
  - 当前默认是 lexical retriever
  - 后续可新增 vector retriever 并在规划层无感切换
- embedding / vector 契约也已提前收口：
  - `packages/llm` 负责 embedding provider 协议
  - `packages/retrieval` 负责 vector retriever 与 fallback 组装
- 当前尚未接入 `pgvector/embeddings`，但检索接口已独立，后续可以直接替换召回后端而不改规划层主流程。

### Phase 2：能力增强版本

范围：

- 知识 RAG
- 追问 Skill
- 人工确认/中断恢复
- 近期去重
- 多场面试连续训练

当前进展补充：

- `追问 Skill` 已提前落地第一版规则实现：
  - `packages/agent-skills` 提供 `FollowUpSkill`
  - `interview-engine` 执行链路改为消费 Skill 输出的 `trace + shouldAskFollowUp`
  - 当前仍复用现有 provider 生成追问文本，因此用户可见行为保持不变
- `AssessmentSkill` 也已提前落地第一版规则实现：
  - `packages/agent-skills` 提供 `AssessmentSkill`
  - `interview-engine` 单题评分链路改为消费 Skill 输出的 `assessment + trace`
  - 当前已升级为“DeepSeek 结构化评分 + 规则 fallback”混合实现：
    - 在 `LLM_PROVIDER=deepseek` 且存在有效 `DEEPSEEK_API_KEY` 时，优先用 DeepSeek 输出结构化维度评分与总结
    - 若模型调用失败、结构无效或当前环境未启用 DeepSeek，则自动回退为规则版评分
    - 针对题库 `keyPoints` 可为空的现状，fallback 也已补齐无要点场景下的启发式评分
- `ReportSkill` 也已提前落地第一版规则实现：
  - `packages/agent-skills` 提供 `ReportSkill`
  - `interview-engine` 在“完成面试 / 补报告”两个入口都改为消费 Skill 输出的 `report + trace`
  - 当前已升级为“DeepSeek 结构化总结 + 规则 fallback”混合实现：
    - `overallScore / level / dimensionSummary / dimensionTraces` 继续走规则聚合，保证可回归与可解释
    - `overallSummary / strengths / gaps / nextSteps` 在 `LLM_PROVIDER=deepseek` 且存在有效 `DEEPSEEK_API_KEY` 时优先由 DeepSeek 结构化生成
    - 若模型调用失败、结构无效或当前环境未启用 DeepSeek，则自动回退为规则版报告模板
    - 叙述层输出会尽量对齐已有 strengths/gaps sources，避免 Admin Trace 丢失题目来源关系

### Phase 3：评测与展示版本

范围：

- 离线 Eval
- Prompt/Skill 回归测试
- 检索质量评估
- 可视化 Trace 页面

当前已开始落地：

- `packages/evals` 已作为离线题单评测基线存在。
- 当前评测先覆盖“简历画像 -> 题单输出”的稳定性。
- 当前又新增了一层 `skill regression evals`，用于验证：
  - `ResumeProfileSkill`
  - `AssessmentSkill`
  - `ReportSkill`
- 这层基线当前不做真实联网模型评测，而是通过代表性的结构化 inference fixture 来验证：
  - merge 逻辑
  - tag / point canonicalize
  - trace 与最终结果一致性
  - fallback 稳定性
- 当前离线评测基线已形成三层：
  - `question planning evals`
  - `report trace evals`
  - `skill regression evals`
- 当前又新增了一层“手动触发的真实模型评测”：
  - 默认不进入 CI
  - 仅在 `RUN_LLM_EVALS=1` 时显式运行
  - 当前先覆盖 `ResumeProfileSkill / AssessmentSkill / ReportSkill`
  - 用途是做真实 DeepSeek smoke / capability check，而不是替代离线 regression baseline
- Web 端当前还保留一条独立的“真实出题链路 smoke”：
  - 入口为 `/api/chat/stream`
  - 通过 `pnpm evals:web:planning:smoke` 手动执行
  - 它不会依赖 DeepSeek，而是固定 `LLM_PROVIDER=ollama` / `EMBEDDING_PROVIDER=ollama`
  - 目的不是评估模型文案质量，而是验证：
    - `resumeProfile`
    - `interviewBlueprint`
    - `questionPlan`
    - `planningTrace`
      在真实 Web 端集成下是否完整、对齐、可解释
- 后续可继续扩展为：
  - 检索质量评测
  - Prompt/Skill 回归评测
  - 向量召回前后对比评测

## 17. 最终结论

面试通 Web 端不应只被设计成“一个会聊天的面试网站”，而应被设计成：

`以模拟面试为核心业务场景的 AI Agent 系统`

推荐落地方向：

- 产品侧保持克制，围绕“简历 -> 模拟面试 -> 报告 -> 复训”形成闭环
- 技术侧突出：
  - `LangGraphJS` 状态编排
  - `Hybrid RAG`
  - `Skills`
  - `Memory`
  - `Trace`
  - `Eval`

这样项目既能在真实使用场景里成立，也能在求职面试中明确体现你对 AI Agent 工程的理解与落地能力。

## 18. 参考资料

- LangGraphJS 官方文档与示例：状态图、checkpointing、工具调用、streaming、interrupt、subgraphs
- LangChainJS 官方文档：embeddings、retrievers、vector stores、document loaders、text splitters

注：具体第三方库 API 细节应在实现阶段继续以官方最新文档为准。
