import { prisma } from '@mianshitong/db';
import { getAdminUser } from '@/lib/admin-auth';
import { replaceKnowledgeDocumentChunks } from '@/lib/knowledge-document-chunks';
import { getAdminRequestGuardError } from '@/lib/admin-security';
import { parsePatchKnowledgeDocumentPayload } from '@/lib/knowledge-document-validation';

export const runtime = 'nodejs';

function shouldResyncChunks(keys: string[]): boolean {
  return keys.some((key) => ['title', 'category', 'summary', 'content', 'tags'].includes(key));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id?: string }> },
): Promise<Response> {
  const guardError = await getAdminRequestGuardError();
  if (guardError) {
    return Response.json({ ok: false, message: guardError.message }, { status: guardError.status });
  }

  const adminUser = await getAdminUser();
  if (!adminUser) {
    return Response.json({ ok: false, message: '未授权访问。' }, { status: 401 });
  }

  const { id: encodedId } = await context.params;
  const id = encodedId ? decodeURIComponent(encodedId) : '';
  if (!id) {
    return Response.json({ ok: false, message: '缺少文档 ID。' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, message: '请求参数无效。' }, { status: 400 });
  }

  const parsed = parsePatchKnowledgeDocumentPayload(body as Record<string, unknown>);
  if (!parsed.ok) {
    return Response.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.knowledgeDocument.update({
        where: { id },
        data: parsed.data,
      });

      if (shouldResyncChunks(Object.keys(parsed.data))) {
        await replaceKnowledgeDocumentChunks(tx, updated);
      }
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, message: '更新失败，请稍后重试。' }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id?: string }> },
): Promise<Response> {
  const guardError = await getAdminRequestGuardError();
  if (guardError) {
    return Response.json({ ok: false, message: guardError.message }, { status: guardError.status });
  }

  const adminUser = await getAdminUser();
  if (!adminUser) {
    return Response.json({ ok: false, message: '未授权访问。' }, { status: 401 });
  }

  const { id: encodedId } = await context.params;
  const id = encodedId ? decodeURIComponent(encodedId) : '';
  if (!id) {
    return Response.json({ ok: false, message: '缺少文档 ID。' }, { status: 400 });
  }

  try {
    await prisma.knowledgeDocument.delete({
      where: { id },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, message: '删除失败，请稍后重试。' }, { status: 400 });
  }
}
