import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@mianshitong/db';
import { getAdminUser } from '@/lib/admin-auth';
import { getAdminRequestGuardError } from '@/lib/admin-security';

interface RouteContext {
  params: Promise<{ userId?: string }>;
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

  const { userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ message: '缺少用户 ID。' }, { status: 400 });
  }

  try {
    await prisma.authUser.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: '用户不存在或已被删除。' }, { status: 404 });
    }
    return NextResponse.json({ message: '删除失败，请稍后重试。' }, { status: 500 });
  }
}
