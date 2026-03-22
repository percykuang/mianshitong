import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/server/auth-options';

type NextAuthRouteContext = {
  params: Promise<{
    nextauth: string[];
  }>;
};

export function GET(request: NextRequest, context: NextAuthRouteContext) {
  return NextAuth(request, context, getAuthOptions());
}

export function POST(request: NextRequest, context: NextAuthRouteContext) {
  return NextAuth(request, context, getAuthOptions());
}
