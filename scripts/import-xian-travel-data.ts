import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildAmapNavigationUrl, buildGenericHotelUrl, buildGenericTicketUrl, isLikelyImageUrl } from "@/lib/utils";

const prisma = new PrismaClient();

const DATA_ROOT = path.join(process.cwd(), "data");
const DATA_FOLDER_NAME = "西安旅游资料_2026-03-23";
const CSV_FILE_NAME = "景点信息汇总.csv";
const IMAGE_LINKS_FILE_NAME = "风景图链接.md";
const SOURCE_LINKS_FILE_NAME = "来源链接.md";

const IMPORT_BATCH = "xian-travel-data-2026-03-23";
const IMPORT_SOURCE = "xian_travel_docs_2026_03_23";
const DEFAULT_PROVINCE = "陕西省";

type TravelCsvRecord = {
  分类: string;
  景点: string;
  地理位置: string;
  景点介绍: string;
  参考票价: string;
  开放时间: string;
  玩法建议: string;
  风景图链接: string;
  主要来源: string;
};

type ParsedArea = {
  province: string;
  city: string;
  district: string | null;
  address: string | null;
};

function getDataDirectory() {
  const preferred = path.join(DATA_ROOT, DATA_FOLDER_NAME);
  if (fs.existsSync(preferred)) return preferred;

  const fallback = fs
    .readdirSync(DATA_ROOT, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.includes("西安旅游资料") && entry.name.includes("2026-03-23"));

  if (!fallback) {
    throw new Error(`未找到数据目录：${preferred}`);
  }

  return path.join(DATA_ROOT, fallback.name);
}

function normalizeName(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/[()（）·\-]/g, "")
    .trim()
    .toLowerCase();
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((item) => item.trim());
}

function normalizeCsvCells(cells: string[], expectedLength: number) {
  if (cells.length === expectedLength) return cells;
  if (cells.length < expectedLength) {
    return [...cells, ...Array.from({ length: expectedLength - cells.length }, () => "")];
  }

  if (expectedLength === 9) {
    return [...cells.slice(0, 7), cells.slice(7, -1).join(","), cells.at(-1) ?? ""];
  }

  return cells.slice(0, expectedLength);
}

function readCsvRecords(csvPath: string): TravelCsvRecord[] {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "").trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = normalizeCsvCells(parseCsvLine(line), headers.length);
    const record = {} as Record<string, string>;

    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    return record as TravelCsvRecord;
  });
}

function parseImageLinkMarkdown(markdownPath: string) {
  const text = fs.readFileSync(markdownPath, "utf8");
  const imageMap = new Map<string, string>();
  const pageMap = new Map<string, string>();
  let currentSpotName: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      currentSpotName = headingMatch[1].trim();
      continue;
    }

    if (!currentSpotName) continue;

    const imageMatch = line.match(/!\[[^\]]*]\((.+)\)/);
    if (imageMatch && !imageMap.has(currentSpotName)) {
      imageMap.set(currentSpotName, imageMatch[1].trim());
      continue;
    }

    const pageMatch = line.match(/^- 景点页：(.+)$/);
    if (pageMatch && !pageMap.has(currentSpotName)) {
      pageMap.set(currentSpotName, pageMatch[1].trim());
    }
  }

  return { imageMap, pageMap };
}

function parseSourceLinkMarkdown(markdownPath: string) {
  const text = fs.readFileSync(markdownPath, "utf8");
  const sourceMap = new Map<string, string>();

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^- ([^：]+)：(https?:\/\/.+)$/);
    if (!match) continue;

    const name = match[1].trim();
    const url = match[2].trim();
    if (["官方 / 半官方", "价格补充参考", "攻略检索时重点参考的游记/攻略入口"].includes(name)) continue;
    sourceMap.set(name, url);
  }

  return sourceMap;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
}

function mergeDelimitedStrings(existing: string | null | undefined, incoming: string) {
  return uniqueStrings([...(existing ? existing.split(",") : []), incoming]).join(",");
}

