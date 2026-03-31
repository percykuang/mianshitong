'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { AUTH_FIELD_COPY, LOGIN_PAGE_COPY } from '@/components/auth/auth-copy';
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
      title={LOGIN_PAGE_COPY.title}
      description={LOGIN_PAGE_COPY.description}
      submitLabel={LOGIN_PAGE_COPY.submitLabel}
      emailLabel={AUTH_FIELD_COPY.emailLabel}
      emailPlaceholder={AUTH_FIELD_COPY.emailPlaceholder}
      passwordLabel={AUTH_FIELD_COPY.passwordLabel}
      passwordPlaceholder={LOGIN_PAGE_COPY.passwordPlaceholder}
      email={email}
      password={password}
      error={error}
      pending={pending}
      footerText={LOGIN_PAGE_COPY.footerText}
      footerLinkText={LOGIN_PAGE_COPY.footerLinkText}
      footerLinkHref={LOGIN_PAGE_COPY.footerLinkHref}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
    />
  );
}
