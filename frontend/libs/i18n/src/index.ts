import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  Pipe,
  PipeTransform,
  PLATFORM_ID,
  REQUEST,
  inject,
  provideAppInitializer,
  signal,
} from '@angular/core';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { PrimeNG } from 'primeng/config';
import { vi, en } from './translations';

import { Language, languageFromCookie, localizedLabel } from './locale';
export * from './locale';
@Injectable({ providedIn: 'root' })
export class I18n {
  private document = inject(DOCUMENT);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));
  private request = inject(REQUEST, { optional: true });
  private translator = inject(TranslocoService);
  private prime = inject(PrimeNG);
  readonly language = signal<Language>(
    languageFromCookie(
      this.browser ? this.document.cookie : this.request?.headers.get('cookie') || '',
    ),
  );
  constructor() {
    this.translator.setTranslation(vi, 'vi');
    this.translator.setTranslation(en, 'en');
    this.apply();
  }
  private apply() {
    const lang = this.language();
    this.translator.setActiveLang(lang);
    this.document.documentElement.lang = lang;
    this.prime.setTranslation(this.translator.translateObject('common.prime', {}, lang));
  }
  setLanguage(lang: Language) {
    this.language.set(lang);
    this.apply();
    if (this.browser)
      this.document.cookie = `cinema-language=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  t(key: string, params: Record<string, unknown> = {}): string {
    this.language();
    if (!key) return '';
    if (key.startsWith('@i18n:')) {
      const value = JSON.parse(key.slice(6));
      const params = Object.fromEntries(
        Object.entries(value.params).map(([k, v]) => [
          k,
          typeof v === 'string' && v.startsWith('@i18n:') ? this.t(v) : v,
        ]),
      );
      return this.t(value.key, params);
    }
    const dictionary = this.language() === 'vi' ? vi : en;
    if (
      !key
        .split('.')
        .reduce<unknown>(
          (v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined),
          dictionary,
        )
    )
      return key;
    return this.translator.translate(key, params);
  }
  code(namespace: string, value: string) {
    const key = namespace + '.' + value;
    const text = this.t(key);
    return text === key ? value : text;
  }
  label(value: { label: string; english?: string }) {
    return localizedLabel(value, this.language());
  }
  date(value: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(this.language() === 'vi' ? 'vi-VN' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }
}
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18n);
  transform(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }
}
@Pipe({ name: 'cinemaNumber', pure: false })
export class CinemaNumberPipe implements PipeTransform {
  private i18n = inject(I18n);
  transform(value: number | null | undefined, digits = '1.0-3') {
    const [, min, max] = /\d+\.(\d+)-(\d+)/.exec(digits) || ['', '0', '3'];
    return value == null
      ? ''
      : new Intl.NumberFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-GB', {
          minimumFractionDigits: +min,
          maximumFractionDigits: +max,
        }).format(value);
  }
}
export function provideCinemaI18n() {
  return [
    provideTransloco({
      config: {
        availableLangs: ['vi', 'en'],
        defaultLang: 'vi',
        fallbackLang: 'vi',
        reRenderOnLangChange: true,
        prodMode: true,
      },
    }),
    provideAppInitializer(() => {
      inject(I18n);
    }),
  ];
}

export function startupError(cookie: string): string {
  return (languageFromCookie(cookie) === 'en' ? en : vi).common.errors.UNAVAILABLE;
}
