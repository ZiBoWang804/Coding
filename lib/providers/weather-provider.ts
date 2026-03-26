import mockWeather from "@/data/mock-weather.json";
import type { PlannerProviderOptions, WeatherContext } from "@/lib/planner/types";
import { getAmapWeather, geocodePlace, hasAmapWebServiceKey } from "@/lib/providers/amap-web-service";

const weatherMap = mockWeather.defaultByDate as Record<string, WeatherContext>;

const WEATHER_LABELS: Record<WeatherContext["condition"], string> = {
  sunny: "晴朗",
  cloudy: "多云",
  light_rain: "小雨",
  heavy_rain: "大雨",
  thunder: "雷雨",
  snow: "降雪",
  fog: "雾霾",
  heat: "炎热",
  cold: "寒冷",
  windy: "大风"
};

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

function buildChineseWeatherSummary(targetName: string, travelDate: string, condition: WeatherContext["condition"], temperatureHigh?: number | null, temperatureLow?: number | null) {
  const parts = [`${targetName} ${travelDate} 天气参考：${WEATHER_LABELS[condition]}`];
  if (temperatureLow != null && temperatureHigh != null) {
    parts.push(`气温约 ${temperatureLow}°C - ${temperatureHigh}°C`);
  } else if (temperatureHigh != null) {
    parts.push(`最高约 ${temperatureHigh}°C`);
  }
  return parts.join("，");
}

export async function getWeatherContext(travelDate: string, override?: Partial<WeatherContext>, options?: PlannerProviderOptions): Promise<WeatherContext> {
  const fallback = weatherMap[travelDate] || weatherMap["2026-03-22"];
  const shouldUseLive = hasAmapWebServiceKey() && !options?.forceMock;
  const referenceLocation = options?.referenceLocation || options?.origin || "西安市";

  if (shouldUseLive) {
    const originGeo = await geocodePlace(referenceLocation);
    if (originGeo?.adcode) {
      const liveWeather = await getAmapWeather(originGeo.adcode, travelDate);
      const condition = mapWeatherCondition(liveWeather?.weatherText || "", liveWeather?.temperatureHigh, liveWeather?.windLevel);
      if (liveWeather) {
        return {
          date: travelDate,
          condition,
          temperatureHigh: liveWeather.temperatureHigh,
          temperatureLow: liveWeather.temperatureLow,
          precipitationProbability: fallback.precipitationProbability,
          windLevel: liveWeather.windLevel,
          aqi: fallback.aqi,
          severeWeatherAlert: /雷|暴雨|雪/.test(liveWeather.weatherText),
          weatherSummary: buildChineseWeatherSummary(originGeo.city || referenceLocation || "目的地", travelDate, condition, liveWeather.temperatureHigh, liveWeather.temperatureLow),
          ...override
        };
      }
    }
  }

  return {
    ...fallback,
    ...override,
    date: travelDate,
    weatherSummary:
      override?.weatherSummary ||
      buildChineseWeatherSummary(referenceLocation || "目的地", travelDate, fallback.condition, fallback.temperatureHigh, fallback.temperatureLow),
    severeWeatherAlert: override?.severeWeatherAlert ?? fallback.severeWeatherAlert
  };
}
