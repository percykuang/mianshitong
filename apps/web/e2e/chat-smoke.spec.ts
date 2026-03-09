import { expect, test } from '@playwright/test';
import { buildGuestSession, mockGuestStream, seedGuestSessions } from './support/chat-e2e-fixtures';

test('新建会话后发送预设消息会创建独立路由并完成回复', async ({ page }) => {
  await mockGuestStream(
    page,
    '当然可以，请把简历内容发给我，我会从项目亮点和量化结果开始帮你优化。',
  );
  await page.goto('/chat');

  await page.getByRole('button', { name: '可以帮我优化简历吗？' }).click();

  await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
  await expect(page.getByTestId('multimodal-input')).toHaveValue('');
  await expect(page.getByRole('main')).toContainText('可以帮我优化简历吗？');
  await expect(page.getByRole('main')).toContainText(
    '当然可以，请把简历内容发给我，我会从项目亮点和量化结果开始帮你优化。',
  );
  await expect(page.getByTestId('suggested-actions')).toHaveCount(0);
});

test('切换会话时应展示对应会话内容', async ({ page }) => {
  const firstAssistantContent = '先用 React Profiler 定位重渲染来源，再检查 key 和 memo 策略。';
  const secondAssistantContent = '可以，优先补齐业务结果、性能指标和技术决策三类信息。';
  const firstSession = buildGuestSession({
    id: '11111111111111111111111111111111',
    title: 'React 性能排查',
    createdAt: '2026-03-09T10:00:00.000Z',
    userContent: '帮我分析 React 列表卡顿问题',
    assistantContent: firstAssistantContent,
  });
  const secondSession = buildGuestSession({
    id: '22222222222222222222222222222222',
    title: '简历改写建议',
    createdAt: '2026-03-09T09:00:00.000Z',
    userContent: '请帮我优化前端简历',
    assistantContent: secondAssistantContent,
  });

  await seedGuestSessions(page, [firstSession, secondSession]);
  await page.goto(`/chat/${firstSession.id}`);

  await expect(page.getByRole('main')).toContainText(firstAssistantContent);
  await page.getByRole('button', { name: secondSession.title }).click();

  await expect(page).toHaveURL(new RegExp(`/chat/${secondSession.id}$`));
  await expect(page.getByRole('main')).toContainText(secondAssistantContent);
  await expect(page.getByRole('main')).not.toContainText(firstAssistantContent);
});

test('删除当前会话后应回到空聊天页', async ({ page }) => {
  const session = buildGuestSession({
    id: '33333333333333333333333333333333',
    title: '待删除会话',
    createdAt: '2026-03-09T08:00:00.000Z',
    userContent: '这条会话用于删除测试',
    assistantContent: '删除后页面应该回到新的聊天页。',
  });

  await seedGuestSessions(page, [session]);
  await page.goto(`/chat/${session.id}`);

  await page.getByRole('button', { name: session.title }).hover();
  await page.getByLabel('更多会话操作').click();
  await page
    .locator('[data-radix-popper-content-wrapper]')
    .getByRole('button', { name: '删除', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();

  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByText(session.title)).toHaveCount(0);
  await expect(page.getByText('新建一个会话后，你的聊天记录会展示在这里。')).toBeVisible();
});
