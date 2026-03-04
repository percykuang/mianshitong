import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '面试通 | AI 面试官',
  description: '你的专属 AI Agent 面试官，支持模拟面试、简历优化与题解答疑。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
