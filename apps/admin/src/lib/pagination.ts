export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasPrev: boolean;
  hasNext: boolean;
};

const MIN_PAGE_SIZE = 10;

export function normalizePage(value: string | string[] | undefined, fallback = 1): number {
  if (Array.isArray(value)) {
    return normalizePage(value[0], fallback);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function normalizePageSize(
  value: string | string[] | undefined,
  fallback = MIN_PAGE_SIZE,
): number {
  if (Array.isArray(value)) {
    return normalizePageSize(value[0], fallback);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(MIN_PAGE_SIZE, Math.floor(parsed));
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);

  return {
    page: safePage,
    pageSize,
    total,
    pageCount,
    hasPrev: safePage > 1,
    hasNext: safePage < pageCount,
  };
}

type PageHrefParams = Record<string, string | number | undefined | null>;

export function buildPageHref(
  basePath: string,
  page: number,
  pageSize: number,
  params?: PageHrefParams,
): string {
  const search = new URLSearchParams();
  search.set('page', String(page));
  search.set('pageSize', String(pageSize));

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      search.set(key, String(value));
    });
  }

  return `${basePath}?${search.toString()}`;
}
