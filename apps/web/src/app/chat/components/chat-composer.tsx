import { MODEL_OPTIONS, type ModelId } from '@mianshitong/shared';
import { ArrowUp, Sparkles, Square } from '@/components/icons';
import {
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CHAT_CONTENT_SHELL_CLASS } from './chat-layout';

interface ChatComposerProps {
  hasConversation: boolean;
  suppressQuickPrompts: boolean;
  quickPrompts: string[];
  inputValue: string;
  selectedModelId: ModelId;
  sending: boolean;
  loading: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onStop: () => void;
  onQuickPrompt: (prompt: string) => Promise<void>;
  onModelChange: (value: ModelId) => void;
}

export function ChatComposer({
  hasConversation,
  suppressQuickPrompts,
  quickPrompts,
  inputValue,
  selectedModelId,
  sending,
  loading,
  inputRef,
  onInputChange,
  onSubmit,
  onStop,
  onQuickPrompt,
  onModelChange,
}: ChatComposerProps) {
  const [isComposing, setIsComposing] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const showQuickPrompts = !hasConversation && !suppressQuickPrompts;
  const selectedModel = useMemo(
    () => MODEL_OPTIONS.find((option) => option.id === selectedModelId) ?? MODEL_OPTIONS[0],
    [selectedModelId],
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
    <div className={`${CHAT_CONTENT_SHELL_CLASS} bg-background pb-3 md:pb-4`}>
      <div className="relative flex w-full flex-col gap-4">
        {showQuickPrompts ? (
          <div className="grid w-full gap-2 sm:grid-cols-2" data-testid="suggested-actions">
            {quickPrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                className="flex h-auto w-full cursor-pointer justify-center rounded-full p-3 text-left leading-relaxed whitespace-normal disabled:cursor-not-allowed"
                onClick={() => void onQuickPrompt(prompt)}
                disabled={loading}
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
              placeholder="发消息..."
              data-testid="multimodal-input"
              className="field-sizing-fixed min-h-20 w-full grow resize-none rounded-none border-none! bg-transparent p-2 text-sm shadow-none ring-0 outline-hidden [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none dark:bg-transparent [&::-webkit-scrollbar]:hidden"
            />
          </div>

          <div className="flex items-center justify-between border-t-0 p-0 shadow-none">
            {mounted ? (
              <Select
                value={selectedModelId}
                onValueChange={(value) => onModelChange(value as ModelId)}
                disabled={loading}
              >
                <SelectTrigger className="h-8 cursor-pointer rounded-[6px_6px_6px_12px] border-0! px-2 shadow-none! hover:bg-accent focus:border-transparent focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:border-0! focus-visible:shadow-none! focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none data-[state=open]:border-0! data-[state=open]:shadow-none! data-[state=open]:ring-0 data-[state=open]:outline-none dark:bg-transparent">
                  <span className="flex min-w-0 items-center gap-2">
                    <Sparkles className="size-4 text-foreground" />
                    <span className="hidden truncate text-xs font-medium sm:block">
                      {selectedModel.label}
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="top"
                  align="start"
                  sideOffset={4}
                  className="min-w-65 p-0"
                >
                  {MODEL_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.id}
                      value={option.id}
                      className="items-start rounded-none py-2 pr-2 pl-8 focus:bg-accent"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-foreground">
                          {option.label}
                        </div>
                        <div className="mt-px truncate text-[10px] leading-tight text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-8 w-40" />
            )}

            <Button
              type={sending ? 'button' : 'submit'}
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              data-testid="send-button"
              aria-label={sending ? '停止生成' : '发送消息'}
              onClick={sending ? onStop : undefined}
              disabled={loading || (!sending && !inputValue.trim())}
            >
              {sending ? (
                <Square className="size-3.5 fill-current" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
