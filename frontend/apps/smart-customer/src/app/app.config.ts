import { provideCinemaUI } from '@cinema/ui';
import { provideCinemaI18n } from '@cinema/i18n';
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { FeedbackPage, feedbackResolver } from './feedback';
export const appConfig: ApplicationConfig = {
  providers: [
    provideCinemaUI(),
    ...provideCinemaI18n(),
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    provideRouter([
      {
        path: '',
        pathMatch: 'full',
        title: 'Galaxy Cinema · Khám phá rạp',
        loadComponent: () => import('./landing').then((m) => m.LandingPage),
      },
      {
        path: 'f/:qrToken',
        title: 'Galaxy Cinema · Đánh giá trải nghiệm',
        component: FeedbackPage,
        resolve: { initial: feedbackResolver },
      },
      { path: '**', component: FeedbackPage },
    ]),
  ],
};
