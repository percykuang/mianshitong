import type { ChatUsageSummary } from '@mianshitong/shared';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ChatComposerUsageProps {
  usage?: ChatUsageSummary | null;
  usageLoading: boolean;
}

function UsageTriggerIcon({ percent }: { percent: number }) {
  const normalizedPercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalizedPercent / 100) * circumference;

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="28"
      height="28"
      className="size-7"
      style={{ color: 'currentColor' }}
    >
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        opacity="0.25"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        opacity="0.7"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth="2"
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

export function ChatComposerUsage({ usage, usageLoading }: ChatComposerUsageProps) {
  const usagePercent = usage && usage.max > 0 ? Math.min(100, (usage.used / usage.max) * 100) : 0;
  const usagePercentLabel = usageLoading && !usage ? '--.-%' : `${usagePercent.toFixed(1)}%`;
  const usedCountLabel = usageLoading && !usage ? '--' : String(usage?.used ?? 0);
  const totalCountLabel = usageLoading && !usage ? '--' : String(usage?.max ?? 0);

  return (
    <div className="absolute top-3 right-3 z-10">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              'size-7 rounded-md border-0 bg-background p-0 text-foreground shadow-none',
              'hover:bg-background hover:text-foreground',
              'focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:ring-offset-0',
            )}
            aria-label={`查看今日额度使用情况：${usagePercentLabel}`}
          >
            <UsageTriggerIcon percent={usagePercent} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-[266px] rounded-lg border border-zinc-200 bg-white p-3 text-zinc-950 shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold tracking-tight text-zinc-950">
                {usagePercentLabel}
              </span>
              <span className="text-sm font-medium text-zinc-500">
                {usedCountLabel} / {totalCountLabel} 次
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-500 transition-[width] duration-300"
                style={{ width: `${usagePercent}%` }}
              />
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between text-zinc-500">
                <span>已用次数</span>
                <span>{usedCountLabel}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500">
                <span>总次数</span>
                <span>{totalCountLabel}</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
