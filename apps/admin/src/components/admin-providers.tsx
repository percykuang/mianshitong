'use client';

import '@ant-design/v5-patch-for-react-19';
import { App, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

interface AdminProvidersProps {
  children: ReactNode;
}

export function AdminProviders({ children }: AdminProvidersProps) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#111827',
          colorBgBase: '#ffffff',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorTextBase: '#111827',
          colorTextSecondary: '#6b7280',
          colorBorder: '#e5e7eb',
          colorFillSecondary: '#f1f5f9',
          borderRadius: 6,
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
