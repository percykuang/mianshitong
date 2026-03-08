import type { InterviewTopic, ModelId } from '../types';

export const APP_NAME = '面试通';
export const APP_SLUG = 'mianshitong';

export const MODEL_OPTIONS: Array<{ id: ModelId; label: string }> = [
  { id: 'deepseek-chat', label: 'DeepSeek Chat' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
];

export const INTERVIEW_TOPICS: InterviewTopic[] = [
  'javascript',
  'react',
  'vue',
  'engineering',
  'performance',
  'network',
  'security',
  'node',
];

export const QUICK_PROMPTS = [
  '可以帮我优化简历吗？',
  '开始模拟面试，我是前端工程师 Vue 技术栈',
  '前端面试时，如何正确的自我介绍',
  '我是前端工程师，如何挖掘简历项目亮点',
] as const;
