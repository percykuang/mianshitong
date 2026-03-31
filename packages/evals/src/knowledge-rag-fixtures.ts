import type { KnowledgeDocumentCategory, KnowledgeDocumentSource } from '@mianshitong/retrieval';

export interface KnowledgeRetrievalEvalExpectations {
  expectedMode?: 'strong' | 'weak' | 'none';
  expectedTopDocumentTitle?: string;
  expectedTopHeadingIncludes?: string;
  requiredDocumentTitlesInTopK?: string[];
  excludedDocumentTitlesInTopK?: string[];
  minTopScore?: number;
  maxTopScore?: number;
  minResultCount?: number;
  expectedResultCount?: number;
}

export interface KnowledgeRetrievalEvalCase {
  id: string;
  description: string;
  documents: KnowledgeDocumentSource[];
  query: {
    text: string;
    categories?: KnowledgeDocumentCategory[];
    preferredTags?: string[];
    limit?: number;
  };
  expectations: KnowledgeRetrievalEvalExpectations;
}

export interface KnowledgeAnswerEvalExpectations {
  requiredPhrases?: string[];
  forbiddenPhrases?: string[];
  minCoveredPhraseCount?: number;
  minKnowledgeCoverageGain?: number;
  requireDifferentFromBaseline?: boolean;
}

export interface KnowledgeAnswerEvalCase {
  id: string;
  description: string;
  question: string;
  answer: string;
  baselineAnswer?: string;
  expectations: KnowledgeAnswerEvalExpectations;
}

const KNOWLEDGE_EVAL_DOCUMENTS: KnowledgeDocumentSource[] = [
  {
    documentId: 'doc_react_performance',
    title: 'React 性能优化面试手册',
    category: 'tech_knowledge',
    contentShape: 'reference',
    summary: '用于回答 React 性能优化、useMemo 和 useCallback 等技术问答。',
    tags: ['react', 'performance', 'useMemo', 'useCallback', 'frontend'],
    content: [
      '# React 性能优化',
      '## 核心原则',
      '先定位，再优化，避免为了优化而优化。',
      '',
      '## 常见手段',
      'React.memo 用于减少不必要的子组件重渲染。',
      '长列表优先考虑虚拟列表。',
      '只有在稳定引用确实能减少渲染成本时，再考虑 useMemo 和 useCallback。',
      '',
      '## 面试回答建议',
      '回答时先给结论，再讲适用场景、收益、代价和常见误区。',
      '当问题没有明显性能瓶颈时，不要滥用缓存型优化。',
    ].join('\n'),
  },
  {
    documentId: 'doc_self_intro',
    title: '前端自我介绍面试打法',
    category: 'interview_playbook',
    contentShape: 'process',
    summary: '用于规范前端候选人的自我介绍结构与表达重点。',
    tags: ['自我介绍', '面试', 'frontend', 'communication'],
    content: [
      '# 自我介绍结构',
      '## 三段式结构',
      '第一段先给求职方向、年限和当前定位。',
      '第二段讲当前最能代表能力的技术栈和项目范围。',
      '第三段收口到与目标岗位最相关的亮点与价值。',
      '',
      '## 常见误区',
      '不要从校园经历或与岗位弱相关的经历讲太久。',
      '不要把自我介绍说成流水账。',
    ].join('\n'),
  },
  {
    documentId: 'doc_project_resume',
    title: '项目亮点提炼模板',
    category: 'project_resume',
    contentShape: 'template',
    summary: '用于帮助提炼项目背景、动作、结果和指标。',
    tags: ['项目', '简历', '亮点', 'STAR'],
    content: [
      '# 项目亮点提炼',
      '## 基本框架',
      '先交代项目背景和业务目标，再说明自己负责的关键动作。',
      '最后补结果和指标，用数据体现影响。',
      '',
      '## 表达建议',
      '优先强调复杂性、取舍和结果。',
      '避免只堆技术名词，不解释业务价值。',
    ].join('\n'),
  },
];

