import { expect, type Page } from '@playwright/test';

export interface CreatedChatSession {
  id: string;
  title: string;
  assistantContent: string;
}

export async function openChat(page: Page): Promise<void> {
  await page.goto('/chat');
  await expect(page.getByTestId('multimodal-input')).toBeVisible();
}

function resolveExpectedAssistantContent(prompt: string): string {
  return `[web-e2e] 已按真实模型链路处理：${prompt}`;
}

function resolveSessionIdFromUrl(url: string): string {
  const matched = /\/chat\/([0-9a-f]{32})$/.exec(url);
  if (!matched?.[1]) {
    throw new Error(`无法从当前 URL 解析会话 ID: ${url}`);
  }

  return matched[1];
}

export async function createRemoteSession(page: Page, prompt: string): Promise<CreatedChatSession> {
  await openChat(page);

  const quickPromptButton = page.getByRole('button', { name: prompt });
  if (await quickPromptButton.count()) {
    await quickPromptButton.first().click();
  } else {
    await page.getByTestId('multimodal-input').fill(prompt);
    await page.getByTestId('send-button').click();
  }

  await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
  const assistantContent = resolveExpectedAssistantContent(prompt);
  await expect(page.getByRole('main')).toContainText(prompt);
  await expect(page.getByRole('main')).toContainText(assistantContent);

  return {
    id: resolveSessionIdFromUrl(page.url()),
    title: prompt,
    assistantContent,
  };
}
