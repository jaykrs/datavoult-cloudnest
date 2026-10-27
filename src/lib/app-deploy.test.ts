import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createDeploymentSchema, makeAppName, normalizeDomain, resolveHttpsMode, redeploySchema } from './app-deploy-validation';
import { buildAppDeployScript, buildTeardownScript, nginxConfig, envFileContent, pm2EcosystemContent, dockerfileContent } from './app-deploy-script';
import { parseRepoUrl } from './deploy-validation';
import { redact, isDeployInProgress, STALE_DEPLOY_MS } from './deployment-utils';
import { publicDeployment, publicUrl } from './deployment-serializer';

const repo = parseRepoUrl('https://github.com/acme/my-app.git')!;
const base = { repo, appName: 'my-app-3000', branch: 'main', port: 3000, env: [{ key: 'API_KEY', value: "it's a $ecret `x`" }], stamp: 1700000000000 };
const bashOk = (script: string) => spawnSync('bash', ['-n'], { input: script }).status === 0;

describe('validation', () => {
  const ok = { subscriptionId: 's1', repoUrl: 'https://github.com/a/b' };
  it('applies defaults', () => {
    const v = createDeploymentSchema.parse(ok);
    expect(v).toMatchObject({ branch: 'main', port: 3000, mode: 'PM2', env: [] });
  });
  it('rejects bad ports, PORT env and system ports', () => {
    expect(createDeploymentSchema.safeParse({ ...ok, port: 80 }).success).toBe(false);
    expect(createDeploymentSchema.safeParse({ ...ok, port: 3306 }).success).toBe(false);
    expect(createDeploymentSchema.safeParse({ ...ok, env: [{ key: 'port', value: '1' }] }).success).toBe(false);
    expect(createDeploymentSchema.safeParse({ ...ok, env: [{ key: 'A', value: 'x\ny' }] }).success).toBe(false);
  });
  it('validates domains and requires one for Let\'s Encrypt', () => {
    expect(normalizeDomain('App.Example.com')).toBe('app.example.com');
    for (const bad of ['1.2.3.4', 'http://a.com', 'a.com/x', '*.a.com', 'a b.com', 'a.com;rm -rf /']) expect(normalizeDomain(bad)).toBeNull();
    expect(createDeploymentSchema.safeParse({ ...ok, httpsMode: 'LETSENCRYPT' }).success).toBe(false);
    expect(createDeploymentSchema.safeParse({ ...ok, domain: 'bad domain' }).success).toBe(false);
    expect(createDeploymentSchema.safeParse({ ...ok, domain: 'a.example.com', httpsMode: 'LETSENCRYPT' }).success).toBe(true);
  });
  it('picks HTTPS automatically', () => {
    expect(resolveHttpsMode(undefined, 'a.example.com')).toBe('LETSENCRYPT');
    expect(resolveHttpsMode(undefined, undefined)).toBe('SELF_SIGNED');
    expect(resolveHttpsMode('NONE', 'a.example.com')).toBe('NONE');
  });
  it('checks token format and treats blanks as absent', () => {
    expect(createDeploymentSchema.safeParse({ ...ok, gitToken: 'ghp_abcdefgh1234' }).success).toBe(true);
    expect(createDeploymentSchema.safeParse({ ...ok, gitToken: "x'; rm -rf /" }).success).toBe(false);
    expect(createDeploymentSchema.parse({ ...ok, gitToken: '  ', domain: '' }).gitToken).toBeUndefined();
  });
  it('names apps safely', () => {
    expect(makeAppName('My_App.JS', 3000)).toBe('my-app-js-3000');
    expect(makeAppName('###', 4000)).toBe('app-4000');
  });
  it('redeploy only takes branch/env/token', () => {
    expect(redeploySchema.parse({ port: 1, mode: 'DOCKER' })).toEqual({});
  });
});

