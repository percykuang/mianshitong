import type { ComponentPropsWithoutRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

type CodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
};

function renderCodeBlock({ inline, className, children, ...rest }: CodeProps) {
  const match = /language-(\w+)/.exec(className ?? '');
  const code = String(children).replace(/\n$/, '');

  if (inline || !match) {
    return (
      <code className={cn('rounded bg-muted px-1 py-0.5', className)} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <SyntaxHighlighter
      PreTag="div"
      language={match[1]}
      style={oneDark}
      customStyle={{
        margin: 0,
        borderRadius: 12,
        padding: '12px 14px',
        fontSize: '0.8rem',
      }}
      codeTagProps={{
        style: {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
        },
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <div
      className={cn(
        'max-w-none break-words text-sm leading-6 text-foreground',
        '[&_p]:mb-2 [&_p:last-child]:mb-0',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_pre]:my-2',
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: renderCodeBlock,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
