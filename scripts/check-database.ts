import { createPrismaClient } from "@/lib/prisma";
import { databaseHost, normalizeDatabaseUrl } from "@/lib/database-url";

async function main() {
  const runtimeUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!runtimeUrl) {
    console.error("缺少 DATABASE_URL。演示模式不需要数据库；要验证云数据库时，请先在 .env 里填写连接串。");
    process.exit(1);
  }

  if (process.env.USE_DEMO_DATA === "true") {
    console.log("当前 USE_DEMO_DATA=true。网站会忽略数据库，只使用演示数据。下面仍测试连接串本身。");
  }

  console.log(`正在连接 ${databaseHost(runtimeUrl)} ...`);
  const prisma = createPrismaClient();

  try {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    const spots = await prisma.spot.count();
    const users = await prisma.user.count();
    console.log(`连接成功。SELECT 1 => ${rows[0]?.ok ?? "?"}，景点 ${spots} 条，用户 ${users} 个。`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("连接失败。请检查 DATABASE_URL、DIRECT_URL、SSL、数据库是否已创建，以及云厂商白名单是否放行了当前公网 IP。");
  console.error(message);
  process.exit(1);
});
