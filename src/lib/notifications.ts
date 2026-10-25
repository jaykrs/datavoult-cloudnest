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
      include: { user: true, product: true, plan: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!sub) return;
    const info: tpl.OrderInfo = {
      userName: sub.user.name,
      userEmail: sub.user.email,
      productName: sub.product.name,
      planName: sub.plan.name,
      // The plan price is per day; what the customer actually paid is on the payment.
      amount: formatINR((sub.payments[0]?.amount ?? sub.plan.price).toNumber()),
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

async function manualInfo(requestId: string): Promise<tpl.ManualPaymentInfo | null> {
  const r = await prisma.paymentRequest.findUnique({
    where: { id: requestId },
    include: { user: true, product: true, plan: true },
  });
  if (!r) return null;
  return {
    userName: r.user.name,
    userEmail: r.user.email,
    productName: r.product.name,
    planName: r.plan.name,
    days: r.days,
    amount: formatINR(r.amount.toNumber()),
    reference: r.reference,
    method: r.method === 'UPI' ? 'UPI' : 'bank transfer',
    transactionRef: r.transactionRef,
    reason: r.reviewNote,
  };
}

/** Tell admins a customer reported an offline payment that needs checking. Never throws. */
export async function notifyManualPaymentSubmitted(requestId: string): Promise<void> {
  try {
    const admins = adminRecipients();
    if (!admins.length) return;
    const info = await manualInfo(requestId);
    if (!info) return;
    await deliver([sendMail({ to: admins, ...tpl.adminManualPaymentSubmittedEmail(info) })]);
  } catch (e) {
    console.error('[notify] manual payment submitted', (e as Error).message);
  }
}

/** Tell the customer their offline payment was approved or rejected. Never throws. */
export async function notifyManualPaymentReviewed(requestId: string, approved: boolean): Promise<void> {
  try {
    const info = await manualInfo(requestId);
    if (!info) return;
    const mail = approved ? tpl.manualPaymentApprovedEmail(info) : tpl.manualPaymentRejectedEmail(info);
    await deliver([sendMail({ to: info.userEmail, ...mail })]);
  } catch (e) {
    console.error('[notify] manual payment reviewed', (e as Error).message);
  }
}

/** Email the customer that their invoice is ready. Never throws. */
export async function notifyInvoiceIssued(invoiceId: string): Promise<void> {
  try {
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { user: true } });
    if (!inv) return;
    const base = (process.env.APP_URL || '').replace(/\/$/, '');
    await deliver([
      sendMail({
        to: inv.user.email,
        ...tpl.invoiceIssuedEmail({
          userName: inv.user.name,
          number: inv.number,
          total: formatINR(inv.total.toNumber()),
          hasGst: inv.gstRate.toNumber() > 0,
          link: base ? `${base}/invoices/${inv.paymentId}` : null,
        }),
      }),
    ]);
  } catch (e) {
    console.error('[notify] invoice', (e as Error).message);
  }
}
