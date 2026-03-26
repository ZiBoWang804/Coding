import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { bulkUpsertRuntimeDemoSpots } from "@/lib/demo-spot-store";
import { loadSeedSpots } from "@/lib/demo-data";
import { buildSpotImageKey, type SpotImageOverride } from "@/lib/spot-image";
import type { RuralSpotSeed } from "@/types";

type PhotoIndexRow = {
  景点名称?: string;
  所在城市?: string;
  所在省份?: string;
  平台?: string;
  来源标题?: string;
  图片URL?: string;
  本地图片路径?: string;
};

type CurateTarget = {
  name: string;
  province: string;
  city: string;
  aliases?: string[];
  query?: string;
  preferWebSearch?: boolean;
};

type AuditSeverity = "info" | "warning" | "critical";

type AuditItem = {
  key: string;
  name: string;
  province: string;
  city: string;
  finalImageUrl: string | null;
  confidence: "high" | "medium" | "low";
  issues: string[];
  severity: AuditSeverity;
};

type AuditReport = {
  audit?: {
    items?: AuditItem[];
  };
};

const prisma = new PrismaClient();
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public", "media", "curated-spots");
const OVERRIDES_PATH = path.join(DATA_DIR, "spot-image-overrides.json");
const REPORT_PATH = path.join(DATA_DIR, "import-ready", "spot-image-audit.report.json");
const RUNTIME_PATH = path.join(DATA_DIR, "demo-spots.runtime.json");
const SEED_JSON_PATH = path.join(DATA_DIR, "rural-spots.seed.json");
const GENERIC_REMOTE_HOSTS = ["images.unsplash.com", "source.unsplash.com"];

const CURATE_TARGETS: CurateTarget[] = [
  { name: "????", province: "???", city: "???", preferWebSearch: true, query: "?? ?? ???? ?? ??" },
  { name: "六鼎山", province: "吉林省", city: "延边朝鲜族自治州" },
  { name: "元阳梯田", province: "云南省", city: "红河哈尼族彝族自治州" },
  { name: "黄龙", province: "四川省", city: "阿坝藏族羌族自治州" },
  { name: "大理古城", province: "云南省", city: "大理白族自治州" },
  { name: "海螺沟", province: "四川省", city: "甘孜藏族自治州" },
  { name: "稻城亚丁", province: "四川省", city: "甘孜藏族自治州" },
  { name: "长白山", province: "吉林省", city: "延边朝鲜族自治州", aliases: ["长白山景区"] },
  { name: "上海辰山植物园", province: "上海市", city: "上海市", preferWebSearch: true },
  { name: "回民街", province: "陕西省", city: "西安市", preferWebSearch: true },
  { name: "西安城墙", province: "陕西省", city: "西安市", preferWebSearch: true },
  { name: "终南山", province: "陕西省", city: "西安市", preferWebSearch: true },
  { name: "西塘古镇", province: "浙江省", city: "嘉兴市" },
  { name: "北京欢乐谷", province: "北京市", city: "北京市", preferWebSearch: true },
  { name: "慕田峪长城", province: "北京市", city: "北京市", preferWebSearch: true },
  { name: "白云山", province: "广东省", city: "广州市", query: "广州白云山 景区" },
  { name: "上海迪士尼乐园", province: "上海市", city: "上海市", preferWebSearch: true },
  { name: "三星堆遗址", province: "四川省", city: "德阳市", aliases: ["三星堆博物馆"] },
  { name: "上海自然博物馆", province: "上海市", city: "上海市", preferWebSearch: true },
  { name: "柳叶湖", province: "湖南省", city: "常德市" },
  { name: "上海大观园", province: "上海市", city: "上海市", preferWebSearch: true },
  { name: "大雁塔", province: "陕西省", city: "西安市", aliases: ["大雁塔·大慈恩寺景区"], preferWebSearch: true },
  { name: "衡水湖", province: "河北省", city: "衡水市" },
  { name: "田子坊", province: "上海市", city: "上海市", preferWebSearch: true },
  { name: "上海海洋水族馆", province: "上海市", city: "上海市", preferWebSearch: true },
  { name: "殷墟", province: "河南省", city: "安阳市", aliases: ["殷墟景区"] },
  { name: "吉林北山", province: "吉林省", city: "吉林市", aliases: ["北山公园"] },
  { name: "正定隆兴寺", province: "河北省", city: "石家庄市", aliases: ["隆兴寺"] },
  { name: "徐州云龙湖", province: "江苏省", city: "徐州市", aliases: ["云龙湖"] },
  { name: "安源路矿工人运动纪念馆", province: "江西省", city: "萍乡市" },
  { name: "圆明园遗址公园", province: "北京市", city: "北京市", aliases: ["圆明园"], preferWebSearch: true },
  { name: "方特欢乐世界", province: "安徽省", city: "芜湖市", aliases: ["芜湖方特欢乐世界"] },
  { name: "露水河国家森林公园", province: "吉林省", city: "白山市" },
  { name: "798艺术区", province: "北京市", city: "北京市", preferWebSearch: true },
  { name: "深圳世界之窗", province: "广东省", city: "深圳市", aliases: ["世界之窗"] },
  { name: "万宁兴隆热带植物园", province: "海南省", city: "万宁市", aliases: ["兴隆热带植物园"] },
  { name: "陕西历史博物馆", province: "陕西省", city: "西安市", preferWebSearch: true },
  { name: "松阳杨家堂村", province: "浙江省", city: "丽水市" },
  { name: "凤凰竹山村", province: "湖南省", city: "湘西土家族苗族自治州" }
];

