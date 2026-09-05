import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { Auth, authInterceptor, authGuard, globalGuard } from '@cinema/core';
import { Shell, Login, Forbidden } from './shell';
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => inject(Auth).init()),
    provideRouter([
      { path: 'login', component: Login },
      {
        path: '',
        component: Shell,
        canActivate: [authGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../../../../libs/feature/src/dashboard').then((m) => m.DashboardPage),
          },
          {
            path: 'analytics',
            loadComponent: () =>
              import('../../../../libs/feature/src/dashboard').then((m) => m.DashboardPage),
          },
          {
            path: 'feedback',
            loadComponent: () =>
              import('../../../../libs/feature/src/feedback').then((m) => m.FeedbackList),
          },
          {
            path: 'staff',
            loadComponent: () =>
              import('../../../../libs/feature/src/staff').then((m) => m.StaffPage),
          },
          {
            path: 'staff/import',
            loadComponent: () =>
              import('../../../../libs/feature/src/import').then((m) => m.ImportPage),
          },
          {
            path: 'staff/:id/performance',
            loadComponent: () =>
              import('../../../../libs/feature/src/dashboard').then((m) => m.DashboardPage),
          },
          {
            path: 'qr',
            loadComponent: () => import('../../../../libs/feature/src/qr').then((m) => m.QRPage),
          },
          {
            path: 'ranking/:kind',
            loadComponent: () =>
              import('../../../../libs/feature/src/ranking').then((m) => m.RankingPage),
          },
          {
            path: 'coaching',
            loadComponent: () =>
              import('../../../../libs/feature/src/coaching').then((m) => m.CoachingPage),
          },
          {
            path: 'rating',
            canActivate: [globalGuard],
            loadComponent: () =>
              import('../../../../libs/feature/src/config').then((m) => m.RatingPage),
          },
          {
            path: 'reasons',
            canActivate: [globalGuard],
            loadComponent: () =>
              import('../../../../libs/feature/src/config').then((m) => m.ReasonPage),
          },
          {
            path: 'cinemas',
            canActivate: [globalGuard],
            loadComponent: () =>
              import('../../../../libs/feature/src/administration').then((m) => m.CinemaPage),
          },
          {
            path: 'users',
            canActivate: [
              () =>
                inject(Auth).user()?.role === 'SYSTEM_ADMIN'
                  ? true
                  : inject(Router).createUrlTree(['/forbidden']),
            ],
            loadComponent: () =>
              import('../../../../libs/feature/src/users').then((m) => m.UsersPage),
          },
          {
            path: 'audit',
            loadComponent: () =>
              import('../../../../libs/feature/src/administration').then((m) => m.AuditPage),
          },
          { path: 'forbidden', component: Forbidden },
          { path: '**', redirectTo: '' },
        ],
      },
    ]),
  ],
};
