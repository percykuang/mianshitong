import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@mianshitong/db';
import { getAdminRequestGuardError } from '@/lib/admin-security';

const ADMIN_COOKIE_NAME = 'mianshitong_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEV_ADMIN_SECRET = 'mianshitong-admin-dev-secret';

export type AdminSessionPayload = {
  id: string;
  email: string;
  iat: number;
  exp: number;
};

export type AdminUserInfo = {
  id: string;
  email: string;
};

function resolveAdminSecret(): string {
  const secret =
    process.env.ADMIN_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === 'development' ? DEV_ADMIN_SECRET : undefined);

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_AUTH_SECRET is required in production');
  }

  return secret ?? DEV_ADMIN_SECRET;
}

function toBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf-8');
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createAdminSessionToken(user: AdminUserInfo): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    id: user.id,
    email: user.email,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const data = toBase64Url(JSON.stringify(payload));
  const signature = sign(data, resolveAdminSecret());
  return `${data}.${signature}`;
}

export function verifyAdminSessionToken(token: string): AdminSessionPayload | null {
  const [data, signature] = token.split('.');
  if (!data || !signature) {
    return null;
  }

  const expected = sign(data, resolveAdminSecret());
  if (
    expected.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(data)) as AdminSessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function buildAdminSessionCookie(token: string) {
  return {
    name: ADMIN_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

export function buildAdminLogoutCookie() {
  return {
    name: ADMIN_COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    },
  };
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyAdminSessionToken(token);
}

export async function getAdminUser(): Promise<AdminUserInfo | null> {
  const guardError = await getAdminRequestGuardError();
  if (guardError) {
    return null;
  }

  const session = await getAdminSession();
  if (!session) {
    return null;
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: session.id },
    select: { id: true, email: true },
  });

  if (!user || user.email !== session.email) {
    return null;
  }

  return user;
}

export async function requireAdminUser(): Promise<AdminUserInfo> {
  const user = await getAdminUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyAdminPassword(password: string, passwordHash: string): boolean {
  const [prefix, salt, expected] = passwordHash.split(':');
  if (prefix !== 'scrypt' || !salt || !expected) {
    return false;
  }
  const hash = scryptSync(password, salt, 32).toString('hex');
  if (hash.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}
