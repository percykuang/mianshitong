'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { toSafeCallbackPath } from '@/lib/auth-redirect';

interface LoginFormProps {
  callbackUrl: string | null;
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const callbackPath = toSafeCallbackPath(callbackUrl, window.location.origin);
    setPending(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: callbackPath,
    });

    setPending(false);
    if (result?.error) {
      setError('邮箱或密码错误');
      return;
    }

    router.push(callbackPath);
    router.refresh();
  };

  return (
    <AuthCard
      title="登录"
      description="使用邮箱和密码登录面试通"
      submitLabel="登录"
      emailLabel="邮箱"
      emailPlaceholder="请输入邮箱地址"
      passwordLabel="密码"
      passwordPlaceholder="请输入密码"
      email={email}
      password={password}
      error={error}
      pending={pending}
      footerText="还没有账号？"
      footerLinkText="立即注册"
      footerLinkHref="/register"
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
    />
  );
}
