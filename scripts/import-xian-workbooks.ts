import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { isLikelyImageUrl, normalizePipeList, parseNumber } from "@/lib/utils";

const prisma = new PrismaClient();

const SPOT_BATCH = "xian-rural-import-2026-03";
const SPOT_SOURCE = "xian_public_spot_workbook";
const OBS_BATCH = "xiaohongshu-cleaned-2026-03";
const OBS_SOURCE = "xiaohongshu_cleaned_excel";
const DEFAULT_PROVINCE = "陕西省";

const OBSERVATION_SPOT_ALIASES: Record<string, string> = {
  "蔡家坡": "蔡家坡村",
  "唐村": "长安唐村·南堡古寨",
  "长安唐村": "长安唐村·南堡古寨",
  "张龙村": "张龙村竹海驿站",
  "竹海驿站": "张龙村竹海驿站",
  "芷阳村": "芷阳村芷硕石榴休闲观光园",
  "源田梦工场": "源田梦工场·田园综合体",
  "源田": "源田梦工场·田园综合体",
  "塘子村": "汤峪镇塘子村",
  "汤峪": "汤峪镇塘子村"
};

function findWorkbookPath(match: (sheetNames: string[]) => boolean) {
  const files = fs.readdirSync(process.cwd()).filter((name) => name.toLowerCase().endsWith(".xlsx"));
  for (const file of files) {
    const absolutePath = path.join(process.cwd(), file);
    const workbook = XLSX.readFile(absolutePath);
    if (match(workbook.SheetNames)) {
      return absolutePath;
    }
  }

  throw new Error("未找到匹配的 Excel 文件。");
}

function parseArea(area: string) {
  const cleaned = area.replace(/（.*?）/g, "").trim();
  const cityMatch = cleaned.match(/^[^市]+市/);
  const city = cityMatch?.[0] ?? "西安市";
  const rest = cleaned.slice(city.length);
  const districtMatch = rest.match(/^[^区县市]+(?:区|县|市)/);
  const district = districtMatch?.[0] ?? null;

  return {
    province: DEFAULT_PROVINCE,
    city,
    district,
    address: cleaned || null
  };
}

function splitSeason(value: string) {
  return value
    .split(/[|｜、,，/；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toSheetObjects(sheet: XLSX.WorkSheet, headerRowIndex = 0, dataStartRowIndex = headerRowIndex + 1) {
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });
  const headers = (rows[headerRowIndex] || []).map((item) => String(item).trim());

  return rows
    .slice(dataStartRowIndex)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });
      return record;
    });
}

function extractExternalId(url: string) {
  const match = url.match(/\/search_result\/([^/?]+)/);
  return match?.[1] ?? null;
}

