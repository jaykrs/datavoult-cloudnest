import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { replySchema, canUserAccess, canUserReply } from '@/lib/conversations';
import { notifyConversationMessage } from '@/lib/notifications';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
interface Params { params: { id: string } }

/** GET — the thread (owner only); clears the customer-unread flag. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const conv = await prisma.conversation.findUnique({ where: { id: params.id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    // 404 (not 403) for someone else's thread, so ids can't be probed.
    if (!conv || !canUserAccess(conv, session.userId as string)) return apiError('Conversation not found', 404);
    if (conv.userUnread) await prisma.conversation.update({ where: { id: conv.id }, data: { userUnread: false } });
    const { adminUnread: _a, userId: _u, ...safe } = conv;
    return apiSuccess({ conversation: { ...safe, userUnread: false, messages: conv.messages.map(({ senderId: _s, ...m }) => m) } });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[conversation GET]', e);
    return apiError('Internal server error', 500);
  }
}

/** POST — the customer's reply (emailed to the admins). Only while the conversation is open. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;
    const limit = rateLimit(`convreply:${userId}`, 20, 60 * 60_000);
    if (!limit.allowed) return apiError('Too many messages. Please try again later.', 429);

    const { message } = replySchema.parse(await req.json());
    const conv = await prisma.conversation.findUnique({ where: { id: params.id }, select: { id: true, userId: true, status: true } });
    if (!conv || !canUserAccess(conv, userId)) return apiError('Conversation not found', 404);
    if (!canUserReply(conv)) return apiError('This conversation is closed. Please contact us to continue.', 409);

    await prisma.$transaction([
      prisma.conversationMessage.create({ data: { conversationId: conv.id, senderId: userId, senderRole: 'USER', body: message } }),
      prisma.conversation.update({ where: { id: conv.id }, data: { adminUnread: true, lastMessageAt: new Date() } }),
    ]);
    void notifyConversationMessage(conv.id, 'USER');
    return apiSuccess({ sent: true }, 201);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[conversation POST]', e);
    return apiError('Internal server error', 500);
  }
}
