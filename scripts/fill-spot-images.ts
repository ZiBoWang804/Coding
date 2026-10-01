import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { bulkUpsertRuntimeDemoSpots } from "@/lib/demo-spot-store";
import { loadSeedSpots } from "@/lib/demo-data";
import type { RuralSpotSeed } from "@/types";

type PhotoIndexRow = {
  景点名称?: string;
  所在城市?: string;
  所在省份?: string;
  图片URL?: string;
  本地图片路径?: string;
  状态?: string;
};

type ImageTarget = {
  name: string;
  province: string;
  city: string;
  query?: string;
  aliases?: string[];
};

type ReportItem = {
  name: string;
  province: string;
  city: string;
  imageUrl?: string | null;
  source: "local-index" | "bing-image" | "unchanged";
  note?: string;
};

const prisma = new PrismaClient();
const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public", "media", "curated-spots");
const REPORT_PATH = path.join(ROOT, "data", "import-ready", "spot-image-fill.report.json");
const SEED_JSON_PATH = path.join(ROOT, "data", "rural-spots.seed.json");
const PHOTO_INDEX_PATH = path.join(ROOT, "data", "全国旅游数据整合_2026-03-24", "平台景点照片索引.csv");

const seedTargets: ImageTarget[] = [
  { name: "陕西历史博物馆", province: "陕西省", city: "西安市" },
  { name: "松阳杨家堂村", province: "浙江省", city: "丽水市", query: "松阳杨家堂村 丽水 古村落" },
  { name: "凤凰竹山村", province: "湖南省", city: "湘西土家族苗族自治州", query: "凤凰竹山村 凤凰县 苗寨" }
];

const localAliasMap: Record<string, string[]> = {
  青秀山: ["南宁青秀山"]
};

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function sanitizeFilePart(input: string) {
  const hash = crypto.createHash("md5").update(input).digest("hex").slice(0, 12);
  return hash;
}

function extFromContentType(contentType: string | null) {
  const normalized = (contentType || "").toLowerCase();
  if (normalized.includes("image/png")) return ".png";
  if (normalized.includes("image/webp")) return ".webp";
  if (normalized.includes("image/avif")) return ".avif";
  if (normalized.includes("image/gif")) return ".gif";
  return ".jpg";
}

