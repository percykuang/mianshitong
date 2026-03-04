import type { InterviewConfig } from './contracts';

export const APP_NAME = '面试通';
export const APP_SLUG = 'mianshitong';

export const DEFAULT_INTERVIEW_CONFIG: InterviewConfig = {
  topics: ['javascript', 'react', 'engineering', 'performance', 'network'],
  level: 'mid',
  questionCount: 4,
  feedbackMode: 'end_summary',
};

export const QUICK_PROMPTS = [
  '可以帮我优化简历吗？',
  '开始模拟面试，我是前端工程师 Vue 技术栈',
  '前端面试时，如何正确的自我介绍',
  '我是前端工程师，如何挖掘简历项目亮点',
] as const;
