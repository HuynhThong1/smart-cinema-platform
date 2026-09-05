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
}
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const id = error.error?.requestId || error.headers.get('X-Request-ID');
    const message =
      error.status === 401
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : error.status === 403
          ? 'Bạn không có quyền xem nội dung này.'
          : error.error?.error || 'Không tải được dữ liệu. Vui lòng thử lại.';
    return message + (id ? ` · Request ID: ${id}` : '');
  }
  return 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function localDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}
