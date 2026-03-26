import { expect, test } from '@playwright/test';
import { createRemoteSession, openChat } from './support/chat-e2e-fixtures';

test('新建会话后发送预设消息会走真实流式接口并渲染 provider 输出', async ({ page }) => {
  await openChat(page);
  const prompt = '可以帮我优化简历吗？';
  const streamRequestPromise = page.waitForRequest((request) => {
    return (
      request.method() === 'POST' &&
      /\/api\/chat\/sessions\/[0-9a-f]{32}\/messages\/stream$/.test(new URL(request.url()).pathname)
    );
  });

  await page.getByRole('button', { name: prompt }).click();

  const streamRequest = await streamRequestPromise;
  expect(streamRequest.postDataJSON()).toMatchObject({
    content: prompt,
    modelId: 'deepseek-chat',
  });

  await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
  await expect(page.getByTestId('multimodal-input')).toHaveValue('');
  await expect(page.getByRole('main')).toContainText(prompt);
  await expect(page.getByRole('main')).toContainText(
    '[web-e2e] 已按真实模型链路处理：可以帮我优化简历吗？',
  );
  await expect(page.getByRole('main')).not.toContainText('不过，我还没有看到你的简历内容');
  await expect(page.getByTestId('suggested-actions')).toHaveCount(0);
});

test('切换会话时应展示对应会话内容', async ({ page }) => {
  const firstSession = await createRemoteSession(page, '帮我分析 React 列表卡顿问题');
  const secondSession = await createRemoteSession(page, '请帮我优化前端简历');

  await page.goto(`/chat/${firstSession.id}`);

  await expect(page.getByRole('main')).toContainText(firstSession.assistantContent);
  await page.getByRole('button', { name: secondSession.title }).click();

  await expect(page).toHaveURL(new RegExp(`/chat/${secondSession.id}$`));
  await expect(page.getByRole('main')).toContainText(secondSession.assistantContent);
  await expect(page.getByRole('main')).not.toContainText(firstSession.assistantContent);
});

test('删除当前会话后应回到空聊天页', async ({ page }) => {
  const session = await createRemoteSession(page, '这条会话用于删除测试');
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

test('消息复制应更新局部 copied 状态，不触发全局 toast', async ({ page }) => {
  const session = await createRemoteSession(page, '请帮我优化这段项目经历');
  await page.goto(`/chat/${session.id}`);

  const assistantCopy = page.getByTestId('assistant-message-copy');

  await expect(assistantCopy).toHaveAttribute('aria-label', '复制');
  await assistantCopy.click();
  await expect(assistantCopy).toHaveAttribute('data-copy-state', 'copied');
  await expect(assistantCopy).toHaveAttribute('aria-label', '已复制');
  await expect(page.getByText('Copied to clipboard!')).toHaveCount(0);
});

test('消息 like/dislike 应支持三态切换和填充图标', async ({ page }) => {
  const session = await createRemoteSession(page, '请帮我优化简历');
  await page.goto(`/chat/${session.id}`);

  const upvote = page.getByTestId('message-upvote');
  const downvote = page.getByTestId('message-downvote');

  await downvote.click();
  await expect(downvote).toBeEnabled();
  await expect(downvote).toHaveAttribute('aria-pressed', 'true');
  await expect(downvote).toHaveAttribute('data-icon-variant', 'fill');

  await downvote.click();
  await expect(downvote).toHaveAttribute('aria-pressed', 'false');
  await expect(downvote).toHaveAttribute('data-icon-variant', 'line');

  await upvote.click();
  await expect(upvote).toBeEnabled();
  await expect(upvote).toHaveAttribute('aria-pressed', 'true');
  await expect(upvote).toHaveAttribute('data-icon-variant', 'fill');
});
