import { BASE_SCORE_WEIGHTS, COST_DEFAULTS, PROFILE_WEIGHT_OVERRIDES, XIAN_CITY_CENTER } from "@/lib/planner/config";
import { normalizeTags } from "@/lib/planner/normalizers";
import { getSeasonalAdjustment } from "@/lib/planner/seasonal-adjuster";
import { getTrafficAdjustment } from "@/lib/planner/traffic-adjuster";
import { getWeatherAdjustment } from "@/lib/planner/weather-adjuster";
import type { BudgetEstimate, PlannerDestination, PlannerRuntimeContext, RankedPlan, ScoreBreakdown, ScoreWeights } from "@/lib/planner/types";
import type { PlannerProfileKey } from "@/lib/planner/enums";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function isXianLike(text: string) {
  return /xi'?an|西安/i.test(text);
}

function isXianyangLike(text: string) {
  return /xianyang|咸阳/i.test(text);
}

function isShaanxiLike(text: string) {
  return /shaanxi|陕西/i.test(text);
}

function resolveProfileKey(context: PlannerRuntimeContext): PlannerProfileKey {
  if (context.user.companions === "family") return "family";
  if (context.user.companions === "couple") return "couple";
  if (context.user.companions === "elderly") return "elderly";
  if (context.user.transportMode === "self_drive") return "self_drive_users";
  if ((context.user.budgetMax || 0) <= 500) return "budget_sensitive";
  if (context.user.preferenceTags.some((tag) => /拍照|摄影|出片/.test(tag))) return "photography";
  if (context.user.companions === "friends") return "friends_group";
  return "default";
}

function resolveWeights(profileKey: PlannerProfileKey): ScoreWeights {
  return { ...BASE_SCORE_WEIGHTS, ...PROFILE_WEIGHT_OVERRIDES[profileKey] };
}

function approxDistanceKm(context: PlannerRuntimeContext, destination: PlannerDestination) {
  const origin = context.user.origin.toLowerCase();
  const destinationRegion = `${destination.province} ${destination.city}`;

  if (isXianLike(origin)) {
    if (destination.latitude != null && destination.longitude != null) {
      const dx = (destination.longitude - XIAN_CITY_CENTER.longitude) * 92;
      const dy = (destination.latitude - XIAN_CITY_CENTER.latitude) * 111;
      return Math.round(Math.sqrt(dx * dx + dy * dy));
    }

    if (isXianLike(destinationRegion)) return 65;
    if (isXianyangLike(destinationRegion)) return 78;
    if (isShaanxiLike(destinationRegion)) return 140;
    return 480;
  }

  return destination.city.toLowerCase().includes(origin) ? 80 : 180;
}

function scoreTimeFit(context: PlannerRuntimeContext, destination: PlannerDestination) {
  if (destination.liveTravelMinutes != null) {
    if (context.user.days === 1) {
      if (destination.liveTravelMinutes <= 90) return 1;
      if (destination.liveTravelMinutes <= 150) return 0.78;
      if (destination.liveTravelMinutes <= 210) return 0.48;
      return 0.22;
    }
    if (context.user.days === 2) {
      if (destination.liveTravelMinutes <= 180) return 1;
      if (destination.liveTravelMinutes <= 260) return 0.8;
      return 0.56;
    }
    if (destination.liveTravelMinutes <= 300) return 1;
    if (destination.liveTravelMinutes <= 420) return 0.82;
    return 0.66;
  }

  const distance = approxDistanceKm(context, destination);
  const duration = destination.suggestedDuration;
  if (context.user.days === 1) {
    if (duration === "two_days") return 0.35;
    if (duration === "half_day" || duration === "one_day") return distance <= 90 ? 1 : distance <= 140 ? 0.72 : 0.45;
  }
  if (context.user.days === 2) {
    if (duration === "two_days" || duration === "flexible") return 1;
    return distance <= 180 ? 0.82 : 0.66;
  }
  return duration === "flexible" || duration === "two_days" ? 1 : 0.86;
}

