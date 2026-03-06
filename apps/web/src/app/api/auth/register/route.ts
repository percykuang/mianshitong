import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/server/auth-user-repository';
import { credentialsSchema } from '@/lib/server/auth-validation';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数不合法' },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existedUser = await findUserByEmail(email);
  if (existedUser) {
    return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await createUser({ email, passwordHash });

  return NextResponse.json({ ok: true }, { status: 201 });
}
