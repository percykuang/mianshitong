import type {
  InterviewConfig,
  InterviewQuestion,
  InterviewReport,
  ModelId,
  QuestionAssessment,
} from '@mianshitong/shared';

export interface LlmProvider {
  readonly name: string;
  generateGeneralReply(input: { content: string; modelId: ModelId }): string;
  generateInterviewKickoff(config: InterviewConfig): string;
  generateQuestionMessage(input: {
    question: InterviewQuestion;
    index: number;
    total: number;
  }): string;
  generateFollowUpMessage(input: { question: InterviewQuestion; missingPoint: string }): string;
  generateQuestionFeedback(assessment: QuestionAssessment): string;
  generateReportMessage(report: InterviewReport): string;
}

export type ChatTurnRole = 'system' | 'user' | 'assistant';

export interface ChatTurn {
  role: ChatTurnRole;
  content: string;
}

export interface StreamChatInput {
  messages: ChatTurn[];
  model?: string;
  signal?: AbortSignal;
}

export interface StreamChatProvider {
  readonly name: string;
  streamChat(input: StreamChatInput): AsyncGenerator<string>;
}

export interface EmbeddingInput {
  texts: string[];
  signal?: AbortSignal;
}

export interface EmbeddingProvider {
  readonly name: string;
  embedTexts(input: EmbeddingInput): Promise<number[][]>;
}
