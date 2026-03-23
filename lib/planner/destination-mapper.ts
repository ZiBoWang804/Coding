import type { RuralSpotSeed } from "@/types";
import type { PlannerDestination } from "@/lib/planner/types";
import { clampScore, normalizeBoolean, normalizeSeasonList, normalizeSuggestedDuration, normalizeSuitableCrowds, normalizeTags, splitTextList, toSlugId } from "@/lib/planner/normalizers";

function inferKeyVillageLevel(spot: RuralSpotSeed): PlannerDestination["keyVillageLevel"] {
  if (spot.isNationalKeyVillage) return "national";
  return "none";
}

function inferCoordinatePrecision(spot: RuralSpotSeed): PlannerDestination["coordinatePrecision"] {
  if (spot.latitude != null && spot.longitude != null) return "exact";
  if (spot.district) return "district_approx";
  return "unknown";
}

function estimateRange(avgCost?: number | null) {
  if (avgCost == null) return { min: 120, max: 280 };
  return { min: Math.max(40, Math.round(avgCost * 0.8)), max: Math.round(avgCost * 1.3) };
}

function inferPhotoScore(tags: PlannerDestination["tags"], rating?: number | null) {
  const base = tags.includes("photography") ? 4.6 : tags.includes("flower_sea") || tags.includes("ancient_village") ? 4.2 : 3.4;
  return Math.min(5, Math.max(1, rating ? (base + rating) / 2 : base));
}

function inferCultureScore(tags: PlannerDestination["tags"]) {
  if (tags.includes("intangible_heritage") || tags.includes("folk_custom")) return 4.7;
  if (tags.includes("ancient_village")) return 4.2;
  return 3.1;
}

function inferFamilyScore(tags: PlannerDestination["tags"], summary: string) {
  let score = tags.includes("family_interaction") ? 4.6 : 3.2;
  if (summary.includes("亲子") || summary.includes("研学")) score += 0.3;
  return Math.min(5, score);
}

function inferTransitScore(transportInfo?: string | null) {
  const text = String(transportInfo ?? "");
  if (!text) return 2.6;
  if (/public transit is weak|not ideal for the last mile|self-drive only|car required/i.test(text)) return 1.8;
  if (/高铁|客运|接驳|公交|coach|rail/i.test(text)) return 3.8;
  if (/自驾最佳|自驾最方便|自驾为主|best by self-drive/i.test(text)) return 1.8;
  return 2.8;
}

function inferSelfDriveScore(transportInfo?: string | null) {
  const text = String(transportInfo ?? "");
  if (/自驾最佳|自驾最方便|短途自驾便利|方便|best by self-drive|easy self-drive/i.test(text)) return 4.6;
  if (/山路较长|mountain drive/i.test(text)) return 3.1;
  return 3.8;
}

function inferLodgingLevel(accommodationTips: string[], description: string): PlannerDestination["lodgingLevel"] {
  const text = `${accommodationTips.join(" ")} ${description}`;
  if (/民宿丰富|酒店集群|住1晚|住宿选择相对集中/.test(text)) return "rich";
  if (/精品民宿|适合住|可联动.*住宿|民宿/.test(text)) return "moderate";
  if (/农家乐|住宿容量有限/.test(text)) return "basic";
  return "none";
}

function inferDiningLevel(diningTips: string[], description: string): PlannerDestination["diningLevel"] {
  const text = `${diningTips.join(" ")} ${description}`;
  if (/小吃集群|餐饮都有|选择更多|生态餐厅/.test(text)) return "rich";
  if (/农家菜|简餐|餐馆较多|村咖/.test(text)) return "moderate";
  if (/为主/.test(text)) return "basic";
  return "none";
}

