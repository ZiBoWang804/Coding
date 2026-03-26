const AMAP_BASE_URL = "https://restapi.amap.com/v3";
const AMAP_MEMORY_CACHE = new Map<string, { expiresAt: number; value: unknown }>();

type AmapBaseResponse = {
  status?: string;
  info?: string;
  infocode?: string;
};

type AmapGeocodeResponse = AmapBaseResponse & {
  geocodes?: Array<{
    formatted_address?: string;
    city?: string | string[];
    district?: string;
    adcode?: string;
    location?: string;
  }>;
};

type AmapWeatherResponse = AmapBaseResponse & {
  lives?: Array<{
    weather?: string;
    temperature?: string;
    windpower?: string;
    reporttime?: string;
  }>;
  forecasts?: Array<{
    casts?: Array<{
      date?: string;
      dayweather?: string;
      nightweather?: string;
      daytemp?: string;
      nighttemp?: string;
      daypower?: string;
      nightpower?: string;
    }>;
  }>;
};

type AmapDrivingResponse = AmapBaseResponse & {
  route?: {
    paths?: Array<{
      distance?: string;
      duration?: string;
      traffic_lights?: string;
      steps?: Array<{
        instruction?: string;
        orientation?: string;
        road?: string;
        distance?: string;
        duration?: string;
        action?: string;
        assistant_action?: string;
      }>;
    }>;
  };
};

type AmapTransitResponse = AmapBaseResponse & {
  route?: {
    transits?: Array<{
      distance?: string;
      duration?: string;
      walking_distance?: string;
      cost?: string;
      nightflag?: string;
      segments?: Array<{
        walking?: {
          distance?: string;
          duration?: string;
          steps?: Array<{
            instruction?: string;
            distance?: string;
            duration?: string;
          }>;
        };
        bus?: {
          buslines?: Array<{
            name?: string;
            departure_stop?: { name?: string };
            arrival_stop?: { name?: string };
            via_num?: string;
            duration?: string;
            type?: string;
          }>;
        };
        railway?: {
          trip?: string;
          time?: string;
          departure_stop?: { name?: string };
          arrival_stop?: { name?: string };
        };
        taxi?: {
          distance?: string;
          duration?: string;
        };
      }>;
    }>;
  };
};

type AmapTrafficResponse = AmapBaseResponse & {
  trafficinfo?: {
    description?: string;
    evaluation?: {
      status?: string;
      description?: string;
    };
    roads?: Array<{
      status?: string;
    }>;
  };
};

export type AmapGeocodeResult = {
  latitude: number;
  longitude: number;
  adcode: string | null;
  formattedAddress: string | null;
  city: string | null;
  district: string | null;
};

export type AmapWeatherResult = {
  date: string;
  weatherText: string;
  temperatureHigh: number | null;
  temperatureLow: number | null;
  windLevel: number | null;
  reportTime: string | null;
};

export type AmapRouteStepResult = {
  mode: "walk" | "bus" | "subway" | "drive" | "taxi" | "railway";
  title: string;
  detail: string;
  durationMinutes?: number | null;
  distanceKm?: number | null;
  stops?: number | null;
};

export type AmapRoutePlanResult = {
  mode: "self_drive" | "public_transit";
  summary: string;
  durationMinutes: number;
  distanceKm: number;
  walkingDistanceKm?: number | null;
  cost?: number | null;
  steps: AmapRouteStepResult[];
  caution?: string | null;
};

export type AmapTrafficResult = {
  statusText: string;
  description: string | null;
  congestionLevel: number;
};

function getAmapWebServiceKey() {
  return process.env.AMAP_WEB_SERVICE_KEY?.trim() || process.env.AMAP_KEY?.trim() || "";
}

export function hasAmapWebServiceKey() {
  return Boolean(getAmapWebServiceKey());
}

function toNumber(value?: string | number | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toKm(value?: string | number | null) {
  const numeric = toNumber(value);
  return numeric == null ? null : Number((numeric / 1000).toFixed(1));
}

function toMinutes(value?: string | number | null) {
  const numeric = toNumber(value);
  return numeric == null ? null : Math.max(1, Math.round(numeric / 60));
}

function buildCacheKey(scope: string, params: Record<string, string | number | undefined>) {
  const normalized = Object.entries(params)
    .filter(([, value]) => value != null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));
  return `${scope}:${JSON.stringify(normalized)}`;
}

async function withAmapCache<T>(key: string, ttlMs: number, loader: () => Promise<T | null>) {
  const cached = AMAP_MEMORY_CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const value = await loader();
  if (value != null) {
    AMAP_MEMORY_CACHE.set(key, {
      expiresAt: Date.now() + ttlMs,
      value
    });
  }

  return value;
}

