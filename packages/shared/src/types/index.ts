export type ModelId = 'deepseek-chat' | 'deepseek-reasoner';

export type InterviewLevel = 'junior' | 'mid' | 'senior';
export type InterviewTopic =
  | 'javascript'
  | 'react'
  | 'vue'
  | 'engineering'
  | 'performance'
  | 'network'
  | 'security'
  | 'node';
export type FeedbackMode = 'per_question' | 'end_summary';
export type InterviewReportLevel = 'needs-work' | 'solid' | 'strong';

export interface InterviewConfig {
  level: InterviewLevel;
  topics: InterviewTopic[];
  questionCount: number;
  feedbackMode: FeedbackMode;
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

export interface AssessmentScores {
  correctness: number;
  depth: number;
  communication: number;
  engineering: number;
  tradeoffs: number;
}

export type DimensionScores = AssessmentScores;

export interface QuestionAssessment {
  questionId: string;
  questionTitle: string;
  topic: InterviewTopic;
  summary: string;
  scores: AssessmentScores;
  matchedPoints: string[];
  missingPoints: string[];
}

export interface InterviewReport {
  overallSummary: string;
  overallScore: number;
  level: InterviewReportLevel;
  dimensionSummary: AssessmentScores;
  strengths: string[];
  gaps: string[];
  nextSteps: string[];
  breakdown: QuestionAssessment[];
}

export type MessageRole = 'system' | 'user' | 'assistant';
export type MessageKind =
  | 'text'
  | 'question'
  | 'follow_up'
  | 'evaluation'
  | 'feedback'
  | 'report'
  | 'system';
export type SessionStatus = 'idle' | 'interviewing' | 'completed';

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
  pinnedAt: string | null;
}

export interface SessionSummary {
  id: string;
  title: string;
  modelId: ModelId;
  isPrivate: boolean;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
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
