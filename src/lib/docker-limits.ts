/** Resource rules for Docker-hosting plans, derived from the plan's `limits` JSON (e.g. { containers: 5, ram: '2 GB' }). */

export interface DockerLimits {
  /** Max simultaneous containers (deployments); null = unlimited / unspecified. */
  maxContainers: number | null;
  /** Memory ceiling per container in MB; null = no cap. */
  memoryMb: number | null;
  /** CPU ceiling per container; null = no cap. */
  cpus: number | null;
}

/** "2 GB" → 2048, "512MB" → 512, "1.5 gb" → 1536, "Unlimited"/junk → null. */
export function parseMemoryMb(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(MB|MiB|GB|GiB|TB|TiB)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const mb = unit.startsWith('t') ? n * 1024 * 1024 : unit.startsWith('g') ? n * 1024 : n;
  return mb >= 64 ? Math.round(mb) : null; // Docker's minimum is 6 MB; below 64 is surely a typo
}

function parseCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) { const n = parseInt(value, 10); return n > 0 ? n : null; }
  return null;
}

export function parseDockerLimits(limits: unknown): DockerLimits {
  const l = (limits && typeof limits === 'object' ? limits : {}) as Record<string, unknown>;
  const cpu = typeof l.cpu === 'number' ? l.cpu : typeof l.cpus === 'number' ? l.cpus : parseFloat(String(l.cpu ?? l.cpus ?? ''));
  return {
    maxContainers: parseCount(l.containers),
    memoryMb: parseMemoryMb(l.ram ?? l.memory),
    cpus: Number.isFinite(cpu) && cpu > 0 && cpu <= 128 ? cpu : null,
  };
}

/** Extra deploy options that apply only to Docker-hosting services (not VPS). */
export function planDeployOptions(category: string, planLimits: unknown) {
  if (category !== 'DOCKER') return { requireDockerfile: false as const, limits: undefined, maxContainers: null as number | null };
  const l = parseDockerLimits(planLimits);
  return { requireDockerfile: true as const, limits: { memoryMb: l.memoryMb, cpus: l.cpus }, maxContainers: l.maxContainers };
}
