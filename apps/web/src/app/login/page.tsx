import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8">
      <section className="w-full rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold">登录功能开发中</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          当前版本尚未接入账户体系。你可以先以 Guest 模式继续使用面试通。
        </p>
        <div className="mt-6">
          <Button asChild variant="outline" className="h-9 px-4">
            <Link href="/chat">
              <ArrowLeft className="size-4" />
              返回聊天
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