function inferArea(address: string, category: string): ParsedArea {
  const cleaned = address.trim();
  const provinceMatch = cleaned.match(/^[^省]+省/);
  const province = provinceMatch?.[0] ?? DEFAULT_PROVINCE;
  const textWithoutProvince = provinceMatch ? cleaned.slice(province.length) : cleaned;
  const cityMatch = textWithoutProvince.match(/^[^市]+市/);
  const city = cityMatch?.[0] ?? (category === "乡村旅游" ? "西安市" : "西安市");
  const textWithoutCity = cityMatch ? textWithoutProvince.slice(city.length) : textWithoutProvince;
  const districtMatch = textWithoutCity.match(/^[^区县市]+(?:区|县|市)/);
  const district = districtMatch?.[0] ?? null;

  return {
    province,
    city,
    district,
    address: cleaned || null
  };
}

function inferTags(record: TravelCsvRecord) {
  const tags = [record.分类];
  const text = `${record.景点介绍} ${record.玩法建议} ${record.景点}`;

  if (record.分类 === "西安市内") tags.push("城市观光");
  if (record.分类 === "西安附近") tags.push("周边一日游");
  if (record.分类 === "乡村旅游") tags.push("乡村旅游", "周末休闲");
  if (/博物馆|文化遗产|城墙|古寨|寺|文化/.test(text)) tags.push("人文历史");
  if (/山|森林|秦岭|徒步|避暑|索道/.test(text)) tags.push("自然山水");
  if (/夜景|夜游|不夜城|演艺/.test(text)) tags.push("夜游");
  if (/美食|小吃/.test(text)) tags.push("美食");
  if (/拍照|打卡|汉服|影视/.test(text)) tags.push("拍照打卡");
  if (/亲子|家庭/.test(text)) tags.push("亲子");

  return uniqueStrings(tags);
}

function inferSuggestedDuration(record: TravelCsvRecord) {
  const text = `${record.景点} ${record.景点介绍} ${record.玩法建议}`;
  if (/华山/.test(text)) return "1天到2天";
  if (/太白山|牛背梁|法门/.test(text)) return "1天";
  if (/不夜城/.test(text)) return "2-4小时";
  if (/博物馆|兵马俑|华清宫|城墙/.test(text)) return "半天";
  if (record.分类 === "乡村旅游") return "半天到1天";
  return "半天到1天";
}

function inferBestSeason(record: TravelCsvRecord) {
  const text = `${record.景点} ${record.景点介绍} ${record.玩法建议}`;
  if (/华山|太白山|牛背梁|森林/.test(text)) return ["春夏秋"];
  if (/不夜城|城墙|华清宫|兵马俑|博物馆/.test(text)) return ["全年"];
  if (record.分类 === "乡村旅游") return ["全年", "春秋更佳"];
  return ["春秋"];
}

function inferAverageCost(text: string) {
  if (!text.trim()) return null;
  if (text.includes("免费")) return 0;

  const values = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  if (!values.length) return null;

  const slice = values.slice(0, 2);
  return Math.round(slice.reduce((sum, value) => sum + value, 0) / slice.length);
}

function buildRouteHighlights(record: TravelCsvRecord) {
  return uniqueStrings([
    record.参考票价 ? `参考票价：${record.参考票价}` : null,
    record.开放时间 ? `开放时间：${record.开放时间}` : null,
    record.玩法建议 ? `玩法建议：${record.玩法建议}` : null
  ]);
}

function buildImportedSpotData(
  record: TravelCsvRecord,
  imageLinks: Map<string, string>,
  pageLinks: Map<string, string>,
  sourceLinks: Map<string, string>
) {
  const area = inferArea(record.地理位置, record.分类);
  const fallbackImageUrl = imageLinks.get(record.景点) ?? null;
  const imageUrl = isLikelyImageUrl(record.风景图链接) ? record.风景图链接 : fallbackImageUrl;

  return {
    name: record.景点,
    province: area.province,
    city: area.city,
    district: area.district,
    address: area.address,
    description: record.景点介绍 || record.景点,
    tags: inferTags(record),
    rating: null,
    crowdLevel: null,
    avgCost: inferAverageCost(record.参考票价),
    suggestedDuration: inferSuggestedDuration(record),
    bestSeason: inferBestSeason(record),
    transportInfo: record.玩法建议 || null,
    latitude: null,
    longitude: null,
    imageUrl,
    ticketBookingUrl: buildGenericTicketUrl(record.景点, area.city),
    hotelBookingUrl: buildGenericHotelUrl(record.景点, area.city),
    gaodeNavigationUrl: buildAmapNavigationUrl(record.景点, area.city, area.address),
    isNationalKeyVillage: false,
    batch: IMPORT_BATCH,
    source: IMPORT_SOURCE,
    accommodationTips: [],
    diningTips: [],
    routeHighlights: buildRouteHighlights(record)
  };
}

