import type { GraphQLContext } from "../../graphql/context.js";
import { pubsub, TOPICS } from "../../graphql/pubsub.js";
import { addComment } from "./comments.service.js";

type CommentParent = {
  id: string;
  issueId: string;
  authorId: string;
  createdAt: Date;
};

export const commentsResolver = {
  Mutation: {
    addComment: async (
      _parent: unknown,
      args: { issueId: string; message: string },
      context: GraphQLContext
    ) => addComment(context, args.issueId, args.message)
  },

  Comment: {
    issue: async (parent: CommentParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.issueById.load(parent.issueId);
    },

    author: async (parent: CommentParent, _args: unknown, context: GraphQLContext) => {
      return context.loaders.userById.load(parent.authorId);
    },

    createdAt: (parent: CommentParent) => parent.createdAt.toISOString()
  },

  Subscription: {
    commentAdded: {
      subscribe: (_parent: unknown, args: { issueId: string }) => {
        return pubsub.asyncIterableIterator(TOPICS.COMMENT_ADDED(args.issueId));
      }
    }
  }
};
