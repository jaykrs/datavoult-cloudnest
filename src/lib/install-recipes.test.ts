import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { buildInstallCommand, isInstallable, INSTALLABLE_SOFTWARE } from './install-recipes';
import { SOFTWARE_OPTIONS } from '@/config/software';

describe('install recipes', () => {
  it('every installable key is offered in the UI and builds valid bash', () => {
    expect(INSTALLABLE_SOFTWARE.length).toBeGreaterThan(0);
    for (const key of INSTALLABLE_SOFTWARE) {
      expect(key in SOFTWARE_OPTIONS).toBe(true);
      const r = spawnSync('bash', ['-n'], { input: buildInstallCommand(key), encoding: 'utf8' });
      expect(r.status, `${key}: ${r.stderr}`).toBe(0);
    }
  });

  it('every software the UI offers can actually be installed', () => {
    for (const key of Object.keys(SOFTWARE_OPTIONS)) expect(isInstallable(key), key).toBe(true);
  });

  it('refuses anything that is not a known key (no way to inject a command)', () => {
    for (const bad of ['nginx; rm -rf /', '$(id)', '__proto__', 'constructor', 'toString', '', 'mongodb']) {
      expect(isInstallable(bad), bad).toBe(false);
      expect(() => buildInstallCommand(bad)).toThrow();
    }
  });

  it('uses sudo only for non-root and never prompts', () => {
    const cmd = buildInstallCommand('nginx');
    expect(cmd).toContain('sudo -n');
    expect(cmd).toContain('DEBIAN_FRONTEND=noninteractive');
    expect(cmd).toContain('apt-get install -y nginx');
  });
});
