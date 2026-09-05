import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { inject, REQUEST_CONTEXT, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes, RenderMode } from '@angular/ssr';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { API_URL } from '@cinema/core';
const serverConfig = mergeApplicationConfig(appConfig, {
  providers: [
    provideHttpClient(
      withFetch(),
      withInterceptors([
        (req, next) => {
          const context = inject(REQUEST_CONTEXT, { optional: true }) as {
            clientIP?: string;
          } | null;
          return next(
            context?.clientIP
              ? req.clone({
                  setHeaders: { 'X-Forwarded-For': context.clientIP },
                })
              : req,
          );
        },
      ]),
    ),
    provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Server }])),
    {
      provide: API_URL,
      useFactory: () => (process.env['API_INTERNAL_URL'] || 'http://127.0.0.1:8080') + '/api/v1',
    },
  ],
});
export default (context: BootstrapContext) => bootstrapApplication(App, serverConfig, context);
