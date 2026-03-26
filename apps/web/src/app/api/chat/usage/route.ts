import type { ChatUsageSummary } from '@mianshitong/shared';
import { getCurrentChatActor } from '@/lib/server/chat-actor';
import { getChatUsageSummary } from '@/lib/server/chat-usage';

export async function GET(): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return Response.json({ message: '无法初始化会话身份' }, { status: 500 });
  }

  const payload: ChatUsageSummary = await getChatUsageSummary({
    actorId: actor.id,
    actorType: actor.type,
  });

  return Response.json(payload);
}
