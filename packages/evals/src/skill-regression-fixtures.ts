import type {
  AssessmentSkillInput,
  AssessmentInference,
  ReportInference,
  ReportSkillInput,
  ResumeProfileInference,
  ResumeProfileSkillInput,
} from '@mianshitong/agent-skills';
import type { InterviewConfig, InterviewLevel, QuestionAssessment } from '@mianshitong/shared';

export interface ResumeProfileEvalExpectations {
  seniority: InterviewLevel;
  primaryTags: string[];
  secondaryTags?: string[];
  projectTags?: string[];
  minConfidence?: number;
  requiredStrengths?: string[];
  requiredEvidence?: string[];
  requireRiskFlags?: boolean;
}

export interface ResumeProfileEvalCase {
  id: string;
  description: string;
  input: ResumeProfileSkillInput;
  inference: ResumeProfileInference | null;
  expectations: ResumeProfileEvalExpectations;
}

export interface AssessmentSkillEvalExpectations {
  matchedPoints?: string[];
  missingPoints?: string[];
  minAverageScore?: number;
  expectedSummaryIncludes?: string[];
  minScores?: Partial<Record<keyof QuestionAssessment['scores'], number>>;
}

export interface AssessmentSkillEvalCase {
  id: string;
  description: string;
  input: AssessmentSkillInput;
  inference: AssessmentInference | null | 'throw';
  expectations: AssessmentSkillEvalExpectations;
}

export interface ReportSkillEvalExpectations {
  level: 'needs-work' | 'solid' | 'strong';
  minOverallScore: number;
  requiredStrengths?: string[];
  requiredGaps?: string[];
  expectedSummaryIncludes?: string[];
  expectedNextStepIncludes?: string[];
}

export interface ReportSkillEvalCase {
  id: string;
  description: string;
  input: ReportSkillInput;
  inference: ReportInference | null | 'throw';
  expectations: ReportSkillEvalExpectations;
}

const baseConfig: InterviewConfig = {
  topics: ['javascript', 'react'],
  level: 'mid',
  questionCount: 4,
  feedbackMode: 'end_summary',
};

export const RESUME_PROFILE_EVAL_CASES: ResumeProfileEvalCase[] = [
  {
    id: 'resume_profile_inference_normalizes_tags',
    description: '画像 Skill 应把 LLM 返回的中文别名标签归一为 canonical tags',
    input: {
      sourceText: '6 年前端经验，长期负责 React 性能优化、TypeScript 工程化治理与 Node BFF。',
      config: baseConfig,
    },
    inference: {
      targetRole: 'frontend-architect',
      seniority: 'senior',
      yearsOfExperience: 6,
      primaryTags: [
        { tag: 'React', weight: 0.96 },
        { tag: '工程化', weight: 0.9 },
      ],
      secondaryTags: [{ tag: 'TypeScript', weight: 0.74 }],
      projectTags: ['React', '工程化', 'TypeScript'],
      strengths: ['主导复杂前端架构与工程治理'],
      evidence: ['长期负责 React 性能优化与工程体系建设'],
      confidence: 0.93,
    },
    expectations: {
      seniority: 'senior',
      primaryTags: ['react', 'engineering'],
      secondaryTags: ['typescript'],
      projectTags: ['react', 'engineering', 'typescript'],
      minConfidence: 0.9,
      requiredStrengths: ['主导复杂前端架构与工程治理'],
      requiredEvidence: ['长期负责 React 性能优化与工程体系建设'],
    },
  },
  {
    id: 'resume_profile_fallback_keeps_risk_signal',
    description: '画像 Skill 在无有效推断时应回退规则版并保留低信息风险提示',
    input: {
      sourceText: '做过一些前端项目。',
      config: baseConfig,
    },
    inference: null,
    expectations: {
      seniority: 'mid',
      primaryTags: ['javascript', 'react'],
      minConfidence: 0.4,
      requireRiskFlags: true,
    },
  },
];

