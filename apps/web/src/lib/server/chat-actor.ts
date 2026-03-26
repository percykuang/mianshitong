import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { prisma } from '@mianshitong/db';
import type { UserActorType } from '@mianshitong/db';
import { getAuthOptions } from './auth-options';

const GUEST_COOKIE_NAME = 'mianshitong_guest_session';
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type ChatActor = {
  id: string;
  type: UserActorType;
  displayName: string;
  authUserId: string | null;
};

function hashGuestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createGuestToken(): string {
  return randomBytes(24).toString('base64url');
}

function createGuestDisplayName(actorId: string): string {
  return `guest-${actorId.slice(-8)}`;
}

async function ensureRegisteredActor(input: { userId: string; email: string }): Promise<ChatActor> {
  const existing = await prisma.userActor.findUnique({
    where: { authUserId: input.userId },
  });

  if (existing) {
    const needsUpdate =
      existing.type !== 'registered' ||
      existing.displayName !== input.email ||
      existing.lastSeenAt.getTime() < Date.now() - 60_000;

    if (needsUpdate) {
      const updated = await prisma.userActor.update({
        where: { id: existing.id },
        data: {
          type: 'registered',
          displayName: input.email,
          lastSeenAt: new Date(),
        },
      });

      return {
        id: updated.id,
        type: updated.type,
        displayName: updated.displayName,
        authUserId: updated.authUserId,
      };
    }

    return {
      id: existing.id,
      type: existing.type,
      displayName: existing.displayName,
      authUserId: existing.authUserId,
    };
  }

  const created = await prisma.userActor.create({
    data: {
      id: input.userId,
      type: 'registered',
      displayName: input.email,
      authUserId: input.userId,
      lastSeenAt: new Date(),
    },
  });

  return {
    id: created.id,
    type: created.type,
    displayName: created.displayName,
    authUserId: created.authUserId,
  };
}

async function findGuestActorByToken(token: string): Promise<ChatActor | null> {
  const actor = await prisma.userActor.findUnique({
    where: { guestTokenHash: hashGuestToken(token) },
  });

  if (!actor || actor.type !== 'guest') {
    return null;
  }

  if (actor.lastSeenAt.getTime() < Date.now() - 60_000) {
    await prisma.userActor.update({
      where: { id: actor.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return {
    id: actor.id,
    type: actor.type,
    displayName: actor.displayName,
    authUserId: actor.authUserId,
  };
}

async function createGuestActorWithCookie(): Promise<ChatActor> {
  const token = createGuestToken();
  const created = await prisma.userActor.create({
    data: {
      type: 'guest',
      displayName: 'guest-pending',
      guestTokenHash: hashGuestToken(token),
      lastSeenAt: new Date(),
    },
  });

  const displayName = createGuestDisplayName(created.id);
  const actor = await prisma.userActor.update({
    where: { id: created.id },
    data: { displayName },
  });

  const cookieStore = await cookies();
  cookieStore.set(GUEST_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE,
  });

  return {
    id: actor.id,
    type: actor.type,
    displayName: actor.displayName,
    authUserId: actor.authUserId,
  };
}

export async function getCurrentChatActor(options?: {
  createGuest?: boolean;
}): Promise<ChatActor | null> {
  const session = await getServerSession(getAuthOptions());
  if (session?.user?.id && session.user.email) {
    return ensureRegisteredActor({
      userId: session.user.id,
      email: session.user.email,
    });
  }

  const createGuest = options?.createGuest ?? false;
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value ?? '';

  if (token) {
    const actor = await findGuestActorByToken(token);
    if (actor) {
      return actor;
    }
  }

  if (!createGuest) {
    return null;
  }

  return createGuestActorWithCookie();
}