describe('deploy script', () => {
  const combos: Array<[string, 'PM2' | 'DOCKER', 'NONE' | 'SELF_SIGNED' | 'LETSENCRYPT', string | undefined, string | undefined]> = [
    ['pm2 http', 'PM2', 'NONE', undefined, undefined],
    ['pm2 self-signed ip', 'PM2', 'SELF_SIGNED', undefined, undefined],
    ['docker self-signed domain', 'DOCKER', 'SELF_SIGNED', 'app.example.com', undefined],
    ['docker letsencrypt + token', 'DOCKER', 'LETSENCRYPT', 'app.example.com', 'ghp_abcdefgh1234'],
    ['pm2 letsencrypt', 'PM2', 'LETSENCRYPT', 'app.example.com', undefined],
  ];
  for (const [name, mode, httpsMode, domain, gitToken] of combos) {
    it(`generates valid bash: ${name}`, () => {
      const { script } = buildAppDeployScript({ ...base, mode, httpsMode, domain, gitToken, email: 'me@x.io' });
      expect(bashOk(script)).toBe(true);
      expect(script).toContain('DEPLOY_OK');
    });
  }
  it('PM2 mode uses an ecosystem file; Docker binds to localhost only', () => {
    const pm2 = buildAppDeployScript({ ...base, mode: 'PM2', httpsMode: 'NONE' }).script;
    expect(pm2).toContain('pm2 start ecosystem.config.js');
    expect(pm2).not.toContain('docker');
    const dk = buildAppDeployScript({ ...base, mode: 'DOCKER', httpsMode: 'NONE' }).script;
    expect(dk).toContain('127.0.0.1:3000:3000');
    expect(dk).toContain('--restart unless-stopped');
  });
  it('never puts env values or the token in plain text, and does not store the token in git config', () => {
    const { script } = buildAppDeployScript({ ...base, mode: 'PM2', httpsMode: 'NONE', gitToken: 'ghp_abcdefgh1234' });
    expect(script).not.toContain("it's a");
    expect(script).not.toMatch(/\.git\/config/);
    expect(script).toContain('http.extraheader');
    expect(script).toContain('unset GIT_AUTH');
  });
  it('only requests certbot for Let\'s Encrypt, and never overwrites its nginx file on redeploy', () => {
    expect(buildAppDeployScript({ ...base, mode: 'PM2', httpsMode: 'SELF_SIGNED' }).script).not.toContain('certbot');
    const le = buildAppDeployScript({ ...base, mode: 'PM2', httpsMode: 'LETSENCRYPT', domain: 'a.example.com' }).script;
    expect(le).toContain('certbot --nginx');
    expect(le).toContain('[ -f /etc/nginx/conf.d/dv-my-app-3000.conf ] ||');
  });
  it('rejects unsafe names and stamps', () => {
    expect(() => buildAppDeployScript({ ...base, appName: 'x; rm -rf /', mode: 'PM2', httpsMode: 'NONE' })).toThrow();
    expect(() => buildAppDeployScript({ ...base, stamp: '1; id', mode: 'PM2', httpsMode: 'NONE' })).toThrow();
    expect(() => buildTeardownScript({ appName: '../x', mode: 'PM2' })).toThrow();
  });
  it('teardown script is valid bash for both modes', () => {
    expect(bashOk(buildTeardownScript({ appName: 'a-3000', mode: 'PM2', domain: 'a.example.com' }))).toBe(true);
    expect(bashOk(buildTeardownScript({ appName: 'a-3000', mode: 'DOCKER' }))).toBe(true);
  });
});

describe('generated files', () => {
  it('nginx proxies to the app on localhost and supports websockets', () => {
    const c = nginxConfig({ appName: 'a-3000', port: 3000, httpsMode: 'NONE' });
    expect(c).toContain('proxy_pass http://127.0.0.1:3000;');
    expect(c).toContain('listen 80 default_server');
    expect(c).toContain('Upgrade $http_upgrade');
  });
  it('self-signed config redirects 80 to 443 and serves TLS', () => {
    const c = nginxConfig({ appName: 'a-3000', port: 3000, httpsMode: 'SELF_SIGNED', domain: 'a.example.com' });
    expect(c).toContain('return 301 https://$host$request_uri;');
    expect(c).toContain('listen 443 ssl;');
    expect(c).toContain('server_name a.example.com;');
    expect(c).not.toContain('default_server');
  });
  it('env file forces PORT; ecosystem is JSON-escaped', () => {
    expect(envFileContent([{ key: 'A', value: '1' }, { key: 'port', value: '9' }], 3000)).toBe('A=1\nPORT=3000\n');
    const eco = pm2EcosystemContent({ appName: 'a-3000', port: 3000, env: [{ key: 'Q', value: 'a"b\\c' }] });
    expect(eco).toContain('"cwd": __dirname');
    expect(eco).toContain('"Q": "a\\"b\\\\c"');
    const mod = { exports: {} as { apps: { cwd: string; env: Record<string, string>; args: string }[] } };
    new Function('module', '__dirname', eco)(mod, '/srv/rel');
    expect(mod.exports.apps[0]).toMatchObject({ cwd: '/srv/rel', env: { Q: 'a"b\\c', PORT: '3000' }, args: 'start -- --port 3000' });
    expect(dockerfileContent(4000)).toContain('"--port", "4000"');
  });
});

describe('runner + serializer helpers', () => {
  it('redacts secrets', () => { expect(redact('token ghp_abcdefgh1234 x', ['ghp_abcdefgh1234', undefined])).toBe('token *** x'); });
  it('treats old DEPLOYING rows as stale', () => {
    const now = Date.now();
    expect(isDeployInProgress({ status: 'DEPLOYING', updatedAt: new Date(now - 1000) }, now)).toBe(true);
    expect(isDeployInProgress({ status: 'DEPLOYING', updatedAt: new Date(now - STALE_DEPLOY_MS - 1) }, now)).toBe(false);
    expect(isDeployInProgress({ status: 'RUNNING', updatedAt: new Date(now) }, now)).toBe(false);
  });
  it('builds public URLs and hides env values', () => {
    expect(publicUrl({ httpsMode: 'LETSENCRYPT', domain: 'a.example.com' }, '1.2.3.4')).toBe('https://a.example.com');
    expect(publicUrl({ httpsMode: 'SELF_SIGNED', domain: null }, '1.2.3.4')).toBe('https://1.2.3.4');
    expect(publicUrl({ httpsMode: 'NONE', domain: null }, '1.2.3.4')).toBe('http://1.2.3.4');
    const d = publicDeployment({
      id: '1', subscriptionId: 's', appName: 'a', repoUrl: 'u', branch: 'main', port: 3000, mode: 'PM2', httpsMode: 'NONE',
      domain: null, envEnc: 'garbage', status: 'RUNNING', log: 'secret log', lastDeployedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }, '1.2.3.4');
    expect(JSON.stringify(d)).not.toContain('garbage');
    expect(d).not.toHaveProperty('log');
  });
});