function parsePublishedAt(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00+08:00`);
  }
  if (/^\d{2}-\d{2}$/.test(text)) {
    const year = new Date().getFullYear();
    return new Date(`${year}-${text}T00:00:00+08:00`);
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function importSpots() {
  const spotWorkbookPath = findWorkbookPath((sheetNames) => sheetNames.includes("西安附近乡村景点"));
  const workbook = XLSX.readFile(spotWorkbookPath);
  const rows = toSheetObjects(workbook.Sheets["西安附近乡村景点"], 3, 4);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const name = String(row["景点名称"] ?? "").trim();
    if (!name) continue;

    const scenicFeature = String(row["景点特色"] ?? "").trim();
    const reviewSummary = String(row["游客评价摘要（公开网页归纳）"] ?? "").trim();
    const accommodation = String(row["周边住宿环境（公开网页归纳）"] ?? "").trim();
    const transport = String(row["交通方式（公开网页归纳）"] ?? "").trim();
    const dining = String(row["周边餐饮（公开网页归纳）"] ?? "").trim();
    const area = parseArea(String(row["所在区域"] ?? "").trim());
    const typeTags = normalizePipeList(row["景点类型/等级"]);
    const crowdTags = normalizePipeList(row["适宜人群"]);
    const routeHighlights = normalizePipeList(scenicFeature);
    const sourceLinks = [row["来源1"], row["来源2"], row["来源3"]].map((item) => String(item ?? "").trim()).filter(Boolean);
    const imageCandidate = String(row["风景照片参考链接"] ?? "").trim();
    const description = [scenicFeature, reviewSummary].filter(Boolean).join("。");

    const data = {
      name,
      province: area.province,
      city: area.city,
      district: area.district,
      address: area.address,
      description: description || scenicFeature || name,
      tags: [...new Set([...typeTags, ...crowdTags])],
      rating: null,
      crowdLevel: null,
      avgCost: null,
      suggestedDuration: null,
      bestSeason: splitSeason(String(row["推荐季节"] ?? "")),
      transportInfo: transport || null,
      latitude: null,
      longitude: null,
      imageUrl: isLikelyImageUrl(imageCandidate) ? imageCandidate : null,
      ticketBookingUrl: sourceLinks[0] ?? null,
      hotelBookingUrl: sourceLinks[1] ?? null,
      gaodeNavigationUrl: null,
      isNationalKeyVillage: String(row["景点类型/等级"] ?? "").includes("全国乡村旅游重点村"),
      batch: SPOT_BATCH,
      source: SPOT_SOURCE,
      accommodationTips: accommodation ? [{ name: accommodation }] : [],
      diningTips: dining ? [{ name: dining }] : [],
      routeHighlights
    };

    const existing = await prisma.spot.findFirst({
      where: { name }
    });

    if (existing) {
      await prisma.spot.update({
        where: { id: existing.id },
        data
      });
      updated += 1;
    } else {
      await prisma.spot.create({ data });
      created += 1;
    }
  }

  return { created, updated, total: rows.length, workbook: path.basename(spotWorkbookPath) };
}

async function buildSpotLookup() {
  const spots = await prisma.spot.findMany({
    select: { id: true, name: true, province: true, city: true, district: true }
  });

  return {
    byName: new Map(spots.map((spot) => [spot.name, spot])),
    items: spots
  };
}

function resolveSpotForObservation(destination: string, spotLookup: Awaited<ReturnType<typeof buildSpotLookup>>) {
  const normalized = destination.trim();
  if (!normalized) return null;

  const alias = OBSERVATION_SPOT_ALIASES[normalized] ?? normalized;
  const exact = spotLookup.byName.get(alias);
  if (exact) return exact;

  return spotLookup.items.find((spot) => spot.name.includes(alias) || alias.includes(spot.name)) ?? null;
}

async function importObservations() {
  const observationWorkbookPath = findWorkbookPath((sheetNames) => sheetNames.includes("帖子清洗结果") && sheetNames.includes("入库候选"));
  const workbook = XLSX.readFile(observationWorkbookPath);
  const spotLookup = await buildSpotLookup();
  const sheetName = "帖子清洗结果";

  let created = 0;
  let updated = 0;
  let unlinked = 0;

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const title = String(row["标题"] ?? "").trim();
    const postUrl = String(row["帖子详情页链接"] ?? "").trim();
    const destination = String(row["目的地归一化"] ?? "").trim();
    if (!title && !postUrl) continue;

    const spot = resolveSpotForObservation(destination, spotLookup);
    if (!spot) unlinked += 1;

    const externalId = extractExternalId(postUrl) ?? `xlsx-${sheetName}-${row["原始序号"] ?? index + 1}`;
    const notes = [String(row["处理说明"] ?? "").trim(), String(row["数据价值建议"] ?? "").trim()].filter(Boolean).join("；");
    const data = {
      platform: "xiaohongshu",
      externalId,
      title: title || null,
      authorName: String(row["作者"] ?? "").trim() || null,
      authorProfileUrl: String(row["作者主页"] ?? "").trim() || null,
      postUrl: postUrl || null,
      publishedAt: parsePublishedAt(row["发布时间"]),
      contentSummary: [title, String(row["内容类型"] ?? "").trim(), destination ? `目的地：${destination}` : ""].filter(Boolean).join("｜"),
      commentsSummary: notes || null,
      priceInfo: null,
      estimatedCost: null,
      ratingText: String(row["优先级"] ?? "").trim() || null,
      likeCount: parseNumber(row["点赞数"]) ?? null,
      commentCount: null,
      collectCount: null,
      regionText: destination || null,
      province: spot?.province ?? null,
      city: spot?.city ?? null,
      district: spot?.district ?? null,
      tags: [...new Set(normalizePipeList(row["标准化标签"]))],
      source: OBS_SOURCE,
      batch: OBS_BATCH,
      rawPayload: {
        sheetName,
        category: String(row["分类"] ?? "").trim() || sheetName,
        priority: String(row["优先级"] ?? "").trim() || null,
        contentType: String(row["内容类型"] ?? "").trim() || null,
        normalizedDestination: destination || null,
        processNote: String(row["处理说明"] ?? "").trim() || null,
        valueSuggestion: String(row["数据价值建议"] ?? "").trim() || null,
        coverUrl: String(row["封面链接地址"] ?? "").trim() || null,
        originalRowNo: row["原始序号"] ?? null
      } as any,
      spotId: spot?.id ?? null
    };

    const existing = await prisma.externalObservation.findUnique({
      where: {
        platform_externalId: {
          platform: "xiaohongshu",
          externalId
        }
      }
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
  }

  return {
    created,
    updated,
    unlinked,
    workbook: path.basename(observationWorkbookPath)
  };
}

async function main() {
  const spots = await importSpots();
  const observations = await importObservations();

  console.log(
    JSON.stringify(
      {
        spots,
        observations
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
