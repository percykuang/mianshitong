'use client';

import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

const GUEST_AVATAR_DARK =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmNWY1ZjUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCIvPjwvc3ZnPg==';
const GUEST_AVATAR_LIGHT =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxYTFhMWEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCIvPjwvc3ZnPg==';

type MenuPlacement = 'up' | 'down';

interface GuestMenuProps {
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  menuPlacement?: MenuPlacement;
}

function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function GuestMenu({
  className,
  buttonClassName,
  menuClassName,
  menuPlacement = 'up',
}: GuestMenuProps) {
  const mounted = useMounted();
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest'>('loading');
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTheme = useMemo<'dark' | 'light'>(() => {
    if (!mounted) {
      return 'light';
    }

    const nextTheme = resolvedTheme ?? theme;
    return nextTheme === 'dark' ? 'dark' : 'light';
  }, [mounted, resolvedTheme, theme]);

  const toggleTarget = currentTheme === 'dark' ? 'light' : 'dark';
  const avatarSrc = currentTheme === 'dark' ? GUEST_AVATAR_DARK : GUEST_AVATAR_LIGHT;
  const ChevronIcon = menuPlacement === 'up' ? ChevronUp : ChevronDown;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAuthStatus('guest');
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

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

  if (authStatus === 'loading') {
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
        className={cn(sharedButtonClassName, defaultButtonClassName, buttonClassName)}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        data-testid="user-nav-button"
      >
        <Image
          src={avatarSrc}
          alt="User Avatar"
          width={24}
          height={24}
          className="rounded-full"
          unoptimized
        />
        <span className="truncate">Guest</span>
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
            onClick={() => {
              setOpen(false);
              router.push('/login');
            }}
          >
            Login to your account
          </button>
        </div>
      ) : null}
    </div>
  );
}