const NAME_SUFFIX_PATTERNS = [
  /周边乡宿带$/u,
  /周边村落$/u,
  /周边乡旅带$/u,
  /周边葡萄乡村带$/u
];

function ensureParent(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalize(value: string | null | undefined) {
  return String(value || "").trim();
}

function fuzzyRegion(value: string) {
  return normalize(value).replace(/省|市|区|县|自治州|自治区|特别行政区/g, "");
}

function buildTargetKey(target: CurateTarget) {
  return buildSpotImageKey({
    name: target.name,
    province: target.province,
    city: target.city
  });
}

function fileHash(input: string) {
  return crypto.createHash("md5").update(input).digest("hex").slice(0, 12);
}

function extFromPath(filePath: string) {
  const ext = path.extname(filePath);
  return ext || ".jpg";
}

function extFromContentType(contentType: string | null) {
  const normalized = (contentType || "").toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("avif")) return ".avif";
  if (normalized.includes("gif")) return ".gif";
  return ".jpg";
}

function findFileByName(startDir: string, fileName: string): string | null {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFileByName(fullPath, fileName);
      if (nested) return nested;
      continue;
    }
    if (entry.name === fileName) return fullPath;
  }
  return null;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function simplifySpotName(name: string) {
  let next = name.trim();
  for (const pattern of NAME_SUFFIX_PATTERNS) {
    next = next.replace(pattern, "");
  }
  next = next
    .replace(/^贵州/u, "")
    .replace(/^广东/u, "")
    .replace(/^广西/u, "")
    .replace(/^江苏/u, "")
    .replace(/^江西/u, "")
    .replace(/^山西/u, "")
    .replace(/^陕西/u, "")
    .replace(/^宁夏/u, "")
    .replace(/^云南/u, "")
    .replace(/^湖南/u, "")
    .replace(/^福建/u, "")
    .replace(/^甘肃/u, "")
    .replace(/^山东/u, "");
  return next.trim() || name.trim();
}

function buildDynamicTargetsFromReport() {
  const report = readJsonFile<AuditReport>(REPORT_PATH, {});
  const items = report.audit?.items || [];
  return items
    .filter((item) => item.confidence === "low" || item.issues.includes("missing_image"))
    .map((item) => {
      const alias = simplifySpotName(item.name);
      return {
        name: item.name,
        province: item.province,
        city: item.city,
        aliases: alias !== item.name ? [alias] : [],
        query: `${item.province} ${item.city} ${alias} 旅游景点 图片`
      } satisfies CurateTarget;
    });
}

