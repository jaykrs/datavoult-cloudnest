import { describe, it, expect } from 'vitest';
import { serverDetailsSchema, mergeCredentials, authType, sshCommand, sshPortOf, normalizePrivateKey } from './server-details';
import { serverDetailsEmail } from './email-templates';

const KEY = '-----BEGIN OPENSSH PRIVATE KEY-----\nabc123\n-----END OPENSSH PRIVATE KEY-----';
const base = { hostname: 'srv-1.example.com', region: 'Mumbai', ipAddress: '203.0.113.10', credentials: { username: 'root', password: 'p@ss' } };

describe('serverDetailsSchema', () => {
  it('accepts valid details and defaults port and notify', () => {
    const v = serverDetailsSchema.parse(base);
    expect(v.sshPort).toBe(22);
    expect(v.notifyCustomer).toBe(true);
  });
  it('validates IPs (v4/v6), usernames, ports and host keys', () => {
    expect(serverDetailsSchema.safeParse({ ...base, ipAddress: '999.1.1.1' }).success).toBe(false);
    expect(serverDetailsSchema.safeParse({ ...base, ipAddress: '2001:db8::1' }).success).toBe(true);
    expect(serverDetailsSchema.safeParse({ ...base, credentials: { username: 'a b; rm', password: 'x' } }).success).toBe(false);
    expect(serverDetailsSchema.safeParse({ ...base, sshPort: 70000 }).success).toBe(false);
    expect(serverDetailsSchema.safeParse({ ...base, hostKeySha256: 'xyz' }).success).toBe(false);
    expect(serverDetailsSchema.parse({ ...base, ipAddress: '', domain: '' }).ipAddress).toBeUndefined();
  });
  it('only accepts something that looks like a private key', () => {
    expect(serverDetailsSchema.safeParse({ ...base, credentials: { username: 'root', privateKey: KEY } }).success).toBe(true);
    expect(serverDetailsSchema.safeParse({ ...base, credentials: { username: 'root', privateKey: 'hello world' } }).success).toBe(false);
    expect(serverDetailsSchema.safeParse({ ...base, credentials: { username: 'root', privateKey: KEY.replace(/\n/g, '\r\n') } }).success).toBe(true);
  });
});

describe('mergeCredentials', () => {
  const old = { username: 'root', password: 'old', privateKey: undefined };
  it('keeps the stored secret when none is supplied for the same user', () => {
    expect(mergeCredentials({ username: 'root' }, old)).toEqual({ username: 'root', password: 'old' });
  });
  it('requires a secret when the username changes or nothing is stored', () => {
    expect(mergeCredentials({ username: 'deploy' }, old)).toBe('MISSING_SECRET');
    expect(mergeCredentials({ username: 'root' }, null)).toBe('MISSING_SECRET');
  });
  it('replaces secrets and normalises keys', () => {
    expect(mergeCredentials({ username: 'root', password: 'new' }, old)).toEqual({ username: 'root', password: 'new' });
    const m = mergeCredentials({ username: 'root', privateKey: KEY.replace(/\n/g, '\r\n') }, null);
    expect(m).toEqual({ username: 'root', privateKey: normalizePrivateKey(KEY) });
    expect((m as { privateKey: string }).privateKey.endsWith('\n')).toBe(true);
  });
  it('leaves everything alone when no credentials are sent', () => {
    expect(mergeCredentials(undefined, old)).toBe(old);
    expect(mergeCredentials(undefined, null)).toBeUndefined();
  });
});

describe('helpers', () => {
  it('describes auth type and ssh command', () => {
    expect(authType({ username: 'a', password: 'x' })).toBe('password');
    expect(authType({ username: 'a', privateKey: 'k' })).toBe('key');
    expect(authType({ username: 'a', password: 'x', privateKey: 'k' })).toBe('both');
    expect(authType(null)).toBeNull();
    expect(sshCommand({ username: 'root', host: '1.2.3.4', port: 22 })).toBe('ssh root@1.2.3.4');
    expect(sshCommand({ username: 'root', host: '1.2.3.4', port: 2222, keyFile: 'k.pem' })).toBe('ssh -i k.pem -p 2222 root@1.2.3.4');
  });
  it('reads the ssh port defensively', () => {
    expect(sshPortOf({ sshPort: 2222 })).toBe(2222);
    expect(sshPortOf({ sshPort: 'x' })).toBe(22);
    expect(sshPortOf(null)).toBe(22);
  });
});

describe('serverDetailsEmail', () => {
  const info = { userName: 'Asha <b>', productName: 'VPS', planName: 'Pro', hostname: 'srv-1', ipAddress: '1.2.3.4', port: 22, username: 'root', password: 'p<w>&"', hasKey: false, sshCommand: 'ssh root@1.2.3.4' };
  it('includes the access details and escapes them in HTML', () => {
    const e = serverDetailsEmail(info);
    expect(e.text).toContain('IP address: 1.2.3.4');
    expect(e.text).toContain('Password: p<w>&"');
    expect(e.html).toContain('p&lt;w&gt;&amp;&quot;');
    expect(e.html).not.toContain('Asha <b>');
    expect(e.subject).not.toContain('p<w>');
  });
  it('mentions the attached key instead of printing it', () => {
    const e = serverDetailsEmail({ ...info, password: undefined, hasKey: true, keyFilename: 'srv-1.pem' });
    expect(e.text).toContain('attached as srv-1.pem');
    expect(e.text).not.toContain('Password:');
  });
});
