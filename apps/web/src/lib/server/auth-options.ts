import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { findUserByEmail, findUserById } from './auth-user-repository';
import { credentialsSchema } from './auth-validation';

const DEV_AUTH_SECRET = 'mianshitong-dev-auth-secret';

if (!process.env.NEXTAUTH_URL && process.env.NODE_ENV === 'development') {
  process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000';
}

function resolveAuthSecret(): string {
  const authSecret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === 'development' ? DEV_AUTH_SECRET : undefined);

  if (!authSecret && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production');
  }

  return authSecret ?? DEV_AUTH_SECRET;
}

export function getAuthOptions(): NextAuthOptions {
  return {
    secret: resolveAuthSecret(),
    pages: {
      signIn: '/login',
    },
    session: {
      strategy: 'jwt',
    },
    providers: [
      CredentialsProvider({
        name: 'Credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) {
            return null;
          }

          const email = parsed.data.email.toLowerCase();
          const user = await findUserByEmail(email);
          if (!user) {
            return null;
          }

          const isValidPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
          if (!isValidPassword) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.email,
          };
        },
      }),
    ],
    callbacks: {
      async session({ session, token }) {
        if (!token.sub) {
          session.user = undefined;
          return session;
        }

        const currentUser = await findUserById(token.sub);
        if (!currentUser) {
          session.user = undefined;
          return session;
        }

        if (session.user) {
          session.user.id = currentUser.id;
          session.user.email = currentUser.email;
          session.user.name = currentUser.email;
        }

        return session;
      },
    },
  };
}
