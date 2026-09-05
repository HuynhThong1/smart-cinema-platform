import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { FeedbackPage, feedbackResolver } from './feedback';
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    providePrimeNG({ unstyled: true }),
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
