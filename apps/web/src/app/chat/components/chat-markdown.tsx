'use client';

import type { ComponentPropsWithoutRef } from 'react';
import Markdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { unwrapMarkdownFenceWrapper } from '@/lib/chat-markdown-normalization';
import { cn } from '@/lib/utils';
import { ChatCodeBlock, renderInlineCode } from './chat-code-block';

type CodeComponentProps = ComponentPropsWithoutRef<'code'> & ExtraProps;

function isBlockCode({ children, className, node }: CodeComponentProps) {
  const content = String(children);
  const hasLanguageClass = /language-[\w-]+/.test(className ?? '');
  const hasMultilineContent = content.includes('\n');
  const spansMultipleSourceLines =
    typeof node?.position?.start.line === 'number' &&
    typeof node.position.end.line === 'number' &&
    node.position.start.line !== node.position.end.line;

  return hasLanguageClass || hasMultilineContent || spansMultipleSourceLines;
}

function renderCode(props: CodeComponentProps) {
  if (!isBlockCode(props)) {
    return renderInlineCode(props);
  }

  return <ChatCodeBlock {...props} />;
}

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  const normalizedContent = unwrapMarkdownFenceWrapper(content);

  return (
    <div
      className={cn(
        'max-w-none text-sm leading-6 wrap-break-word text-foreground',
        '[&_p]:mb-2 [&_p:last-child]:mb-0',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_pre]:my-0',
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: renderCode,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        }}
      >
        {normalizedContent}
      </Markdown>
    </div>
  );
}
