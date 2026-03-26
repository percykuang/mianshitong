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
  return prisma.$transaction(async (tx) => {
    const user = await tx.authUser.create({
      data: input,
    });

    await tx.userActor.create({
      data: {
        id: user.id,
        type: 'registered',
        displayName: user.email,
        authUserId: user.id,
        lastSeenAt: new Date(),
      },
    });

    return user;
  });
}
