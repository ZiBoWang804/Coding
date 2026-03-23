import type { PlannerInput, PlannerResult, RankedSpot, RuralSpotSeed } from "@/types";
import { normalizeLegacyPlannerInput, runPlannerEngine } from "@/lib/planner/planner";

function toLegacySpot(raw: unknown, fallbackId: string, fallbackName: string): RuralSpotSeed {
  if (raw && typeof raw === "object" && "name" in (raw as Record<string, unknown>)) {
    return raw as RuralSpotSeed;
  }

  return {
    id: fallbackId,
    name: fallbackName,
    province: "",
    city: "",
    description: "",
    tags: [],
    bestSeason: [],
    source: "planner_bridge"
  };
}

export async function buildPlannerResult(input: PlannerInput, spots: RuralSpotSeed[]): Promise<PlannerResult> {
  const output = await runPlannerEngine(normalizeLegacyPlannerInput(input), spots);
  const topMatches: RankedSpot[] = output.recommendedPlans.map((plan) => ({
    spot: toLegacySpot(plan.mappedDestination.rawSource, plan.destinationId, plan.destinationName),
    score: plan.totalScore,
    reasons: [...plan.rankingReason, ...plan.whyFitUser],
    dimensionScores: { ...plan.scoreBreakdown }
  }));

  return {
    topMatches,
    itinerary: output.recommendedPlans[0]?.itinerary.map((item) => `第 ${item.day} 天 ${item.startTime}-${item.endTime} ${item.title}：${item.description}`) || [],
    budgetEstimate: output.recommendedPlans[0]
      ? `${output.recommendedPlans[0].budgetEstimate.totalMin}-${output.recommendedPlans[0].budgetEstimate.totalMax}`
      : "暂无预算估算",
    notes: output.readableSummary.cautions,
    summary: output.readableSummary.recommendation.join(" "),
    aiSummary: undefined,
    aiDetail: undefined,
    aiProvider: undefined,
    packingList: [],
    routeChecklist: output.recommendedPlans[0]?.itinerary.map((item) => item.title) || []
  };
}

