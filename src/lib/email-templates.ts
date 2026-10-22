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
