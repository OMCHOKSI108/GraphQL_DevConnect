import { describe, it, expect, beforeEach } from "vitest";
import { cleanDatabase } from "./helpers/db.js";
import { buildContext } from "./helpers/context.js";
import { executeOperation } from "./helpers/execute.js";
import { createUser, createProjectWithMembers, addMember, createIssue } from "./helpers/fixtures.js";

const CREATE_ISSUE = `
  mutation CreateIssue($input: CreateIssueInput!) {
    createIssue(input: $input) { id title status priority createdBy { id } assignedTo { id } }
  }
`;

const UPDATE_STATUS = `
  mutation UpdateStatus($issueId: ID!, $status: IssueStatus!) {
    updateIssueStatus(issueId: $issueId, status: $status) { id status }
  }
`;

const ISSUES = `
  query Issues($first: Int, $after: String, $filter: IssueFilterInput, $sort: IssueSort) {
    issues(first: $first, after: $after, filter: $filter, sort: $sort) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { cursor node { id title status priority assignedTo { id } createdBy { id } } }
    }
  }
`;

describe("issues", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("lets a project member create an issue", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const project = await createProjectWithMembers(owner);

    const result = await executeOperation({
      query: CREATE_ISSUE,
      variables: { input: { projectId: project.id, title: "Bug", description: "d" } },
      contextValue: buildContext(owner)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.createIssue).toMatchObject({ title: "Bug", status: "OPEN" });
  });

  it("forbids a non-project member from creating an issue", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const outsider = await createUser("Outsider", "outsider@example.com");
    const project = await createProjectWithMembers(owner);

    const result = await executeOperation({
      query: CREATE_ISSUE,
      variables: { input: { projectId: project.id, title: "Bug", description: "d" } },
      contextValue: buildContext(outsider)
    });

    expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");
  });

  it("paginates issues", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const project = await createProjectWithMembers(owner);

    for (const title of ["Issue A", "Issue B", "Issue C"]) {
      await createIssue({ projectId: project.id, createdById: owner.id, title });
    }

    const firstPage = await executeOperation({
      query: ISSUES,
      variables: { first: 2 },
      contextValue: buildContext(null)
    });

    const firstPageData = firstPage.data?.issues as any;
    expect(firstPageData.totalCount).toBe(3);
    expect(firstPageData.edges).toHaveLength(2);
    expect(firstPageData.pageInfo.hasNextPage).toBe(true);
  });

  it("filters issues by status", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const project = await createProjectWithMembers(owner);

    await createIssue({ projectId: project.id, createdById: owner.id, status: "OPEN", title: "Open issue" });
    await createIssue({ projectId: project.id, createdById: owner.id, status: "RESOLVED", title: "Resolved issue" });

    const result = await executeOperation({
      query: ISSUES,
      variables: { filter: { status: "RESOLVED" } },
      contextValue: buildContext(null)
    });

    const data = result.data?.issues as any;
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0].node.title).toBe("Resolved issue");
  });

  it("sorts issues by priority", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const project = await createProjectWithMembers(owner);

    await createIssue({ projectId: project.id, createdById: owner.id, priority: "LOW", title: "Low" });
    await createIssue({ projectId: project.id, createdById: owner.id, priority: "URGENT", title: "Urgent" });
    await createIssue({ projectId: project.id, createdById: owner.id, priority: "MEDIUM", title: "Medium" });

    const result = await executeOperation({
      query: ISSUES,
      variables: { sort: { field: "PRIORITY", direction: "DESC" } },
      contextValue: buildContext(null)
    });

    const titles = (result.data?.issues as any).edges.map((e: any) => e.node.title);
    expect(titles).toEqual(["Urgent", "Medium", "Low"]);
  });

  it("filters issues assigned to me", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const member = await createUser("Member", "member@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, member.id, "MEMBER");

    await createIssue({ projectId: project.id, createdById: owner.id, assignedToId: member.id, title: "Assigned to member" });
    await createIssue({ projectId: project.id, createdById: owner.id, title: "Unassigned" });

    const result = await executeOperation({
      query: ISSUES,
      variables: { filter: { assignedToMe: true } },
      contextValue: buildContext(member)
    });

    const data = result.data?.issues as any;
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0].node.title).toBe("Assigned to member");
  });

  it("filters issues created by me", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const member = await createUser("Member", "member@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, member.id, "MEMBER");

    await createIssue({ projectId: project.id, createdById: member.id, title: "Created by member" });
    await createIssue({ projectId: project.id, createdById: owner.id, title: "Created by owner" });

    const result = await executeOperation({
      query: ISSUES,
      variables: { filter: { createdByMe: true } },
      contextValue: buildContext(member)
    });

    const data = result.data?.issues as any;
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0].node.title).toBe("Created by member");
  });

  it("lets the assignee update issue status", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const member = await createUser("Member", "member@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, member.id, "MEMBER");

    const issue = await createIssue({ projectId: project.id, createdById: owner.id, assignedToId: member.id });

    const result = await executeOperation({
      query: UPDATE_STATUS,
      variables: { issueId: issue.id, status: "IN_PROGRESS" },
      contextValue: buildContext(member)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.updateIssueStatus).toMatchObject({ status: "IN_PROGRESS" });
  });

  it("forbids a non-assignee from updating issue status", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const member = await createUser("Member", "member@example.com");
    const someoneElse = await createUser("Someone Else", "someone@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, member.id, "MEMBER");
    await addMember(project.id, someoneElse.id, "MEMBER");

    const issue = await createIssue({ projectId: project.id, createdById: owner.id, assignedToId: member.id });

    const result = await executeOperation({
      query: UPDATE_STATUS,
      variables: { issueId: issue.id, status: "IN_PROGRESS" },
      contextValue: buildContext(someoneElse)
    });

    expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");
  });
});
