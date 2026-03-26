'use client';

import type { ChatUsageSummary } from '@mianshitong/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ChatUsageLimitBannerProps {
  usage: ChatUsageSummary;
}

export function ChatUsageLimitBanner({ usage }: ChatUsageLimitBannerProps) {
  if (usage.remaining > 0) {
    return null;
  }

  if (usage.actorType === 'guest') {
    return (
      <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold">今日体验额度已用完</p>
            <p className="text-xs leading-5 text-zinc-600">
              当前已使用 {usage.used} / {usage.max} 次。登录后可提升至 30
              次/天，注册后可保留你的历史会话。
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-full bg-white">
              <Link href="/login?callbackUrl=/chat">登录</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/register?callbackUrl=/chat">注册</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-2xl border border-zinc-200 bg-zinc-50/90 px-4 py-3 text-zinc-900">
      <p className="text-sm font-semibold">今日额度已用完</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">
        当前已使用 {usage.used} / {usage.max} 次，额度将在明天 00:00 自动重置。
      </p>
    </div>
  );
}
