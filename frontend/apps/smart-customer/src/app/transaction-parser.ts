// Only explicit transaction formats are accepted. Never navigate to scanned URLs.
export const validTransaction = (value: string) => /^\d{6,10}\/\d{3,5}$/.test(value);
export function parseTransaction(raw: string): string | null {
  const value = raw.trim();
  if (validTransaction(value)) return value;
  // Observed Galaxy entry ticket: T001201313035 0002 -> 01313035/0002.
  // Keep the fixed terminal prefix separate; do not infer other opaque formats.
  const entry = /^T[0-9]{4}([0-9]{8}) ([0-9]{4})$/.exec(value);
  if (entry) return entry[1] + '/' + entry[2];
  try {
    const url = new URL(value, 'https://ticket.invalid');
    if (!['https:', 'http:'].includes(url.protocol) || !/^\/f\/[^/]+$/.test(url.pathname))
      return null;
    const ids = url.searchParams.getAll('tx');
    return ids.length === 1 && validTransaction(ids[0]) ? ids[0] : null;
  } catch {
    return null;
  }
}
