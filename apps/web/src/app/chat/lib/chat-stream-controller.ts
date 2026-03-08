let currentStreamAbortController: AbortController | null = null;

export function registerStreamAbortController(controller: AbortController): void {
  currentStreamAbortController = controller;
}

export function clearStreamAbortController(controller: AbortController): void {
  if (currentStreamAbortController === controller) {
    currentStreamAbortController = null;
  }
}

export function abortCurrentStream(): void {
  currentStreamAbortController?.abort();
  currentStreamAbortController = null;
}
