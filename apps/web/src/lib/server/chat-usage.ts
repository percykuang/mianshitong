import { prisma } from '@mianshitong/db';
import type { UserActorType } from '@mianshitong/db';
import type { ChatUsageSummary } from '@mianshitong/shared';

const DAILY_LIMITS: Record<UserActorType, number> = {
  guest: 10,
  registered: 30,
};

function toDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

export function resolveDailyLimit(actorType: UserActorType): number {
  return DAILY_LIMITS[actorType];
}

export function getChatUsageLimitMessage(actorType: UserActorType): string {
  return actorType === 'guest'
    ? '今日体验额度已用完，登录后可提升至 30 次/天。'
    : '今日额度已用完，将于明天 00:00 重置。';
}

export async function getChatUsageSummary(input: {
  actorId: string;
  actorType: UserActorType;
}): Promise<ChatUsageSummary> {
  const dateKey = toDateKey(new Date());
  const limit = resolveDailyLimit(input.actorType);
  const usage = await prisma.dailyUsageCounter.findUnique({
    where: {
      actorId_dateKey: {
        actorId: input.actorId,
        dateKey,
      },
    },
  });

  const used = usage?.usedCount ?? 0;
  const max = usage?.maxCount ?? limit;

  return {
    actorType: input.actorType,
    used,
    max,
    remaining: Math.max(0, max - used),
  };
}

export async function consumeChatUsage(input: {
  actorId: string;
  actorType: UserActorType;
}): Promise<ChatUsageSummary & { allowed: boolean }> {
  const dateKey = toDateKey(new Date());
  const max = resolveDailyLimit(input.actorType);

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.dailyUsageCounter.findUnique({
      where: {
        actorId_dateKey: {
          actorId: input.actorId,
          dateKey,
        },
      },
    });

    if (current && current.usedCount >= max) {
      return {
        counter: current,
        allowed: false,
      };
    }

    const next = current
      ? await tx.dailyUsageCounter.update({
          where: {
            actorId_dateKey: {
              actorId: input.actorId,
              dateKey,
            },
          },
          data: {
            usedCount: { increment: 1 },
            maxCount: max,
          },
        })
      : await tx.dailyUsageCounter.create({
          data: {
            actorId: input.actorId,
            dateKey,
            usedCount: 1,
            maxCount: max,
          },
        });

    await tx.userActor.update({
      where: { id: input.actorId },
      data: { lastSeenAt: new Date() },
    });

    return {
      counter: next,
      allowed: true,
    };
  });

  const used = result.counter.usedCount;

  return {
    actorType: input.actorType,
    used,
    max,
    remaining: Math.max(0, max - used),
    allowed: result.allowed,
  };
}

export async function rollbackChatUsage(input: {
  actorId: string;
  actorType: UserActorType;
}): Promise<void> {
  const dateKey = toDateKey(new Date());

  await prisma.dailyUsageCounter.updateMany({
    where: {
      actorId: input.actorId,
      dateKey,
      usedCount: { gt: 0 },
    },
    data: {
      usedCount: { decrement: 1 },
      maxCount: resolveDailyLimit(input.actorType),
    },
  });
}
