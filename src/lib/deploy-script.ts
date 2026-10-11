import { shellQuote } from './shell';
import type { ParsedRepo } from './deploy-validation';

export interface DeployScriptInput {
  repo: ParsedRepo;
  branch: string;
  port: number;
  env: { key: string; value: string }[];
  /** Unique per deploy, e.g. Date.now(). */
  stamp: number | string;
}

export interface DeployScript {
  script: string;
  pm2AppName: string;
  targetFolder: string;
}

/**
 * Build the remote deploy script. Every value that originates from a request
 * is either validated against a strict pattern beforehand AND passed through
 * shellQuote here; environment values are shipped base64-encoded so no
 * content of theirs is ever parsed by the shell.
 */
export function buildDeployScript(input: DeployScriptInput): DeployScript {
  const { repo, branch, port, env, stamp } = input;

  const pm2AppName = `${repo.repoName}-${port}`;
  const targetFolder = `${repo.repoName}-${stamp}`;
  const currentLink = `${repo.repoName}-${port}-current`;

  const envFile = env.map((v) => `${v.key}=${v.value}`).join('\n') + (env.length ? '\n' : '');
  const envB64 = Buffer.from(envFile, 'utf8').toString('base64');

  const script = [
    'set -e',
    'export PATH="$PATH:$HOME/.npm-global/bin:/usr/local/bin:/usr/bin"',
    'if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi',
    'command -v git  >/dev/null 2>&1 || { echo "git is not installed. Install it from CloudOps first." >&2; exit 12; }',
    'command -v node >/dev/null 2>&1 || { echo "Node.js is not installed. Install it from CloudOps first." >&2; exit 12; }',
    'if ! command -v pm2 >/dev/null 2>&1; then npm install -g pm2; fi',
    'DEPLOY_DIR="$HOME/deployments"',
    'mkdir -p "$DEPLOY_DIR"',
    `TARGET="$DEPLOY_DIR/"${shellQuote(targetFolder)}`,
    `git clone --depth 1 --branch ${shellQuote(branch)} -- ${shellQuote(repo.cloneUrl)} "$TARGET"`,
    'cd "$TARGET"',
    `printf %s ${shellQuote(envB64)} | base64 -d > .env`,
    'chmod 600 .env',
    'npm install',
    `if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)" 2>/dev/null; then`,
    '  npm run build',
    'else',
    '  echo "No build script found, skipping build step"',
    'fi',
    `ln -sfn "$TARGET" "$DEPLOY_DIR/"${shellQuote(currentLink)}`,
    // Delete + start (rather than restart) so PM2 re-resolves the symlink to the new release.
    `pm2 delete ${shellQuote(pm2AppName)} >/dev/null 2>&1 || true`,
    `PORT=${port} pm2 start npm --name ${shellQuote(pm2AppName)} --cwd "$DEPLOY_DIR/"${shellQuote(currentLink)} -- start -- --port ${port}`,
    'pm2 save',
  ].join('\n');

  return { script, pm2AppName, targetFolder };
}