function scoreTransportFit(context: PlannerRuntimeContext, destination: PlannerDestination) {
  if (context.user.transportMode === "self_drive") {
    return clamp01((destination.selfDriveFriendlyScore || 3) / 5 - ((destination.roadRiskLevel || 1) - 1) * 0.08);
  }
  if (context.user.transportMode === "public_transit") {
    return clamp01((destination.publicTransitFriendlyScore || 2.4) / 5 - ((destination.lastMileDifficulty || 2) - 1) * 0.08);
  }
  return clamp01(((destination.selfDriveFriendlyScore || 3) + (destination.publicTransitFriendlyScore || 3)) / 10);
}

function scoreCompanionFit(context: PlannerRuntimeContext, destination: PlannerDestination) {
  switch (context.user.companions) {
    case "couple":
      return clamp01((((destination.photoScore || 3) + (destination.quietRelaxScore || 3)) / 10) + (destination.lodgingFitCouples ? 0.1 : 0));
    case "family":
      return clamp01((((destination.familyFriendlyScore || 3) + (destination.activityRichnessScore || 3)) / 10) + (destination.diningLevel !== "none" ? 0.1 : 0));
    case "friends":
      return clamp01((((destination.activityRichnessScore || 3) + (destination.photoScore || 3)) / 10));
    case "elderly":
      return clamp01((((destination.elderlyFriendlyScore || 3) + (destination.quietRelaxScore || 3)) / 10) - ((destination.roadRiskLevel || 1) - 1) * 0.06);
    default:
      return clamp01((((destination.quietRelaxScore || 3) + (destination.cultureScore || 3)) / 10));
  }
}

function scoreBudgetFit(context: PlannerRuntimeContext, destination: PlannerDestination, budgetEstimate: BudgetEstimate) {
  if (!context.user.budgetMax) return 0.76;
  if (budgetEstimate.totalMax <= context.user.budgetMax) return 1;
  if (budgetEstimate.totalMin <= context.user.budgetMax) return 0.72;
  if (budgetEstimate.totalMin <= context.user.budgetMax * 1.15) return 0.45;
  return 0.18;
}

function scoreSeasonFit(context: PlannerRuntimeContext, destination: PlannerDestination) {
  return destination.bestSeason.includes(context.seasonal.currentSeason) ? 1 : 0.52;
}

function scoreLodgingFit(context: PlannerRuntimeContext, destination: PlannerDestination) {
  if (context.user.days === 1) return destination.lodgingLevel === "rich" ? 0.88 : destination.lodgingLevel === "moderate" ? 0.74 : 0.58;
  if (destination.lodgingLevel === "rich") return 1;
  if (destination.lodgingLevel === "moderate") return 0.82;
  if (destination.lodgingLevel === "basic") return 0.56;
  return 0.2;
}

function scoreDiningFit(_context: PlannerRuntimeContext, destination: PlannerDestination) {
  if (destination.diningLevel === "rich") return 1;
  if (destination.diningLevel === "moderate") return 0.8;
  if (destination.diningLevel === "basic") return 0.56;
  return 0.22;
}

function scoreTagFit(context: PlannerRuntimeContext, destination: PlannerDestination) {
  if (context.user.preferenceTags.length === 0) return 0.65;
  const normalizedPreferenceTags = normalizeTags(context.user.preferenceTags).normalizedTags;
  const text = `${destination.originalTags.join(" ")} ${destination.tags.join(" ")} ${destination.description}`.toLowerCase();
  const keywordHits = context.user.preferenceTags.filter((tag) => text.includes(tag.toLowerCase())).length;
  const normalizedHits = normalizedPreferenceTags.filter((tag) => destination.tags.includes(tag)).length;
  const hits = keywordHits + normalizedHits;
  return clamp01(hits / Math.max(1, context.user.preferenceTags.length));
}

