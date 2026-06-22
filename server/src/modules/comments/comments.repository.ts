import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export const commentsRepository = {
  findManyPaginated(
    prisma: PrismaClient,
    where: Prisma.CommentWhereInput,
    params: { take: number; cursor?: { id: string }; skip?: number },
    orderBy: Prisma.CommentOrderByWithRelationInput[]
  ) {
    return prisma.comment.findMany({
      where,
      orderBy,
      take: params.take,
      skip: params.skip,
      cursor: params.cursor
    });
  },

  count(prisma: PrismaClient, where: Prisma.CommentWhereInput) {
    return prisma.comment.count({ where });
  },

  create(prisma: PrismaClient, data: Prisma.CommentCreateInput) {
    return prisma.comment.create({ data });
  }
};
