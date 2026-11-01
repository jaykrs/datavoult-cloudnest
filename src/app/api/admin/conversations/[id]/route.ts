import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { replySchema, setStatusSchema } from '@/lib/conversations';
import { notifyConversationMessage } from '@/lib/notifications';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
interface Params { params: { id: string } }

function authError(e: unknown) {
  if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
  if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
  return null;
}

/** GET — the full thread; clears the admin-unread flag. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const conv = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) return apiError('Conversation not found', 404);
    if (conv.adminUnread) await prisma.conversation.update({ where: { id: conv.id }, data: { adminUnread: false } });
    return apiSuccess({ conversation: { ...conv, adminUnread: false } });
  } catch (e) {
    return authError(e) || (console.error('[admin/conversation GET]', e), apiError('Internal server error', 500));
  }
}

/** POST — admin reply (emailed to the customer). Re-opens a closed conversation. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { message } = replySchema.parse(await req.json());
    const conv = await prisma.conversation.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!conv) return apiError('Conversation not found', 404);

    await prisma.$transaction([
      prisma.conversationMessage.create({ data: { conversationId: conv.id, senderId: session.userId as string, senderRole: 'ADMIN', body: message } }),
      prisma.conversation.update({ where: { id: conv.id }, data: { status: 'OPEN', userUnread: true, adminUnread: false, lastMessageAt: new Date() } }),
    ]);
    void notifyConversationMessage(conv.id, 'ADMIN');
    return apiSuccess({ sent: true }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    return authError(e) || (console.error('[admin/conversation POST]', e), apiError('Internal server error', 500));
  }
}

/** PATCH — close or re-open the conversation. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { status } = setStatusSchema.parse(await req.json());
    const res = await prisma.conversation.updateMany({ where: { id: params.id }, data: { status } });
    if (res.count === 0) return apiError('Conversation not found', 404);
    return apiSuccess({ status });
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    return authError(e) || (console.error('[admin/conversation PATCH]', e), apiError('Internal server error', 500));
  }
}
