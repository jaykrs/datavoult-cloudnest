import { describe, it, expect } from 'vitest';
import { escapeHtml, adminContactEmail, welcomeEmail, orderConfirmationEmail } from './email-templates';
import { stripNewlines } from './mailer';

describe('email templates', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe('&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;');
  });
  it('never lets user content inject markup', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const mail = adminContactEmail({ name: evil, email: 'a@b.co', subject: evil, message: evil });
    expect(mail.html).not.toContain('<img');
    expect(welcomeEmail(evil).html).not.toContain('<img');
    expect(orderConfirmationEmail({ userName: evil, userEmail: 'a@b.co', productName: evil, planName: evil, amount: '₹1', subscriptionId: evil }).html).not.toContain('<img');
  });
  it('strips newlines so subjects cannot inject headers', () => {
    expect(stripNewlines('Hi\r\nBcc: evil@x.com')).toBe('Hi Bcc: evil@x.com');
  });
});
