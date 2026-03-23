import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { normalizePipeList, parseBoolean, parseNumber } from "@/lib/utils";

const importSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  province: z.string().min(1, "省份不能为空"),
  city: z.string().min(1, "城市不能为空"),
  district: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  description: z.string().min(1, "简介不能为空"),
  tags: z.array(z.string()).min(1, "至少需要一个标签"),
  rating: z.number().min(0).max(5).optional().nullable(),
  crowdLevel: z.number().int().min(1).max(5).optional().nullable(),
  avgCost: z.number().int().min(0).optional().nullable(),
  suggestedDuration: z.string().optional().nullable(),
  bestSeason: z.array(z.string()).default([]),
  transportInfo: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  ticketBookingUrl: z.string().optional().nullable(),
  hotelBookingUrl: z.string().optional().nullable(),
  gaodeNavigationUrl: z.string().optional().nullable(),
  isNationalKeyVillage: z.boolean().default(false),
  batch: z.string().optional().nullable(),
  source: z.string().min(1),
  accommodationTips: z.array(z.object({ name: z.string() })).optional(),
  diningTips: z.array(z.object({ name: z.string() })).optional(),
  routeHighlights: z.array(z.string()).optional()
});

export type ImportMapping = Record<string, string>;

export function defaultFieldMapping(headers: string[]) {
  const aliasMap: Record<string, string[]> = {
    name: ["name", "名称"],
    province: ["province", "省份"],
    city: ["city", "城市"],
    district: ["district", "区县", "县区"],
    address: ["address", "地址"],
    description: ["description", "简介"],
    tags: ["tags", "标签"],
    rating: ["rating", "评分"],
    crowdLevel: ["crowdLevel", "人流量", "人流等级"],
    avgCost: ["avgCost", "人均消费"],
    suggestedDuration: ["suggestedDuration", "建议游玩时长"],
    bestSeason: ["bestSeason", "最佳季节"],
    transportInfo: ["transportInfo", "交通方式"],
    latitude: ["latitude", "纬度"],
    longitude: ["longitude", "经度"],
    imageUrl: ["imageUrl", "图片"],
    ticketBookingUrl: ["ticketBookingUrl", "门票入口"],
    hotelBookingUrl: ["hotelBookingUrl", "酒店入口"],
    gaodeNavigationUrl: ["gaodeNavigationUrl", "高德导航入口"],
    isNationalKeyVillage: ["isNationalKeyVillage", "是否国家重点村"],
    batch: ["batch", "批次"],
    source: ["source", "来源"],
    accommodationTips: ["accommodationTips", "住宿推荐"],
    diningTips: ["diningTips", "餐饮推荐"],
    routeHighlights: ["routeHighlights", "路线亮点"]
  };

  const mapping: ImportMapping = {};
  for (const [field, aliases] of Object.entries(aliasMap)) {
    const hit = headers.find((header) => aliases.includes(header));
    if (hit) mapping[field] = hit;
  }
  return mapping;
}

export function normalizeSpotInput(raw: Record<string, unknown>, fallback?: { source?: string; batch?: string }) {
  const normalized = {
    name: String(raw.name ?? "").trim(),
    province: String(raw.province ?? "").trim(),
    city: String(raw.city ?? "").trim(),
    district: String(raw.district ?? "").trim() || null,
    address: String(raw.address ?? "").trim() || null,
    description: String(raw.description ?? "").trim(),
    tags: normalizePipeList(raw.tags),
    rating: parseNumber(raw.rating) ?? null,
    crowdLevel: parseNumber(raw.crowdLevel) ?? null,
    avgCost: parseNumber(raw.avgCost) ?? null,
    suggestedDuration: String(raw.suggestedDuration ?? "").trim() || null,
    bestSeason: normalizePipeList(raw.bestSeason),
    transportInfo: String(raw.transportInfo ?? "").trim() || null,
    latitude: parseNumber(raw.latitude) ?? null,
    longitude: parseNumber(raw.longitude) ?? null,
    imageUrl: String(raw.imageUrl ?? "").trim() || null,
    ticketBookingUrl: String(raw.ticketBookingUrl ?? "").trim() || null,
    hotelBookingUrl: String(raw.hotelBookingUrl ?? "").trim() || null,
    gaodeNavigationUrl: String(raw.gaodeNavigationUrl ?? "").trim() || null,
    isNationalKeyVillage: parseBoolean(raw.isNationalKeyVillage),
    batch: String(raw.batch ?? fallback?.batch ?? "").trim() || null,
    source: String(raw.source ?? fallback?.source ?? "admin_import").trim(),
    accommodationTips: normalizePipeList(raw.accommodationTips).map((name) => ({ name })),
    diningTips: normalizePipeList(raw.diningTips).map((name) => ({ name })),
    routeHighlights: normalizePipeList(raw.routeHighlights)
  };

  return importSchema.parse(normalized);
}

export function buildImportPreview(rows: Record<string, unknown>[], mapping: ImportMapping, fallback?: { source?: string; batch?: string }) {
  const previewRows = rows.slice(0, 5).map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const [field, sourceHeader] of Object.entries(mapping)) {
      mapped[field] = row[sourceHeader];
    }
    return mapped;
  });

  const normalizedRows: ReturnType<typeof normalizeSpotInput>[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  rows.forEach((row, index) => {
    try {
      const mapped: Record<string, unknown> = {};
      for (const [field, sourceHeader] of Object.entries(mapping)) {
        mapped[field] = row[sourceHeader];
      }
      normalizedRows.push(normalizeSpotInput(mapped, fallback));
    } catch (error) {
      errors.push({ row: index + 1, message: error instanceof Error ? error.message : "未知错误" });
    }
  });

  return {
    totalRows: rows.length,
    previewRows,
    normalizedRows,
    errors,
    mapping
  };
}

export async function commitImportRows(prisma: PrismaClient, rows: ReturnType<typeof normalizeSpotInput>[], fallback?: { source?: string; batch?: string }) {
  let created = 0;
  let updated = 0;
  const failed: Array<{ name: string; reason: string }> = [];

  for (const row of rows) {
    try {
      const where: any = {
        name_province_city_district: {
          name: row.name,
          province: row.province,
          city: row.city,
          district: row.district ?? null
        }
      };
      const existing = await prisma.spot.findUnique({ where });
      if (existing) {
        await prisma.spot.update({ where, data: { ...row, source: row.source ?? fallback?.source, batch: row.batch ?? fallback?.batch } });
        updated += 1;
      } else {
        await prisma.spot.create({ data: { ...row, source: row.source ?? fallback?.source ?? "admin_import", batch: row.batch ?? fallback?.batch ?? null } });
        created += 1;
      }
    } catch (error) {
      failed.push({ name: row.name, reason: error instanceof Error ? error.message : "导入失败" });
    }
  }

  return { created, updated, failed };
}

export function loadRowsFromFile(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`文件不存在: ${absolutePath}`);
  const workbook = XLSX.readFile(absolutePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}