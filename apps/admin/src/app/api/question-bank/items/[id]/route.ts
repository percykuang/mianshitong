import { prisma } from '@mianshitong/db';
import { getAdminUser } from '@/lib/admin-auth';
import { syncQuestionRetrievalDoc } from '@/lib/question-retrieval-doc';
import { getAdminRequestGuardError } from '@/lib/admin-security';
import { parsePatchQuestionPayload } from '@/lib/question-bank-validation';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guardError = await getAdminRequestGuardError();
  if (guardError) {
    return Response.json({ ok: false, message: guardError.message }, { status: guardError.status });
  }

  const adminUser = await getAdminUser();
  if (!adminUser) {
    return Response.json({ ok: false, message: '未授权访问。' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, message: '请求参数无效。' }, { status: 400 });
  }

  const { id } = await context.params;
  const parsed = parsePatchQuestionPayload(body as Record<string, unknown>);
  if (!parsed.ok) {
    return Response.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  try {
    const updated = await prisma.questionBankItem.update({
      where: { id },
      data: parsed.data,
    });
    await syncQuestionRetrievalDoc(updated);
    return Response.json({ ok: true, id: updated.id });
  } catch {
    return Response.json(
      { ok: false, message: '更新失败，请检查题目 ID 是否重复。' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guardError = await getAdminRequestGuardError();
  if (guardError) {
    return Response.json({ ok: false, message: guardError.message }, { status: guardError.status });
  }

  const adminUser = await getAdminUser();
  if (!adminUser) {
    return Response.json({ ok: false, message: '未授权访问。' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    await prisma.questionBankItem.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, message: '题目不存在。' }, { status: 404 });
  }
}
