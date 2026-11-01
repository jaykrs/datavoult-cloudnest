import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { startConversationSchema } from '@/lib/conversations';
import { notifyConversationMessage } from '@/lib/notifications';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function authError(e: unknown) {
  if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
  if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
  return null;
}

/** GET /api/admin/conversations?status=&search=&page= — newest activity first, with unread count. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const rawStatus = url.searchParams.get('status');
    const status: 'OPEN' | 'CLOSED' | undefined = rawStatus === 'OPEN' || rawStatus === 'CLOSED' ? rawStatus : undefined;
    const search = (url.searchParams.get('search') || '').trim();
    const { page, limit, skip } = getPaginationParams(req);

    const where = {
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ subject: { contains: search } }, { user: { name: { contains: search } } }, { user: { email: { contains: search } } }] } : {}),
    };
    const [rows, total, unread] = await Promise.all([
      prisma.conversation.findMany({
        where, skip, take: limit, orderBy: { lastMessageAt: 'desc' },
        include: { user: { select: { name: true, email: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, senderRole: true } } },
      }),
      prisma.conversation.count({ where }),
      prisma.conversation.count({ where: { adminUnread: true } }),
    ]);
    const conversations = rows.map(({ messages, ...c }) => ({ ...c, last: messages[0] ?? null }));
    return apiSuccess({ conversations, unread, meta: buildPaginationMeta(total, page, limit) });
  } catch (e) {
    return authError(e) || (console.error('[admin/conversations GET]', e), apiError('Internal server error', 500));
  }
}

/** POST /api/admin/conversations — start a conversation with a customer (first message is emailed to them). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const { userId, subject, message } = startConversationSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return apiError('Customer not found', 404);

    const conv = await prisma.conversation.create({
      data: {
        userId, subject, userUnread: true, adminUnread: false,
        messages: { create: { senderId: session.userId as string, senderRole: 'ADMIN', body: message } },
      },
    });
    void notifyConversationMessage(conv.id, 'ADMIN');
    return apiSuccess({ id: conv.id }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    return authError(e) || (console.error('[admin/conversations POST]', e), apiError('Internal server error', 500));
  }
}
