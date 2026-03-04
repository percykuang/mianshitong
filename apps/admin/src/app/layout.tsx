import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '面试通 Admin',
  description: '面试通后台：题库、会话、模型配置管理。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