function mergeStringArray(existing: unknown, incoming: string[]) {
  const current = Array.isArray(existing) ? existing.map(String) : [];
  return uniqueStrings([...current, ...incoming]);
}

async function main() {
  const dataDir = getDataDirectory();
  const csvPath = path.join(dataDir, CSV_FILE_NAME);
  const imageLinksPath = path.join(dataDir, IMAGE_LINKS_FILE_NAME);
  const sourceLinksPath = path.join(dataDir, SOURCE_LINKS_FILE_NAME);

  const records = readCsvRecords(csvPath);
  const { imageMap, pageMap } = parseImageLinkMarkdown(imageLinksPath);
  const sourceMap = parseSourceLinkMarkdown(sourceLinksPath);

  const existingSpots = await prisma.spot.findMany();
  const byExactName = new Map(existingSpots.map((spot) => [spot.name, spot]));
  const byNormalizedName = new Map(existingSpots.map((spot) => [normalizeName(spot.name), spot]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    const name = record.景点.trim();
    if (!name) {
      skipped += 1;
      continue;
    }

    const existing = byExactName.get(name) ?? byNormalizedName.get(normalizeName(name)) ?? null;
    const imported = buildImportedSpotData(record, imageMap, pageMap, sourceMap);

    if (existing) {
      const merged = {
        province: imported.province || existing.province,
        city: imported.city || existing.city,
        district: imported.district ?? existing.district,
        address: imported.address ?? existing.address,
        description: imported.description || existing.description,
        tags: mergeStringArray(existing.tags, imported.tags),
        rating: existing.rating,
        crowdLevel: existing.crowdLevel,
        avgCost: imported.avgCost ?? existing.avgCost,
        suggestedDuration: imported.suggestedDuration ?? existing.suggestedDuration,
        bestSeason: Array.isArray(existing.bestSeason) && existing.bestSeason.length ? existing.bestSeason : imported.bestSeason,
        transportInfo: imported.transportInfo || existing.transportInfo,
        latitude: existing.latitude,
        longitude: existing.longitude,
        imageUrl: existing.imageUrl || imported.imageUrl,
        ticketBookingUrl: imported.ticketBookingUrl || existing.ticketBookingUrl,
        hotelBookingUrl: existing.hotelBookingUrl,
        gaodeNavigationUrl: existing.gaodeNavigationUrl || imported.gaodeNavigationUrl,
        isNationalKeyVillage: existing.isNationalKeyVillage,
        batch: mergeDelimitedStrings(existing.batch, IMPORT_BATCH),
        source: mergeDelimitedStrings(existing.source, IMPORT_SOURCE),
        accommodationTips: Array.isArray(existing.accommodationTips) ? existing.accommodationTips : [],
        diningTips: Array.isArray(existing.diningTips) ? existing.diningTips : [],
        routeHighlights: mergeStringArray(existing.routeHighlights, imported.routeHighlights)
      };

      const updatedSpot = await prisma.spot.update({
        where: { id: existing.id },
        data: merged
      });

      byExactName.set(updatedSpot.name, updatedSpot);
      byNormalizedName.set(normalizeName(updatedSpot.name), updatedSpot);
      updated += 1;
      continue;
    }

    const createdSpot = await prisma.spot.create({
      data: imported
    });

    byExactName.set(createdSpot.name, createdSpot);
    byNormalizedName.set(normalizeName(createdSpot.name), createdSpot);
    created += 1;
  }

  const totalSpotCount = await prisma.spot.count();

  console.log(
    JSON.stringify(
      {
        dataDirectory: path.basename(dataDir),
        importedRecords: records.length,
        created,
        updated,
        skipped,
        totalSpotCount
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
