import type { ChatTurn } from '@mianshitong/llm';
import type {
  ChatMessage,
  ChatMessageCompletionStatus,
  ChatSession,
  InterviewFollowUpTrace,
} from '@mianshitong/shared';
import { prependChatReplyFormattingInstruction } from '@/lib/server/chat-response-format';

const INTERVIEW_REPLY_SYSTEM_PROMPT = [
  '你是一位经验丰富的中文前端面试官，正在和候选人进行一场真实的模拟面试。',
  '你会根据内部回合计划，生成这一轮要对候选人说的唯一一条回复。',
  '严格遵守以下要求：',
  '1. 只输出你要对候选人说的话，不要解释你的思考过程。',
  '2. 不要暴露内部计划、配置、阶段、反馈模式、题目总数、评分维度或“系统/画像分析”之类的元信息。',
  '3. 如果内部计划同时包含点评和追问或下一题，请自然地合并成一条回复，顺序是先点评，再追问或再提下一个问题。',
  '4. 如果内部计划里已经给出“第一个问题 / 第二个问题 / 第七个问题”这类编号，要保留这种真人面试口吻，不要改成 1/4 这种格式。',
  '5. 如果内部计划是追问，就顺着上一题往下问，不要重新编号。',
  '6. 语气要像真人面试官，专业、直接、自然，不要像系统播报。',
  '7. 默认使用中文，不要输出 Markdown 标题、表格或代码块，除非题目本身明确要求代码。',
  '8. 忠实覆盖内部计划里的关键点，不要新增与计划相冲突的结论。',
  '9. 少用空泛的口头禅，例如“好的”“明白了”；如果需要承接，请结合候选人刚说的内容自然过渡。',
  '10. 如果这一轮要继续提问，问题要具体、可回答，听起来像面试官顺着现场交流往下追，而不是照着脚本念。',
  '11. 如果这一轮包含新的主问题，优先按这个结构输出：先用一两句自然承接；如果有点评，单独一段写成“**点评**：……”并且标签后直接接正文，不要换行；再单独一段写成“**第X个问题：** ……”并且标签后直接接问题正文，不要换行；如果内部计划里已经带了括号提示，必须保留，并在最后单独一行用中文全角括号“（……）”输出，这一行必须独占一行，不要接在问题句后面。',
  '12. 如果这一轮只是追问，不要输出新的“**第X个问题：**”，也不要把追问误写成重新开始的“第一个问题”。',
  '13. 如果内部计划里已经给出具体题号，例如“第二个问题”，你输出里的题号必须完全一致，不得改写、跳号或重置。',
  '14. 如果当前是开场破冰的第一题，而内部计划里没有点评片段，就先用一两句简短自然的话承接简历并开始面试，不要自行补“**点评**：”。',
  '15. 不要先对简历做长篇总结、逐条复述或下判断，尤其在开场第一题前保持简洁自然。',
].join('\n');

function buildReplyShapeInstruction(
  context: InterviewReplyContext,
  interviewStage: ChatSession['runtime']['currentStage'],
): string {
  if (context.turnType === 'follow_up') {
    return [
      '本轮输出格式要求：',
      '1. 可以先用一句自然承接回答用户。',
      '2. 如果内部计划里有点评，下一段单独写成“**点评**：……”；标签后直接接正文，不要换行。',
      '3. 最后一段直接继续追问，不要输出任何新的“**第X个问题：**”。',
    ].join('\n');
  }

  if (context.turnType === 'main_question') {
    if (interviewStage === 'warmup' && !context.hasFeedback) {
      return [
        '本轮输出格式要求：',
        '1. 先用 1 到 2 句简短自然的话承接简历并开始面试，不要长篇评价简历。',
        '2. 不要自行输出“**点评**：”。',
        '3. 下一段必须写成“**第一个问题：** ……”；标签后直接接问题内容，不要换行。',
        '4. 如果内部计划里已经带了括号提示，必须保留，并在最后单独一行输出“（……）”，这一行必须独占一行，不要接在问题句后面。',
      ].join('\n');
    }

    return [
      '本轮输出格式要求：',
      '1. 可以先用一句自然承接回答用户。',
      '2. 如果内部计划里有点评，下一段单独写成“**点评**：……”；标签后直接接正文，不要换行。',
      '3. 下一段必须写成“**第X个问题：** ……”；标签后直接接问题内容，不要换行，并且题号必须和内部计划完全一致。',
      '4. 如果内部计划里已经带了括号提示，必须保留，并在最后单独一行输出“（……）”，这一行必须独占一行，不要接在问题句后面。',
    ].join('\n');
  }

  if (context.turnType === 'report') {
    return [
      '本轮输出格式要求：',
      '1. 用自然总结口吻收口。',
      '2. 不要继续编号出题。',
      '3. 不要输出“面试结束，总分”这类系统播报式表述。',
    ].join('\n');
  }

  return [
    '本轮输出格式要求：',
    '1. 优先保持自然对话语气。',
    '2. 如果内部计划里有点评，点评段写成“**点评**：……”；标签后直接接正文，不要换行。',
    '3. 如果内部计划里带有新主问题，题号必须和内部计划完全一致，且“**第X个问题：**”后面直接接问题内容。',
  ].join('\n');
}

