import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function normalizeDatabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) return undefined;

  try {
    const parsed = new URL(databaseUrl);
    const isNeonPooler = parsed.hostname.includes(".neon.tech") && parsed.hostname.includes("-pooler.");
    if (!isNeonPooler) return databaseUrl;

    if (parsed.searchParams.get("channel_binding") === "require") {
      parsed.searchParams.delete("channel_binding");
    }

    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }

    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "15");
    }

    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

const runtimeDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

export const prisma =
  global.prisma ??
  new PrismaClient({
    datasources: runtimeDatabaseUrl ? { db: { url: runtimeDatabaseUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
