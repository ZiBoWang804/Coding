import { HARD_FILTER_LIMITS } from "@/lib/planner/config";
import type { FilterDecision, PlannerDestination, PlannerRuntimeContext } from "@/lib/planner/types";

function getApproxDistanceKm(context: PlannerRuntimeContext, destination: PlannerDestination) {
  const origin = context.user.origin.toLowerCase();
  const isXianOrigin = origin.includes("xi'an") || origin.includes("xian") || origin.includes("西安");

  if (isXianOrigin && destination.latitude != null && destination.longitude != null) {
    const dx = (destination.longitude - 108.9398) * 92;
    const dy = (destination.latitude - 34.3416) * 111;
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  }

  const cityHit = origin.includes(destination.city.toLowerCase()) || destination.city.toLowerCase().includes(origin);
  const provinceHit = origin.includes(destination.province.toLowerCase());
  if (cityHit) return 65;
  if (provinceHit) return 140;
  if (isXianOrigin && !/shaanxi|xi'an|xian|xianyang|陕西|西安|咸阳/i.test(`${destination.province} ${destination.city}`)) return 480;
  return destination.city.toLowerCase().includes("xianyang") && origin.includes("xian") ? 85 : 220;
}

export function evaluateHardFilters(destination: PlannerDestination, context: PlannerRuntimeContext): FilterDecision {
  const rejectionReasons: string[] = [];
  const warnings: string[] = [];
  let penalty = 0;
  const distanceKm = getApproxDistanceKm(context, destination);
  const severeWeather = context.weather.severeWeatherAlert || ["thunder", "snow"].includes(context.weather.condition);
  const isOneDay = context.user.days === 1;
  const needsLodging = context.user.days >= 2;
  const estimatedTripCost = (destination.avgCostMax || 280) * Math.max(1, context.user.days * 0.85);

  if (context.user.budgetMax && estimatedTripCost > context.user.budgetMax * 1.35) {
    rejectionReasons.push("预估花费明显超出预算上限。");
  }

  if (isOneDay && context.user.transportMode === "self_drive" && distanceKm > HARD_FILTER_LIMITS.oneDayMaxDistanceKm) {
    rejectionReasons.push("1 天自驾往返距离过远，整体会比较赶。");
  }

  if (isOneDay && context.user.transportMode === "public_transit" && distanceKm > HARD_FILTER_LIMITS.oneDayPublicTransitMaxDistanceKm) {
    rejectionReasons.push("1 天公共交通往返距离过远。");
  }

  if (context.user.days === 2 && distanceKm > HARD_FILTER_LIMITS.twoDayMaxDistanceKm) {
    rejectionReasons.push("超过 2 天短途出行的合理半径。");
  }

  if (context.user.days === 3 && distanceKm > 420) {
    rejectionReasons.push("即使是 3 天行程，这个目的地距离当前出发地也偏远。");
  }

  if (context.user.transportMode === "public_transit" && (destination.publicTransitFriendlyScore || 0) < 2.3) {
    rejectionReasons.push("这个目的地的公共交通可达性偏弱。");
  }

  if (context.user.transportMode !== "self_drive" && (destination.lastMileDifficulty || 1) >= HARD_FILTER_LIMITS.publicTransitLastMileThreshold) {
    rejectionReasons.push("对于非自驾用户来说，最后一段接驳难度过高。");
  }

  if (severeWeather && (destination.roadRiskLevel || 1) >= HARD_FILTER_LIMITS.severeWeatherRoadRiskThreshold) {
    rejectionReasons.push("当前天气条件下，这个目的地存在安全风险。");
  }

  if (context.user.specialConstraints.includes("avoid_mountain_road") && (destination.roadRiskLevel || 1) >= 4) {
    rejectionReasons.push("路线包含山路风险，与当前约束条件冲突。");
  }

  if (context.user.specialConstraints.includes("avoid_steep_walk") && destination.tags.includes("hiking_light")) {
    penalty += 8;
    warnings.push("该路线包含一定步行段，建议放慢节奏。");
  }

  if (context.user.companions === "elderly" && (destination.elderlyFriendlyScore || 0) < 2.8) {
    rejectionReasons.push("对长辈同行来说，这个目的地负担偏高。");
  }

  if (context.user.companions === "family" && (destination.familyFriendlyScore || 0) < 2.8) {
    rejectionReasons.push("这个目的地对亲子家庭的友好度不够。");
  }

  if (needsLodging && destination.lodgingLevel === "none") {
    rejectionReasons.push("多日行程需要住宿，但当地住宿供给不足。");
  }

  if (context.traffic.isHoliday && context.user.crowdPreference === "avoid_crowds" && (destination.crowdLevel || 3) >= 4) {
    rejectionReasons.push("节假日人流压力与避开拥挤的偏好冲突。");
  }

  if (context.weather.condition === "heavy_rain" && destination.tags.some((tag) => ["camping", "mountain_view", "hiking_light"].includes(tag))) {
    rejectionReasons.push("暴雨天气不适合这里的核心户外体验。");
  }

  return {
    passed: rejectionReasons.length === 0,
    rejectionReasons,
    penalty,
    warnings
  };
}