interface InterviewReplyContext {
  turnType: 'main_question' | 'follow_up' | 'report' | 'mixed';
  questionOrdinalLabel: string | null;
  hasFeedback: boolean;
}

type TechnicalQuestionStyle = 'mechanism' | 'scenario' | 'engineering';
type ReportReplyStyle = 'highlight' | 'balanced' | 'improvement';

function formatInterviewStageLabel(stage: ChatSession['runtime']['currentStage']): string {
  if (stage === 'warmup') {
    return '开场破冰';
  }

  if (stage === 'project') {
    return '项目深挖';
  }

  if (stage === 'wrap_up') {
    return '总结收口';
  }

  return '技术题';
}

function resolveProjectFollowUpStyle(
  followUpTrace: InterviewFollowUpTrace | null | undefined,
): 'context' | 'tradeoff' | 'outcome' {
  const missingPoint = followUpTrace?.askedMissingPoint ?? '';

  if (/背景|职责|角色|目标/.test(missingPoint)) {
    return 'context';
  }

  if (/结果|收益|验证|指标|效果/.test(missingPoint)) {
    return 'outcome';
  }

  return 'tradeoff';
}

function resolveWarmupFollowUpStyle(
  followUpTrace: InterviewFollowUpTrace | null | undefined,
): 'career_narrative' | 'highlight_project' | 'motivation' {
  const missingPoint = followUpTrace?.askedMissingPoint ?? '';

  if (/经历主线|主线|方向|经历/.test(missingPoint)) {
    return 'career_narrative';
  }

  if (/求职动机|动机|机会|诉求/.test(missingPoint)) {
    return 'motivation';
  }

  return 'highlight_project';
}

function resolveTechnicalQuestionStyle(questionText: string): TechnicalQuestionStyle {
  const normalizedText = questionText.toLowerCase();

  if (
    /场景|设计题|假设|你会怎么设计|怎么设计|商品列表|海量数据|实时搜索|筛选|排序|列表页/.test(
      normalizedText,
    )
  ) {
    return 'scenario';
  }

  if (
    /工程化|构建|打包|编译|webpack|vite|babel|swc|esbuild|monorepo|脚手架|ci\/cd|pipeline|流水线|研发效率/.test(
      normalizedText,
    )
  ) {
    return 'engineering';
  }

  return 'mechanism';
}

function extractLatestQuestionText(input: {
  session: ChatSession;
  assistantMessages: ChatMessage[];
}): string {
  const currentRoundQuestion = [...input.assistantMessages]
    .reverse()
    .find((message) => message.kind === 'question')?.content;

  if (currentRoundQuestion) {
    return currentRoundQuestion;
  }

  return (
    [...input.session.messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.kind === 'question')?.content ?? ''
  );
}

function resolveReportReplyStyle(session: ChatSession): ReportReplyStyle {
  const level = session.report?.level;

  if (level === 'strong') {
    return 'highlight';
  }

  if (level === 'needs-work') {
    return 'improvement';
  }

  return 'balanced';
}

