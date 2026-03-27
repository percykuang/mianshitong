'use client';

import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HoverTooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  contentClassName?: string;
  disabled?: boolean;
}

export function HoverTooltip({
  content,
  children,
  side = 'bottom',
  align = 'center',
  contentClassName,
  disabled = false,
}: HoverTooltipProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted || disabled) {
    return <span className="inline-flex">{children}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={4}
          className={cn('w-auto rounded-lg px-3 py-1.5', contentClassName)}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
