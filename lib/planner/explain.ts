import type { PlannerDestination, PlannerEngineOutput, PlannerRuntimeContext, RankedPlan } from "@/lib/planner/types";

function topReasons(plan: RankedPlan) {
  return Object.entries(plan.scoreBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
}

function formatCompanions(companions: PlannerRuntimeContext["user"]["companions"]) {
  switch (companions) {
    case "couple":
      return "情侣";
    case "family":
      return "亲子家庭";
    case "friends":
      return "朋友结伴";
    case "elderly":
      return "长辈同行";
    default:
      return "独自出行";
  }
}

export function buildRankingReason(plan: RankedPlan, context: PlannerRuntimeContext): string[] {
  const reasons: string[] = [];
  const strongest = topReasons(plan);

  if (strongest.includes("timeFit")) reasons.push("行程天数与目的地节奏匹配度较高。");
  if (strongest.includes("transportFit")) reasons.push("当前出行方式下，交通可达性较为合适。");
  if (strongest.includes("weatherFit")) reasons.push("当前天气对这个目的地的核心体验较为友好。");
  if (strongest.includes("budgetFit")) reasons.push("预算区间与预估花费比较匹配。");
  if (strongest.includes("companionFit")) reasons.push(`这个目的地更适合${formatCompanions(context.user.companions)}出行。`);
  if (strongest.includes("tagFit")) reasons.push("与你勾选的偏好标签重合度较高。");

  return reasons;
}

export function buildUserFitReasons(destination: PlannerDestination, context: PlannerRuntimeContext): string[] {
  const reasons: string[] = [];
  if (context.user.companions === "couple" && destination.lodgingFitCouples) reasons.push("住宿氛围和停留方式更适合情侣短途出游。");
  if (context.user.companions === "family" && (destination.familyFriendlyScore || 0) >= 4) reasons.push("亲子互动性和行程节奏更适合带孩子同行。");
  if (context.user.companions === "elderly" && (destination.elderlyFriendlyScore || 0) >= 3.5) reasons.push("步行压力和整体节奏对长辈更友好。");
  if (context.user.transportMode === "public_transit" && (destination.publicTransitFriendlyScore || 0) >= 3.2) reasons.push("公共交通可达性相对稳定，换乘压力不大。");
  if (context.user.transportMode === "self_drive" && (destination.selfDriveFriendlyScore || 0) >= 4) reasons.push("这条路线更适合作为周末自驾方案。");
  if (context.user.preferenceTags.some((tag) => destination.originalTags.join(" ").includes(tag) || destination.description.includes(tag))) reasons.push("景点体验和你标记的偏好标签契合度较高。");
  return reasons;
}

export function buildReadableSummary(output: PlannerEngineOutput, context: PlannerRuntimeContext) {
  const best = output.recommendedPlans[0];
  if (!best) {
    return {
      headline: "暂未找到合适方案",
      recommendation: ["当前没有目的地通过硬性筛选条件，可以尝试放宽距离、预算或天气限制。"],
      dynamicImpact: [],
      cautions: [],
      alternatives: []
    };
  }

  return {
    headline: `首选方案：${best.destinationName}`,
    recommendation: [
      `${best.destinationName} 是从 ${context.user.origin} 出发、适合 ${context.user.days} 天 ${formatCompanions(context.user.companions)}出行的当前最稳妥选择。`,
      ...best.whyFitUser.slice(0, 2),
      ...best.rankingReason.slice(0, 2)
    ],
    dynamicImpact: [...best.weatherAdjustmentReason.slice(0, 2), ...best.crowdAdjustmentReason.slice(0, 2)],
    cautions: best.risks.slice(0, 3),
    alternatives: best.alternativeOptions.map((option) => `${option.destinationName}：${option.reason}`)
  };
}
