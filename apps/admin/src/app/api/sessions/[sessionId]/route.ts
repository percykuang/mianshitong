import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@mianshitong/db';
import { getAdminUser } from '@/lib/admin-auth';
import { getAdminRequestGuardError } from '@/lib/admin-security';

interface RouteContext {
  params: Promise<{ sessionId?: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const guardError = await getAdminRequestGuardError();
  if (guardError) {
    return NextResponse.json({ message: guardError.message }, { status: guardError.status });
  }

  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ message: '未授权访问。' }, { status: 401 });
  }

  const { sessionId } = await context.params;

  if (!sessionId) {
    return NextResponse.json({ message: '缺少会话 ID。' }, { status: 400 });
  }

  try {
    await prisma.chatSessionRecord.delete({ where: { id: sessionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: '会话不存在或已被删除。' }, { status: 404 });
    }
    return NextResponse.json({ message: '删除失败，请稍后重试。' }, { status: 500 });
  }
}
