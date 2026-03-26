import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildAmapNavigationUrl, buildGenericHotelUrl, buildGenericTicketUrl } from "@/lib/utils";

const prisma = new PrismaClient();

const IMPORT_BATCH = "national-profile-2026-03-24";
const IMPORT_SOURCE = "national_profile_2026_03_24";
const DATA_DIRECTORY_KEYWORD = "全国旅游数据整合_2026-03-24";
const PROFILE_FILE_NAME = "景点画像汇总.csv";
const PUBLIC_ASSET_DIR = path.join(process.cwd(), "public", "spot-assets", "national-profiles");
const WIKIPEDIA_API = "https://zh.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIPEDIA_USER_AGENT = "Codex/1.0 (https://openai.com)";
const DISALLOWED_IMAGE_TOKENS = [
  "地图",
  "地圖",
  "位置图",
  "位置圖",
  "location map",
  "map",
  "logo",
  "徽标",
  "徽標",
  "flag",
  "seal",
  "icon",
  "条例",
  "pdf",
  "svg"
];

type ProfileRecord = {
  name: string;
  city: string;
  province: string;
  type: string;
  grade: string;
  sampleCount: number;
  rating: number | null;
  avgCost: number | null;
  avgTicketPrice: number | null;
  avgVisitHours: number | null;
  groupRatio: number | null;
  holidayRatio: number | null;
  topSeasons: string;
  topTransportModes: string;
  topSourceProvinces: string;
  recommendationDistribution: string;
  satisfactionDistribution: string;
  matchedAssetTitle: string;
  matchedAssetPath: string;
  previewPath: string;
};

type OnlineEnrichment = {
  pageTitle: string;
  pageUrl: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
};

type CommonsEnrichment = {
  fileTitle: string;
  pageUrl: string;
  imageUrl: string;
};

type ExistingSpotRecord = {
  id: string;
  name: string;
  province: string;
  city: string;
  district: string | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  batch: string | null;
  tags: string[];
  bestSeason: string[];
  routeHighlights: unknown;
  accommodationTips: unknown;
  diningTips: unknown;
};

function resolveDataDirectory() {
  const preferred = path.join(process.cwd(), "data", DATA_DIRECTORY_KEYWORD);
  if (fs.existsSync(preferred)) return preferred;

  const fallback = fs
    .readdirSync(path.join(process.cwd(), "data"), { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.includes("2026-03-24"));

  if (!fallback) {
    throw new Error(`未找到数据目录：${preferred}`);
  }

  return path.join(process.cwd(), "data", fallback.name);
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

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeName(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/[()（）·.·,，'"“”‘’\-_/]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeProvince(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (["北京", "上海", "天津", "重庆"].includes(trimmed)) return `${trimmed}市`;
  if (trimmed === "内蒙古") return "内蒙古自治区";
  if (trimmed === "广西") return "广西壮族自治区";
  if (trimmed === "宁夏") return "宁夏回族自治区";
  if (trimmed === "新疆") return "新疆维吾尔自治区";
  if (trimmed === "西藏") return "西藏自治区";
  if (trimmed === "香港") return "香港特别行政区";
  if (trimmed === "澳门") return "澳门特别行政区";
  if (/(省|市|自治区|特别行政区)$/.test(trimmed)) return trimmed;
  return `${trimmed}省`;
}

function normalizeCity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const aliases: Record<string, string> = {
    湘西州: "湘西土家族苗族自治州",
    迪庆州: "迪庆藏族自治州",
    黔东南州: "黔东南苗族侗族自治州",
    黔南州: "黔南布依族苗族自治州",
    黔西南州: "黔西南布依族苗族自治州",
    凉山州: "凉山彝族自治州",
    阿坝州: "阿坝藏族羌族自治州",
    甘孜州: "甘孜藏族自治州",
    延边州: "延边朝鲜族自治州",
    恩施州: "恩施土家族苗族自治州",
    海西州: "海西蒙古族藏族自治州",
    海北州: "海北藏族自治州",
    海南州: "海南藏族自治州",
    黄南州: "黄南藏族自治州",
    果洛州: "果洛藏族自治州",
    玉树州: "玉树藏族自治州",
    红河州: "红河哈尼族彝族自治州",
    文山州: "文山壮族苗族自治州",
    西双版纳州: "西双版纳傣族自治州",
    德宏州: "德宏傣族景颇族自治州",
    怒江州: "怒江傈僳族自治州",
    大理州: "大理白族自治州",
    楚雄州: "楚雄彝族自治州"
  };

  return aliases[trimmed] ?? trimmed;
}

function readProfileRecords(dataDirectory: string) {
  const csvPath = path.join(dataDirectory, PROFILE_FILE_NAME);
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "").trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return {
      name: cells[0] ?? "",
      city: normalizeCity(cells[1] ?? ""),
      province: normalizeProvince(cells[2] ?? ""),
      type: cells[3] ?? "",
      grade: cells[4] ?? "",
      sampleCount: Number(cells[5] ?? 0),
      rating: toNumber(cells[6] ?? ""),
      avgCost: toNumber(cells[7] ?? ""),
      avgTicketPrice: toNumber(cells[8] ?? ""),
      avgVisitHours: toNumber(cells[9] ?? ""),
      groupRatio: toNumber(cells[10] ?? ""),
      holidayRatio: toNumber(cells[11] ?? ""),
      topSeasons: cells[12] ?? "",
      topTransportModes: cells[13] ?? "",
      topSourceProvinces: cells[14] ?? "",
      recommendationDistribution: cells[15] ?? "",
      satisfactionDistribution: cells[16] ?? "",
      matchedAssetTitle: cells[17] ?? "",
      matchedAssetPath: cells[18] ?? "",
      previewPath: cells[19] ?? ""
    } satisfies ProfileRecord;
  });
}

