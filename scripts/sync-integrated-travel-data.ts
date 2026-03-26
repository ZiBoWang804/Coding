import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { loadRowsFromFile } from "@/lib/importer";
import { bulkUpsertRuntimeDemoSpots } from "@/lib/demo-spot-store";
import {
  buildAmapNavigationUrl,
  buildGenericHotelUrl,
  buildGenericTicketUrl,
  normalizePipeList,
  parseNumber
} from "@/lib/utils";
import type { RuralSpotSeed } from "@/types";

type DictRow = Record<string, unknown>;

type SpotPayload = {
  name: string;
  province: string;
  city: string;
  district: string | null;
  address: string | null;
  description: string;
  tags: string[];
  rating: number | null;
  crowdLevel: number | null;
  avgCost: number | null;
  suggestedDuration: string | null;
  bestSeason: string[];
  transportInfo: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  ticketBookingUrl: string | null;
  hotelBookingUrl: string | null;
  gaodeNavigationUrl: string | null;
  isNationalKeyVillage: boolean;
  batch: string;
  source: string;
  routeHighlights: string[];
  accommodationTips: string[];
  diningTips: string[];
};

type GuideProfile = {
  normalizedName: string;
  keywords: string[];
  estimatedCost: string;
  suggestedDays: string;
  comfortLevel: string;
  summary: string;
  previewPath: string;
  textPath: string;
};

const ROOT = process.cwd();
const IMPORT_BATCH = `integrated-sync-${new Date().toISOString().slice(0, 10)}`;
const IMPORT_SOURCE = "integrated_data_2026_03_26";
const NATIONAL_CSV = path.join(ROOT, "data", "全国旅游数据整合_2026-03-24", "景点画像汇总_含平台照片.csv");
const GUIDE_CSV = path.join(ROOT, "data", "131景点资料整合_2026-03-25", "资料去重整合.csv");
const XHS_CSV = path.join(ROOT, "data", "小红书旅游数据整合_2026-03-25", "小红书旅游笔记_去重整合.csv");
const PUBLIC_MEDIA_DIR = path.join(ROOT, "public", "media", "integrated-spots");
const REPORT_PATH = path.join(ROOT, "data", "import-ready", "integrated-sync.report.json");

const prisma = new PrismaClient();

function getArg(flag: string) {
  const hit = process.argv.find((item) => item.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeName(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）·.,，、"“”'‘’\-_/]/g, "")
    .trim();
}

function dedupeStrings(items: Array<string | null | undefined>, limit = 10) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of items) {
    const value = asText(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeProvince(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/市$|省$|自治区$|特别行政区$/.test(trimmed)) return trimmed;
  if (["北京", "上海", "天津", "重庆"].includes(trimmed)) return `${trimmed}市`;
  if (trimmed === "内蒙古") return "内蒙古自治区";
  if (trimmed === "广西") return "广西壮族自治区";
  if (trimmed === "宁夏") return "宁夏回族自治区";
  if (trimmed === "新疆") return "新疆维吾尔自治区";
  if (trimmed === "西藏") return "西藏自治区";
  if (trimmed === "香港") return "香港特别行政区";
  if (trimmed === "澳门") return "澳门特别行政区";
  return `${trimmed}省`;
}

function normalizeCity(value: string, fallbackProvince: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallbackProvince;
  if (/市$|州$|地区$|盟$|县$|区$/.test(trimmed)) return trimmed;
  return `${trimmed}市`;
}

function pickPhotoPath(row: DictRow) {
  const primary = asText(row["平台图片首图路径"]);
  const all = asText(row["平台图片全部路径"]);
  const preview = asText(row["预览图路径"]);
  if (primary && fs.existsSync(primary)) return primary;
  if (all) {
    const first = all.split("|").map((item) => item.trim())[0];
    if (first && fs.existsSync(first)) return first;
  }
  if (preview && fs.existsSync(preview)) return preview;
  return "";
}

function getImageExt(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) return ext;
  return ".jpg";
}

function copyToPublicMedia(sourcePath: string) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null;
  ensureDir(PUBLIC_MEDIA_DIR);
  const hashed = createHash("sha1").update(sourcePath).digest("hex").slice(0, 20);
  const targetName = `${hashed}${getImageExt(sourcePath)}`;
  const targetPath = path.join(PUBLIC_MEDIA_DIR, targetName);
  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
  return `/media/integrated-spots/${targetName}`;
}

