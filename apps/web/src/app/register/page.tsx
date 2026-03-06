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
      title="Sign Up"
      description="Create an account with your email and password"
      submitLabel="Sign Up"
      email={email}
      password={password}
      error={error}
      pending={pending}
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref="/login"
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
    />
  );
}
