import crypto from 'crypto';
import type { ProvisionedService, ProvisionRequest, ProvisioningProvider } from './types';

/**
 * Default provider: provisioning is done by a person. The paid order stays
 * PENDING with a QUEUED job until an admin completes it through
 * POST /api/admin/subscriptions/[id]/provision.
 */
export const manualProvider: ProvisioningProvider = {
  name: 'manual',
  manual: true,
  async provision() {
    return null;
  },
};

function randomId(bytes = 4): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Development/demo provider. Creates NO real infrastructure.
 *  - IPs come from 203.0.113.0/24 (TEST-NET-3, RFC 5737), which is reserved
 *    for documentation and never routed — unlike random public addresses,
 *    which belong to real people.
 *  - No SSH credentials are returned, so CloudOps stays disabled.
 * Refused outright when NODE_ENV=production.
 */
export const mockProvider: ProvisioningProvider = {
  name: 'mock',
  manual: false,
  async provision(req: ProvisionRequest): Promise<ProvisionedService> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('The mock provisioning provider cannot be used in production');
    }
    const isEmail = req.category === 'EMAIL';
    const id = randomId();
    return {
      hostname: isEmail ? `mail-${id}.datavoult.io` : `srv-${id}.datavoult.io`,
      ipAddress: isEmail ? undefined : `203.0.113.${1 + (crypto.randomInt(0, 253))}`,
      region: req.region,
      config: isEmail
        ? { imapServer: 'imap.datavoult.io', smtpServer: 'smtp.datavoult.io', demo: true }
        : { os: 'Ubuntu 22.04 LTS', demo: true },
    };
  },
};
