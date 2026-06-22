import type { GraphQLContext } from "../../graphql/context.js";
import { pubsub, TOPICS } from "../../graphql/pubsub.js";
import { ForbiddenError } from "../../utils/errors.js";
import { requireAuth } from "../auth/auth.service.js";
import { listComments } from "../comments/comments.service.js";
import { assignIssue, createIssue, getIssue, listIssues, updateIssueStatus } from "./issues.service.js";

type IssueStatusValue = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

type IssueParent = {
  id: string;
  projectId: string;
  createdById: string;
  assignedToId: string | null;
  createdAt: Date;
};

export const issuesResolver = {
  Query: {
    issues: async (
      _parent: unknown,
      args: {
        first?: number;
        after?: string;
        filter?: {
          status?: IssueStatusValue;
          assignedToId?: string;
          assignedToMe?: boolean;
          projectId?: string;
          createdById?: string;
          createdByMe?: boolean;
        };
        sort?: { field?: "PRIORITY" | "CREATED_AT" | "STATUS"; direction?: "ASC" | "DESC" };
      },
      context: GraphQLContext
    ) => {
      return listIssues(context, args);
    },

    issue: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => getIssue(context, args.id)
  },

  Mutation: {
    createIssue: async (
      _parent: unknown,
      args: {
        input: { projectId: string; title: string; description: string; assignedToId?: string };
      },
      context: GraphQLContext
    ) => createIssue(context, args.input),

    updateIssueStatus: async (
      _parent: unknown,
      args: { issueId: string; status: IssueStatusValue },
      context: GraphQLContext
    ) => updateIssueStatus(context, args.issueId, args.status),

    assignIssue: async (
      _parent: unknown,
      args: { issueId: string; userId: string },
      context: GraphQLContext
    ) => assignIssue(context, args.issueId, args.userId)
  },

  Issue: {
    project: async (parent: IssueParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.projectById.load(parent.projectId);
    },

    createdBy: async (parent: IssueParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.userById.load(parent.createdById);
    },

    assignedTo: async (parent: IssueParent, _args: unknown, context: GraphQLContext) => {
      if (!parent.assignedToId) return null;

      return context.loaders.userById.load(parent.assignedToId);
    },

    comments: async (
      parent: IssueParent,
      args: { first?: number; after?: string },
      context: GraphQLContext
    ) => {
      return listComments(context, parent.id, args);
    },

    createdAt: (parent: IssueParent) => parent.createdAt.toISOString()
  },

  Subscription: {
    issueStatusChanged: {
      subscribe: (_parent: unknown, args: { projectId: string }) => {
        return pubsub.asyncIterableIterator(TOPICS.ISSUE_STATUS_CHANGED(args.projectId));
      }
    },

    issueAssigned: {
      subscribe: (_parent: unknown, args: { userId: string }, context: GraphQLContext) => {
        const user = requireAuth(context);

        if (args.userId !== user.id && user.role !== "ADMIN") {
          throw new ForbiddenError("You can only subscribe to your own assignment notifications");
        }

        return pubsub.asyncIterableIterator(TOPICS.ISSUE_ASSIGNED(args.userId));
      }
    }
  }
};
