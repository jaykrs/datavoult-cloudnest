import { describe, it, expect } from 'vitest';
import { startConversationSchema, replySchema, setStatusSchema, canUserAccess, canUserReply, MAX_MESSAGE_LENGTH } from './conversations';
import { conversationMessageEmail } from './email-templates';

describe('conversation validation', () => {
  it('requires a customer, subject and message', () => {
    expect(startConversationSchema.safeParse({ userId: '', subject: 'Hi there', message: 'Hello' }).success).toBe(false);
    expect(startConversationSchema.safeParse({ userId: 'u1', subject: 'Hi', message: 'Hello' }).success).toBe(false);
    expect(startConversationSchema.safeParse({ userId: 'u1', subject: 'Hi there', message: '   ' }).success).toBe(false);
    expect(startConversationSchema.safeParse({ userId: 'u1', subject: 'Hi there', message: 'Hello' }).success).toBe(true);
  });
  it('caps message length and trims', () => {
    expect(replySchema.safeParse({ message: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) }).success).toBe(false);
    expect(replySchema.parse({ message: '  ok  ' }).message).toBe('ok');
  });
  it('only allows OPEN/CLOSED', () => {
    expect(setStatusSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false);
    expect(setStatusSchema.safeParse({ status: 'CLOSED' }).success).toBe(true);
  });
});

describe('conversation access rules', () => {
  it('lets only the owner read, and only while open reply', () => {
    expect(canUserAccess({ userId: 'a' }, 'a')).toBe(true);
    expect(canUserAccess({ userId: 'a' }, 'b')).toBe(false);
    expect(canUserReply({ status: 'OPEN' })).toBe(true);
    expect(canUserReply({ status: 'CLOSED' })).toBe(false);
  });
});

describe('conversationMessageEmail', () => {
  const base = { recipientName: 'Asha', senderName: 'The DataVoult team', subject: 'Your server', message: 'Hello', toCustomer: true };
  it('includes the message and link', () => {
    const e = conversationMessageEmail({ ...base, url: 'https://x.com/messages?c=1' });
    expect(e.text).toContain('Hello');
    expect(e.html).toContain('https://x.com/messages?c=1');
  });
  it('escapes user-controlled text', () => {
    const e = conversationMessageEmail({ ...base, message: '<script>alert(1)</script>', senderName: '<b>x</b>' });
    expect(e.html).not.toContain('<script>');
    expect(e.html).not.toContain('<b>x</b>');
  });
});
