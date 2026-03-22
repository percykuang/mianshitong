import { describe, expect, it } from 'vitest';
import type { InterviewQuestion } from '@mianshitong/shared';
import { DEFAULT_INTERVIEW_CONFIG } from '@mianshitong/shared';
import { planInterviewFromSource } from './interview-planning';

const questionBank: InterviewQuestion[] = [
  {
    id: 'engineering_typescript_mid',
    level: 'mid',
    title: 'Monorepo 与 TypeScript 工程治理',
    prompt: '请说明 Monorepo、类型检查和 CI 质量门禁如何协同设计。',
    tags: ['engineering', 'typescript', 'frontend'],
    order: 1,
  },
  {
    id: 'react_mid',
    level: 'mid',
    title: 'React 渲染链路优化',
    prompt: '请说明组件重渲染定位与优化方法。',
    tags: ['react', 'performance', 'frontend'],
    order: 2,
  },
  {
    id: 'engineering_typescript_junior',
    level: 'junior',
    title: '基础工程规范与类型约束',
    prompt: '请说明 lint、typecheck 和基础工程约束的意义。',
    tags: ['engineering', 'typescript', 'frontend'],
    order: 3,
  },
  {
    id: 'react_senior',
    level: 'senior',
    title: '复杂 React 应用架构设计',
    prompt: '请说明复杂中后台系统的 React 模块边界与状态治理。',
    tags: ['react', 'engineering', 'frontend'],
    order: 4,
  },
  {
    id: 'javascript_mid',
    level: 'mid',
    title: 'JavaScript 事件循环',
    prompt: '请解释宏任务、微任务与事件循环。',
    tags: ['javascript', 'browser', 'frontend'],
    order: 5,
  },
];

describe('interview planning', () => {
  it('在四题场景下会覆盖前三个核心标签', async () => {
    const result = await planInterviewFromSource({
      sourceText:
        '开始模拟面试，我有 4 年前端经验，主要做 React、TypeScript 和工程化，负责组件库、构建优化和 Monorepo 流水线。',
      config: {
        ...DEFAULT_INTERVIEW_CONFIG,
        level: 'mid',
        topics: ['react', 'javascript', 'engineering'],
        questionCount: 4,
      },
      questionBank,
    });

    expect(result.interviewBlueprint.mustIncludeTags).toEqual([
      'engineering',
      'typescript',
      'react',
    ]);

    const normalizedTags = new Set(
      result.questionPlan.flatMap((question) =>
        question.tags.map((tag) =>
          tag
            .trim()
            .toLowerCase()
            .replace(/[\s._/-]+/g, ''),
        ),
      ),
    );

    expect(normalizedTags.has('engineering')).toBe(true);
    expect(normalizedTags.has('typescript')).toBe(true);
    expect(normalizedTags.has('react')).toBe(true);
  });
});
