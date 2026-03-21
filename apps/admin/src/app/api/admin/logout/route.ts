import { NextResponse } from 'next/server';
import { buildAdminLogoutCookie } from '@/lib/admin-auth';
import { getAdminRequestGuardError } from '@/lib/admin-security';

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  const guardError = await getAdminRequestGuardError();
  if (guardError) {
    return NextResponse.json(
      { ok: false, message: guardError.message },
      { status: guardError.status },
    );
  }

  const response = NextResponse.json({ ok: true });
  const cookie = buildAdminLogoutCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
