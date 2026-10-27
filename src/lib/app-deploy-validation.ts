import { z } from 'zod';

/** Ports that must never be used for an app (system services / the proxy itself). */
export const RESERVED_PORTS = [3306, 5432, 6379, 8080, 27017];

const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Lower-cases and validates a hostname; returns null when it is not a plain DNS name (IPs, wildcards, URLs, etc.). */
export function normalizeDomain(input: string): string | null {
  const d = input.trim().toLowerCase();
  return DOMAIN_PATTERN.test(d) ? d : null;
}

/** Process / container / nginx file name: lower-case, [a-z0-9-], derived from repo name and port. */
export function makeAppName(repoName: string, port: number): string {
  const base = repoName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'app';
  return `${base}-${port}`;
}

const envVar = z.object({
  key: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/, 'Invalid environment variable name')
    .refine((k) => k.toUpperCase() !== 'PORT', 'PORT is set automatically from the port field'),
  value: z
    .string()
    .max(4096)
    .refine((v) => !/[\r\n\0]/.test(v), 'Environment values cannot contain line breaks'),
});

const blankToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const common = {
  branch: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,99}$/, 'Invalid branch name')
    .refine((b) => !b.includes('..'), 'Invalid branch name')
    .default('main'),
  port: z
    .number()
    .int()
    .min(1024, 'Port must be between 1024 and 65535')
    .max(65535, 'Port must be between 1024 and 65535')
    .refine((p) => !RESERVED_PORTS.includes(p), 'That port is reserved for system services')
    .default(3000),
  mode: z.enum(['PM2', 'DOCKER']).default('PM2'),
  httpsMode: z.enum(['NONE', 'SELF_SIGNED', 'LETSENCRYPT']).optional(),
  domain: z.preprocess(blankToUndef, z.string().max(253).optional()),
  env: z.array(envVar).max(50).default([]),
  /** Personal access token for a PRIVATE repo. Used for the clone only and never stored. */
  gitToken: z.preprocess(blankToUndef, z.string().regex(/^[A-Za-z0-9_.=-]{8,255}$/, 'Access token has an invalid format').optional()),
};

export const createDeploymentSchema = z
  .object({
    subscriptionId: z.string().min(1),
    repoUrl: z.string().min(1).max(500),
    ...common,
  })
  .superRefine((v, ctx) => {
    if (v.domain !== undefined && !normalizeDomain(v.domain)) {
      ctx.addIssue({ code: 'custom', path: ['domain'], message: 'Enter a valid domain name like app.example.com (no http://, paths or IP addresses)' });
    }
    if (v.httpsMode === 'LETSENCRYPT' && !v.domain) {
      ctx.addIssue({ code: 'custom', path: ['domain'], message: "A domain pointing at your server is required for Let's Encrypt certificates" });
    }
  });

export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;

/** HTTPS default: a trusted certificate when there is a domain, otherwise self-signed. */
export function resolveHttpsMode(requested: 'NONE' | 'SELF_SIGNED' | 'LETSENCRYPT' | undefined, domain: string | undefined) {
  return requested ?? (domain ? 'LETSENCRYPT' : 'SELF_SIGNED');
}

/** Redeploys may change branch/env/token only — port, mode, domain and HTTPS stay as deployed. */
export const redeploySchema = z.object({
  branch: common.branch.optional(),
  env: common.env.optional(),
  gitToken: common.gitToken,
});
