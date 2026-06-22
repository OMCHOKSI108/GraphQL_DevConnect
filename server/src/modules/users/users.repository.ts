import type { PrismaClient } from "../../generated/prisma/client.js";

export const usersRepository = {
  findById(prisma: PrismaClient, id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findMany(prisma: PrismaClient) {
    return prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  }
};
