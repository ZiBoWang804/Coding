import type { AdjustmentImpact, PlannerDestination, PlannerRuntimeContext } from "@/lib/planner/types";

export function getSeasonalAdjustment(destination: PlannerDestination, context: PlannerRuntimeContext): AdjustmentImpact {
  const reasons: string[] = [];
  let scoreDelta = 0;
  const currentSeason = context.seasonal.currentSeason;

  if (destination.bestSeason.includes(currentSeason)) {
    scoreDelta += 6;
    reasons.push("当前季节与目的地推荐游览时段相符。");
  } else {
    scoreDelta -= 4;
    reasons.push("当前季节与目的地主打体验的匹配度一般。");
  }

  if (destination.tags.includes("flower_sea")) {
    if (context.seasonal.flowerSeasonActive) {
      scoreDelta += 5;
      reasons.push("当前正值花期，这类目的地会额外加分。");
    } else {
      scoreDelta -= 5;
      reasons.push("非花期时，这类目的地的观赏价值会下降。");
    }
  }

  if (destination.tags.includes("autumn_view")) {
    scoreDelta += context.seasonal.autumnViewActive ? 5 : -3;
    reasons.push(context.seasonal.autumnViewActive ? "当前处于秋景观赏期。" : "当前还未到秋景最佳观赏窗口。");
  }

  if (destination.tags.includes("summer_retreat")) {
    scoreDelta += context.seasonal.summerRetreatActive ? 4 : 0;
    if (context.seasonal.summerRetreatActive) reasons.push("当前时节更适合避暑型目的地。");
  }

  if (destination.tags.includes("camping") && !context.seasonal.campingFriendly) {
    scoreDelta -= 8;
    reasons.push("当前季节条件不太适合露营。");
  }

  if (destination.tags.includes("water_view") && context.seasonal.waterAreaRisk) {
    scoreDelta -= 6;
    reasons.push("当前季节的涉水风险会降低临水活动的适配度。");
  }

  if (destination.tags.includes("mountain_view") && context.seasonal.mountainTrailRisk) {
    scoreDelta -= 5;
    reasons.push("当前季节下山路或步道风险偏高。");
  }

  return { scoreDelta, reasons };
}
