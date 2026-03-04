export const MODEL_OPTIONS = [
  {
    id: 'deepseek-chat',
    label: 'DeepSeek Chat',
    description: '通用对话模型，适合常规面试练习与简历优化。',
  },
  {
    id: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner',
    description: '更偏推理与结构化分析，适合深挖追问与复盘。',
  },
] as const;

export type ModelId = (typeof MODEL_OPTIONS)[number]['id'];

export const INTERVIEW_TOPICS = [
  'frontend',
  'javascript',
  'react',
  'vue',
  'engineering',
  'performance',
  'network',
  'security',
  'node',
] as const;

export type InterviewTopic = (typeof INTERVIEW_TOPICS)[number];

export type InterviewLevel = 'junior' | 'mid' | 'senior';
export type FeedbackMode = 'per_question' | 'end_summary';
export type SessionStatus = 'idle' | 'interviewing' | 'completed';

export type MessageRole = 'assistant' | 'user' | 'system';
export type MessageKind = 'text' | 'question' | 'feedback' | 'report' | 'system';

export interface DimensionScores {
  correctness: number;
  depth: number;
  communication: number;
  engineering: number;
  tradeoffs: number;
}

export interface InterviewQuestion {
  id: string;
  topic: InterviewTopic;
  level: InterviewLevel;
  title: string;
  prompt: string;
  keyPoints: string[];
  followUps: string[];
}

export interface QuestionAssessment {
  questionId: string;
  questionTitle: string;
  topic: InterviewTopic;
  answer: string;
  matchedPoints: string[];
  missingPoints: string[];
  scores: DimensionScores;
  feedback: string;
}

export interface InterviewReport {
  overallScore: number;
  level: 'needs-work' | 'solid' | 'strong';
  summary: string;
  strengths: string[];
  gaps: string[];
  nextSteps: string[];
  dimensionSummary: DimensionScores;
  breakdown: QuestionAssessment[];
}

export interface InterviewConfig {
  topics: InterviewTopic[];
  level: InterviewLevel;
  questionCount: number;
  feedbackMode: FeedbackMode;
}

export interface InterviewRuntimeState {
  questionPlan: InterviewQuestion[];
  currentQuestionIndex: number;
  followUpRound: number;
  activeQuestionAnswers: string[];
  assessments: QuestionAssessment[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  modelId: ModelId;
  isPrivate: boolean;
  status: SessionStatus;
  config: InterviewConfig;
  messages: ChatMessage[];
  report: InterviewReport | null;
  runtime: InterviewRuntimeState;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  modelId: ModelId;
  isPrivate: boolean;
  status: SessionStatus;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview: string;
}

export interface CreateSessionInput {
  title?: string;
  modelId?: ModelId;
  isPrivate?: boolean;
  config?: Partial<InterviewConfig>;
}

export interface PostMessageInput {
  content: string;
}

export interface PostMessageResult {
  session: ChatSession;
  assistantMessages: ChatMessage[];
}

export interface ChatSessionsResponse {
  sessions: SessionSummary[];
}

export interface ChatSessionResponse {
  session: ChatSession;
}

export type PostMessageResponse = PostMessageResult;
