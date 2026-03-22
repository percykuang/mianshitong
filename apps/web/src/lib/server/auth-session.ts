import { getServerSession } from 'next-auth';
import { getAuthOptions } from './auth-options';

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(getAuthOptions());
  return session?.user?.id ?? null;
}
