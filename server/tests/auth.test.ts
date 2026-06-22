import { describe, it, expect, beforeEach } from "vitest";
import { cleanDatabase } from "./helpers/db.js";
import { buildContext } from "./helpers/context.js";
import { executeOperation } from "./helpers/execute.js";
import { createUser } from "./helpers/fixtures.js";

const REGISTER = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) { token user { id name email role } }
  }
`;

const LOGIN = `
  mutation Login($input: LoginInput!) {
    login(input: $input) { token user { id name email role } }
  }
`;

const ME = `
  query Me {
    me { id name email }
  }
`;

describe("auth", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("registers a new user", async () => {
    const result = await executeOperation({
      query: REGISTER,
      variables: { input: { name: "Alice", email: "alice@example.com", password: "password123", skills: [] } },
      contextValue: buildContext(null)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.register).toMatchObject({
      user: { name: "Alice", email: "alice@example.com", role: "DEVELOPER" }
    });
    expect(typeof (result.data?.register as any).token).toBe("string");
  });

  it("rejects duplicate registration with CONFLICT", async () => {
    await executeOperation({
      query: REGISTER,
      variables: { input: { name: "Alice", email: "alice@example.com", password: "password123", skills: [] } },
      contextValue: buildContext(null)
    });

    const result = await executeOperation({
      query: REGISTER,
      variables: { input: { name: "Alice2", email: "alice@example.com", password: "password123", skills: [] } },
      contextValue: buildContext(null)
    });

    expect(result.errors?.[0].extensions?.code).toBe("CONFLICT");
  });

  it("logs in with valid credentials", async () => {
    await createUser("Bob", "bob@example.com");

    const result = await executeOperation({
      query: LOGIN,
      variables: { input: { email: "bob@example.com", password: "password123" } },
      contextValue: buildContext(null)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.login).toMatchObject({ user: { email: "bob@example.com" } });
  });

  it("rejects login with invalid password with AUTHENTICATION_REQUIRED", async () => {
    await createUser("Bob", "bob@example.com");

    const result = await executeOperation({
      query: LOGIN,
      variables: { input: { email: "bob@example.com", password: "wrong-password" } },
      contextValue: buildContext(null)
    });

    expect(result.errors?.[0].extensions?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns the current user for me query with a valid context", async () => {
    const user = await createUser("Carol", "carol@example.com");

    const result = await executeOperation({
      query: ME,
      contextValue: buildContext(user)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.me).toMatchObject({ name: "Carol", email: "carol@example.com" });
  });

  it("returns null for me query without authentication", async () => {
    const result = await executeOperation({
      query: ME,
      contextValue: buildContext(null)
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.me).toBeNull();
  });
});
