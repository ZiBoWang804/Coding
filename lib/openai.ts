import OpenAI from "openai";
import { z } from "zod";
import type { PlannerInput, PlannerResult } from "@/types";
import type {
  BudgetEstimate,
  ItineraryItem,
  PlannerApiInput,
  PlannerDestination,
  PlannerEngineOutput,
  PlannerRuntimeContext
} from "@/lib/planner/types";

type AiConfig = {
  provider: "ark" | "openai";
  apiKey: string;
  baseURL?: string;
  model: string;
};

type OllamaConfig = {
  baseURL: string;
  model: string;
};

type AiPlannerDecision = {
  provider: string;
  response: AiPlannerResponse;
};

type PlannerWebSearchResult = {
  provider: string;
  summary: string;
};

type AiReadableSummary = PlannerEngineOutput["readableSummary"];
type AiCandidate = {
  refId: string;
  destination: PlannerDestination;
};

const AI_PLANNER_BUDGET_SCHEMA = z.object({
  transport: z.coerce.number().optional(),
  lodging: z.coerce.number().optional(),
  dining: z.coerce.number().optional(),
  activities: z.coerce.number().optional(),
  totalMin: z.coerce.number().optional(),
  totalMax: z.coerce.number().optional()
});

const AI_PLANNER_ITINERARY_SCHEMA = z.object({
  day: z.coerce.number().int().min(1),
  title: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  description: z.string().min(1),
  location: z.string().optional().nullable(),
  transportTip: z.string().optional().nullable(),
  mealTip: z.string().optional().nullable(),
  stayTip: z.string().optional().nullable()
});

const AI_PLANNER_RECOMMENDATION_SCHEMA = z.object({
  destinationId: z.string().min(1),
  score: z.coerce.number().min(0).max(100).optional(),
  matchReasons: z.array(z.string().min(1)).default([]),
  fitReasons: z.array(z.string().min(1)).default([]),
  dynamicFactors: z.array(z.string().min(1)).default([]),
  cautions: z.array(z.string().min(1)).default([]),
  transportSummary: z.string().default(""),
  lodgingSummary: z.string().default(""),
  diningSummary: z.string().default(""),
  hotelSummary: z.string().optional().nullable(),
  ticketSummary: z.string().optional().nullable(),
  openingHoursText: z.string().optional().nullable(),
  openStatus: z.enum(["open", "closed", "unknown"]).optional(),
  budgetEstimate: AI_PLANNER_BUDGET_SCHEMA.optional(),
  itinerary: z.array(AI_PLANNER_ITINERARY_SCHEMA).default([])
});

const AI_PLANNER_RESPONSE_SCHEMA = z.object({
  headline: z.string().min(1),
  weatherSummary: z.string().min(1),
  trafficSummary: z.string().min(1),
  recommendation: z.array(z.string().min(1)).default([]),
  dynamicImpact: z.array(z.string().min(1)).default([]),
  cautions: z.array(z.string().min(1)).default([]),
  alternatives: z.array(z.string().min(1)).default([]),
  recommendations: z.array(AI_PLANNER_RECOMMENDATION_SCHEMA).min(1).max(3)
});

type AiPlannerResponse = z.infer<typeof AI_PLANNER_RESPONSE_SCHEMA>;

let ollamaStatusCache:
  | {
      checkedAt: number;
      available: boolean;
      models: string[];
    }
  | undefined;

let arkFailureState:
  | {
      until: number;
      reason: string;
    }
  | undefined;

const aiPlannerCache = new Map<string, { expiresAt: number; value: AiPlannerDecision | null }>();
const plannerWebSearchCache = new Map<string, { expiresAt: number; value: PlannerWebSearchResult | null }>();

const WEATHER_LABELS: Record<string, string> = {
  sunny: "晴",
  cloudy: "多云",
  light_rain: "小雨",
  heavy_rain: "大雨",
  thunder: "雷雨",
  snow: "降雪",
  fog: "大雾",
  heat: "炎热",
  cold: "寒冷",
  windy: "有风"
};

const TRANSPORT_MODE_LABELS: Record<string, string> = {
  self_drive: "自驾",
  public_transit: "公共交通",
  either: "都可以"
};

const COMPANION_LABELS: Record<string, string> = {
  solo: "独自出行",
  couple: "情侣",
  family: "亲子家庭",
  friends: "朋友结伴",
  elderly: "长辈同行"
};

const CROWD_LABELS: Record<string, string> = {
  avoid_crowds: "尽量避开人流",
  neutral: "无特别偏好",
  lively: "热闹一点"
};

