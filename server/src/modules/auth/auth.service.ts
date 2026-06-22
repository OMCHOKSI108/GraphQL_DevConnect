import { prisma } from "../../config/prisma.js";
import { comparePassword, createToken, hashPassword } from "../../utils/auth.js";
import { AuthenticationRequiredError, ConflictError, ValidationError } from "../../utils/errors.js";
import type { AuthUser, GraphQLContext } from "../../graphql/context.js";

export function requireAuth(context: GraphQLContext): AuthUser {
  if (!context.user) {
    throw new AuthenticationRequiredError();
  }

  return context.user;
}

export async function register(input: { name: string; email: string; password: string; skills: string[] }) {
  const email = input.email.toLowerCase().trim();

  if (input.password.length < 6) {
    throw new ValidationError("Password must be at least 6 characters long");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    throw new ConflictError("User already exists with this email");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash,
      skills: input.skills,
      role: "DEVELOPER"
    }
  });

  const token = createToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  return { token, user };
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      skills: true,
      createdAt: true,
      updatedAt: true,
      passwordHash: true
    }
  });

  if (!user) {
    throw new AuthenticationRequiredError("Invalid email or password");
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AuthenticationRequiredError("Invalid email or password");
  }

  const token = createToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  return { token, user };
}
