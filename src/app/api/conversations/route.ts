import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/conversations — the signed-in customer's own conversations. */
export async function GET() {
  try {
    const session = await requireAuth();
    const rows = await prisma.conversation.findMany({
      where: { userId: session.userId as string },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, senderRole: true } } },
    });
    const conversations = rows.map(({ messages, adminUnread: _a, ...c }) => ({ ...c, last: messages[0] ?? null }));
    return apiSuccess({ conversations, unread: rows.filter((r) => r.userUnread).length });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[conversations GET]', e);
    return apiError('Internal server error', 500);
  }
}
