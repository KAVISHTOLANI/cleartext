import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('review highlights, apply plain words, edit and copy', async ({ page }) => {
  await page.goto('./');
  await page.waitForTimeout(1000);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');
  await page.getByRole('link', { name: 'Check your text' }).first().click();
  await expect(page.locator('.hl mark').first()).toBeVisible();
  await page.locator('.hl mark.k-passive').first().click();
  await expect(page.locator('.findings li.is-active')).toContainText('Passive');
  await snap(page, 'editor');
  await checkMobile(page);
  const before = Number(await page.getByTestId('issues').textContent());
  await page.getByRole('button', { name: /Apply all \d+ simpler words/ }).click();
  await expect(page.getByTestId('issues')).not.toHaveText(String(before));
  await page.getByRole('radio', { name: 'Edit' }).click();
  await expect(page.getByLabel('Your text')).toHaveValue(/To continue borrowing/);
  await page.reload();
  await page.getByRole('radio', { name: 'Edit' }).click();
  await expect(page.getByLabel('Your text')).toHaveValue(/To continue borrowing/);
});
