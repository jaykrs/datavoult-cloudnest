import { decryptJson } from './crypto';

interface Row {
  id: string; subscriptionId: string; appName: string; repoUrl: string; branch: string; port: number;
  mode: string; httpsMode: string; domain: string | null; envEnc: string | null; status: string;
  log?: string | null; lastDeployedAt: Date | null; createdAt: Date; updatedAt: Date;
}

export function envKeysOf(envEnc: string | null): string[] {
  if (!envEnc) return [];
  try { return decryptJson<{ key: string }[]>(envEnc).map((v) => v.key); } catch { return []; }
}

/** Where the app is reachable. */
export function publicUrl(d: Pick<Row, 'httpsMode' | 'domain'>, ip: string | null | undefined): string | null {
  const host = d.domain || ip;
  if (!host) return null;
  return `${d.httpsMode === 'NONE' ? 'http' : 'https'}://${host}`;
}

/** Client-safe shape: environment values are never returned, only their names. */
export function publicDeployment(d: Row, ip: string | null | undefined, withLog = false) {
  const { envEnc, log, ...rest } = d;
  return {
    ...rest,
    envKeys: envKeysOf(envEnc),
    url: publicUrl(d, ip),
    selfSigned: d.httpsMode === 'SELF_SIGNED',
    ...(withLog ? { log: log ?? '' } : {}),
  };
}