export function buildBudgetEstimate(context: PlannerRuntimeContext, destination: PlannerDestination): BudgetEstimate {
  const days = context.user.days;
  const transport = context.user.transportMode === "public_transit"
    ? COST_DEFAULTS.transportPublicTransitPerDay * days
    : COST_DEFAULTS.transportSelfDrivePerDay * days;
  const lodging = days >= 2 ? (destination.lodgingPriceMin || COST_DEFAULTS.lodgingLow) * (days - 1) : 0;
  const dining = ((destination.diningPriceMin || COST_DEFAULTS.diningPerPersonLow) + (destination.diningPriceMax || COST_DEFAULTS.diningPerPersonHigh)) / 2 * days;
  const activities = ((destination.avgCostMin || COST_DEFAULTS.activitiesPerPersonLow) + (destination.avgCostMax || COST_DEFAULTS.activitiesPerPersonHigh)) / 2;
  const totalMin = Math.round(transport + lodging + Math.min(dining, destination.diningPriceMin || dining) + (destination.avgCostMin || COST_DEFAULTS.activitiesPerPersonLow));
  const totalMax = Math.round(transport + (destination.lodgingPriceMax || lodging) + Math.max(dining, destination.diningPriceMax || dining) + (destination.avgCostMax || COST_DEFAULTS.activitiesPerPersonHigh));

  return {
    transport: Math.round(transport),
    lodging: Math.round(lodging),
    dining: Math.round(dining),
    activities: Math.round(activities),
    totalMin,
    totalMax
  };
}

export function scoreDestination(destination: PlannerDestination, context: PlannerRuntimeContext, filterDecision: RankedPlan["filterDecision"]) {
  const profileKey = resolveProfileKey(context);
  const weights = resolveWeights(profileKey);
  const budgetEstimate = buildBudgetEstimate(context, destination);
  const weatherAdjustment = getWeatherAdjustment(destination, context);
  const trafficAdjustment = getTrafficAdjustment(destination, context);
  const seasonalAdjustment = getSeasonalAdjustment(destination, context);

  const rawScores = {
    timeFit: scoreTimeFit(context, destination),
    transportFit: clamp01(scoreTransportFit(context, destination) + (trafficAdjustment.scoreDelta / 40)),
    companionFit: scoreCompanionFit(context, destination),
    weatherFit: clamp01(0.78 + (weatherAdjustment.scoreDelta / 30)),
    budgetFit: scoreBudgetFit(context, destination, budgetEstimate),
    seasonFit: clamp01(scoreSeasonFit(context, destination) + (seasonalAdjustment.scoreDelta / 30)),
    lodgingFit: scoreLodgingFit(context, destination),
    diningFit: scoreDiningFit(context, destination),
    tagFit: scoreTagFit(context, destination)
  };

  const scoreBreakdown: ScoreBreakdown = {
    timeFit: Number((rawScores.timeFit * weights.timeFit).toFixed(2)),
    transportFit: Number((rawScores.transportFit * weights.transportFit).toFixed(2)),
    companionFit: Number((rawScores.companionFit * weights.companionFit).toFixed(2)),
    weatherFit: Number((rawScores.weatherFit * weights.weatherFit).toFixed(2)),
    budgetFit: Number((rawScores.budgetFit * weights.budgetFit).toFixed(2)),
    seasonFit: Number((rawScores.seasonFit * weights.seasonFit).toFixed(2)),
    lodgingFit: Number((rawScores.lodgingFit * weights.lodgingFit).toFixed(2)),
    diningFit: Number((rawScores.diningFit * weights.diningFit).toFixed(2)),
    tagFit: Number((rawScores.tagFit * weights.tagFit).toFixed(2))
  };

  const totalScore = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0) - filterDecision.penalty;

  return {
    totalScore: Number(Math.max(0, totalScore).toFixed(2)),
    scoreBreakdown,
    budgetEstimate,
    profileKey,
    adjustments: {
      weather: weatherAdjustment,
      traffic: trafficAdjustment,
      seasonal: seasonalAdjustment
    }
  };
}
