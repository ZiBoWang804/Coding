import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const prisma = new PrismaClient();

async function main() {
  const rows = JSON.parse(fs.readFileSync("./data/xian-rural-spots.cleaned.json", "utf8"));
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const data = {
      name: row.name,
      province: row.province,
      city: row.city,
      district: row.district || null,
      address: row.address || null,
      description: row.description,
      tags: String(row.tags || "").split("|").filter(Boolean),
      rating: row.rating ? Number(row.rating) : null,
      crowdLevel: row.crowdLevel ? Number(row.crowdLevel) : null,
      avgCost: row.avgCost ? Number(row.avgCost) : null,
      suggestedDuration: row.suggestedDuration || null,
      bestSeason: String(row.bestSeason || "").split("|").filter(Boolean),
      transportInfo: row.transportInfo || null,
      latitude: null,
      longitude: null,
      imageUrl: row.imageUrl || null,
      isNationalKeyVillage: row.isNationalKeyVillage === true || row.isNationalKeyVillage === "true",
      batch: row.batch || "xian-rural-import-2026-03",
      source: row.source || "manual_excel_import",
      accommodationTips: String(row.accommodationTips || "").split("|").filter(Boolean).map((name) => ({ name })),
      diningTips: String(row.diningTips || "").split("|").filter(Boolean).map((name) => ({ name })),
      routeHighlights: String(row.routeHighlights || "").split("|").filter(Boolean)
    };

    const existing = await prisma.spot.findFirst({
      where: {
        name: data.name,
        province: data.province,
        city: data.city,
        address: data.address ?? undefined
      }
    });

    if (existing) {
      await prisma.spot.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.spot.create({ data });
      created += 1;
    }
  }

  console.log(JSON.stringify({ created, updated, total: rows.length }, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