function parseTokenList(value: string) {
  return value
    .split("/")
    .map((item) => item.replace(/\(\d+\)/g, "").trim())
    .filter(Boolean);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
}

function mergeDelimitedStrings(existing: string | null | undefined, incoming: string) {
  return uniqueStrings([...(existing ? existing.split(",") : []), incoming]).join(",");
}

function inferSuggestedDuration(hours: number | null) {
  if (hours == null) return "半天";
  if (hours < 2.5) return "2-3小时";
  if (hours < 4.5) return "半天";
  if (hours < 7.5) return "1天";
  return "1-2天";
}

function inferCrowdLevel(sampleCount: number, holidayRatio: number | null) {
  let score = 3;
  if (holidayRatio != null) {
    if (holidayRatio < 18) score = 1;
    else if (holidayRatio < 32) score = 2;
    else if (holidayRatio < 48) score = 3;
    else if (holidayRatio < 62) score = 4;
    else score = 5;
  }

  if (sampleCount >= 260) score = Math.min(5, score + 1);
  return score;
}

function buildDescription(record: ProfileRecord) {
  const fragments = [
    `${record.name}位于${record.province}${record.city}，属于${record.type || "综合景区"}${record.grade ? `，常见评级为${record.grade}` : ""}。`,
    record.rating != null ? `游客样本 ${record.sampleCount} 条，平均评分 ${record.rating.toFixed(2)}。` : `游客样本 ${record.sampleCount} 条。`,
    record.avgCost != null ? `人均总花费约 ${Math.round(record.avgCost)} 元` : null,
    record.avgTicketPrice != null ? `门票约 ${Math.round(record.avgTicketPrice)} 元` : null,
    record.avgVisitHours != null ? `平均停留 ${record.avgVisitHours.toFixed(1)} 小时。` : null,
    record.topSeasons ? `热门季节以 ${parseTokenList(record.topSeasons).join("、")} 为主。` : null,
    record.topTransportModes ? `常见抵达方式包括 ${parseTokenList(record.topTransportModes).join("、")}。` : null
  ];

  return uniqueStrings(fragments).join(" ");
}

function buildTags(record: ProfileRecord) {
  const tags = [
    "全国画像精选",
    record.type,
    record.grade ? `${record.grade}景区` : null,
    record.rating != null && record.rating >= 4.7 ? "高口碑" : null,
    record.avgTicketPrice === 0 ? "免门票" : null
  ];

  for (const season of parseTokenList(record.topSeasons).slice(0, 2)) {
    tags.push(`${season}热门`);
  }

  return uniqueStrings(tags);
}

function buildRouteHighlights(record: ProfileRecord) {
  return uniqueStrings([
    `游客样本 ${record.sampleCount} 条`,
    record.rating != null ? `平均评分 ${record.rating.toFixed(2)}` : null,
    record.avgCost != null ? `人均总花费约 ${Math.round(record.avgCost)} 元` : null,
    record.avgTicketPrice != null ? `平均门票约 ${Math.round(record.avgTicketPrice)} 元` : null,
    record.avgVisitHours != null ? `平均停留 ${record.avgVisitHours.toFixed(1)} 小时` : null,
    record.topTransportModes ? `常见交通：${parseTokenList(record.topTransportModes).join("、")}` : null,
    record.topSeasons ? `热门季节：${parseTokenList(record.topSeasons).join("、")}` : null,
    record.recommendationDistribution ? `推荐分布：${record.recommendationDistribution}` : null,
    record.satisfactionDistribution ? `满意度分布：${record.satisfactionDistribution}` : null
  ]);
}

