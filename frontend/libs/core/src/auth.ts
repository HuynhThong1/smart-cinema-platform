import { Injectable, inject, signal } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { from, switchMap } from 'rxjs';
import Keycloak from 'keycloak-js';
import { Api, API_URL, AUTH_CONFIG } from './api';
import { Principal } from './models';
@Injectable({ providedIn: 'root' })
export class Auth {
  private config = inject(AUTH_CONFIG);
  private api = inject(Api);
  private keycloak = new Keycloak(this.config);
  user = signal<Principal | null>(null);
  failed = signal(false);
  async init() {
    try {
      const authenticated = await this.keycloak.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        responseMode: 'query',
      });
      if (authenticated) this.user.set(await this.api.get<Principal>('/admin/me'));
      this.keycloak.onAuthLogout = () => this.user.set(null);
      this.keycloak.onTokenExpired = () => {
        void this.token().catch(() => this.user.set(null));
      };
    } catch {
      this.failed.set(true);
      this.user.set(null);
    }
  }
  async token() {
    if (!this.keycloak.authenticated) return '';
    try {
      await this.keycloak.updateToken(30);
      return this.keycloak.token || '';
    } catch (e) {
      this.user.set(null);
      throw e;
    }
  }
  login() {
    return this.keycloak.login({ redirectUri: window.location.origin + '/' });
  }
  logout() {
    return this.keycloak.logout({
      redirectUri: window.location.origin + '/login',
    });
  }
  account() {
    return this.keycloak.accountManagement();
  }
  global() {
    return this.user()?.role !== 'CINEMA_MANAGER';
  }
}
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(API_URL);
  if (!req.url.startsWith(`${apiUrl}/admin`)) return next(req);
  return from(inject(Auth).token()).pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
  );
};
export const authGuard: CanActivateFn = () =>
  inject(Auth).user() ? true : inject(Router).createUrlTree(['/login']);
export const globalGuard: CanActivateFn = () =>
  inject(Auth).global() ? true : inject(Router).createUrlTree(['/forbidden']);
