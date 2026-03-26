import { z } from "zod";
import { getAiConfig } from "@/lib/openai";
import type {
  BudgetEstimate,
  ItineraryItem,
  PlannerApiInput,
  PlannerDestination,
  PlannerRuntimeContext
} from "@/lib/planner/types";

type ServiceErrorCode =
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "CONFIG_ERROR"
  | "UNKNOWN_ERROR";

type ServiceError = {
  code: ServiceErrorCode;
  message: string;
  retryable: boolean;
  detail?: string;
};

type ServiceEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error?: ServiceError;
  meta?: Record<string, unknown>;
};

type PreparedRequest = {
  input: PlannerApiInput;
  context: PlannerRuntimeContext;
  candidates: PlannerDestination[];
  candidateRefs: Array<{ refId: string; destination: PlannerDestination }>;
};

type KnowledgeResult = {
  status: "ok" | "skipped" | "failed";
  summary: string;
  references: string[];
};

type DynamicInfo = {
  summary: string;
  priority: "high" | "medium" | "low";
  source: string;
};

type PromptPayload = {
  prompt: string;
  priority: "high" | "medium" | "low";
};

type TravelPlanStructuredResponse = {
  summary: string;
  weather_summary: string;
  traffic_summary: string;
  budget_distribution: {
    transport: number;
    lodging: number;
    dining: number;
    activities: number;
    total_min: number;
    total_max: number;
  };
  itinerary: Array<{
    day: number;
    destination_id: string;
    destination_name: string;
    activities: string[];
    transport_plan: string;
    meal_recommendations: string[];
    estimated_cost: number;
  }>;
  dynamic_suggestions: string[];
  cautions: string[];
  warm_tips: string[];
  missing_data_notes: string[];
};

type PlannerDecisionCompat = {
  provider: string;
  response: {
    headline: string;
    weatherSummary: string;
    trafficSummary: string;
    recommendation: string[];
    dynamicImpact: string[];
    cautions: string[];
    alternatives: string[];
    recommendations: Array<{
      destinationId: string;
      score: number;
      matchReasons: string[];
      fitReasons: string[];
      dynamicFactors: string[];
      cautions: string[];
      transportSummary: string;
      lodgingSummary: string;
      diningSummary: string;
      budgetEstimate: Partial<BudgetEstimate>;
      itinerary: ItineraryItem[];
      openStatus: "open" | "closed" | "unknown";
      openingHoursText: string | null;
    }>;
  };
};

type GenerateTravelPlanResult = {
  request: PreparedRequest;
  weather: DynamicInfo;
  traffic: DynamicInfo;
  knowledge: KnowledgeResult;
  prompt: string;
  structured: TravelPlanStructuredResponse;
  plannerDecision: PlannerDecisionCompat;
};

const REQUEST_SCHEMA = z.object({
  input: z.object({
    origin: z.string().min(1),
    destinationQuery: z.string().optional().nullable(),
    includeLiveSignals: z.boolean().optional(),
    travelDate: z.string().min(1),
    days: z.number().int().min(1).max(7),
    budgetMin: z.number().optional(),
    budgetMax: z.number().optional(),
    transportMode: z.union([z.literal("self_drive"), z.literal("public_transit"), z.literal("either")]),
    companions: z.union([z.literal("solo"), z.literal("couple"), z.literal("family"), z.literal("friends"), z.literal("elderly")]),
    preferenceTags: z.array(z.string()).default([]),
    crowdPreference: z.union([z.literal("lively"), z.literal("neutral"), z.literal("avoid_crowds")]),
    pacePreference: z.union([z.literal("slow"), z.literal("moderate"), z.literal("multi_stop")]),
    lodgingPreference: z.string().optional().nullable(),
    diningPreference: z.string().optional().nullable(),
    departureTimePreference: z.string().optional().nullable(),
    bookingPreference: z.string().optional().nullable(),
    ticketPreference: z.string().optional().nullable(),
    specialConstraints: z.array(z.string()).default([])
  }),
  context: z.any(),
  candidates: z.array(z.any()).min(1)
});

