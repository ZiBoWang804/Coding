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

function getSeason(travelDate: string) {
  const month = new Date(`${travelDate}T12:00:00+08:00`).getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function buildDaySeed(travelDate: string, salt = 0) {
  const [year, month, day] = travelDate.split("-").map((item) => Number(item) || 0);
  return year * 372 + month * 31 + day + salt;
}

function buildChineseWeatherSummary(
  targetName: string,
  travelDate: string,
  condition: WeatherContext["condition"],
  temperatureHigh?: number | null,
  temperatureLow?: number | null
) {
  const parts = [`${targetName} ${travelDate} 天气参考：${WEATHER_LABELS[condition]}`];
  if (temperatureLow != null && temperatureHigh != null) {
    parts.push(`气温约 ${temperatureLow}°C - ${temperatureHigh}°C`);
  } else if (temperatureHigh != null) {
    parts.push(`最高约 ${temperatureHigh}°C`);
  }
  return parts.join("，");
}

function buildSyntheticWeatherContext(travelDate: string): WeatherContext {
  const season = getSeason(travelDate);
  const seed = buildDaySeed(travelDate);
  const weekend = new Date(`${travelDate}T12:00:00+08:00`).getDay() % 6 === 0;

  const seasonalProfiles: Record<string, WeatherContext["condition"][]> = {
    spring: ["sunny", "cloudy", "light_rain", "cloudy"],
    summer: ["sunny", "heat", "light_rain", "thunder"],
    autumn: ["sunny", "cloudy", "windy", "light_rain"],
    winter: ["sunny", "cold", "windy", "snow"]
  };

  const baseTemperature: Record<string, { high: number; low: number }> = {
    spring: { high: 22, low: 11 },
    summer: { high: 33, low: 24 },
    autumn: { high: 24, low: 14 },
    winter: { high: 8, low: -1 }
  };

  const profile = seasonalProfiles[season];
  const condition = profile[seed % profile.length];
  const temperatureNudge = (seed % 5) - 2;
  const high = baseTemperature[season].high + temperatureNudge + (condition === "heat" ? 3 : 0) - (condition === "cold" ? 2 : 0);
  const low = baseTemperature[season].low + Math.max(-3, temperatureNudge - 1) - (condition === "cold" ? 2 : 0);
  const precipitationProbability =
    condition === "thunder"
      ? 78
      : condition === "heavy_rain"
        ? 68
        : condition === "light_rain"
          ? 48
          : condition === "snow"
            ? 56
            : condition === "cloudy"
              ? 24
              : 12;
  const windLevel = condition === "windy" ? 6 : condition === "thunder" ? 5 : 2 + (seed % 2);
  const aqiBase = season === "winter" ? 92 : season === "summer" ? 78 : 68;

  return {
    date: travelDate,
    condition,
    temperatureHigh: high,
    temperatureLow: low,
    precipitationProbability,
    windLevel,
    aqi: aqiBase + ((seed + (weekend ? 3 : 0)) % 16),
    severeWeatherAlert: condition === "thunder" || condition === "snow",
    weatherSummary: buildChineseWeatherSummary("目的地", travelDate, condition, high, low)
  };
}

function mapWeatherCondition(
  weatherText: string,
  temperatureHigh?: number | null,
  windLevel?: number | null
): WeatherContext["condition"] {
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

export async function getWeatherContext(
  travelDate: string,
  override?: Partial<WeatherContext>,
  options?: PlannerProviderOptions
): Promise<WeatherContext> {
  const fallback = weatherMap[travelDate] || buildSyntheticWeatherContext(travelDate);
  const shouldUseLive = hasAmapWebServiceKey() && !options?.forceMock;
  const referenceLocation = options?.referenceLocation || options?.origin || "西安市";

  if (shouldUseLive) {
    const originGeo = await geocodePlace(referenceLocation);
    if (originGeo?.adcode) {
      const liveWeather = await getAmapWeather(originGeo.adcode, travelDate);
      const condition = mapWeatherCondition(
        liveWeather?.weatherText || "",
        liveWeather?.temperatureHigh,
        liveWeather?.windLevel
      );

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
          weatherSummary: buildChineseWeatherSummary(
            originGeo.city || referenceLocation || "目的地",
            travelDate,
            condition,
            liveWeather.temperatureHigh,
            liveWeather.temperatureLow
          ),
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
      buildChineseWeatherSummary(
        referenceLocation || "目的地",
        travelDate,
        fallback.condition,
        fallback.temperatureHigh,
        fallback.temperatureLow
      ),
    severeWeatherAlert: override?.severeWeatherAlert ?? fallback.severeWeatherAlert
  };
}
