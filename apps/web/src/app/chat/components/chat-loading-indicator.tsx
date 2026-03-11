import { cn } from '@/lib/utils';

interface ChatLoadingIndicatorProps {
  className?: string;
}

const DOT_DELAY_CLASS = ['delay-0', 'delay-150', 'delay-300'];

export function ChatLoadingIndicator({ className }: ChatLoadingIndicatorProps) {
  return (
    <div
      className={cn(
        'flex min-h-8 animate-in items-center duration-200 fade-in slide-in-from-bottom-1',
        className,
      )}
      aria-label="AI 正在生成回复"
    >
      <span className="inline-flex items-center gap-1.5 text-muted-foreground/70">
        {DOT_DELAY_CLASS.map((delayClass) => (
          <span
            key={delayClass}
            className={cn('size-1.5 animate-pulse rounded-full bg-current', delayClass)}
          />
        ))}
      </span>
      <span className="sr-only">思考中</span>
    </div>
  );
}
