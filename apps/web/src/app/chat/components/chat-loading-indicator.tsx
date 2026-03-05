import { cn } from '@/lib/utils';

interface ChatLoadingIndicatorProps {
  className?: string;
}

const DOT_DELAY = ['0ms', '150ms', '300ms'];

export function ChatLoadingIndicator({ className }: ChatLoadingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <span>思考中</span>
      <span className="inline-flex items-center gap-1">
        {DOT_DELAY.map((delay) => (
          <span
            key={delay}
            className="size-1.5 rounded-full bg-current animate-pulse"
            style={{ animationDelay: delay }}
          />
        ))}
      </span>
    </div>
  );
}
