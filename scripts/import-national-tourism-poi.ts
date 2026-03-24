import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { bulkUpsertRuntimeDemoSpots, listRuntimeDemoSpots } from "@/lib/demo-spot-store";
import { buildAmapNavigationUrl, buildGenericHotelUrl, buildGenericTicketUrl } from "@/lib/utils";
import type { RuralSpotSeed } from "@/types";

type ProvinceItem = {
  code: string;
  name: string;
  province: string;
};

type CityItem = {
  code: string;
  name: string;
  province: string;
  city: string;
};

type RawPoiRow = Record<string, unknown>;

type ImportRow = {
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
  batch: string | null;
  source: string;
};

type LocationMatch = {
  province: string;
  city: string;
};

type CleanResult = {
  cleanedRows: ImportRow[];
  unresolvedAreas: string[];
  report: Record<string, unknown>;
};

const SPECIAL_AREA_MAP: Record<string, LocationMatch> = {
  北京: { province: "北京市", city: "北京市" },
  上海: { province: "上海市", city: "上海市" },
  天津: { province: "天津市", city: "天津市" },
  重庆: { province: "重庆市", city: "重庆市" },
  香港: { province: "香港特别行政区", city: "香港特别行政区" },
  澳门: { province: "澳门特别行政区", city: "澳门特别行政区" },
  台北: { province: "台湾省", city: "台北市" },
  台中: { province: "台湾省", city: "台中市" },
  台南: { province: "台湾省", city: "台南市" },
  台东: { province: "台湾省", city: "台东县" },
  高雄: { province: "台湾省", city: "高雄市" },
  新北: { province: "台湾省", city: "新北市" },
  桃园: { province: "台湾省", city: "桃园市" },
  新竹: { province: "台湾省", city: "新竹市" },
  基隆: { province: "台湾省", city: "基隆市" },
  嘉义: { province: "台湾省", city: "嘉义市" },
  宜兰: { province: "台湾省", city: "宜兰县" },
  花莲: { province: "台湾省", city: "花莲县" },
  云林: { province: "台湾省", city: "云林县" },
  彰化: { province: "台湾省", city: "彰化县" },
  南投: { province: "台湾省", city: "南投县" },
  苗栗: { province: "台湾省", city: "苗栗县" },
  屏东: { province: "台湾省", city: "屏东县" },
  白沙: { province: "海南省", city: "白沙黎族自治县" },
  保亭: { province: "海南省", city: "保亭黎族苗族自治县" },
  昌江: { province: "海南省", city: "昌江黎族自治县" },
  澄迈: { province: "海南省", city: "澄迈县" },
  定安: { province: "海南省", city: "定安县" },
  东方: { province: "海南省", city: "东方市" },
  儋州: { province: "海南省", city: "儋州市" },
  临高: { province: "海南省", city: "临高县" },
  乐东: { province: "海南省", city: "乐东黎族自治县" },
  陵水: { province: "海南省", city: "陵水黎族自治县" },
  琼海: { province: "海南省", city: "琼海市" },
  琼中: { province: "海南省", city: "琼中黎族苗族自治县" },
  屯昌: { province: "海南省", city: "屯昌县" },
  万宁: { province: "海南省", city: "万宁市" },
  文昌: { province: "海南省", city: "文昌市" },
  五指山: { province: "海南省", city: "五指山市" },
  阿拉尔: { province: "新疆维吾尔自治区", city: "阿拉尔市" },
  石河子: { province: "新疆维吾尔自治区", city: "石河子市" },
  五家渠: { province: "新疆维吾尔自治区", city: "五家渠市" },
  北疆: { province: "新疆维吾尔自治区", city: "北疆地区" },
  巢湖: { province: "安徽省", city: "巢湖市" },
  济源: { province: "河南省", city: "济源市" },
  嘉义县: { province: "台湾省", city: "嘉义县" },
  金门: { province: "台湾省", city: "金门县" },
  可克达拉: { province: "新疆维吾尔自治区", city: "可克达拉市" },
  马祖: { province: "台湾省", city: "连江县" },
  澎湖: { province: "台湾省", city: "澎湖县" },
  怒江: { province: "云南省", city: "怒江傈僳族自治州" },
  伊犁: { province: "新疆维吾尔自治区", city: "伊犁哈萨克自治州" },
  潜江: { province: "湖北省", city: "潜江市" },
  青木川: { province: "陕西省", city: "汉中市" },
  神农架: { province: "湖北省", city: "神农架林区" },
  太湖: { province: "江苏省", city: "无锡市" },
  天门: { province: "湖北省", city: "天门市" },
  图木舒克: { province: "新疆维吾尔自治区", city: "图木舒克市" },
  仙桃: { province: "湖北省", city: "仙桃市" }
};

