import { prisma } from '@mianshitong/db';
import { getAdminUser } from '@/lib/admin-auth';
import { replaceKnowledgeDocumentChunks } from '@/lib/knowledge-document-chunks';
import { getAdminRequestGuardError } from '@/lib/admin-security';
import { parseCreateKnowledgeDocumentPayload } from '@/lib/knowledge-document-validation';

export const runtime = 'nodejs';

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
  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, message: '请求参数无效。' }, { status: 400 });
  }

  const parsed = parseCreateKnowledgeDocumentPayload(body as Record<string, unknown>);
  if (!parsed.ok) {
    return Response.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const nextDocument = await tx.knowledgeDocument.create({
        data: parsed.data,
      });
      await replaceKnowledgeDocumentChunks(tx, nextDocument);
      return nextDocument;
    });

    return Response.json({ ok: true, id: created.id });
  } catch {
    return Response.json({ ok: false, message: '创建失败，请稍后重试。' }, { status: 400 });
  }
}
