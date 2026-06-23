import type { GraphQLContext } from "../../graphql/context.js";
import { requireAuth } from "../auth/auth.service.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { paginate, type ConnectionArgs } from "../../utils/pagination.js";
import { pubsub, TOPICS } from "../../graphql/pubsub.js";
import { commentsRepository } from "./comments.repository.js";

export async function listComments(context: GraphQLContext, issueId: string, args: ConnectionArgs) {
  const where = { issueId };
  const orderBy = [{ createdAt: "asc" as const }, { id: "asc" as const }];

  return paginate(
    (params) => commentsRepository.findManyPaginated(context.prisma, where, params, orderBy),
    () => commentsRepository.count(context.prisma, where),
    args
  );
}

export async function addComment(context: GraphQLContext, issueId: string, message: string) {
  const user = requireAuth(context);

  const issue = await context.prisma.issue.findUnique({ where: { id: issueId } });

  if (!issue) {
    throw new NotFoundError("Issue not found");
  }

  const membership = await context.loaders.membershipByProjectAndUser.load(`${issue.projectId}:${user.id}`);

  if (!membership && user.role !== "ADMIN") {
    throw new ForbiddenError("Only project members can add comments");
  }

  const newComment = await commentsRepository.create(context.prisma, {
    message,
    issue: { connect: { id: issueId } },
    author: { connect: { id: user.id } }
  });

  await pubsub.publish(TOPICS.COMMENT_ADDED(issueId), { commentAdded: newComment });

  return newComment;
}