const EXCLUDED_KEYWORDS = [
  "游客中心",
  "游客服务中心",
  "服务中心",
  "服务区",
  "售票处",
  "票务中心",
  "停车场",
  "停车区",
  "停车点",
  "停车楼",
  "停车库",
  "入口",
  "出口",
  "卫生间",
  "公厕",
  "厕所",
  "酒店",
  "宾馆",
  "民宿",
  "客栈",
  "饭店",
  "餐厅",
  "商店",
  "便利店",
  "超市",
  "管理处",
  "办公区",
  "宿舍",
  "观光车站",
  "索道上站",
  "索道下站",
  "游客集散中心"
];

const TAG_RULES: Array<{ keywords: string[]; tags: string[] }> = [
  {
    keywords: ["山", "峰", "岭", "崖", "谷", "峡", "瀑布", "河", "湖", "海", "岛", "湾", "湿地", "草原", "森林"],
    tags: ["自然风光"]
  },
  {
    keywords: ["古镇", "古城", "古村", "故居", "遗址", "博物馆", "纪念馆", "书院", "寺", "庙", "祠", "塔", "宫", "院"],
    tags: ["人文历史"]
  },
  {
    keywords: ["乐园", "动物园", "海洋馆", "世界", "欢乐谷", "游乐"],
    tags: ["亲子休闲"]
  },
  {
    keywords: ["温泉", "度假区", "漂流", "滑雪", "牧场"],
    tags: ["休闲度假"]
  },
  {
    keywords: ["公园", "园林"],
    tags: ["城市休闲"]
  }
];

function getArg(flag: string) {
  const hit = process.argv.find((item) => item.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

function normalizeDivisionName(value: string) {
  let normalized = value.trim().replace(/\s+/g, "");

  const suffixPattern = /(特别行政区|自治区|自治州|自治县|地区|盟|林区|省|市)$/;
  while (suffixPattern.test(normalized)) {
    normalized = normalized.replace(suffixPattern, "");
  }

  const ethnicPattern =
    /(壮族|回族|维吾尔族|维吾尔|蒙古族|蒙古|藏族|苗族|彝族|白族|哈尼族|傣族|侗族|布依族|朝鲜族|土家族|哈萨克族|柯尔克孜|黎族|羌族|景颇族|仫佬族|水族|满族|瑶族|畲族|撒拉族)+$/;
  while (ethnicPattern.test(normalized)) {
    normalized = normalized.replace(ethnicPattern, "");
  }

  return normalized;
}

function makeDeterministicId(input: string) {
  return `poi-${createHash("sha1").update(input).digest("hex").slice(0, 20)}`;
}

function roundCoord(value: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(6));
}

function inferSuggestedDuration(name: string, tags: string[]) {
  if (["亲子休闲", "人文历史"].some((tag) => tags.includes(tag))) return "2-4小时";
  if (name.includes("景区") || name.includes("风景区") || name.includes("古镇") || name.includes("古城")) return "半天";
  if (name.includes("国家公园") || name.includes("度假区")) return "1天";
  return "半天";
}

function inferBestSeason(name: string) {
  if (name.includes("滑雪") || name.includes("冰雪")) return ["冬"];
  if (name.includes("海") || name.includes("湖") || name.includes("岛")) return ["夏", "秋"];
  return ["春", "秋"];
}

function classifyTags(name: string) {
  const tags = new Set<string>(["旅游景点"]);

  for (const rule of TAG_RULES) {
    if (rule.keywords.some((keyword) => name.includes(keyword))) {
      rule.tags.forEach((tag) => tags.add(tag));
    }
  }

  if (tags.size === 1) {
    tags.add("城市漫游");
  }

  return Array.from(tags).slice(0, 4);
}

function shouldExclude(name: string) {
  return EXCLUDED_KEYWORDS.some((keyword) => name.includes(keyword));
}

function buildResolver() {
  const provinceItems = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "china-province-map.json"), "utf8")
  ) as ProvinceItem[];
  const cityItems = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "china-city-map.json"), "utf8")) as CityItem[];

  const provinceByCode = new Map(provinceItems.map((item) => [item.province, item.name]));
  const provinceResolver = new Map<string, LocationMatch>();
  const cityResolver = new Map<string, LocationMatch>();
  const specialResolver = new Map<string, LocationMatch>();

  for (const [alias, target] of Object.entries(SPECIAL_AREA_MAP)) {
    specialResolver.set(alias, target);
    specialResolver.set(normalizeDivisionName(alias), target);
  }

  for (const item of provinceItems) {
    const official = item.name;
    const normalized = normalizeDivisionName(official);
    const target = { province: official, city: official };
    provinceResolver.set(official, target);
    provinceResolver.set(normalized, target);
  }

  for (const item of cityItems) {
    const province = provinceByCode.get(item.province);
    if (!province) continue;

    const official = item.name;
    const aliases = new Set<string>([
      official,
      item.city,
      normalizeDivisionName(official),
      normalizeDivisionName(item.city),
      official.replace(/市|地区|盟|自治州|林区$/g, "")
    ]);

    for (const alias of aliases) {
      const normalized = alias.trim();
      if (!normalized) continue;
      cityResolver.set(normalized, { province, city: official });
    }
  }

  return { provinceResolver, cityResolver, specialResolver };
}

