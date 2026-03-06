'use client';

import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const sharedButtonClassName =
    'flex items-center gap-2 rounded-md bg-background text-sm transition-colors hover:bg-sidebar-accent';

  const defaultButtonClassName =
    menuPlacement === 'up'
      ? 'h-10 w-full p-2 text-left'
      : 'h-8 border border-border px-3 text-left hover:bg-accent';

  const defaultMenuClassName =
    menuPlacement === 'up'
      ? 'right-0 bottom-12 w-full'
      : 'right-0 top-[calc(100%+0.25rem)] min-w-52';

  if (status === 'loading') {
    return (
      <button
        type="button"
        className={cn(sharedButtonClassName, defaultButtonClassName, className, buttonClassName)}
        disabled
      >
        <div className="size-6 animate-pulse rounded-full bg-zinc-500/30" />
        <span className="animate-pulse rounded-md bg-zinc-500/30 text-transparent">Guest</span>
        <Loader2 className="ml-auto size-4 animate-spin text-zinc-500" />
      </button>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          sharedButtonClassName,
          defaultButtonClassName,
          'cursor-pointer',
          buttonClassName,
        )}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        data-testid="user-nav-button"
      >
        <Image
          src={GUEST_AVATAR}
          alt="User Avatar"
          width={24}
          height={24}
          className="rounded-full dark:invert"
          unoptimized
        />
        <span className="truncate">{isAuthenticated ? userEmail : 'Guest'}</span>
        <ChevronIcon className="ml-auto size-4" />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-50 rounded-md border border-border bg-popover p-1 shadow-md',
            defaultMenuClassName,
            menuClassName,
          )}
          data-testid="user-nav-menu"
        >
          <button
            type="button"
            className="flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            data-testid="user-nav-item-theme"
            onClick={() => {
              setTheme(toggleTarget);
              setOpen(false);
            }}
          >
            {`Toggle ${toggleTarget} mode`}
          </button>

          <div className="my-1 h-px bg-border" />

          <button
            type="button"
            className="w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            data-testid="user-nav-item-auth"
            onClick={async () => {
              setOpen(false);
              if (isAuthenticated) {
                await signOut({ redirect: false });
                router.push('/');
                router.refresh();
                return;
              }

              router.push('/login');
            }}
          >
            {isAuthenticated ? '退出登录' : 'Login to your account'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
