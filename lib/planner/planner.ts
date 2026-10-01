import { mapSpotToPlannerDestination } from "@/lib/planner/destination-mapper";
import { buildRankingReason, buildReadableSummary, buildUserFitReasons } from "@/lib/planner/explain";
import { evaluateHardFilters } from "@/lib/planner/filters";
import { enrichDestinationsWithLiveSignals, verifyRankedPlansOpeningHours } from "@/lib/planner/live-enricher";
import {
  buildAlternativeOptions,
  buildDiningRecommendation,
  buildLodgingRecommendation,
  buildTransportRecommendation,
  generateItinerary,
  shouldRegenerateItinerary
} from "@/lib/planner/itinerary-generator";
import { generateTravelPlan } from "@/lib/planner/ai-planner-v2";
import { scoreDestination } from "@/lib/planner/scoring";
import { buildAiReadablePlannerSummary, generateAiPlannerPlan } from "@/lib/openai";
import type {
  BudgetEstimate,
  LegacyPlannerInput,
  PlannerApiInput,
  PlannerDestination,
  PlannerEngineOutput,
  PlannerProviderOptions,
  PlannerRuntimeContext,
  RankedPlan,
  SeasonalContext,
  UserContext
} from "@/lib/planner/types";
import type { PlannerProfileKey } from "@/lib/planner/enums";
import type { RuralSpotSeed } from "@/types";
import { getTrafficContext } from "@/lib/providers/traffic-provider";
import { getWeatherContext } from "@/lib/providers/weather-provider";

type AiPlannerDecision = Awaited<ReturnType<typeof generateAiPlannerPlan>>;
type AiPlannerRecommendation = NonNullable<AiPlannerDecision>["response"]["recommendations"][number] & {
  hotelSummary?: string | null;
  ticketSummary?: string | null;
};

const WEATHER_LABELS: Record<string, string> = {
  sunny: "晴",
  cloudy: "多云",
  light_rain: "小雨",
  heavy_rain: "大雨",
  thunder: "雷雨",
  snow: "降雪",
  fog: "有雾",
  heat: "炎热",
  cold: "寒冷",
  windy: "有风"
};

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

