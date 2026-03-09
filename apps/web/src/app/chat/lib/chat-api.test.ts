import { describe, expect, it } from 'vitest';
import { isAbortError, readSseStream } from './chat-api';

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  );
}

describe('chat-api', () => {
  it('可以跨 chunk 解析 SSE 事件', async () => {
    const events: Array<{ eventName: string; payload: string }> = [];

    await readSseStream(
      createSseResponse([
        'event: delta\ndata: {"delta":"hel',
        'lo"}\n\n',
        'event: done\ndata: {"assistantContent":"hello"}\n\n',
      ]),
      (eventName, payload) => {
        events.push({ eventName, payload });
      },
    );

    expect(events).toEqual([
      { eventName: 'delta', payload: '{"delta":"hello"}' },
      { eventName: 'done', payload: '{"assistantContent":"hello"}' },
    ]);
  });

  it('流结束时即使最后一个事件没有空行结尾也会被消费', async () => {
    const events: Array<{ eventName: string; payload: string }> = [];

    await readSseStream(
      createSseResponse(['event: done\ndata: {"assistantContent":"final"}']),
      (eventName, payload) => {
        events.push({ eventName, payload });
      },
    );

    expect(events).toEqual([{ eventName: 'done', payload: '{"assistantContent":"final"}' }]);
  });

  it('可以识别 AbortError', () => {
    const error = new Error('aborted');
    error.name = 'AbortError';

    expect(isAbortError(error)).toBe(true);
    expect(isAbortError(new Error('other'))).toBe(false);
  });
});
