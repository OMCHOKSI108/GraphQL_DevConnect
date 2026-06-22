import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/utils/auth.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SEED_PASSWORD = "password123";

async function main() {
  await prisma.comment.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(SEED_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
      skills: ["System Design", "GraphQL Security", "DevOps"]
    }
  });

  const owner = await prisma.user.create({
    data: {
      name: "Om Choksi",
      email: "om@example.com",
      passwordHash,
      role: "DEVELOPER",
      skills: ["GraphQL", "Node.js", "TypeScript", "PostgreSQL"]
    }
  });

  const maintainer = await prisma.user.create({
    data: {
      name: "Dev Maintainer",
      email: "maintainer@example.com",
      passwordHash,
      role: "MAINTAINER",
      skills: ["Backend", "Prisma", "API Design"]
    }
  });

  const member = await prisma.user.create({
    data: {
      name: "Regular Member",
      email: "member@example.com",
      passwordHash,
      role: "DEVELOPER",
      skills: ["Frontend", "React"]
    }
  });

  const outsider = await prisma.user.create({
    data: {
      name: "Outsider User",
      email: "outsider@example.com",
      passwordHash,
      role: "DEVELOPER",
      skills: ["Mobile", "Flutter"]
    }
  });

  const project = await prisma.project.create({
    data: {
      title: "DevConnectQL",
      description: "Developer collaboration API built with GraphQL and PostgreSQL",
      techStack: ["GraphQL", "Apollo Server", "TypeScript", "PostgreSQL", "Prisma"],
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: maintainer.id, role: "MAINTAINER" },
          { userId: member.id, role: "MEMBER" }
        ]
      }
    }
  });

  const authIssue = await prisma.issue.create({
    data: {
      title: "Add JWT authentication",
      description: "Create register and login flow using JWT",
      status: "CLOSED",
      priority: "URGENT",
      projectId: project.id,
      createdById: owner.id,
      assignedToId: maintainer.id
    }
  });

  const paginationIssue = await prisma.issue.create({
    data: {
      title: "Add cursor pagination",
      description: "Paginate large lists using the Relay connection pattern",
      status: "IN_PROGRESS",
      priority: "HIGH",
      projectId: project.id,
      createdById: maintainer.id,
      assignedToId: member.id
    }
  });

  await prisma.issue.create({
    data: {
      title: "Fix N+1 queries with DataLoader",
      description: "Batch repeated lookups across nested resolvers",
      status: "RESOLVED",
      priority: "MEDIUM",
      projectId: project.id,
      createdById: member.id,
      assignedToId: owner.id
    }
  });

  await prisma.issue.create({
    data: {
      title: "Document GraphQL subscription flow",
      description: "Explain issueStatusChanged, commentAdded, and issueAssigned",
      status: "OPEN",
      priority: "LOW",
      projectId: project.id,
      createdById: owner.id
    }
  });

  await prisma.comment.create({
    data: {
      message: "Auth phase is now implemented with JWT and protected mutations.",
      issueId: authIssue.id,
      authorId: maintainer.id
    }
  });

  await prisma.comment.create({
    data: {
      message: "Started wiring up the cursor-based connection types.",
      issueId: paginationIssue.id,
      authorId: member.id
    }
  });

  console.log("Database seeded successfully");
  console.log("");
  console.log("Seed login credentials (all use the same password):");
  console.log(`  Admin (global ADMIN, not a project member): admin@example.com / ${SEED_PASSWORD}`);
  console.log(`  Owner (project OWNER):                       om@example.com / ${SEED_PASSWORD}`);
  console.log(`  Maintainer (project MAINTAINER):              maintainer@example.com / ${SEED_PASSWORD}`);
  console.log(`  Member (plain project MEMBER):                member@example.com / ${SEED_PASSWORD}`);
  console.log(`  Outsider (not part of the project):           outsider@example.com / ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
