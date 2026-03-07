import { ChevronLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function ChatHeader({ sidebarOpen, onToggleSidebar }: ChatHeaderProps) {
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
    </header>
  );
}
