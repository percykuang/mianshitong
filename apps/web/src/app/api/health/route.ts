import { prisma } from '@mianshitong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      ok: true,
      app: 'web',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        app: 'web',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
