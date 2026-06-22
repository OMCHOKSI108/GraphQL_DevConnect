import { describe, it, expect, beforeEach } from "vitest";
import { cleanDatabase } from "./helpers/db.js";
import { buildContext } from "./helpers/context.js";
import { executeOperation } from "./helpers/execute.js";
import { createUser, createProjectWithMembers } from "./helpers/fixtures.js";

const CREATE_ISSUE = `
  mutation CreateIssue($input: CreateIssueInput!) {
    createIssue(input: $input) { id }
  }
`;

const UPDATE_STATUS = `
  mutation UpdateStatus($issueId: ID!, $status: IssueStatus!) {
    updateIssueStatus(issueId: $issueId, status: $status) { id }
  }
`;

const REGISTER = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) { token }
  }
`;

describe("structured errors", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("returns AUTHENTICATION_REQUIRED with http.status 401 for unauthenticated operations", async () => {
    const result = await executeOperation({
      query: CREATE_ISSUE,
      variables: { input: { projectId: "irrelevant", title: "x", description: "x" } },
      contextValue: buildContext(null)
    });

    expect(result.errors?.[0].extensions).toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
      http: { status: 401 }
    });
  });

  it("returns FORBIDDEN with http.status 403 for forbidden operations", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const outsider = await createUser("Outsider", "outsider@example.com");
    const project = await createProjectWithMembers(owner);

    const result = await executeOperation({
      query: CREATE_ISSUE,
      variables: { input: { projectId: project.id, title: "x", description: "x" } },
      contextValue: buildContext(outsider)
    });

    expect(result.errors?.[0].extensions).toMatchObject({
      code: "FORBIDDEN",
      http: { status: 403 }
    });
  });

  it("returns NOT_FOUND with http.status 404 for a missing resource", async () => {
    const owner = await createUser("Owner", "owner@example.com");

    const result = await executeOperation({
      query: UPDATE_STATUS,
      variables: { issueId: "00000000-0000-0000-0000-000000000000", status: "CLOSED" },
      contextValue: buildContext(owner)
    });

    expect(result.errors?.[0].extensions).toMatchObject({
      code: "NOT_FOUND",
      http: { status: 404 }
    });
  });

  it("returns VALIDATION_ERROR with http.status 400 for invalid input", async () => {
    const result = await executeOperation({
      query: REGISTER,
      variables: { input: { name: "X", email: "short@example.com", password: "123", skills: [] } },
      contextValue: buildContext(null)
    });

    expect(result.errors?.[0].extensions).toMatchObject({
      code: "VALIDATION_ERROR",
      http: { status: 400 }
    });
  });

  it("returns CONFLICT with http.status 409 for duplicate registration", async () => {
    await createUser("Existing", "existing@example.com");

    const result = await executeOperation({
      query: REGISTER,
      variables: { input: { name: "Existing2", email: "existing@example.com", password: "password123", skills: [] } },
      contextValue: buildContext(null)
    });

    expect(result.errors?.[0].extensions).toMatchObject({
      code: "CONFLICT",
      http: { status: 409 }
    });
  });
});