function parsePhotoIndex() {
  const filePath = findFileByName(DATA_DIR, "平台景点照片索引.csv");
  if (!filePath) {
    throw new Error("photo_index_not_found");
  }
  const workbook = XLSX.readFile(filePath, { raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<PhotoIndexRow>(sheet, { defval: "" });
}

function pickLocalCandidate(rows: PhotoIndexRow[], target: CurateTarget) {
  const aliases = [target.name, ...(target.aliases || [])];
  const matched = rows.filter((row) => {
    const scenicName = normalize(row.景点名称);
    const city = fuzzyRegion(normalize(row.所在城市));
    const province = fuzzyRegion(normalize(row.所在省份));
    const cityMatch = city.includes(fuzzyRegion(target.city));
    const provinceMatch = province.includes(fuzzyRegion(target.province));
    return aliases.includes(scenicName) && (cityMatch || provinceMatch);
  });

  matched.sort((left, right) => {
    const leftHasLocal = fs.existsSync(normalize(left.本地图片路径));
    const rightHasLocal = fs.existsSync(normalize(right.本地图片路径));
    if (leftHasLocal !== rightHasLocal) return leftHasLocal ? -1 : 1;
    const leftScore = normalize(left.来源标题).includes(target.name) ? 1 : 0;
    const rightScore = normalize(right.来源标题).includes(target.name) ? 1 : 0;
    return rightScore - leftScore;
  });

  return matched[0] ?? null;
}

async function copyLocalImage(target: CurateTarget, sourcePath: string) {
  const ext = extFromPath(sourcePath);
  const fileName = `${fileHash(`${target.province}-${target.city}-${target.name}`)}${ext}`;
  const destination = path.join(PUBLIC_DIR, fileName);
  ensureParent(destination);
  await fsp.copyFile(sourcePath, destination);
  return `/media/curated-spots/${fileName}`;
}

async function downloadImage(target: CurateTarget, sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0",
      referer: "https://www.bing.com/"
    },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) {
    throw new Error(`image_download_${response.status}`);
  }
  const ext = extFromContentType(response.headers.get("content-type"));
  const fileName = `${fileHash(`${target.province}-${target.city}-${target.name}`)}${ext}`;
  const destination = path.join(PUBLIC_DIR, fileName);
  ensureParent(destination);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(destination, buffer);
  return `/media/curated-spots/${fileName}`;
}

async function searchBingImage(query: string) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0"
    },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`bing_search_${response.status}`);
  }
  const html = await response.text();
  const match = html.match(/murl&quot;:&quot;(.*?)&quot;/i);
  return match?.[1]?.replace(/&amp;/g, "&") || null;
}

async function resolveTargetOverride(rows: PhotoIndexRow[], target: CurateTarget): Promise<SpotImageOverride | null> {
  if (!target.preferWebSearch) {
    const candidate = pickLocalCandidate(rows, target);
    if (candidate) {
      const localPath = normalize(candidate.本地图片路径);
      const remoteUrl = normalize(candidate.图片URL);
      let publicUrl: string | null = null;

      if (localPath && fs.existsSync(localPath)) {
        publicUrl = await copyLocalImage(target, localPath);
      } else if (remoteUrl) {
        publicUrl = await downloadImage(target, remoteUrl);
      }

      if (publicUrl) {
        return {
          key: buildTargetKey(target),
          name: target.name,
          province: target.province,
          city: target.city,
          imageUrl: publicUrl,
          source: normalize(candidate.平台) || "photo-index",
          sourceUrl: remoteUrl || null,
          confidence: "high"
        };
      }
    }
  }

  const searchQuery = target.query || `${target.province} ${target.city} ${target.name} 景区 官方 图片`;
  const remoteImage = await searchBingImage(searchQuery);
  if (!remoteImage) return null;

  return {
    key: buildTargetKey(target),
    name: target.name,
    province: target.province,
    city: target.city,
    imageUrl: await downloadImage(target, remoteImage),
    source: "bing-image-search",
    sourceUrl: remoteImage,
    confidence: "medium"
  };
}

