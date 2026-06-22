import { prisma } from "../../src/config/prisma.js";
import { hashPassword } from "../../src/utils/auth.js";
import type { AuthUser } from "../../src/graphql/context.js";

type Role = "DEVELOPER" | "MAINTAINER" | "ADMIN";
type ProjectRole = "OWNER" | "MAINTAINER" | "MEMBER";

export async function createUser(name: string, email: string, role: Role = "DEVELOPER"): Promise<AuthUser> {
  const passwordHash = await hashPassword("password123");

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, skills: [] }
  });

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function createProjectWithMembers(owner: AuthUser) {
  return prisma.project.create({
    data: {
      title: "Test Project",
      description: "A project for tests",
      techStack: ["GraphQL", "TypeScript"],
      owner: { connect: { id: owner.id } },
      members: { create: [{ userId: owner.id, role: "OWNER" }] }
    }
  });
}

export async function addMember(projectId: string, userId: string, role: ProjectRole) {
  return prisma.projectMember.create({ data: { projectId, userId, role } });
}

export async function createIssue(params: {
  projectId: string;
  createdById: string;
  assignedToId?: string;
  title?: string;
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  return prisma.issue.create({
    data: {
      title: params.title ?? "Test issue",
      description: "An issue for tests",
      status: params.status ?? "OPEN",
      priority: params.priority ?? "MEDIUM",
      project: { connect: { id: params.projectId } },
      createdBy: { connect: { id: params.createdById } },
      assignedTo: params.assignedToId ? { connect: { id: params.assignedToId } } : undefined
    }
  });
}