function parseFloatNullable(value: unknown) {
  const number = parseNumber(value);
  if (number == null || Number.isNaN(number)) return null;
  return Number(number.toFixed(6));
}

function buildGuideMap(rows: DictRow[]) {
  const map = new Map<string, GuideProfile>();
  for (const row of rows) {
    const isBest = asText(row["是否最佳版本"]);
    if (isBest && isBest !== "是") continue;

    const normalized = normalizeName(asText(row["标准名称"]) || asText(row["资料标题"]));
    if (!normalized) continue;

    const keywords = normalizePipeList(row["关键词"]);
    map.set(normalized, {
      normalizedName: normalized,
      keywords,
      estimatedCost: asText(row["参考费用"]),
      suggestedDays: asText(row["推荐天数"]),
      comfortLevel: asText(row["舒适程度"]),
      summary: asText(row["摘要"]),
      previewPath: asText(row["预览图路径"]),
      textPath: asText(row["文本文件路径"])
    });
  }
  return map;
}

function matchGuideProfile(name: string, guideMap: Map<string, GuideProfile>) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return undefined;
  const exact = guideMap.get(normalizedName);
  if (exact) return exact;

  for (const [key, profile] of guideMap.entries()) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return profile;
    }
  }
  return undefined;
}

function toSpotPayloads(nationalRows: DictRow[], guideMap: Map<string, GuideProfile>) {
  const dedupe = new Map<string, SpotPayload>();
  let copiedImageCount = 0;

  for (const row of nationalRows) {
    const name = asText(row["景点名称"]);
    const province = normalizeProvince(asText(row["所在省份"]));
    const city = normalizeCity(asText(row["所在城市"]), province);
    if (!name || !province || !city) continue;

    const key = `${name}@@${province}@@${city}`;
    const guide = matchGuideProfile(name, guideMap);
    const copiedImage = copyToPublicMedia(pickPhotoPath(row));
    if (copiedImage) copiedImageCount += 1;

    const tags = dedupeStrings(
      [
        ...normalizePipeList(row["景点类型"]),
        ...normalizePipeList(row["景点等级"]),
        ...normalizePipeList(row["高频季节"]),
        ...(guide?.keywords ?? []).slice(0, 3),
        "全国旅游画像"
      ],
      8
    );

    const descriptionFragments = dedupeStrings(
      [
        asText(row["景点类型"]) ? `${name}，属于${asText(row["景点类型"])}。` : "",
        asText(row["景点等级"]) ? `景区等级：${asText(row["景点等级"])}。` : "",
        guide?.summary ?? "",
        asText(row["平台图片来源标题"]) ? `图文来源：${asText(row["平台图片来源标题"])}。` : ""
      ],
      5
    );

    const routeHighlights = dedupeStrings(
      [
        asText(row["平均评分"]) ? `平均评分：${asText(row["平均评分"])}` : "",
        asText(row["游客样本量"]) ? `游客样本量：${asText(row["游客样本量"])}` : "",
        asText(row["高频交通方式"]) ? `高频交通：${asText(row["高频交通方式"])}` : "",
        asText(row["高频季节"]) ? `高频季节：${asText(row["高频季节"])}` : "",
        guide?.estimatedCost ? `攻略参考费用：${guide.estimatedCost}` : "",
        guide?.suggestedDays ? `攻略推荐天数：${guide.suggestedDays}` : "",
        guide?.comfortLevel ? `攻略舒适程度：${guide.comfortLevel}` : ""
      ],
      8
    );

    const payload: SpotPayload = {
      name,
      province,
      city,
      district: null,
      address: asText(row["平台图片来源位置"]) || null,
      description:
        descriptionFragments.join(" ") ||
        `${name}位于${province}${city}，来源于全国旅游画像与攻略数据整合。`,
      tags,
      rating: parseNumber(row["平均评分"]) ?? null,
      crowdLevel: parseNumber(row["节假日访问占比(%)"]) != null
        ? Math.max(1, Math.min(5, Math.round((Number(row["节假日访问占比(%)"]) as number) / 20)))
        : null,
      avgCost: parseNumber(row["平均消费金额"]) != null ? Math.round(Number(row["平均消费金额"])) : null,
      suggestedDuration: asText(row["平均访问时长(小时)"])
        ? `${Math.max(1, Math.round(Number(row["平均访问时长(小时)"])))}小时`
        : guide?.suggestedDays || null,
      bestSeason: normalizePipeList(row["高频季节"]).slice(0, 3),
      transportInfo: asText(row["高频交通方式"]) || null,
      latitude: null,
      longitude: null,
      imageUrl: copiedImage,
      ticketBookingUrl: buildGenericTicketUrl(name, city),
      hotelBookingUrl: buildGenericHotelUrl(name, city),
      gaodeNavigationUrl: buildAmapNavigationUrl(name, city, null),
      isNationalKeyVillage: false,
      batch: IMPORT_BATCH,
      source: IMPORT_SOURCE,
      routeHighlights,
      accommodationTips: dedupeStrings([
        guide?.suggestedDays ? `推荐游玩时长：${guide.suggestedDays}` : "",
        guide?.comfortLevel ? `舒适程度：${guide.comfortLevel}` : ""
      ]),
      diningTips: dedupeStrings([
        asText(row["高频游客来源省"]) ? `热门客源地：${asText(row["高频游客来源省"])}` : "",
        asText(row["满意度分布"]) ? `满意度分布：${asText(row["满意度分布"])}` : ""
      ])
    };

    const existing = dedupe.get(key);
    if (!existing) {
      dedupe.set(key, payload);
      continue;
    }

    dedupe.set(key, {
      ...existing,
      tags: dedupeStrings([...(existing.tags || []), ...(payload.tags || [])], 10),
      routeHighlights: dedupeStrings([...(existing.routeHighlights || []), ...(payload.routeHighlights || [])], 10),
      imageUrl: existing.imageUrl || payload.imageUrl,
      rating: existing.rating ?? payload.rating,
      avgCost: existing.avgCost ?? payload.avgCost,
      transportInfo: existing.transportInfo || payload.transportInfo
    });
  }

  return {
    spots: Array.from(dedupe.values()),
    copiedImageCount
  };
}

