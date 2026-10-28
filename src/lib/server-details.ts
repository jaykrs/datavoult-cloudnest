import { isIP } from 'node:net';
import { z } from 'zod';

export interface StoredCredentials { username: string; password?: string; privateKey?: string }

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/** Normalise a pasted/uploaded private key: LF line endings, trimmed, trailing newline. */
export function normalizePrivateKey(key: string): string {
  return key.replace(/\r\n?/g, '\n').trim() + '\n';
}

const PRIVATE_KEY_PATTERN = /^-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]+-----END [A-Z0-9 ]*PRIVATE KEY-----$/;

export const serverDetailsSchema = z.object({
  hostname: z.string().trim().min(1, 'Hostname is required').max(253),
  ipAddress: z.preprocess(blank, z.string().trim().max(45).refine((v) => isIP(v) !== 0, 'Enter a valid IPv4 or IPv6 address').optional()),
  domain: z.preprocess(blank, z.string().trim().max(253).optional()),
  region: z.string().trim().min(1, 'Region is required').max(100),
  os: z.preprocess(blank, z.string().trim().max(100).optional()),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  /** Omit password and key on an update to keep the stored secrets. */
  credentials: z
    .object({
      username: z.string().trim().min(1, 'Username is required').max(64).regex(/^[A-Za-z0-9._@-]+$/, 'Username has invalid characters'),
      password: z.preprocess(blank, z.string().min(1).max(256).optional()),
      privateKey: z.preprocess(
        blank,
        z.string().max(16_384).refine((k) => PRIVATE_KEY_PATTERN.test(k.replace(/\r\n?/g, '\n').trim()), 'That does not look like a PEM/OpenSSH private key file').optional(),
      ),
    })
    .optional(),
  /** Hex SHA-256 of the server's SSH host key; pinned for future connections. */
  hostKeySha256: z.preprocess(blank, z.string().regex(/^[0-9a-fA-F]{64}$/, 'Expected 64 hex characters').optional()),
  notifyCustomer: z.boolean().default(true),
});

export type ServerDetailsInput = z.infer<typeof serverDetailsSchema>;

/**
 * Combine what the admin typed with what is already stored: a blank password/key on
 * an update keeps the existing secret (when the username is unchanged).
 */
export function mergeCredentials(
  incoming: ServerDetailsInput['credentials'],
  existing: StoredCredentials | null,
): StoredCredentials | undefined | 'MISSING_SECRET' {
  if (!incoming) return existing ?? undefined;
  const keepOld = existing && existing.username === incoming.username;
  const password = incoming.password ?? (keepOld ? existing.password : undefined);
  const privateKey = incoming.privateKey ? normalizePrivateKey(incoming.privateKey) : keepOld ? existing.privateKey : undefined;
  if (!password && !privateKey) return 'MISSING_SECRET';
  return { username: incoming.username, ...(password ? { password } : {}), ...(privateKey ? { privateKey } : {}) };
}

export function authType(c: StoredCredentials | null | undefined): 'password' | 'key' | 'both' | null {
  if (!c) return null;
  if (c.password && c.privateKey) return 'both';
  return c.privateKey ? 'key' : c.password ? 'password' : null;
}

export function sshCommand(opts: { username: string; host: string; port: number; keyFile?: string }): string {
  return `ssh ${opts.keyFile ? `-i ${opts.keyFile} ` : ''}${opts.port !== 22 ? `-p ${opts.port} ` : ''}${opts.username}@${opts.host}`;
}

export function sshPortOf(config: unknown): number {
  const p = (config as { sshPort?: unknown } | null | undefined)?.sshPort;
  return typeof p === 'number' && Number.isInteger(p) && p >= 1 && p <= 65535 ? p : 22;
}
