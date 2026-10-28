import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { parseMemoryMb, parseDockerLimits, planDeployOptions } from './docker-limits';
import { listDockerRepos, GithubError } from './github';
import { buildAppDeployScript } from './app-deploy-script';
import { parseRepoUrl } from './deploy-validation';

const bashOk = (script: string) => spawnSync('bash', ['-n'], { input: script }).status === 0;
const repo = parseRepoUrl('https://github.com/acme/api')!;
const base = { repo, appName: 'api-3000', branch: 'main', port: 3000, env: [], httpsMode: 'SELF_SIGNED' as const, stamp: 1700000000000 };

describe('docker plan limits', () => {
  it('parses memory sizes', () => {
    expect(parseMemoryMb('2 GB')).toBe(2048);
    expect(parseMemoryMb('512MB')).toBe(512);
    expect(parseMemoryMb('1.5 gb')).toBe(1536);
    expect(parseMemoryMb('32 GB')).toBe(32768);
    for (const bad of ['Unlimited', '', 'GB', '5', '10 PB', '1 MB', null, undefined, {}]) expect(parseMemoryMb(bad)).toBeNull();
  });
  it('reads the seeded plans', () => {
    expect(parseDockerLimits({ containers: 5, ram: '2 GB', storage: '10 GB', builds: 50 })).toEqual({ maxContainers: 5, memoryMb: 2048, cpus: null });
    expect(parseDockerLimits({ containers: 100, ram: '32 GB', builds: 'Unlimited' }).maxContainers).toBe(100);
    expect(parseDockerLimits({ containers: 'Unlimited' }).maxContainers).toBeNull();
    expect(parseDockerLimits(null)).toEqual({ maxContainers: null, memoryMb: null, cpus: null });
    expect(parseDockerLimits({ cpu: 2 }).cpus).toBe(2);
  });
  it('applies Docker-only rules only to Docker hosting', () => {
    expect(planDeployOptions('VPS', { containers: 1 })).toMatchObject({ requireDockerfile: false, maxContainers: null });
    expect(planDeployOptions('DOCKER', { containers: 5, ram: '2 GB' })).toMatchObject({ requireDockerfile: true, maxContainers: 5, limits: { memoryMb: 2048 } });
  });
});

describe('Docker-hosting deploy script', () => {
  const docker = { ...base, mode: 'DOCKER' as const, requireDockerfile: true, limits: { memoryMb: 2048, cpus: 1.5 } };
  it('is valid bash and refuses to generate a Dockerfile', () => {
    const { script } = buildAppDeployScript(docker);
    expect(bashOk(script)).toBe(true);
    expect(script).toContain('exit 17');
    expect(script).not.toContain('using a generated Node.js one');
  });
  it('caps memory, cpu and processes and binds to localhost', () => {
    const { script } = buildAppDeployScript(docker);
    expect(script).toContain('--memory 2048m --memory-swap 2048m');
    expect(script).toContain('--cpus 1.5');
    expect(script).toContain('--pids-limit 1024 --security-opt no-new-privileges');
    expect(script).toContain('127.0.0.1:3000:3000');
  });
  it('VPS Docker mode keeps the generated-Dockerfile fallback and has no caps', () => {
    const { script } = buildAppDeployScript({ ...base, mode: 'DOCKER' });
    expect(script).toContain('using a generated Node.js one');
    expect(script).not.toContain('--memory');
    expect(script).not.toContain('exit 17');
  });
  it('ignores non-numeric limits instead of injecting them', () => {
    const { script } = buildAppDeployScript({ ...docker, limits: { memoryMb: '1; rm -rf /' as unknown as number, cpus: NaN } });
    expect(script).not.toContain('rm -rf /');
    expect(script).not.toContain('--cpus');
    expect(bashOk(script)).toBe(true);
  });
});

const node = (over: Record<string, unknown> = {}) => ({
  nameWithOwner: 'me/app', url: 'https://github.com/me/app', isPrivate: false, description: null, pushedAt: '2026-10-01T00:00:00Z',
  defaultBranchRef: { name: 'main' }, dockerfile: { __typename: 'Blob' }, ...over,
});
const ok = (nodes: unknown[]) => vi.fn(async () => new Response(JSON.stringify({ data: { viewer: { login: 'me', repositories: { nodes } } } }), { status: 200 })) as unknown as typeof fetch;

describe('listDockerRepos', () => {
  const token = 'github_pat_abcdefgh12345678';
  it('returns only repositories that have a Dockerfile', async () => {
    const r = await listDockerRepos(token, ok([node(), node({ nameWithOwner: 'me/plain', url: 'https://github.com/me/plain', dockerfile: null }), null]));
    expect(r.scanned).toBe(2);
    expect(r.repos.map((x) => x.fullName)).toEqual(['me/app']);
    expect(r.repos[0]).toMatchObject({ cloneUrl: 'https://github.com/me/app', defaultBranch: 'main', private: false });
  });
  it('falls back to main and ignores non-github URLs', async () => {
    const r = await listDockerRepos(token, ok([node({ defaultBranchRef: null }), node({ url: 'https://evil.example/me/app' })]));
    expect(r.repos).toHaveLength(1);
    expect(r.repos[0].defaultBranch).toBe('main');
  });
  it('sends the token as a bearer header only', async () => {
    const f = ok([]);
    await listDockerRepos(token, f);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe('https://api.github.com/graphql');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
    expect(String(init.body)).not.toContain(token);
  });
  it('maps failures to clear errors', async () => {
    const status = (n: number) => vi.fn(async () => new Response('{}', { status: n })) as unknown as typeof fetch;
    await expect(listDockerRepos(token, status(401))).rejects.toMatchObject({ kind: 'BAD_TOKEN' });
    await expect(listDockerRepos(token, status(403))).rejects.toMatchObject({ kind: 'RATE_LIMIT' });
    await expect(listDockerRepos(token, status(500))).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
    await expect(listDockerRepos(token, vi.fn(async () => { throw new Error('net'); }) as unknown as typeof fetch)).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
    await expect(listDockerRepos(token, vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: 'Bad credentials' }] }), { status: 200 })) as unknown as typeof fetch)).rejects.toBeInstanceOf(GithubError);
  });
  it('rejects malformed tokens without calling GitHub', async () => {
    const f = ok([]);
    await expect(listDockerRepos("bad token'; rm", f)).rejects.toMatchObject({ kind: 'BAD_TOKEN' });
    expect(f).not.toHaveBeenCalled();
  });
});