function resolveLocation(areaRaw: string, resolver: ReturnType<typeof buildResolver>) {
  const area = areaRaw.trim();
  if (!area) return null;

  const normalized = normalizeDivisionName(area).replace(/州$/g, "");
  return (
    resolver.specialResolver.get(area) ||
    resolver.specialResolver.get(normalized) ||
    resolver.cityResolver.get(area) ||
    resolver.cityResolver.get(normalized) ||
    resolver.provinceResolver.get(area) ||
    resolver.provinceResolver.get(normalized) ||
    null
  );
}

function csvCell(value: string | number | boolean | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(filePath: string, rows: ImportRow[]) {
  const headers = [
    "name",
    "province",
    "city",
    "district",
    "address",
    "description",
    "tags",
    "rating",
    "crowdLevel",
    "avgCost",
    "suggestedDuration",
    "bestSeason",
    "transportInfo",
    "latitude",
    "longitude",
    "imageUrl",
    "ticketBookingUrl",
    "hotelBookingUrl",
    "gaodeNavigationUrl",
    "isNationalKeyVillage",
    "batch",
    "source"
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.province,
        row.city,
        row.district,
        row.address,
        row.description,
        row.tags.join(" | "),
        row.rating,
        row.crowdLevel,
        row.avgCost,
        row.suggestedDuration,
        row.bestSeason.join(" | "),
        row.transportInfo,
        row.latitude,
        row.longitude,
        row.imageUrl,
        row.ticketBookingUrl,
        row.hotelBookingUrl,
        row.gaodeNavigationUrl,
        row.isNationalKeyVillage,
        row.batch,
        row.source
      ]
        .map(csvCell)
        .join(",")
    )
  ];

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

