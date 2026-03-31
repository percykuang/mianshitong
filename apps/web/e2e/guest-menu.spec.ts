import { expect, test } from '@playwright/test';

test('访客菜单应展示中文入口项', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('user-nav-button')).toContainText('访客');
  await page.getByTestId('user-nav-button').click();

  const menu = page.getByTestId('user-nav-menu');
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('user-nav-item-theme')).toBeVisible();
  await expect(page.getByTestId('user-nav-item-auth')).toHaveText('登录账户');
});
