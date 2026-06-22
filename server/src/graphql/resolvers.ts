import { authResolver } from "../modules/auth/auth.resolver.js";
import { usersResolver } from "../modules/users/users.resolver.js";
import { projectsResolver } from "../modules/projects/projects.resolver.js";
import { issuesResolver } from "../modules/issues/issues.resolver.js";
import { commentsResolver } from "../modules/comments/comments.resolver.js";

export const resolvers = {
  Query: {
    health: () => "DevConnectQL GraphQL API is running with Auth + PostgreSQL",
    ...usersResolver.Query,
    ...projectsResolver.Query,
    ...issuesResolver.Query
  },

  Mutation: {
    ...authResolver.Mutation,
    ...projectsResolver.Mutation,
    ...issuesResolver.Mutation,
    ...commentsResolver.Mutation
  },

  Subscription: {
    ...issuesResolver.Subscription,
    ...commentsResolver.Subscription
  },

  User: { ...usersResolver.User },
  Project: { ...projectsResolver.Project },
  ProjectMember: { ...projectsResolver.ProjectMember },
  Issue: { ...issuesResolver.Issue },
  Comment: { ...commentsResolver.Comment }
};
