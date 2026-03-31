import { expect, test } from '@playwright/test';

test('登录页应展示中文文案并可跳转到注册页', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: '登录' })).toBeVisible();
  await expect(page.getByText('使用邮箱和密码登录面试通')).toBeVisible();
  await expect(page.getByLabel('邮箱')).toHaveAttribute('placeholder', '请输入邮箱地址');
  await expect(page.getByLabel('密码')).toHaveAttribute('placeholder', '请输入密码');

  await page.getByRole('link', { name: '立即注册' }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test('注册页应展示中文文案并可跳转到登录页', async ({ page }) => {
  await page.goto('/register');

  await expect(page.getByRole('heading', { name: '注册' })).toBeVisible();
  await expect(page.getByText('使用邮箱和密码创建面试通账号')).toBeVisible();
  await expect(page.getByLabel('邮箱')).toHaveAttribute('placeholder', '请输入邮箱地址');
  await expect(page.getByLabel('密码')).toHaveAttribute('placeholder', '请设置登录密码');

  await page.getByRole('link', { name: '立即登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
