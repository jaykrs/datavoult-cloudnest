import { describe, it, expect } from 'vitest';
import { parseRepoUrl, deployRequestSchema, logsQuerySchema } from './deploy-validation';

const HOSTS = ['github.com', 'gitlab.com'];

describe('parseRepoUrl', () => {
  it('accepts a public https repo on an allowed host and normalises it', () => {
    expect(parseRepoUrl('https://github.com/acme/web-app.git', HOSTS)).toEqual({
      cloneUrl: 'https://github.com/acme/web-app.git',
      repoName: 'web-app',
    });
    expect(parseRepoUrl('https://GitHub.com/acme/web-app?x=1#frag', HOSTS)?.cloneUrl).toBe(
      'https://github.com/acme/web-app',
    );
  });

  const rejected: [string, string][] = [
    ['http scheme', 'http://github.com/acme/app'],
    ['ssh scheme', 'ssh://git@github.com/acme/app'],
    ['scp-style', 'git@github.com:acme/app.git'],
    ['file scheme', 'file:///etc/passwd'],
    ['embedded credentials', 'https://user:pass@github.com/acme/app'],
    ['custom port', 'https://github.com:8443/acme/app'],
    ['host not on allowlist', 'https://evil.example.com/acme/app'],
    ['look-alike host', 'https://github.com.evil.example/acme/app'],
    ['shell metacharacters in path', 'https://github.com/acme/app;rm -rf'],
    ['command substitution in path', 'https://github.com/acme/$(id)'],
    ['leading dash repo name', 'https://github.com/acme/-evil'],
    ['not a URL', 'rm -rf /'],
    ['empty', ''],
  ];
  for (const [name, url] of rejected) {
    it(`rejects ${name}`, () => expect(parseRepoUrl(url, HOSTS)).toBeNull());
  }
});

describe('parseRepoUrl — dot segments', () => {
  // The URL parser resolves "..", so what reaches git is a plain path on the
  // allowed host. The property that matters: ".." never appears in the result.
  for (const url of [
    'https://github.com/acme/../../etc/app',
    'https://github.com/acme/%2e%2e/%2e%2e/etc/app',
    'https://github.com/acme/./app',
  ]) {
    it(`never passes ".." through: ${url}`, () => {
      const parsed = parseRepoUrl(url, HOSTS);
      if (parsed) {
        expect(parsed.cloneUrl).not.toContain('..');
        expect(parsed.cloneUrl.startsWith('https://github.com/')).toBe(true);
      }
    });
  }
});

describe('deployRequestSchema', () => {
  const base = { subscriptionId: 'sub_1', repoUrl: 'https://github.com/a/b' };

  it('applies defaults', () => {
    const r = deployRequestSchema.parse(base);
    expect(r).toMatchObject({ branch: 'main', port: 3000, env: [] });
  });

  it('accepts normal branches and env vars', () => {
    expect(
      deployRequestSchema.safeParse({
        ...base,
        branch: 'feature/new-ui_v2',
        port: 8080,
        env: [{ key: 'API_URL', value: 'https://x.test/?a=b&c=d' }],
      }).success,
    ).toBe(true);
  });

  const bad: [string, object][] = [
    ['branch starting with a dash (git option injection)', { branch: '--upload-pack=evil' }],
    ['branch with a space', { branch: 'a b' }],
    ['branch with shell chars', { branch: 'main;id' }],
    ['branch with ..', { branch: 'a..b' }],
    ['privileged port', { port: 22 }],
    ['port out of range', { port: 70000 }],
    ['non-integer port', { port: 80.5 }],
    ['env key with shell chars', { env: [{ key: 'A;B', value: 'x' }] }],
    ['env key starting with a digit', { env: [{ key: '1A', value: 'x' }] }],
    ['env value with newline', { env: [{ key: 'A', value: 'x\nEVIL=1' }] }],
    ['too many env vars', { env: Array.from({ length: 51 }, (_, i) => ({ key: `K${i}`, value: 'v' })) }],
  ];
  for (const [name, patch] of bad) {
    it(`rejects ${name}`, () => {
      expect(deployRequestSchema.safeParse({ ...base, ...patch }).success).toBe(false);
    });
  }
});

describe('logsQuerySchema', () => {
  it('accepts a normal request and clamps nothing silently', () => {
    expect(logsQuerySchema.parse({ subscriptionId: 's', pm2AppName: 'app-3000' })).toMatchObject({ type: 'out', lines: 100 });
    expect(logsQuerySchema.safeParse({ subscriptionId: 's', pm2AppName: 'app', lines: '9999' }).success).toBe(false);
  });
  it('rejects hostile app names and log types', () => {
    for (const pm2AppName of ['../../etc/passwd', 'a;b', 'a b', '$(id)', '-x']) {
      expect(logsQuerySchema.safeParse({ subscriptionId: 's', pm2AppName }).success).toBe(false);
    }
    expect(logsQuerySchema.safeParse({ subscriptionId: 's', pm2AppName: 'a', type: 'passwd' }).success).toBe(false);
  });
});
