export function translatedMessage(key: string, params: Record<string, unknown> = {}): string {
  return '@i18n:' + JSON.stringify({ key, params });
}
export type Language = 'vi' | 'en';
export function languageFromCookie(cookie: string): Language {
  return /(?:^|;\s*)cinema-language=en(?:;|$)/.test(cookie) ? 'en' : 'vi';
}
export function localizedLabel(value: { label: string; english?: string }, lang: Language): string {
  return lang === 'en' ? value.english?.trim() || value.label : value.label;
}