function parsePublishedAt(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildExternalId(row: DictRow) {
  const key = asText(row["去重键"]) || asText(row["帖子详情页链接"]);
  if (key) return createHash("sha1").update(key).digest("hex").slice(0, 24);
  const fallback = [asText(row["标题"]), asText(row["作者"]), asText(row["封面链接地址"]), asText(row["搜索词"])].join("||");
  return createHash("sha1").update(fallback).digest("hex").slice(0, 24);
}

function buildSpotNameIndex(spots: Array<{ id: string; name: string }>) {
  return spots
    .map((spot) => ({ id: spot.id, normalized: normalizeName(spot.name) }))
    .filter((item) => item.normalized.length >= 2)
    .sort((left, right) => right.normalized.length - left.normalized.length);
}

function matchSpotIdByText(text: string, index: Array<{ id: string; normalized: string }>) {
  const normalized = normalizeName(text);
  if (!normalized) return null;
  for (const item of index) {
    if (normalized.includes(item.normalized)) return item.id;
  }
  return null;
}

async function upsertSpots(spots: SpotPayload[]) {
  const existingSpots = await prisma.spot.findMany({
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      district: true,
      tags: true,
      routeHighlights: true,
      accommodationTips: true,
      diningTips: true,
      imageUrl: true
    }
  });

  const existingMap = new Map<string, (typeof existingSpots)[number]>();
  for (const spot of existingSpots) {
    const key = `${spot.name}@@${spot.province}@@${spot.city}@@${spot.district ?? ""}`;
    existingMap.set(key, spot);
  }

  let created = 0;
  let updated = 0;
  const chunkSize = 120;

  for (let index = 0; index < spots.length; index += chunkSize) {
    const chunk = spots.slice(index, index + chunkSize);
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    for (const item of chunk) {
      const key = `${item.name}@@${item.province}@@${item.city}@@${item.district ?? ""}`;
      const existing = existingMap.get(key);
      const mergedTags = dedupeStrings([...(existing?.tags ?? []), ...item.tags], 12);
      const mergedRouteHighlights = dedupeStrings([
        ...(Array.isArray(existing?.routeHighlights) ? existing?.routeHighlights.map(String) : []),
        ...item.routeHighlights
      ]);
      const mergedAccommodationTips = dedupeStrings([
        ...(Array.isArray(existing?.accommodationTips) ? existing?.accommodationTips.map(String) : []),
        ...item.accommodationTips
      ]);
      const mergedDiningTips = dedupeStrings([
        ...(Array.isArray(existing?.diningTips) ? existing?.diningTips.map(String) : []),
        ...item.diningTips
      ]);
      if (existing) {
        operations.push(
          prisma.spot.update({
            where: { id: existing.id },
            data: {
              description: item.description,
              tags: mergedTags,
              rating: item.rating ?? undefined,
              crowdLevel: item.crowdLevel ?? undefined,
              avgCost: item.avgCost ?? undefined,
              suggestedDuration: item.suggestedDuration ?? undefined,
              bestSeason: item.bestSeason.length ? item.bestSeason : undefined,
              transportInfo: item.transportInfo ?? undefined,
              imageUrl: item.imageUrl || existing.imageUrl || undefined,
              ticketBookingUrl: item.ticketBookingUrl ?? undefined,
              hotelBookingUrl: item.hotelBookingUrl ?? undefined,
              gaodeNavigationUrl: item.gaodeNavigationUrl ?? undefined,
              source: item.source,
              batch: item.batch,
              routeHighlights: mergedRouteHighlights,
              accommodationTips: mergedAccommodationTips,
              diningTips: mergedDiningTips
            }
          })
        );
      } else {
        operations.push(
          prisma.spot.create({
            data: {
              ...item,
              tags: mergedTags,
              routeHighlights: mergedRouteHighlights,
              accommodationTips: mergedAccommodationTips,
              diningTips: mergedDiningTips
            }
          })
        );
      }
    }

    await prisma.$transaction(operations);

    for (const item of chunk) {
      const key = `${item.name}@@${item.province}@@${item.city}@@${item.district ?? ""}`;
      if (existingMap.has(key)) updated += 1;
      else {
        created += 1;
      }
    }
  }

  return { created, updated };
}

