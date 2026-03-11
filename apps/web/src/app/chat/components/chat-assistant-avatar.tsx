import { Sparkles } from '@/components/icons';
import { cn } from '@/lib/utils';

interface ChatAssistantAvatarProps {
  className?: string;
  loading?: boolean;
}

export function ChatAssistantAvatar({ className, loading = false }: ChatAssistantAvatarProps) {
  return (
    <span
      className={cn(
        '-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border',
        className,
      )}
    >
      <Sparkles className={cn('size-4', loading ? 'animate-pulse' : '')} />
    </span>
  );
}
