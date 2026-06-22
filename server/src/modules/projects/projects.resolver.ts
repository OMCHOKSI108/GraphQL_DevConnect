import type { GraphQLContext } from "../../graphql/context.js";
import { addProjectMember, createProject, deleteProject, getProject, listProjects } from "./projects.service.js";

type ProjectParent = {
  id: string;
  ownerId: string;
  createdAt: Date;
};

type ProjectMemberParent = {
  id: string;
  projectId: string;
  userId: string;
  createdAt: Date;
};

export const projectsResolver = {
  Query: {
    projects: async (
      _parent: unknown,
      args: {
        first?: number;
        after?: string;
        filter?: { search?: string; techStack?: string; ownerId?: string; createdAfter?: string; createdBefore?: string };
        sort?: { field?: "CREATED_AT"; direction?: "ASC" | "DESC" };
      },
      context: GraphQLContext
    ) => listProjects(context, args),

    project: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => getProject(context, args.id)
  },

  Mutation: {
    createProject: async (
      _parent: unknown,
      args: { input: { title: string; description: string; techStack: string[]; ownerId: string } },
      context: GraphQLContext
    ) => createProject(context, args.input),

    deleteProject: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      return deleteProject(context, args.id);
    },

    addProjectMember: async (
      _parent: unknown,
      args: { projectId: string; userId: string; role?: "OWNER" | "MAINTAINER" | "MEMBER" },
      context: GraphQLContext
    ) => addProjectMember(context, args)
  },

  Project: {
    owner: async (parent: ProjectParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.userById.load(parent.ownerId);
    },

    members: async (parent: ProjectParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.projectMembersByProjectId.load(parent.id);
    },

    issues: async (parent: ProjectParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.issuesByProjectId.load(parent.id);
    },

    createdAt: (parent: ProjectParent) => parent.createdAt.toISOString()
  },

  ProjectMember: {
    user: async (parent: ProjectMemberParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.userById.load(parent.userId);
    },

    project: async (parent: ProjectMemberParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.projectById.load(parent.projectId);
    },

    createdAt: (parent: ProjectMemberParent) => parent.createdAt.toISOString()
  }
};