function buildImportRows(rows: RawPoiRow[], batch: string, source: string): CleanResult {
  const resolver = buildResolver();
  const headers = Object.keys(rows[0] || {});
  const [nameKey, gcjLngKey, gcjLatKey, wgsLngKey, wgsLatKey, areaKey] = headers;

  const dedupeMap = new Map<string, ImportRow>();
  const unresolvedAreaSet = new Set<string>();
  const tagStats = new Map<string, number>();
  let excludedKeywordCount = 0;
  let invalidCoordCount = 0;
  let duplicateDroppedCount = 0;
  let unresolvedRowCount = 0;

  for (const row of rows) {
    const name = String(row[nameKey] ?? "").trim();
    const areaRaw = String(row[areaKey] ?? "").trim();
    const wgsLng = Number(row[wgsLngKey]);
    const wgsLat = Number(row[wgsLatKey]);
    const gcjLng = Number(row[gcjLngKey]);
    const gcjLat = Number(row[gcjLatKey]);

    if (!name || !areaRaw) continue;
    if (shouldExclude(name)) {
      excludedKeywordCount += 1;
      continue;
    }

    const location = resolveLocation(areaRaw, resolver);
    if (!location) {
      unresolvedAreaSet.add(areaRaw);
      unresolvedRowCount += 1;
      continue;
    }

    const longitude = roundCoord(Number.isFinite(wgsLng) ? wgsLng : Number.isFinite(gcjLng) ? gcjLng : null);
    const latitude = roundCoord(Number.isFinite(wgsLat) ? wgsLat : Number.isFinite(gcjLat) ? gcjLat : null);

    if (longitude == null || latitude == null) {
      invalidCoordCount += 1;
      continue;
    }

    const tags = classifyTags(name);
    const cleaned: ImportRow = {
      name,
      province: location.province,
      city: location.city,
      district: null,
      address: null,
      description: `${name}，位于${location.province}${location.city}，来源于 2025 全国旅游景点 POI 数据清洗导入，当前优先保留基础位置与主题分类信息。`,
      tags,
      rating: null,
      crowdLevel: null,
      avgCost: null,
      suggestedDuration: inferSuggestedDuration(name, tags),
      bestSeason: inferBestSeason(name),
      transportInfo: "建议优先使用地图导航前往，原始 POI 数据未提供更细的交通说明。",
      latitude,
      longitude,
      imageUrl: null,
      ticketBookingUrl: buildGenericTicketUrl(name, location.city),
      hotelBookingUrl: buildGenericHotelUrl(name, location.city),
      gaodeNavigationUrl: buildAmapNavigationUrl(name, location.city, null),
      isNationalKeyVillage: false,
      batch,
      source
    };

    const dedupeKey = `${cleaned.name}@@${cleaned.province}@@${cleaned.city}@@${Math.round(longitude * 10000)}@@${Math.round(
      latitude * 10000
    )}`;

    if (dedupeMap.has(dedupeKey)) {
      duplicateDroppedCount += 1;
      continue;
    }

    dedupeMap.set(dedupeKey, cleaned);
    for (const tag of cleaned.tags) {
      tagStats.set(tag, (tagStats.get(tag) ?? 0) + 1);
    }
  }

  const cleanedRows = Array.from(dedupeMap.values());
  const unresolvedAreas = Array.from(unresolvedAreaSet).sort((left, right) => left.localeCompare(right, "zh-CN"));
  const tagDistribution = Object.fromEntries(
    Array.from(tagStats.entries()).sort((left, right) => {
      const countGap = right[1] - left[1];
      if (countGap !== 0) return countGap;
      return left[0].localeCompare(right[0], "zh-CN");
    })
  );

  return {
    cleanedRows,
    unresolvedAreas,
    report: {
      totalRows: rows.length,
      cleanedRows: cleanedRows.length,
      excludedKeywordCount,
      invalidCoordCount,
      duplicateDroppedCount,
      unresolvedAreaCount: unresolvedAreas.length,
      unresolvedRowCount,
      tagDistribution,
      unresolvedAreas: unresolvedAreas.slice(0, 200)
    }
  };
}

function toRuntimeSpot(row: ImportRow): RuralSpotSeed {
  const now = new Date().toISOString();

  return {
    id: makeDeterministicId(`${row.name}@@${row.province}@@${row.city}@@${row.district ?? ""}@@${row.longitude}@@${row.latitude}`),
    name: row.name,
    province: row.province,
    city: row.city,
    district: row.district,
    address: row.address,
    description: row.description,
    tags: row.tags,
    rating: row.rating,
    crowdLevel: row.crowdLevel,
    avgCost: row.avgCost,
    suggestedDuration: row.suggestedDuration,
    bestSeason: row.bestSeason,
    transportInfo: row.transportInfo,
    latitude: row.latitude,
    longitude: row.longitude,
    imageUrl: row.imageUrl,
    ticketBookingUrl: row.ticketBookingUrl,
    hotelBookingUrl: row.hotelBookingUrl,
    gaodeNavigationUrl: row.gaodeNavigationUrl,
    isNationalKeyVillage: row.isNationalKeyVillage,
    batch: row.batch,
    source: row.source,
    accommodationTips: [],
    diningTips: [],
    routeHighlights: [],
    createdAt: now,
    updatedAt: now
  };
}

function buildStrictKey(spot: { name: string; province: string; city: string; district?: string | null }) {
  return `${spot.name}@@${spot.province}@@${spot.city}@@${spot.district ?? ""}`;
}

function buildLooseKey(spot: { name: string; province: string; city: string }) {
  return `${spot.name}@@${spot.province}@@${spot.city}`;
}

function mergeSpot(existing: RuralSpotSeed, incoming: RuralSpotSeed): RuralSpotSeed {
  return {
    ...existing,
    tags: Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])])).slice(0, 6),
    latitude: existing.latitude ?? incoming.latitude,
    longitude: existing.longitude ?? incoming.longitude,
    imageUrl: existing.imageUrl ?? incoming.imageUrl,
    ticketBookingUrl: existing.ticketBookingUrl ?? incoming.ticketBookingUrl,
    hotelBookingUrl: existing.hotelBookingUrl ?? incoming.hotelBookingUrl,
    gaodeNavigationUrl: existing.gaodeNavigationUrl ?? incoming.gaodeNavigationUrl,
    transportInfo: existing.transportInfo ?? incoming.transportInfo,
    suggestedDuration: existing.suggestedDuration ?? incoming.suggestedDuration,
    bestSeason: Array.isArray(existing.bestSeason) && existing.bestSeason.length > 0 ? existing.bestSeason : incoming.bestSeason,
    description: existing.description?.trim() ? existing.description : incoming.description,
    updatedAt: new Date().toISOString()
  };
}

