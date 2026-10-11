import { z } from 'zod';

/** Git hosts a customer may deploy from. Override with DEPLOY_ALLOWED_GIT_HOSTS (comma-separated). */
export function allowedGitHosts(): string[] {
  return (process.env.DEPLOY_ALLOWED_GIT_HOSTS || 'github.com,gitlab.com,bitbucket.org')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export interface ParsedRepo {
  /** Normalised clone URL: https, host from the allowlist, no credentials/query/fragment. */
  cloneUrl: string;
  /** Safe directory/app-name fragment derived from the repository name. */
  repoName: string;
}

/** Returns null when the URL is not an acceptable public https git URL. */
export function parseRepoUrl(input: string, hosts: string[] = allowedGitHosts()): ParsedRepo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password || url.port) return null;
  if (!hosts.includes(url.hostname.toLowerCase())) return null;
  if (!/^\/[A-Za-z0-9._~\/-]{1,200}$/.test(url.pathname) || url.pathname.includes('..')) return null;

  const last = url.pathname.replace(/\/+$/, '').split('/').pop() || '';
  const repoName = last.replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repoName)) return null;

  return { cloneUrl: `https://${url.hostname.toLowerCase()}${url.pathname}`, repoName };
}

const envVar = z.object({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/, 'Invalid environment variable name'),
  value: z
    .string()
    .max(4096)
    .refine((v) => !/[\r\n\0]/.test(v), 'Environment values cannot contain line breaks'),
});

export const deployRequestSchema = z.object({
  subscriptionId: z.string().min(1),
  repoUrl: z.string().min(1).max(500),
  branch: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,99}$/, 'Invalid branch name')
    .refine((b) => !b.includes('..'), 'Invalid branch name')
    .default('main'),
  port: z.number().int().min(1024).max(65535).default(3000),
  env: z.array(envVar).max(50).default([]),
});

export type DeployRequest = z.infer<typeof deployRequestSchema>;

export const logsQuerySchema = z.object({
  subscriptionId: z.string().min(1),
  pm2AppName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/, 'Invalid app name'),
  type: z.enum(['out', 'error']).default('out'),
  lines: z.coerce.number().int().min(1).max(500).default(100),
});
