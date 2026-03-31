'use client';

import { ChevronDown, ChevronUp, Loader } from '@/components/icons';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const GUEST_AVATAR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxYTFhMWEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCIvPjwvc3ZnPg==';

type MenuPlacement = 'up' | 'down';

interface GuestMenuProps {
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  menuPlacement?: MenuPlacement;
}

export function GuestMenu({
  className,
  buttonClassName,
  menuClassName,
  menuPlacement = 'up',
}: GuestMenuProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const currentTheme = (resolvedTheme ?? theme) === 'dark' ? 'dark' : 'light';
  const toggleTarget = currentTheme === 'dark' ? 'light' : 'dark';
  const ChevronIcon = menuPlacement === 'up' ? ChevronUp : ChevronDown;
  const userEmail = session?.user?.email ?? null;
  const isAuthenticated = Boolean(userEmail);

  useEffect(() => {
    if (status !== 'authenticated' || isAuthenticated) {
      return;
    }

    void signOut({ redirect: false }).then(() => {
      router.refresh();
    });
  }, [status, isAuthenticated, router]);

  const sharedButtonClassName =
    'flex items-center gap-2 rounded-md bg-background text-sm transition-colors hover:bg-sidebar-accent';

  const defaultButtonClassName =
    menuPlacement === 'up'
      ? 'h-10 w-full p-2 text-left'
      : 'h-8 border border-border px-3 text-left hover:bg-accent';

  if (status === 'loading') {
    return (
      <button
        type="button"
        className={cn(sharedButtonClassName, defaultButtonClassName, className, buttonClassName)}
        disabled
      >
        <div className="size-6 animate-pulse rounded-full bg-zinc-500/30" />
        <span className="animate-pulse rounded-md bg-zinc-500/30 text-transparent">访客</span>
        <Loader className="ml-auto size-4 animate-spin text-zinc-500" />
      </button>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              sharedButtonClassName,
              defaultButtonClassName,
              'cursor-pointer',
              buttonClassName,
            )}
            data-testid="user-nav-button"
            aria-label={`${isAuthenticated ? userEmail : '访客'} 用户菜单`}
          >
            <Image
              src={GUEST_AVATAR}
              alt="用户头像"
              width={24}
              height={24}
              className="rounded-full dark:invert"
              unoptimized
            />
            <span className="truncate">{isAuthenticated ? userEmail : '访客'}</span>
            <ChevronIcon className="ml-auto size-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side={menuPlacement === 'up' ? 'top' : 'bottom'}
          align="end"
          className={cn(
            menuPlacement === 'up' ? 'w-[var(--radix-dropdown-menu-trigger-width)]' : 'min-w-52',
            menuClassName,
          )}
          data-testid="user-nav-menu"
        >
          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="user-nav-item-theme"
            onSelect={() => {
              setTheme(toggleTarget);
            }}
          >
            {toggleTarget === 'dark' ? '切换深色主题' : '切换浅色主题'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="user-nav-item-auth"
            onSelect={() => {
              if (isAuthenticated) {
                void signOut({ redirect: false }).then(() => {
                  router.push('/');
                  router.refresh();
                });
                return;
              }

              router.push('/login');
            }}
          >
            {isAuthenticated ? '退出登录' : '登录账户'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
