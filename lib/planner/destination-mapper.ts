import type { RuralSpotSeed } from "@/types";
import type { PlannerDestination } from "@/lib/planner/types";
import { clampScore, normalizeBoolean, normalizeSeasonList, normalizeSuggestedDuration, normalizeSuitableCrowds, normalizeTags, splitTextList, toSlugId } from "@/lib/planner/normalizers";

const MOCK_TEXT_MAP: Record<string, string> = {
  "Caijiapo Art Village": "蔡家坡艺术村",
  "Tang Village South Fort": "唐村南堡",
  "Tangzi Hot Spring Village": "汤峪温泉村",
  "Yuanjia Village": "袁家村",
  "Zhanglong Bamboo Trail": "张陇竹径",
  "Laoxiancheng Ancient Route Village": "老县城古道村",
  "Yuantian Family Farm": "源田亲子农场",
  "Zhiyang Pomegranate Garden": "栎阳石榴园",
  "Shaanxi": "陕西",
  "Xi'an": "西安",
  "Xianyang": "咸阳",
  "Huyi": "鄠邑",
  "Chang'an": "长安",
  "Lantian": "蓝田",
  "Liquan": "礼泉",
  "Zhouzhi": "周至",
  "Gaoling": "高陵",
  "Lintong": "临潼",
  "Art village near the Qinling foothills with wheat-field theatre, village cafe, homestays, and strong photography appeal.": "位于秦岭山脚的艺术村落，拥有麦田剧场、村咖和民宿，整体很适合拍照打卡。",
  "Revitalized rural destination themed around Tang-style pastoral life, old fort walls, culture displays, and family study tours.": "以唐风田园生活为主题的更新型乡村目的地，融合旧堡墙、文化展示和亲子研学体验。",
  "Hot spring recovery village at the foot of Zhongnan Mountain, good for couples, elderly travelers, and one-night wellness trips.": "位于终南山脚下的温泉康养村，适合情侣、长辈同行和住一晚的放松疗愈行程。",
  "High-profile Guanzhong food village with strong dining supply, night ambiance, and mature tourism services.": "关中地区知名美食村，餐饮供给充足，夜间氛围成熟，旅游配套完善。",
  "Bamboo trail stop with a three-kilometer walking path and seasonal plum blossom views. Better as a self-drive stop on a rural loop.": "拥有约三公里竹林步道和季节性梅花景观，适合作为乡村环线自驾中的轻徒步停靠点。",
  "Deep Qinling historical village with old route remains, wild scenery, and a long mountain drive. Better for experienced self-drivers.": "位于秦岭腹地的历史村落，保留古道遗迹和原生态山景，更适合有经验的自驾游客。",
  "Family-oriented rural complex with farm classes, fishing, pet-friendly zones, and flexible half-day to full-day play.": "面向亲子家庭的乡村综合体，包含农事课堂、垂钓、宠物友好区域，半天到一天都能安排。",
  "Pomegranate-themed orchard with harvest experience and easy family pacing, especially strong in early autumn.": "以石榴主题为核心的果园型村游点，节奏轻松，适合家庭体验，初秋最有特色。",
  "Best by self-drive via the Qinling ring road. Public transit is weak for the last mile.": "建议经由秦岭环线自驾前往，最后一段公共交通接驳较弱。",
  "Easy self-drive access from southern Xi'an; can be combined with Nanshan attractions.": "从西安南部自驾前往较方便，可与南山周边景点串联。",
  "Short self-drive from Xi'an, roads are manageable. Public transit is possible but less direct.": "从西安短途自驾即可到达，路况整体可控；公共交通也能到，但换乘不够直接。",
  "Self-drive is easy and there are coach transfer options. Holiday congestion is obvious.": "自驾较方便，也有大巴换乘方案，但节假日拥堵会比较明显。",
  "Best by self-drive. Public transit is weak and not ideal for the last mile.": "更适合作为自驾目的地，公共交通偏弱，最后一段接驳不太理想。",
  "Mountain drive required, day-return possible but tiring. Public transit is not recommended.": "需要走一段山路，自驾当天往返可以实现但会比较累，不建议依赖公共交通。",
  "Easy self-drive in Gaoling. Public transit partially works but the last mile is not perfect.": "高陵方向自驾较轻松，公共交通可部分覆盖，但最后一段接驳仍不够顺畅。",
  "Self-drive is easiest. Can be combined with nearby Lintong attractions.": "自驾最方便，也适合和临潼周边景点联动。",
  "Village design homestays": "村落设计民宿",
  "Village cafe and farmhouse meals": "村咖与农家餐食",
  "Poetry homestay cluster": "诗意民宿群",
  "Farmhouse dishes and tea drinks": "农家菜与茶饮",
  "Hot spring hotels": "温泉酒店",
  "Resort homestays": "度假民宿",
  "Town restaurants and local dishes": "镇上餐馆与地方菜",
  "Dense village homestays": "村内集中民宿",
  "Guanzhong snack streets": "关中小吃街",
  "Nearby ring-road homestays": "环线周边民宿",
  "Roadside farmhouse restaurants": "沿线农家乐",
  "Limited mountain farmhouse stays": "山地农家乐住宿",
  "Simple farmhouse meals": "简餐型农家饭",
  "Eco restaurant": "生态餐厅",
  "Village market snacks": "村集市小吃",
  "Lintong town stay options": "临潼城区住宿",
  "Farmhouse dishes and fruit snacks": "农家菜与水果小食",
  "Wheat-field theatre": "麦田剧场",
  "Village art museum": "村落艺术馆",
  "Cafe street": "村咖街",
  "Tang poetry fields": "唐诗田园",
  "Old fort wall": "古堡墙",
  "Rural study experience": "乡村研学体验",
  "Hot spring soak": "温泉泡汤",
  "Mountain foothill walk": "山麓散步",
  "Wellness hotel stay": "康养酒店住宿",
  "Snack street": "小吃街",
  "Folk custom blocks": "民俗街区",
  "Night market": "夜市",
  "Bamboo path": "竹林步道",
  "Seasonal plum base": "时令梅花观赏点",
  "Loop-drive stop": "环线自驾停靠点",
  "Historic route remains": "古道遗迹",
  "Stone townscape": "石砌村貌",
  "Qinling scenery": "秦岭山景",
  "Farm class": "农事课堂",
  "Fishing area": "垂钓区",
  "Pet garden": "宠物乐园",
  "Pomegranate garden": "石榴园",
  "Farm activity": "农园体验",
  "Family fruit picking": "亲子采摘"
};

