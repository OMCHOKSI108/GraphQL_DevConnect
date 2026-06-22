import { prisma } from "../../src/config/prisma.js";

export async function cleanDatabase() {
  await prisma.user.deleteMany({});
}
