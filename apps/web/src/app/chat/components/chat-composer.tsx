import { MODEL_OPTIONS, type ModelId } from '@mianshitong/shared';
import { Send } from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useState,
  useSyncExternalStore,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ChatComposerProps {
  hasConversation: boolean;
  quickPrompts: string[];
  inputValue: string;
  selectedModelId: ModelId;
  sending: boolean;
  loading: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onQuickPrompt: (prompt: string) => Promise<void>;
  onModelChange: (value: ModelId) => void;
}

export function ChatComposer({
  hasConversation,
  quickPrompts,
  inputValue,
  selectedModelId,
  sending,
  loading,
  inputRef,
  onInputChange,
  onSubmit,
  onQuickPrompt,
  onModelChange,
}: ChatComposerProps) {
  const [isComposing, setIsComposing] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit();
  };

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || isComposing) {
      return;
    }

    event.preventDefault();
    void onSubmit();
  };

  return (
    <div className="mx-auto w-full max-w-4xl bg-background px-2 pb-3 md:px-4 md:pb-4">
      <div className="relative flex w-full flex-col gap-4">
        {!hasConversation ? (
          <div className="grid w-full gap-2 sm:grid-cols-2" data-testid="suggested-actions">
            {quickPrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                className="flex h-auto w-full cursor-pointer justify-center rounded-full p-3 text-left leading-relaxed whitespace-normal"
                onClick={() => void onQuickPrompt(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={handleFormSubmit}
          className="w-full overflow-hidden rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
        >
          <div className="flex flex-row items-start gap-1 sm:gap-2">
            <Textarea
              ref={inputRef}
              name="message"
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="Send a message..."
              data-testid="multimodal-input"
              className="field-sizing-fixed min-h-20 w-full grow resize-none rounded-none !border-none bg-transparent p-2 text-sm shadow-none ring-0 outline-hidden [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none [&::-webkit-scrollbar]:hidden"
            />
          </div>

          <div className="flex items-center justify-between border-t-0 p-0 shadow-none">
            {mounted ? (
              <Select
                value={selectedModelId}
                onValueChange={(value) => onModelChange(value as ModelId)}
              >
                <SelectTrigger className="h-8 border-0 px-2 shadow-none hover:bg-accent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-8 w-32" />
            )}

            <Button
              type="submit"
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              data-testid="send-button"
              disabled={sending || loading}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
