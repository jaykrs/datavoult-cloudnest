import { SOFTWARE_OPTIONS } from '@/config/software';

/**
 * What "install <software>" actually runs on a customer's server.
 * The command is built ONLY from these constants — no part of it comes from
 * the request, so there is nothing to inject into. The request merely picks a key.
 */
interface Recipe {
  apt?: string[];
  npmGlobal?: string[];
}

const RECIPES: Record<string, Recipe> = {
  nodejs:     { apt: ['nodejs', 'npm'] },
  python:     { apt: ['python3', 'python3-pip', 'python3-venv'] },
  java:       { apt: ['default-jdk'] },
  mysql:      { apt: ['mysql-server'] },
  postgresql: { apt: ['postgresql'] },
  redis:      { apt: ['redis-server'] },
  docker:     { apt: ['docker.io'] },
  nginx:      { apt: ['nginx'] },
  git:        { apt: ['git'] },
  pm2:        { npmGlobal: ['pm2'] },
};

export const INSTALLABLE_SOFTWARE = Object.keys(RECIPES).filter((k) => k in SOFTWARE_OPTIONS) as [string, ...string[]];

export function isInstallable(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(RECIPES, key);
}

export function buildInstallCommand(key: string): string {
  if (!isInstallable(key)) throw new Error(`Unsupported software: ${key}`);
  const { apt, npmGlobal } = RECIPES[key];

  const lines = [
    'set -e',
    'export DEBIAN_FRONTEND=noninteractive',
    'if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo -n"; fi',
  ];
  if (apt?.length) {
    lines.push('$SUDO apt-get update -y', `$SUDO apt-get install -y ${apt.join(' ')}`);
  }
  if (npmGlobal?.length) {
    lines.push(
      'command -v npm >/dev/null 2>&1 || { echo "npm is not installed. Install Node.js first." >&2; exit 12; }',
      `$SUDO npm install -g ${npmGlobal.join(' ')}`,
    );
  }
  return lines.join('\n');
}