function mergeSpotsWithRuntime(seedSpots: RuralSpotSeed[]) {
  const runtimeState = readJsonFile<{ upserts?: RuralSpotSeed[]; deletedIds?: string[] }>(RUNTIME_PATH, {});
  const deletedIds = new Set(runtimeState.deletedIds || []);
  const merged = new Map<string, RuralSpotSeed>();

  for (const spot of seedSpots) {
    if (!spot.id || deletedIds.has(spot.id)) continue;
    merged.set(buildSpotImageKey(spot), spot);
  }

  for (const spot of runtimeState.upserts || []) {
    merged.set(buildSpotImageKey(spot), spot);
  }

  return [...merged.values()];
}

async function loadAuditSpots() {
  try {
    const rows = await prisma.spot.findMany({
      select: {
        id: true,
        name: true,
        province: true,
        city: true,
        district: true,
        imageUrl: true
      }
    });

    return {
      source: "database" as const,
      spots: rows.map(
        (row) =>
          ({
            id: row.id,
            name: row.name,
            province: row.province,
            city: row.city,
            district: row.district,
            description: "",
            tags: [],
            bestSeason: [],
            source: "database",
            imageUrl: row.imageUrl
          }) satisfies RuralSpotSeed
      )
    };
  } catch {
    return {
      source: "seed-runtime" as const,
      spots: mergeSpotsWithRuntime(loadSeedSpots())
    };
  }
}

