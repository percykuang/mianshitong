import { prisma } from '@mianshitong/db';
import { getAdminUser } from '@/lib/admin-auth';
import { syncQuestionRetrievalDoc } from '@/lib/question-retrieval-doc';
import { getAdminRequestGuardError } from '@/lib/admin-security';
import { parseCreateQuestionPayload } from '@/lib/question-bank-validation';

export const runtime = 'nodejs';

function createQuestionId(): string {
  return crypto.randomUUID().replace(/-/g, '');
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
  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, message: '请求参数无效。' }, { status: 400 });
  }

  const parsed = parseCreateQuestionPayload(body as Record<string, unknown>);
  if (!parsed.ok) {
    return Response.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  try {
    const created = await prisma.questionBankItem.create({
      data: {
        questionId: createQuestionId(),
        ...parsed.data,
      },
    });
    await syncQuestionRetrievalDoc(created);

    return Response.json({ ok: true, id: created.id });
  } catch {
    return Response.json(
      { ok: false, message: '创建失败，请检查题目 ID 是否重复。' },
      { status: 400 },
    );
  }
}
