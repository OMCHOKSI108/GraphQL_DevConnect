import { afterAll } from "vitest";
import { prisma } from "../src/config/prisma.js";

afterAll(async () => {
  await prisma.$disconnect();
});