const TRAVEL_PLAN_RESPONSE_SCHEMA = z.object({
  summary: z.string().min(1),
  weather_summary: z.string().min(1),
  traffic_summary: z.string().min(1),
  budget_distribution: z.object({
    transport: z.coerce.number().nonnegative(),
    lodging: z.coerce.number().nonnegative(),
    dining: z.coerce.number().nonnegative(),
    activities: z.coerce.number().nonnegative(),
    total_min: z.coerce.number().nonnegative(),
    total_max: z.coerce.number().nonnegative()
  }),
  itinerary: z
    .array(
      z.object({
        day: z.coerce.number().int().min(1),
        destination_id: z.string().min(1),
        destination_name: z.string().min(1),
        activities: z.array(z.string().min(1)).min(1),
        transport_plan: z.string().min(1),
        meal_recommendations: z.array(z.string().min(1)).default([]),
        estimated_cost: z.coerce.number().nonnegative()
      })
    )
    .min(1),
  dynamic_suggestions: z.array(z.string()).default([]),
  cautions: z.array(z.string()).default([]),
  warm_tips: z.array(z.string()).default([]),
  missing_data_notes: z.array(z.string()).default([])
});

const OUTPUT_SCHEMA_HINT = {
  summary: "string",
  weather_summary: "string",
  traffic_summary: "string",
  budget_distribution: {
    transport: "number",
    lodging: "number",
    dining: "number",
    activities: "number",
    total_min: "number",
    total_max: "number"
  },
  itinerary: [
    {
      day: "number",
      destination_id: "string",
      destination_name: "string",
      activities: ["string"],
      transport_plan: "string",
      meal_recommendations: ["string"],
      estimated_cost: "number"
    }
  ],
  dynamic_suggestions: ["string"],
  cautions: ["string"],
  warm_tips: ["string"],
  missing_data_notes: ["string"]
} as const;

function success<T>(data: T, meta?: Record<string, unknown>): ServiceEnvelope<T> {
  return { ok: true, data, meta };
}

function failure<T>(code: ServiceErrorCode, message: string, retryable = false, detail?: string): ServiceEnvelope<T> {
  return {
    ok: false,
    data: null,
    error: {
      code,
      message,
      retryable,
      detail
    }
  };
}

