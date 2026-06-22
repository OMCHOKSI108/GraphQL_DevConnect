import { describe, it, expect, beforeEach } from "vitest";
import { cleanDatabase } from "./helpers/db.js";
import { buildContext } from "./helpers/context.js";
import { executeOperation } from "./helpers/execute.js";
import { createUser, createProjectWithMembers, addMember, createIssue } from "./helpers/fixtures.js";

const ASSIGN_ISSUE = `
  mutation AssignIssue($issueId: ID!, $userId: ID!) {
    assignIssue(issueId: $issueId, userId: $userId) { id assignedTo { id name } }
  }
`;

describe("assignIssue RBAC", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("allows a global ADMIN to assign any issue, even outside their own projects", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const admin = await createUser("Admin", "admin@example.com", "ADMIN");
    const member = await createUser("Member", "member@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, member.id, "MEMBER");

    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const result = await executeOperation({
      query: ASSIGN_ISSUE,
      variables: { issueId: issue.id, userId: member.id },
      contextValue: buildContext(admin)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.assignIssue).toMatchObject({ assignedTo: { id: member.id } });
  });

  it("allows the project OWNER to assign an issue", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const member = await createUser("Member", "member@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, member.id, "MEMBER");

    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const result = await executeOperation({
      query: ASSIGN_ISSUE,
      variables: { issueId: issue.id, userId: member.id },
      contextValue: buildContext(owner)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.assignIssue).toMatchObject({ assignedTo: { id: member.id } });
  });

  it("allows a project MAINTAINER to assign an issue", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const maintainer = await createUser("Maintainer", "maintainer@example.com");
    const member = await createUser("Member", "member@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, maintainer.id, "MAINTAINER");
    await addMember(project.id, member.id, "MEMBER");

    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const result = await executeOperation({
      query: ASSIGN_ISSUE,
      variables: { issueId: issue.id, userId: member.id },
      contextValue: buildContext(maintainer)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.assignIssue).toMatchObject({ assignedTo: { id: member.id } });
  });

  it("forbids a plain project MEMBER from assigning an issue", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const member = await createUser("Member", "member@example.com");
    const anotherMember = await createUser("Another Member", "another@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, member.id, "MEMBER");
    await addMember(project.id, anotherMember.id, "MEMBER");

    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const result = await executeOperation({
      query: ASSIGN_ISSUE,
      variables: { issueId: issue.id, userId: anotherMember.id },
      contextValue: buildContext(member)
    });

    expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");
  });

  it("forbids a non-project user from assigning an issue", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const outsider = await createUser("Outsider", "outsider@example.com");
    const member = await createUser("Member", "member@example.com");
    const project = await createProjectWithMembers(owner);
    await addMember(project.id, member.id, "MEMBER");

    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const result = await executeOperation({
      query: ASSIGN_ISSUE,
      variables: { issueId: issue.id, userId: member.id },
      contextValue: buildContext(outsider)
    });

    expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");
  });

  it("rejects assigning an issue to a user outside the project with VALIDATION_ERROR", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const outsider = await createUser("Outsider", "outsider@example.com");
    const project = await createProjectWithMembers(owner);

    const issue = await createIssue({ projectId: project.id, createdById: owner.id });

    const result = await executeOperation({
      query: ASSIGN_ISSUE,
      variables: { issueId: issue.id, userId: outsider.id },
      contextValue: buildContext(owner)
    });

    expect(result.errors?.[0].extensions?.code).toBe("VALIDATION_ERROR");
  });
});
