import type { Request } from "express";
import { prisma } from "../config/prisma.js";
import { verifyToken } from "../utils/auth.js";
import { createLoaders, type Loaders } from "../loaders/index.js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "DEVELOPER" | "MAINTAINER" | "ADMIN";
};

export type GraphQLContext = {
  prisma: typeof prisma;
  user: AuthUser | null;
  loaders: Loaders;
};

async function resolveUserFromToken(token: string | null): Promise<AuthUser | null> {
  if (!token) return null;

  const payload = verifyToken(token);

  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  return user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    : null;
}

export async function createContext({ req }: { req: Request }): Promise<GraphQLContext> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

  const user = await resolveUserFromToken(token);

  return { prisma, user, loaders: createLoaders(prisma) };
}

export async function createWsContext(ctx: {
  connectionParams?: Record<string, unknown>;
}): Promise<GraphQLContext> {
  const rawAuth = ctx.connectionParams?.authorization;
  const token = typeof rawAuth === "string" ? rawAuth.replace("Bearer ", "") : null;

  const user = await resolveUserFromToken(token);

  return { prisma, user, loaders: createLoaders(prisma) };
}
