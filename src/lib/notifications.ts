import { prisma } from './prisma';
import { sendMail, adminRecipients, mailConfigured } from './mailer';
import * as tpl from './email-templates';
import { formatINR } from './currency';

/** Longest we let email delay an HTTP response. The send keeps going afterwards. */
const MAX_WAIT_MS = 4000;

async function deliver(jobs: Array<Promise<boolean>>): Promise<void> {
  if (!mailConfigured()) {
    await Promise.all(jobs); // logs "skipped"
    return;
  }
  await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, MAX_WAIT_MS))]);
}

/** Welcome email to the user + heads-up to admins. Never throws. */
export async function notifyUserSignedUp(user: { name: string; email: string }): Promise<void> {
  try {
    const jobs = [sendMail({ to: user.email, ...tpl.welcomeEmail(user.name) })];
    const admins = adminRecipients();
    if (admins.length) jobs.push(sendMail({ to: admins, ...tpl.adminNewUserEmail(user.name, user.email) }));
    await deliver(jobs);
  } catch (e) {
    console.error('[notify] signup', (e as Error).message);
  }
}

/** Confirmation to the customer + heads-up to admins for a NEW subscription. Never throws. */
export async function notifyOrderSubscribed(subscriptionId: string): Promise<void> {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, product: true, plan: true },
    });
    if (!sub) return;
    const info: tpl.OrderInfo = {
      userName: sub.user.name,
      userEmail: sub.user.email,
      productName: sub.product.name,
      planName: sub.plan.name,
      amount: formatINR(sub.plan.price.toNumber()),
      subscriptionId: sub.id,
    };
    const jobs = [sendMail({ to: info.userEmail, ...tpl.orderConfirmationEmail(info) })];
    const admins = adminRecipients();
    if (admins.length) jobs.push(sendMail({ to: admins, ...tpl.adminNewOrderEmail(info) }));
    await deliver(jobs);
  } catch (e) {
    console.error('[notify] order', (e as Error).message);
  }
}

/** Alert admins to a new contact message (reply-to = the visitor). Never throws. */
export async function notifyContactMessage(c: { name: string; email: string; subject: string; message: string }): Promise<void> {
  try {
    const admins = adminRecipients();
    if (!admins.length) return;
    await deliver([sendMail({ to: admins, replyTo: c.email, ...tpl.adminContactEmail(c) })]);
  } catch (e) {
    console.error('[notify] contact', (e as Error).message);
  }
}