const PACE_LABELS: Record<string, string> = {
  slow: "慢节奏",
  moderate: "适中",
  multi_stop: "多点串联"
};

const DEPARTURE_TIME_LABELS: Record<string, string> = {
  early_morning: "越早越好",
  morning: "上午出发",
  noon: "中午前后",
  after_work: "下班后出发",
  flexible: "时间灵活"
};

const BOOKING_LABELS: Record<string, string> = {
  avoid_reservations: "尽量免预约",
  can_book: "可以接受预约",
  must_bookable: "必须可预订"
};

const TICKET_LABELS: Record<string, string> = {
  free_or_low_cost: "门票尽量低",
  balanced: "价格适中即可",
  premium_ok: "高品质体验优先"
};

const LODGING_LABELS: Record<string, string> = {
  flexible: "住宿不限",
  design_homestay: "偏好特色民宿",
  comfort_hotel: "偏好舒适酒店",
  hot_spring_resort: "偏好温泉或度假酒店",
  camping_ok: "露营营地也可以"
};

const DINING_LABELS: Record<string, string> = {
  flexible: "用餐不限",
  local_food: "优先本地餐饮",
  cafe_brunch: "想要咖啡和早午餐",
  family_restaurant: "适合家庭就餐",
  easy_to_find: "餐饮方便最重要"
};

const SPECIAL_CONSTRAINT_LABELS: Record<string, string> = {
  avoid_mountain_road: "避开盘山路",
  avoid_steep_walk: "少爬坡少台阶",
  avoid_reservations: "尽量免预约",
  low_ticket_cost: "门票别太贵",
  need_hotel: "适合住一晚",
  child_friendly: "带娃友好",
  elderly_friendly: "带长辈友好",
  free_parking_first: "停车方便优先",
  cafe_break: "想安排咖啡下午茶",
  hot_spring_first: "想要温泉"
};

function readEnv(name: string) {
  const raw = process.env[name];
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function containsCjk(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function truncateText(value: string | null | undefined, maxLength = 120) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function compactTags(items: Array<string | null | undefined> = [], limit = 6) {
  return items
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function labelOf<T extends string>(map: Record<string, string>, value: T | string | null | undefined, fallback = "未指定") {
  if (!value) return fallback;
  return map[String(value)] || String(value);
}

function translateSpecialConstraints(items: Array<string | null | undefined> = []) {
  return items.map((item) => labelOf(SPECIAL_CONSTRAINT_LABELS, item, "")).filter(Boolean);
}

function normalizeStringArray(value: unknown, fallback: string[] = [], maxItems = 2, maxLength = 28) {
  const items = Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : typeof value === "string"
      ? value
          .split(/\n|;|；/)
          .map((item) => item.replace(/^[-*•\d.\s]+/, "").trim())
          .filter(Boolean)
      : fallback;

  return items
    .slice(0, maxItems)
    .map((item) => truncateText(item, maxLength))
    .filter(Boolean);
}

function normalizeAiText(value: unknown, maxLength = 64) {
  const text = truncateText(String(value || "").trim(), maxLength);
  if (!text) return "";
  if (/^[?\uFF1F.\-_/\\\s]+$/.test(text)) return "";
  if (!containsCjk(text) && /[A-Za-z]/.test(text)) return "";
  return text;
}

function clampNumber(value: number | undefined, min: number, max: number) {
  if (value == null || Number.isNaN(value)) return undefined;
  return Math.max(min, Math.min(max, value));
}

function normalizeOpenStatus(value: unknown): "open" | "closed" | "unknown" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["open", "营业中", "正常开放", "开放", "可开放"].includes(normalized)) return "open";
  if (["closed", "关闭", "闭园", "暂停开放", "停业"].includes(normalized)) return "closed";
  if (["unknown", "未知", "待确认", "建议出发前再确认"].includes(normalized)) return "unknown";
  return undefined;
}

function normalizeBudgetEstimate(value: unknown): BudgetEstimate | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed = AI_PLANNER_BUDGET_SCHEMA.safeParse(value);
  if (!parsed.success) return undefined;
  const budget = parsed.data;
  const hasAnyValue = Object.values(budget).some((item) => typeof item === "number" && Number.isFinite(item));
  if (!hasAnyValue) return undefined;

  return {
    transport: Math.max(0, Math.round(budget.transport ?? 0)),
    lodging: Math.max(0, Math.round(budget.lodging ?? 0)),
    dining: Math.max(0, Math.round(budget.dining ?? 0)),
    activities: Math.max(0, Math.round(budget.activities ?? 0)),
    totalMin: Math.max(0, Math.round(budget.totalMin ?? 0)),
    totalMax: Math.max(0, Math.round(budget.totalMax ?? 0))
  };
}

