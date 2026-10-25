import nodemailer, { type Transporter } from 'nodemailer';

/**
 * SMTP mailer. Configure with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * SMTP_SECURE and MAIL_FROM (see .env.example). When it is not configured,
 * sending is skipped with a log line — email must never break sign-up or
 * checkout.
 */

let transporter: Transporter | null = null;

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

/** Collapse CR/LF so user-supplied text can never inject extra mail headers. */
export function stripNewlines(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** Admin notification recipients (ADMIN_NOTIFY_EMAIL, comma-separated). */
export function adminRecipients(): string[] {
  return (process.env.ADMIN_NOTIFY_EMAIL || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

export interface MailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

/** Send one email. Resolves true on success; never throws. */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  const subject = stripNewlines(msg.subject);
  if (!mailConfigured()) {
    console.log(`[mail] SMTP not configured — skipped "${subject}"`);
    return false;
  }
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to: msg.to,
      subject,
      text: msg.text,
      html: msg.html,
      replyTo: msg.replyTo ? stripNewlines(msg.replyTo) : undefined,
    });
    return true;
  } catch (e) {
    console.error(`[mail] failed to send "${subject}":`, (e as Error).message);
    return false;
  }
}