function parsePhotoIndex(): PhotoIndexRow[] {
  const workbook = XLSX.readFile(PHOTO_INDEX_PATH, { raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<PhotoIndexRow>(sheet, { defval: "" });
}

function pickLocalImage(rows: PhotoIndexRow[], target: ImageTarget) {
  const aliases = [target.name, ...(target.aliases || []), ...(localAliasMap[target.name] || [])];
  const candidates = rows.filter((row) => {
    const scenic = String(row["景点名称"] || "").trim();
    const city = String(row["所在城市"] || "").trim();
    const province = String(row["所在省份"] || "").trim();
    return aliases.some((alias) => scenic === alias) && city.includes(target.city.replace(/自治州|地区/g, "")) || aliases.some((alias) => scenic === alias) && province.includes(target.province.replace(/省|市|壮族自治区|维吾尔自治区/g, ""));
  });

  for (const row of candidates) {
    const filePath = String(row["本地图片路径"] || "").trim();
    if (filePath && fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

async function copyLocalImageToPublic(target: ImageTarget, sourcePath: string) {
  const ext = path.extname(sourcePath) || ".jpg";
  const fileName = `${sanitizeFilePart(`${target.province}-${target.city}-${target.name}`)}${ext}`;
  const outputPath = path.join(PUBLIC_DIR, fileName);
  ensureDir(outputPath);
  await fsp.copyFile(sourcePath, outputPath);
  return `/media/curated-spots/${fileName}`;
}

async function searchBingImage(query: string) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0"
    }
  });
  if (!response.ok) throw new Error(`bing_search_${response.status}`);
  const html = await response.text();
  const match = html.match(/murl&quot;:&quot;([^&]+?)&quot;/i);
  if (!match?.[1]) return null;
  return match[1];
}

async function downloadRemoteImageToPublic(target: ImageTarget, imageUrl: string) {
  const response = await fetch(imageUrl, {
    headers: {
      "user-agent": "Mozilla/5.0",
      referer: "https://www.bing.com/"
    }
  });
  if (!response.ok) throw new Error(`download_${response.status}`);
  const contentType = response.headers.get("content-type");
  const ext = extFromContentType(contentType);
  const fileName = `${sanitizeFilePart(`${target.province}-${target.city}-${target.name}`)}${ext}`;
  const outputPath = path.join(PUBLIC_DIR, fileName);
  ensureDir(outputPath);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(outputPath, buffer);
  return `/media/curated-spots/${fileName}`;
}

async function resolveImageForTarget(rows: PhotoIndexRow[], target: ImageTarget): Promise<ReportItem> {
  const localPath = pickLocalImage(rows, target);
  if (localPath) {
    const publicUrl = await copyLocalImageToPublic(target, localPath);
    return {
      name: target.name,
      province: target.province,
      city: target.city,
      imageUrl: publicUrl,
      source: "local-index"
    };
  }

  const query = target.query || `${target.province} ${target.city} ${target.name} 景区`;
  const remoteImage = await searchBingImage(query);
  if (!remoteImage) {
    return {
      name: target.name,
      province: target.province,
      city: target.city,
      source: "unchanged",
      note: "no_image_found"
    };
  }

  const publicUrl = await downloadRemoteImageToPublic(target, remoteImage);
  return {
    name: target.name,
    province: target.province,
    city: target.city,
    imageUrl: publicUrl,
    source: "bing-image",
    note: remoteImage
  };
}

async function updateSeedJson(results: ReportItem[]) {
  const raw = await fsp.readFile(SEED_JSON_PATH, "utf8");
  const rows = JSON.parse(raw) as Array<Record<string, unknown>>;
  let changed = 0;

  for (const result of results) {
    if (!result.imageUrl) continue;
    const row = rows.find(
      (item) =>
        String(item.name || "") === result.name &&
        String(item.province || "") === result.province &&
        String(item.city || "") === result.city
    );
    if (!row) continue;
    row.imageUrl = result.imageUrl;
    changed += 1;
  }

  if (changed > 0) {
    await fsp.writeFile(SEED_JSON_PATH, JSON.stringify(rows, null, 2), "utf8");
  }

  return changed;
}

async function updateRuntimeDemoStore(results: ReportItem[]) {
  const base = loadSeedSpots();
  const updates: RuralSpotSeed[] = [];

  for (const result of results) {
    if (!result.imageUrl) continue;
    const spot = base.find((item) => item.name === result.name && item.province === result.province && item.city === result.city);
    if (!spot) continue;
    updates.push({
      ...spot,
      imageUrl: result.imageUrl,
      updatedAt: new Date().toISOString()
    });
  }

  if (updates.length > 0) {
    await bulkUpsertRuntimeDemoSpots(updates);
  }

  return updates.length;
}

async function updateDatabase(results: ReportItem[]) {
  const updated: Array<Record<string, unknown>> = [];

  for (const result of results) {
    if (!result.imageUrl) continue;
    const spots = await prisma.spot.findMany({
      where: {
        name: result.name,
        province: result.province,
        city: result.city
      },
      select: {
        id: true,
        imageUrl: true
      }
    });

    for (const spot of spots) {
      await prisma.spot.update({
        where: { id: spot.id },
        data: { imageUrl: result.imageUrl }
      });
      updated.push({
        id: spot.id,
        name: result.name,
        city: result.city,
        previousImageUrl: spot.imageUrl,
        nextImageUrl: result.imageUrl
      });
    }
  }

  return updated;
}

async function main() {
  ensureDir(REPORT_PATH);
  await fsp.mkdir(PUBLIC_DIR, { recursive: true });

  const photoIndexRows = parsePhotoIndex();
  const dbTargets: ImageTarget[] = [];

  try {
    const missingImageSpots = await prisma.spot.findMany({
      where: {
        OR: [{ imageUrl: null }, { imageUrl: "" }]
      },
      select: {
        name: true,
        province: true,
        city: true
      }
    });

    for (const spot of missingImageSpots) {
      dbTargets.push({
        name: spot.name,
        province: spot.province,
        city: spot.city
      });
    }
  } catch {
    // DB unavailable时仍继续修复 demo fallback。
  }

  const targetMap = new Map<string, ImageTarget>();
  for (const target of [...seedTargets, ...dbTargets]) {
    targetMap.set(`${target.name}|${target.province}|${target.city}`, target);
  }

  const results: ReportItem[] = [];
  for (const target of targetMap.values()) {
    try {
      results.push(await resolveImageForTarget(photoIndexRows, target));
    } catch (error) {
      results.push({
        name: target.name,
        province: target.province,
        city: target.city,
        source: "unchanged",
        note: error instanceof Error ? error.message : "image_resolve_failed"
      });
    }
  }

  const successful = results.filter((item) => item.imageUrl);
  const seedJsonUpdated = await updateSeedJson(successful);
  const runtimeUpdated = await updateRuntimeDemoStore(successful);

  let dbUpdated: Array<Record<string, unknown>> = [];
  try {
    dbUpdated = await updateDatabase(successful);
  } catch {
    dbUpdated = [];
  }

  const report = {
    generatedAt: new Date().toISOString(),
    targetCount: targetMap.size,
    resolvedCount: successful.length,
    seedJsonUpdated,
    runtimeUpdated,
    dbUpdatedCount: dbUpdated.length,
    results,
    dbUpdated
  };

  await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
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
