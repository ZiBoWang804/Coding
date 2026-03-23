import mockDestinations from "@/data/mock-destinations.json";
import { mapAnyDestination, mapSpotToPlannerDestination } from "@/lib/planner/destination-mapper";
import { buildRankingReason, buildReadableSummary, buildUserFitReasons } from "@/lib/planner/explain";
import { evaluateHardFilters } from "@/lib/planner/filters";
import { buildAlternativeOptions, generateItinerary } from "@/lib/planner/itinerary-generator";
import { scoreDestination } from "@/lib/planner/scoring";
import type { LegacyPlannerInput, PlannerApiInput, PlannerDestination, PlannerEngineOutput, PlannerProviderOptions, PlannerRuntimeContext, RankedPlan, SeasonalContext, UserContext } from "@/lib/planner/types";
import type { RuralSpotSeed } from "@/types";
import { getTrafficContext } from "@/lib/providers/traffic-provider";
import { getWeatherContext } from "@/lib/providers/weather-provider";

function deriveSeason(date: string): SeasonalContext["currentSeason"] {
  const month = new Date(date).getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function buildSeasonalContext(date: string): SeasonalContext {
  const currentSeason = deriveSeason(date);
  return {
    currentSeason,
    flowerSeasonActive: currentSeason === "spring",
    autumnViewActive: currentSeason === "autumn",
    summerRetreatActive: currentSeason === "summer",
    campingFriendly: currentSeason !== "winter",
    waterAreaRisk: currentSeason === "summer",
    mountainTrailRisk: currentSeason === "winter"
  };
}

export function normalizeLegacyPlannerInput(input: LegacyPlannerInput): PlannerApiInput {
  return {
    origin: input.departure,
    travelDate: new Date().toISOString().slice(0, 10),
    days: input.days,
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    transportMode: input.travelMode === "自驾" ? "self_drive" : "public_transit",
    companions: input.groupType === "情侣" ? "couple" : input.groupType === "亲子" ? "family" : input.groupType === "朋友" ? "friends" : "solo",
    preferenceTags: input.preferences,
    crowdPreference: input.preferences.some((tag) => /人少|安静|避开人流/.test(tag)) ? "avoid_crowds" : "neutral",
    pacePreference: input.days === 1 ? "moderate" : "slow",
    specialConstraints: []
  };
}

async function buildRuntimeContext(input: PlannerApiInput, options?: PlannerProviderOptions): Promise<PlannerRuntimeContext> {
  const user: UserContext = {
    origin: input.origin,
    travelDate: input.travelDate,
    days: input.days,
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    transportMode: input.transportMode,
    companions: input.companions,
    preferenceTags: input.preferenceTags,
    crowdPreference: input.crowdPreference,
    pacePreference: input.pacePreference,
    lodgingPreference: input.lodgingPreference || null,
    diningPreference: input.diningPreference || null,
    specialConstraints: input.specialConstraints || [],
    historicalProfile: null
  };

  const weather = await getWeatherContext(input.travelDate, input.weather, options);
  const traffic = await getTrafficContext(input.travelDate, input.traffic, options);
  const seasonal = buildSeasonalContext(input.travelDate);

  return { user, weather, traffic, seasonal };
}

function collectDestinations(spots: RuralSpotSeed[]): PlannerDestination[] {
  const mapped = spots.map(mapSpotToPlannerDestination);
  const mockMapped = (mockDestinations as Array<Record<string, unknown>>).map(mapAnyDestination);
  const merged = [...mapped, ...mockMapped];
  const byId = new Map<string, PlannerDestination>();
  for (const item of merged) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

export async function runPlannerEngine(input: PlannerApiInput, spots: RuralSpotSeed[], options?: PlannerProviderOptions): Promise<PlannerEngineOutput> {
  const context = await buildRuntimeContext(input, options);
  const destinations = collectDestinations(spots);
  const filteredOut: Array<{ destinationId: string; destinationName: string; reasons: string[] }> = [];
  const ranked: RankedPlan[] = [];

  for (const destination of destinations) {
    const filterDecision = evaluateHardFilters(destination, context);
    if (!filterDecision.passed) {
      filteredOut.push({ destinationId: destination.id, destinationName: destination.name, reasons: filterDecision.rejectionReasons });
      continue;
    }

    const scored = scoreDestination(destination, context, filterDecision);
    const plan: RankedPlan = {
      destinationId: destination.id,
      destinationName: destination.name,
      totalScore: scored.totalScore,
      scoreBreakdown: scored.scoreBreakdown,
      rankingReason: [],
      whyFitUser: [],
      weatherAdjustmentReason: scored.adjustments.weather.reasons,
      crowdAdjustmentReason: scored.adjustments.traffic.reasons,
      budgetEstimate: scored.budgetEstimate,
      transportSummary: destination.transportSummary || "交通信息整体可用，出发前建议再确认路线和停车情况。",
      lodgingSummary: destination.lodgingSummary || "当地住宿资源有限，如果行程较紧可以考虑当天往返。",
      diningSummary: destination.diningSummary || "当地餐饮选择较基础，建议不要把用餐时间安排得太晚。",
      risks: [...filterDecision.warnings, ...destination.cautionNotes, ...destination.seasonalWarnings, ...destination.closureRiskNotes],
      itinerary: generateItinerary(destination, context),
      alternativeOptions: [],
      filterDecision,
      mappedDestination: destination
    };

    ranked.push(plan);
  }

  ranked.sort((a, b) => b.totalScore - a.totalScore);

  for (let index = 0; index < ranked.length; index += 1) {
    const current = ranked[index];
    current.rankingReason = buildRankingReason(current, context);
    current.whyFitUser = buildUserFitReasons(current.mappedDestination, context);
    current.alternativeOptions = buildAlternativeOptions(ranked.filter((item) => item.destinationId !== current.destinationId).map((item) => item.mappedDestination));
  }

  const recommendedPlans = ranked.slice(0, 5);
  const debugProfileKey = ranked[0] ? scoreDestination(ranked[0].mappedDestination, context, ranked[0].filterDecision).profileKey : "default";
  const output: PlannerEngineOutput = {
    recommendedPlans,
    readableSummary: {
      headline: "",
      recommendation: [],
      dynamicImpact: [],
      cautions: [],
      alternatives: []
    },
    debug: {
      filteredOut,
      profileKey: debugProfileKey
    }
  };

  output.readableSummary = buildReadableSummary(output, context);
  return output;
}


