import { DEFAULT_INTERVIEW_CONFIG, type InterviewQuestion } from '@mianshitong/shared';
import type { QuestionPlanningEvalCase } from './question-planning-evals';

const QUESTION_BANK: InterviewQuestion[] = [
  {
    id: 'react_hooks_junior',
    level: 'junior',
    title: 'React Hooks 基础',
    prompt: '请讲讲 useEffect 和 useState 的基本作用。',
    tags: ['React', 'JavaScript'],
    order: 1,
  },
  {
    id: 'react_component_design_mid',
    level: 'mid',
    title: '组件设计与复用',
    prompt: '如何设计一个可复用的 React 业务组件？',
    tags: ['React', 'Engineering'],
    order: 2,
  },
  {
    id: 'javascript_event_loop_mid',
    level: 'mid',
    title: '浏览器事件循环',
    prompt: '请解释宏任务和微任务的执行顺序。',
    tags: ['JavaScript', 'Browser'],
    order: 3,
  },
  {
    id: 'css_layout_junior',
    level: 'junior',
    title: '常见布局方案',
    prompt: 'flex 和 grid 在业务里怎么选？',
    tags: ['CSS'],
    order: 4,
  },
  {
    id: 'performance_render_senior',
    level: 'senior',
    title: '渲染性能优化',
    prompt: '如何分析并优化首屏渲染性能？',
    tags: ['Performance', 'React'],
    order: 5,
  },
  {
    id: 'engineering_monorepo_senior',
    level: 'senior',
    title: 'Monorepo 工程治理',
    prompt: '大型前端团队使用 Monorepo 的收益和代价是什么？',
    tags: ['Engineering', 'Performance'],
    order: 6,
  },
  {
    id: 'network_cache_mid',
    level: 'mid',
    title: '缓存策略设计',
    prompt: '浏览器缓存和 CDN 缓存如何协同？',
    tags: ['Network', 'Performance'],
    order: 7,
  },
  {
    id: 'react_architecture_senior',
    level: 'senior',
    title: 'React 架构拆分',
    prompt: '复杂后台系统如何做 React 状态与模块边界治理？',
    tags: ['React', 'Engineering'],
    order: 8,
  },
  {
    id: 'typescript_generics_mid',
    level: 'mid',
    title: 'TypeScript 泛型设计',
    prompt: '什么时候应该用泛型约束而不是 any？',
    tags: ['TypeScript', 'JavaScript'],
    order: 9,
  },
];

export const QUESTION_PLANNING_EVAL_CASES: QuestionPlanningEvalCase[] = [
  {
    id: 'junior-react-profile',
    description: 'React 初级候选人应以 React/JavaScript 为主，并以初中级题为主',
    sourceText: [
      '我是一名前端实习生，1 年 React 项目经验。',
      '平时主要写 React Hooks、组件封装，也会处理一些基础 JavaScript 逻辑。',
    ].join('\n'),
    config: {
      ...DEFAULT_INTERVIEW_CONFIG,
      level: 'mid',
      questionCount: 5,
    },
    questionBank: QUESTION_BANK,
    expectations: {
      questionCount: 5,
      requiredTags: ['react', 'javascript'],
      minLevelCounts: {
        junior: 1,
        mid: 2,
      },
      maxLevelCounts: {
        senior: 1,
      },
      mustIncludeQuestionIds: ['react_hooks_junior'],
      requirePlanningTrace: true,
    },
  },
  {
    id: 'senior-engineering-profile',
    description: '资深候选人应覆盖工程化/性能方向，并至少包含资深题',
    sourceText: [
      '我有 6 年前端经验，负责过 React 中后台和工程架构治理。',
      '做过 Monorepo、性能优化、构建链路升级，也带过团队做可维护性治理。',
    ].join('\n'),
    config: {
      ...DEFAULT_INTERVIEW_CONFIG,
      level: 'mid',
      questionCount: 5,
    },
    questionBank: QUESTION_BANK,
    expectations: {
      questionCount: 5,
      requiredTags: ['engineering', 'performance', 'react'],
      minLevelCounts: {
        senior: 2,
        mid: 1,
      },
      maxLevelCounts: {
        junior: 1,
      },
      mustIncludeQuestionIds: ['engineering_monorepo_senior'],
      requirePlanningTrace: true,
    },
  },
];
