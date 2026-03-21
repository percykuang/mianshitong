import { prisma } from '@mianshitong/db';
import { getAdminUser } from '@/lib/admin-auth';
import { getAdminRequestGuardError } from '@/lib/admin-security';

export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export async function POST(request: Request): Promise<Response> {
  const guardError = await getAdminRequestGuardError();
  if (guardError) {
    return Response.json({ ok: false, message: guardError.message }, { status: guardError.status });
  }

  const adminUser = await getAdminUser();
  if (!adminUser) {
    return Response.json({ ok: false, message: '未授权访问。' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return Response.json({ ok: false, message: '请求参数无效。' }, { status: 400 });
  }

  const ids = toStringArray(body.ids);
  if (ids.length === 0) {
    return Response.json({ ok: false, message: '请选择要删除的题目。' }, { status: 400 });
  }

  const result = await prisma.questionBankItem.deleteMany({
    where: { id: { in: ids } },
  });

  return Response.json({ ok: true, deleted: result.count });
}
