import { Button } from '@/components/ui/button';

interface ChatComposerQuickPromptsProps {
  prompts: string[];
  disabled: boolean;
  onQuickPrompt: (prompt: string) => Promise<void>;
}

export function ChatComposerQuickPrompts({
  prompts,
  disabled,
  onQuickPrompt,
}: ChatComposerQuickPromptsProps) {
  return (
    <div className="grid w-full gap-2 sm:grid-cols-2" data-testid="suggested-actions">
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          type="button"
          variant="outline"
          className="flex h-auto w-full cursor-pointer justify-center rounded-full p-3 text-left leading-relaxed whitespace-normal disabled:cursor-not-allowed"
          onClick={() => void onQuickPrompt(prompt)}
          disabled={disabled}
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}
