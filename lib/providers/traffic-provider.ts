import mockTraffic from "@/data/mock-traffic.json";
import type { PlannerProviderOptions, TrafficContext } from "@/lib/planner/types";
import { geocodePlace, getTrafficCircleSummary, hasAmapWebServiceKey } from "@/lib/providers/amap-web-service";

const trafficMap = mockTraffic.defaultByDate as Record<string, TrafficContext>;

function isWeekend(travelDate: string) {
  const day = new Date(`${travelDate}T12:00:00+08:00`).getDay();
  return day === 0 || day === 6;
}

function buildDaySeed(travelDate: string, salt = 0) {
  const [year, month, day] = travelDate.split("-").map((item) => Number(item) || 0);
  return year * 372 + month * 31 + day + salt;
}

function buildSyntheticTrafficContext(travelDate: string): TrafficContext {
  const weekend = isWeekend(travelDate);
  const month = new Date(`${travelDate}T12:00:00+08:00`).getMonth() + 1;
  const seed = buildDaySeed(travelDate, 11);
  const peakTravelSeason = month === 5 || month === 7 || month === 8 || month === 10;
  const holiday = peakTravelSeason && (weekend || seed % 7 === 0);
  const congestionBase = weekend ? 3 : 2;
  const seasonalBump = peakTravelSeason ? 1 : 0;
  const congestionLevel = Math.min(5, congestionBase + seasonalBump + (seed % 2));

  return {
    isWeekend: weekend,
    isHoliday: holiday,
    congestionLevel,
    roadClosureRisk: Math.min(5, 1 + (month === 7 || month === 8 ? 1 : 0) + (month <= 2 ? 1 : 0) + (seed % 2)),
    parkingStress: Math.min(5, congestionLevel + (holiday ? 1 : 0)),
    nightReturnRisk: Math.min(5, Math.max(1, congestionLevel - 1 + (holiday ? 1 : 0)))
  };
}

export async function getTrafficContext(
  travelDate: string,
  override?: Partial<TrafficContext>,
  options?: PlannerProviderOptions
): Promise<TrafficContext> {
  const fallback = trafficMap[travelDate] || buildSyntheticTrafficContext(travelDate);
  const shouldUseLive = hasAmapWebServiceKey() && !options?.forceMock;
  const referenceLocation = options?.referenceLocation || options?.origin || "西安市";

  if (shouldUseLive) {
    const originGeo = await geocodePlace(referenceLocation);
    if (originGeo) {
      const liveTraffic = await getTrafficCircleSummary(originGeo.longitude, originGeo.latitude, 5000);
      if (liveTraffic) {
        return {
          isWeekend: override?.isWeekend ?? isWeekend(travelDate),
          isHoliday: override?.isHoliday ?? fallback.isHoliday,
          congestionLevel: override?.congestionLevel ?? liveTraffic.congestionLevel,
          roadClosureRisk:
            override?.roadClosureRisk ??
            Math.min(5, liveTraffic.congestionLevel + (liveTraffic.statusText.includes("拥堵") ? 1 : 0)),
          parkingStress: override?.parkingStress ?? Math.min(5, Math.max(1, liveTraffic.congestionLevel)),
          nightReturnRisk: override?.nightReturnRisk ?? Math.min(5, Math.max(1, liveTraffic.congestionLevel - 1))
        };
      }
    }
  }

  return {
    ...fallback,
    ...override,
    isWeekend: override?.isWeekend ?? isWeekend(travelDate),
    isHoliday: override?.isHoliday ?? fallback.isHoliday
  };
}
