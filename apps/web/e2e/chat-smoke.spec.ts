import { expect, test } from '@playwright/test';
import {
  cleanupKnowledgeDocumentFixture,
  cleanupInterviewPlaybookKnowledgeDocumentFixture,
  cleanupResumeKnowledgeDocumentFixture,
  createRemoteConversationSession,
  createRemoteSession,
  openChat,
  seedKnowledgeDocumentFixture,
  seedInterviewPlaybookKnowledgeDocumentFixture,
  seedResumeKnowledgeDocumentFixture,
} from './support/chat-e2e-fixtures';

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

test('已有远端会话时停止生成仍应保留本轮用户消息', async ({ page }) => {
  const session = await createRemoteSession(page, '你好');
  const prompt = '第二条消息发送后立刻停止：请详细解释 React Fiber 的工作原理。';

  await page.goto(`/chat/${session.id}`);
  await page.getByTestId('multimodal-input').fill(prompt);
  await page.getByTestId('send-button').click();

  const stopButton = page.getByRole('button', { name: '停止生成' });
  await expect(stopButton).toBeVisible();
  await stopButton.click();

  await page.waitForTimeout(1200);
  await expect(page.getByRole('main')).toContainText(prompt);
  await expect(page.getByRole('main')).not.toContainText('思考中');
});

test('停止生成后应保留并持久化已输出的 assistant 部分内容', async ({ page }) => {
  await openChat(page);
  const prompt =
    '请非常详细地解释 React Fiber、调度优先级、可中断渲染、lane 模型，以及它们之间的关系，要求分很多段展开。';

  await page.getByTestId('multimodal-input').fill(prompt);
  await page.getByTestId('send-button').click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);

  const stopButton = page.getByRole('button', { name: '停止生成' });
  const latestAssistantMessage = page.locator('article').last();

  await expect(stopButton).toBeVisible();
  await expect(latestAssistantMessage).toContainText('[web-e2e]');
  await stopButton.click();

  await expect(latestAssistantMessage).toContainText('已停止生成');
  await expect(latestAssistantMessage).toContainText('[web-e2e]');

  await page.reload();

  const persistedAssistantMessage = page.locator('article').last();
  await expect(persistedAssistantMessage).toContainText('已停止生成');
  await expect(persistedAssistantMessage).toContainText('[web-e2e]');
});

test('只有最后一条用户消息显示编辑按钮', async ({ page }) => {
  const conversation = await createRemoteConversationSession(page, [
    { user: '第一条问题：解释闭包' },
    { user: '第二条问题：解释事件循环' },
    { user: '第三条问题：解释 React Fiber' },
  ]);

  await page.goto(`/chat/${conversation.id}`);

  const articles = page.locator('article');
  const firstUserArticle = articles.filter({ hasText: '第一条问题：解释闭包' }).first();
  const lastUserArticle = articles.filter({ hasText: '第三条问题：解释 React Fiber' }).first();
  await firstUserArticle.hover();
  await expect(firstUserArticle.getByLabel('编辑消息')).toHaveCount(0);

  await lastUserArticle.hover();
  await expect(lastUserArticle.getByLabel('编辑消息')).toBeVisible();
});

test('编辑最后一条用户消息后仍可正常重生成', async ({ page }) => {
  const conversation = await createRemoteConversationSession(page, [
    { user: '第一条原始问题：解释 React 协调过程' },
    { user: '最后一条原始问题：解释 diff 策略' },
  ]);

  await page.goto(`/chat/${conversation.id}`);

  const lastUserArticle = page
    .locator('article')
    .filter({ hasText: '最后一条原始问题：解释 diff 策略' })
    .first();
  await lastUserArticle.hover();
  await lastUserArticle.getByLabel('编辑消息').click();

  await page.locator('article textarea').fill('最后一条编辑后问题：重新解释 diff 策略，尽量详细');
  await page.getByRole('button', { name: '确定' }).click();

  await expect(page.getByRole('main')).toContainText('第一条原始问题：解释 React 协调过程');
  await expect(page.getByRole('main')).toContainText(
    '[web-e2e] 已按真实模型链路处理：第一条原始问题：解释 React 协调过程',
  );
  await expect(page.getByRole('main')).toContainText(
    '最后一条编辑后问题：重新解释 diff 策略，尽量详细',
  );
  await expect(page.getByRole('main')).toContainText(
    '[web-e2e] 已按真实模型链路处理：最后一条编辑后问题：重新解释 diff 策略，尽量详细',
  );
});

test('命中文档知识时应把知识上下文注入到真实聊天链路', async ({ page }) => {
  const fixture = await seedKnowledgeDocumentFixture();

  try {
    await openChat(page);
    await page.getByTestId('multimodal-input').fill(fixture.prompt);
    await page.getByTestId('send-button').click();

    await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
    await expect(page.getByRole('main')).toContainText(fixture.prompt);
    await expect(page.getByRole('main')).toContainText(
      `[web-e2e] 已按真实模型链路处理：${fixture.prompt}`,
    );
    await expect(page.getByRole('main')).toContainText(fixture.expectedKnowledgeHitText);
  } finally {
    await cleanupKnowledgeDocumentFixture();
  }
});

test('简历优化里夹带技术关键词时，真实聊天链路仍应命中 project resume 文档', async ({ page }) => {
  const fixture = await seedResumeKnowledgeDocumentFixture();

  try {
    await openChat(page);
    await page.getByTestId('multimodal-input').fill(fixture.prompt);
    await page.getByTestId('send-button').click();

    await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
    await expect(page.getByRole('main')).toContainText(fixture.prompt);
    await expect(page.getByRole('main')).toContainText(
      `[web-e2e] 已按真实模型链路处理：${fixture.prompt}`,
    );
    await expect(page.getByRole('main')).toContainText(fixture.expectedKnowledgeHitText);
  } finally {
    await cleanupResumeKnowledgeDocumentFixture();
  }
});

test('面试流程问题应命中 interview playbook 文档', async ({ page }) => {
  const fixture = await seedInterviewPlaybookKnowledgeDocumentFixture();

  try {
    await openChat(page);
    await page.getByTestId('multimodal-input').fill(fixture.prompt);
    await page.getByTestId('send-button').click();

    await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
    await expect(page.getByRole('main')).toContainText(fixture.prompt);
    await expect(page.getByRole('main')).toContainText(
      `[web-e2e] 已按真实模型链路处理：${fixture.prompt}`,
    );
    await expect(page.getByRole('main')).toContainText(fixture.expectedKnowledgeHitText);
  } finally {
    await cleanupInterviewPlaybookKnowledgeDocumentFixture();
  }
});
