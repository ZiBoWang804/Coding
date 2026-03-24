import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { loadSeedSpots } from "@/lib/demo-data";
import type { NearbyItem, RuralSpotSeed } from "@/types";

const require = createRequire(import.meta.url);

try {
  require("server-only");
} catch {
  // Allow CLI scripts to reuse the demo store without requiring Next.js server-only.
}

type DemoSpotState = {
  upserts: RuralSpotSeed[];
  deletedIds: string[];
};

const DEMO_SPOT_STATE_FILE = path.join(process.cwd(), "data", "demo-spots.runtime.json");

function toStringOrNull(value: unknown) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function toStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

function toNumberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBooleanOrUndefined(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value == null || value === "") return undefined;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "是"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "否"].includes(normalized)) return false;
  }
  return undefined;
}

function toNearbyItems(value: unknown, fallback: NearbyItem[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => {
      if (typeof item === "string") {
        const name = item.trim();
        return name ? { name } : null;
      }
      if (item && typeof item === "object" && "name" in item) {
        const record = item as Record<string, unknown>;
        const name = String(record.name ?? "").trim();
        if (!name) return null;
        return {
          name,
          type: toStringOrNull(record.type) ?? undefined,
          note: toStringOrNull(record.note) ?? undefined
        } satisfies NearbyItem;
      }
      return null;
    })
    .filter((item): item is NearbyItem => Boolean(item));
}

async function ensureStateFile() {
  await fs.mkdir(path.dirname(DEMO_SPOT_STATE_FILE), { recursive: true });
  try {
    await fs.access(DEMO_SPOT_STATE_FILE);
  } catch {
    await fs.writeFile(
      DEMO_SPOT_STATE_FILE,
      JSON.stringify({ upserts: [], deletedIds: [] } satisfies DemoSpotState, null, 2),
      "utf8"
    );
  }
}

