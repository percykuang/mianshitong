import { randomBytes, scryptSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const dbPackageJson = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/db/package.json',
);
const dbRequire = createRequire(dbPackageJson);
const { PrismaClient } = dbRequire('@prisma/client');
const { PrismaPg } = dbRequire('@prisma/adapter-pg');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node scripts/create-admin-user.mjs <email> <password>');
  process.exit(1);
}

const DEV_DATABASE_URL =
  'postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public';

const connectionString = process.env.DATABASE_URL || DEV_DATABASE_URL;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ['error'],
});

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 32).toString('hex');
const passwordHash = `scrypt:${salt}:${hash}`;

await prisma.adminUser.upsert({
  where: { email },
  update: { passwordHash },
  create: { email, passwordHash },
});

console.log(`Admin user upserted: ${email}`);

await prisma.$disconnect();
