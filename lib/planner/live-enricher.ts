import { buildFallbackRoutePlans } from "@/lib/transit-guide";
import { getDrivingRoutePlan, getTrafficCircleSummary, getTransitRoutePlan, geocodePlace, hasAmapWebServiceKey } from "@/lib/providers/amap-web-service";
import { evaluateOpeningStatus } from "@/lib/planner/opening-hours";
import { fetchVerifiedOpeningInfo } from "@/lib/planner/opening-hours-scraper";
import type { PlannerDestination, PlannerProviderOptions, PlannerRuntimeContext, RankedPlan } from "@/lib/planner/types";

function uniqueStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function appendText(base: string | null | undefined, extra: string) {
  return [base?.trim(), extra.trim()].filter(Boolean).join(" ");
}

function deriveCrowdLevelFromTraffic(level: number, current: number | null | undefined) {
  if (level >= 5) return 5;
  if (level === 4) return Math.max(current ?? 3, 4);
  if (level === 3) return Math.max(current ?? 3, 3);
  return current ?? 3;
}

function appendDynamicRisk(destination: PlannerDestination, message: string) {
  destination.cautionNotes = uniqueStrings([...destination.cautionNotes, message]);
}

function choosePrimaryRoutePlan(destination: PlannerDestination, context: PlannerRuntimeContext) {
  if (!destination.routePlans?.length) return null;
  if (context.user.transportMode === "public_transit") {
    return destination.routePlans.find((plan) => plan.mode === "public_transit") ?? destination.routePlans[0];
  }
  if (context.user.transportMode === "self_drive") {
    return destination.routePlans.find((plan) => plan.mode === "self_drive") ?? destination.routePlans[0];
  }
  return [...destination.routePlans].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
}

function formatTravelSummary(context: PlannerRuntimeContext, durationMinutes: number, distanceKm: number) {
  const modeLabel =
    context.user.transportMode === "public_transit"
      ? "公共交通"
      : context.user.transportMode === "self_drive"
        ? "自驾"
        : "推荐路线";

  return `${modeLabel}参考：从 ${context.user.origin} 出发约 ${durationMinutes} 分钟，约 ${distanceKm} 公里。`;
}

async function buildRoutePlans(destination: PlannerDestination, context: PlannerRuntimeContext, originGeo: Awaited<ReturnType<typeof geocodePlace>> | null) {
  if (!originGeo || destination.latitude == null || destination.longitude == null) {
    return buildFallbackRoutePlans(context.user.origin, destination);
  }

  const origin = `${originGeo.longitude},${originGeo.latitude}`;
  const destinationCoord = `${destination.longitude},${destination.latitude}`;
  const routePlans = [];

  if (context.user.transportMode !== "public_transit") {
    const drivingPlan = await getDrivingRoutePlan(origin, destinationCoord);
    if (drivingPlan) routePlans.push(drivingPlan);
  }

  if (context.user.transportMode !== "self_drive") {
    const transitPlan = await getTransitRoutePlan(origin, destinationCoord, originGeo.city, destination.city);
    if (transitPlan) routePlans.push(transitPlan);
  }

  if (routePlans.length) return routePlans;
  return buildFallbackRoutePlans(context.user.origin, destination);
}

