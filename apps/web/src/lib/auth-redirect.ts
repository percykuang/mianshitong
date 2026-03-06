const FALLBACK_PATH = '/';

function buildPathname(url: URL): string {
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path || FALLBACK_PATH;
}

export function toSafeCallbackPath(callbackUrl: string | null, origin?: string): string {
  if (!callbackUrl) {
    return FALLBACK_PATH;
  }

  if (callbackUrl.startsWith('/')) {
    return callbackUrl;
  }

  if (!origin) {
    return FALLBACK_PATH;
  }

  try {
    const parsed = new URL(callbackUrl);
    return parsed.origin === origin ? buildPathname(parsed) : FALLBACK_PATH;
  } catch {
    return FALLBACK_PATH;
  }
}
