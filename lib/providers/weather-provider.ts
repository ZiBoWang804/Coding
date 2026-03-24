import mockWeather from "@/data/mock-weather.json";
import type { PlannerProviderOptions, WeatherContext } from "@/lib/planner/types";
import { getAmapWeather, geocodePlace, hasAmapWebServiceKey } from "@/lib/providers/amap-web-service";

const weatherMap = mockWeather.defaultByDate as Record<string, WeatherContext>;

function mapWeatherCondition(weatherText: string, temperatureHigh?: number | null, windLevel?: number | null): WeatherContext["condition"] {
  if (/雷/.test(weatherText)) return "thunder";
  if (/雪/.test(weatherText)) return "snow";
  if (/暴雨|大雨|特大暴雨/.test(weatherText)) return "heavy_rain";
  if (/雨/.test(weatherText)) return "light_rain";
  if (/雾|霾/.test(weatherText)) return "fog";
  if (temperatureHigh != null && temperatureHigh >= 34) return "heat";
  if (temperatureHigh != null && temperatureHigh <= 2) return "cold";
  if (windLevel != null && windLevel >= 6) return "windy";
  if (/阴|多云/.test(weatherText)) return "cloudy";
  return "sunny";
}

export async function getWeatherContext(travelDate: string, override?: Partial<WeatherContext>, options?: PlannerProviderOptions): Promise<WeatherContext> {
  const fallback = weatherMap[travelDate] || weatherMap["2026-03-22"];
  const shouldUseLive = hasAmapWebServiceKey() && !options?.forceMock;

  if (shouldUseLive) {
    const originGeo = await geocodePlace(options?.origin || "西安市", "西安");
    if (originGeo?.adcode) {
      const liveWeather = await getAmapWeather(originGeo.adcode, travelDate);
      if (liveWeather) {
        return {
          date: travelDate,
          condition: mapWeatherCondition(liveWeather.weatherText, liveWeather.temperatureHigh, liveWeather.windLevel),
          temperatureHigh: liveWeather.temperatureHigh,
          temperatureLow: liveWeather.temperatureLow,
          precipitationProbability: fallback.precipitationProbability,
          windLevel: liveWeather.windLevel,
          aqi: fallback.aqi,
          severeWeatherAlert: /雷|暴雨|雪/.test(liveWeather.weatherText),
          weatherSummary: `${originGeo.city || "目的地"} ${travelDate} 预计${liveWeather.weatherText}`,
          ...override
        };
      }
    }
  }

  return {
    ...fallback,
    ...override,
    date: travelDate,
    severeWeatherAlert: override?.severeWeatherAlert ?? fallback.severeWeatherAlert
  };
}
