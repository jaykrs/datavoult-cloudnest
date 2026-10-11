import { Client } from 'ssh2';
import { safeEqual } from './crypto';

export interface SshTarget {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  /** Hex SHA-256 of the expected host key. When set, a different key aborts the connection. */
  hostKeySha256?: string | null;
}

export interface SshResult {
  code: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  /** Host key fingerprint seen during this connection (hex SHA-256). */
  hostKeySha256: string;
}

export class SshError extends Error {
  constructor(
    public kind: 'HOST_KEY_MISMATCH' | 'CONNECT' | 'TIMEOUT' | 'EXEC',
    message: string,
  ) {
    super(message);
  }
}

export interface SshOptions {
  /** Overall wall-clock limit for connect + command. Default 10 minutes. */
  timeoutMs?: number;
  /** Max bytes kept per stream; the rest is dropped and `truncated` is set. Default 256 KiB. */
  maxOutputBytes?: number;
}

/**
 * Run one command over SSH and collect its output.
 *
 * Security properties:
 *  - the host key is verified against `hostKeySha256` when we have one;
 *  - credentials are passed in memory only (no key files read from this host);
 *  - output size and run time are bounded.
 */
export function runSsh(target: SshTarget, command: string, opts: SshOptions = {}): Promise<SshResult> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60_000;
  const maxBytes = opts.maxOutputBytes ?? 256 * 1024;

  return new Promise<SshResult>((resolve, reject) => {
    const conn = new Client();
    let observedHostKey = '';
    let mismatch = false;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
      conn.end();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new SshError('TIMEOUT', `SSH operation timed out after ${Math.round(timeoutMs / 1000)}s`)));
    }, timeoutMs);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) return finish(() => reject(new SshError('EXEC', err.message)));

        let stdout = '';
        let stderr = '';
        let truncated = false;
        const append = (current: string, chunk: Buffer) => {
          if (current.length >= maxBytes) { truncated = true; return current; }
          const next = current + chunk.toString('utf8');
          if (next.length > maxBytes) { truncated = true; return next.slice(0, maxBytes); }
          return next;
        };

        stream.on('data', (d: Buffer) => { stdout = append(stdout, d); });
        stream.stderr.on('data', (d: Buffer) => { stderr = append(stderr, d); });
        stream.on('close', (code: number | null) => {
          finish(() => resolve({ code, stdout, stderr, truncated, hostKeySha256: observedHostKey }));
        });
      });
    });

    conn.on('error', (err) => {
      finish(() => {
        if (mismatch) {
          reject(new SshError('HOST_KEY_MISMATCH', 'Server host key does not match the pinned key — refusing to connect'));
        } else {
          reject(new SshError('CONNECT', err.message));
        }
      });
    });

    try {
      conn.connect({
        host: target.host,
        port: target.port ?? 22,
        username: target.username,
        password: target.password,
        privateKey: target.privateKey,
        readyTimeout: 20_000,
        hostHash: 'sha256',
        hostVerifier: (fingerprint: string) => {
          observedHostKey = fingerprint.toLowerCase();
          if (target.hostKeySha256) {
            const ok = safeEqual(observedHostKey, target.hostKeySha256.toLowerCase());
            if (!ok) mismatch = true;
            return ok;
          }
          return true; // first contact: caller pins the observed key
        },
      });
    } catch (e) {
      finish(() => reject(new SshError('CONNECT', (e as Error).message)));
    }
  });
}