function readEnv(name: string) {
  const raw = process.env[name];
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function truncateText(text: string, maxLength = 280) {
  const value = text.trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function parseResponseText(payload: any) {
  const choicesText = payload?.choices?.[0]?.message?.content;
  if (typeof choicesText === "string" && choicesText.trim()) return choicesText.trim();

  const output = payload?.output;
  if (Array.isArray(output)) {
    const chunks: string[] = [];
    for (const item of output) {
      if (item?.type !== "message" || !Array.isArray(item?.content)) continue;
      for (const content of item.content) {
        if (content?.type === "output_text" && typeof content?.text === "string") {
          chunks.push(content.text);
        }
      }
    }
    return chunks.join("\n").trim();
  }

  return "";
}

function weatherFallback(context: PlannerRuntimeContext) {
  const high = context.weather.temperatureHigh;
  const low = context.weather.temperatureLow;
  const summary = String(context.weather.weatherSummary || "").trim();
  if (summary) return summary;
  if (high != null && low != null) {
    return `${context.user.travelDate} 天气参考：${context.weather.condition}，温度 ${low}°C - ${high}°C。`;
  }
  return `${context.user.travelDate} 天气参考：${context.weather.condition}。`;
}

function trafficFallback(context: PlannerRuntimeContext) {
  const prefix = context.traffic.isHoliday ? "节假日路况" : "路况";
  return `${prefix}参考：拥堵等级 ${context.traffic.congestionLevel}/5，停车压力 ${context.traffic.parkingStress}/5。`;
}

function computePriority(weather: DynamicInfo, traffic: DynamicInfo): "high" | "medium" | "low" {
  if (weather.priority === "high" || traffic.priority === "high") return "high";
  if (weather.priority === "medium" || traffic.priority === "medium") return "medium";
  return "low";
}

function toCompatDecision(
  provider: string,
  structured: TravelPlanStructuredResponse,
  prepared: PreparedRequest
): PlannerDecisionCompat {
  const candidateMap = new Map(prepared.candidateRefs.map((item) => [item.refId, item.destination]));
  const recommendationMap = new Map(
    prepared.candidateRefs.map((item) => [
      item.destination.id,
      {
        destinationId: item.destination.id,
        destinationName: item.destination.name,
        summary: item.destination.description || ""
      }
    ])
  );

  const recommendations = structured.itinerary.slice(0, 3).map((dayPlan, index) => {
    const destination =
      candidateMap.get(dayPlan.destination_id) ||
      prepared.candidates.find((item) => item.id === dayPlan.destination_id) ||
      prepared.candidates[index] ||
      prepared.candidates[0];

    const itinerary: ItineraryItem[] = [
      {
        day: dayPlan.day,
        title: `${dayPlan.destination_name}行程`,
        startTime: "09:00",
        endTime: "18:00",
        description: truncateText(dayPlan.activities.join("；"), 180),
        location: destination?.city,
        transportTip: truncateText(dayPlan.transport_plan, 80),
        mealTip: truncateText(dayPlan.meal_recommendations.join("；"), 80),
        stayTip: undefined
      }
    ];

    recommendationMap.set(destination?.id || dayPlan.destination_id, {
      destinationId: destination?.id || dayPlan.destination_id,
      destinationName: dayPlan.destination_name,
      summary: dayPlan.activities.join("；")
    });

    return {
      destinationId: destination?.id || dayPlan.destination_id,
      score: Math.max(60, 92 - index * 8),
      matchReasons: dayPlan.activities.slice(0, 2),
      fitReasons: structured.dynamic_suggestions.slice(0, 2),
      dynamicFactors: structured.dynamic_suggestions.slice(0, 2),
      cautions: structured.cautions.slice(0, 2),
      transportSummary: truncateText(dayPlan.transport_plan, 90),
      lodgingSummary: "建议优先选择交通便利且可免费取消的住宿。",
      diningSummary: truncateText(dayPlan.meal_recommendations.join("；") || "优先本地口碑餐厅，避开高峰排队。", 90),
      budgetEstimate: {
        transport: structured.budget_distribution.transport,
        lodging: structured.budget_distribution.lodging,
        dining: structured.budget_distribution.dining,
        activities: structured.budget_distribution.activities,
        totalMin: structured.budget_distribution.total_min,
        totalMax: structured.budget_distribution.total_max
      },
      itinerary,
      openStatus: "unknown" as const,
      openingHoursText: "开放信息请以景区官方公告为准。"
    };
  });

  const alternatives = prepared.candidates
    .filter((item) => !recommendationMap.has(item.id))
    .slice(0, 2)
    .map((item) => `${item.name}：可作为天气或交通波动时的备选方案。`);

  return {
    provider,
    response: {
      headline: truncateText(structured.summary, 48),
      weatherSummary: truncateText(structured.weather_summary, 120),
      trafficSummary: truncateText(structured.traffic_summary, 120),
      recommendation: structured.itinerary.slice(0, 2).map((item) => `${item.destination_name}：${truncateText(item.activities.join("；"), 52)}`),
      dynamicImpact: structured.dynamic_suggestions.slice(0, 3),
      cautions: [...structured.cautions.slice(0, 3), ...structured.missing_data_notes.slice(0, 2)].slice(0, 4),
      alternatives,
      recommendations
    }
  };
}

/**
 * prepare_request
 * 1) 参数校验与归一化
 * 2) 生成候选 refId 映射，减少后续 Prompt token
 * 3) 输出统一 JSON 结构，供后续函数复用
 */
export async function prepareRequest(input: unknown): Promise<ServiceEnvelope<PreparedRequest>> {
  const parsed = REQUEST_SCHEMA.safeParse(input);
  if (!parsed.success) {
    return failure("VALIDATION_ERROR", "请求参数校验失败", false, parsed.error.message);
  }

  const candidates = (parsed.data.candidates as PlannerDestination[]).slice(0, 8);
  if (!candidates.length) {
    return failure("VALIDATION_ERROR", "候选景点为空，无法生成规划", false);
  }

  const prepared: PreparedRequest = {
    input: parsed.data.input as PlannerApiInput,
    context: parsed.data.context as PlannerRuntimeContext,
    candidates,
    candidateRefs: candidates.map((destination, index) => ({
      refId: `C${index + 1}`,
      destination
    }))
  };

  return success(prepared, {
    candidateCount: candidates.length
  });
}

/**
 * knowledge_service_chat
 * 调用火山知识库（可选）补充景区细节，失败不阻断主流程。
 */
export async function knowledgeServiceChat(
  prepared: PreparedRequest,
  timeoutMs = 9000
): Promise<ServiceEnvelope<KnowledgeResult>> {
  const apiKey = readEnv("VOLCENGINE_API_KEY");
  const kbBaseUrl = readEnv("VOLCENGINE_KNOWLEDGE_BASE_URL");
  const kbId = readEnv("VOLCENGINE_KNOWLEDGE_BASE_ID");
  if (!apiKey || !kbBaseUrl || !kbId) {
    return success({
      status: "skipped",
      summary: "",
      references: []
    });
  }

  try {
    const query = [
      `出发地：${prepared.input.origin}`,
      prepared.input.destinationQuery ? `目的地：${prepared.input.destinationQuery}` : "",
      `候选景点：${prepared.candidateRefs.map((item) => `${item.refId}:${item.destination.name}`).join("；")}`
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(kbBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        knowledge_base_id: kbId,
        query,
        top_k: 4
      })
    });

    if (!response.ok) {
      const body = await response.text();
      return failure("API_ERROR", "知识库服务调用失败", true, `${response.status} ${body}`);
    }

    const payload = (await response.json()) as any;
    const summary = truncateText(
      String(payload?.summary || payload?.answer || payload?.data?.summary || payload?.data?.answer || "").trim(),
      1200
    );
    const references = Array.isArray(payload?.references)
      ? payload.references.map((item: unknown) => truncateText(String(item), 120))
      : [];

    return success({
      status: summary ? "ok" : "failed",
      summary,
      references
    });
  } catch (error) {
    return failure(
      "NETWORK_ERROR",
      "知识库请求超时或网络异常",
      true,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * get_weather_info
 * 实时天气优先，失败回退到平台已有天气上下文。
 */
export async function getWeatherInfo(prepared: PreparedRequest, timeoutMs = 11000): Promise<ServiceEnvelope<DynamicInfo>> {
  if (prepared.input.includeLiveSignals === false) {
    return success({
      summary: weatherFallback(prepared.context),
      priority: "low",
      source: "static-context"
    });
  }

  const config = getAiConfig();
  if (!config || config.provider !== "ark") {
    return success({
      summary: weatherFallback(prepared.context),
      priority: prepared.context.weather.severeWeatherAlert ? "high" : "medium",
      source: "fallback-context"
    });
  }

  try {
    const prompt = [
      "请联网查询旅游规划相关实时天气信息。",
      `日期：${prepared.input.travelDate}`,
      prepared.input.destinationQuery ? `目的地：${prepared.input.destinationQuery}` : `出发地：${prepared.input.origin}`,
      `候选景点：${prepared.candidateRefs.map((item) => item.destination.name).join("、")}`,
      "输出一段简体中文摘要（不超过120字），并标注是否存在恶劣天气风险。"
    ].join("\n");

    const response = await fetch(`${config.baseURL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: config.model,
        input: prompt,
        tools: [{ type: "web_search" }],
        max_output_tokens: 420
      })
    });

    if (!response.ok) {
      return success({
        summary: weatherFallback(prepared.context),
        priority: prepared.context.weather.severeWeatherAlert ? "high" : "medium",
        source: "fallback-context"
      });
    }

    const payload = await response.json();
    const summary = truncateText(parseResponseText(payload) || weatherFallback(prepared.context), 180);
    const highRisk = /暴雨|雷暴|暴雪|台风|寒潮|高温预警|红色预警|橙色预警/.test(summary) || prepared.context.weather.severeWeatherAlert;

    return success({
      summary,
      priority: highRisk ? "high" : "medium",
      source: "ark-web-search"
    });
  } catch {
    return success({
      summary: weatherFallback(prepared.context),
      priority: prepared.context.weather.severeWeatherAlert ? "high" : "medium",
      source: "fallback-context"
    });
  }
}

/**
 * get_traffic_info
 * 实时交通优先，失败回退到平台已有交通上下文。
 */
export async function getTrafficInfo(prepared: PreparedRequest, timeoutMs = 11000): Promise<ServiceEnvelope<DynamicInfo>> {
  if (prepared.input.includeLiveSignals === false) {
    return success({
      summary: trafficFallback(prepared.context),
      priority: "low",
      source: "static-context"
    });
  }

  const config = getAiConfig();
  if (!config || config.provider !== "ark") {
    return success({
      summary: trafficFallback(prepared.context),
      priority: prepared.context.traffic.congestionLevel >= 4 ? "high" : "medium",
      source: "fallback-context"
    });
  }

  try {
    const prompt = [
      "请联网查询旅游出行实时交通信息。",
      `日期：${prepared.input.travelDate}`,
      `出发地：${prepared.input.origin}`,
      prepared.input.destinationQuery ? `目的地：${prepared.input.destinationQuery}` : "",
      `候选景点：${prepared.candidateRefs.map((item) => item.destination.name).join("、")}`,
      "输出简体中文摘要（不超过120字），包含拥堵/封路/停车压力判断。"
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(`${config.baseURL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: config.model,
        input: prompt,
        tools: [{ type: "web_search" }],
        max_output_tokens: 420
      })
    });

    if (!response.ok) {
      return success({
        summary: trafficFallback(prepared.context),
        priority: prepared.context.traffic.congestionLevel >= 4 ? "high" : "medium",
        source: "fallback-context"
      });
    }

    const payload = await response.json();
    const summary = truncateText(parseResponseText(payload) || trafficFallback(prepared.context), 180);
    const highRisk = /严重拥堵|封路|事故|绕行|停车紧张|返程高峰/.test(summary) || prepared.context.traffic.congestionLevel >= 4;

    return success({
      summary,
      priority: highRisk ? "high" : "medium",
      source: "ark-web-search"
    });
  } catch {
    return success({
      summary: trafficFallback(prepared.context),
      priority: prepared.context.traffic.congestionLevel >= 4 ? "high" : "medium",
      source: "fallback-context"
    });
  }
}

/**
 * create_travel_plan_prompt
 * 组合平台静态数据 + 实时动态 + 知识库补充，生成高质量 Prompt。
 */
export function createTravelPlanPrompt(
  prepared: PreparedRequest,
  weatherInfo: DynamicInfo,
  trafficInfo: DynamicInfo,
  knowledgeInfo: KnowledgeResult
): ServiceEnvelope<PromptPayload> {
  const priority = computePriority(weatherInfo, trafficInfo);
  const strictGuard = [
    "你是“智能旅游规划师 + 数据解释器”。",
    "只能基于给定数据输出，不得编造或夸大事实。",
    "无法确认的信息必须明确标注“请以官方数据为准”。",
    "如果天气或交通风险高，必须提供室内/低风险备选方案。",
    "输出必须是 JSON，字段严格遵循给定 schema。"
  ].join("\n");

  const candidateBlocks = prepared.candidateRefs
    .map(({ refId, destination }) =>
      [
        `${refId} | ${destination.name}`,
        `位置：${destination.province}${destination.city}${destination.district ?? ""}`,
        `描述：${truncateText(destination.description, 70)}`,
        `标签：${(destination.tags || []).slice(0, 6).join("、") || "无"}`,
        `开放信息：${destination.openingHoursText || "请以官方数据为准"}`
      ].join("；")
    )
    .join("\n");

  const prompt = [
    strictGuard,
    "【用户出行条件】",
    JSON.stringify(
      {
        origin: prepared.input.origin,
        destinationQuery: prepared.input.destinationQuery || "",
        travelDate: prepared.input.travelDate,
        days: prepared.input.days,
        budgetMin: prepared.input.budgetMin ?? null,
        budgetMax: prepared.input.budgetMax ?? null,
        transportMode: prepared.input.transportMode,
        companions: prepared.input.companions,
        preferenceTags: prepared.input.preferenceTags,
        crowdPreference: prepared.input.crowdPreference,
        pacePreference: prepared.input.pacePreference,
        specialConstraints: prepared.input.specialConstraints || []
      },
      null,
      2
    ),
    "【动态信息】",
    `天气：${weatherInfo.summary}`,
    `交通：${trafficInfo.summary}`,
    "【知识库补充】",
    knowledgeInfo.summary || "无可用知识库补充",
    "【候选景点】",
    candidateBlocks,
    "【优先级策略】",
    priority === "high"
      ? "当前动态风险高：必须优先安全与可达性，减少远距离/高风险路线，提供至少1个备选方案。"
      : priority === "medium"
        ? "当前动态风险中等：需给出风险提示与时间缓冲。"
        : "当前动态风险较低：按用户偏好优先安排。",
    "【输出 Schema】",
    JSON.stringify(OUTPUT_SCHEMA_HINT, null, 2)
  ].join("\n\n");

  return success({ prompt, priority });
}

function buildFallbackStructured(prepared: PreparedRequest, weather: DynamicInfo, traffic: DynamicInfo): TravelPlanStructuredResponse {
  const base = prepared.candidateRefs[0];
  const budgetMin = prepared.input.budgetMin ?? 200;
  const budgetMax = prepared.input.budgetMax ?? Math.max(budgetMin + 200, 500);
  const dayCount = Math.max(1, prepared.input.days);

  const itinerary = Array.from({ length: dayCount }).map((_, index) => ({
    day: index + 1,
    destination_id: base.refId,
    destination_name: base.destination.name,
    activities: [
      `上午抵达${base.destination.name}并进行核心游览`,
      "中午在景区周边就餐并休整",
      "下午根据体力安排补充点位或返程"
    ],
    transport_plan: prepared.input.transportMode === "self_drive" ? "自驾优先，避开高峰拥堵时段" : "公共交通优先，预留换乘时间",
    meal_recommendations: ["优先本地口碑餐厅", "高峰期提前错峰就餐"],
    estimated_cost: Math.round((budgetMin + budgetMax) / 2 / dayCount)
  }));

  return {
    summary: `已基于当前数据生成${dayCount}天行程建议，优先推荐 ${base.destination.name}。`,
    weather_summary: weather.summary,
    traffic_summary: traffic.summary,
    budget_distribution: {
      transport: Math.round((budgetMin + budgetMax) * 0.2),
      lodging: Math.round((budgetMin + budgetMax) * (dayCount > 1 ? 0.3 : 0.1)),
      dining: Math.round((budgetMin + budgetMax) * 0.25),
      activities: Math.round((budgetMin + budgetMax) * 0.35),
      total_min: budgetMin,
      total_max: budgetMax
    },
    itinerary,
    dynamic_suggestions: [
      "若实时天气突变，优先调整为室内博物馆/展馆类点位。",
      "如返程拥堵升高，建议提前30-60分钟离场。"
    ],
    cautions: ["景区开放时间、临时管制与门票政策请以官方信息为准。"],
    warm_tips: ["出行前一天再次确认天气、路况、停车与预约情况。"],
    missing_data_notes: ["部分实时信息未能稳定获取，已使用平台静态数据回退。"]
  };
}

/**
 * generate_travel_plan
 * 总控函数：串联请求准备、动态信息、知识库、Prompt、模型生成与结构化校验。
 */
export async function generateTravelPlan(
  input: unknown,
  timeoutMs = 20000
): Promise<ServiceEnvelope<GenerateTravelPlanResult>> {
  const preparedResp = await prepareRequest(input);
  if (!preparedResp.ok || !preparedResp.data) {
    return failure(
      preparedResp.error?.code ?? "VALIDATION_ERROR",
      preparedResp.error?.message ?? "请求准备失败",
      preparedResp.error?.retryable ?? false,
      preparedResp.error?.detail
    );
  }
  const prepared = preparedResp.data;

  const [weatherResp, trafficResp, knowledgeResp] = await Promise.all([
    getWeatherInfo(prepared),
    getTrafficInfo(prepared),
    knowledgeServiceChat(prepared)
  ]);

  const weather =
    weatherResp.data ||
    ({
      summary: weatherFallback(prepared.context),
      priority: "medium",
      source: "fallback-context"
    } satisfies DynamicInfo);
  const traffic =
    trafficResp.data ||
    ({
      summary: trafficFallback(prepared.context),
      priority: "medium",
      source: "fallback-context"
    } satisfies DynamicInfo);
  const knowledge =
    knowledgeResp.data ||
    ({
      status: "failed",
      summary: "",
      references: []
    } satisfies KnowledgeResult);

  const promptResp = createTravelPlanPrompt(prepared, weather, traffic, knowledge);
  if (!promptResp.ok || !promptResp.data) {
    return failure("UNKNOWN_ERROR", "Prompt 生成失败", false);
  }

  const config = getAiConfig();
  let structured: TravelPlanStructuredResponse | null = null;
  let provider = "fallback";

  if (config) {
    try {
      const endpoint = `${config.baseURL}/chat/completions`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: config.model,
          temperature: 0.1,
          max_tokens: 1200,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "你是智能旅游规划师 + 数据解释器。必须输出JSON。禁止编造事实，无法确认的信息请标注“请以官方数据为准”。"
            },
            {
              role: "user",
              content: promptResp.data.prompt
            }
          ]
        })
      });

      if (response.ok) {
        const payload = await response.json();
        const text = parseResponseText(payload);
        if (text) {
          const parsed = JSON.parse(text) as unknown;
          const normalized = TRAVEL_PLAN_RESPONSE_SCHEMA.safeParse(parsed);
          if (normalized.success) {
            structured = normalized.data;
            provider = `${config.provider}:${config.model}`;
          }
        }
      }
    } catch {
      // 网络或模型错误时继续走 fallback，不抛出。
    }
  }

  if (!structured) {
    structured = buildFallbackStructured(prepared, weather, traffic);
  }

  const plannerDecision = toCompatDecision(provider, structured, prepared);
  return success(
    {
      request: prepared,
      weather,
      traffic,
      knowledge,
      prompt: promptResp.data.prompt,
      structured,
      plannerDecision
    },
    {
      provider,
      priority: promptResp.data.priority,
      weatherSource: weather.source,
      trafficSource: traffic.source,
      knowledgeStatus: knowledge.status
    }
  );
}
