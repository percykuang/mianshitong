'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Check, Copy, Download } from '@/components/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HoverTooltip } from '@/components/ui/hover-tooltip';
import { cn } from '@/lib/utils';
import { highlightCodeBlock } from './chat-shiki';

type CodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
};

const DOWNLOAD_EXTENSION_MAP: Record<string, string> = {
  bash: 'sh',
  css: 'css',
  go: 'go',
  html: 'html',
  javascript: 'js',
  js: 'js',
  json: 'json',
  jsx: 'jsx',
  markdown: 'md',
  md: 'md',
  python: 'py',
  py: 'py',
  shell: 'sh',
  sh: 'sh',
  sql: 'sql',
  text: 'txt',
  ts: 'ts',
  tsx: 'tsx',
  typescript: 'ts',
  vue: 'vue',
  yaml: 'yml',
  yml: 'yml',
  zsh: 'sh',
};

interface HighlightResult {
  key: string;
  html: string | null;
}

interface CodeActionButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

function normalizeLanguage(languageClassName?: string) {
  const match = /language-([\w-]+)/.exec(languageClassName ?? '');
  return (match?.[1] ?? 'text').toLowerCase();
}

function getDownloadFilename(language: string) {
  const extension = DOWNLOAD_EXTENSION_MAP[language] ?? 'txt';
  return `file.${extension}`;
}

export function renderInlineCode({ className, children, ...rest }: CodeProps) {
  return (
    <code
      className={cn(
        'rounded-md bg-zinc-100 px-1.5 py-0.5 text-[0.9em] text-foreground dark:bg-zinc-800 dark:text-zinc-100',
        className,
      )}
      {...rest}
    >
      {children}
    </code>
  );
}

function CodeActionButton({ label, icon, onClick }: CodeActionButtonProps) {
  return (
    <HoverTooltip content={label} side="top">
      <button
        type="button"
        aria-label={label}
        className="cursor-pointer p-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        onClick={onClick}
      >
        {icon}
      </button>
    </HoverTooltip>
  );
}

function CodeBlockFallback({ code }: { code: string }) {
  return (
    <pre className="chat-code-block-fallback">
      <code>{code}</code>
    </pre>
  );
}

export function ChatCodeBlock({ className, children, ...rest }: CodeProps) {
  const language = normalizeLanguage(className);
  const code = String(children).replace(/\n$/, '');
  const highlightKey = useMemo(() => `${language}\u0000${code}`, [code, language]);
  const [highlightResult, setHighlightResult] = useState<HighlightResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const downloadedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void highlightCodeBlock(code, language).then((html) => {
      if (!cancelled) {
        setHighlightResult({ key: highlightKey, html });
      }
    });

    return () => {
      cancelled = true;
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
      if (downloadedTimerRef.current) {
        window.clearTimeout(downloadedTimerRef.current);
      }
    };
  }, [code, highlightKey, language]);

  const isHighlighting = highlightResult?.key !== highlightKey;
  const highlightedHtml = isHighlighting ? null : (highlightResult?.html ?? null);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    if (copiedTimerRef.current) {
      window.clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 1500);
  }, [code]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getDownloadFilename(language);
    anchor.click();
    URL.revokeObjectURL(url);

    setDownloaded(true);
    if (downloadedTimerRef.current) {
      window.clearTimeout(downloadedTimerRef.current);
    }
    downloadedTimerRef.current = window.setTimeout(() => {
      setDownloaded(false);
      downloadedTimerRef.current = null;
    }, 1500);
  }, [code, language]);

  return (
    <div className="my-4 w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between bg-zinc-100/80 p-3 text-xs text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">
        <span className="ml-1 font-mono lowercase">{language}</span>
        <div className="flex items-center gap-2">
          <CodeActionButton
            label={downloaded ? '已下载' : '下载代码'}
            icon={downloaded ? <Check className="size-3.5" /> : <Download className="size-3.5" />}
            onClick={handleDownload}
          />
          <CodeActionButton
            label={copied ? '已复制' : '复制代码'}
            icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            onClick={() => void handleCopy()}
          />
        </div>
      </div>
      <div className="chat-code-block-body border-t border-zinc-200 dark:border-zinc-800" {...rest}>
        {highlightedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <CodeBlockFallback code={code} />
        )}
        {isHighlighting ? <span className="sr-only">代码高亮加载中</span> : null}
      </div>
    </div>
  );
}
