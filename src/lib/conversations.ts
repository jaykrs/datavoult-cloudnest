import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 5000;

const body = z.string().trim().min(1, 'Write a message').max(MAX_MESSAGE_LENGTH, `Keep messages under ${MAX_MESSAGE_LENGTH} characters`);

/** Admin starts a conversation with a customer. */
export const startConversationSchema = z.object({
  userId: z.string().trim().min(1, 'Choose a customer').max(40),
  subject: z.string().trim().min(3, 'Add a subject (3+ characters)').max(150),
  message: body,
});

export const replySchema = z.object({ message: body });

export const setStatusSchema = z.object({ status: z.enum(['OPEN', 'CLOSED']) });

/** Only the owner (customer) of a conversation may read it from the customer API. */
export function canUserAccess(conv: { userId: string }, userId: string): boolean {
  return conv.userId === userId;
}

/** Customers can reply only while a conversation is open. */
export function canUserReply(conv: { status: string }): boolean {
  return conv.status === 'OPEN';
}
