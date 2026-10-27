import { shellQuote } from './shell';
import type { ParsedRepo } from './deploy-validation';

export interface AppDeployInput {
  repo: ParsedRepo;
  appName: string;
  branch: string;
  port: number;
  mode: 'PM2' | 'DOCKER';
  httpsMode: 'NONE' | 'SELF_SIGNED' | 'LETSENCRYPT';
  /** Validated DNS name, or undefined to answer on the server's IP. */
  domain?: string;
  /** Contact address for Let's Encrypt expiry notices. */
  email?: string;
  env: { key: string; value: string }[];
  gitToken?: string;
  /** Unique per deploy, e.g. Date.now(). */
  stamp: number | string;
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
/** Write a file whose content is shipped base64-encoded, so nothing in it is ever parsed by the shell. */
const writeFile = (target: string, content: string, sudo = false) =>
  `printf %s ${shellQuote(b64(content))} | base64 -d | ${sudo ? '$SUDO ' : ''}tee ${target} >/dev/null`;

const GIT_USER_BY_HOST: Record<string, string> = { 'gitlab.com': 'oauth2', 'bitbucket.org': 'x-token-auth' };

export function envFileContent(env: { key: string; value: string }[], port: number): string {
  return [...env.filter((v) => v.key.toUpperCase() !== 'PORT').map((v) => `${v.key}=${v.value}`), `PORT=${port}`].join('\n') + '\n';
}

export function pm2EcosystemContent(input: Pick<AppDeployInput, 'appName' | 'port' | 'env'>): string {
  const env: Record<string, string> = {};
  for (const v of input.env) if (v.key.toUpperCase() !== 'PORT') env[v.key] = v.value;
  env.PORT = String(input.port);
  return `module.exports = ${JSON.stringify({
    apps: [{ name: input.appName, cwd: '__DIRNAME__', script: 'npm', args: `start -- --port ${input.port}`, env }],
  }, null, 2).replace('"__DIRNAME__"', '__dirname')};\n`;
}

export function dockerfileContent(port: number): string {
  return [
    'FROM node:20-alpine',
    'WORKDIR /app',
    'COPY package*.json ./',
    'RUN npm install',
    'COPY . .',
    'RUN npm run build --if-present',
    'ENV NODE_ENV=production',
    `EXPOSE ${port}`,
    `CMD ["npm", "start", "--", "--port", "${port}"]`,
    '',
  ].join('\n');
}

export function nginxProxyBlock(port: number): string {
  return [
    '  location / {',
    `    proxy_pass http://127.0.0.1:${port};`,
    '    proxy_http_version 1.1;',
    '    proxy_set_header Host $host;',
    '    proxy_set_header X-Real-IP $remote_addr;',
    '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '    proxy_set_header X-Forwarded-Proto $scheme;',
    '    proxy_set_header Upgrade $http_upgrade;',
    '    proxy_set_header Connection "upgrade";',
    '    proxy_read_timeout 60s;',
    '    client_max_body_size 20m;',
    '  }',
  ].join('\n');
}

export function nginxConfig(input: Pick<AppDeployInput, 'appName' | 'port' | 'httpsMode' | 'domain'>): string {
  const name = input.domain ?? '_';
  const dflt = input.domain ? '' : ' default_server';
  const proxy = nginxProxyBlock(input.port);
  const http = (body: string) =>
    ['server {', `  listen 80${dflt};`, `  listen [::]:80${dflt};`, `  server_name ${name};`, body, '}'].join('\n');

  if (input.httpsMode === 'SELF_SIGNED') {
    return [
      http('  return 301 https://$host$request_uri;'),
      'server {',
      `  listen 443 ssl${dflt};`,
      `  listen [::]:443 ssl${dflt};`,
      `  server_name ${name};`,
      `  ssl_certificate /etc/ssl/dv/${input.appName}.crt;`,
      `  ssl_certificate_key /etc/ssl/dv/${input.appName}.key;`,
      '  ssl_protocols TLSv1.2 TLSv1.3;',
      proxy,
      '}',
      '',
    ].join('\n');
  }
  // NONE, and the starting point for LETSENCRYPT (certbot adds the 443 block + redirect).
  return http(proxy) + '\n';
}

const APP_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
function assertSafe(appName: string, stamp?: number | string) {
  if (!APP_NAME_PATTERN.test(appName)) throw new Error('Unsafe app name');
  if (stamp !== undefined && !/^\d{1,20}$/.test(String(stamp))) throw new Error('Unsafe release stamp');
}

/** Shared prelude: PATH, sudo detection, package helper. */
function prelude(): string[] {
  return [
    'set -e',
    'export PATH="$PATH:$HOME/.npm-global/bin:/usr/local/bin:/usr/bin"',
    'if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi',
    'export DEBIAN_FRONTEND=noninteractive',
    'if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo -n"; fi',
    'if [ -n "$SUDO" ] && ! $SUDO true 2>/dev/null; then echo "This step needs root or passwordless sudo on your server." >&2; exit 13; fi',
    'APT_UPDATED=0',
    'need_pkg() { if [ "$APT_UPDATED" = 0 ]; then $SUDO apt-get update -y >/dev/null; APT_UPDATED=1; fi; $SUDO apt-get install -y "$@"; }',
    'step() { echo "==> $1"; }',
  ];
}

export function buildAppDeployScript(input: AppDeployInput): { script: string; releaseDir: string } {
  const { repo, appName, branch, port, mode, httpsMode, domain, gitToken, stamp } = input;
  assertSafe(appName, stamp);
  const q = shellQuote;
  const appRoot = `$HOME/apps/${appName}`;
  const release = `${appRoot}/releases/${stamp}`;
  const email = input.email ?? 'admin@localhost';
  const gitUser = GIT_USER_BY_HOST[new URL(repo.cloneUrl).hostname] ?? 'x-access-token';
  const nginxConf = `/etc/nginx/conf.d/dv-${appName}.conf`;

  const L: string[] = [...prelude()];

  L.push('step "Checking server prerequisites"');
  L.push('command -v git  >/dev/null 2>&1 || need_pkg git');
  L.push('command -v curl >/dev/null 2>&1 || need_pkg curl');
  L.push('command -v nginx >/dev/null 2>&1 || need_pkg nginx');
  if (httpsMode === 'SELF_SIGNED') L.push('command -v openssl >/dev/null 2>&1 || need_pkg openssl');
  if (httpsMode === 'LETSENCRYPT') L.push('command -v certbot >/dev/null 2>&1 || need_pkg certbot python3-certbot-nginx');
  if (mode === 'DOCKER') {
    L.push('command -v docker >/dev/null 2>&1 || need_pkg docker.io');
    L.push('$SUDO systemctl enable --now docker >/dev/null 2>&1 || true');
    // Run docker through sudo when the user is not in the docker group.
    L.push('if docker info >/dev/null 2>&1; then DOCKER="docker"; else DOCKER="$SUDO docker"; fi');
  } else {
    L.push('command -v node >/dev/null 2>&1 || { echo "Node.js is not installed. Install it from CloudOps first." >&2; exit 12; }');
    L.push('node -e "process.exit(parseInt(process.versions.node) >= 18 ? 0 : 1)" || { echo "Node.js 18 or newer is required. Install a newer version from CloudOps first." >&2; exit 12; }');
    L.push('command -v pm2 >/dev/null 2>&1 || npm install -g pm2 || $SUDO npm install -g pm2');
  }

  L.push('step "Fetching code"');
  L.push(`mkdir -p ${appRoot}/releases`);
  if (gitToken) {
    L.push(`GIT_AUTH="$(printf %s ${q(`${gitUser}:${gitToken}`)} | base64 -w0)"`);
    L.push(`git -c "http.extraheader=Authorization: Basic $GIT_AUTH" clone --depth 1 --branch ${q(branch)} -- ${q(repo.cloneUrl)} ${release}`);
    L.push('unset GIT_AUTH');
  } else {
    L.push(`GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch ${q(branch)} -- ${q(repo.cloneUrl)} ${release}`);
  }
  L.push(`cd ${release}`);
  L.push(`${writeFile('.env', envFileContent(input.env, port))}`);
  L.push('chmod 600 .env');

  if (mode === 'DOCKER') {
    L.push('step "Building Docker image"');
    L.push(`if [ ! -f Dockerfile ]; then echo "No Dockerfile in the repository — using a generated Node.js one"; ${writeFile('Dockerfile', dockerfileContent(port))}; [ -f .dockerignore ] || printf 'node_modules\\n.git\\n.next\\n' > .dockerignore; fi`);
    L.push(`$DOCKER build --label dv.app=${q(appName)} -t ${q(`${appName}:${stamp}`)} .`);
    L.push('step "Starting container"');
    L.push(`$DOCKER rm -f ${q(appName)} >/dev/null 2>&1 || true`);
    L.push(`$DOCKER run -d --name ${q(appName)} --restart unless-stopped --env-file .env -p 127.0.0.1:${port}:${port} ${q(`${appName}:${stamp}`)}`);
    L.push(`$DOCKER image prune -f --filter ${q(`label=dv.app=${appName}`)} >/dev/null 2>&1 || true`);
  } else {
    L.push('step "Installing dependencies and building"');
    L.push('npm install');
    L.push(`if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)" 2>/dev/null; then npm run build; else echo "No build script found, skipping build step"; fi`);
    L.push(`${writeFile('ecosystem.config.js', pm2EcosystemContent({ appName, port, env: input.env }))}`);
    L.push('chmod 600 ecosystem.config.js');
    L.push(`ln -sfn ${release} ${appRoot}/current`);
    L.push('step "Starting application with PM2"');
    // Delete + start so PM2 picks up the new release folder.
    L.push(`pm2 delete ${q(appName)} >/dev/null 2>&1 || true`);
    L.push('pm2 start ecosystem.config.js');
    L.push('pm2 save');
    L.push('$SUDO env "PATH=$PATH" pm2 startup systemd -u "$(id -un)" --hp "$HOME" >/dev/null 2>&1 || true');
  }

  L.push(`step "Waiting for the app on port ${port}"`);
  L.push('ok=0');
  L.push(`for i in $(seq 1 30); do if curl -s -o /dev/null --max-time 3 http://127.0.0.1:${port}/; then ok=1; break; fi; sleep 2; done`);
  L.push('if [ "$ok" != 1 ]; then');
  L.push(`  echo "The app did not respond on port ${port} within 60 seconds. Recent output:" >&2`);
  L.push(mode === 'DOCKER' ? `  $DOCKER logs --tail 40 ${q(appName)} >&2 2>&1 || true` : `  pm2 logs ${q(appName)} --nostream --lines 40 >&2 2>&1 || true`);
  L.push('  exit 16');
  L.push('fi');

  L.push('step "Configuring nginx reverse proxy"');
  L.push('$SUDO systemctl enable --now nginx >/dev/null 2>&1 || true');
  if (!domain) L.push('$SUDO rm -f /etc/nginx/sites-enabled/default');
  if (httpsMode === 'SELF_SIGNED') {
    const cn = domain ?? '$(curl -s --max-time 5 https://api.ipify.org || hostname -I | cut -d" " -f1)';
    L.push('$SUDO mkdir -p /etc/ssl/dv');
    L.push(`if [ ! -f /etc/ssl/dv/${appName}.crt ]; then CN="${cn}"; [ -n "$CN" ] || CN=localhost; if echo "$CN" | grep -Eq '^[0-9.]+$'; then SAN="IP:$CN"; else SAN="DNS:$CN"; fi; $SUDO openssl req -x509 -nodes -newkey rsa:2048 -days 825 -subj "/CN=$CN" -addext "subjectAltName=$SAN" -keyout /etc/ssl/dv/${appName}.key -out /etc/ssl/dv/${appName}.crt >/dev/null 2>&1; $SUDO chmod 600 /etc/ssl/dv/${appName}.key; fi`);
  }
  const conf = nginxConfig({ appName, port, httpsMode, domain });
  // Let's Encrypt: certbot edits the file to add TLS, so never overwrite it on redeploy.
  const writeConf = writeFile(nginxConf, conf, true);
  L.push(httpsMode === 'LETSENCRYPT' ? `[ -f ${nginxConf} ] || { ${writeConf}; }` : writeConf);
  L.push(`if ! $SUDO nginx -t >/dev/null 2>&1; then $SUDO nginx -t >&2 || true; $SUDO rm -f ${nginxConf}; echo "nginx rejected the configuration (is another app already using this server name or the default site?)" >&2; exit 15; fi`);
  L.push('$SUDO systemctl reload nginx 2>/dev/null || $SUDO nginx -s reload');
  L.push('if command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then $SUDO ufw allow 80/tcp >/dev/null; $SUDO ufw allow 443/tcp >/dev/null; fi');

  if (httpsMode === 'LETSENCRYPT' && domain) {
    L.push('step "Requesting a Let\'s Encrypt certificate"');
    L.push(`$SUDO certbot --nginx -d ${q(domain)} --non-interactive --agree-tos -m ${q(email)} --redirect --keep-until-expiring || { echo "Could not get a certificate for ${domain}. Make sure its DNS A record points to this server and ports 80/443 are open, then redeploy. The app is still reachable over http." >&2; exit 14; }`);
  }

  L.push('step "Cleaning up old releases"');
  L.push(`ls -1dt ${appRoot}/releases/* 2>/dev/null | tail -n +4 | xargs -r rm -rf`);
  L.push(`echo "DEPLOY_OK ${stamp}"`);

  return { script: L.join('\n'), releaseDir: release };
}

/** Stop the app and remove its proxy config and files from the server. */
export function buildTeardownScript(input: { appName: string; mode: 'PM2' | 'DOCKER'; domain?: string | null }): string {
  assertSafe(input.appName);
  const q = shellQuote;
  const L = [...prelude()];
  if (input.mode === 'DOCKER') {
    L.push('if command -v docker >/dev/null 2>&1; then if docker info >/dev/null 2>&1; then DOCKER="docker"; else DOCKER="$SUDO docker"; fi;');
    L.push(`  $DOCKER rm -f ${q(input.appName)} >/dev/null 2>&1 || true`);
    L.push(`  $DOCKER image ls -q --filter ${q(`label=dv.app=${input.appName}`)} | xargs -r $DOCKER rmi -f >/dev/null 2>&1 || true`);
    L.push('fi');
  } else {
    L.push('if command -v pm2 >/dev/null 2>&1; then');
    L.push(`  pm2 delete ${q(input.appName)} >/dev/null 2>&1 || true`);
    L.push('  pm2 save >/dev/null 2>&1 || true');
    L.push('fi');
  }
  if (input.domain) L.push(`command -v certbot >/dev/null 2>&1 && $SUDO certbot delete --cert-name ${q(input.domain)} --non-interactive >/dev/null 2>&1 || true`);
  L.push(`$SUDO rm -f /etc/nginx/conf.d/dv-${input.appName}.conf /etc/ssl/dv/${input.appName}.crt /etc/ssl/dv/${input.appName}.key`);
  L.push('if command -v nginx >/dev/null 2>&1 && $SUDO nginx -t >/dev/null 2>&1; then $SUDO systemctl reload nginx 2>/dev/null || $SUDO nginx -s reload || true; fi');
  L.push(`rm -rf "$HOME/apps/"${q(input.appName)}`);
  L.push('echo "REMOVED"');
  return L.join('\n');
}
