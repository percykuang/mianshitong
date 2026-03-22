import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient: PrismaClient | undefined;

const DEV_DATABASE_URL =
  'postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public';

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return databaseUrl;
  }

  if (process.env.NODE_ENV === 'development') {
    return DEV_DATABASE_URL;
  }

  throw new Error('DATABASE_URL is required');
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: resolveDatabaseUrl(),
    }),
    log: ['error'],
  });
}

export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  if (prismaClient) {
    return prismaClient;
  }

  const client = createPrismaClient();
  prismaClient = client;

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
  has(_target, property) {
    return property in getPrismaClient();
  },
  ownKeys() {
    return Reflect.ownKeys(getPrismaClient() as unknown as object);
  },
  getOwnPropertyDescriptor(_target, property) {
    return Reflect.getOwnPropertyDescriptor(getPrismaClient() as unknown as object, property);
  },
}) as PrismaClient;
