import { prisma } from '@mianshitong/db';

export async function findUserByEmail(email: string) {
  return prisma.authUser.findUnique({
    where: { email },
  });
}

export async function findUserById(id: string) {
  return prisma.authUser.findUnique({
    where: { id },
  });
}

export async function createUser(input: { email: string; passwordHash: string }) {
  return prisma.authUser.create({
    data: input,
  });
}
