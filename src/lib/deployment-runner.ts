import { prisma } from './prisma';
import { runSsh, SshError, type SshTarget } from './ssh';
import { pinHostKeyIfUnset } from './deploy-access';
import { redact } from './deployment-utils';

const MAX_LOG_CHARS = 200_000;
const FLUSH_MS = 2000;
/**
 * Run a deploy script against the customer's server and record progress on the
 * Deployment row. Output is flushed every couple of seconds so the UI can show
 * live logs. Never throws — failures become status FAILED with a readable log.
 */
export async function runDeployment(opts: {
  deploymentId: string;
  serviceConfigId: string;
  target: SshTarget;
  script: string;
  secrets?: Array<string | undefined>;
}): Promise<void> {
  const { deploymentId, script, target } = opts;
  const secrets = opts.secrets ?? [];
  let buf = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    timer = null;
    try { await prisma.deployment.update({ where: { id: deploymentId }, data: { log: buf } }); } catch { /* best effort */ }
  };
  const onOutput = (chunk: string) => {
    buf = (buf + redact(chunk, secrets)).slice(-MAX_LOG_CHARS);
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  };

  let status: 'RUNNING' | 'FAILED' = 'FAILED';
  try {
    const result = await runSsh(target, script, { timeoutMs: 25 * 60_000, maxOutputBytes: 1024 * 1024, onOutput });
    await pinHostKeyIfUnset(opts.serviceConfigId, result.hostKeySha256).catch(() => {});
    if (result.code === 0 && result.stdout.includes('DEPLOY_OK')) {
      status = 'RUNNING';
    } else {
      buf += `\n[deployment failed — exit code ${result.code ?? 'unknown'}]\n`;
    }
  } catch (e) {
    const msg = e instanceof SshError ? e.message : 'Unexpected error while deploying';
    if (!(e instanceof SshError)) console.error('[deployment]', deploymentId, e);
    buf += `\n[deployment failed — ${redact(msg, secrets)}]\n`;
  }
  if (timer) clearTimeout(timer);
  try {
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status, log: buf, ...(status === 'RUNNING' ? { lastDeployedAt: new Date() } : {}) },
    });
  } catch (e) {
    console.error('[deployment] could not save final status', deploymentId, (e as Error).message);
  }
}