function uniqueStrings(items: Array<string | null | undefined>) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function textIncludes(text: string | null | undefined, keyword: string) {
  if (!text || !keyword) return false;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function matchesDestinationConstraint(destination: PlannerDestination, keyword: string) {
  const fields = [destination.name, destination.province, destination.city, destination.district, destination.address, destination.description];
  return fields.some((field) => textIncludes(field, keyword));
}

function filterDestinationsByDestinationQuery(destinations: PlannerDestination[], keyword?: string | null) {
  const normalizedKeyword = keyword?.trim();
  if (!normalizedKeyword) return destinations;
  return destinations.filter((destination) => matchesDestinationConstraint(destination, normalizedKeyword));
}

function mergeBudgetEstimate(aiBudget: Partial<BudgetEstimate> | undefined, fallbackBudget: BudgetEstimate): BudgetEstimate {
  if (!aiBudget) return fallbackBudget;
  return {
    transport: aiBudget.transport || fallbackBudget.transport,
    lodging: aiBudget.lodging || fallbackBudget.lodging,
    dining: aiBudget.dining || fallbackBudget.dining,
    activities: aiBudget.activities || fallbackBudget.activities,
    totalMin: aiBudget.totalMin || fallbackBudget.totalMin,
    totalMax: aiBudget.totalMax || fallbackBudget.totalMax
  };
}

function clampScore(score: number | undefined, fallback: number) {
  if (score == null || Number.isNaN(score)) return fallback;
  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
}

function getWeatherSummaryText(context: PlannerRuntimeContext, override?: string) {
  const direct = String(override || "").trim();
  if (/[\u4e00-\u9fa5]/.test(direct)) return direct;

  const summary = String(context.weather.weatherSummary || "").trim();
  if (/[\u4e00-\u9fa5]/.test(summary)) return summary;

  const condition = WEATHER_LABELS[context.weather.condition] || "天气待确认";
  if (context.weather.temperatureHigh != null && context.weather.temperatureLow != null) {
    return `${context.user.travelDate} 天气参考：${condition}，气温约 ${context.weather.temperatureLow}°C - ${context.weather.temperatureHigh}°C。`;
  }

  return `${context.user.travelDate} 天气参考：${condition}。`;
}

function getTrafficSummaryText(context: PlannerRuntimeContext, override?: string) {
  if (override?.trim()) return override;
  const prefix = context.traffic.isHoliday ? "假日路况参考" : "路况参考";
  return `${prefix}：拥堵等级 ${context.traffic.congestionLevel}/5，停车压力 ${context.traffic.parkingStress}/5。`;
}

function collectDestinations(spots: RuralSpotSeed[]): PlannerDestination[] {
  const merged = spots.map(mapSpotToPlannerDestination);
  const byId = new Map<string, PlannerDestination>();
  for (const item of merged) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

export function normalizeLegacyPlannerInput(input: LegacyPlannerInput): PlannerApiInput {
  return {
    origin: input.departure,
    destinationQuery: null,
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
    destinationQuery: input.destinationQuery || null,
    includeLiveSignals: input.includeLiveSignals !== false,
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
    departureTimePreference: input.departureTimePreference || null,
    bookingPreference: input.bookingPreference || null,
    ticketPreference: input.ticketPreference || null,
    specialConstraints: input.specialConstraints || [],
    historicalProfile: null
  };

  const referenceLocation = input.destinationQuery?.trim() || options?.referenceLocation || input.origin;
  const providerOptions = {
    ...options,
    origin: input.origin,
    referenceLocation,
    forceMock: options?.forceMock || input.includeLiveSignals === false
  };

  const [weather, traffic] = await Promise.all([
    getWeatherContext(input.travelDate, input.weather, providerOptions),
    getTrafficContext(input.travelDate, input.traffic, providerOptions)
  ]);

  return {
    user,
    weather,
    traffic,
    seasonal: buildSeasonalContext(input.travelDate)
  };
}

function buildRuntimeInsightsForUi(
  context: PlannerRuntimeContext,
  override?: {
    weather?: string;
    traffic?: string;
  }
) {
  return {
    weather: getWeatherSummaryText(context, override?.weather),
    traffic: getTrafficSummaryText(context, override?.traffic),
    destinationQuery: context.user.destinationQuery || null
  };
}

function buildRankedPlan(destination: PlannerDestination, context: PlannerRuntimeContext, filterDecision: RankedPlan["filterDecision"]) {
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
    transportSummary: destination.transportSummary || "交通条件整体可行，出发前建议再确认路线和停车情况。",
    lodgingSummary: destination.lodgingSummary || "当地住宿资源有限，如果行程较紧可以考虑当天往返。",
    diningSummary: destination.diningSummary || "当地餐饮选择相对基础，建议不要把用餐时间安排得太晚。",
    risks: [...filterDecision.warnings, ...destination.cautionNotes, ...destination.seasonalWarnings, ...destination.closureRiskNotes],
    itinerary: generateItinerary(destination, context),
    alternativeOptions: [],
    filterDecision,
    mappedDestination: destination
  };

  return { plan, profileKey: scored.profileKey };
}

function canUseAsFallback(plan: RankedPlan) {
  const blockerText = [...plan.filterDecision.rejectionReasons, ...plan.risks].join(" ");
  return !/闭园|安全风险|路线包含山路风险/.test(blockerText);
}

function shortlistDestinations(destinations: PlannerDestination[], context: PlannerRuntimeContext) {
  const roughPlans = destinations.map((destination) => {
    const filterDecision = evaluateHardFilters(destination, context);
    const { plan, profileKey } = buildRankedPlan(destination, context, filterDecision);
    return { destination, plan, profileKey };
  });

  roughPlans.sort((left, right) => right.plan.totalScore - left.plan.totalScore);
  return roughPlans.slice(0, context.user.destinationQuery ? 6 : 8);
}

function buildPlanFromAiRecommendation(recommendation: AiPlannerRecommendation, destination: PlannerDestination, context: PlannerRuntimeContext) {
  const filterDecision = evaluateHardFilters(destination, context);
  const { plan: basePlan } = buildRankedPlan(destination, context, filterDecision);
  const mappedDestination: PlannerDestination = {
    ...destination,
    openStatus: recommendation.openStatus ?? destination.openStatus,
    openingHoursText: recommendation.openingHoursText ?? destination.openingHoursText,
    aiHotelSummary: recommendation.hotelSummary ?? null,
    aiTicketSummary: recommendation.ticketSummary ?? null
  };

  const risks = uniqueStrings([
    ...basePlan.risks,
    ...recommendation.dynamicFactors,
    ...recommendation.cautions,
    recommendation.ticketSummary ? `门票与预约：${recommendation.ticketSummary}` : null
  ]);

  const itinerary =
    recommendation.itinerary.length > 0
      ? recommendation.itinerary.map((item) => ({
          ...item,
          location: item.location ?? undefined,
          transportTip: item.transportTip ?? undefined,
          mealTip: item.mealTip ?? undefined,
          stayTip: item.stayTip ?? undefined
        }))
      : generateItinerary(mappedDestination, context);

  return {
    ...basePlan,
    destinationId: mappedDestination.id,
    destinationName: mappedDestination.name,
    totalScore: clampScore(recommendation.score, basePlan.totalScore),
    budgetEstimate: mergeBudgetEstimate(recommendation.budgetEstimate, basePlan.budgetEstimate),
    rankingReason: recommendation.matchReasons.length ? recommendation.matchReasons : basePlan.rankingReason,
    whyFitUser: recommendation.fitReasons.length ? recommendation.fitReasons : basePlan.whyFitUser,
    weatherAdjustmentReason: recommendation.dynamicFactors,
    crowdAdjustmentReason: [],
    transportSummary: recommendation.transportSummary || basePlan.transportSummary,
    lodgingSummary: recommendation.lodgingSummary || recommendation.hotelSummary || basePlan.lodgingSummary,
    diningSummary: recommendation.diningSummary || basePlan.diningSummary,
    risks,
    itinerary,
    alternativeOptions: [],
    filterDecision,
    mappedDestination
  } satisfies RankedPlan;
}

async function buildAiDrivenOutput(
  input: PlannerApiInput,
  context: PlannerRuntimeContext,
  allDestinations: PlannerDestination[],
  shortlisted: ReturnType<typeof shortlistDestinations>,
  options?: PlannerProviderOptions
): Promise<PlannerEngineOutput | null> {
  const candidateDestinations = shortlisted.map((item) => item.destination);
  let aiDecision: AiPlannerDecision | null = null;

  const v2Result = await generateTravelPlan({
    input,
    context,
    candidates: candidateDestinations
  });
  if (v2Result.ok && v2Result.data) {
    aiDecision = v2Result.data.plannerDecision as AiPlannerDecision;
  }

  if (!aiDecision) {
    aiDecision = await generateAiPlannerPlan(input, context, candidateDestinations);
  }
  if (!aiDecision) return null;

  const providerOptions = {
    ...options,
    origin: input.origin,
    referenceLocation: input.destinationQuery?.trim() || options?.referenceLocation || input.origin,
    forceMock: options?.forceMock || input.includeLiveSignals === false
  };

  const debugProfileKey: PlannerProfileKey = shortlisted[0]?.profileKey ?? "default";
  const candidateMap = new Map(candidateDestinations.map((destination) => [destination.id, destination]));
  const selectedIds = [...new Set(aiDecision.response.recommendations.map((item) => item.destinationId))];
  const selectedDestinations = selectedIds
    .map((destinationId) => candidateMap.get(destinationId))
    .filter((destination): destination is PlannerDestination => Boolean(destination));

  const enrichedDestinations =
    selectedDestinations.length > 0
      ? await enrichDestinationsWithLiveSignals(selectedDestinations, context, providerOptions)
      : [];

  const destinationMap = new Map(enrichedDestinations.map((destination) => [destination.id, destination]));
  const filteredOut: Array<{ destinationId: string; destinationName: string; reasons: string[] }> = [];
  const rankedPlans: RankedPlan[] = [];

  for (const item of aiDecision.response.recommendations) {
    const recommendation = item as AiPlannerRecommendation;
    const destination = destinationMap.get(recommendation.destinationId) ?? candidateMap.get(recommendation.destinationId);
    if (!destination) {
      filteredOut.push({
        destinationId: recommendation.destinationId,
        destinationName: recommendation.destinationId,
        reasons: ["AI 返回的景点不在当前候选列表中，已跳过。"]
      });
      continue;
    }

    if (context.user.destinationQuery && !matchesDestinationConstraint(destination, context.user.destinationQuery)) {
      filteredOut.push({
        destinationId: destination.id,
        destinationName: destination.name,
        reasons: [`该景点与目的地“${context.user.destinationQuery}”不匹配，已从 AI 结果中移除。`]
      });
      continue;
    }

    rankedPlans.push(buildPlanFromAiRecommendation(recommendation, destination, context));
  }

  if (rankedPlans.length === 0) return null;

  const verificationResult = await verifyRankedPlansOpeningHours(rankedPlans);
  const finalPlans = verificationResult.availablePlans.length > 0 ? [...verificationResult.availablePlans] : [...rankedPlans];
  filteredOut.push(...verificationResult.closedPlans);

  if (finalPlans.length < 3) {
    const existingIds = new Set(finalPlans.map((plan) => plan.destinationId));
    finalPlans.push(
      ...shortlisted
        .filter((item) => !existingIds.has(item.destination.id))
        .map((item) => item.plan)
        .sort((left, right) => right.totalScore - left.totalScore)
        .slice(0, 3 - finalPlans.length)
    );
  }

  for (let index = 0; index < finalPlans.length; index += 1) {
    const current = finalPlans[index];
    const supportingDestinations = finalPlans.filter((item) => item.destinationId !== current.destinationId).map((item) => item.mappedDestination);
    current.transportSummary = buildTransportRecommendation(current.mappedDestination, context);
    current.lodgingSummary = buildLodgingRecommendation(current.mappedDestination, context, supportingDestinations[0] ?? null);
    current.diningSummary = buildDiningRecommendation(current.mappedDestination);
    if (shouldRegenerateItinerary(current.itinerary, context.user.days)) {
      current.itinerary = generateItinerary(current.mappedDestination, context, supportingDestinations);
    }
    if (!current.rankingReason.length) current.rankingReason = buildRankingReason(current, context);
    if (!current.whyFitUser.length) current.whyFitUser = buildUserFitReasons(current.mappedDestination, context);
    current.alternativeOptions = buildAlternativeOptions(supportingDestinations);
  }

  return {
    recommendedPlans: finalPlans.slice(0, 5),
    readableSummary: {
      headline: aiDecision.response.headline,
      recommendation: aiDecision.response.recommendation,
      dynamicImpact: aiDecision.response.dynamicImpact,
      cautions: aiDecision.response.cautions,
      alternatives:
        aiDecision.response.alternatives.length > 0
          ? aiDecision.response.alternatives
          : buildAlternativeOptions(finalPlans.slice(1).map((plan) => plan.mappedDestination)).map((item) => `${item.destinationName}：${item.reason}`)
    },
    runtimeInsights: buildRuntimeInsightsForUi(context, {
      weather: aiDecision.response.weatherSummary,
      traffic: aiDecision.response.trafficSummary
    }),
    summaryMeta: {
      source: "ai",
      provider: aiDecision.provider,
      candidateCount: allDestinations.length,
      enrichedCount: enrichedDestinations.length
    },
    debug: {
      filteredOut,
      profileKey: debugProfileKey
    }
  };
}

async function runRulePlannerEngineFallback(
  input: PlannerApiInput,
  context: PlannerRuntimeContext,
  allDestinations: PlannerDestination[],
  shortlisted: ReturnType<typeof shortlistDestinations>,
  options?: PlannerProviderOptions
): Promise<PlannerEngineOutput> {
  const providerOptions = {
    ...options,
    origin: input.origin,
    referenceLocation: input.destinationQuery?.trim() || options?.referenceLocation || input.origin,
    forceMock: options?.forceMock || input.includeLiveSignals === false
  };

  const destinations = await enrichDestinationsWithLiveSignals(
    shortlisted.map((item) => item.destination),
    context,
    providerOptions
  );

  const filteredOut: Array<{ destinationId: string; destinationName: string; reasons: string[] }> = [];
  const ranked: RankedPlan[] = [];
  const fallbackPlans: RankedPlan[] = [];
  let debugProfileKey: PlannerProfileKey = shortlisted[0]?.profileKey ?? "default";

  for (const destination of destinations) {
    const filterDecision = evaluateHardFilters(destination, context);
    const { plan, profileKey } = buildRankedPlan(destination, context, filterDecision);
    debugProfileKey = profileKey;

    if (!filterDecision.passed) {
      filteredOut.push({
        destinationId: destination.id,
        destinationName: destination.name,
        reasons: filterDecision.rejectionReasons
      });
      if (canUseAsFallback(plan)) {
        fallbackPlans.push({
          ...plan,
          risks: [...plan.risks, ...filterDecision.rejectionReasons]
        });
      }
      continue;
    }

    ranked.push(plan);
  }

  ranked.sort((a, b) => b.totalScore - a.totalScore);
  fallbackPlans.sort((a, b) => {
    const reasonGap = a.filterDecision.rejectionReasons.length - b.filterDecision.rejectionReasons.length;
    if (reasonGap !== 0) return reasonGap;
    return b.totalScore - a.totalScore;
  });

  const plansForVerification = ranked.length > 0 ? ranked : fallbackPlans.slice(0, 5);
  const verificationResult = await verifyRankedPlansOpeningHours(plansForVerification);
  ranked.length = 0;
  ranked.push(...verificationResult.availablePlans);
  filteredOut.push(...verificationResult.closedPlans);

  if (ranked.length === 0 && fallbackPlans.length > 0) {
    const verifiedIds = new Set(ranked.map((item) => item.destinationId));
    ranked.push(...fallbackPlans.filter((item) => !verifiedIds.has(item.destinationId)).slice(0, 5));
  }

  for (let index = 0; index < ranked.length; index += 1) {
    const current = ranked[index];
    const supportingDestinations = ranked.filter((item) => item.destinationId !== current.destinationId).map((item) => item.mappedDestination);
    current.transportSummary = buildTransportRecommendation(current.mappedDestination, context);
    current.lodgingSummary = buildLodgingRecommendation(current.mappedDestination, context, supportingDestinations[0] ?? null);
    current.diningSummary = buildDiningRecommendation(current.mappedDestination);
    current.itinerary = generateItinerary(current.mappedDestination, context, supportingDestinations);
    current.rankingReason = buildRankingReason(current, context);
    current.whyFitUser = buildUserFitReasons(current.mappedDestination, context);
    current.alternativeOptions = buildAlternativeOptions(supportingDestinations);
  }

  const output: PlannerEngineOutput = {
    recommendedPlans: ranked.slice(0, 5),
    readableSummary: {
      headline: "",
      recommendation: [],
      dynamicImpact: [],
      cautions: [],
      alternatives: []
    },
    runtimeInsights: buildRuntimeInsightsForUi(context),
    summaryMeta: {
      source: "rules",
      provider: null,
      candidateCount: allDestinations.length,
      enrichedCount: destinations.length
    },
    debug: {
      filteredOut,
      profileKey: debugProfileKey
    }
  };

  output.readableSummary = buildReadableSummary(output, context);

  const aiSummary = await buildAiReadablePlannerSummary(input, output, context);
  if (aiSummary) {
    output.readableSummary = aiSummary.summary;
    output.summaryMeta = {
      ...(output.summaryMeta || {}),
      source: "ai",
      provider: aiSummary.provider
    };
  }

  return output;
}

export async function runPlannerEngine(input: PlannerApiInput, spots: RuralSpotSeed[], options?: PlannerProviderOptions): Promise<PlannerEngineOutput> {
  const context = await buildRuntimeContext(input, options);
  const allDestinations = filterDestinationsByDestinationQuery(collectDestinations(spots), input.destinationQuery);

  if (allDestinations.length === 0) {
    const destinationQuery = input.destinationQuery?.trim();
    return {
      recommendedPlans: [],
      readableSummary: {
        ...(destinationQuery
          ? {
              headline: `暂未命中“${destinationQuery}”相关景点`,
              recommendation: [`当前数据里没有命中与你填写的目的地“${destinationQuery}”相关的景点，因此这次不会回退推荐其他城市。你可以换一个更具体的景点、区县或周边区域关键词后再试。`]
            }
          : {
              headline: "暂未找到可用目的地",
              recommendation: ["当前数据里没有命中你的目的地或筛选条件。建议换一个区域关键词，或先清空目的地后再试。"]
            }),
        dynamicImpact: [],
        cautions: [],
        alternatives: []
      },
      runtimeInsights: buildRuntimeInsightsForUi(context),
      summaryMeta: {
        source: "rules",
        provider: null,
        candidateCount: 0,
        enrichedCount: 0
      },
      debug: {
        filteredOut: [],
        profileKey: "default"
      }
    };
  }

  const shortlisted = shortlistDestinations(allDestinations, context);
  const aiOutput = await buildAiDrivenOutput(input, context, allDestinations, shortlisted, options);
  if (aiOutput) return aiOutput;

  return runRulePlannerEngineFallback(input, context, allDestinations, shortlisted, options);
}
