'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChatTableBlockProps extends ComponentPropsWithoutRef<'table'> {
  children: ReactNode;
}

export function ChatTableBlock({ className, children, ...rest }: ChatTableBlockProps) {
  return (
    <div className="my-4" data-chat-markdown="table-wrapper">
      <div className="overflow-x-auto">
        <table
          className={cn(
            'w-full [table-layout:fixed] border-collapse border border-zinc-200 text-left dark:border-zinc-800',
            className,
          )}
          {...rest}
        >
          {children}
        </table>
      </div>
    </div>
  );
}
