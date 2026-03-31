'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';

interface RegisterResponse {
  error?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setPending(true);
    setError(null);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as RegisterResponse;
      setPending(false);
      setError(data.error ?? '注册失败，请稍后重试');
      return;
    }

    const loginResult = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/',
    });

    setPending(false);
    if (loginResult?.error) {
      setError('注册成功，但自动登录失败，请手动登录');
      router.push('/login');
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <AuthCard
      title="注册"
      description="使用邮箱和密码创建面试通账号"
      submitLabel="注册"
      emailLabel="邮箱"
      emailPlaceholder="请输入邮箱地址"
      passwordLabel="密码"
      passwordPlaceholder="请设置登录密码"
      email={email}
      password={password}
      error={error}
      pending={pending}
      footerText="已经有账号？"
      footerLinkText="立即登录"
      footerLinkHref="/login"
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
    />
  );
}
