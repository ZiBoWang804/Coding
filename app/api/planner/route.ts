import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSearchHistory, listSpots } from "@/lib/repository";
import { runPlannerEngine } from "@/lib/planner/planner";

function formatTransportMode(mode: "self_drive" | "public_transit" | "either") {
  if (mode === "self_drive") return "自驾";
  if (mode === "public_transit") return "公共交通";
  return "交通方式不限";
}

const plannerSchema = z.object({
  origin: z.string().min(1),
  travelDate: z.string().min(1),
  days: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  transportMode: z.union([z.literal("self_drive"), z.literal("public_transit"), z.literal("either")]),
  companions: z.union([z.literal("solo"), z.literal("couple"), z.literal("family"), z.literal("friends"), z.literal("elderly")]),
  preferenceTags: z.array(z.string()).default([]),
  crowdPreference: z.union([z.literal("lively"), z.literal("neutral"), z.literal("avoid_crowds")]).default("neutral"),
  pacePreference: z.union([z.literal("slow"), z.literal("moderate"), z.literal("multi_stop")]).default("moderate"),
  lodgingPreference: z.string().optional().nullable(),
  diningPreference: z.string().optional().nullable(),
  specialConstraints: z.array(z.string()).default([]),
  weather: z.object({
    condition: z.union([
      z.literal("sunny"),
      z.literal("cloudy"),
      z.literal("light_rain"),
      z.literal("heavy_rain"),
      z.literal("thunder"),
      z.literal("snow"),
      z.literal("fog"),
      z.literal("heat"),
      z.literal("cold"),
      z.literal("windy")
    ]).optional(),
    weatherSummary: z.string().optional(),
    temperatureHigh: z.number().optional(),
    temperatureLow: z.number().optional(),
    precipitationProbability: z.number().optional(),
    windLevel: z.number().optional(),
    aqi: z.number().optional(),
    severeWeatherAlert: z.boolean().optional()
  }).optional(),
  traffic: z.object({
    isWeekend: z.boolean().optional(),
    isHoliday: z.boolean().optional(),
    congestionLevel: z.number().optional(),
    roadClosureRisk: z.number().optional(),
    parkingStress: z.number().optional(),
    nightReturnRisk: z.number().optional()
  }).optional()
});

export async function POST(request: Request) {
  try {
    const payload = plannerSchema.parse(await request.json());
    const spots = await listSpots();
    const result = await runPlannerEngine(payload, spots);
    const user = await getCurrentUser();

    if (user) {
      void createSearchHistory(user.id, {
        query: `${payload.origin} · ${payload.days}天 · ${formatTransportMode(payload.transportMode)}`,
        preferences: payload.preferenceTags,
        resultIds: result.recommendedPlans.map((item) => item.destinationId)
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "规划请求失败" }, { status: 400 });
  }
}
