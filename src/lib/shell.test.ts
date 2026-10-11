import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { shellQuote } from './shell';

/** Ask a real shell to echo the quoted value back: it must equal the input exactly. */
function roundTrip(value: string): string {
  return execFileSync('bash', ['-c', `printf %s ${shellQuote(value)}`], { encoding: 'utf8' });
}

describe('shellQuote', () => {
  const hostile = [
    'plain',
    "it's",
    "'; touch /tmp/pwned; '",
    '$(touch /tmp/pwned)',
    '`touch /tmp/pwned`',
    '"; rm -rf / #',
    'a b\tc',
    '--flag',
    '$HOME ${PATH} !history',
    'multi\nline',
    '*?[]{}~',
    '',
  ];

  for (const value of hostile) {
    it(`passes ${JSON.stringify(value)} through the shell unchanged`, () => {
      expect(roundTrip(value)).toBe(value);
    });
  }

  it('rejects NUL bytes', () => {
    expect(() => shellQuote('a\0b')).toThrow();
  });
});
