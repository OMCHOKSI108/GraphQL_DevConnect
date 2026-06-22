import type { GraphQLContext } from "../../graphql/context.js";
import { getMe, listUsers } from "./users.service.js";

type UserParent = {
  id: string;
  createdAt: Date;
};

export const usersResolver = {
  Query: {
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => getMe(context),
    users: async (_parent: unknown, _args: unknown, context: GraphQLContext) => listUsers(context)
  },

  User: {
    projects: async (parent: UserParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.projectsByOwnerId.load(parent.id);
    },

    assignedIssues: async (parent: UserParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.assignedIssuesByUserId.load(parent.id);
    },

    createdAt: (parent: UserParent) => parent.createdAt.toISOString()
  }
};
