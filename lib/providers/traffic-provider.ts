import mockTraffic from "@/data/mock-traffic.json";
import type { PlannerProviderOptions, TrafficContext } from "@/lib/planner/types";
import { geocodePlace, getTrafficCircleSummary, hasAmapWebServiceKey } from "@/lib/providers/amap-web-service";

const trafficMap = mockTraffic.defaultByDate as Record<string, TrafficContext>;

function isWeekend(travelDate: string) {
  const day = new Date(`${travelDate}T12:00:00+08:00`).getDay();
  return day === 0 || day === 6;
}

export async function getTrafficContext(travelDate: string, override?: Partial<TrafficContext>, options?: PlannerProviderOptions): Promise<TrafficContext> {
  const fallback = trafficMap[travelDate] || trafficMap["2026-03-22"];
  const shouldUseLive = hasAmapWebServiceKey() && !options?.forceMock;

  if (shouldUseLive) {
    const originGeo = await geocodePlace(options?.origin || "西安市", "西安");
    if (originGeo) {
      const liveTraffic = await getTrafficCircleSummary(originGeo.longitude, originGeo.latitude, 5000);
      if (liveTraffic) {
        return {
          isWeekend: override?.isWeekend ?? isWeekend(travelDate),
          isHoliday: override?.isHoliday ?? fallback.isHoliday,
          congestionLevel: override?.congestionLevel ?? liveTraffic.congestionLevel,
          roadClosureRisk: override?.roadClosureRisk ?? Math.min(5, liveTraffic.congestionLevel + (liveTraffic.statusText.includes("拥堵") ? 1 : 0)),
          parkingStress: override?.parkingStress ?? Math.min(5, Math.max(1, liveTraffic.congestionLevel)),
          nightReturnRisk: override?.nightReturnRisk ?? Math.min(5, Math.max(1, liveTraffic.congestionLevel - 1))
        };
      }
    }
  }

  return {
    ...fallback,
    ...override,
    isWeekend: override?.isWeekend ?? fallback.isWeekend,
    isHoliday: override?.isHoliday ?? fallback.isHoliday
  };
}
