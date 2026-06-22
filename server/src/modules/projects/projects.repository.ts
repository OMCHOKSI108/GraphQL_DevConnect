import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export const projectsRepository = {
  findById(prisma: PrismaClient, id: string) {
    return prisma.project.findUnique({ where: { id } });
  },

  findManyPaginated(
    prisma: PrismaClient,
    where: Prisma.ProjectWhereInput,
    params: { take: number; cursor?: { id: string }; skip?: number },
    orderBy: Prisma.ProjectOrderByWithRelationInput[]
  ) {
    return prisma.project.findMany({
      where,
      orderBy,
      take: params.take,
      skip: params.skip,
      cursor: params.cursor
    });
  },

  count(prisma: PrismaClient, where: Prisma.ProjectWhereInput) {
    return prisma.project.count({ where });
  },

  create(prisma: PrismaClient, data: Prisma.ProjectCreateInput) {
    return prisma.project.create({ data });
  },

  delete(prisma: PrismaClient, id: string) {
    return prisma.project.delete({ where: { id } });
  },

  addMember(prisma: PrismaClient, projectId: string, userId: string, role: "OWNER" | "MAINTAINER" | "MEMBER") {
    return prisma.projectMember.create({
      data: { projectId, userId, role }
    });
  }
};