function buildAccommodationTips(record: ProfileRecord) {
  const tips = [];
  if ((record.avgVisitHours ?? 0) >= 5) {
    tips.push("建议预留整天行程，跨城往返可考虑住一晚。");
  }
  if ((record.avgCost ?? 0) >= 350) {
    tips.push("整体消费偏高，节假日前可提前锁定酒店与门票预算。");
  }
  return tips;
}

function buildDiningTips(record: ProfileRecord) {
  const tips = [];
  if (record.topSourceProvinces) {
    tips.push(`热门客源覆盖 ${parseTokenList(record.topSourceProvinces).slice(0, 3).join("、")}，节假日餐饮高峰需预留排队时间。`);
  }
  if ((record.avgVisitHours ?? 0) >= 4) {
    tips.push("适合安排一顿当地特色正餐，不建议只做快进快出。");
  }
  return tips;
}

function copyLocalPreview(index: number, previewPath: string) {
  if (!previewPath || previewPath === "." || !fs.existsSync(previewPath)) return null;
  fs.mkdirSync(PUBLIC_ASSET_DIR, { recursive: true });
  const extension = path.extname(previewPath).toLowerCase() || ".jpg";
  const targetName = `national-profile-${String(index).padStart(3, "0")}${extension}`;
  const targetPath = path.join(PUBLIC_ASSET_DIR, targetName);
  fs.copyFileSync(previewPath, targetPath);
  return `/spot-assets/national-profiles/${targetName}`;
}

function getImageExtension(url: string, contentType?: string | null) {
  const pathname = new URL(url).pathname;
  const extension = path.extname(pathname).toLowerCase();
  if (extension) return extension;
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("gif")) return ".gif";
  return ".jpg";
}

function isSupportedRasterImage(url?: string | null) {
  if (!url) return false;
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].some((extension) => url.toLowerCase().includes(extension));
}

function normalizeImageTitle(title: string) {
  return normalizeName(
    title
      .replace(/^File:/i, "")
      .replace(/\.(jpg|jpeg|png|webp|gif|avif|tif|tiff|bmp|svg|pdf|webm)$/i, "")
  );
}

function scoreCommonsCandidate(record: ProfileRecord, title: string, width: number, height: number) {
  const lowered = title.toLowerCase();
  if (DISALLOWED_IMAGE_TOKENS.some((token) => lowered.includes(token.toLowerCase()))) return -1000;
  if (width < 900 || height < 540) return -500;

  const normalizedTitle = normalizeImageTitle(title);
  const normalizedName = normalizeName(record.name);
  const normalizedCity = normalizeName(record.city);
  const normalizedProvince = normalizeName(record.province);

  let score = 0;
  if (normalizedTitle.includes(normalizedName) || normalizedName.includes(normalizedTitle)) score += 120;
  if (normalizedCity && normalizedTitle.includes(normalizedCity)) score += 20;
  if (normalizedProvince && normalizedTitle.includes(normalizedProvince)) score += 10;
  if (lowered.includes("panoramio")) score += 5;
  score += Math.min(40, Math.round((width * height) / 200000));

  return score;
}

async function downloadRemoteImage(index: number, url: string) {
  fs.mkdirSync(PUBLIC_ASSET_DIR, { recursive: true });
  const response = await fetch(url, {
    headers: {
      "User-Agent": WIKIPEDIA_USER_AGENT
    }
  });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type");
  if (!contentType?.startsWith("image/")) return null;

  const arrayBuffer = await response.arrayBuffer();
  const extension = getImageExtension(url, contentType);
  const targetName = `national-profile-${String(index).padStart(3, "0")}-wiki${extension}`;
  const targetPath = path.join(PUBLIC_ASSET_DIR, targetName);
  fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
  return `/spot-assets/national-profiles/${targetName}`;
}

