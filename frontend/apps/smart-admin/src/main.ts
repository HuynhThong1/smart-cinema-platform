import { bootstrapApplication } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import { AUTH_CONFIG } from '@cinema/core';
import { App } from './app/app';
import { appConfig } from './app/app.config';
async function main() {
  const response = await fetch('/app-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load application configuration');
  const runtime = await response.json();
  await bootstrapApplication(
    App,
    mergeApplicationConfig(appConfig, {
      providers: [{ provide: AUTH_CONFIG, useValue: runtime.auth }],
    }),
  );
}
main().catch(() => {
  document.body.textContent = 'Không tải được cấu hình ứng dụng. Vui lòng thử lại.';
});
