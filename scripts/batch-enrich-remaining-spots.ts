import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRowsFromFile } from "@/lib/importer";

type DictRow = Record<string, unknown>;

type ProfileRow = {
  name: string;
  province: string;
  city: string;
  detailUrl: string | null;
};

type ParsedTripDetail = {
  address: string | null;
  description: string | null;
  suggestedDuration: string | null;
  latitude: number | null;
  longitude: number | null;
};

const prisma = new PrismaClient();
const ROOT = process.cwd();
const PROFILE_CSV = path.join(ROOT, "data", "全国旅游数据整合_2026-03-24", "景点画像汇总_含平台照片.csv");
const REPORT_PATH = path.join(ROOT, "data", "import-ready", "remaining-spots-enrich.report.json");

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeName(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）·.,，:："'“”‘’\-_/]/g, "");
}

function normalizeProvince(value: string) {
  return normalizeText(value).replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, "");
}

function normalizeCity(value: string) {
  return normalizeText(value).replace(/市|地区|盟|州/g, "");
}

function buildKey(name: string, province: string, city: string) {
  return `${normalizeName(name)}::${normalizeProvince(province)}::${normalizeCity(city)}`;
}

function decodeHtml(value: string) {
  return value
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\u002F/g, "/")
    .replace(/\\u0027/g, "'")
    .replace(/\\u0022/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAddress(value: string | null) {
  if (!value) return null;
  const normalized = decodeHtml(value).replace(/\s+/g, " ").trim();
  return normalized || null;
}

function cleanDescription(value: string | null) {
  if (!value) return null;
  const normalized = decodeHtml(value).replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 260) : null;
}

function needsDescriptionUpgrade(description: string) {
  if (!description) return true;
  if (description.length < 80) return true;
  return description.includes("当前优先保留基础位置") || description.includes("来源于 2025 全国旅游景点 POI 数据清洗导入");
}

function parseTripDetail(html: string): ParsedTripDetail {
  const addressMatch =
    html.match(/"address":"([^"]+)"/i) ||
    html.match(/address-des-info"><span class="field">([\s\S]*?)<\/span>/i);
  const durationMatch = html.match(/"playSpendTime":"([^"]+)"/i);
  const introMatch = html.match(/"introduction":"([\s\S]*?)","playSpendTime":/i);
  const coordMatch = html.match(/"coordinate":\{"coordinateType":"[^"]+","latitude":([0-9.\-]+),"longitude":([0-9.\-]+)\}/i);

  const latitude = coordMatch?.[1] ? Number(coordMatch[1]) : null;
  const longitude = coordMatch?.[2] ? Number(coordMatch[2]) : null;

  return {
    address: cleanAddress(addressMatch?.[1] ?? null),
    description: cleanDescription(introMatch?.[1] ?? null),
    suggestedDuration: durationMatch?.[1] ? decodeHtml(durationMatch[1]) : null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null
  };
}

async function fetchWithRetry(url: string, retries = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "accept-language": "zh-HK,zh-TW;q=0.9,zh;q=0.8,en;q=0.7"
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

async function buildProfileMap() {
  const rows = (await loadRowsFromFile(PROFILE_CSV)) as DictRow[];
  const map = new Map<string, ProfileRow>();
  for (const row of rows) {
    const item: ProfileRow = {
      name: normalizeText(row["景点名称"]),
      province: normalizeText(row["所在省份"]),
      city: normalizeText(row["所在城市"]),
      detailUrl: normalizeText(row["平台图片详情页"]) || null
    };
    if (!item.name || !item.detailUrl) continue;
    map.set(buildKey(item.name, item.province, item.city), item);
  }
  return map;
}

async function main() {
  ensureDir(REPORT_PATH);
  const profileMap = await buildProfileMap();
  const spots = await prisma.spot.findMany({
    where: {
      OR: [
        { address: null },
        { address: "" },
        { address: { contains: "China" } },
        { imageUrl: null },
        { imageUrl: "" }
      ]
    },
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      address: true,
      imageUrl: true,
      description: true,
      suggestedDuration: true,
      latitude: true,
      longitude: true
    }
  });

  let matched = 0;
  let updated = 0;
  let addressUpdated = 0;
  let descriptionUpdated = 0;
  let durationUpdated = 0;
  let coordinateUpdated = 0;
  const failures: Array<Record<string, unknown>> = [];
  const samples: Array<Record<string, unknown>> = [];

  for (const spot of spots) {
    const profile = profileMap.get(buildKey(spot.name, spot.province, spot.city));
    if (!profile?.detailUrl) continue;
    matched += 1;

    try {
      const targetUrl = profile.detailUrl.replace("https://us.trip.com/", "https://hk.trip.com/");
      const html = await fetchWithRetry(targetUrl);
      const detail = parseTripDetail(html);
      const data: Record<string, unknown> = {};

      if ((!spot.address || spot.address.includes("China")) && detail.address) {
        data.address = detail.address;
      }
      if ((!spot.suggestedDuration || spot.suggestedDuration.trim() === "") && detail.suggestedDuration) {
        data.suggestedDuration = detail.suggestedDuration;
      }
      if ((!spot.latitude || !spot.longitude) && detail.latitude && detail.longitude) {
        data.latitude = detail.latitude;
        data.longitude = detail.longitude;
      }
      if (detail.description && needsDescriptionUpgrade(spot.description)) {
        data.description = detail.description;
      }

      if (Object.keys(data).length === 0) continue;

      await prisma.spot.update({
        where: { id: spot.id },
        data
      });

      updated += 1;
      if ("address" in data) addressUpdated += 1;
      if ("description" in data) descriptionUpdated += 1;
      if ("suggestedDuration" in data) durationUpdated += 1;
      if ("latitude" in data || "longitude" in data) coordinateUpdated += 1;

      if (samples.length < 60) {
        samples.push({
          id: spot.id,
          name: spot.name,
          data
        });
      }
    } catch (error) {
      failures.push({
        id: spot.id,
        name: spot.name,
        url: profile.detailUrl,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const [total, missingAddress, englishAddress, missingImage] = await Promise.all([
    prisma.spot.count(),
    prisma.spot.count({ where: { OR: [{ address: null }, { address: "" }] } }),
    prisma.spot.count({ where: { address: { contains: "China" } } }),
    prisma.spot.count({ where: { OR: [{ imageUrl: null }, { imageUrl: "" }] } })
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    candidates: spots.length,
    matched,
    updated,
    addressUpdated,
    descriptionUpdated,
    durationUpdated,
    coordinateUpdated,
    failures: failures.slice(0, 100),
    remaining: {
      total,
      missingAddress,
      englishAddress,
      missingImage
    },
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
