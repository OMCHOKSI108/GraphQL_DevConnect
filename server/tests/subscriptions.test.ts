import { describe, it, expect, beforeEach } from "vitest";
import { cleanDatabase } from "./helpers/db.js";
import { buildContext } from "./helpers/context.js";
import { executeOperation } from "./helpers/execute.js";
import { createUser, createProjectWithMembers, addMember, createIssue } from "./helpers/fixtures.js";
import { resolvers } from "../src/graphql/resolvers.js";

const UPDATE_STATUS = `
  mutation UpdateStatus($issueId: ID!, $status: IssueStatus!) {
    updateIssueStatus(issueId: $issueId, status: $status) { id status }
  }
`;

const ADD_COMMENT = `
  mutation AddComment($issueId: ID!, $message: String!) {
    addComment(issueId: $issueId, message: $message) { id message }
  }
`;

const ASSIGN_ISSUE = `
  mutation AssignIssue($issueId: ID!, $userId: ID!) {
    assignIssue(issueId: $issueId, userId: $userId) { id }
  }
`;

describe("subscriptions", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("publishes issueStatusChanged when an issue's status is updated", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const project = await createProjectWithMembers(owner);
    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const iterator = resolvers.Subscription.issueStatusChanged.subscribe(null, { projectId: project.id });
    const nextEvent = iterator.next();

    await executeOperation({
      query: UPDATE_STATUS,
      variables: { issueId: issue.id, status: "CLOSED" },
      contextValue: buildContext(owner)
    });

    const { value } = await nextEvent;
    expect((value as any).issueStatusChanged).toMatchObject({ id: issue.id, status: "CLOSED" });
  });

  it("publishes commentAdded when a comment is added", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const project = await createProjectWithMembers(owner);
    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const iterator = resolvers.Subscription.commentAdded.subscribe(null, { issueId: issue.id });
    const nextEvent = iterator.next();

    await executeOperation({
      query: ADD_COMMENT,
      variables: { issueId: issue.id, message: "Hello" },
      contextValue: buildContext(owner)
    });

    const { value } = await nextEvent;
    expect((value as any).commentAdded).toMatchObject({ message: "Hello" });
  });

  it("publishes issueAssigned when an issue is assigned", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const member = await createUser("Member", "member@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, member.id, "MEMBER");
    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const iterator = resolvers.Subscription.issueAssigned.subscribe(null, { userId: member.id }, buildContext(member));
    const nextEvent = iterator.next();

    await executeOperation({
      query: ASSIGN_ISSUE,
      variables: { issueId: issue.id, userId: member.id },
      contextValue: buildContext(owner)
    });

    const { value } = await nextEvent;
    expect((value as any).issueAssigned).toMatchObject({ id: issue.id });
  });

  it("rejects subscribing to another user's issueAssigned notifications", async () => {
    const member = await createUser("Member", "member@example.com");
    const someoneElse = await createUser("Someone Else", "someone@example.com");

    expect(() =>
      resolvers.Subscription.issueAssigned.subscribe(null, { userId: someoneElse.id }, buildContext(member))
    ).toThrowError(/own assignment notifications/);
  });
});
