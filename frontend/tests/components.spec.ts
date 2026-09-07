import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('http://127.0.0.1:4200/ui-showcase');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Component library' })).toBeVisible();
});
test('CVA propagates values, touched and disabled; default buttons do not submit', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Test');
  await page.getByRole('combobox', { name: 'Choice', exact: true }).click();
  await page.getByRole('option', { name: 'Second choice', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).click();
  await expect(page.getByTestId('touched')).toHaveText('true');
  await expect(page.getByTestId('form-value')).toContainText('"choice":"b"');
  await page.getByRole('checkbox', { name: 'Agree', exact: true }).check();
  await expect(page.getByTestId('form-value')).toContainText('"checked":true');
  await page.getByRole('button', { name: 'Toggle form', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Choice', exact: true })).toBeDisabled();
  await expect(page.getByTestId('submitted')).toHaveText('0');
  await page.getByRole('button', { name: 'Toggle form', exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByTestId('submitted')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Loading', exact: true })).toBeDisabled();
});
test('table selection, sorting and server page indices', async ({ page }) => {
  await page.locator('p-tableCheckbox input').first().check();
  await expect(page.getByTestId('selection')).toHaveText('1');
  await page.getByRole('columnheader', { name: 'Name' }).click();
  await expect(page.getByTestId('sort')).toHaveText('name');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByTestId('page')).toHaveText('2');
});
test('dialog preserves draft and blocks dismissal while saving', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open dialog', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Preserved');
  await page
    .getByRole('button', { name: 'VI', exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(dialog.locator('input')).toHaveValue('Preserved');
  await page
    .getByRole('button', { name: 'EN', exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await dialog.getByRole('button', { name: 'Toggle saving' }).click();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Preserved');
  await dialog.getByRole('button', { name: 'Toggle saving' }).click();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Open drawer', exact: true }).click();
  await expect(page.getByRole('complementary')).toBeVisible();
  await page
    .getByRole('complementary')
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open confirmation', exact: true }).click();
  await expect(page.getByText('Confirm the test action?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Confirmed', { exact: true })).toBeVisible();
});
