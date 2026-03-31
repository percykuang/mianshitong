import { expect, test } from '@playwright/test';
import {
  cleanupAdminTraceSession,
  loginAdmin,
  seedAdminTraceSession,
} from './support/admin-e2e-fixtures';

test('管理员可查看知识检索概览页中的 summary 与 trace 记录', async ({ page }) => {
  const fixture = await seedAdminTraceSession();
  const keyword = encodeURIComponent('事件循环面试回答模板');

  try {
    await loginAdmin(page, {
      email: fixture.adminEmail,
      password: fixture.adminPassword,
    });

    await page.goto(`/knowledge-retrieval?keyword=${keyword}`);

    await expect(page).toHaveURL(/\/knowledge-retrieval/);
    await expect(page.getByRole('heading', { name: '知识检索' })).toBeVisible();
    await expect(page.getByText('Trace 总数')).toBeVisible();
    await expect(page.getByText('高频 Query')).toBeVisible();
    await expect(page.getByText('高频命中文档')).toBeVisible();
    const traceCard = page.locator('.ant-card').filter({
      has: page.getByText('知识检索记录', { exact: true }),
    });
    await expect(traceCard).toContainText('事件循环面试回答模板');
    await expect(traceCard).toContainText('Promise、宏任务、微任务的执行顺序怎么回答更清楚？');
    await expect(traceCard).toContainText('查看会话');
  } finally {
    await cleanupAdminTraceSession(fixture);
  }
});
