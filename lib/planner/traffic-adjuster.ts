import type { AdjustmentImpact, PlannerDestination, PlannerRuntimeContext } from "@/lib/planner/types";

export function getTrafficAdjustment(destination: PlannerDestination, context: PlannerRuntimeContext): AdjustmentImpact {
  const reasons: string[] = [];
  let scoreDelta = 0;

  if (context.traffic.isWeekend) {
    scoreDelta -= (destination.crowdLevel || 3) >= 4 ? 6 : 1;
    reasons.push((destination.crowdLevel || 3) >= 4 ? "周末出行会显著抬高这里的人流和停车压力。" : "周末路况整体可控。");
  }

  if (context.traffic.isHoliday) {
    const crowdPenalty = (destination.crowdLevel || 3) >= 4 ? 12 : 4;
    scoreDelta -= crowdPenalty;
    reasons.push((destination.crowdLevel || 3) >= 4 ? "节假日会给这个热门目的地带来明显拥堵。" : "节假日仍会带来一定程度的通行压力。");
  }

  if (context.user.crowdPreference === "avoid_crowds") {
    const crowdPenalty = ((destination.crowdLevel || 3) - 2) * 3;
    scoreDelta -= Math.max(0, crowdPenalty);
    if ((destination.crowdLevel || 3) >= 4) reasons.push("你偏好避开人流，因此高热度景点会被降权。");
  }

  if ((destination.parkingConvenience || 3) <= 2 && context.user.transportMode === "self_drive") {
    scoreDelta -= 5;
    reasons.push("对于自驾方案来说，这里的停车便利性偏弱。");
  }

  if ((destination.lastMileDifficulty || 2) >= 4 && context.user.transportMode === "public_transit") {
    scoreDelta -= 7;
    reasons.push("公共交通到达后的最后一段接驳复杂度较高。");
  }

  if (context.traffic.nightReturnRisk >= 4 && context.user.days === 1) {
    scoreDelta -= 6;
    reasons.push("当日往返情况下，夜间返程风险偏高。");
  }

  return { scoreDelta, reasons };
}
