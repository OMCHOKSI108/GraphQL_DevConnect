import DataLoader from "dataloader";
import type { PrismaClient, User, Project, Issue, ProjectMember } from "../generated/prisma/client.js";

type ProjectMemberWithUser = ProjectMember & { user: User };

export function createLoaders(prisma: PrismaClient) {
  const userById = new DataLoader<string, User | null>(async (ids) => {
    const rows = await prisma.user.findMany({ where: { id: { in: ids as string[] } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) ?? null);
  });

  const projectById = new DataLoader<string, Project | null>(async (ids) => {
    const rows = await prisma.project.findMany({ where: { id: { in: ids as string[] } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) ?? null);
  });

  const issueById = new DataLoader<string, Issue | null>(async (ids) => {
    const rows = await prisma.issue.findMany({ where: { id: { in: ids as string[] } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) ?? null);
  });

  const issuesByProjectId = new DataLoader<string, Issue[]>(async (projectIds) => {
    const rows = await prisma.issue.findMany({
      where: { projectId: { in: projectIds as string[] } },
      orderBy: { createdAt: "desc" }
    });
    const grouped = new Map<string, Issue[]>();
    for (const row of rows) {
      grouped.set(row.projectId, [...(grouped.get(row.projectId) ?? []), row]);
    }
    return projectIds.map((id) => grouped.get(id) ?? []);
  });

  const projectsByOwnerId = new DataLoader<string, Project[]>(async (ownerIds) => {
    const rows = await prisma.project.findMany({
      where: { ownerId: { in: ownerIds as string[] } },
      orderBy: { createdAt: "desc" }
    });
    const grouped = new Map<string, Project[]>();
    for (const row of rows) {
      grouped.set(row.ownerId, [...(grouped.get(row.ownerId) ?? []), row]);
    }
    return ownerIds.map((id) => grouped.get(id) ?? []);
  });

  const assignedIssuesByUserId = new DataLoader<string, Issue[]>(async (userIds) => {
    const rows = await prisma.issue.findMany({
      where: { assignedToId: { in: userIds as string[] } },
      orderBy: { createdAt: "desc" }
    });
    const grouped = new Map<string, Issue[]>();
    for (const row of rows) {
      if (!row.assignedToId) continue;
      grouped.set(row.assignedToId, [...(grouped.get(row.assignedToId) ?? []), row]);
    }
    return userIds.map((id) => grouped.get(id) ?? []);
  });

  const projectMembersByProjectId = new DataLoader<string, ProjectMemberWithUser[]>(async (projectIds) => {
    const rows = await prisma.projectMember.findMany({
      where: { projectId: { in: projectIds as string[] } },
      include: { user: true }
    });
    const grouped = new Map<string, ProjectMemberWithUser[]>();
    for (const row of rows) {
      grouped.set(row.projectId, [...(grouped.get(row.projectId) ?? []), row]);
    }
    return projectIds.map((id) => grouped.get(id) ?? []);
  });

  const membershipByProjectAndUser = new DataLoader<string, ProjectMember | null>(
    async (keys) => {
      const pairs = keys.map((key) => {
        const [projectId, userId] = key.split(":");
        return { projectId, userId };
      });

      const rows = await prisma.projectMember.findMany({
        where: { OR: pairs.map(({ projectId, userId }) => ({ projectId, userId })) }
      });

      const byKey = new Map(rows.map((row) => [`${row.projectId}:${row.userId}`, row]));
      return keys.map((key) => byKey.get(key) ?? null);
    },
    { cacheKeyFn: (key) => key }
  );

  return {
    userById,
    projectById,
    issueById,
    issuesByProjectId,
    projectsByOwnerId,
    assignedIssuesByUserId,
    projectMembersByProjectId,
    membershipByProjectAndUser
  };
}

export type Loaders = ReturnType<typeof createLoaders>;