async function searchCommonsImage(record: ProfileRecord): Promise<CommonsEnrichment | null> {
  const queries = uniqueStrings([
    `${record.name} ${record.city}`,
    `${record.name} ${record.province}`,
    record.name
  ]);

  let bestCandidate: (CommonsEnrichment & { score: number }) | null = null;

  for (const query of queries) {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: query,
      gsrlimit: "8",
      prop: "imageinfo|info",
      iiprop: "url|dimensions",
      iiurlwidth: "1920",
      inprop: "url",
      format: "json",
      origin: "*"
    });

    const response = await fetch(`${COMMONS_API}?${params.toString()}`, {
      headers: {
        "User-Agent": WIKIPEDIA_USER_AGENT
      }
    });

    if (!response.ok) continue;
    const payload = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            fullurl?: string;
            imageinfo?: Array<{ width?: number; height?: number; url?: string; thumburl?: string }>;
          }
        >;
      };
    };

    for (const page of Object.values(payload.query?.pages ?? {})) {
      const imageInfo = page.imageinfo?.[0];
      if (!page.title || !imageInfo?.thumburl) continue;

      const score = scoreCommonsCandidate(record, page.title, imageInfo.width ?? 0, imageInfo.height ?? 0);
      if (score < 0) continue;

      const candidate = {
        fileTitle: page.title,
        pageUrl: page.fullurl ?? "",
        imageUrl: imageInfo.thumburl,
        score
      };

      if (!bestCandidate || candidate.score > bestCandidate.score) {
        bestCandidate = candidate;
      }
    }
  }

  if (!bestCandidate) return null;
  return {
    fileTitle: bestCandidate.fileTitle,
    pageUrl: bestCandidate.pageUrl,
    imageUrl: bestCandidate.imageUrl
  };
}

async function fetchWikipediaEnrichment(record: ProfileRecord): Promise<OnlineEnrichment | null> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `intitle:${record.name}`,
    gsrlimit: "1",
    prop: "pageimages|coordinates|info",
    piprop: "original|thumbnail",
    pithumbsize: "1600",
    inprop: "url",
    format: "json",
    origin: "*"
  });

  const response = await fetch(`${WIKIPEDIA_API}?${params.toString()}`, {
    headers: {
      "User-Agent": WIKIPEDIA_USER_AGENT
    }
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          fullurl?: string;
          original?: { source?: string };
          thumbnail?: { source?: string };
          coordinates?: Array<{ lat?: number; lon?: number }>;
        }
      >;
    };
  };

  const page = Object.values(payload.query?.pages ?? {})[0];
  if (!page?.title) return null;

  const normalizedTitle = normalizeName(page.title.replace(/旅游景区|旅游区|风景名胜区|民俗博览区|国家公园/g, ""));
  const normalizedName = normalizeName(record.name);
  if (!normalizedTitle.includes(normalizedName) && !normalizedName.includes(normalizedTitle)) {
    return null;
  }

  return {
    pageTitle: page.title,
    pageUrl: page.fullurl ?? "",
    latitude: page.coordinates?.[0]?.lat ?? null,
    longitude: page.coordinates?.[0]?.lon ?? null,
    imageUrl: isSupportedRasterImage(page.original?.source) ? page.original?.source ?? null : isSupportedRasterImage(page.thumbnail?.source) ? page.thumbnail?.source ?? null : null
  };
}

function buildExistingMaps(spots: ExistingSpotRecord[]) {
  const exact = new Map<string, ExistingSpotRecord>();
  const normalized = new Map<string, ExistingSpotRecord>();

  for (const spot of spots) {
    const exactKey = [spot.name, spot.province, spot.city, spot.district ?? ""].join("__");
    const normalizedKey = [normalizeName(spot.name), normalizeName(spot.province), normalizeName(spot.city), normalizeName(spot.district ?? "")].join("__");
    exact.set(exactKey, spot);
    normalized.set(normalizedKey, spot);
  }

  return { exact, normalized };
}

