import { HARD_FILTER_LIMITS } from "@/lib/planner/config";
import type { FilterDecision, PlannerDestination, PlannerRuntimeContext } from "@/lib/planner/types";

function isXianLike(text: string) {
  return /xi'?an|西安/i.test(text);
}

function isXianyangLike(text: string) {
  return /xianyang|咸阳/i.test(text);
}

function isShaanxiLike(text: string) {
  return /shaanxi|陕西/i.test(text);
}

function getApproxDistanceKm(context: PlannerRuntimeContext, destination: PlannerDestination) {
  const origin = context.user.origin.toLowerCase();
  const destinationRegion = `${destination.province} ${destination.city}`;
  const isXianOrigin = isXianLike(origin);

  if (isXianOrigin && destination.latitude != null && destination.longitude != null) {
    const dx = (destination.longitude - 108.9398) * 92;
    const dy = (destination.latitude - 34.3416) * 111;
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  }

  const cityHit = origin.includes(destination.city.toLowerCase()) || destination.city.toLowerCase().includes(origin);
  const provinceHit = origin.includes(destination.province.toLowerCase());
  if (cityHit) return 65;
  if (provinceHit) return 140;

  if (isXianOrigin) {
    if (isXianLike(destinationRegion)) return 65;
    if (isXianyangLike(destinationRegion)) return 85;
    if (isShaanxiLike(destinationRegion)) return 140;
    return 480;
  }

  return isXianyangLike(destination.city) && origin.includes("xian") ? 85 : 220;
}

function addWarning(target: { warnings: string[]; penalty: number }, message: string, penalty = 6) {
  target.warnings.push(message);
  target.penalty += penalty;
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

  if (destination.openStatus === "closed") {
    rejectionReasons.push("按当前开放信息判断，这个目的地在计划日期可能闭园。");
  }

  if (context.user.budgetMax) {
    if (estimatedTripCost > context.user.budgetMax * 1.8) {
      rejectionReasons.push("预估花费明显超出预算上限。");
    } else if (estimatedTripCost > context.user.budgetMax * 1.2) {
      addWarning({ warnings, penalty }, "费用会略高于预算，建议适当放宽预算或压缩活动安排。", 8);
    }
  }

  if (isOneDay && context.user.transportMode === "self_drive") {
    if (distanceKm > HARD_FILTER_LIMITS.oneDayMaxDistanceKm * 1.45) {
      rejectionReasons.push("1 天自驾往返距离过远，不建议作为当天来回方案。");
    } else if (distanceKm > HARD_FILTER_LIMITS.oneDayMaxDistanceKm) {
      addWarning({ warnings, penalty }, "1 天自驾会偏赶，建议提早出发或缩短现场停留时间。", 10);
    }
  }

  if (isOneDay && context.user.transportMode === "public_transit") {
    if (distanceKm > HARD_FILTER_LIMITS.oneDayPublicTransitMaxDistanceKm * 1.65) {
      rejectionReasons.push("1 天公共交通往返距离过远，不建议这样安排。");
    } else if (distanceKm > HARD_FILTER_LIMITS.oneDayPublicTransitMaxDistanceKm) {
      addWarning({ warnings, penalty }, "公共交通往返时间较长，更适合作为折中备选。", 12);
    }
  }

  if (context.user.days === 2) {
    if (distanceKm > HARD_FILTER_LIMITS.twoDayMaxDistanceKm * 1.4) {
      rejectionReasons.push("超过 2 天短途出行的合理半径。");
    } else if (distanceKm > HARD_FILTER_LIMITS.twoDayMaxDistanceKm) {
      addWarning({ warnings, penalty }, "两天行程会有点赶，建议减少串联景点。", 8);
    }
  }

  if (context.user.days === 3) {
    if (distanceKm > 560) {
      rejectionReasons.push("即使是 3 天行程，这个目的地距离当前出发地也偏远。");
    } else if (distanceKm > 420) {
      addWarning({ warnings, penalty }, "三天行程可做，但返程压力会比较明显。", 6);
    }
  }

  if (context.user.transportMode === "public_transit") {
    const score = destination.publicTransitFriendlyScore || 0;
    if (score < 1.6) {
      rejectionReasons.push("这个目的地的公共交通可达性过弱。");
    } else if (score < 2.3) {
      addWarning({ warnings, penalty }, "公共交通可达性一般，建议把它视为折中方案。", 10);
    }
  }

  if (context.user.transportMode !== "self_drive") {
    const difficulty = destination.lastMileDifficulty || 1;
    if (difficulty >= HARD_FILTER_LIMITS.publicTransitLastMileThreshold + 1) {
      rejectionReasons.push("最后一段接驳难度过高，不适合当前出行方式。");
    } else if (difficulty >= HARD_FILTER_LIMITS.publicTransitLastMileThreshold) {
      addWarning({ warnings, penalty }, "最后一段接驳比较费劲，建议预留打车或步行缓冲。", 10);
    }
  }

  if (severeWeather && (destination.roadRiskLevel || 1) >= HARD_FILTER_LIMITS.severeWeatherRoadRiskThreshold) {
    rejectionReasons.push("当前天气条件下，这个目的地存在明显安全风险。");
  }

  if (context.user.specialConstraints.includes("avoid_mountain_road") && (destination.roadRiskLevel || 1) >= 4) {
    rejectionReasons.push("路线包含山路风险，与当前约束条件冲突。");
  }

  if (context.user.specialConstraints.includes("avoid_steep_walk") && destination.tags.includes("hiking_light")) {
    addWarning({ warnings, penalty }, "该路线包含一定步行段，建议放慢节奏。", 8);
  }

  if (context.user.companions === "elderly") {
    const score = destination.elderlyFriendlyScore || 0;
    if (score < 2) {
      rejectionReasons.push("对长辈同行来说，这个目的地负担偏高。");
    } else if (score < 2.8) {
      addWarning({ warnings, penalty }, "长辈同行需要更保守地安排步行和停留时间。", 8);
    }
  }

  if (context.user.companions === "family") {
    const score = destination.familyFriendlyScore || 0;
    if (score < 2) {
      rejectionReasons.push("这个目的地对亲子家庭不够友好。");
    } else if (score < 2.8) {
      addWarning({ warnings, penalty }, "亲子配套一般，建议控制节奏并提前确认现场设施。", 8);
    }
  }

  if (needsLodging && destination.lodgingLevel === "none") {
    addWarning({ warnings, penalty }, "多日行程缺少本地住宿支撑，可能需要跨区域住宿。", 8);
  }

  if (context.traffic.isHoliday && context.user.crowdPreference === "avoid_crowds" && (destination.crowdLevel || 3) >= 4) {
    addWarning({ warnings, penalty }, "节假日人流压力偏大，和避开拥挤的偏好不完全一致。", 6);
  }

  if (context.weather.condition === "heavy_rain" && destination.tags.some((tag) => ["camping", "mountain_view", "hiking_light"].includes(tag))) {
    addWarning({ warnings, penalty }, "暴雨天气会削弱这里的核心户外体验。", 14);
  }

  if ((destination.liveTravelMinutes || 0) >= 300 && context.user.days === 1) {
    rejectionReasons.push("当前路线预计耗时过长，不适合作为 1 天往返方案。");
  } else if ((destination.liveTravelMinutes || 0) >= 210 && context.user.days === 1) {
    addWarning({ warnings, penalty }, "当前路线耗时偏长，当天往返会比较赶。", 12);
  }

  return {
    passed: rejectionReasons.length === 0,
    rejectionReasons,
    penalty,
    warnings
  };
}
