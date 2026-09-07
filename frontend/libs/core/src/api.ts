import { translatedMessage } from '@cinema/i18n';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { firstValueFrom } from 'rxjs';
export const API_URL = new InjectionToken<string>('API_URL', {
  factory: () => '/api/v1',
});
export const AUTH_CONFIG = new InjectionToken<{
  url: string;
  realm: string;
  clientId: string;
}>('AUTH_CONFIG', {
  factory: () => ({
    url: 'http://localhost:8081',
    realm: 'smart-cinema',
    clientId: 'smart-admin',
  }),
});
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private base = inject(API_URL);
  get<T>(path: string, params: Record<string, string | number | boolean> = {}) {
    return firstValueFrom(
      this.http.get<T>(this.base + path, {
        params: new HttpParams({ fromObject: params }),
      }),
    );
  }
  post<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.post<T>(this.base + path, body));
  }
  put<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.put<T>(this.base + path, body));
  }
  delete<T>(path: string) {
    return firstValueFrom(this.http.delete<T>(this.base + path));
  }
  blob(path: string, params: Record<string, string | number | boolean> = {}) {
    return firstValueFrom(
      this.http.get(this.base + path, {
        params: new HttpParams({ fromObject: params }),
        responseType: 'blob',
      }),
    );
  }
  /** Keeps Content-Disposition so the server stays the only source of filenames. */
  async namedBlob(path: string, params: Record<string, string | number | boolean> = {}) {
    const response = await firstValueFrom(
      this.http.get(this.base + path, {
        params: new HttpParams({ fromObject: params }),
        responseType: 'blob',
        observe: 'response',
      }),
    );
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    return { blob: response.body as Blob, name: match ? match[1] : 'download' };
  }
}
export function errorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'common.errors.UNKNOWN';
  const fallback: Record<number, string> = {
    400: 'VALIDATION',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'FILE_SIZE',
    422: 'VALIDATION',
    429: 'RATE_LIMITED',
    502: 'UNAVAILABLE',
    503: 'UNAVAILABLE',
    0: 'UNAVAILABLE',
  };
  const supported = new Set([
    'UNKNOWN',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'VALIDATION',
    'RATE_LIMITED',
    'UNAVAILABLE',
    'SELF_DELETE',
    'SELF_DEMOTE',
    'PASSWORD_SHORT',
    'EMAIL_INVALID',
    'ACTIVE_CINEMA',
    'MANAGER_INVALID',
    'CONFIG_STALE',
    'FEEDBACK_INVALID',
    'FILE_SIZE',
    'IMPORT_ROWS',
    'IMPORT_HEADERS',
    'COACHING_CLOSED',
    'COACHING_TRANSITION',
    'STAFF_INACTIVE',
    'SCOPE_TOO_LARGE',
    'ACCOUNT_UPDATE_UNCERTAIN',
    'ACCOUNT_DELETE_UNCERTAIN',
  ]);
  const code = supported.has(error.error?.code)
    ? error.error.code
    : fallback[error.status] || 'UNKNOWN';
  const message = 'common.errors.' + code;
  const id = error.error?.requestId || error.headers.get('X-Request-ID');
  return id
    ? translatedMessage('common.request_error', { message: translatedMessage(message), id })
    : message;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
