'use client';

import type { ReactNode } from 'react';
import { useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface HoverPopoverProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  contentClassName?: string;
}

export function HoverPopover({
  content,
  children,
  side = 'bottom',
  align = 'center',
  contentClassName,
}: HoverPopoverProps) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return <span className="inline-flex">{children}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="inline-flex"
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className={cn('w-auto rounded-lg px-3 py-1.5 text-xs font-medium', contentClassName)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