async function updateSeedJson(overrides: SpotImageOverride[]) {
  const rows = readJsonFile<Array<Record<string, unknown>>>(SEED_JSON_PATH, []);
  let changed = 0;

  for (const override of overrides) {
    const row = rows.find(
      (item) =>
        normalize(String(item.name || "")) === override.name &&
        normalize(String(item.province || "")) === override.province &&
        normalize(String(item.city || "")) === override.city
    );
    if (!row) continue;
    row.imageUrl = override.imageUrl;
    changed += 1;
  }

  if (changed > 0) {
    await fsp.writeFile(SEED_JSON_PATH, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  }

  return changed;
}

async function updateRuntimeStore(overrides: SpotImageOverride[]) {
  const base = mergeSpotsWithRuntime(loadSeedSpots());
  const updates: RuralSpotSeed[] = [];

  for (const override of overrides) {
    const match = base.find(
      (spot) => spot.name === override.name && spot.province === override.province && spot.city === override.city
    );
    if (!match) continue;
    updates.push({
      ...match,
      imageUrl: override.imageUrl,
      updatedAt: new Date().toISOString()
    });
  }

  if (updates.length > 0) {
    await bulkUpsertRuntimeDemoSpots(updates);
  }

  return updates.length;
}

async function updateDatabase(overrides: SpotImageOverride[]) {
  const updates: Array<{ id: string; key: string }> = [];
  try {
    for (const override of overrides) {
      const spots = await prisma.spot.findMany({
        where: {
          name: override.name,
          province: override.province || undefined,
          city: override.city || undefined
        },
        select: {
          id: true
        }
      });

      for (const spot of spots) {
        await prisma.spot.update({
          where: { id: spot.id },
          data: { imageUrl: override.imageUrl }
        });
        updates.push({ id: spot.id, key: override.key });
      }
    }
  } catch {
    return {
      updatedCount: updates.length,
      dbAvailable: false
    };
  }

  return {
    updatedCount: updates.length,
    dbAvailable: true
  };
}

function buildAudit(spots: RuralSpotSeed[], overrides: SpotImageOverride[]) {
  const overrideMap = new Map(overrides.map((item) => [item.key, item]));
  const imageUsage = new Map<string, string[]>();
  const auditItems: AuditItem[] = [];

  for (const spot of spots) {
    const key = buildSpotImageKey(spot);
    const override = overrideMap.get(key);
    const finalImageUrl = override?.imageUrl || normalize(spot.imageUrl) || normalize(spot.photoUrls?.[0]) || null;
    if (finalImageUrl) {
      const users = imageUsage.get(finalImageUrl) || [];
      users.push(key);
      imageUsage.set(finalImageUrl, users);
    }
  }

  for (const spot of spots) {
    const key = buildSpotImageKey(spot);
    const override = overrideMap.get(key);
    const finalImageUrl = override?.imageUrl || normalize(spot.imageUrl) || normalize(spot.photoUrls?.[0]) || null;
    const issues: string[] = [];
    let confidence: AuditItem["confidence"] = override?.confidence || "medium";
    let severity: AuditSeverity = "info";

    if (!finalImageUrl) {
      issues.push("missing_image");
      confidence = "low";
      severity = "critical";
    } else {
      if (GENERIC_REMOTE_HOSTS.some((host) => finalImageUrl.includes(host))) {
        issues.push("generic_placeholder");
        confidence = "low";
        severity = "warning";
      }
      if ((imageUsage.get(finalImageUrl)?.length || 0) > 1) {
        issues.push("duplicate_image_shared");
        if (confidence === "high") confidence = "medium";
        if (severity === "info") severity = "warning";
      }
      if (override?.source === "bing-image-search" && confidence === "medium") {
        issues.push("manual_review_recommended");
      }
      if (override?.source && override.source !== "bing-image-search") {
        confidence = "high";
      }
      if (finalImageUrl.startsWith("/media/curated-spots/")) {
        confidence = confidence === "low" ? "medium" : confidence;
      }
    }

    auditItems.push({
      key,
      name: spot.name,
      province: spot.province,
      city: spot.city,
      finalImageUrl,
      confidence,
      issues,
      severity
    });
  }

  const summary = {
    total: auditItems.length,
    highConfidence: auditItems.filter((item) => item.confidence === "high").length,
    mediumConfidence: auditItems.filter((item) => item.confidence === "medium").length,
    lowConfidence: auditItems.filter((item) => item.confidence === "low").length,
    missingImage: auditItems.filter((item) => item.issues.includes("missing_image")).length,
    genericPlaceholder: auditItems.filter((item) => item.issues.includes("generic_placeholder")).length,
    duplicateShared: auditItems.filter((item) => item.issues.includes("duplicate_image_shared")).length
  };

  return { summary, items: auditItems };
}

async function writeOverrides(overrides: SpotImageOverride[]) {
  const sorted = [...overrides].sort((left, right) => left.key.localeCompare(right.key, "zh-CN"));
  await fsp.writeFile(OVERRIDES_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

async function main() {
  await fsp.mkdir(PUBLIC_DIR, { recursive: true });
  ensureParent(REPORT_PATH);

  const rows = parsePhotoIndex();
  const remediationTargets = buildDynamicTargetsFromReport();
  const previous = readJsonFile<SpotImageOverride[]>(OVERRIDES_PATH, []);
  const previousMap = new Map(previous.map((item) => [item.key, item]));
  const nextMap = new Map<string, SpotImageOverride>();
  const targetMap = new Map<string, CurateTarget>();

  for (const target of [...CURATE_TARGETS, ...remediationTargets]) {
    targetMap.set(buildTargetKey(target), target);
  }

  for (const target of targetMap.values()) {
    const key = buildTargetKey(target);
    try {
      const resolved = await resolveTargetOverride(rows, target);
      if (resolved) {
        nextMap.set(key, resolved);
        continue;
      }
    } catch {
      // Ignore and preserve prior override if it exists.
    }

    const existing = previousMap.get(key);
    if (existing) {
      nextMap.set(key, existing);
    }
  }

  const overrides = [...nextMap.values()];
  await writeOverrides(overrides);
  const seedJsonUpdated = await updateSeedJson(overrides);
  const runtimeUpdated = await updateRuntimeStore(overrides);
  const dbStatus = await updateDatabase(overrides);
  const auditSource = await loadAuditSpots();
  const audit = buildAudit(auditSource.spots, overrides);

  const report = {
    generatedAt: new Date().toISOString(),
    curatedTargetCount: CURATE_TARGETS.length,
    remediationTargetCount: remediationTargets.length,
    overrideCount: overrides.length,
    seedJsonUpdated,
    runtimeUpdated,
    dbStatus,
    auditSource: auditSource.source,
    audit
  };

  await fsp.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
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
