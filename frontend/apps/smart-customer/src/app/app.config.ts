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
        path: 'f/:qrToken',
        component: FeedbackPage,
        resolve: { initial: feedbackResolver },
      },
      { path: '**', component: FeedbackPage },
    ]),
  ],
};