function buildUrl(pathname: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  searchParams.set("key", getAmapWebServiceKey());

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    searchParams.set(key, String(value));
  }

  return `${AMAP_BASE_URL}${pathname}?${searchParams.toString()}`;
}

async function requestAmap<T extends AmapBaseResponse>(pathname: string, params: Record<string, string | number | undefined>) {
  if (!hasAmapWebServiceKey()) return null;

  try {
    const response = await fetch(buildUrl(pathname, params), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as T;
    if (payload.status !== "1") return null;
    return payload;
  } catch {
    return null;
  }
}

function normalizeCity(city?: string | string[]) {
  if (Array.isArray(city)) return city[0] ?? null;
  return city || null;
}

function parseLocation(location?: string) {
  if (!location) return null;
  const [longitudeText, latitudeText] = location.split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { longitude, latitude };
}

function compact(parts: Array<string | null | undefined>) {
  return parts.map((item) => item?.trim()).filter(Boolean) as string[];
}

function normalizeBusLineName(name?: string) {
  if (!name) return "公交线路";
  return name.replace(/\s+/g, " ").trim();
}

function extractLineDirection(name?: string) {
  if (!name) return null;
  const match = name.match(/[（(]([^()（）]+)[)）]/);
  return match?.[1]?.trim() ?? null;
}

export async function geocodePlace(keyword: string, city?: string) {
  return withAmapCache(buildCacheKey("geocode", { keyword, city }), 24 * 60 * 60 * 1000, async () => {
    const payload = await requestAmap<AmapGeocodeResponse>("/geocode/geo", { address: keyword, city });
    const geocode = payload?.geocodes?.[0];
    const location = parseLocation(geocode?.location);
    if (!geocode || !location) return null;

    return {
      latitude: location.latitude,
      longitude: location.longitude,
      adcode: geocode.adcode ?? null,
      formattedAddress: geocode.formatted_address ?? null,
      city: normalizeCity(geocode.city),
      district: geocode.district ?? null
    } satisfies AmapGeocodeResult;
  });
}

export async function getAmapWeather(adcode: string, travelDate: string) {
  return withAmapCache(buildCacheKey("weather", { adcode, travelDate }), 30 * 60 * 1000, async () => {
    const forecastPayload = await requestAmap<AmapWeatherResponse>("/weather/weatherInfo", {
      city: adcode,
      extensions: "all"
    });

    const selected =
      forecastPayload?.forecasts?.[0]?.casts?.find((cast) => cast.date === travelDate) ?? forecastPayload?.forecasts?.[0]?.casts?.[0];
    if (selected) {
      const windValues = [toNumber(selected.daypower), toNumber(selected.nightpower)].filter((item): item is number => item != null);
      return {
        date: selected.date ?? travelDate,
        weatherText: selected.dayweather || selected.nightweather || "多云",
        temperatureHigh: toNumber(selected.daytemp),
        temperatureLow: toNumber(selected.nighttemp),
        windLevel: windValues.length ? Math.max(...windValues) : null,
        reportTime: null
      } satisfies AmapWeatherResult;
    }

    const livePayload = await requestAmap<AmapWeatherResponse>("/weather/weatherInfo", {
      city: adcode,
      extensions: "base"
    });
    const live = livePayload?.lives?.[0];
    if (!live) return null;

    const temperature = toNumber(live.temperature);
    return {
      date: travelDate,
      weatherText: live.weather || "多云",
      temperatureHigh: temperature,
      temperatureLow: temperature,
      windLevel: toNumber(live.windpower),
      reportTime: live.reporttime ?? null
    } satisfies AmapWeatherResult;
  });
}

export async function getDrivingRoutePlan(origin: string, destination: string) {
  return withAmapCache(buildCacheKey("driving", { origin, destination }), 10 * 60 * 1000, async () => {
    const payload = await requestAmap<AmapDrivingResponse>("/direction/driving", {
      origin,
      destination,
      extensions: "base"
    });
    const path = payload?.route?.paths?.[0];
    const distanceKm = toKm(path?.distance);
    const durationMinutes = toMinutes(path?.duration);
    if (distanceKm == null || durationMinutes == null) return null;

    const steps = (path?.steps ?? [])
      .map((step) => {
        const road = step.road?.trim();
        const instruction = step.instruction?.trim();
        const detail = compact([instruction, road ? `道路：${road}` : null, step.orientation ? `方向：${step.orientation}` : null]).join("；");

        return {
          mode: "drive",
          title: road ? `沿 ${road} 行驶` : instruction || "按导航行驶",
          detail,
          durationMinutes: toMinutes(step.duration),
          distanceKm: toKm(step.distance),
          stops: null
        } satisfies AmapRouteStepResult;
      })
      .filter((step) => step.detail);

    return {
      mode: "self_drive",
      summary: `自驾预计约 ${durationMinutes} 分钟，约 ${distanceKm} 公里。`,
      durationMinutes,
      distanceKm,
      walkingDistanceKm: 0,
      cost: null,
      caution: durationMinutes >= 150 ? "单日往返会比较赶，建议尽量提早出发。" : null,
      steps
    } satisfies AmapRoutePlanResult;
  });
}

export async function getTransitRoutePlan(origin: string, destination: string, originCity?: string | null, destinationCity?: string | null) {
  return withAmapCache(
    buildCacheKey("transit", { origin, destination, originCity: originCity || undefined, destinationCity: destinationCity || undefined }),
    10 * 60 * 1000,
    async () => {
      const payload = await requestAmap<AmapTransitResponse>("/direction/transit/integrated", {
        origin,
        destination,
        city: originCity || destinationCity || undefined,
        cityd: destinationCity || originCity || undefined
      });
      const transit = payload?.route?.transits?.[0];
      const distanceKm = toKm(transit?.distance);
      const durationMinutes = toMinutes(transit?.duration);
      if (distanceKm == null || durationMinutes == null) return null;

      const steps: AmapRouteStepResult[] = [];

      for (const segment of transit?.segments ?? []) {
        const walking = segment.walking;
        if (walking?.steps?.length) {
          steps.push({
            mode: "walk",
            title: "步行接驳",
            detail: walking.steps.map((step) => step.instruction?.trim()).filter(Boolean).join("；"),
            durationMinutes: toMinutes(walking.duration),
            distanceKm: toKm(walking.distance),
            stops: null
          });
        }

        for (const busline of segment.bus?.buslines ?? []) {
          const name = normalizeBusLineName(busline.name);
          const isSubway = /地铁/.test(name);
          const direction = extractLineDirection(busline.name);
          const from = busline.departure_stop?.name ?? "上车站";
          const to = busline.arrival_stop?.name ?? "下车站";
          const via = toNumber(busline.via_num);

          steps.push({
            mode: isSubway ? "subway" : "bus",
            title: isSubway ? `乘坐 ${name}` : `乘坐公交 ${name}`,
            detail: compact([`从 ${from} 上车`, `到 ${to} 下车`, direction ? `方向：${direction}` : null, via != null ? `约 ${via} 站` : null]).join("；"),
            durationMinutes: toMinutes(busline.duration),
            distanceKm: null,
            stops: via
          });
        }

        const railway = segment.railway;
        if (railway?.trip || railway?.departure_stop?.name || railway?.arrival_stop?.name) {
          steps.push({
            mode: "railway",
            title: railway.trip ? `乘坐 ${railway.trip}` : "铁路接驳",
            detail: compact([
              railway.departure_stop?.name ? `从 ${railway.departure_stop.name} 出发` : null,
              railway.arrival_stop?.name ? `到 ${railway.arrival_stop.name} 到达` : null
            ]).join("；"),
            durationMinutes: toMinutes(railway.time),
            distanceKm: null,
            stops: null
          });
        }

        const taxi = segment.taxi;
        if (taxi?.distance || taxi?.duration) {
          steps.push({
            mode: "taxi",
            title: "末段打车",
            detail: "建议在换乘点后使用网约车或出租车完成最后一段接驳。",
            durationMinutes: toMinutes(taxi.duration),
            distanceKm: toKm(taxi.distance),
            stops: null
          });
        }
      }

      return {
        mode: "public_transit",
        summary: `公共交通预计约 ${durationMinutes} 分钟，约 ${distanceKm} 公里。`,
        durationMinutes,
        distanceKm,
        walkingDistanceKm: toKm(transit?.walking_distance),
        cost: toNumber(transit?.cost),
        caution: durationMinutes >= 120 ? "换乘时间偏长，建议预留缓冲，并提前确认末班车时间。" : null,
        steps
      } satisfies AmapRoutePlanResult;
    }
  );
}

function mapTrafficStatus(statusText: string) {
  if (statusText.includes("严重拥堵")) return 5;
  if (statusText.includes("拥堵")) return 4;
  if (statusText.includes("缓行")) return 3;
  if (statusText.includes("畅通")) return 2;
  return 3;
}

export async function getTrafficCircleSummary(longitude: number, latitude: number, radius = 3000) {
  return withAmapCache(buildCacheKey("traffic", { longitude, latitude, radius }), 5 * 60 * 1000, async () => {
    const payload = await requestAmap<AmapTrafficResponse>("/traffic/status/circle", {
      location: `${longitude},${latitude}`,
      radius
    });

    const statusText = payload?.trafficinfo?.evaluation?.status || payload?.trafficinfo?.roads?.[0]?.status || "未知";
    return {
      statusText,
      description: payload?.trafficinfo?.evaluation?.description ?? payload?.trafficinfo?.description ?? null,
      congestionLevel: mapTrafficStatus(statusText)
    } satisfies AmapTrafficResult;
  });
}
