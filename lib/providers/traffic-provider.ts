import mockTraffic from "@/data/mock-traffic.json";
import type { PlannerProviderOptions, TrafficContext } from "@/lib/planner/types";

const trafficMap = mockTraffic.defaultByDate as Record<string, TrafficContext>;

export async function getTrafficContext(travelDate: string, override?: Partial<TrafficContext>, _options?: PlannerProviderOptions): Promise<TrafficContext> {
  const fallback = trafficMap[travelDate] || trafficMap["2026-03-22"];
  return {
    ...fallback,
    ...override,
    isWeekend: override?.isWeekend ?? fallback.isWeekend,
    isHoliday: override?.isHoliday ?? fallback.isHoliday
  };
}
