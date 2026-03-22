export interface SkillExecutionContext {
  signal?: AbortSignal;
}

export interface AgentSkill<I, O, C extends SkillExecutionContext = SkillExecutionContext> {
  readonly name: string;
  readonly version: string;
  execute(input: I, context?: C): Promise<O>;
}
