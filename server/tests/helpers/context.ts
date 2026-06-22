import { prisma } from "../../src/config/prisma.js";
import { createLoaders } from "../../src/loaders/index.js";
import type { AuthUser, GraphQLContext } from "../../src/graphql/context.js";

export function buildContext(user: AuthUser | null = null): GraphQLContext {
  return { prisma, user, loaders: createLoaders(prisma) };
}
