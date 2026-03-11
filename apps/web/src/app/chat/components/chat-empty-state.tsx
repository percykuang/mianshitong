export function ChatEmptyState() {
  return (
    <div className="mx-auto mt-4 flex min-h-full w-full max-w-3xl flex-col justify-center px-4 text-left md:mt-16 md:px-8">
      <div className="animate-in text-3xl font-semibold text-blue-600 duration-300 fade-in slide-in-from-bottom-2 md:text-4xl dark:text-blue-500">
        面试通
      </div>
      <div className="mt-4 animate-in text-xl text-zinc-500 duration-500 fade-in slide-in-from-bottom-2 md:text-2xl dark:text-zinc-400">
        AI 智能面试官，优化简历，模拟面试
      </div>
    </div>
  );
}
