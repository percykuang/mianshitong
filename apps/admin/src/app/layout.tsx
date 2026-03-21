import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AdminProviders } from '@/components/admin-providers';
import 'antd/dist/reset.css';
import './globals.css';

export const metadata: Metadata = {
  title: '面试通后台',
  description: '面试通后台：用户、会话与题库管理。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body style={{ background: '#ffffff', color: '#111827' }}>
        <AntdRegistry>
          <AdminProviders>{children}</AdminProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