function localizeMockText(value: string) {
  return MOCK_TEXT_MAP[value] ?? value;
}

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
    openStatus: "unknown",
    openingHoursText: null,
    liveTravelMinutes: null,
    liveDistanceKm: null,
    liveTrafficStatus: null,
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
    const direct = input as RuralSpotSeed;

    if (direct.source === "mock_curated") {
      return mapSpotToPlannerDestination({
        ...direct,
        name: localizeMockText(direct.name),
        province: localizeMockText(direct.province),
        city: localizeMockText(direct.city),
        district: direct.district ? localizeMockText(direct.district) : null,
        address: direct.address ? localizeMockText(direct.address) : null,
        description: localizeMockText(direct.description),
        transportInfo: direct.transportInfo ? localizeMockText(direct.transportInfo) : null,
        accommodationTips: (direct.accommodationTips || []).map((item) => ({ ...item, name: localizeMockText(item.name) })),
        diningTips: (direct.diningTips || []).map((item) => ({ ...item, name: localizeMockText(item.name) })),
        routeHighlights: (direct.routeHighlights || []).map(localizeMockText)
      });
    }

    return mapSpotToPlannerDestination(direct);
  }

  const raw = input as Record<string, unknown>;
  const pseudoSpot: RuralSpotSeed = {
    id: String(raw.id ?? ""),
    name: localizeMockText(String(raw.name ?? "未知目的地")),
    province: localizeMockText(String(raw.province ?? "")),
    city: localizeMockText(String(raw.city ?? "")),
    district: localizeMockText(String(raw.district ?? "")) || null,
    address: localizeMockText(String(raw.address ?? "")) || null,
    description: localizeMockText(String(raw.description ?? raw.contentSummary ?? "")),
    tags: splitTextList(raw.tags),
    rating: Number(raw.rating ?? 0) || null,
    crowdLevel: Number(raw.crowdLevel ?? 0) || null,
    avgCost: Number(raw.avgCost ?? raw.estimatedCost ?? 0) || null,
    suggestedDuration: String(raw.suggestedDuration ?? "one_day"),
    bestSeason: splitTextList(raw.bestSeason),
    transportInfo: localizeMockText(String(raw.transportSummary ?? raw.transportInfo ?? "")) || null,
    latitude: Number(raw.latitude ?? 0) || null,
    longitude: Number(raw.longitude ?? 0) || null,
    imageUrl: String(raw.imageUrl ?? "") || null,
    isNationalKeyVillage: Boolean(raw.isNationalKeyVillage),
    batch: String(raw.batch ?? "") || null,
    source: String(raw.source ?? "mapped_raw"),
    accommodationTips: splitTextList(raw.lodgingSummary).map((name) => ({ name: localizeMockText(name) })),
    diningTips: splitTextList(raw.diningSummary).map((name) => ({ name: localizeMockText(name) })),
    routeHighlights: splitTextList(raw.scenicFeatures).map(localizeMockText)
  };

  return mapSpotToPlannerDestination(pseudoSpot);
}
