import { expect, test } from '@playwright/test';
import {
  cleanupAdminTraceSession,
  loginAdmin,
  seedAdminTraceSession,
} from './support/admin-e2e-fixtures';

test('管理员可查看会话详情中的规划、执行与报告 Trace', async ({ page }) => {
  const fixture = await seedAdminTraceSession();

  try {
    await loginAdmin(page, {
      email: fixture.adminEmail,
      password: fixture.adminPassword,
    });

    await page.goto(`/sessions/${fixture.sessionId}`);

    await expect(page).toHaveURL(new RegExp(`/sessions/${fixture.sessionId}$`));
    await expect(page.getByRole('heading', { name: '会话详情' })).toBeVisible();

    const planningCard = page.locator('.ant-card').filter({
      has: page.getByText('面试规划 Trace', { exact: true }),
    });
    await expect(planningCard).toBeVisible();
    await expect(planningCard).toContainText('Hybrid Lexical');
    await expect(planningCard).toContainText('最终题单');
    await expect(planningCard).toContainText('事件循环与任务调度');

    const executionCard = page.locator('.ant-card').filter({
      has: page.getByText('面试执行 Trace', { exact: true }),
    });
    await expect(executionCard).toBeVisible();
    await executionCard.getByText('第 1 题 · 事件循环与任务调度').click();
    await expect(executionCard).toContainText('达到追问上限');
    await expect(executionCard).toContainText('Promise');
    await expect(executionCard).toContainText('宏任务');
    await expect(executionCard).toContainText('微任务');

    const reportCard = page.locator('.ant-card').filter({
      has: page.getByText('面试报告 Trace', { exact: true }),
    });
    await expect(reportCard).toBeVisible();
    await expect(reportCard).toContainText('合格');
    await expect(reportCard).toContainText('你的基础能力不错，建议继续加强工程化和取舍表达。');
    await expect(reportCard).toContainText('当前没有需要生成的改进建议。');
    await reportCard.getByText(/正确性 · 均分/).click();
    await expect(reportCard).toContainText('js_event_loop');

    const messageCard = page.locator('.ant-card').filter({
      has: page.getByText('对话记录', { exact: true }),
    });
    await expect(messageCard).toContainText('我知道 Promise。');
    await expect(messageCard).toContainText('调用栈清空后会先执行微任务再执行宏任务');
  } finally {
    await cleanupAdminTraceSession();
  }
});
