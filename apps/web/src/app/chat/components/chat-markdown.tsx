'use client';

import type { ComponentPropsWithoutRef } from 'react';
import Markdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { unwrapMarkdownFenceWrapper } from '@/lib/chat-markdown-normalization';
import { cn } from '@/lib/utils';
import { ChatCodeBlock, renderInlineCode } from './chat-code-block';
import { ChatTableBlock } from './chat-table-block';

type CodeComponentProps = ComponentPropsWithoutRef<'code'> & ExtraProps;
type TableComponentProps = ComponentPropsWithoutRef<'table'> & ExtraProps;
type TableSectionComponentProps = ComponentPropsWithoutRef<'thead'> & ExtraProps;
type TableBodyComponentProps = ComponentPropsWithoutRef<'tbody'> & ExtraProps;
type TableRowComponentProps = ComponentPropsWithoutRef<'tr'> & ExtraProps;
type TableCellComponentProps = ComponentPropsWithoutRef<'th'> & ExtraProps;
type TableDataComponentProps = ComponentPropsWithoutRef<'td'> & ExtraProps;

function stripMarkdownNodeProp<T extends { node?: unknown }>(props: T) {
  const { node, ...rest } = props;
  void node;
  return rest;
}

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

function renderTable(props: TableComponentProps) {
  const { children, className, ...rest } = stripMarkdownNodeProp(props);
  return (
    <ChatTableBlock className={className} {...rest}>
      {children}
    </ChatTableBlock>
  );
}

function renderTableHead(props: TableSectionComponentProps) {
  const { children, className, ...rest } = stripMarkdownNodeProp(props);
  return (
    <thead className={cn('bg-zinc-100/80 dark:bg-zinc-900/50', className)} {...rest}>
      {children}
    </thead>
  );
}

function renderTableBody(props: TableBodyComponentProps) {
  const { children, className, ...rest } = stripMarkdownNodeProp(props);
  return (
    <tbody
      className={cn(
        'divide-y divide-zinc-200 bg-zinc-50/60 dark:divide-zinc-800 dark:bg-zinc-900/20',
        className,
      )}
      {...rest}
    >
      {children}
    </tbody>
  );
}

function renderTableRow(props: TableRowComponentProps) {
  const { children, className, ...rest } = stripMarkdownNodeProp(props);
  return (
    <tr className={cn('align-top', className)} {...rest}>
      {children}
    </tr>
  );
}

function renderTableHeadCell(props: TableCellComponentProps) {
  const { children, className, ...rest } = stripMarkdownNodeProp(props);
  return (
    <th
      className={cn(
        'px-4 py-2 text-left text-sm leading-5 font-semibold whitespace-nowrap [&:first-child]:w-[22%]',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

function renderTableDataCell(props: TableDataComponentProps) {
  const { children, className, ...rest } = stripMarkdownNodeProp(props);
  return (
    <td
      className={cn(
        'px-4 py-2 text-sm leading-6 wrap-break-word [&:first-child]:w-[22%]',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
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
        '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-[30px] [&_h1]:leading-9 [&_h1]:font-semibold',
        '[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:leading-8 [&_h2]:font-semibold',
        '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:leading-7 [&_h3]:font-semibold',
        '[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-base [&_h4]:leading-6 [&_h4]:font-semibold',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_li]:my-1',
        '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-700 dark:[&_blockquote]:border-zinc-700 dark:[&_blockquote]:text-zinc-300',
        '[&_pre]:my-0',
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: renderCode,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          table: renderTable,
          thead: renderTableHead,
          tbody: renderTableBody,
          tr: renderTableRow,
          th: renderTableHeadCell,
          td: renderTableDataCell,
        }}
      >
        {normalizedContent}
      </Markdown>
    </div>
  );
}