async function enrichSingleDestination(
  destination: PlannerDestination,
  context: PlannerRuntimeContext,
  originGeo: Awaited<ReturnType<typeof geocodePlace>> | null
) {
  const nextDestination: PlannerDestination = {
    ...destination,
    scenicFeatures: [...destination.scenicFeatures],
    tags: [...destination.tags],
    originalTags: [...destination.originalTags],
    suitableCrowds: [...destination.suitableCrowds],
    photoUrls: [...destination.photoUrls],
    photoSourceUrls: [...destination.photoSourceUrls],
    cautionNotes: [...destination.cautionNotes],
    seasonalWarnings: [...destination.seasonalWarnings],
    closureRiskNotes: [...destination.closureRiskNotes],
    routePlans: destination.routePlans ? [...destination.routePlans] : [],
    transportLinks: destination.transportLinks ? { ...destination.transportLinks } : undefined
  };

  const openingInfo = evaluateOpeningStatus(nextDestination, context.user.travelDate);
  nextDestination.openStatus = openingInfo.status;
  nextDestination.openingHoursText = openingInfo.openingHoursText;
  if (openingInfo.status === "closed" && openingInfo.note) {
    nextDestination.closureRiskNotes = uniqueStrings([...nextDestination.closureRiskNotes, openingInfo.note]);
  } else if (openingInfo.note) {
    appendDynamicRisk(nextDestination, openingInfo.note);
  }

  nextDestination.routePlans = await buildRoutePlans(nextDestination, context, originGeo);

  const primaryRoutePlan = choosePrimaryRoutePlan(nextDestination, context);
  if (primaryRoutePlan) {
    nextDestination.liveTravelMinutes = primaryRoutePlan.durationMinutes;
    nextDestination.liveDistanceKm = primaryRoutePlan.distanceKm;
    nextDestination.transportSummary = appendText(
      nextDestination.transportSummary,
      formatTravelSummary(context, primaryRoutePlan.durationMinutes, primaryRoutePlan.distanceKm)
    );

    if (context.user.days === 1 && primaryRoutePlan.durationMinutes >= 150) {
      nextDestination.roadRiskLevel = Math.max(nextDestination.roadRiskLevel || 2, 4);
      appendDynamicRisk(nextDestination, "当前路线预计耗时偏长，当天往返会比较赶。");
    }

    if (primaryRoutePlan.mode === "public_transit" && primaryRoutePlan.durationMinutes >= 120) {
      nextDestination.lastMileDifficulty = Math.max(nextDestination.lastMileDifficulty || 2, 4);
      appendDynamicRisk(nextDestination, "公共交通方案换乘时间较长，建议预留缓冲并关注返程时间。");
    }
  }

  if (hasAmapWebServiceKey() && nextDestination.latitude != null && nextDestination.longitude != null) {
    const traffic = await getTrafficCircleSummary(nextDestination.longitude, nextDestination.latitude);
    if (traffic) {
      nextDestination.liveTrafficStatus = traffic.statusText;
      nextDestination.crowdLevel = deriveCrowdLevelFromTraffic(traffic.congestionLevel, nextDestination.crowdLevel);

      if (traffic.congestionLevel >= 4) {
        nextDestination.roadRiskLevel = Math.max(nextDestination.roadRiskLevel || 2, 4);
        nextDestination.parkingConvenience = Math.min(nextDestination.parkingConvenience || 3, 2);
        appendDynamicRisk(nextDestination, `实时路况显示景区周边${traffic.statusText}，停车和进出场时间可能增加。`);
      } else if (traffic.description) {
        appendDynamicRisk(nextDestination, `实时路况参考：${traffic.description}`);
      }
    }
  }

  return nextDestination;
}

export async function enrichDestinationsWithLiveSignals(
  destinations: PlannerDestination[],
  context: PlannerRuntimeContext,
  options?: PlannerProviderOptions
) {
  const originGeo = hasAmapWebServiceKey() && !options?.forceMock ? await geocodePlace(options?.origin || context.user.origin, "西安") : null;

  const enriched: PlannerDestination[] = [];
  for (const destination of destinations) {
    enriched.push(await enrichSingleDestination(destination, context, originGeo));
  }
  return enriched;
}

export async function verifyRankedPlansOpeningHours(plans: RankedPlan[]) {
  const checks = await Promise.all(
    plans.slice(0, 5).map(async (plan) => ({
      plan,
      verification: await fetchVerifiedOpeningInfo(plan.mappedDestination)
    }))
  );

  const availablePlans: RankedPlan[] = [];
  const closedPlans: Array<{ destinationId: string; destinationName: string; reasons: string[] }> = [];

  for (const item of checks) {
    const { plan, verification } = item;
    if (!verification) {
      availablePlans.push(plan);
      continue;
    }

    plan.mappedDestination.openingHoursText = verification.openingHoursText;
    plan.mappedDestination.openStatus = verification.openStatus;
    plan.mappedDestination.openingSourceUrl = verification.sourceUrl;
    plan.mappedDestination.openingVerifiedAt = verification.verifiedAt;
    plan.mappedDestination.openingVerificationNote = verification.note;

    if (verification.note) {
      plan.risks = uniqueStrings([...plan.risks, verification.note]);
    }

    if (verification.openStatus === "closed") {
      closedPlans.push({
        destinationId: plan.destinationId,
        destinationName: plan.destinationName,
        reasons: [`外部页面校验显示计划日期可能闭园：${verification.openingHoursText}`]
      });
      continue;
    }

    availablePlans.push(plan);
  }

  if (plans.length > 5) {
    availablePlans.push(...plans.slice(5));
  }

  return { availablePlans, closedPlans };
}
