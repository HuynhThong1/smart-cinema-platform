import { test, expect } from '@playwright/test';
test('admin routes and runtime locale', async ({ page }) => {
  test.skip(!process.env['LIVE_LOCAL_ADMIN'], 'Requires the isolated local Keycloak/API fixtures');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4200');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.locator('#username').fill('sysadmin');
  await page.locator('#password').fill('CinemaLocal2026!');
  await page.locator('#kc-login').click();
  await expect(page.locator('cinema-shell')).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  for (const route of [
    'staff',
    'cinemas',
    'users',
    'feedback',
    'qr',
    'staff/import',
    'coaching',
    'dashboard',
    'analytics',
    'ranking/staff',
    'rating',
    'reasons',
    'notifications',
    'notification-rules',
    'audit',
  ]) {
    await page.goto('http://127.0.0.1:4200/' + route);
    await expect(page.locator('cinema-shell')).toBeVisible();
    await expect(page.locator('main h2').first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText(
      /(?:staff|admin|dashboard|config|modules|common)\.[a-z_]+/,
    );
  }
  await page.goto('http://127.0.0.1:4200/staff');
  await page.getByRole('button', { name: '+ Add staff' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Staff code *', { exact: true }).fill('UI-TEST');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: '../output/playwright/admin-en-1366.png', fullPage: true });
  await page.locator('details.account-menu summary').click();
  await page.getByRole('switch', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('details.account-menu summary').click();
  await page.screenshot({ path: '../output/playwright/admin-dark-en-1366.png', fullPage: true });
  await page.getByRole('button', { name: 'VI', exact: true }).click();
  await page.screenshot({ path: '../output/playwright/admin-dark-vi-1366.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('customer SSR locale and hydration', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const response = await request.get('http://127.0.0.1:4301/f/invalid', {
    headers: { cookie: 'cinema-language=en' },
  });
  expect(await response.text()).toContain('This QR code is currently unavailable');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4301/f/invalid');
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('This QR code is currently unavailable');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.screenshot({ path: '../output/playwright/customer-en-390.png', fullPage: true });
  expect(errors).toEqual([]);
});
