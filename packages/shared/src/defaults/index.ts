import type { InterviewConfig } from '../types';

export const DEFAULT_INTERVIEW_CONFIG: InterviewConfig = {
  topics: ['javascript', 'react', 'engineering', 'performance', 'network'],
  level: 'mid',
  questionCount: 4,
  feedbackMode: 'end_summary',
};