function normalizeItinerary(value: unknown): ItineraryItem[] {
  if (!Array.isArray(value)) return [];
  const items: ItineraryItem[] = [];

  for (const item of value) {
    const parsed = AI_PLANNER_ITINERARY_SCHEMA.safeParse(item);
    if (!parsed.success) continue;

    const title = normalizeAiText(parsed.data.title, 20);
    const description = normalizeAiText(parsed.data.description, 72);
    if (!title || !description) continue;

    items.push({
      day: parsed.data.day,
      title,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      description,
      location: parsed.data.location ? normalizeAiText(parsed.data.location, 32) || undefined : undefined,
      transportTip: parsed.data.transportTip ? normalizeAiText(parsed.data.transportTip, 36) || undefined : undefined,
      mealTip: parsed.data.mealTip ? normalizeAiText(parsed.data.mealTip, 32) || undefined : undefined,
      stayTip: parsed.data.stayTip ? normalizeAiText(parsed.data.stayTip, 32) || undefined : undefined
    });
  }

  return items.slice(0, 2);
}

function toChineseWeather(condition: string | null | undefined) {
  const normalized = String(condition || "").trim().toLowerCase();
  if (!normalized) return "天气待确认";
  return WEATHER_LABELS[normalized] || normalized;
}

function buildWeatherFallback(context: PlannerRuntimeContext) {
  const summary = String(context.weather.weatherSummary || "").trim();
  if (summary && containsCjk(summary)) {
    return summary;
  }

  const high = context.weather.temperatureHigh;
  const low = context.weather.temperatureLow;
  const condition = toChineseWeather(context.weather.condition);
  if (high != null && low != null) {
    return `${context.user.travelDate} 天气参考：${condition}，气温约 ${low}°C - ${high}°C。`;
  }

  return `${context.user.travelDate} 天气参考：${condition}。`;
}

function buildTrafficFallback(context: PlannerRuntimeContext) {
  const prefix = context.traffic.isHoliday ? "假日路况参考" : "路况参考";
  return `${prefix}：拥堵等级 ${context.traffic.congestionLevel}/5，停车压力 ${context.traffic.parkingStress}/5。`;
}

function preferChineseText(value: unknown, fallback: string, maxLength = 80) {
  const text = truncateText(String(value || "").trim(), maxLength);
  if (!text) return fallback;
  if (!containsCjk(text) && /[A-Za-z]/.test(text)) return fallback;
  return text;
}

function normalizePlannerRecommendation(value: unknown, allowedIds: Set<string>) {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const destinationId = typeof raw.destinationId === "string" ? raw.destinationId.trim() : "";
  if (!destinationId || !allowedIds.has(destinationId)) return null;

  const rawScore = Number(raw.score);
  const normalizedScore = Number.isFinite(rawScore) && rawScore > 0 && rawScore <= 5 ? rawScore * 20 : rawScore;

  const parsed = AI_PLANNER_RECOMMENDATION_SCHEMA.safeParse({
    destinationId,
    score: clampNumber(normalizedScore, 0, 100),
    matchReasons: normalizeStringArray(raw.matchReasons, [], 2, 24),
    fitReasons: normalizeStringArray(raw.fitReasons, [], 2, 24),
    dynamicFactors: normalizeStringArray(raw.dynamicFactors, [], 2, 24),
    cautions: normalizeStringArray(raw.cautions, [], 2, 28),
    transportSummary: normalizeAiText(raw.transportSummary, 64),
    lodgingSummary: normalizeAiText(raw.lodgingSummary, 64),
    diningSummary: normalizeAiText(raw.diningSummary, 64),
    hotelSummary: raw.hotelSummary ? normalizeAiText(raw.hotelSummary, 64) : null,
    ticketSummary: raw.ticketSummary ? normalizeAiText(raw.ticketSummary, 64) : null,
    openingHoursText: raw.openingHoursText ? normalizeAiText(raw.openingHoursText, 64) : null,
    openStatus: normalizeOpenStatus(raw.openStatus) ?? undefined,
    budgetEstimate: normalizeBudgetEstimate(raw.budgetEstimate),
    itinerary: normalizeItinerary(raw.itinerary)
  });

  return parsed.success ? parsed.data : null;
}

