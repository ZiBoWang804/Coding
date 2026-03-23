import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRowsFromFile } from "@/lib/importer";
import { normalizePipeList, parseNumber } from "@/lib/utils";

const prisma = new PrismaClient();

function getArg(flag: string) {
  const hit = process.argv.find((item) => item.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

function toDate(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const fileArg = getArg("--file");
  const source = getArg("--source") ?? "manual_export";
  const batch = getArg("--batch") ?? `third-party-${new Date().toISOString().slice(0, 10)}`;

  if (!fileArg) {
    throw new Error("请传入 --file=./data/third-party-observations.sample.csv");
  }

  const rows = loadRowsFromFile(path.resolve(process.cwd(), fileArg));
  let created = 0;
  let updated = 0;
  const failed: Array<{ row: number; reason: string }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const spotName = String(row.spotName ?? "").trim();
      const province = String(row.province ?? "").trim() || null;
      const city = String(row.city ?? "").trim() || null;
      const district = String(row.district ?? "").trim() || null;
      const platform = String(row.platform ?? "").trim();
      const externalId = String(row.externalId ?? "").trim() || null;
      const title = String(row.title ?? "").trim() || null;
      const contentSummary = String(row.contentSummary ?? "").trim();
      if (!platform || !contentSummary) {
        throw new Error("platform 和 contentSummary 为必填字段");
      }

      const spot = spotName
        ? await prisma.spot.findFirst({
            where: {
              name: spotName,
              province: province ?? undefined,
              city: city ?? undefined,
              district: district ?? undefined
            }
          })
        : null;

      const data = {
        platform,
        externalId,
        title,
        authorName: String(row.authorName ?? "").trim() || null,
        authorProfileUrl: String(row.authorProfileUrl ?? "").trim() || null,
        postUrl: String(row.postUrl ?? "").trim() || null,
        publishedAt: toDate(row.publishedAt),
        contentSummary,
        commentsSummary: String(row.commentsSummary ?? "").trim() || null,
        priceInfo: String(row.priceInfo ?? "").trim() || null,
        estimatedCost: parseNumber(row.estimatedCost) ?? null,
        ratingText: String(row.ratingText ?? "").trim() || null,
        likeCount: parseNumber(row.likeCount) ?? null,
        commentCount: parseNumber(row.commentCount) ?? null,
        collectCount: parseNumber(row.collectCount) ?? null,
        regionText: String(row.regionText ?? "").trim() || null,
        province,
        city,
        district,
        tags: normalizePipeList(row.tags),
        source: String(row.source ?? source).trim() || source,
        batch: String(row.batch ?? batch).trim() || batch,
        rawPayload: JSON.parse(JSON.stringify(row)) as any,
        spotId: spot?.id ?? null
      };

      if (externalId) {
        const existing = await prisma.externalObservation.findUnique({
          where: { platform_externalId: { platform, externalId } }
        });
        if (existing) {
          await prisma.externalObservation.update({
            where: { id: existing.id },
            data
          });
          updated += 1;
        } else {
          await prisma.externalObservation.create({ data });
          created += 1;
        }
      } else {
        await prisma.externalObservation.create({ data });
        created += 1;
      }
    } catch (error) {
      failed.push({ row: index + 1, reason: error instanceof Error ? error.message : "导入失败" });
    }
  }

  console.log(JSON.stringify({ created, updated, failed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

