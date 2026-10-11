/**
 * Quote a value so a POSIX shell treats it as one literal word.
 * Everything that is not a hard-coded constant must go through this before
 * being interpolated into a remote command.
 */
export function shellQuote(value: string): string {
  if (value.includes('\0')) throw new Error('NUL byte in shell argument');
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