export const KNOWLEDGE_RETRIEVAL_EVAL_CASES: KnowledgeRetrievalEvalCase[] = [
  {
    id: 'retrieval_react_performance_hits_tech_doc_first',
    description: '技术问答应优先命中 React 性能优化知识文档',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: 'React 性能优化在面试里应该怎么回答？什么时候不该滥用 useMemo 和 useCallback？',
      categories: ['tech_knowledge', 'interview_playbook'],
      preferredTags: ['react', 'performance', 'useMemo', 'useCallback', '前端'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'strong',
      expectedTopDocumentTitle: 'React 性能优化面试手册',
      requiredDocumentTitlesInTopK: ['React 性能优化面试手册'],
      excludedDocumentTitlesInTopK: ['项目亮点提炼模板'],
      minTopScore: 6,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_react_performance_noisy_long_query_should_still_hit_tech_doc',
    description: '带上下文噪声的长技术问法仍应优先命中 React 性能优化知识文档',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: [
        '我最近在准备前端面试，发现一被问到性能优化就容易讲散。',
        '如果面试官问 React 性能优化，我到底应该先讲排查思路，还是直接讲 memo、虚拟列表、useMemo 这些手段？',
        '另外我也担心自己把 useCallback 和 useMemo 说成“反正都能提性能”这种过度结论。',
      ].join(''),
      categories: ['tech_knowledge', 'interview_playbook'],
      preferredTags: ['react', 'performance', 'useMemo', 'useCallback', '前端'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'strong',
      expectedTopDocumentTitle: 'React 性能优化面试手册',
      requiredDocumentTitlesInTopK: ['React 性能优化面试手册'],
      minTopScore: 5,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_project_highlight_hits_resume_doc',
    description: '项目亮点类问题应优先命中 project resume 文档',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: '面试里讲项目亮点时，怎么把业务背景、我的动作和最终结果说清楚？',
      categories: ['project_resume', 'interview_playbook'],
      preferredTags: ['项目', '亮点', '简历', 'STAR'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'strong',
      expectedTopDocumentTitle: '项目亮点提炼模板',
      requiredDocumentTitlesInTopK: ['项目亮点提炼模板'],
      excludedDocumentTitlesInTopK: ['React 性能优化面试手册'],
      minTopScore: 5,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_resume_optimize_hits_resume_doc',
    description: '简历优化类问题应优先命中 project resume 文档',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: '简历里的项目经历怎么写，才能让面试官更快看到业务价值和结果？',
      categories: ['project_resume', 'interview_playbook'],
      preferredTags: ['简历', '项目', '业务价值', '结果'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'strong',
      expectedTopDocumentTitle: '项目亮点提炼模板',
      requiredDocumentTitlesInTopK: ['项目亮点提炼模板'],
      minTopScore: 5,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_resume_optimize_noisy_long_query_should_still_hit_resume_doc',
    description: '带背景噪声的简历优化长问法仍应优先命中 project resume 文档',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: [
        '我最近在改简历，问题不是完全没项目，而是写出来总像在记工作流水账。',
        '比如我会写“负责某中后台重构、接入监控、推动性能优化”，但面试官看完可能还是不知道这些事到底有什么业务价值。',
        '这种项目经历应该怎么写，才能让人快速看出背景、我的动作和最后的结果？',
      ].join(''),
      categories: ['project_resume', 'interview_playbook'],
      preferredTags: ['简历', '项目', '业务价值', '结果'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'strong',
      expectedTopDocumentTitle: '项目亮点提炼模板',
      requiredDocumentTitlesInTopK: ['项目亮点提炼模板'],
      minTopScore: 5,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_self_intro_hits_playbook',
    description: '自我介绍类问题应优先命中 interview playbook',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: '前端面试里的自我介绍应该怎么组织，才能更贴近岗位需求？',
      categories: ['interview_playbook', 'project_resume'],
      preferredTags: ['自我介绍', '面试', 'frontend'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'strong',
      expectedTopDocumentTitle: '前端自我介绍面试打法',
      expectedTopHeadingIncludes: '三段式结构',
      requiredDocumentTitlesInTopK: ['前端自我介绍面试打法'],
      minTopScore: 4,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_self_intro_noisy_long_query_should_still_hit_playbook',
    description: '带目标岗位和个人顾虑的长开场问法仍应命中自我介绍 playbook',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: [
        '我现在面的是偏高级一点的前端岗位。',
        '每次一开场让我做自我介绍，我不是讲得太散，就是讲成项目流水账，最后反而没把和岗位最相关的东西讲出来。',
        '如果只有 1 分钟左右，应该怎么组织开场会更自然一点？',
      ].join(''),
      categories: ['interview_playbook', 'project_resume'],
      preferredTags: ['面试', '自我介绍', 'frontend'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'strong',
      expectedTopDocumentTitle: '前端自我介绍面试打法',
      requiredDocumentTitlesInTopK: ['前端自我介绍面试打法'],
      minTopScore: 4,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_self_intro_paraphrase_should_still_hit_playbook',
    description: '开场式意译问法在自我介绍意图下仍应命中 interview playbook',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: '前端面试开场 1 分钟，怎么把自己讲清楚会更自然？',
      categories: ['interview_playbook', 'project_resume'],
      preferredTags: ['面试', '自我介绍', 'frontend'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'strong',
      expectedTopDocumentTitle: '前端自我介绍面试打法',
      requiredDocumentTitlesInTopK: ['前端自我介绍面试打法'],
      minTopScore: 4,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_generic_expression_advice_should_be_weak',
    description: '表达类泛问题在只有部分标签和词法命中时应判为 weak',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: '前端候选人怎么开场会更自然一点？',
      categories: ['interview_playbook', 'project_resume'],
      preferredTags: ['frontend'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'weak',
      expectedTopDocumentTitle: '前端自我介绍面试打法',
      minTopScore: 2.2,
      maxTopScore: 4.59,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_resume_business_impact_paraphrase_should_be_weak',
    description: '语义相关但不直接复用文档关键词的项目表述问题，当前词法检索应落在 weak',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: '简历里怎么把自己做过的事写得不那么像记流水账？',
      categories: ['project_resume', 'interview_playbook'],
      preferredTags: ['简历'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'weak',
      expectedTopDocumentTitle: '项目亮点提炼模板',
      minTopScore: 2.2,
      maxTopScore: 4.59,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_self_intro_avoid_scattered_opening_should_be_weak',
    description: '更口语化的面试开场表达问题，当前词法检索应先稳定命中 weak',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: '面试开头怎么说会更顺一点？',
      categories: ['interview_playbook', 'project_resume'],
      preferredTags: ['面试'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'weak',
      expectedTopDocumentTitle: '前端自我介绍面试打法',
      minTopScore: 2.2,
      maxTopScore: 4.59,
      minResultCount: 2,
    },
  },
  {
    id: 'retrieval_unrelated_query_should_be_none',
    description: '无关问题不应被误判为知识命中',
    documents: KNOWLEDGE_EVAL_DOCUMENTS,
    query: {
      text: 'Kubernetes 集群网络策略一般怎么设计？',
      categories: ['tech_knowledge', 'interview_playbook'],
      preferredTags: ['kubernetes', 'network', 'infra'],
      limit: 4,
    },
    expectations: {
      expectedMode: 'none',
      maxTopScore: 2.19,
      expectedResultCount: 4,
    },
  },
];

export const KNOWLEDGE_ANSWER_EVAL_CASES: KnowledgeAnswerEvalCase[] = [
  {
    id: 'answer_with_knowledge_should_cover_react_performance_facts',
    description: '知识增强后的技术回答应覆盖关键事实，并优于无知识基线',
    question: 'React 性能优化在面试里应该怎么回答？',
    answer: [
      '可以先给结论：React 性能优化不是上来就加缓存，而是先定位瓶颈，再判断要不要优化。',
      '如果是子组件重复渲染，可以先看 React.memo 是否能减少不必要的更新；如果是长列表，就优先考虑虚拟列表。',
      'useMemo 和 useCallback 只有在稳定引用确实能降低渲染成本时才值得用，没有明显瓶颈时不要滥用。',
      '面试里最好再补收益、代价和常见误区，而不是只报 API 名字。',
    ].join(''),
    baselineAnswer: [
      'React 性能优化可以从组件拆分、缓存和减少渲染次数几个方向回答。',
      '常见做法包括 memo、useMemo、useCallback 等。',
    ].join(''),
    expectations: {
      requiredPhrases: ['先定位瓶颈，再判断要不要优化', 'React.memo', '虚拟列表', '不要滥用'],
      forbiddenPhrases: ['useMemo 一定能提升性能', '所有组件都应该加 memo'],
      minCoveredPhraseCount: 4,
      minKnowledgeCoverageGain: 2,
      requireDifferentFromBaseline: true,
    },
  },
  {
    id: 'answer_with_knowledge_should_handle_noisy_react_performance_query',
    description: '面对带噪声的长技术问题，回答仍应收口到排查思路、手段和误区',
    question:
      '如果面试官问 React 性能优化，我到底应该先讲排查思路，还是直接讲 memo、虚拟列表、useMemo 这些手段？',
    answer: [
      '更稳的讲法是先给排查思路，再补优化手段。',
      '可以先说性能优化不是一上来堆缓存，而是先定位瓶颈；然后再根据场景讲 React.memo、虚拟列表，以及 useMemo 和 useCallback 这类手段。',
      '最后补一句边界：只有在稳定引用确实能降低渲染成本时才值得用这些缓存型优化，不要把它们讲成“默认都该加”的通用答案。',
    ].join(''),
    baselineAnswer:
      'React 性能优化可以从很多方面回答，比如缓存、组件拆分和长列表优化，核心是多总结几个常见手段。',
    expectations: {
      requiredPhrases: ['先定位瓶颈', 'React.memo', '虚拟列表', '稳定引用', '不要'],
      forbiddenPhrases: ['所有场景都应该默认加上 useMemo 和 useCallback'],
      minCoveredPhraseCount: 5,
      minKnowledgeCoverageGain: 4,
      requireDifferentFromBaseline: true,
    },
  },
  {
    id: 'answer_with_knowledge_should_extract_project_highlight_structure',
    description: '知识增强后的项目亮点回答应覆盖背景、动作、结果和业务价值',
    question: '项目亮点在面试里怎么讲才更有说服力？',
    answer: [
      '讲项目亮点时，最好先交代项目背景和业务目标，',
      '再说清楚你负责的关键动作和取舍，',
      '最后补结果和指标，用数据体现影响。',
      '如果只堆技术名词、不解释业务价值，面试官通常很难判断你的真实贡献。',
    ].join(''),
    baselineAnswer: '项目亮点要突出你做了什么，以及最终取得了什么效果。',
    expectations: {
      requiredPhrases: ['项目背景', '业务目标', '关键动作', '结果和指标', '业务价值'],
      forbiddenPhrases: ['只要多说技术细节就够了'],
      minCoveredPhraseCount: 5,
      minKnowledgeCoverageGain: 4,
      requireDifferentFromBaseline: true,
    },
  },
  {
    id: 'answer_with_knowledge_should_improve_resume_project_bullets',
    description: '知识增强后的简历优化回答应覆盖项目经历的背景、动作、结果与量化表达',
    question: '简历里的项目经历怎么写更有说服力？',
    answer: [
      '写项目经历时，不要只列技术栈，最好先交代项目背景和业务目标，',
      '再写你负责的关键动作，最后补结果和指标，用量化信息体现影响。',
      '如果只有“参与了某某项目”这类描述，面试官通常看不出你的真实贡献和业务价值。',
    ].join(''),
    baselineAnswer: '项目经历要尽量写清楚你做了什么，以及项目效果。',
    expectations: {
      requiredPhrases: ['项目背景', '业务目标', '关键动作', '结果和指标', '量化', '业务价值'],
      forbiddenPhrases: ['只写技术栈就够了'],
      minCoveredPhraseCount: 6,
      minKnowledgeCoverageGain: 5,
      requireDifferentFromBaseline: true,
    },
  },
  {
    id: 'answer_with_knowledge_should_handle_noisy_resume_project_query',
    description: '面对带噪声的简历项目经历问题，回答仍应收口到背景、动作、结果和价值',
    question: '这种项目经历应该怎么写，才能让人快速看出背景、我的动作和最后的结果？',
    answer: [
      '可以按“背景和业务目标 -> 关键动作 -> 结果和指标”的顺序写。',
      '不要只写做了哪些功能，而是要让人看出你解决了什么问题、做了哪些关键动作，以及最终带来了什么业务价值。',
      '如果能补量化结果，面试官会更容易判断你的真实贡献。',
    ].join(''),
    baselineAnswer: '项目经历要写清楚你做了什么、结果怎么样，尽量简洁。',
    expectations: {
      requiredPhrases: ['背景和业务目标', '关键动作', '结果和指标', '业务价值', '量化结果'],
      forbiddenPhrases: ['只写功能列表'],
      minCoveredPhraseCount: 5,
      minKnowledgeCoverageGain: 4,
      requireDifferentFromBaseline: true,
    },
  },
  {
    id: 'answer_with_knowledge_should_follow_self_intro_structure',
    description: '知识增强后的自我介绍回答应体现三段式结构和岗位匹配',
    question: '前端面试里的自我介绍怎么说更好？',
    answer: [
      '可以按三段式来讲：先交代求职方向、年限和当前定位，',
      '再讲最能代表能力的技术栈和项目范围，',
      '最后收口到和目标岗位最相关的亮点与价值，避免讲成流水账。',
    ].join(''),
    baselineAnswer: '自我介绍时尽量简洁一些，突出个人优势和项目经验。',
    expectations: {
      requiredPhrases: ['三段式', '求职方向', '技术栈', '目标岗位最相关的亮点'],
      forbiddenPhrases: ['从小热爱编程'],
      minCoveredPhraseCount: 4,
      minKnowledgeCoverageGain: 3,
      requireDifferentFromBaseline: true,
    },
  },
  {
    id: 'answer_with_knowledge_should_help_opening_self_intro_paraphrase',
    description: '开场式意译问法的回答也应落回自我介绍三段式结构',
    question: '前端面试开场 1 分钟，怎么把自己讲清楚？',
    answer: [
      '可以按三段式来开场：先说求职方向、年限和当前定位，',
      '再讲最能代表能力的技术栈和项目范围，',
      '最后收口到与目标岗位最相关的亮点和价值，整体会更自然，也不容易讲成流水账。',
    ].join(''),
    baselineAnswer: '开场时尽量简洁一点，突出优势就可以。',
    expectations: {
      requiredPhrases: ['三段式', '求职方向', '技术栈', '目标岗位最相关的亮点', '流水账'],
      forbiddenPhrases: ['想到什么说什么'],
      minCoveredPhraseCount: 5,
      minKnowledgeCoverageGain: 5,
      requireDifferentFromBaseline: true,
    },
  },
  {
    id: 'answer_with_knowledge_should_handle_noisy_self_intro_query',
    description: '面对带岗位背景和顾虑的长开场问题，回答仍应回到三段式和岗位匹配',
    question: '如果只有 1 分钟左右，应该怎么组织开场会更自然一点？',
    answer: [
      '可以按三段式来讲，而且每一段都围绕目标岗位收口。',
      '第一段先说求职方向、年限和当前定位，第二段讲最能代表能力的技术栈和项目范围，第三段再收口到和目标岗位最相关的亮点与价值。',
      '这样既不会东一句西一句，也不容易讲成流水账。',
    ].join(''),
    baselineAnswer: '1 分钟开场尽量简洁一点，把自己的优势说出来就行。',
    expectations: {
      requiredPhrases: ['三段式', '求职方向', '技术栈', '目标岗位最相关的亮点', '流水账'],
      forbiddenPhrases: ['随便想到什么就说什么'],
      minCoveredPhraseCount: 5,
      minKnowledgeCoverageGain: 4,
      requireDifferentFromBaseline: true,
    },
  },
];
