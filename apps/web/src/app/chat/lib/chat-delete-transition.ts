export type DeleteSessionTransitionPlan =
  | { kind: 'noop' }
  | { kind: 'reset' }
  | { kind: 'use-cached'; sessionId: string }
  | { kind: 'fetch-remote'; sessionId: string };

interface DeleteSessionTransitionInput {
  activeSessionId: string | null;
  deletedSessionId: string;
  nextSessionId: string | null;
  hasCachedNextSession: boolean;
}

export function getDeleteSessionTransitionPlan(
  input: DeleteSessionTransitionInput,
): DeleteSessionTransitionPlan {
  if (input.activeSessionId !== input.deletedSessionId) {
    return { kind: 'noop' };
  }

  if (!input.nextSessionId) {
    return { kind: 'reset' };
  }

  if (input.hasCachedNextSession) {
    return { kind: 'use-cached', sessionId: input.nextSessionId };
  }

  return { kind: 'fetch-remote', sessionId: input.nextSessionId };
}