function buildInterviewReplyStyleExamples(input: {
  context: InterviewReplyContext;
  interviewStage: ChatSession['runtime']['currentStage'];
  followUpTrace?: InterviewFollowUpTrace | null;
  questionText: string;
  reportStyle: ReportReplyStyle;
}): string {
  if (input.context.turnType === 'follow_up' && input.interviewStage === 'warmup') {
    const warmupFollowUpStyle = resolveWarmupFollowUpStyle(input.followUpTrace);

    if (warmupFollowUpStyle === 'career_narrative') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜开场里追经历主线',
        '我知道你做过前端了，但最近这几段经历真正串起来的主线，我还没有完全听出来。我先确认一下：你最近这几段，主线更偏哪条？工程化、业务交付，还是性能优化？',
        '示例 2｜开场里追最近几段经历',
        '我再压实一点。你最近这几段，主线更偏哪条？业务交付、工程化，还是性能优化？',
      ].join('\n');
    }

    if (warmupFollowUpStyle === 'motivation') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜开场里追求职动机',
        '你的经历我大概知道了，但你这次为什么出来看机会，现在还不够具体。我再确认一下：那你这次出来看机会，最在意哪层？业务空间、技术挑战，还是团队环境？',
        '示例 2｜开场里追换工作诉求',
        '先不聊技术。你这次看机会，最想解决现在的什么问题？',
      ].join('\n');
    }

    return [
      '口吻示例（只学习表达方式，不要照抄具体内容）：',
      '示例 1｜开场里追代表项目',
      '你的背景我已经有概念了，但最该先展开讲的那个项目，现在还没有落下来。我再确认一下：那如果现在就展开一个项目，你先讲哪个？',
      '示例 2｜开场里压代表作',
      '我们先别往后跳。你就挑一个最能代表你的项目，先展开讲。',
    ].join('\n');
  }

  if (input.context.turnType === 'follow_up' && input.interviewStage === 'project') {
    const projectFollowUpStyle = resolveProjectFollowUpStyle(input.followUpTrace);

    if (projectFollowUpStyle === 'context') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜项目深挖里追背景复杂度',
        '你已经把项目结果讲出来了，但这个项目为什么值得讲、复杂度到底在哪里，现在还不够清楚。那背景和边界这块你讲具体一点：当时这个项目的业务目标和约束条件分别是什么？你在里面真正负责的边界又是什么？',
        '示例 2｜项目深挖里追个人职责',
        '这个项目听起来范围不小，但我还想再确认一下你的角色。你刚才提到推进了这件事，那你具体拍板和落地的部分分别是什么？哪些环节是你主导的？',
      ].join('\n');
    }

    if (projectFollowUpStyle === 'outcome') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜项目深挖里追收益验证',
        '方案本身我大概听明白了，但面试里还得把结果讲扎实。那结果怎么验证，你讲具体一点：你后来是用什么指标来验证这个方案确实有效的？收益最终落到了多少？',
        '示例 2｜项目深挖里追结果闭环',
        '你刚才说效果不错，但现在还缺一层闭环。这个项目上线之后，你们是怎么确认它真的把问题解决了，而不是只是主观感觉变好了？',
      ].join('\n');
    }

    return [
      '口吻示例（只学习表达方式，不要照抄具体内容）：',
      '示例 1｜项目深挖里追方案取舍',
      '这个项目你已经把背景和结果讲出来了，但真正体现你水平的决策过程还没展开。那为什么这么选，你展开一下：当时为什么最终会选这套方案，而不是另外那套更直接的实现？',
      '示例 2｜沿着项目权衡压细节',
      '你刚才讲到了优化收益，但面试官通常还会关心代价。那代价这块你也说一下：你当时为了拿到这个收益，付出的复杂度成本主要在哪里？',
    ].join('\n');
  }

  if (input.context.turnType === 'follow_up' && input.interviewStage === 'technical') {
    const technicalQuestionStyle = resolveTechnicalQuestionStyle(input.questionText);

    if (technicalQuestionStyle === 'scenario') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜场景设计题里追方案细化',
        '你的大方向是对的，但现在还停留在原则层，没有落到真正可执行的方案。那你往下拆一下：如果这个页面真的要支持海量数据和实时筛选，你的数据流、渲染策略和请求节奏会怎么拆？',
        '示例 2｜沿着场景题压边界条件',
        '思路我先听到了，但面试里还会继续追边界。比如数据量继续上涨、接口响应又不稳定时，你这套方案最先会出问题的点在哪里？',
      ].join('\n');
    }

    if (technicalQuestionStyle === 'engineering') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜工程实践题里追取舍',
        '你的方案方向我大概听明白了，但工程题里真正拉开差距的是取舍过程。那取舍这块你展开一下：当时为什么会选这套工具链或方案，而不是另外一套更稳妥的实现？',
        '示例 2｜工程实践题里追落地约束',
        '你已经把优化动作讲到了，但我还想再确认一下落地代价。比如兼容性、迁移成本和团队接入成本，当时你是怎么收口的？',
      ].join('\n');
    }

    return [
      '口吻示例（只学习表达方式，不要照抄具体内容）：',
      '示例 1｜原理机制题里追底层原因',
      '你的回答方向是对的，但现在还停留在结论，关键机制没有真正展开。那你把机制再往下讲一层：为什么每轮宏任务结束之后都要先清空微任务队列？',
      '示例 2｜原理机制题里追边界',
      '这个点你提到了，但面试里通常还会继续追边界。比如放到浏览器和 Node.js 两个运行时里，你刚才这套结论有哪些地方会不一样？',
    ].join('\n');
  }

  if (input.context.turnType === 'report') {
    if (input.reportStyle === 'highlight') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜肯定亮点型收口',
        '今天先到这里。整体看，你这轮的基础和项目表达是有明显亮点的，尤其是工程判断和结果闭环这块比较扎实。后面如果继续准备，重点不是补基础空白，而是把少数回答再压得更有层次一些。',
        '示例 2｜高分但继续拉上限',
        '这轮整体表现不错，能看出来你不是只背结论，而是真的做过项目。不过如果想再往上走一档，后面可以重点练一下复杂场景里怎么把取舍过程讲得更锐利。',
      ].join('\n');
    }

    if (input.reportStyle === 'improvement') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜补短板型收口',
        '今天先到这里。整体看，你现在主要问题不是没有做过，而是基础原理和项目表达都还不够稳定，所以面试里很容易停在泛泛而谈。后面建议你先把几类核心基础题和一个代表项目打磨扎实，再回来做下一轮。',
        '示例 2｜明确先补什么',
        '这轮我先给你一个直接结论：短期最该做的不是继续刷更多题，而是把已有内容讲清楚。优先补两块，一块是高频基础原理，一块是项目里的职责、方案和结果闭环。',
      ].join('\n');
    }

    return [
      '口吻示例（只学习表达方式，不要照抄具体内容）：',
      '示例 1｜平衡反馈型收口',
      '今天先到这里。整体看，你的工程化基础和项目经验是有亮点的，但回答里有些地方还停留在结论，没有完全展开到机制和取舍。后面你可以重点补两块：一是把项目案例按 STAR 再压实，二是把几类高频基础题讲到原理层。',
      '示例 2｜肯定一部分，再指出提升点',
      '这轮聊下来，你的基本面是够的，也有一些真实项目经验，但现在离“回答得很有说服力”还差一层。后面你重点把取舍过程和量化结果讲清楚，整体表现会更稳。',
    ].join('\n');
  }

  if (input.context.turnType === 'main_question' && input.interviewStage === 'warmup') {
    return [
      '口吻示例（只学习表达方式，不要照抄具体内容）：',
      '示例 1｜收到简历后直接进入首题',
      '你好，我看过你的简历了，整体经历和技术覆盖面都比较完整。现在我们开始模拟面试吧。',
      '',
      '**第一个问题：** 你先做个简短自我介绍吧。',
      '',
      '（重点讲讲最近几段经历的主线、最能代表你的项目，以及你这次为什么看机会。）',
      '示例 2｜自然承接简历进入首题',
      '你的简历我先看过了，工程化和性能优化这块我已经有大致印象。我们直接开始。',
      '',
      '**第一个问题：** 请先做个自我介绍，并说说你为什么在看新的机会。',
    ].join('\n');
  }

  if (input.context.turnType === 'main_question' && input.interviewStage === 'project') {
    return [
      '口吻示例（只学习表达方式，不要照抄具体内容）：',
      '示例 1｜进入项目深挖',
      '前面的技术题先到这里，我们把视角拉到项目里。',
      '',
      '**第三个问题：** 请你挑一个最能代表你水平的项目，重点讲清楚背景、你负责的关键决策、以及最终结果怎么验证。',
      '示例 2｜项目题主问法',
      '下面我想具体听一个项目案例。',
      '',
      '**第三个问题：** 你就选一个自己最熟、也最能代表你的项目，把背景、挑战、方案和结果讲清楚。',
    ].join('\n');
  }

  if (input.context.turnType === 'main_question' && input.interviewStage === 'technical') {
    const technicalQuestionStyle = resolveTechnicalQuestionStyle(input.questionText);

    if (technicalQuestionStyle === 'scenario') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜点评后切到场景设计题',
        '**点评**：你刚才基础题的方向是对的，不过回答还可以再多一点落地细节。',
        '',
        '**第三个问题：** 我们切一道场景题。假设现在要做一个海量数据列表页，同时支持实时筛选和排序，你会怎么设计前端方案？',
        '示例 2｜自然过渡到设计题',
        '这个基础点我们先到这里，下面我想看一下你的方案拆解能力。',
        '',
        '**第三个问题：** 如果让你负责一个复杂列表页的交互和性能设计，你会从哪几层开始搭这套方案？',
      ].join('\n');
    }

    if (technicalQuestionStyle === 'engineering') {
      return [
        '口吻示例（只学习表达方式，不要照抄具体内容）：',
        '示例 1｜点评后进入工程实践题',
        '**点评**：你刚才的回答主线是清楚的，不过我想继续往工程实践里压一层。',
        '',
        '**第二个问题：** 讲讲你做构建优化或工具链升级时，最早是怎么判断瓶颈真的出在编译链路上的？',
        '示例 2｜自然切到工程题',
        '基础题先放一放，我们聊一点更贴近真实项目的。',
        '',
        '**第三个问题：** 如果让你推进一轮前端工程化升级，你会怎么判断应该先改工具链、目录结构，还是研发流程？',
      ].join('\n');
    }

    return [
      '口吻示例（只学习表达方式，不要照抄具体内容）：',
      '示例 1｜点评后进入原理机制题',
      '好，背景我先记住了。',
      '',
      '**第二个问题：** 你讲一下浏览器事件循环里宏任务和微任务的执行顺序。为什么会这样安排？',
      '示例 2｜自然抛出机制题',
      '我们直接看基础深度。',
      '',
      '**第三个问题：** 讲响应式系统或虚拟 DOM 这类机制题时，你一般先从哪几个关键环节展开？',
    ].join('\n');
  }

  return [
    '口吻示例（只学习表达方式，不要照抄具体内容）：',
    '示例 1｜点评后继续推进',
    '你这个回答的大方向没有问题，但信息密度还不够，面试里再往下走会显得有点虚。我们继续往深一点聊，下一步你会怎么拆解这个问题？',
    '示例 2｜点评后切到下一题',
    '这个案例能看出你做过实战，不过你刚才更强调结果，过程里的判断依据还可以补得更完整一些。第四个问题，请你按 STAR 结构再复盘一次这个项目里最难的一次性能优化。',
  ].join('\n');
}

