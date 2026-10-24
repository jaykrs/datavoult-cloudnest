/** Plain, dependency-free email templates. Every dynamic value is HTML-escaped. */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface Email { subject: string; text: string; html: string }

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
<h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h2>${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#71717a">DataVoult</p></div></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px;line-height:1.5">${s}</p>`;

export function welcomeEmail(name: string): Email {
  return {
    subject: 'Welcome to DataVoult',
    text: `Hi ${name},\n\nYour DataVoult account is ready. Browse our products and subscribe whenever you're ready.\n\n— DataVoult`,
    html: layout('Welcome to DataVoult', p(`Hi ${escapeHtml(name)},`) + p('Your account is ready. Browse our products and subscribe whenever you\'re ready.')),
  };
}

export function adminNewUserEmail(name: string, email: string): Email {
  return {
    subject: 'New user signup',
    text: `New signup:\nName: ${name}\nEmail: ${email}`,
    html: layout('New user signup', p(`<b>Name:</b> ${escapeHtml(name)}`) + p(`<b>Email:</b> ${escapeHtml(email)}`)),
  };
}

export interface OrderInfo {
  userName: string;
  userEmail: string;
  productName: string;
  planName: string;
  amount: string;
  subscriptionId: string;
}

export function orderConfirmationEmail(o: OrderInfo): Email {
  return {
    subject: `Subscription confirmed: ${o.productName}`,
    text: `Hi ${o.userName},\n\nThanks for subscribing to ${o.productName} (${o.planName}). Amount paid: ${o.amount}.\nReference: ${o.subscriptionId}\n\n— DataVoult`,
    html: layout(
      'Subscription confirmed',
      p(`Hi ${escapeHtml(o.userName)},`) +
        p(`Thanks for subscribing to <b>${escapeHtml(o.productName)}</b> (${escapeHtml(o.planName)}).`) +
        p(`Amount paid: ${escapeHtml(o.amount)}<br>Reference: ${escapeHtml(o.subscriptionId)}`),
    ),
  };
}

export function adminNewOrderEmail(o: OrderInfo): Email {
  return {
    subject: `New subscription: ${o.productName}`,
    text: `New subscription\nCustomer: ${o.userName} <${o.userEmail}>\nProduct: ${o.productName} (${o.planName})\nAmount: ${o.amount}\nReference: ${o.subscriptionId}`,
    html: layout(
      'New subscription',
      p(`<b>Customer:</b> ${escapeHtml(o.userName)} &lt;${escapeHtml(o.userEmail)}&gt;`) +
        p(`<b>Product:</b> ${escapeHtml(o.productName)} (${escapeHtml(o.planName)})`) +
        p(`<b>Amount:</b> ${escapeHtml(o.amount)}<br><b>Reference:</b> ${escapeHtml(o.subscriptionId)}`),
    ),
  };
}

export function adminContactEmail(c: { name: string; email: string; subject: string; message: string }): Email {
  return {
    subject: `Contact form: ${c.subject}`,
    text: `From: ${c.name} <${c.email}>\nSubject: ${c.subject}\n\n${c.message}`,
    html: layout(
      'New contact message',
      p(`<b>From:</b> ${escapeHtml(c.name)} &lt;${escapeHtml(c.email)}&gt;`) +
        p(`<b>Subject:</b> ${escapeHtml(c.subject)}`) +
        `<div style="white-space:pre-wrap;line-height:1.5;border-left:3px solid #e4e4e7;padding-left:12px">${escapeHtml(c.message)}</div>`,
    ),
  };
}

export interface ManualPaymentInfo {
  userName: string;
  userEmail: string;
  productName: string;
  planName: string;
  days: number;
  amount: string;
  reference: string;
  method: string;
  transactionRef?: string | null;
  reason?: string | null;
}

export function adminManualPaymentSubmittedEmail(m: ManualPaymentInfo): Email {
  return {
    subject: `Payment to verify: ${m.reference} (${m.amount})`,
    text: `A customer says they paid by ${m.method}.\nReference: ${m.reference}\nAmount: ${m.amount}\nUTR/ref: ${m.transactionRef ?? '-'}\nCustomer: ${m.userName} <${m.userEmail}>\nOrder: ${m.productName} (${m.planName}) for ${m.days} days\n\nCheck your bank statement, then approve or reject in Admin > Payment requests.`,
    html: layout(
      'Payment to verify',
      p(`<b>${escapeHtml(m.userName)}</b> &lt;${escapeHtml(m.userEmail)}&gt; says they paid by ${escapeHtml(m.method)}.`) +
        p(`<b>Reference:</b> ${escapeHtml(m.reference)}<br><b>Amount:</b> ${escapeHtml(m.amount)}<br><b>UTR / bank ref:</b> ${escapeHtml(m.transactionRef ?? '-')}`) +
        p(`<b>Order:</b> ${escapeHtml(m.productName)} (${escapeHtml(m.planName)}) for ${m.days} days`) +
        p('Check your bank statement, then approve or reject it in Admin &rarr; Payment requests.'),
    ),
  };
}

export function manualPaymentApprovedEmail(m: ManualPaymentInfo): Email {
  return {
    subject: `Payment received: ${m.productName}`,
    text: `Hi ${m.userName},\n\nWe received your payment of ${m.amount} (ref ${m.reference}). ${m.productName} (${m.planName}) is now active for ${m.days} days.\n\n— DataVoult`,
    html: layout(
      'Payment received',
      p(`Hi ${escapeHtml(m.userName)},`) +
        p(`We received your payment of <b>${escapeHtml(m.amount)}</b> (ref ${escapeHtml(m.reference)}).`) +
        p(`<b>${escapeHtml(m.productName)}</b> (${escapeHtml(m.planName)}) is now active for ${m.days} days.`),
    ),
  };
}

export function manualPaymentRejectedEmail(m: ManualPaymentInfo): Email {
  const reason = m.reason || 'We could not match the payment.';
  return {
    subject: `Payment could not be verified: ${m.reference}`,
    text: `Hi ${m.userName},\n\nWe could not verify your payment (ref ${m.reference}, ${m.amount}).\nReason: ${reason}\n\nIf you have paid, please reply or use the contact page with your transaction reference.\n\n— DataVoult`,
    html: layout(
      'Payment could not be verified',
      p(`Hi ${escapeHtml(m.userName)},`) +
        p(`We could not verify your payment (ref ${escapeHtml(m.reference)}, ${escapeHtml(m.amount)}).`) +
        p(`<b>Reason:</b> ${escapeHtml(reason)}`) +
        p('If you have paid, please contact us with your transaction reference.'),
    ),
  };
}

export function invoiceIssuedEmail(i: { userName: string; number: string; total: string; hasGst: boolean; link: string | null }): Email {
  const kind = i.hasGst ? 'tax invoice' : 'invoice';
  return {
    subject: `Your ${kind} ${i.number}`,
    text: `Hi ${i.userName},\n\nYour ${kind} ${i.number} for ${i.total} is ready.${i.link ? `\nView or print it: ${i.link}` : '\nYou can view and print it from Billing in your account.'}\n\n— DataVoult`,
    html: layout(
      i.hasGst ? 'Your tax invoice' : 'Your invoice',
      p(`Hi ${escapeHtml(i.userName)},`) +
        p(`Your ${kind} <b>${escapeHtml(i.number)}</b> for <b>${escapeHtml(i.total)}</b> is ready.`) +
        (i.link
          ? p(`<a href="${escapeHtml(i.link)}">View or print your invoice</a>`)
          : p('You can view and print it from Billing in your account.')),
    ),
  };
}
