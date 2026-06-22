import type { Prisma, ProjectMember } from "../../generated/prisma/client.js";
import type { AuthUser, GraphQLContext } from "../../graphql/context.js";
import { requireAuth } from "../auth/auth.service.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../utils/errors.js";
import { paginate, type ConnectionArgs } from "../../utils/pagination.js";
import { pubsub, TOPICS } from "../../graphql/pubsub.js";
import { issuesRepository } from "./issues.repository.js";

type IssueStatusValue = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type SortDirection = "ASC" | "DESC";

export function canCreateIssue(user: AuthUser, membership: ProjectMember | null): boolean {
  return user.role === "ADMIN" || membership !== null;
}

export function canUpdateIssueProgress(user: AuthUser, issue: { assignedToId: string | null }): boolean {
  return user.role === "ADMIN" || issue.assignedToId === user.id;
}

export function canCloseIssue(
  user: AuthUser,
  issue: { createdById: string },
  membership: ProjectMember | null
): boolean {
  return (
    user.role === "ADMIN" ||
    issue.createdById === user.id ||
    membership?.role === "MAINTAINER" ||
    membership?.role === "OWNER"
  );
}

export function canAssignIssue(user: AuthUser, membership: ProjectMember | null): boolean {
  return user.role === "ADMIN" || membership?.role === "OWNER" || membership?.role === "MAINTAINER";
}

type IssueFilterInput = {
  status?: IssueStatusValue;
  assignedToId?: string;
  assignedToMe?: boolean;
  projectId?: string;
  createdById?: string;
  createdByMe?: boolean;
};

type IssueSortInput = {
  field?: "PRIORITY" | "CREATED_AT" | "STATUS";
  direction?: SortDirection;
};

function buildIssueWhere(context: GraphQLContext, filter?: IssueFilterInput): Prisma.IssueWhereInput {
  let assignedToId = filter?.assignedToId;
  let createdById = filter?.createdById;

  if (filter?.assignedToMe) {
    const user = requireAuth(context);
    assignedToId = user.id;
  }

  if (filter?.createdByMe) {
    const user = requireAuth(context);
    createdById = user.id;
  }

  return {
    status: filter?.status,
    assignedToId,
    projectId: filter?.projectId,
    createdById
  };
}

function buildIssueOrderBy(sort?: IssueSortInput): Prisma.IssueOrderByWithRelationInput[] {
  const direction = sort?.direction === "ASC" ? "asc" : "desc";

  switch (sort?.field) {
    case "PRIORITY":
      return [{ priority: direction }, { id: direction }];
    case "STATUS":
      return [{ status: direction }, { id: direction }];
    default:
      return [{ createdAt: direction }, { id: direction }];
  }
}

export async function listIssues(
  context: GraphQLContext,
  args: ConnectionArgs & { filter?: IssueFilterInput; sort?: IssueSortInput }
) {
  const where = buildIssueWhere(context, args.filter);
  const orderBy = buildIssueOrderBy(args.sort);

  return paginate(
    (params) => issuesRepository.findManyPaginated(context.prisma, where, params, orderBy),
    () => issuesRepository.count(context.prisma, where),
    args
  );
}

export async function getIssue(context: GraphQLContext, id: string) {
  return issuesRepository.findById(context.prisma, id);
}

export async function createIssue(
  context: GraphQLContext,
  input: { projectId: string; title: string; description: string; assignedToId?: string }
) {
  const user = requireAuth(context);

  const project = await context.prisma.project.findUnique({ where: { id: input.projectId } });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const membership = await context.loaders.membershipByProjectAndUser.load(`${input.projectId}:${user.id}`);

  if (!canCreateIssue(user, membership)) {
    throw new ForbiddenError("Only project members can create issues");
  }

  if (input.assignedToId) {
    const assignedUser = await context.prisma.user.findUnique({ where: { id: input.assignedToId } });

    if (!assignedUser) {
      throw new NotFoundError("Assigned user not found");
    }
  }

  return issuesRepository.create(context.prisma, {
    title: input.title,
    description: input.description,
    project: { connect: { id: input.projectId } },
    createdBy: { connect: { id: user.id } },
    assignedTo: input.assignedToId ? { connect: { id: input.assignedToId } } : undefined
  });
}

export async function updateIssueStatus(context: GraphQLContext, issueId: string, status: IssueStatusValue) {
  const user = requireAuth(context);

  const issue = await issuesRepository.findById(context.prisma, issueId);

  if (!issue) {
    throw new NotFoundError("Issue not found");
  }

  if (status === "CLOSED") {
    const membership = await context.loaders.membershipByProjectAndUser.load(`${issue.projectId}:${user.id}`);

    if (!canCloseIssue(user, issue, membership)) {
      throw new ForbiddenError("Only the issue creator or a project maintainer can close this issue");
    }
  } else if (!canUpdateIssueProgress(user, issue)) {
    throw new ForbiddenError("Only the assigned user can update this issue's progress");
  }

  const updatedIssue = await issuesRepository.updateStatus(context.prisma, issueId, status);

  await pubsub.publish(TOPICS.ISSUE_STATUS_CHANGED(issue.projectId), { issueStatusChanged: updatedIssue });

  return updatedIssue;
}

export async function assignIssue(context: GraphQLContext, issueId: string, userId: string) {
  const user = requireAuth(context);

  const issue = await issuesRepository.findById(context.prisma, issueId);

  if (!issue) {
    throw new NotFoundError("Issue not found");
  }

  const assignerMembership = await context.loaders.membershipByProjectAndUser.load(
    `${issue.projectId}:${user.id}`
  );

  if (!canAssignIssue(user, assignerMembership)) {
    throw new ForbiddenError("Only the project owner, a project maintainer, or an admin can assign issues");
  }

  const assignedUser = await context.prisma.user.findUnique({ where: { id: userId } });

  if (!assignedUser) {
    throw new NotFoundError("Assigned user not found");
  }

  const assigneeMembership = await context.loaders.membershipByProjectAndUser.load(
    `${issue.projectId}:${userId}`
  );

  if (!assigneeMembership) {
    throw new ValidationError("Assigned user must be a member of the project");
  }

  const updatedIssue = await issuesRepository.updateAssignee(context.prisma, issueId, userId);

  await pubsub.publish(TOPICS.ISSUE_ASSIGNED(userId), { issueAssigned: updatedIssue });

  return updatedIssue;
}
