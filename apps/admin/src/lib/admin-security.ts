import { headers } from 'next/headers';

const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

type LoginAttemptState = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number | null;
};

const globalForAdminSecurity = globalThis as typeof globalThis & {
  __mianshitongAdminLoginAttempts?: Map<string, LoginAttemptState>;
};

const loginAttempts =
  globalForAdminSecurity.__mianshitongAdminLoginAttempts ??
  (globalForAdminSecurity.__mianshitongAdminLoginAttempts = new Map());

function normalizeIp(value: string): string {
  const trimmed = value.split(',')[0]?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
}

function isLoopbackIp(value: string): boolean {
  return value === '127.0.0.1' || value === '::1';
}

function resolveAllowedAdminIps(): Set<string> {
  const raw = process.env.ADMIN_ALLOWED_IPS?.trim();
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((item) => normalizeIp(item))
      .filter(Boolean),
  );
}

function pruneExpiredLoginAttempts(now: number): void {
  for (const [key, state] of loginAttempts.entries()) {
    const blocked = state.blockedUntil !== null && state.blockedUntil > now;
    const activeWindow = now - state.windowStartedAt < LOGIN_ATTEMPT_WINDOW_MS;
    if (!blocked && !activeWindow) {
      loginAttempts.delete(key);
    }
  }
}

function getRateLimitState(key: string, now: number): LoginAttemptState {
  const current = loginAttempts.get(key);
  if (!current) {
    return { count: 0, windowStartedAt: now, blockedUntil: null };
  }

  if (current.blockedUntil !== null && current.blockedUntil > now) {
    return current;
  }

  if (now - current.windowStartedAt >= LOGIN_ATTEMPT_WINDOW_MS) {
    return { count: 0, windowStartedAt: now, blockedUntil: null };
  }

  return current;
}

export async function getRequestIp(): Promise<string | null> {
  const headerStore = await headers();
  const ip =
    headerStore.get('cf-connecting-ip') ??
    headerStore.get('x-forwarded-for') ??
    headerStore.get('x-real-ip');

  const normalized = ip ? normalizeIp(ip) : '';
  return normalized || null;
}

export async function getAdminRequestGuardError(): Promise<{
  status: number;
  message: string;
} | null> {
  const allowedIps = resolveAllowedAdminIps();
  if (allowedIps.size === 0) {
    return null;
  }

  const ip = await getRequestIp();
  if (!ip) {
    return { status: 403, message: '当前来源未被允许访问后台。' };
  }

  if (isLoopbackIp(ip) || allowedIps.has(ip)) {
    return null;
  }

  return { status: 403, message: '当前来源 IP 未被允许访问后台。' };
}

export function getAdminLoginRateLimitKeys(email: string, ip: string | null): string[] {
  const normalizedEmail = email.trim().toLowerCase();
  const keys = [`email:${normalizedEmail}`];

  if (ip) {
    keys.push(`ip:${ip}`);
    keys.push(`ip-email:${ip}:${normalizedEmail}`);
  }

  return keys;
}

export function getAdminLoginRateLimitStatus(keys: string[]): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  pruneExpiredLoginAttempts(now);

  let blockedUntil = 0;
  for (const key of keys) {
    const state = getRateLimitState(key, now);
    if (state.blockedUntil !== null && state.blockedUntil > now) {
      blockedUntil = Math.max(blockedUntil, state.blockedUntil);
    }
  }

  if (blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordAdminLoginFailure(keys: string[]): void {
  const now = Date.now();
  pruneExpiredLoginAttempts(now);

  for (const key of keys) {
    const state = getRateLimitState(key, now);
    if (state.blockedUntil !== null && state.blockedUntil > now) {
      loginAttempts.set(key, state);
      continue;
    }

    const nextCount = state.count + 1;
    const blockedUntil = nextCount >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_ATTEMPT_WINDOW_MS : null;
    loginAttempts.set(key, {
      count: nextCount,
      windowStartedAt: state.count === 0 ? now : state.windowStartedAt,
      blockedUntil,
    });
  }
}

export function clearAdminLoginFailures(keys: string[]): void {
  for (const key of keys) {
    loginAttempts.delete(key);
  }
}
