import {
  MODEL_OPTIONS,
  type ChatSessionResponse,
  type ChatSessionsResponse,
  type CreateSessionInput,
} from '@mianshitong/shared';
import { createSession, listSessionSummaries } from '@/lib/server/chat-store';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isModelId(value: unknown): value is (typeof MODEL_OPTIONS)[number]['id'] {
  return MODEL_OPTIONS.some((item) => item.id === value);
}

export async function GET(): Promise<Response> {
  const payload: ChatSessionsResponse = {
    sessions: listSessionSummaries(),
  };

  return Response.json(payload);
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const session = createSession({
    title: typeof input.title === 'string' ? input.title : undefined,
    modelId: isModelId(input.modelId) ? input.modelId : undefined,
    isPrivate: typeof input.isPrivate === 'boolean' ? input.isPrivate : undefined,
    config: isRecord(input.config) ? (input.config as CreateSessionInput['config']) : undefined,
  });

  const payload: ChatSessionResponse = { session };
  return Response.json(payload, { status: 201 });
}
