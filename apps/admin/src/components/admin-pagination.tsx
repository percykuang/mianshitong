'use client';

import { Pagination } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useRouter } from 'next/navigation';
import { buildPageHref } from '@/lib/pagination';

interface AdminPaginationProps {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  totalLabel?: string;
  pageSizeOptions?: number[];
  params?: Record<string, string | number | undefined | null>;
}

export function AdminPagination({
  basePath,
  page,
  pageSize,
  total,
  totalLabel,
  pageSizeOptions,
  params,
}: AdminPaginationProps) {
  const router = useRouter();

  const handleChange = (nextPage: number, nextPageSize?: number) => {
    const resolvedPageSize = nextPageSize ?? pageSize;
    router.push(buildPageHref(basePath, nextPage, resolvedPageSize, params));
  };

  const handlePageSizeChange = (current: number, size: number) => {
    router.push(buildPageHref(basePath, 1, size, params));
  };

  return (
    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        locale={zhCN.Pagination}
        showTotal={totalLabel ? (value) => `共 ${value} ${totalLabel}` : undefined}
        showSizeChanger
        pageSizeOptions={pageSizeOptions ?? [10, 20, 30, 50, 100]}
        onChange={handleChange}
        onShowSizeChange={handlePageSizeChange}
      />
    </div>
  );
}
