// Only explicit transaction formats are accepted. Never navigate to scanned URLs.
export const validTransaction = (value: string) =>
  value === value.trim() && /^[0-9]{6,10}\/[0-9]{3,5}$/.test(value);
export function parseTransaction(raw: string): string | null {
  if (raw.length > 64 || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  const value = raw.trim();
  if (validTransaction(value)) return value;
  // Observed Galaxy entry ticket: T001201313035 0002 -> 01313035/0002.
  // Keep the fixed terminal prefix separate; do not infer other opaque formats.
  const entry = /^T[0-9]{4}([0-9]{8}) ([0-9]{4})$/.exec(value);
  if (entry) return entry[1] + '/' + entry[2];
  return null;
}