async function importIntoDemo(rows: ImportRow[]) {
  const existingSpots = await listRuntimeDemoSpots();
  const strictMap = new Map<string, RuralSpotSeed>();
  const looseMap = new Map<string, RuralSpotSeed>();

  for (const spot of existingSpots) {
    strictMap.set(buildStrictKey(spot), spot);
    looseMap.set(buildLooseKey(spot), spot);
  }

  const upserts: RuralSpotSeed[] = [];
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const incoming = toRuntimeSpot(row);
    const existing = strictMap.get(buildStrictKey(incoming)) || looseMap.get(buildLooseKey(incoming));

    if (existing) {
      upserts.push(mergeSpot(existing, incoming));
      updated += 1;
      continue;
    }

    upserts.push(incoming);
    created += 1;
  }

  await bulkUpsertRuntimeDemoSpots(upserts);
  return { created, updated };
}

async function importIntoDatabase(rows: ImportRow[]) {
  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;

  try {
    for (const row of rows) {
      const where = {
        name_province_city_district: {
          name: row.name,
          province: row.province,
          city: row.city,
          district: row.district ?? null
        }
      } as any;

      const existing = await prisma.spot.findUnique({ where });
      if (existing) {
        await prisma.spot.update({
          where,
          data: {
            tags: Array.from(new Set([...(existing.tags || []), ...row.tags])).slice(0, 6),
            latitude: existing.latitude ?? row.latitude,
            longitude: existing.longitude ?? row.longitude,
            imageUrl: existing.imageUrl ?? row.imageUrl,
            ticketBookingUrl: existing.ticketBookingUrl ?? row.ticketBookingUrl,
            hotelBookingUrl: existing.hotelBookingUrl ?? row.hotelBookingUrl,
            gaodeNavigationUrl: existing.gaodeNavigationUrl ?? row.gaodeNavigationUrl,
            transportInfo: existing.transportInfo ?? row.transportInfo,
            suggestedDuration: existing.suggestedDuration ?? row.suggestedDuration,
            bestSeason: existing.bestSeason.length > 0 ? existing.bestSeason : row.bestSeason,
            description: existing.description?.trim() ? existing.description : row.description,
            batch: row.batch,
            source: row.source
          }
        });
        updated += 1;
      } else {
        await prisma.spot.create({ data: row });
        created += 1;
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  return { created, updated };
}

async function main() {
  const fileArg = getArg("--file");
  const target = getArg("--target") ?? "demo";
  const source = getArg("--source") ?? "national_poi_2025_cleaned";
  const batch = getArg("--batch") ?? `national-poi-${new Date().toISOString().slice(0, 10)}`;

  if (!fileArg) {
    throw new Error("请传入 --file=<xlsx路径>");
  }

  const absolutePath = path.resolve(fileArg);
  const workbook = XLSX.readFile(absolutePath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<RawPoiRow>(workbook.Sheets[sheetName], { defval: "" });

  if (rows.length === 0) {
    throw new Error("未读取到可导入的数据行");
  }

  const { cleanedRows, unresolvedAreas, report } = buildImportRows(rows, batch, source);
  const outputDir = path.join(process.cwd(), "data", "import-ready");
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(path.join(outputDir, "national-tourism-poi.cleaned.json"), JSON.stringify(cleanedRows, null, 2), "utf8");
  writeCsv(path.join(outputDir, "national-tourism-poi.cleaned.csv"), cleanedRows);

  const finalReport: Record<string, unknown> = {
    ...report,
    batch,
    source,
    target,
    unresolvedAreas
  };

  if (target === "demo") {
    finalReport.importResult = await importIntoDemo(cleanedRows);
  } else if (target === "db") {
    finalReport.importResult = await importIntoDatabase(cleanedRows);
  } else {
    finalReport.importResult = { skipped: true };
  }

  fs.writeFileSync(path.join(outputDir, "national-tourism-poi.report.json"), JSON.stringify(finalReport, null, 2), "utf8");
  console.log(JSON.stringify(finalReport, null, 2));
}

void main();
