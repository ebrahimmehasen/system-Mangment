import "server-only";

import { PrismaClient } from "@prisma/client";

/**
 * Database access layer — a single shared PrismaClient instance.
 * In development, avoid creating a new client on every HMR reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
