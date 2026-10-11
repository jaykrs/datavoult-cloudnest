import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildDeployScript } from './deploy-script';
import { parseRepoUrl } from './deploy-validation';

const repo = parseRepoUrl('https://github.com/acme/web-app.git', ['github.com'])!;

describe('buildDeployScript', () => {
  it('produces syntactically valid bash', () => {
    const { script } = buildDeployScript({ repo, branch: 'main', port: 3000, env: [], stamp: 1 });
    const r = spawnSync('bash', ['-n'], { input: script, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
  });

  it('names the app after the repo and port', () => {
    const out = buildDeployScript({ repo, branch: 'main', port: 4000, env: [], stamp: 7 });
    expect(out.pm2AppName).toBe('web-app-4000');
    expect(out.targetFolder).toBe('web-app-7');
  });
});

/**
 * Run the generated script for real, with fake git/node/npm/pm2 binaries that
 * record what they were called with. Proves hostile env values are written
 * literally to .env and never executed.
 */
describe('buildDeployScript — executed against stub binaries', () => {
  let home: string;
  let bin: string;
  let log: string;
  let sentinel: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-home-'));
    bin = path.join(home, 'stubs');
    log = path.join(home, 'calls.log');
    sentinel = path.join(home, 'PWNED');
    fs.mkdirSync(bin);

    const stub = (name: string, body: string) => {
      const p = path.join(bin, name);
      fs.writeFileSync(p, `#!/bin/bash\n${body}\n`, { mode: 0o755 });
    };
    // git clone ... -- <url> <target>: record args, create the target dir.
    stub('git', `echo "git $*" >> "${log}"; mkdir -p "\${@: -1}"`);
    stub('node', 'exit 0'); // "package.json has a build script"
    stub('npm', `echo "npm $*" >> "${log}"`);
    stub('pm2', `echo "pm2 $*" >> "${log}"; [ "$1" = "delete" ] && exit 1; exit 0`);
  });

  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  function run(script: string) {
    return spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, NODE_ENV: 'test' },
    });
  }

  it('writes hostile env values literally and executes nothing', () => {
    const env = [
      { key: 'PLAIN', value: 'hello' },
      { key: 'INJECT1', value: `$(touch ${sentinel})` },
      { key: 'INJECT2', value: `\`touch ${sentinel}\`` },
      { key: 'INJECT3', value: `'; touch ${sentinel}; '` },
      { key: 'QUOTES', value: `a"b'c\\d` },
    ];
    const { script, targetFolder } = buildDeployScript({ repo, branch: 'main', port: 3000, env, stamp: 99 });

    const r = run(script);
    expect(r.status, r.stderr).toBe(0);
    expect(fs.existsSync(sentinel)).toBe(false);

    const dotenv = fs.readFileSync(path.join(home, 'deployments', targetFolder, '.env'), 'utf8');
    expect(dotenv).toBe(env.map((e) => `${e.key}=${e.value}`).join('\n') + '\n');
    expect((fs.statSync(path.join(home, 'deployments', targetFolder, '.env')).mode & 0o777)).toBe(0o600);
  });

  it('clones with an options terminator, the exact branch, and starts the app on the port', () => {
    const { script } = buildDeployScript({ repo, branch: 'release/1.2', port: 8080, env: [], stamp: 5 });
    const r = run(script);
    expect(r.status, r.stderr).toBe(0);

    const calls = fs.readFileSync(log, 'utf8');
    expect(calls).toContain('git clone --depth 1 --branch release/1.2 -- https://github.com/acme/web-app.git');
    expect(calls).toContain('npm install');
    expect(calls).toContain('npm run build');
    expect(calls).toMatch(/pm2 start npm --name web-app-8080 --cwd .*web-app-8080-current -- start -- --port 8080/);
    expect(calls).toContain('pm2 save');
  });

  it('fails clearly when Node.js is missing', () => {
    // The script extends PATH with /usr/bin, where this machine may have a real
    // node, so simulate "not installed" by shadowing `command -v node`.
    const hideNode = `command() { if [ "$1" = "-v" ] && [ "$2" = "node" ]; then return 1; fi; builtin command "$@"; }\n`;
    const { script } = buildDeployScript({ repo, branch: 'main', port: 3000, env: [], stamp: 1 });
    const r = run(hideNode + script);
    expect(r.status).toBe(12);
    expect(r.stderr).toContain('Node.js is not installed');
    expect(fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '').not.toContain('git clone'); // nothing ran after the check
  });
});