function toRuntimeDemoSpot(item: SpotPayload): RuralSpotSeed {
  const now = new Date().toISOString();
  return {
    name: item.name,
    province: item.province,
    city: item.city,
    district: item.district,
    address: item.address,
    description: item.description,
    tags: item.tags,
    bestSeason: item.bestSeason.length ? item.bestSeason : ["四季皆宜"],
    suggestedDuration: item.suggestedDuration,
    transportInfo: item.transportInfo,
    imageUrl: item.imageUrl,
    ticketBookingUrl: item.ticketBookingUrl,
    hotelBookingUrl: item.hotelBookingUrl,
    gaodeNavigationUrl: item.gaodeNavigationUrl,
    source: item.source,
    batch: item.batch,
    rating: item.rating,
    crowdLevel: item.crowdLevel,
    avgCost: item.avgCost,
    routeHighlights: item.routeHighlights,
    accommodationTips: item.accommodationTips.map((name) => ({ name })),
    diningTips: item.diningTips.map((name) => ({ name })),
    createdAt: now,
    updatedAt: now
  };
}

async function upsertSpotsToDemo(spots: SpotPayload[]) {
  const runtimeSpots = spots.map(toRuntimeDemoSpot);
  await bulkUpsertRuntimeDemoSpots(runtimeSpots);
  return {
    upserted: runtimeSpots.length
  };
}

