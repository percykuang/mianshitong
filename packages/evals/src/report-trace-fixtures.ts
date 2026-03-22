import type { DimensionScores, QuestionAssessment } from '@mianshitong/shared';
import type { ReportTraceEvalCase } from './report-trace-evals';

function createScores(
  correctness: number,
  depth: number,
  communication: number,
  engineering: number,
  tradeoffs: number,
): DimensionScores {
  return {
    correctness,
    depth,
    communication,
    engineering,
    tradeoffs,
  };
}

function createAssessment(input: {
  questionId: string;
  questionTitle: string;
  summary: string;
  scores: DimensionScores;
  matchedPoints: string[];
  missingPoints: string[];
}): QuestionAssessment {
  return {
    questionId: input.questionId,
    questionTitle: input.questionTitle,
    topic: null,
    summary: input.summary,
    scores: input.scores,
    matchedPoints: input.matchedPoints,
    missingPoints: input.missingPoints,
  };
}

export const REPORT_TRACE_EVAL_CASES: ReportTraceEvalCase[] = [
  {
    id: 'needs-work-report',
    description: '基础薄弱场景应判定为 needs-work，并生成改进建议',
    assessments: [
      createAssessment({
        questionId: 'js_scope',
        questionTitle: 'JavaScript 作用域',
        summary: '基础概念不稳定。',
        scores: createScores(1, 1, 2, 1, 1),
        matchedPoints: ['变量提升'],
        missingPoints: ['闭包', 'this 绑定'],
      }),
      createAssessment({
        questionId: 'js_async',
        questionTitle: '异步任务调度',
        summary: '只能答出零散概念。',
        scores: createScores(2, 1, 2, 1, 1),
        matchedPoints: ['Promise'],
        missingPoints: ['事件循环', '微任务'],
      }),
    ],
    expectations: {
      level: 'needs-work',
      maxOverallScore: 2.4,
      requiredStrengths: ['变量提升', 'Promise'],
      requiredGaps: ['闭包', '事件循环'],
      nextStepCount: 3,
      requireDimensionTrace: true,
    },
  },
  {
    id: 'solid-report',
    description: '中等发挥场景应判定为 solid，且优势与短板来源都可追溯',
    assessments: [
      createAssessment({
        questionId: 'react_state',
        questionTitle: 'React 状态设计',
        summary: '回答基本完整。',
        scores: createScores(4, 4, 4, 3, 3),
        matchedPoints: ['状态管理', '组件拆分'],
        missingPoints: ['监控'],
      }),
      createAssessment({
        questionId: 'react_perf',
        questionTitle: 'React 性能优化',
        summary: '思路较清晰，但工程细节略少。',
        scores: createScores(4, 4, 4, 4, 3),
        matchedPoints: ['状态管理', '性能分析'],
        missingPoints: ['边界场景'],
      }),
    ],
    expectations: {
      level: 'solid',
      minOverallScore: 2.5,
      maxOverallScore: 4.2,
      requiredStrengths: ['状态管理', '组件拆分'],
      requiredGaps: ['监控', '边界场景'],
      nextStepCount: 2,
      requireDimensionTrace: true,
    },
  },
  {
    id: 'strong-report',
    description: '高质量发挥场景应判定为 strong，且不再生成改进建议',
    assessments: [
      createAssessment({
        questionId: 'arch_boundary',
        questionTitle: '前端架构边界治理',
        summary: '回答全面且有取舍。',
        scores: createScores(5, 5, 5, 4, 4),
        matchedPoints: ['架构边界', '模块拆分', '权衡'],
        missingPoints: [],
      }),
      createAssessment({
        questionId: 'eng_ops',
        questionTitle: '工程化发布治理',
        summary: '工程细节扎实。',
        scores: createScores(5, 4, 5, 5, 5),
        matchedPoints: ['架构边界', '监控回滚', '权衡'],
        missingPoints: [],
      }),
    ],
    expectations: {
      level: 'strong',
      minOverallScore: 4.3,
      requiredStrengths: ['架构边界', '权衡'],
      nextStepCount: 0,
      requireNoNextSteps: true,
      requireDimensionTrace: true,
    },
  },
];
