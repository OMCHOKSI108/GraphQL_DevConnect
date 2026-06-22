import type { AuthUser, GraphQLContext } from "../../graphql/context.js";
import { ForbiddenError } from "../../utils/errors.js";
import { requireAuth } from "../auth/auth.service.js";
import { usersRepository } from "./users.repository.js";

export function canViewAllUsers(user: AuthUser): boolean {
  return user.role === "ADMIN";
}

export async function getMe(context: GraphQLContext) {
  if (!context.user) return null;

  return usersRepository.findById(context.prisma, context.user.id);
}

export async function listUsers(context: GraphQLContext) {
  const user = requireAuth(context);

  if (!canViewAllUsers(user)) {
    throw new ForbiddenError("Only admins can view all users");
  }

  return usersRepository.findMany(context.prisma);
}
