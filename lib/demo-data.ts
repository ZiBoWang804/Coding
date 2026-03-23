import seedRows from "@/data/rural-spots.seed.json";
import type { RuralSpotSeed } from "@/types";
import { normalizePipeList, parseBoolean, parseNumber } from "@/lib/utils";

const rows = seedRows as Array<Record<string, unknown>>;

let cache: RuralSpotSeed[] | null = null;

export function loadSeedSpots(): RuralSpotSeed[] {
  if (cache) return cache;

  cache = rows.map((row, index) => ({
    id: `seed-${index + 1}`,
    name: String(row.name ?? ""),
    province: String(row.province ?? ""),
    city: String(row.city ?? ""),
    district: String(row.district ?? "") || null,
    address: String(row.address ?? "") || null,
    description: String(row.description ?? ""),
    tags: normalizePipeList(row.tags),
    rating: parseNumber(row.rating) ?? null,
    crowdLevel: parseNumber(row.crowdLevel) ?? null,
    avgCost: parseNumber(row.avgCost) ?? null,
    suggestedDuration: String(row.suggestedDuration ?? "") || null,
    bestSeason: normalizePipeList(row.bestSeason),
    transportInfo: String(row.transportInfo ?? "") || null,
    latitude: parseNumber(row.latitude) ?? null,
    longitude: parseNumber(row.longitude) ?? null,
    imageUrl: String(row.imageUrl ?? "") || null,
    isNationalKeyVillage: parseBoolean(row.isNationalKeyVillage),
    batch: String(row.batch ?? "") || null,
    source: String(row.source ?? "manual_seed"),
    accommodationTips: normalizePipeList(row.accommodationTips).map((name) => ({ name })),
    diningTips: normalizePipeList(row.diningTips).map((name) => ({ name })),
    routeHighlights: normalizePipeList(row.routeHighlights)
  }));

  return cache;
}
