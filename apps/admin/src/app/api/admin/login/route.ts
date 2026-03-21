import { NextResponse } from 'next/server';
import { prisma } from '@mianshitong/db';
import {
  buildAdminSessionCookie,
  createAdminSessionToken,
  verifyAdminPassword,
} from '@/lib/admin-auth';
import {
  clearAdminLoginFailures,
  getAdminLoginRateLimitKeys,
  getAdminLoginRateLimitStatus,
  getAdminRequestGuardError,
  getRequestIp,
  recordAdminLoginFailure,
} from '@/lib/admin-security';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const guardError = await getAdminRequestGuardError();
  if (guardError) {
    return NextResponse.json(
      { ok: false, message: guardError.message },
      { status: guardError.status },
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ ok: false, message: '请输入邮箱和密码。' }, { status: 400 });
  }

  const requestIp = await getRequestIp();
  const rateLimitKeys = getAdminLoginRateLimitKeys(email, requestIp);
  const rateLimitStatus = getAdminLoginRateLimitStatus(rateLimitKeys);
  if (!rateLimitStatus.allowed) {
    return NextResponse.json(
      { ok: false, message: '登录尝试过于频繁，请稍后再试。' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimitStatus.retryAfterSeconds) },
      },
    );
  }

  const user = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user || !verifyAdminPassword(password, user.passwordHash)) {
    recordAdminLoginFailure(rateLimitKeys);
    return NextResponse.json({ ok: false, message: '账号或密码错误。' }, { status: 401 });
  }

  clearAdminLoginFailures(rateLimitKeys);
  const token = createAdminSessionToken({ id: user.id, email: user.email });
  const response = NextResponse.json({ ok: true });
  const cookie = buildAdminSessionCookie(token);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
