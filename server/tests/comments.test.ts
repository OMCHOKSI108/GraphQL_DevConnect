import { describe, it, expect, beforeEach } from "vitest";
import { cleanDatabase } from "./helpers/db.js";
import { buildContext } from "./helpers/context.js";
import { executeOperation } from "./helpers/execute.js";
import { createUser, createProjectWithMembers, createIssue } from "./helpers/fixtures.js";

const ADD_COMMENT = `
  mutation AddComment($issueId: ID!, $message: String!) {
    addComment(issueId: $issueId, message: $message) { id message author { id } }
  }
`;

const ISSUE_COMMENTS = `
  query IssueComments($id: ID!, $first: Int, $after: String) {
    issue(id: $id) {
      comments(first: $first, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        edges { node { id message } }
      }
    }
  }
`;

describe("comments", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("lets a project member add a comment", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const project = await createProjectWithMembers(owner);
    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const result = await executeOperation({
      query: ADD_COMMENT,
      variables: { issueId: issue.id, message: "Looks good" },
      contextValue: buildContext(owner)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.addComment).toMatchObject({ message: "Looks good", author: { id: owner.id } });
  });

  it("rejects comments from a user who is not a project member", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const outsider = await createUser("Outsider", "outsider@example.com");
    const project = await createProjectWithMembers(owner);
    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const result = await executeOperation({
      query: ADD_COMMENT,
      variables: { issueId: issue.id, message: "Outsider comment" },
      contextValue: buildContext(outsider)
    });

    expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");
  });

  it("rejects commenting from an unauthenticated context", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const project = await createProjectWithMembers(owner);
    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const result = await executeOperation({
      query: ADD_COMMENT,
      variables: { issueId: issue.id, message: "Anonymous comment" },
      contextValue: buildContext(null)
    });

    expect(result.errors?.[0].extensions?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("paginates an issue's comments", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const project = await createProjectWithMembers(owner);
    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    for (const message of ["First", "Second", "Third"]) {
      await executeOperation({
        query: ADD_COMMENT,
        variables: { issueId: issue.id, message },
        contextValue: buildContext(owner)
      });
    }

    const result = await executeOperation({
      query: ISSUE_COMMENTS,
      variables: { id: issue.id, first: 2 },
      contextValue: buildContext(owner)
    });

    const comments = (result.data?.issue as any).comments;
    expect(comments.totalCount).toBe(3);
    expect(comments.edges).toHaveLength(2);
    expect(comments.pageInfo.hasNextPage).toBe(true);
  });
});
