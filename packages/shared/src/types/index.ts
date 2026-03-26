export type ModelId = 'deepseek-chat' | 'deepseek-reasoner';
export type ActorType = 'guest' | 'registered';

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

export interface WeightedTag {
  tag: string;
  weight: number;
}

export interface ResumeProfile {
  role: 'frontend';
  targetRole?: string | null;
  seniority: InterviewLevel;
  yearsOfExperience?: number | null;
  primaryTags: WeightedTag[];
  secondaryTags: WeightedTag[];
  projectTags: string[];
  strengths: string[];
  riskFlags: string[];
  evidence: string[];
  confidence: number;
}

export interface InterviewBlueprint {
  questionCount: number;
  difficultyDistribution: Record<InterviewLevel, number>;
  tagDistribution: WeightedTag[];
  mustIncludeTags: string[];
  optionalTags: string[];
  avoidTags: string[];
  strategyNotes: string[];
}

export type InterviewPlanningStrategy = 'hybrid-lexical-v1' | 'hybrid-vector-v1';

export interface InterviewPlanningScoreBreakdown {
  semantic: number;
  lexical: number;
  tag: number;
  mustInclude: number;
  optional: number;
  level: number;
  penalty: number;
}

export interface InterviewPlanningCandidateTrace {
  questionId: string;
  questionTitle: string;
  level: InterviewLevel;
  tags: string[];
  score: number;
  matchedTags: string[];
  matchedMustIncludeTags: string[];
  matchedOptionalTags: string[];
  lexicalOverlap: string[];
  breakdown: InterviewPlanningScoreBreakdown;
}

export interface InterviewPlanningStepTrace {
  slot: number;
  targetLevel: InterviewLevel | null;
  retrievalMode: 'target_level' | 'fallback_any_level';
  uncoveredMustTags: string[];
  preferredTags: WeightedTag[];
  candidateCount: number;
  selectedQuestionId: string | null;
  selectedQuestionTitle: string | null;
  selectedScore: number | null;
  candidates: InterviewPlanningCandidateTrace[];
}

export interface InterviewPlanningTrace {
  strategy: InterviewPlanningStrategy;
  sourceTextPreview: string;
  levelQuota: Record<InterviewLevel, number>;
  steps: InterviewPlanningStepTrace[];
}

export type InterviewFollowUpDecision =
  | 'ask_follow_up'
  | 'skip_no_key_points'
  | 'skip_max_round'
  | 'skip_coverage_sufficient'
  | 'skip_all_points_covered';

export interface InterviewFollowUpTrace {
  questionId: string;
  questionTitle: string;
  round: number;
  answerPreview: string;
  answerLength: number;
  keyPointCount: number;
  matchedPoints: string[];
  missingPoints: string[];
  coverage: number;
  decision: InterviewFollowUpDecision;
  askedMissingPoint: string | null;
  createdAt: string;
}

export interface InterviewAssessmentTrace {
  questionId: string;
  questionTitle: string;
  answerPreview: string;
  answerLength: number;
  keyPointCount: number;
  matchedPoints: string[];
  missingPoints: string[];
  scores: AssessmentScores;
  averageScore: number;
  summary: string;
  createdAt: string;
}

export interface InterviewQuestion {
  id: string;
  level: InterviewLevel;
  title: string;
  prompt?: string | null;
  answer?: string | null;
  keyPoints?: string[];
  followUps?: string[];
  tags: string[];
  order?: number | null;
  topic?: InterviewTopic | null;
}

export interface AssessmentScores {
  correctness: number;
  depth: number;
  communication: number;
  engineering: number;
  tradeoffs: number;
}

export type DimensionScores = AssessmentScores;
export type InterviewScoreDimension = keyof AssessmentScores;

export interface InterviewReportDimensionTraceSource {
  questionId: string;
  questionTitle: string;
  score: number;
}

export interface InterviewReportDimensionTrace {
  dimension: InterviewScoreDimension;
  averageScore: number;
  sources: InterviewReportDimensionTraceSource[];
}

export interface InterviewReportPointTraceSource {
  questionId: string;
  questionTitle: string;
}

export interface InterviewReportPointTrace {
  point: string;
  count: number;
  sources: InterviewReportPointTraceSource[];
}

export interface InterviewReportNextStepTrace {
  gap: string;
  action: string;
  sources: InterviewReportPointTraceSource[];
}

export interface InterviewReportTrace {
  createdAt: string;
  assessmentCount: number;
  dimensionSummary: AssessmentScores;
  dimensionTraces: InterviewReportDimensionTrace[];
  overallScore: number;
  overallScoreFormula: string;
  level: InterviewReportLevel;
  levelReason: string;
  summaryTemplate: InterviewReportLevel;
  overallSummary: string;
  strengths: InterviewReportPointTrace[];
  gaps: InterviewReportPointTrace[];
  nextSteps: InterviewReportNextStepTrace[];
}

export interface QuestionAssessment {
  questionId: string;
  questionTitle: string;
  topic?: InterviewTopic | null;
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
export type ChatMessageFeedback = 'like' | 'dislike';
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
  followUpTrace: InterviewFollowUpTrace[];
  assessmentTrace: InterviewAssessmentTrace[];
  resumeProfile: ResumeProfile | null;
  interviewBlueprint: InterviewBlueprint | null;
  planningSummary: string | null;
  planGeneratedAt: string | null;
  planningTrace: InterviewPlanningTrace | null;
  reportTrace: InterviewReportTrace | null;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  createdAt: string;
  feedback?: ChatMessageFeedback | null;
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

export interface ChatUsageSummary {
  actorType: ActorType;
  used: number;
  max: number;
  remaining: number;
}
