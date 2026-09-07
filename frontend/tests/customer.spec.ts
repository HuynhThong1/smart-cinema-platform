import { test, expect } from '@playwright/test';
for (const width of [320, 390])
  test(`customer form preserves values across language and retry at ${width}px`, async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await request.get('http://127.0.0.1:4302/__test/reset');
    await page.setViewportSize({ width, height: 844 });
    await page.goto('http://127.0.0.1:4301/f/demo');
    await expect(page.locator('h1')).toHaveText('Đánh giá trải nghiệm');
    await page.locator('.rating-option').last().click();
    await page.locator('#full-name').fill('Customer Test');
    await page.locator('#phone').fill('0912345678');
    await page.locator('#comment').fill('retry-test');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.locator('#full-name')).toHaveValue('Customer Test');
    await expect(page.locator('.rating-option.selected')).toContainText('Delighted');
    await page.getByRole('button', { name: 'Friendly', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Lý do cũ', exact: true })).toBeVisible();
    await page.getByRole('checkbox').check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `../output/playwright/customer-form-en-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'SEND FEEDBACK', exact: true }).click();
    await expect(page.locator('.error-panel')).toBeVisible();
    await expect(page.locator('.error-panel')).not.toContainText('internal detail');
    await expect(page.locator('#full-name')).toHaveValue('Customer Test');
    await page.getByRole('button', { name: 'SEND FEEDBACK', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Thank you!');
    await page.getByRole('button', { name: 'Send another', exact: true }).click();
    await expect(page.locator('#full-name')).toHaveValue('');
    expect(errors).toEqual([]);
  });
test('SSR request locales stay isolated and survive hydration', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const responses = await Promise.all(
    ['en', 'vi', 'en', 'vi'].map((lang) =>
      request.get('http://127.0.0.1:4301/f/demo', {
        headers: { cookie: `cinema-language=${lang}` },
      }),
    ),
  );
  for (let i = 0; i < responses.length; i++)
    expect(await responses[i].text()).toContain(
      i % 2 === 0 ? 'Rate your experience' : 'Đánh giá trải nghiệm',
    );
  await page
    .context()
    .addCookies([{ name: 'cinema-language', value: 'en', url: 'http://127.0.0.1:4301' }]);
  await page.goto('http://127.0.0.1:4301/f/demo');
  await expect(page.locator('h1')).toHaveText('Rate your experience');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Rate your experience');
  expect(errors).toEqual([]);
});
