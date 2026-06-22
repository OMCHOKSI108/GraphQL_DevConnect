import type { Prisma, ProjectMember } from "../../generated/prisma/client.js";
import type { AuthUser, GraphQLContext } from "../../graphql/context.js";
import { paginate, type ConnectionArgs } from "../../utils/pagination.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { requireAuth } from "../auth/auth.service.js";
import { projectsRepository } from "./projects.repository.js";

export function canDeleteProject(user: AuthUser, project: { ownerId: string }): boolean {
  return user.role === "ADMIN" || project.ownerId === user.id;
}

export function canAddProjectMember(
  user: AuthUser,
  project: { ownerId: string },
  membership: ProjectMember | null
): boolean {
  return user.role === "ADMIN" || project.ownerId === user.id || membership?.role === "OWNER";
}

type SortDirection = "ASC" | "DESC";

type ProjectFilterInput = {
  search?: string;
  techStack?: string;
  ownerId?: string;
  createdAfter?: string;
  createdBefore?: string;
};

type ProjectSortInput = {
  field?: "CREATED_AT";
  direction?: SortDirection;
};

function buildProjectWhere(filter?: ProjectFilterInput): Prisma.ProjectWhereInput {
  return {
    title: filter?.search
      ? {
          contains: filter.search,
          mode: "insensitive"
        }
      : undefined,
    techStack: filter?.techStack
      ? {
          has: filter.techStack
        }
      : undefined,
    ownerId: filter?.ownerId,
    createdAt:
      filter?.createdAfter || filter?.createdBefore
        ? {
            gte: filter.createdAfter ? new Date(filter.createdAfter) : undefined,
            lte: filter.createdBefore ? new Date(filter.createdBefore) : undefined
          }
        : undefined
  };
}

function buildProjectOrderBy(sort?: ProjectSortInput): Prisma.ProjectOrderByWithRelationInput[] {
  const direction = sort?.direction === "ASC" ? "asc" : "desc";

  return [{ createdAt: direction }, { id: direction }];
}

export async function listProjects(
  context: GraphQLContext,
  args: ConnectionArgs & { filter?: ProjectFilterInput; sort?: ProjectSortInput }
) {
  const where = buildProjectWhere(args.filter);
  const orderBy = buildProjectOrderBy(args.sort);

  return paginate(
    (params) => projectsRepository.findManyPaginated(context.prisma, where, params, orderBy),
    () => projectsRepository.count(context.prisma, where),
    args
  );
}

export async function getProject(context: GraphQLContext, id: string) {
  return projectsRepository.findById(context.prisma, id);
}

export async function createProject(
  context: GraphQLContext,
  input: { title: string; description: string; techStack: string[]; ownerId: string }
) {
  const user = requireAuth(context);

  return projectsRepository.create(context.prisma, {
    title: input.title,
    description: input.description,
    techStack: input.techStack,
    owner: { connect: { id: user.id } },
    members: {
      create: [{ userId: user.id, role: "OWNER" }]
    }
  });
}

export async function deleteProject(context: GraphQLContext, id: string) {
  const user = requireAuth(context);

  const project = await projectsRepository.findById(context.prisma, id);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (!canDeleteProject(user, project)) {
    throw new ForbiddenError("Only the project owner or an admin can delete this project");
  }

  await projectsRepository.delete(context.prisma, id);

  return true;
}

export async function addProjectMember(
  context: GraphQLContext,
  input: { projectId: string; userId: string; role?: "OWNER" | "MAINTAINER" | "MEMBER" }
) {
  const user = requireAuth(context);

  const project = await projectsRepository.findById(context.prisma, input.projectId);

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const membership = await context.loaders.membershipByProjectAndUser.load(`${input.projectId}:${user.id}`);

  if (!canAddProjectMember(user, project, membership)) {
    throw new ForbiddenError("Only the project owner or an admin can add members");
  }

  const targetUser = await context.prisma.user.findUnique({ where: { id: input.userId } });

  if (!targetUser) {
    throw new NotFoundError("User not found");
  }

  return projectsRepository.addMember(context.prisma, input.projectId, input.userId, input.role ?? "MEMBER");
}
