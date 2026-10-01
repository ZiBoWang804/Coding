import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "@/lib/database-url";

declare global {
  var prisma: PrismaClient | undefined;
}

export function createPrismaClient() {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);

  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
