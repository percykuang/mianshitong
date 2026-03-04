import { Book, ChevronDown, ChevronLeft, Lock, Menu } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  sidebarOpen: boolean;
  privateMode: boolean;
  onToggleSidebar: () => void;
  onTogglePrivateMode: () => void;
}

export function ChatHeader({
  sidebarOpen,
  privateMode,
  onToggleSidebar,
  onTogglePrivateMode,
}: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <Button
        variant="outline"
        className="h-8 px-2 md:h-fit md:px-2"
        data-testid="sidebar-toggle-button"
        onClick={onToggleSidebar}
      >
        {sidebarOpen ? <ChevronLeft className="size-4" /> : <Menu className="size-4" />}
      </Button>

      <Button
        variant="outline"
        className={cn(
          'hidden h-8 w-fit px-4 py-2 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground md:flex md:h-fit md:px-2',
          privateMode ? 'border-blue-200 text-blue-600' : '',
        )}
        data-testid="visibility-selector"
        onClick={onTogglePrivateMode}
      >
        <Lock className="size-4" />
        <span className="md:sr-only">Private</span>
        <ChevronDown className="size-4" />
      </Button>

      <Link
        className="order-3 hidden h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-2 py-2 text-sm font-medium whitespace-nowrap text-zinc-50 transition-colors hover:bg-zinc-800 md:ml-auto md:flex md:h-fit"
        href="/"
      >
        <Book className="size-4" />
        使用指南
      </Link>
    </header>
  );
}