function coercePlannerResponse(data: Record<string, unknown>, context: PlannerRuntimeContext, allowedIds: Set<string>): AiPlannerResponse | null {
  const normalizedRecommendations = Array.isArray(data.recommendations)
    ? data.recommendations
        .slice(0, 2)
        .map((item) => normalizePlannerRecommendation(item, allowedIds))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  if (!normalizedRecommendations.length) return null;

  const fallbackRecommendation = normalizedRecommendations[0];
  const parsed = AI_PLANNER_RESPONSE_SCHEMA.safeParse({
    headline: preferChineseText(data.headline, "已为你筛出更合适的出游方案", 40),
    weatherSummary: preferChineseText(data.weatherSummary, buildWeatherFallback(context), 72),
    trafficSummary: preferChineseText(data.trafficSummary, buildTrafficFallback(context), 72),
    recommendation: normalizeStringArray(
      data.recommendation,
      fallbackRecommendation.matchReasons.length ? fallbackRecommendation.matchReasons : ["这条方案与当前条件更贴合"],
      2,
      28
    ),
    dynamicImpact: normalizeStringArray(
      data.dynamicImpact,
      fallbackRecommendation.dynamicFactors.length ? fallbackRecommendation.dynamicFactors : [buildTrafficFallback(context)],
      2,
      28
    ),
    cautions: normalizeStringArray(
      data.cautions,
      fallbackRecommendation.cautions.length ? fallbackRecommendation.cautions : ["建议出发前再确认开放时间和预约情况"],
      2,
      28
    ),
    alternatives: normalizeStringArray(data.alternatives, [], 2, 28),
    recommendations: normalizedRecommendations
  });

  return parsed.success ? parsed.data : null;
}

function buildPlannerCacheKey(input: PlannerApiInput, context: PlannerRuntimeContext, candidates: PlannerDestination[]) {
  return JSON.stringify({
    provider: readEnv("AI_PROVIDER") || "ark",
    arkModel: readEnv("ARK_MODEL"),
    openaiModel: readEnv("OPENAI_MODEL"),
    ollamaModel: readEnv("OLLAMA_MODEL"),
    origin: input.origin,
    destinationQuery: input.destinationQuery || null,
    includeLiveSignals: input.includeLiveSignals !== false,
    travelDate: input.travelDate,
    days: input.days,
    budgetMin: input.budgetMin ?? null,
    budgetMax: input.budgetMax ?? null,
    transportMode: input.transportMode,
    companions: input.companions,
    crowdPreference: input.crowdPreference,
    pacePreference: input.pacePreference,
    departureTimePreference: input.departureTimePreference || null,
    bookingPreference: input.bookingPreference || null,
    ticketPreference: input.ticketPreference || null,
    preferenceTags: input.preferenceTags,
    specialConstraints: input.specialConstraints || [],
    weatherSummary: buildWeatherFallback(context),
    trafficSummary: buildTrafficFallback(context),
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      province: candidate.province,
      city: candidate.city,
      district: candidate.district ?? null
    }))
  });
}

function getCachedAiPlanner(key: string) {
  const cached = aiPlannerCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    aiPlannerCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedAiPlanner(key: string, value: AiPlannerDecision | null, ttlMs = 90_000) {
  aiPlannerCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value
  });
  return value;
}

function buildPlannerWebSearchCacheKey(input: PlannerApiInput, candidates: AiCandidate[]) {
  return JSON.stringify({
    origin: input.origin,
    destinationQuery: input.destinationQuery || null,
    travelDate: input.travelDate,
    days: input.days,
    transportMode: input.transportMode,
    companions: input.companions,
    budgetMin: input.budgetMin ?? null,
    budgetMax: input.budgetMax ?? null,
    preferenceTags: input.preferenceTags,
    lodgingPreference: input.lodgingPreference || null,
    diningPreference: input.diningPreference || null,
    departureTimePreference: input.departureTimePreference || null,
    bookingPreference: input.bookingPreference || null,
    ticketPreference: input.ticketPreference || null,
    specialConstraints: input.specialConstraints || [],
    candidates: candidates.map(({ refId, destination }) => ({
      refId,
      name: destination.name,
      city: destination.city,
      district: destination.district ?? null
    }))
  });
}

function getCachedPlannerWebSearch(key: string) {
  const cached = plannerWebSearchCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    plannerWebSearchCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedPlannerWebSearch(key: string, value: PlannerWebSearchResult | null, ttlMs = 600_000) {
  plannerWebSearchCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value
  });
  return value;
}

function extractResponsesText(payload: any) {
  const chunks: string[] = [];

  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function shouldSkipArk() {
  return Boolean(arkFailureState && arkFailureState.until > Date.now());
}

function markArkFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/ECONNRESET|SSL|TLS|socket|handshake|network|timed out|abort/i.test(message)) {
    arkFailureState = {
      until: Date.now() + 180_000,
      reason: message
    };
  }
}

function clearArkFailure() {
  arkFailureState = undefined;
}

