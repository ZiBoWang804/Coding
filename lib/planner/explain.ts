import type { PlannerDestination, PlannerEngineOutput, PlannerRuntimeContext, RankedPlan } from "@/lib/planner/types";

function formatOrigin(origin: string) {
  if (/^xi'?an urban area$/i.test(origin.trim())) return "西安市区";
  return origin;
}

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
  if (strongest.includes("transportFit")) reasons.push("在当前出行方式下，可达性和接驳压力更合适。");
  if (strongest.includes("weatherFit")) reasons.push("当前天气对这个目的地的核心体验相对友好。");
  if (strongest.includes("budgetFit")) reasons.push("预算区间与预估花费较匹配。");
  if (strongest.includes("companionFit")) reasons.push(`这个目的地更适合${formatCompanions(context.user.companions)}出行。`);
  if (strongest.includes("tagFit")) reasons.push("与你勾选的偏好标签重合度较高。");

  if (!plan.filterDecision.passed && plan.filterDecision.rejectionReasons.length > 0) {
    reasons.push("它没有完全满足当前限制，但仍是最接近需求的折中方案。");
  }

  return reasons;
}

export function buildUserFitReasons(destination: PlannerDestination, context: PlannerRuntimeContext): string[] {
  const reasons: string[] = [];

  if (context.user.companions === "couple" && destination.lodgingFitCouples) {
    reasons.push("住宿氛围和停留方式更适合情侣周末短途。");
  }
  if (context.user.companions === "family" && (destination.familyFriendlyScore || 0) >= 4) {
    reasons.push("互动性和节奏更适合带孩子出行。");
  }
  if (context.user.companions === "elderly" && (destination.elderlyFriendlyScore || 0) >= 3.5) {
    reasons.push("步行压力和整体节奏对长辈更友好。");
  }
  if (context.user.transportMode === "public_transit" && (destination.publicTransitFriendlyScore || 0) >= 3.2) {
    reasons.push("公共交通可达性相对稳定，换乘压力不大。");
  }
  if (context.user.transportMode === "self_drive" && (destination.selfDriveFriendlyScore || 0) >= 4) {
    reasons.push("这条路线更适合作为周末自驾方案。");
  }
  if (context.user.preferenceTags.some((tag) => destination.originalTags.join(" ").includes(tag) || destination.description.includes(tag))) {
    reasons.push("景点体验与你标记的偏好比较贴合。");
  }

  return reasons;
}

export function buildReadableSummary(output: PlannerEngineOutput, context: PlannerRuntimeContext) {
  const best = output.recommendedPlans[0];
  const origin = formatOrigin(context.user.origin);

  if (!best) {
    return {
      headline: "暂未找到合适方案",
      recommendation: ["当前条件下没有完全匹配的目的地，建议适当放宽预算、天数或出行方式后再试。"],
      dynamicImpact: [],
      cautions: [],
      alternatives: []
    };
  }

  const dynamicImpact = [...best.weatherAdjustmentReason.slice(0, 2), ...best.crowdAdjustmentReason.slice(0, 2)];
  if (best.mappedDestination.openingHoursText) {
    dynamicImpact.push(`开放时间参考：${best.mappedDestination.openingHoursText}`);
  }
  if (best.mappedDestination.liveTravelMinutes != null) {
    dynamicImpact.push(`预计到达耗时约 ${best.mappedDestination.liveTravelMinutes} 分钟。`);
  }

  const isFallback = !best.filterDecision.passed;

  return {
    headline: isFallback ? `为你保留的折中方案：${best.destinationName}` : `首选方案：${best.destinationName}`,
    recommendation: isFallback
      ? [
          `当前条件下没有完全命中的路线，${best.destinationName} 是从 ${origin} 出发最接近需求的折中推荐。`,
          ...best.whyFitUser.slice(0, 2),
          ...best.rankingReason.slice(0, 2)
        ]
      : [
          `${best.destinationName} 是从 ${origin} 出发、适合 ${context.user.days} 天${formatCompanions(context.user.companions)}出行的当前稳妥选择。`,
          ...best.whyFitUser.slice(0, 2),
          ...best.rankingReason.slice(0, 2)
        ],
    dynamicImpact,
    cautions: [...best.filterDecision.rejectionReasons, ...best.risks].slice(0, 5),
    alternatives: best.alternativeOptions.map((option) => `${option.destinationName}：${option.reason}`)
  };
}
