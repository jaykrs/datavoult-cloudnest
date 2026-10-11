export interface ProvisionRequest {
  subscriptionId: string;
  category: 'VPS' | 'DOCKER' | 'EMAIL';
  planName: string;
  /** The plan's `limits` JSON (cpu, ram, storage, mailboxes, ...). */
  planLimits: Record<string, unknown>;
  userEmail: string;
  region: string;
}

export interface ProvisionedService {
  hostname: string;
  ipAddress?: string;
  domain?: string;
  region: string;
  /** Non-secret facts shown to the customer (OS, IMAP/SMTP servers, ...). */
  config: Record<string, unknown>;
  /** Stored encrypted; never sent to the browser. Required for CloudOps on VPS products. */
  credentials?: { username: string; password?: string; privateKey?: string };
  /** Hex SHA-256 of the server's SSH host key, when the provider knows it. */
  hostKeySha256?: string;
}

/**
 * A provisioning backend. To support a real cloud (Hetzner, DigitalOcean,
 * Proxmox, a mail server API, ...) implement this interface, register it in
 * `./index.ts`, and set PROVISIONING_PROVIDER.
 *
 * `provision` must be safe to retry: the queue re-runs failed jobs, so look
 * up by `subscriptionId` (e.g. a provider-side label) before creating a
 * second resource. Return `null` when provisioning is a human step.
 */
export interface ProvisioningProvider {
  readonly name: string;
  /** true = a person completes the job (admin UI); the queue never runs/retries it. */
  readonly manual: boolean;
  provision(req: ProvisionRequest): Promise<ProvisionedService | null>;
}
