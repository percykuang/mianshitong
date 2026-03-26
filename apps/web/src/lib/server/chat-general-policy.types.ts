export type ArithmeticIntent = {
  left: number;
  operator: '+' | '-' | '*' | '/';
  right: number;
  result: number;
};

export type TechnicalQuestionIntentStyle = 'concept' | 'mechanism' | 'comparison';

export type GeneralChatIntent =
  | { kind: 'greeting' }
  | { kind: 'resume_optimize' }
  | { kind: 'simple_arithmetic'; arithmetic: ArithmeticIntent }
  | { kind: 'self_intro' }
  | { kind: 'project_highlight' }
  | {
      kind: 'technical_question';
      question: string;
      style: TechnicalQuestionIntentStyle;
    };