export function getAiConfig(): AiConfig | null {
  const preferred = readEnv("AI_PROVIDER").toLowerCase();
  const arkApiKey = readEnv("ARK_API_KEY");
  const arkBaseURL = readEnv("ARK_BASE_URL") || "https://ark.cn-beijing.volces.com/api/v3";
  const arkModel = readEnv("ARK_MODEL");

  if ((preferred === "ark" || !preferred) && arkApiKey) {
    return {
      provider: "ark",
      apiKey: arkApiKey,
      baseURL: arkBaseURL,
      model: arkModel
    };
  }

  const openAiApiKey = readEnv("OPENAI_API_KEY");
  if (preferred === "openai" && openAiApiKey) {
    return {
      provider: "openai",
      apiKey: openAiApiKey,
      baseURL: readEnv("OPENAI_BASE_URL") || undefined,
      model: readEnv("OPENAI_MODEL") || "gpt-4.1-mini"
    };
  }

  return null;
}

function getOllamaConfig(): OllamaConfig {
  return {
    baseURL: readEnv("OLLAMA_BASE_URL") || "http://127.0.0.1:11434",
    model: readEnv("OLLAMA_MODEL") || "gpt-oss:120b-cloud"
  };
}

function createAiClient(config: AiConfig, timeout = 18_000) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout
  });
}

async function isOllamaModelAvailable(config: OllamaConfig) {
  const now = Date.now();
  if (ollamaStatusCache && now - ollamaStatusCache.checkedAt < 60_000) {
    return ollamaStatusCache.available && ollamaStatusCache.models.includes(config.model);
  }

  try {
    const response = await fetch(`${config.baseURL}/api/tags`, {
      signal: AbortSignal.timeout(1_500),
      cache: "no-store"
    });
    if (!response.ok) {
      ollamaStatusCache = { checkedAt: now, available: false, models: [] };
      return false;
    }

    const payload = (await response.json()) as { models?: Array<{ name?: string }> };
    const models = (payload.models ?? []).map((item) => item.name?.trim()).filter(Boolean) as string[];
    ollamaStatusCache = {
      checkedAt: now,
      available: true,
      models
    };

    return models.includes(config.model);
  } catch {
    ollamaStatusCache = { checkedAt: now, available: false, models: [] };
    return false;
  }
}

function buildCompactPlannerPayload(
  input: PlannerApiInput,
  context: PlannerRuntimeContext,
  candidates: AiCandidate[],
  webSearchSummary?: string | null
) {
  return {
    user: {
      origin: input.origin,
      destinationQuery: input.destinationQuery || null,
      travelDate: input.travelDate,
      days: input.days,
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
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
      includeLiveSignals: input.includeLiveSignals !== false
    },
    liveContext: {
      weatherSummary: buildWeatherFallback(context),
      trafficSummary: buildTrafficFallback(context),
      severeWeatherAlert: context.weather.severeWeatherAlert,
      congestionLevel: context.traffic.congestionLevel,
      parkingStress: context.traffic.parkingStress,
      isHoliday: context.traffic.isHoliday,
      isWeekend: context.traffic.isWeekend,
      webSearchSummary: webSearchSummary || null
    },
    candidates: candidates.map(({ refId, destination }) => ({
      destinationId: refId,
      name: destination.name,
      province: destination.province,
      city: destination.city,
      district: destination.district ?? null,
      description: truncateText(destination.description, 40),
      tags: compactTags(destination.tags as unknown as Array<string | null | undefined>, 4),
      suitableCrowds: (destination.suitableCrowds || []).slice(0, 2),
      bestSeason: (destination.bestSeason || []).slice(0, 2),
      rating: destination.rating ?? null,
      avgCostMin: destination.avgCostMin ?? null,
      avgCostMax: destination.avgCostMax ?? null,
      openStatus: destination.openStatus ?? "unknown",
      openingHoursText: truncateText(destination.openingHoursText, 24),
      liveTravelMinutes: destination.liveTravelMinutes ?? null,
      liveTrafficStatus: truncateText(destination.liveTrafficStatus, 20)
    }))
  };
}

function buildPlannerToolSchema() {
  return {
    type: "function",
    function: {
      name: "return_plan",
      description: "返回结构化旅行规划结果",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string" },
          weatherSummary: { type: "string" },
          trafficSummary: { type: "string" },
          recommendation: { type: "array", items: { type: "string" } },
          dynamicImpact: { type: "array", items: { type: "string" } },
          cautions: { type: "array", items: { type: "string" } },
          alternatives: { type: "array", items: { type: "string" } },
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                destinationId: { type: "string" },
                score: { type: "number" },
                matchReasons: { type: "array", items: { type: "string" } },
                fitReasons: { type: "array", items: { type: "string" } },
                dynamicFactors: { type: "array", items: { type: "string" } },
                cautions: { type: "array", items: { type: "string" } }
              },
              required: ["destinationId", "score", "matchReasons", "fitReasons", "dynamicFactors", "cautions"]
            }
          }
        },
        required: ["headline", "weatherSummary", "trafficSummary", "recommendation", "dynamicImpact", "cautions", "alternatives", "recommendations"]
      }
    }
  };
}