function normalizeVisibleHistory(session: ChatSession): ChatTurn[] {
  return session.messages
    .filter((message) => message.role !== 'system' && message.kind !== 'system')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function formatAssistantPlanEntry(message: ChatMessage, index: number): string {
  const kindLabelMap: Record<ChatMessage['kind'], string> = {
    text: '普通回复',
    question: '主问题',
    follow_up: '追问',
    evaluation: '评价',
    feedback: '点评',
    report: '总结',
    system: '系统说明',
  };

  return [`片段 ${index + 1}（${kindLabelMap[message.kind]}）`, message.content.trim()].join('\n');
}

function extractQuestionOrdinalLabel(content: string): string | null {
  const matched = /第([^个\n]{1,8})个问题[：:]/.exec(content);
  return matched?.[1] ? `第${matched[1]}个问题` : null;
}

function resolveInterviewReplyContext(input: {
  session: ChatSession;
  assistantMessages: ChatMessage[];
}): InterviewReplyContext {
  const hasReport = input.assistantMessages.some((message) => message.kind === 'report');
  const hasFollowUp = input.assistantMessages.some((message) => message.kind === 'follow_up');
  const hasMainQuestion = input.assistantMessages.some((message) => message.kind === 'question');
  const hasFeedback = input.assistantMessages.some((message) => message.kind === 'feedback');

  const questionOrdinalLabel =
    [...input.assistantMessages]
      .reverse()
      .map((message) => extractQuestionOrdinalLabel(message.content))
      .find(Boolean) ??
    [...input.session.messages]
      .reverse()
      .map((message) =>
        message.role === 'assistant' ? extractQuestionOrdinalLabel(message.content) : null,
      )
      .find(Boolean) ??
    null;

  if (hasReport) {
    return { turnType: 'report', questionOrdinalLabel, hasFeedback };
  }

  if (hasFollowUp && !hasMainQuestion) {
    return { turnType: 'follow_up', questionOrdinalLabel, hasFeedback };
  }

  if (hasMainQuestion && !hasFollowUp) {
    return { turnType: 'main_question', questionOrdinalLabel, hasFeedback };
  }

  return { turnType: 'mixed', questionOrdinalLabel, hasFeedback };
}

export function buildDeterministicInterviewReplyDraft(assistantMessages: ChatMessage[]): string {
  return assistantMessages
    .filter((message) => message.kind !== 'system' && message.role !== 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export function buildInterviewReplyTurns(input: {
  session: ChatSession;
  userContent: string;
  assistantMessages: ChatMessage[];
  interviewStage: ChatSession['runtime']['currentStage'];
  currentFollowUpTrace?: InterviewFollowUpTrace | null;
}): ChatTurn[] {
  const history = normalizeVisibleHistory(input.session);
  const replyContext = resolveInterviewReplyContext(input);
  const stageLabel = formatInterviewStageLabel(input.interviewStage);
  const questionText = extractLatestQuestionText({
    session: input.session,
    assistantMessages: input.assistantMessages,
  });
  const reportStyle = resolveReportReplyStyle(input.session);
  const styleExamples = buildInterviewReplyStyleExamples({
    context: replyContext,
    interviewStage: input.interviewStage,
    followUpTrace: input.currentFollowUpTrace,
    questionText,
    reportStyle,
  });
  const planEntries = input.assistantMessages
    .map(formatAssistantPlanEntry)
    .filter(Boolean)
    .join('\n\n');
  const contextLines = [
    `当前回合类型：${
      replyContext.turnType === 'main_question'
        ? '进入下一道主问题'
        : replyContext.turnType === 'follow_up'
          ? '继续追问'
          : replyContext.turnType === 'report'
            ? '总结收口'
            : '点评后继续推进'
    }`,
    `当前面试阶段：${stageLabel}`,
    replyContext.questionOrdinalLabel
      ? `当前关联主问题编号：${replyContext.questionOrdinalLabel}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
  const replyShapeInstruction = buildReplyShapeInstruction(replyContext, input.interviewStage);

  return prependChatReplyFormattingInstruction([
    {
      role: 'system',
      content: INTERVIEW_REPLY_SYSTEM_PROMPT,
    },
    ...history,
    {
      role: 'user',
      content: input.userContent,
    },
    {
      role: 'system',
      content: [
        '以下是这一轮的内部回合计划，只供你参考，不要原样照抄，也不要向候选人暴露这些标签：',
        contextLines,
        replyShapeInstruction,
        planEntries,
        styleExamples,
        '请基于上面的计划，输出这一轮最终要对候选人说的一条自然回复。',
      ].join('\n\n'),
    },
  ]);
}

export function collapseInterviewAssistantMessages(input: {
  session: ChatSession;
  assistantMessages: ChatMessage[];
  content: string;
  completionStatus?: ChatMessageCompletionStatus;
}): { session: ChatSession; assistantMessage: ChatMessage | null } {
  const firstAssistantMessage = input.assistantMessages[0];
  if (!firstAssistantMessage) {
    return { session: input.session, assistantMessage: null };
  }

  const removableIds = new Set(input.assistantMessages.map((message) => message.id));
  const finalKind = input.assistantMessages.at(-1)?.kind ?? firstAssistantMessage.kind;
  const mergedAssistantMessage: ChatMessage = {
    ...firstAssistantMessage,
    kind: finalKind,
    content: input.content,
    completionStatus: input.completionStatus ?? 'completed',
  };

  let inserted = false;
  const mergedMessages = input.session.messages.flatMap((message) => {
    if (!removableIds.has(message.id)) {
      return [message];
    }

    if (inserted) {
      return [];
    }

    inserted = true;
    return [mergedAssistantMessage];
  });

  return {
    session: {
      ...input.session,
      messages: mergedMessages,
    },
    assistantMessage: mergedAssistantMessage,
  };
}