export const ASSESSMENT_SKILL_EVAL_CASES: AssessmentSkillEvalCase[] = [
  {
    id: 'assessment_inference_overrides_narrative_and_scores',
    description: '评分 Skill 应优先使用结构化推断结果，并保持 trace 与 assessment 对齐',
    input: {
      question: {
        id: 'react_render',
        level: 'mid',
        title: 'React 渲染机制',
        prompt: 'React 为什么会重复渲染？',
        keyPoints: ['state', 'props', 'memo'],
        followUps: ['你会如何排查无效重渲染？'],
        tags: ['react', 'performance'],
      },
      answer: '组件会因为 state 和 props 变化触发渲染，可以配合 memo 降低不必要的重渲染。',
      createdAt: '2026-03-22T12:00:00.000Z',
    },
    inference: {
      scores: {
        correctness: 5,
        depth: 4,
        communication: 4,
        engineering: 4,
        tradeoffs: 3,
      },
      matchedPoints: ['state', 'memo'],
      missingPoints: ['props'],
      summary: '回答正确且表达清晰，但可以再补充 props 变化的影响。',
    },
    expectations: {
      matchedPoints: ['state', 'memo'],
      missingPoints: ['props'],
      minAverageScore: 4,
      expectedSummaryIncludes: ['props 变化的影响'],
      minScores: {
        correctness: 5,
        engineering: 4,
      },
    },
  },
  {
    id: 'assessment_fallback_handles_questions_without_key_points',
    description: '评分 Skill 在题目无 keyPoints 且模型不可用时，fallback 不应系统性低分',
    input: {
      question: {
        id: 'incident_review',
        level: 'senior',
        title: '线上事故复盘',
        prompt: '如果线上出现高频白屏，你会如何定位与止损？',
        keyPoints: [],
        followUps: [],
        tags: ['engineering', 'performance'],
      },
      answer:
        '我会先止损并确认影响范围，再结合监控、日志、性能面板和发布记录定位触发源，同时权衡回滚、热修复和灰度发布的成本与风险。',
      createdAt: '2026-03-22T12:10:00.000Z',
    },
    inference: 'throw',
    expectations: {
      matchedPoints: [],
      minAverageScore: 3,
      minScores: {
        engineering: 3,
        tradeoffs: 3,
      },
    },
  },
];

const reportAssessments: QuestionAssessment[] = [
  {
    questionId: 'q1',
    questionTitle: '事件循环',
    topic: 'javascript',
    summary: '回答较完整。',
    matchedPoints: ['Promise', '微任务'],
    missingPoints: ['宏任务'],
    scores: {
      correctness: 4,
      depth: 4,
      communication: 4,
      engineering: 3,
      tradeoffs: 3,
    },
  },
  {
    questionId: 'q2',
    questionTitle: 'React 渲染',
    topic: 'react',
    summary: '回答扎实。',
    matchedPoints: ['memo', 'props'],
    missingPoints: ['边界场景'],
    scores: {
      correctness: 5,
      depth: 4,
      communication: 4,
      engineering: 4,
      tradeoffs: 4,
    },
  },
];

export const REPORT_SKILL_EVAL_CASES: ReportSkillEvalCase[] = [
  {
    id: 'report_inference_preserves_numeric_trace_and_updates_narrative',
    description: '报告 Skill 应保持数值稳定，只让叙述层由结构化推断覆盖',
    input: {
      assessments: reportAssessments,
      createdAt: '2026-03-22T12:30:00.000Z',
    },
    inference: {
      overallSummary: '整体基础不错，但事件循环边界和复杂场景表达还可以更完整。',
      strengths: ['memo'],
      gaps: ['宏任务'],
      nextSteps: [
        {
          gap: '宏任务',
          action: '补一页事件循环复盘，重点梳理宏任务、微任务和渲染时机之间的关系。',
        },
      ],
    },
    expectations: {
      level: 'solid',
      minOverallScore: 3.9,
      requiredStrengths: ['memo'],
      requiredGaps: ['宏任务'],
      expectedSummaryIncludes: ['事件循环边界'],
      expectedNextStepIncludes: ['宏任务、微任务'],
    },
  },
  {
    id: 'report_fallback_stays_stable_when_inference_fails',
    description: '报告 Skill 在推断失败时应回退规则版模板',
    input: {
      assessments: reportAssessments,
      createdAt: '2026-03-22T12:30:00.000Z',
    },
    inference: 'throw',
    expectations: {
      level: 'solid',
      minOverallScore: 3.9,
      requiredStrengths: ['Promise', 'memo'],
      requiredGaps: ['宏任务', '边界场景'],
      expectedSummaryIncludes: ['基础能力不错'],
      expectedNextStepIncludes: ['整理一页复盘笔记'],
    },
  },
];
