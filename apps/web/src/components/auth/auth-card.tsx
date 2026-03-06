import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AuthCardProps {
  title: string;
  description: string;
  submitLabel: string;
  email: string;
  password: string;
  error: string | null;
  pending: boolean;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}

export function AuthCard({
  title,
  description,
  submitLabel,
  email,
  password,
  error,
  pending,
  footerText,
  footerLinkText,
  footerLinkHref,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AuthCardProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8">
      <section className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="user@acme.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              disabled={pending}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="至少 8 位"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              disabled={pending}
              required
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" className="h-10 w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          {footerText}{' '}
          <Link href={footerLinkHref} className="text-primary underline-offset-4 hover:underline">
            {footerLinkText}
          </Link>
        </p>
      </section>
    </main>
  );
}