function buildPlannerSystemPrompt() {
  return [
    "你是“游乡记”的智能出游规划助手。",
    "你只能通过 return_plan 函数返回结构化结果，不能输出普通文本。",
    "所有自然语言必须使用简体中文，尽量短句。",
    "只能从候选 destinationId 中选择推荐景点。",
    "如果用户填写了目的地或区域，只能推荐该范围内候选；没有合适候选时返回空 recommendations。",
    "请综合天气、路况、预算、节奏、同行人群、住宿、餐饮、预约要求和门票成本判断。",
    "如果 liveContext.webSearchSummary 不为空，优先使用其中的联网事实来写天气、路况、开放时间、门票和酒店相关内容。",
    "若实时事实无法确认，请明确写“建议出发前再确认”。",
    "顶层 recommendation、dynamicImpact、cautions、alternatives 各最多 2 条。",
    "每个景点的 matchReasons、fitReasons、dynamicFactors、cautions 各最多 2 条。",
    "recommendations 最多返回 2 个。",
    "不要补充额外字段，不要展开长行程，不要写长段说明。"
  ].join("\n");
}

function extractToolArguments(payload: any) {
  const argumentsText =
    payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ||
    payload?.choices?.[0]?.message?.function_call?.arguments ||
    "";
  if (!argumentsText || typeof argumentsText !== "string") return null;

  try {
    return JSON.parse(argumentsText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function buildPlannerWebSearchSummary(
  config: AiConfig,
  input: PlannerApiInput,
  candidates: AiCandidate[]
): Promise<PlannerWebSearchResult | null> {
  if (config.provider !== "ark" || input.includeLiveSignals === false) return null;

  const cacheKey = buildPlannerWebSearchCacheKey(input, candidates);
  const cached = getCachedPlannerWebSearch(cacheKey);
  if (cached) return cached;

  const candidateLines = candidates.map(({ refId, destination }) => {
    const location = [destination.city, destination.district].filter(Boolean).join("/");
    return `${refId} ${destination.name}${location ? `（${location}）` : ""}`;
  });

  const prompt = [
    "请联网搜索并整理一段供旅游规划使用的事实摘要。",
    "只输出简体中文结论，不要输出代码块，不要解释推理过程。",
    `出发地：${input.origin}`,
    input.destinationQuery ? `目的地或想去区域：${input.destinationQuery}` : "",
    `出行日期：${input.travelDate}`,
    `出行天数：${input.days} 天`,
    `交通方式：${labelOf(TRANSPORT_MODE_LABELS, input.transportMode)}`,
    `同行人群：${labelOf(COMPANION_LABELS, input.companions)}`,
    `人流偏好：${labelOf(CROWD_LABELS, input.crowdPreference)}`,
    `节奏偏好：${labelOf(PACE_LABELS, input.pacePreference)}`,
    `预算：${input.budgetMin ?? "不限"}-${input.budgetMax ?? "不限"} 元`,
    input.lodgingPreference ? `住宿偏好：${labelOf(LODGING_LABELS, input.lodgingPreference)}` : "",
    input.diningPreference ? `餐饮偏好：${labelOf(DINING_LABELS, input.diningPreference)}` : "",
    input.departureTimePreference ? `出发时段：${labelOf(DEPARTURE_TIME_LABELS, input.departureTimePreference)}` : "",
    input.bookingPreference ? `预约偏好：${labelOf(BOOKING_LABELS, input.bookingPreference)}` : "",
    input.ticketPreference ? `门票偏好：${labelOf(TICKET_LABELS, input.ticketPreference)}` : "",
    input.preferenceTags.length ? `偏好标签：${input.preferenceTags.join("、")}` : "",
    input.specialConstraints?.length ? `额外要求：${translateSpecialConstraints(input.specialConstraints).join("、")}` : "",
    `候选景点：${candidateLines.join("；")}`,
    "按以下格式输出，尽量控制在 8 行以内：",
    "天气：...",
    "路况：...",
    "目的地提醒：...",
    "候选事实：C1 ...；C2 ...；C3 ...",
    "注意：如无法确认，请写“建议出发前再确认”。"
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(`${config.baseURL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        model: config.model,
        input: prompt,
        tools: [{ type: "web_search" }],
        max_output_tokens: 900
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ARK web search failed: ${response.status} ${body}`);
    }

    const payload = await response.json();
    const summary = truncateText(extractResponsesText(payload), 1600);
    if (!summary) return setCachedPlannerWebSearch(cacheKey, null, 180_000);

    return setCachedPlannerWebSearch(cacheKey, {
      provider: `ark:web-search:${config.model}`,
      summary
    });
  } catch {
    return setCachedPlannerWebSearch(cacheKey, null, 180_000);
  }
}

async function buildPlannerResponseWithArkTool(config: AiConfig, input: PlannerApiInput, context: PlannerRuntimeContext, candidates: AiCandidate[]) {
  if (config.provider !== "ark" || shouldSkipArk()) return null;

  const payload = buildCompactPlannerPayload(input, context, candidates);

  try {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      signal: AbortSignal.timeout(18_000),
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        max_tokens: 480,
        thinking: { type: "disabled" },
        tools: [buildPlannerToolSchema()],
        tool_choice: {
          type: "function",
          function: { name: "return_plan" }
        },
        messages: [
          {
            role: "system",
            content: buildPlannerSystemPrompt()
          },
          {
            role: "user",
            content: JSON.stringify(payload)
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ARK planner request failed: ${response.status} ${body}`);
    }

    const result = await response.json();
    const raw = extractToolArguments(result);
    if (!raw) {
      console.error("[planner][ark] no tool arguments", JSON.stringify(result).slice(0, 1200));
    }
    const planner = raw ? coercePlannerResponse(raw, context, new Set(candidates.map((candidate) => candidate.refId))) : null;
    if (raw && !planner) {
      console.error("[planner][ark] invalid planner payload", JSON.stringify(raw).slice(0, 1200));
    }
    if (!planner) return null;

    clearArkFailure();
    return {
      provider: `ark:tool:${config.model}`,
      response: planner
    } satisfies AiPlannerDecision;
  } catch (error) {
    markArkFailure(error);
    return null;
  }
}

async function buildPlannerResponseWithOpenAiTool(config: AiConfig, input: PlannerApiInput, context: PlannerRuntimeContext, candidates: AiCandidate[]) {
  if (config.provider !== "openai") return null;

  try {
    const client = createAiClient(config, 22_000);
    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.1,
      max_tokens: 900,
      tools: [buildPlannerToolSchema()],
      tool_choice: {
        type: "function",
        function: { name: "return_plan" }
      },
      messages: [
        {
          role: "system",
          content: buildPlannerSystemPrompt()
        },
        {
          role: "user",
          content: JSON.stringify(buildCompactPlannerPayload(input, context, candidates))
        }
      ]
    } as any);

    const firstToolCall = response.choices?.[0]?.message?.tool_calls?.[0] as any;
    const rawText = firstToolCall?.function?.arguments || "";
    if (!rawText) return null;

    const raw = JSON.parse(rawText) as Record<string, unknown>;
    const planner = coercePlannerResponse(raw, context, new Set(candidates.map((candidate) => candidate.refId)));
    if (!planner) return null;

    return {
      provider: `openai:tool:${config.model}`,
      response: planner
    } satisfies AiPlannerDecision;
  } catch {
    return null;
  }
}

async function buildPlannerResponseWithOllama(prompt: string, context: PlannerRuntimeContext, candidates: AiCandidate[]) {
  const config = getOllamaConfig();
  const available = await isOllamaModelAvailable(config);
  if (!available) return null;

  try {
    const response = await fetch(`${config.baseURL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(22_000),
      body: JSON.stringify({
        model: config.model,
        stream: false,
        format: "json",
        options: {
          temperature: 0.1,
          num_predict: 800
        },
        messages: [
          {
            role: "system",
            content:
              "你是中文旅行规划助手。只返回 JSON。所有文本都用简体中文。只能从候选 destinationId 中选择。"
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { message?: { content?: string } };
    const rawText = payload.message?.content?.trim() || "";
    if (!rawText) return null;

    const raw = JSON.parse(rawText) as Record<string, unknown>;
    const planner = coercePlannerResponse(raw, context, new Set(candidates.map((candidate) => candidate.refId)));
    if (!planner) return null;

    return {
      provider: `ollama:${config.model}`,
      response: planner
    } satisfies AiPlannerDecision;
  } catch {
    return null;
  }
}

export async function generateAiPlannerPlan(
  input: PlannerApiInput,
  context: PlannerRuntimeContext,
  candidates: PlannerDestination[]
): Promise<AiPlannerDecision | null> {
  if (!candidates.length) return null;

  const trimmedCandidates = candidates.slice(0, input.destinationQuery?.trim() ? 6 : 8);
  const aiCandidates = trimmedCandidates.map((destination, index) => ({
    refId: `C${index + 1}`,
    destination
  }));
  const aliasToRealId = new Map(aiCandidates.map((item) => [item.refId, item.destination.id]));
  const cacheKey = buildPlannerCacheKey(input, context, trimmedCandidates);
  const cached = getCachedAiPlanner(cacheKey);
  if (cached) return cached;

  const config = getAiConfig();
  if (config?.provider === "ark") {
    const arkResult = await buildPlannerResponseWithArkTool(config, input, context, aiCandidates);
    if (arkResult) {
      return setCachedAiPlanner(cacheKey, {
        ...arkResult,
        response: {
          ...arkResult.response,
          recommendations: arkResult.response.recommendations
            .map((item) => {
              const realId = aliasToRealId.get(item.destinationId);
              return realId ? { ...item, destinationId: realId } : null;
            })
            .filter((item): item is typeof arkResult.response.recommendations[number] => Boolean(item))
        }
      });
    }
  }

  if (config?.provider === "openai") {
    const openAiResult = await buildPlannerResponseWithOpenAiTool(config, input, context, aiCandidates);
    if (openAiResult) {
      return setCachedAiPlanner(cacheKey, {
        ...openAiResult,
        response: {
          ...openAiResult.response,
          recommendations: openAiResult.response.recommendations
            .map((item) => {
              const realId = aliasToRealId.get(item.destinationId);
              return realId ? { ...item, destinationId: realId } : null;
            })
            .filter((item): item is typeof openAiResult.response.recommendations[number] => Boolean(item))
        }
      });
    }
  }

  const ollamaPrompt = JSON.stringify(buildCompactPlannerPayload(input, context, aiCandidates));
  const ollamaResult = await buildPlannerResponseWithOllama(ollamaPrompt, context, aiCandidates);
  if (!ollamaResult) return setCachedAiPlanner(cacheKey, null, 45_000);

  return setCachedAiPlanner(
    cacheKey,
    {
      ...ollamaResult,
      response: {
        ...ollamaResult.response,
        recommendations: ollamaResult.response.recommendations
          .map((item) => {
            const realId = aliasToRealId.get(item.destinationId);
            return realId ? { ...item, destinationId: realId } : null;
          })
          .filter((item): item is typeof ollamaResult.response.recommendations[number] => Boolean(item))
      }
    },
    45_000
  );
}

export async function buildAiReadablePlannerSummary(
  input: PlannerApiInput,
  output: PlannerEngineOutput,
  context: PlannerRuntimeContext
): Promise<{ provider: string; summary: AiReadableSummary } | null> {
  void input;
  void output;
  void context;
  return null;
}

export async function buildAiPlannerSummary(
  input: PlannerInput,
  result: PlannerResult
): Promise<{ provider: string; summary: string } | null> {
  const config = getAiConfig();
  if (!config) return null;

  try {
    if (config.provider === "ark") {
      const response = await fetch(`${config.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        signal: AbortSignal.timeout(18_000),
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          max_tokens: 500,
          thinking: { type: "disabled" },
          messages: [
            {
              role: "system",
              content: "你是中文旅行规划编辑。请写一段简洁的中文总结，不要用 markdown。"
            },
            {
              role: "user",
              content: JSON.stringify({
                user: input,
                result: {
                  summary: result.summary,
                  budgetEstimate: result.budgetEstimate,
                  notes: result.notes,
                  topMatches: result.topMatches.slice(0, 3).map((item) => ({
                    name: item.spot.name,
                    score: item.score,
                    reasons: item.reasons.slice(0, 3)
                  }))
                }
              })
            }
          ]
        })
      });

      if (!response.ok) return null;

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) return null;
      return {
        provider: `ark:chat:${config.model}`,
        summary: text
      };
    }

    const client = createAiClient(config, 12_000);
    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: "You are a Chinese travel editor. Write concise Simplified Chinese prose without markdown."
        },
        {
          role: "user",
          content: JSON.stringify({
            user: input,
            result: {
              summary: result.summary,
              budgetEstimate: result.budgetEstimate,
              notes: result.notes,
              topMatches: result.topMatches.slice(0, 3).map((item) => ({
                name: item.spot.name,
                score: item.score,
                reasons: item.reasons.slice(0, 3)
              }))
            }
          })
        }
      ]
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) return null;
    return {
      provider: `openai:chat:${config.model}`,
      summary: text
    };
  } catch {
    return null;
  }
}