async function main() {
  const dataDirectory = resolveDataDirectory();
  const records = readProfileRecords(dataDirectory);
  const existingSpots = await prisma.spot.findMany({
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      district: true,
      imageUrl: true,
      latitude: true,
      longitude: true,
      source: true,
      batch: true,
      tags: true,
      bestSeason: true,
      routeHighlights: true,
      accommodationTips: true,
      diningTips: true
    }
  });

  const maps = buildExistingMaps(existingSpots);

  let created = 0;
  let updated = 0;
  let localPreviewCount = 0;
  let wikiMatchCount = 0;
  let wikiImageCount = 0;
  let wikiCoordinateCount = 0;
  let commonsImageCount = 0;
  const unresolvedImages: string[] = [];

  for (const [index, record] of records.entries()) {
    if (!record.name || !record.city || !record.province) continue;

    const exactKey = [record.name, record.province, record.city, ""].join("__");
    const normalizedKey = [normalizeName(record.name), normalizeName(record.province), normalizeName(record.city), ""].join("__");
    const existing = maps.exact.get(exactKey) ?? maps.normalized.get(normalizedKey) ?? null;

    let localImageUrl = copyLocalPreview(index + 1, record.previewPath);
    if (localImageUrl) {
      localPreviewCount += 1;
    }

    const enrichment = await fetchWikipediaEnrichment(record).catch(() => null);
    if (enrichment) {
      wikiMatchCount += 1;
      if (enrichment.latitude != null && enrichment.longitude != null) {
        wikiCoordinateCount += 1;
      }
    }

    if (!localImageUrl && enrichment?.imageUrl) {
      const downloaded = await downloadRemoteImage(index + 1, enrichment.imageUrl).catch(() => null);
      if (downloaded) {
        localImageUrl = downloaded;
        wikiImageCount += 1;
      }
    }

    if (!localImageUrl) {
      const commons = await searchCommonsImage(record).catch(() => null);
      if (commons?.imageUrl) {
        const downloaded = await downloadRemoteImage(index + 1, commons.imageUrl).catch(() => null);
        if (downloaded) {
          localImageUrl = downloaded;
          commonsImageCount += 1;
        }
      }
    }

    if (!localImageUrl) {
      unresolvedImages.push(record.name);
    }

    const bestSeason = parseTokenList(record.topSeasons);
    const routeHighlights = buildRouteHighlights(record);
    const tags = buildTags(record);
    const payload = {
      name: record.name,
      province: record.province,
      city: record.city,
      district: existing?.district ?? null,
      address: null,
      description: buildDescription(record),
      tags,
      rating: record.rating,
      crowdLevel: inferCrowdLevel(record.sampleCount, record.holidayRatio),
      avgCost: record.avgCost != null ? Math.round(record.avgCost) : null,
      suggestedDuration: inferSuggestedDuration(record.avgVisitHours),
      bestSeason: bestSeason.length ? bestSeason : ["四季皆宜"],
      transportInfo: record.topTransportModes ? `常见抵达方式：${parseTokenList(record.topTransportModes).join("、")}` : null,
      latitude: existing?.latitude ?? enrichment?.latitude ?? null,
      longitude: existing?.longitude ?? enrichment?.longitude ?? null,
      imageUrl: isSupportedRasterImage(existing?.imageUrl) ? existing?.imageUrl ?? null : localImageUrl,
      ticketBookingUrl: buildGenericTicketUrl(record.name, record.city),
      hotelBookingUrl: buildGenericHotelUrl(record.name, record.city),
      gaodeNavigationUrl: buildAmapNavigationUrl(record.name, record.city),
      isNationalKeyVillage: false,
      batch: existing ? mergeDelimitedStrings(existing.batch, IMPORT_BATCH) : IMPORT_BATCH,
      source: existing ? mergeDelimitedStrings(existing.source, IMPORT_SOURCE) : IMPORT_SOURCE,
      accommodationTips: uniqueStrings([...(Array.isArray(existing?.accommodationTips) ? existing.accommodationTips.map(String) : []), ...buildAccommodationTips(record)]),
      diningTips: uniqueStrings([...(Array.isArray(existing?.diningTips) ? existing.diningTips.map(String) : []), ...buildDiningTips(record)]),
      routeHighlights: uniqueStrings([...(Array.isArray(existing?.routeHighlights) ? existing.routeHighlights.map(String) : []), ...routeHighlights])
    };

    if (existing) {
      const updatedSpot = await prisma.spot.update({
        where: { id: existing.id },
        data: payload
      });
      maps.exact.set(exactKey, updatedSpot as any);
      maps.normalized.set(normalizedKey, updatedSpot as any);
      updated += 1;
      continue;
    }

    const createdSpot = await prisma.spot.create({
      data: payload
    });
    maps.exact.set(exactKey, createdSpot as any);
    maps.normalized.set(normalizedKey, createdSpot as any);
    created += 1;
  }

  const importedCount = await prisma.spot.count({
    where: {
      source: { contains: IMPORT_SOURCE }
    }
  });

  console.log(
    JSON.stringify(
      {
        dataDirectory: path.basename(dataDirectory),
        importedRecords: records.length,
        created,
        updated,
        importedCount,
        localPreviewCount,
        wikiMatchCount,
        wikiCoordinateCount,
        wikiImageCount,
        commonsImageCount,
        unresolvedImageCount: unresolvedImages.length,
        unresolvedImageSample: unresolvedImages.slice(0, 30)
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
