import { LoginForm } from './login-form';

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getCallbackUrl(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const callbackUrl = searchParams.callbackUrl;

  if (Array.isArray(callbackUrl)) {
    return callbackUrl[0] ?? null;
  }

  return callbackUrl ?? null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;

  return <LoginForm callbackUrl={getCallbackUrl(resolvedSearchParams)} />;
}