export function mapSpotToPlannerDestination(spot: RuralSpotSeed): PlannerDestination {
  const { normalizedTags, originalTags } = normalizeTags(spot.tags, `${spot.description} ${(spot.routeHighlights || []).join(" ")}`);
  const suitableCrowds = normalizeSuitableCrowds(spot.tags, `${spot.description} ${spot.transportInfo || ""}`);
  const priceRange = estimateRange(spot.avgCost);
  const accommodationNames = (spot.accommodationTips || []).map((item) => item.name).filter(Boolean);
  const diningNames = (spot.diningTips || []).map((item) => item.name).filter(Boolean);
  const lodgingLevel = inferLodgingLevel(accommodationNames, spot.description);
  const diningLevel = inferDiningLevel(diningNames, spot.description);
  const transitScore = inferTransitScore(spot.transportInfo);
  const selfDriveScore = inferSelfDriveScore(spot.transportInfo);

  return {
    id: spot.id || toSlugId(spot.name, spot.city),
    name: spot.name,
    province: spot.province,
    city: spot.city,
    district: spot.district ?? null,
    township: null,
    village: null,
    address: spot.address ?? null,
    latitude: spot.latitude ?? null,
    longitude: spot.longitude ?? null,
    coordinatePrecision: inferCoordinatePrecision(spot),
    geoSource: spot.source,
    isNationalKeyVillage: Boolean(spot.isNationalKeyVillage),
    keyVillageLevel: inferKeyVillageLevel(spot),
    batch: spot.batch ?? null,
    source: spot.source,
    sourceUrl: null,
    lastVerifiedAt: null,
    description: spot.description,
    scenicFeatures: spot.routeHighlights || splitTextList(spot.description).slice(0, 5),
    tags: normalizedTags,
    originalTags,
    suitableCrowds,
    bestSeason: normalizeSeasonList(spot.bestSeason),
    suggestedDuration: normalizeSuggestedDuration(spot.suggestedDuration),
    photoUrls: spot.imageUrl ? [spot.imageUrl] : [],
    photoSourceUrls: [],
    rating: spot.rating ?? null,
    crowdLevel: clampScore(spot.crowdLevel, 3),
    avgCostMin: priceRange.min,
    avgCostMax: priceRange.max,
    photoScore: inferPhotoScore(normalizedTags, spot.rating),
    cultureScore: inferCultureScore(normalizedTags),
    familyFriendlyScore: inferFamilyScore(normalizedTags, spot.description),
    selfDriveFriendlyScore: selfDriveScore,
    publicTransitFriendlyScore: transitScore,
    elderlyFriendlyScore: normalizedTags.includes("quiet_relax") ? 4.2 : 3.1,
    quietRelaxScore: normalizedTags.includes("quiet_relax") ? 4.7 : normalizedTags.includes("camping") ? 2.8 : 3.4,
    activityRichnessScore: Math.min(5, 2.8 + normalizedTags.length * 0.18 + ((spot.routeHighlights || []).length * 0.2)),
    transportSummary: spot.transportInfo ?? null,
    nearestRailStation: /高铁/.test(String(spot.transportInfo ?? "")) ? "nearest_known_station" : null,
    lastMileDifficulty: transitScore < 2.3 ? 4 : transitScore < 3 ? 3 : 2,
    roadRiskLevel: /山路较长|秦岭腹地/.test(`${spot.description} ${spot.transportInfo || ""}`) ? 4 : 2,
    parkingConvenience: selfDriveScore >= 4.4 ? 4 : selfDriveScore >= 3.4 ? 3 : 2,
    roundTripFeasibleInOneDay: normalizeSuggestedDuration(spot.suggestedDuration) !== "two_days",
    lodgingSummary: accommodationNames.join("；") || null,
    lodgingLevel,
    lodgingPriceMin: lodgingLevel === "none" ? 0 : lodgingLevel === "basic" ? 180 : lodgingLevel === "moderate" ? 260 : 420,
    lodgingPriceMax: lodgingLevel === "none" ? 0 : lodgingLevel === "basic" ? 320 : lodgingLevel === "moderate" ? 460 : 880,
    lodgingFitCouples: lodgingLevel === "moderate" || lodgingLevel === "rich" || /情侣|民宿/.test(spot.description),
    lodgingFitFamilies: lodgingLevel !== "none" || /亲子|家庭/.test(spot.description),
    diningSummary: diningNames.join("；") || null,
    diningLevel,
    localFoodAvailable: normalizeBoolean(/美食|农家菜|小吃|长桌宴/.test(`${spot.description} ${diningNames.join(" ")}`), true),
    diningPriceMin: diningLevel === "none" ? 0 : diningLevel === "basic" ? 40 : 60,
    diningPriceMax: diningLevel === "rich" ? 180 : 120,
    cautionNotes: /山路较长|白天往返/.test(`${spot.description} ${spot.transportInfo || ""}`) ? ["路线包含山路，建议避免过晚返程。"] : [],
    seasonalWarnings: normalizedTags.includes("flower_sea") ? ["赏花体验受花期影响较大。"] : [],
    closureRiskNotes: [],
    transportLinks: {
      ticketBookingUrl: spot.ticketBookingUrl ?? null,
      hotelBookingUrl: spot.hotelBookingUrl ?? null,
      gaodeNavigationUrl: spot.gaodeNavigationUrl ?? null
    },
    rawSource: spot
  };
}

export function mapAnyDestination(input: RuralSpotSeed | Record<string, unknown>): PlannerDestination {
  if ("name" in input && "province" in input && "city" in input && "tags" in input) {
    return mapSpotToPlannerDestination(input as RuralSpotSeed);
  }

  const raw = input as Record<string, unknown>;
  const pseudoSpot: RuralSpotSeed = {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "未知目的地"),
    province: String(raw.province ?? ""),
    city: String(raw.city ?? ""),
    district: String(raw.district ?? "") || null,
    address: String(raw.address ?? "") || null,
    description: String(raw.description ?? raw.contentSummary ?? ""),
    tags: splitTextList(raw.tags),
    rating: Number(raw.rating ?? 0) || null,
    crowdLevel: Number(raw.crowdLevel ?? 0) || null,
    avgCost: Number(raw.avgCost ?? raw.estimatedCost ?? 0) || null,
    suggestedDuration: String(raw.suggestedDuration ?? "one_day"),
    bestSeason: splitTextList(raw.bestSeason),
    transportInfo: String(raw.transportSummary ?? raw.transportInfo ?? "") || null,
    latitude: Number(raw.latitude ?? 0) || null,
    longitude: Number(raw.longitude ?? 0) || null,
    imageUrl: String(raw.imageUrl ?? "") || null,
    isNationalKeyVillage: Boolean(raw.isNationalKeyVillage),
    batch: String(raw.batch ?? "") || null,
    source: String(raw.source ?? "mapped_raw"),
    accommodationTips: splitTextList(raw.lodgingSummary).map((name) => ({ name })),
    diningTips: splitTextList(raw.diningSummary).map((name) => ({ name })),
    routeHighlights: splitTextList(raw.scenicFeatures)
  };

  return mapSpotToPlannerDestination(pseudoSpot);
}




