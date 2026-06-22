import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

export const TOPICS = {
  ISSUE_STATUS_CHANGED: (projectId: string) => `ISSUE_STATUS_CHANGED:${projectId}`,
  COMMENT_ADDED: (issueId: string) => `COMMENT_ADDED:${issueId}`,
  ISSUE_ASSIGNED: (userId: string) => `ISSUE_ASSIGNED:${userId}`
} as const;