async function importObservations(xhsRows: DictRow[]) {
  const spots = await prisma.spot.findMany({
    select: {
      id: true,
      name: true
    }
  });
  const spotNameIndex = buildSpotNameIndex(spots);

  const records: Prisma.ExternalObservationCreateManyInput[] = [];
  for (const row of xhsRows) {
    const title = asText(row["标题"]);
    const author = asText(row["作者"]);
    const detailUrl = asText(row["帖子详情页链接"]);
    const summary = title || `${asText(row["主题"])} ${asText(row["搜索词"])}`.trim();
    if (!summary) continue;

    const estimatedCost = parseNumber(row["估算花费"]) != null ? Math.round(Number(row["估算花费"])) : null;
    const publishedAt = parsePublishedAt(asText(row["笔记发布时间"]));
    const spotId =
      matchSpotIdByText(`${title} ${asText(row["搜索词"])}`, spotNameIndex) ||
      matchSpotIdByText(asText(row["主题"]), spotNameIndex);

    records.push({
      platform: "xiaohongshu",
      externalId: buildExternalId(row),
      title: title || null,
      authorName: author || null,
      authorProfileUrl: asText(row["作者主页"]) || null,
      postUrl: detailUrl || asText(row["搜索结果链接"]) || null,
      publishedAt,
      contentSummary: summary,
      commentsSummary: asText(row["主题"]) || null,
      priceInfo: null,
      estimatedCost,
      ratingText: null,
      likeCount: parseNumber(row["点赞数"]) != null ? Math.round(Number(row["点赞数"])) : null,
      commentCount: null,
      collectCount: null,
      regionText: asText(row["搜索词"]) || null,
      province: null,
      city: null,
      district: null,
      tags: dedupeStrings([asText(row["主题"]), asText(row["搜索词"]), "小红书笔记"], 5),
      source: IMPORT_SOURCE,
      batch: IMPORT_BATCH,
      rawPayload: row as Prisma.InputJsonValue,
      spotId
    });
  }

  if (!records.length) {
    return { created: 0, duplicatesSkipped: 0 };
  }

  const result = await prisma.externalObservation.createMany({
    data: records,
    skipDuplicates: true
  });

  return {
    created: result.count,
    duplicatesSkipped: Math.max(0, records.length - result.count)
  };
}

async function main() {
  const dryRun = getArg("--dryRun") === "true";
  const outputReportOnly = getArg("--reportOnly") === "true";

  const startedAt = Date.now();
  ensureDir(path.dirname(REPORT_PATH));

  const nationalRows = loadRowsFromFile(NATIONAL_CSV);
  const guideRows = loadRowsFromFile(GUIDE_CSV);
  const xhsRows = loadRowsFromFile(XHS_CSV);

  const guideMap = buildGuideMap(guideRows);
  const { spots, copiedImageCount } = toSpotPayloads(nationalRows, guideMap);

  const report: Record<string, unknown> = {
    batch: IMPORT_BATCH,
    source: IMPORT_SOURCE,
    dryRun,
    input: {
      nationalRows: nationalRows.length,
      guideRows: guideRows.length,
      xhsRows: xhsRows.length
    },
    transform: {
      guideProfilesMatched: guideMap.size,
      normalizedSpots: spots.length,
      copiedImageCount
    }
  };

  if (outputReportOnly) {
    report.mode = "reportOnly";
    report.elapsedMs = Date.now() - startedAt;
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!dryRun) {
    try {
      const spotResult = await upsertSpots(spots);
      const observationResult = await importObservations(xhsRows);
      report.import = {
        mode: "database",
        spots: spotResult,
        observations: observationResult
      };
    } catch (error) {
      const demoResult = await upsertSpotsToDemo(spots);
      report.import = {
        mode: "demo-fallback",
        spots: demoResult,
        observations: {
          created: 0,
          duplicatesSkipped: 0,
          skipped: true
        },
        dbError: error instanceof Error ? error.message : String(error)
      };
    }
  }

  report.elapsedMs = Date.now() - startedAt;
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
