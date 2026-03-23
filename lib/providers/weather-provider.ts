import mockWeather from "@/data/mock-weather.json";
import type { PlannerProviderOptions, WeatherContext } from "@/lib/planner/types";

const weatherMap = mockWeather.defaultByDate as Record<string, WeatherContext>;

export async function getWeatherContext(travelDate: string, override?: Partial<WeatherContext>, _options?: PlannerProviderOptions): Promise<WeatherContext> {
  const fallback = weatherMap[travelDate] || weatherMap["2026-03-22"];
  return {
    ...fallback,
    ...override,
    date: travelDate,
    severeWeatherAlert: override?.severeWeatherAlert ?? fallback.severeWeatherAlert
  };
}