async function readState(): Promise<DemoSpotState> {
  await ensureStateFile();
  try {
    const raw = await fs.readFile(DEMO_SPOT_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<DemoSpotState>;
    return {
      upserts: Array.isArray(parsed.upserts) ? parsed.upserts : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
    };
  } catch {
    return { upserts: [], deletedIds: [] };
  }
}

async function writeState(state: DemoSpotState) {
  await ensureStateFile();
  await fs.writeFile(DEMO_SPOT_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function sortSpots(spots: RuralSpotSeed[]) {
  return [...spots].sort((left, right) => {
    const ratingGap = (right.rating ?? 0) - (left.rating ?? 0);
    if (ratingGap !== 0) return ratingGap;
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function generateDemoSpotId() {
  return `demo-runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDemoSpot(spot: RuralSpotSeed): RuralSpotSeed {
  return {
    ...spot,
    name: spot.name.trim(),
    province: spot.province.trim(),
    city: spot.city.trim(),
    district: toStringOrNull(spot.district),
    township: toStringOrNull(spot.township),
    village: toStringOrNull(spot.village),
    address: toStringOrNull(spot.address),
    description: spot.description.trim(),
    tags: toStringArray(spot.tags),
    scenicFeatures: toStringArray(spot.scenicFeatures),
    suitableCrowds: toStringArray(spot.suitableCrowds),
    bestSeason: toStringArray(spot.bestSeason, ["春", "秋"]),
    photoUrls: toStringArray(spot.photoUrls),
    photoSourceUrls: toStringArray(spot.photoSourceUrls),
    transportInfo: toStringOrNull(spot.transportInfo),
    transportSummary: toStringOrNull(spot.transportSummary),
    nearestRailStation: toStringOrNull(spot.nearestRailStation),
    imageUrl: toStringOrNull(spot.imageUrl),
    ticketBookingUrl: toStringOrNull(spot.ticketBookingUrl),
    hotelBookingUrl: toStringOrNull(spot.hotelBookingUrl),
    gaodeNavigationUrl: toStringOrNull(spot.gaodeNavigationUrl),
    lodgingSummary: toStringOrNull(spot.lodgingSummary),
    diningSummary: toStringOrNull(spot.diningSummary),
    source: spot.source || "admin_import",
    sourceUrl: toStringOrNull(spot.sourceUrl),
    batch: toStringOrNull(spot.batch),
    lastVerifiedAt: toStringOrNull(spot.lastVerifiedAt),
    accommodationTips: toNearbyItems(spot.accommodationTips),
    diningTips: toNearbyItems(spot.diningTips),
    routeHighlights: toStringArray(spot.routeHighlights),
    cautionNotes: toStringArray(spot.cautionNotes),
    seasonalWarnings: toStringArray(spot.seasonalWarnings),
    closureRiskNotes: toStringArray(spot.closureRiskNotes)
  };
}

function buildDemoSpot(data: Record<string, unknown>, current?: RuralSpotSeed): RuralSpotSeed {
  const now = new Date().toISOString();
  const base: RuralSpotSeed =
    current ??
    {
      id: typeof data.id === "string" && data.id ? data.id : generateDemoSpotId(),
      name: "",
      province: "",
      city: "",
      description: "",
      tags: [],
      bestSeason: ["春", "秋"],
      source: "admin_import",
      createdAt: now
    };

  return normalizeDemoSpot({
    ...base,
    ...data,
    id: current?.id ?? (typeof data.id === "string" && data.id ? data.id : base.id),
    name: typeof data.name === "string" ? data.name : base.name,
    province: typeof data.province === "string" ? data.province : base.province,
    city: typeof data.city === "string" ? data.city : base.city,
    district: data.district !== undefined ? toStringOrNull(data.district) : base.district ?? null,
    township: data.township !== undefined ? toStringOrNull(data.township) : base.township ?? null,
    village: data.village !== undefined ? toStringOrNull(data.village) : base.village ?? null,
    address: data.address !== undefined ? toStringOrNull(data.address) : base.address ?? null,
    description: typeof data.description === "string" ? data.description : base.description,
    tags: data.tags !== undefined ? toStringArray(data.tags) : base.tags,
    scenicFeatures: data.scenicFeatures !== undefined ? toStringArray(data.scenicFeatures) : base.scenicFeatures,
    suitableCrowds: data.suitableCrowds !== undefined ? toStringArray(data.suitableCrowds) : base.suitableCrowds,
    bestSeason: data.bestSeason !== undefined ? toStringArray(data.bestSeason, ["春", "秋"]) : base.bestSeason,
    suggestedDuration:
      data.suggestedDuration !== undefined ? toStringOrNull(data.suggestedDuration) : base.suggestedDuration ?? null,
    rating: data.rating !== undefined ? toNumberOrNull(data.rating) : base.rating ?? null,
    crowdLevel: data.crowdLevel !== undefined ? toNumberOrNull(data.crowdLevel) : base.crowdLevel ?? null,
    avgCost: data.avgCost !== undefined ? toNumberOrNull(data.avgCost) : base.avgCost ?? null,
    avgCostMin: data.avgCostMin !== undefined ? toNumberOrNull(data.avgCostMin) : base.avgCostMin ?? null,
    avgCostMax: data.avgCostMax !== undefined ? toNumberOrNull(data.avgCostMax) : base.avgCostMax ?? null,
    photoScore: data.photoScore !== undefined ? toNumberOrNull(data.photoScore) : base.photoScore ?? null,
    cultureScore: data.cultureScore !== undefined ? toNumberOrNull(data.cultureScore) : base.cultureScore ?? null,
    familyFriendlyScore:
      data.familyFriendlyScore !== undefined ? toNumberOrNull(data.familyFriendlyScore) : base.familyFriendlyScore ?? null,
    selfDriveFriendlyScore:
      data.selfDriveFriendlyScore !== undefined
        ? toNumberOrNull(data.selfDriveFriendlyScore)
        : base.selfDriveFriendlyScore ?? null,
    publicTransitFriendlyScore:
      data.publicTransitFriendlyScore !== undefined
        ? toNumberOrNull(data.publicTransitFriendlyScore)
        : base.publicTransitFriendlyScore ?? null,
    elderlyFriendlyScore:
      data.elderlyFriendlyScore !== undefined ? toNumberOrNull(data.elderlyFriendlyScore) : base.elderlyFriendlyScore ?? null,
    quietRelaxScore:
      data.quietRelaxScore !== undefined ? toNumberOrNull(data.quietRelaxScore) : base.quietRelaxScore ?? null,
    activityRichnessScore:
      data.activityRichnessScore !== undefined ? toNumberOrNull(data.activityRichnessScore) : base.activityRichnessScore ?? null,
    transportInfo: data.transportInfo !== undefined ? toStringOrNull(data.transportInfo) : base.transportInfo ?? null,
    transportSummary:
      data.transportSummary !== undefined ? toStringOrNull(data.transportSummary) : base.transportSummary ?? null,
    nearestRailStation:
      data.nearestRailStation !== undefined ? toStringOrNull(data.nearestRailStation) : base.nearestRailStation ?? null,
    latitude: data.latitude !== undefined ? toNumberOrNull(data.latitude) : base.latitude ?? null,
    longitude: data.longitude !== undefined ? toNumberOrNull(data.longitude) : base.longitude ?? null,
    coordinatePrecision:
      data.coordinatePrecision !== undefined
        ? (data.coordinatePrecision as RuralSpotSeed["coordinatePrecision"])
        : base.coordinatePrecision,
    geoSource: data.geoSource !== undefined ? toStringOrNull(data.geoSource) : base.geoSource ?? null,
    imageUrl: data.imageUrl !== undefined ? toStringOrNull(data.imageUrl) : base.imageUrl ?? null,
    photoUrls: data.photoUrls !== undefined ? toStringArray(data.photoUrls) : base.photoUrls,
    photoSourceUrls: data.photoSourceUrls !== undefined ? toStringArray(data.photoSourceUrls) : base.photoSourceUrls,
    ticketBookingUrl:
      data.ticketBookingUrl !== undefined ? toStringOrNull(data.ticketBookingUrl) : base.ticketBookingUrl ?? null,
    hotelBookingUrl:
      data.hotelBookingUrl !== undefined ? toStringOrNull(data.hotelBookingUrl) : base.hotelBookingUrl ?? null,
    gaodeNavigationUrl:
      data.gaodeNavigationUrl !== undefined ? toStringOrNull(data.gaodeNavigationUrl) : base.gaodeNavigationUrl ?? null,
    lodgingSummary: data.lodgingSummary !== undefined ? toStringOrNull(data.lodgingSummary) : base.lodgingSummary ?? null,
    lodgingLevel:
      data.lodgingLevel !== undefined ? (data.lodgingLevel as RuralSpotSeed["lodgingLevel"]) : base.lodgingLevel,
    lodgingPriceMin:
      data.lodgingPriceMin !== undefined ? toNumberOrNull(data.lodgingPriceMin) : base.lodgingPriceMin ?? null,
    lodgingPriceMax:
      data.lodgingPriceMax !== undefined ? toNumberOrNull(data.lodgingPriceMax) : base.lodgingPriceMax ?? null,
    lodgingFitCouples:
      data.lodgingFitCouples !== undefined ? toBooleanOrUndefined(data.lodgingFitCouples) : base.lodgingFitCouples ?? null,
    lodgingFitFamilies:
      data.lodgingFitFamilies !== undefined ? toBooleanOrUndefined(data.lodgingFitFamilies) : base.lodgingFitFamilies ?? null,
    diningSummary: data.diningSummary !== undefined ? toStringOrNull(data.diningSummary) : base.diningSummary ?? null,
    diningLevel: data.diningLevel !== undefined ? (data.diningLevel as RuralSpotSeed["diningLevel"]) : base.diningLevel,
    localFoodAvailable:
      data.localFoodAvailable !== undefined ? toBooleanOrUndefined(data.localFoodAvailable) : base.localFoodAvailable ?? null,
    diningPriceMin:
      data.diningPriceMin !== undefined ? toNumberOrNull(data.diningPriceMin) : base.diningPriceMin ?? null,
    diningPriceMax:
      data.diningPriceMax !== undefined ? toNumberOrNull(data.diningPriceMax) : base.diningPriceMax ?? null,
    lastMileDifficulty:
      data.lastMileDifficulty !== undefined ? toNumberOrNull(data.lastMileDifficulty) : base.lastMileDifficulty ?? null,
    roadRiskLevel: data.roadRiskLevel !== undefined ? toNumberOrNull(data.roadRiskLevel) : base.roadRiskLevel ?? null,
    parkingConvenience:
      data.parkingConvenience !== undefined ? toNumberOrNull(data.parkingConvenience) : base.parkingConvenience ?? null,
    roundTripFeasibleInOneDay:
      data.roundTripFeasibleInOneDay !== undefined
        ? toBooleanOrUndefined(data.roundTripFeasibleInOneDay)
        : base.roundTripFeasibleInOneDay,
    isNationalKeyVillage:
      data.isNationalKeyVillage !== undefined ? Boolean(data.isNationalKeyVillage) : base.isNationalKeyVillage,
    keyVillageLevel:
      data.keyVillageLevel !== undefined ? (data.keyVillageLevel as RuralSpotSeed["keyVillageLevel"]) : base.keyVillageLevel,
    source: typeof data.source === "string" ? data.source : base.source,
    sourceUrl: data.sourceUrl !== undefined ? toStringOrNull(data.sourceUrl) : base.sourceUrl ?? null,
    batch: data.batch !== undefined ? toStringOrNull(data.batch) : base.batch ?? null,
    lastVerifiedAt: data.lastVerifiedAt !== undefined ? toStringOrNull(data.lastVerifiedAt) : base.lastVerifiedAt ?? null,
    accommodationTips:
      data.accommodationTips !== undefined ? toNearbyItems(data.accommodationTips) : base.accommodationTips,
    diningTips: data.diningTips !== undefined ? toNearbyItems(data.diningTips) : base.diningTips,
    routeHighlights: data.routeHighlights !== undefined ? toStringArray(data.routeHighlights) : base.routeHighlights,
    cautionNotes: data.cautionNotes !== undefined ? toStringArray(data.cautionNotes) : base.cautionNotes,
    seasonalWarnings: data.seasonalWarnings !== undefined ? toStringArray(data.seasonalWarnings) : base.seasonalWarnings,
    closureRiskNotes:
      data.closureRiskNotes !== undefined ? toStringArray(data.closureRiskNotes) : base.closureRiskNotes,
    createdAt: current?.createdAt ?? base.createdAt ?? now,
    updatedAt: now
  });
}

export async function listRuntimeDemoSpots(): Promise<RuralSpotSeed[]> {
  const baseSpots = loadSeedSpots();
  const state = await readState();
  const merged = new Map(baseSpots.filter((spot) => spot.id).map((spot) => [spot.id as string, normalizeDemoSpot(spot)]));

  for (const deletedId of state.deletedIds) {
    merged.delete(deletedId);
  }

  for (const spot of state.upserts) {
    if (spot.id) {
      merged.set(spot.id, normalizeDemoSpot(spot));
    }
  }

  return sortSpots(Array.from(merged.values()));
}

export async function getRuntimeDemoSpotById(id: string): Promise<RuralSpotSeed | null> {
  const items = await listRuntimeDemoSpots();
  return items.find((spot) => spot.id === id) ?? null;
}

export async function createRuntimeDemoSpot(data: Record<string, unknown>): Promise<RuralSpotSeed> {
  const state = await readState();
  const item = buildDemoSpot(data);
  const id = item.id;
  if (!id) {
    throw new Error("景点 ID 生成失败");
  }

  state.upserts = [...state.upserts.filter((spot) => spot.id !== id), item];
  state.deletedIds = state.deletedIds.filter((deletedId) => deletedId !== id);
  await writeState(state);
  return item;
}

export async function updateRuntimeDemoSpot(id: string, data: Record<string, unknown>): Promise<RuralSpotSeed> {
  const current = await getRuntimeDemoSpotById(id);
  if (!current) {
    throw new Error("未找到要更新的景点");
  }

  const updated = buildDemoSpot({ ...data, id }, current);
  const state = await readState();
  state.upserts = [...state.upserts.filter((spot) => spot.id !== id), updated];
  state.deletedIds = state.deletedIds.filter((deletedId) => deletedId !== id);
  await writeState(state);
  return updated;
}

export async function bulkUpsertRuntimeDemoSpots(spots: RuralSpotSeed[]) {
  const state = await readState();
  const upsertMap = new Map(state.upserts.filter((spot) => spot.id).map((spot) => [spot.id as string, normalizeDemoSpot(spot)]));

  for (const spot of spots) {
    if (!spot.id) continue;
    upsertMap.set(spot.id, normalizeDemoSpot(spot));
    state.deletedIds = state.deletedIds.filter((deletedId) => deletedId !== spot.id);
  }

  state.upserts = sortSpots(Array.from(upsertMap.values()));
  await writeState(state);
}

export async function deleteRuntimeDemoSpot(id: string) {
  const state = await readState();
  state.upserts = state.upserts.filter((spot) => spot.id !== id);
  if (!state.deletedIds.includes(id)) {
    state.deletedIds.push(id);
  }
  await writeState(state);
}
