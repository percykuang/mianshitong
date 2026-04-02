import { expect, test } from '@playwright/test';
import {
  cleanupAdminTraceSession,
  loginAdmin,
  seedAdminTraceSession,
} from './support/admin-e2e-fixtures';

test('管理员可查看会话详情中的规划、执行、报告与知识检索 Trace', async ({ page }) => {
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
    await expect(reportCard).toContainText('最终总结');
    await expect(reportCard).toContainText('改进建议生成');
    await reportCard.getByText(/正确性 · 均分/).click();
    await expect(reportCard).toContainText('js_event_loop');

    const knowledgeCard = page.locator('.ant-card').filter({
      has: page.getByText('知识检索 Trace', { exact: true }),
    });
    await expect(knowledgeCard).toBeVisible();
    await expect(knowledgeCard).toContainText('技术问答');
    await expect(knowledgeCard).toContainText('强命中');
    await expect(knowledgeCard).toContainText('事件循环面试回答模板');
    await expect(knowledgeCard).toContainText('宏任务与微任务');
    await expect(knowledgeCard).toContainText('Promise、宏任务、微任务的执行顺序怎么回答更清楚？');

    const messageCard = page.locator('.ant-card').filter({
      has: page.getByText('对话记录', { exact: true }),
    });
    await expect(messageCard).toContainText('我知道 Promise。');
    await expect(messageCard).toContainText('调用栈清空后会先执行微任务再执行宏任务');
    await expect(messageCard).toContainText('我做过一个构建优化项目');
  } finally {
    await cleanupAdminTraceSession(fixture);
  }
});
