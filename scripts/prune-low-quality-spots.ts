import fs from "node:fs";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "data", "import-ready", "spot-prune.report.json");

const pruneWhere: Prisma.SpotWhereInput = {
  source: "national_poi_2025_cleaned",
  address: null,
  imageUrl: null,
  description: {
    contains: "来源于 2025 全国旅游景点 POI 数据清洗导入"
  },
  observations: { none: {} },
  posts: { none: {} },
  comments: { none: {} },
  checkIns: { none: {} },
  submissionsApproved: { none: {} },
  actions: { none: {} }
};

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function withRetry<T>(task: () => Promise<T>, label: string, retries = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const waitMs = attempt * 1500;
      console.warn(`${label} failed on attempt ${attempt}, retrying in ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

async function main() {
  ensureDir(REPORT_PATH);

  const beforeTotal = await withRetry(() => prisma.spot.count(), "count total before");
  const pruneCount = await withRetry(() => prisma.spot.count({ where: pruneWhere }), "count prune candidates");
  const samples = await withRetry(
    () =>
      prisma.spot.findMany({
        where: pruneWhere,
        select: {
          id: true,
          name: true,
          province: true,
          city: true
        },
        take: 100
      }),
    "load prune samples"
  );

  const deleted = await withRetry(
    () =>
      prisma.spot.deleteMany({
        where: pruneWhere
      }),
    "delete prune candidates"
  );

  const afterTotal = await withRetry(() => prisma.spot.count(), "count total after");

  const report = {
    generatedAt: new Date().toISOString(),
    beforeTotal,
    pruneCount,
    deletedCount: deleted.count,
    afterTotal,
    samples
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
