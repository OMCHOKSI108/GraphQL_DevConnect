import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export const issuesRepository = {
  findById(prisma: PrismaClient, id: string) {
    return prisma.issue.findUnique({ where: { id } });
  },

  findManyPaginated(
    prisma: PrismaClient,
    where: Prisma.IssueWhereInput,
    params: { take: number; cursor?: { id: string }; skip?: number },
    orderBy: Prisma.IssueOrderByWithRelationInput[]
  ) {
    return prisma.issue.findMany({
      where,
      orderBy,
      take: params.take,
      skip: params.skip,
      cursor: params.cursor
    });
  },

  count(prisma: PrismaClient, where: Prisma.IssueWhereInput) {
    return prisma.issue.count({ where });
  },

  create(prisma: PrismaClient, data: Prisma.IssueCreateInput) {
    return prisma.issue.create({ data });
  },

  updateStatus(prisma: PrismaClient, id: string, status: Prisma.IssueUpdateInput["status"]) {
    return prisma.issue.update({ where: { id }, data: { status } });
  },

  updateAssignee(prisma: PrismaClient, id: string, userId: string) {
    return prisma.issue.update({ where: { id }, data: { assignedToId: userId } });
  }
};
