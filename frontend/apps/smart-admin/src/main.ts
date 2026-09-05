import { bootstrapApplication } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import { API_URL, AUTH_CONFIG } from '@cinema/core';
import { App } from './app/app';
import { appConfig } from './app/app.config';
async function main() {
  const response = await fetch('/app-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load application configuration');
  const runtime: {
    apiUrl?: string;
    auth: { url: string; realm: string; clientId: string };
  } = await response.json();
  await bootstrapApplication(
    App,
    mergeApplicationConfig(appConfig, {
      providers: [
        { provide: AUTH_CONFIG, useValue: runtime.auth },
        { provide: API_URL, useValue: runtime.apiUrl || '/api/v1' },
      ],
    }),
  );
}
main().catch(() => {
  document.body.textContent = 'Không tải được cấu hình ứng dụng. Vui lòng thử lại.';
});
