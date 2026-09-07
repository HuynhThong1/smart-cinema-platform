import { test, expect } from '@playwright/test';

test('admin forms, pagination, import and QR use shared controls with stable API payloads', async ({
  page,
}) => {
  test.skip(
    !process.env['LIVE_LOCAL_ADMIN'],
    'Requires local Keycloak; all feature writes are mocked',
  );
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4200');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.locator('#username').fill('sysadmin');
  await page.locator('#password').fill('CinemaLocal2026!');
  await page.locator('#kc-login').click();
  await expect(page.locator('cinema-shell')).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  const staff = {
    id: 'ui-staff',
    staffCode: 'UI-001',
    name: 'Synthetic Staff',
    cinemaId: 'ui-cinema',
    managerId: '',
    status: 'ACTIVE',
    updatedAt: '2026-09-07T00:00:00Z',
  };
  const cinemas = [{ id: 'ui-cinema', code: 'UI', name: 'Synthetic Cinema', status: 'ACTIVE' }];
  const users: Record<string, unknown>[] = [];
  const writes: { method: string; path: string; body: any }[] = [];
  const coaching: Record<string, unknown>[] = [];
  const notification = {
    id: 'ui-notification',
    feedbackId: 'ui-feedback',
    staffName: 'Synthetic Staff',
    rating: 1,
    suspicious: false,
    createdAt: '2026-09-07T00:00:00Z',
    readAt: null as string | null,
  };
  let staffStatus = 200;
  let staffTotal = 21;
  await page.route('**/api/v1/admin/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/admin', '');
    const method = request.method();
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    const paged = (items: unknown[], total = items.length) => ({
      items,
      total,
      page: 1,
      pageSize: 20,
    });
    if (method !== 'GET') {
      const body = request.headers()['content-type']?.includes('application/json')
        ? request.postDataJSON()
        : request.postData();
      writes.push({ method, path, body });
      if (path === '/staff/import')
        return json({
          total: 1,
          valid: 0,
          invalid: 1,
          rows: [
            {
              row: 2,
              staffCode: '',
              name: 'Synthetic',
              cinemaCode: 'UI',
              managerUsername: '',
              error: 'private technical error',
              errorCode: 'IMPORT_STAFF_CODE',
            },
          ],
        });
      if (path === '/staff' || path === '/staff/ui-staff') {
        Object.assign(staff, body);
        return json(staff);
      }
      if (path === '/cinemas/ui-cinema') {
        Object.assign(cinemas[0], body);
        return json(cinemas[0]);
      }
      if (path === '/users' && method === 'POST') {
        users.push({ ...body, id: 'ui-user' });
        return json(users[0]);
      }
      if (path === '/users/ui-user' && method === 'PUT') {
        Object.assign(users[0], body);
        return json(users[0]);
      }
      if (path === '/users/ui-user' && method === 'DELETE') {
        users.length = 0;
        return json({});
      }
      if (path === '/coaching') {
        coaching.push({ ...body, id: 'ui-coaching' });
        return json(coaching[0]);
      }
      if (path === '/notifications/ui-notification/read') {
        notification.readAt = '2026-09-07T01:00:00Z';
        return json({});
      }
      if (path === '/staff/qr/batch') return json({ created: 1, existing: 0 });
      throw new Error('Unexpected write: ' + method + ' ' + path);
    }
    if (path === '/staff')
      return json(
        staffStatus === 200
          ? paged(staffTotal ? [staff] : [], staffTotal)
          : { code: 'FORBIDDEN', error: 'private technical error' },
        staffStatus,
      );
    if (path === '/cinemas') return json(paged(cinemas));
    if (path === '/coaching') return json(paged(coaching));
    if (path === '/notifications') return json(paged([notification]));
    if (path === '/notifications/unread-count') return json({ count: notification.readAt ? 0 : 1 });
    if (path === '/managers') return json([]);
    if (path === '/users') return json(paged(users));
    await route.fallback();
  });
  await page.goto('http://127.0.0.1:4200/staff');
  await expect(page.getByRole('cell', { name: 'UI-001', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('p-paginator .p-paginator-page-selected')).toHaveText('2');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.locator('input[name="name"]').fill('Preserved Name');
  await page
    .getByRole('button', { name: 'VI', exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(dialog.locator('input[name="name"]')).toHaveValue('Preserved Name');
  await page
    .getByRole('button', { name: 'EN', exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toHaveCount(0);
  expect(writes.at(-1)).toMatchObject({
    method: 'PUT',
    path: '/staff/ui-staff',
    body: { name: 'Preserved Name', cinemaId: 'ui-cinema', status: 'ACTIVE' },
  });
  await page.goto('http://127.0.0.1:4200/cinemas');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('input[name="name"]').fill('Updated Cinema');
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toHaveCount(0);
  expect(writes.at(-1)?.path).toBe('/cinemas/ui-cinema');
  await page.goto('http://127.0.0.1:4200/users');
  await page.locator('.page-title button').click();
  dialog = page.getByRole('dialog');
  for (const [name, value] of Object.entries({
    username: 'ui-test',
    firstName: 'Synthetic',
    email: 'synthetic@example.test',
    password: 'LocalOnlyTest123!',
  }))
    await dialog.locator(`input[name="${name}"]`).fill(value);
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toHaveCount(0);
  expect(writes.at(-1)).toMatchObject({
    method: 'POST',
    path: '/users',
    body: { role: 'CINEMA_MANAGER', cinemaId: 'ui-cinema', enabled: true },
  });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('dialog').locator('input[name="firstName"]').fill('Updated');
  await page.getByRole('dialog').locator('button[type="submit"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await expect.poll(() => users.length).toBe(0);
  await page.goto('http://127.0.0.1:4200/staff/import');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'synthetic.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Staff Code,Full Name,Cinema Code\n,Synthetic,UI'),
  });
  await expect(page.getByText('Staff code is missing or too long.', { exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('private technical error');
  await page.getByRole('button', { name: 'VI', exact: true }).click();
  await expect(page.getByText('Thiếu staff code hoặc mã quá dài', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.goto('http://127.0.0.1:4200/qr');
  await page.locator('.page-title button').click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(() => writes.at(-1)?.path).toBe('/staff/qr/batch');
  await page.goto('http://127.0.0.1:4200/coaching');
  await page.locator('.page-title button').click();
  dialog = page.getByRole('dialog');
  await dialog.locator('input[name="topic"]').fill('Synthetic coaching');
  await dialog.locator('textarea[name="action"]').fill('Practice customer service');
  await dialog.getByRole('button', { name: 'Choose date', exact: true }).click();
  await page.locator('.p-datepicker-day').filter({ hasText: /^15$/ }).first().click();
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toHaveCount(0);
  expect(writes.at(-1)).toMatchObject({
    path: '/coaching',
    body: { staffId: 'ui-staff', status: 'OPEN' },
  });
  expect(writes.at(-1)?.body.followUpDate).toMatch(/^\d{4}-\d{2}-15$/);
  await page.goto('http://127.0.0.1:4200/notifications');
  await page.getByRole('button', { name: 'Mark as read', exact: true }).click();
  await expect.poll(() => notification.readAt).not.toBeNull();
  await expect(page.locator('.notif-row')).toHaveClass(/read/);
  staffStatus = 403;
  await page.goto('http://127.0.0.1:4200/staff');
  await expect(page.locator('p-message')).toContainText('permission');
  await expect(page.locator('main')).not.toContainText('private technical error');
  staffStatus = 200;
  staffTotal = 0;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByText('No staff yet. Add staff or import a list.', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
