import { describe, it, expect, beforeEach } from "vitest";
import { cleanDatabase } from "./helpers/db.js";
import { buildContext } from "./helpers/context.js";
import { executeOperation } from "./helpers/execute.js";
import { createUser } from "./helpers/fixtures.js";

const CREATE_PROJECT = `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      title
      owner { id name }
      members { role user { id name } }
    }
  }
`;

const DELETE_PROJECT = `
  mutation DeleteProject($id: ID!) {
    deleteProject(id: $id)
  }
`;

const ADD_MEMBER = `
  mutation AddMember($projectId: ID!, $userId: ID!, $role: ProjectRole) {
    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {
      role
      user { name }
    }
  }
`;

const PROJECTS = `
  query Projects($first: Int, $after: String, $filter: ProjectFilterInput, $sort: ProjectSort) {
    projects(first: $first, after: $after, filter: $filter, sort: $sort) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { cursor node { id title techStack createdAt } }
    }
  }
`;

describe("projects", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("allows an authenticated user to create a project, auto-adding them as OWNER", async () => {
    const owner = await createUser("Owner", "owner@example.com");

    const result = await executeOperation({
      query: CREATE_PROJECT,
      variables: { input: { title: "DevConnectQL", description: "desc", techStack: ["GraphQL"], ownerId: owner.id } },
      contextValue: buildContext(owner)
    });

    expect(result.errors).toBeUndefined();
    const project = result.data?.createProject as any;
    expect(project.owner.id).toBe(owner.id);
    expect(project.members).toEqual([{ role: "OWNER", user: { id: owner.id, name: "Owner" } }]);
  });

  it("rejects createProject for an unauthenticated user", async () => {
    const result = await executeOperation({
      query: CREATE_PROJECT,
      variables: { input: { title: "X", description: "x", techStack: [], ownerId: "irrelevant" } },
      contextValue: buildContext(null)
    });

    expect(result.errors?.[0].extensions?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("lets the owner add a project member", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const member = await createUser("Member", "member@example.com");

    const created = await executeOperation({
      query: CREATE_PROJECT,
      variables: { input: { title: "P", description: "d", techStack: [], ownerId: owner.id } },
      contextValue: buildContext(owner)
    });
    const projectId = (created.data?.createProject as any).id;

    const result = await executeOperation({
      query: ADD_MEMBER,
      variables: { projectId, userId: member.id, role: "MEMBER" },
      contextValue: buildContext(owner)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.addProjectMember).toMatchObject({ role: "MEMBER", user: { name: "Member" } });
  });

  it("lets the owner delete their project", async () => {
    const owner = await createUser("Owner", "owner@example.com");

    const created = await executeOperation({
      query: CREATE_PROJECT,
      variables: { input: { title: "P", description: "d", techStack: [], ownerId: owner.id } },
      contextValue: buildContext(owner)
    });
    const projectId = (created.data?.createProject as any).id;

    const result = await executeOperation({
      query: DELETE_PROJECT,
      variables: { id: projectId },
      contextValue: buildContext(owner)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.deleteProject).toBe(true);
  });

  it("forbids a normal member from deleting the project", async () => {
    const owner = await createUser("Owner", "owner@example.com");
    const member = await createUser("Member", "member@example.com");

    const created = await executeOperation({
      query: CREATE_PROJECT,
      variables: { input: { title: "P", description: "d", techStack: [], ownerId: owner.id } },
      contextValue: buildContext(owner)
    });
    const projectId = (created.data?.createProject as any).id;

    await executeOperation({
      query: ADD_MEMBER,
      variables: { projectId, userId: member.id, role: "MEMBER" },
      contextValue: buildContext(owner)
    });

    const result = await executeOperation({
      query: DELETE_PROJECT,
      variables: { id: projectId },
      contextValue: buildContext(member)
    });

    expect(result.errors?.[0].extensions?.code).toBe("FORBIDDEN");
  });

  it("paginates projects with cursor-based connections", async () => {
    const owner = await createUser("Owner", "owner@example.com");

    for (const title of ["A", "B", "C"]) {
      await executeOperation({
        query: CREATE_PROJECT,
        variables: { input: { title, description: "d", techStack: [], ownerId: owner.id } },
        contextValue: buildContext(owner)
      });
    }

    const firstPage = await executeOperation({
      query: PROJECTS,
      variables: { first: 2 },
      contextValue: buildContext(null)
    });

    const firstPageData = firstPage.data?.projects as any;
    expect(firstPageData.totalCount).toBe(3);
    expect(firstPageData.edges).toHaveLength(2);
    expect(firstPageData.pageInfo.hasNextPage).toBe(true);

    const secondPage = await executeOperation({
      query: PROJECTS,
      variables: { first: 2, after: firstPageData.pageInfo.endCursor },
      contextValue: buildContext(null)
    });

    const secondPageData = secondPage.data?.projects as any;
    expect(secondPageData.edges).toHaveLength(1);
    expect(secondPageData.pageInfo.hasNextPage).toBe(false);

    const firstIds = firstPageData.edges.map((e: any) => e.node.id);
    const secondIds = secondPageData.edges.map((e: any) => e.node.id);
    expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
  });

  it("filters projects by tech stack", async () => {
    const owner = await createUser("Owner", "owner@example.com");

    await executeOperation({
      query: CREATE_PROJECT,
      variables: { input: { title: "GraphQL Project", description: "d", techStack: ["GraphQL"], ownerId: owner.id } },
      contextValue: buildContext(owner)
    });
    await executeOperation({
      query: CREATE_PROJECT,
      variables: { input: { title: "REST Project", description: "d", techStack: ["REST"], ownerId: owner.id } },
      contextValue: buildContext(owner)
    });

    const result = await executeOperation({
      query: PROJECTS,
      variables: { filter: { techStack: "GraphQL" } },
      contextValue: buildContext(null)
    });

    const data = result.data?.projects as any;
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0].node.title).toBe("GraphQL Project");
  });

  it("sorts projects by createdAt ascending and descending", async () => {
    const owner = await createUser("Owner", "owner@example.com");

    for (const title of ["First", "Second", "Third"]) {
      await executeOperation({
        query: CREATE_PROJECT,
        variables: { input: { title, description: "d", techStack: [], ownerId: owner.id } },
        contextValue: buildContext(owner)
      });
    }

    const asc = await executeOperation({
      query: PROJECTS,
      variables: { sort: { field: "CREATED_AT", direction: "ASC" } },
      contextValue: buildContext(null)
    });
    const desc = await executeOperation({
      query: PROJECTS,
      variables: { sort: { field: "CREATED_AT", direction: "DESC" } },
      contextValue: buildContext(null)
    });

    const ascTitles = (asc.data?.projects as any).edges.map((e: any) => e.node.title);
    const descTitles = (desc.data?.projects as any).edges.map((e: any) => e.node.title);

    expect(ascTitles).toEqual(["First", "Second", "Third"]);
    expect(descTitles).toEqual(["Third", "Second", "First"]);
  });
});
