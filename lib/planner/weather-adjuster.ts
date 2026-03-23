import type { AdjustmentImpact, PlannerDestination, PlannerRuntimeContext } from "@/lib/planner/types";

export function getWeatherAdjustment(destination: PlannerDestination, context: PlannerRuntimeContext): AdjustmentImpact {
  const reasons: string[] = [];
  let scoreDelta = 0;
  let hardBlock = false;
  const condition = context.weather.condition;
  const tags = destination.tags;

  if (condition === "light_rain") {
    scoreDelta -= tags.includes("camping") ? 10 : tags.includes("ancient_village") ? 2 : 4;
    reasons.push(tags.includes("ancient_village") ? "小雨对古村漫步和拍照影响不大。" : "小雨会轻微降低户外舒适度。");
  }

  if (condition === "heavy_rain") {
    if (tags.some((tag) => ["mountain_view", "hiking_light", "camping", "water_view"].includes(tag))) {
      scoreDelta -= 18;
      reasons.push("暴雨会显著降低露天景观场景的安全性和舒适度。");
    } else {
      scoreDelta -= 8;
      reasons.push("暴雨会明显拉低整体体验。");
    }
  }

  if (condition === "thunder") {
    if (tags.some((tag) => ["camping", "mountain_view", "hiking_light", "water_view"].includes(tag))) {
      hardBlock = true;
      reasons.push("雷暴天气下，这个目的地今天不适合前往。");
    } else {
      scoreDelta -= 14;
      reasons.push("雷暴风险会明显削弱户外活动可行性。");
    }
  }

  if (condition === "heat") {
    if (tags.includes("summer_retreat") || destination.description.toLowerCase().includes("hot spring")) {
      scoreDelta += tags.includes("summer_retreat") ? 8 : -3;
      reasons.push(tags.includes("summer_retreat") ? "高温天气反而更凸显避暑型村落的优势。" : "高温会削弱缺乏遮阴空间的休闲体验。");
    } else {
      scoreDelta -= 7;
      reasons.push("高温会降低白天户外出行的舒适度。");
    }
  }

  if (condition === "cold" || condition === "windy") {
    if (tags.includes("camping")) {
      scoreDelta -= 10;
      reasons.push("寒冷或大风天气不适合露营型行程。");
    }
  }

  if (condition === "snow") {
    if ((destination.roadRiskLevel || 1) >= 3 || tags.includes("mountain_view")) {
      scoreDelta -= 16;
      reasons.push("降雪会抬高这条路线的自驾和步行风险。");
    }
  }

  if (condition === "fog") {
    if (tags.includes("mountain_view") || tags.includes("photography")) {
      scoreDelta -= 10;
      reasons.push("大雾会削弱观景能见度，也会提高山路驾驶压力。");
    }
  }

  if ((context.weather.aqi || 0) >= 130 && (context.user.companions === "elderly" || context.user.companions === "family")) {
    scoreDelta -= 8;
    reasons.push("空气质量一般时，长辈或亲子户外出行的适配度会下降。");
  }

  return { scoreDelta, reasons, hardBlock };
}
