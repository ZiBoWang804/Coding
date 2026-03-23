import OpenAI from "openai";
import type { PlannerInput, PlannerResult } from "@/types";

function getAiConfig() {
  const preferred = process.env.AI_PROVIDER?.toLowerCase();

  if ((preferred === "ark" || !preferred) && process.env.ARK_API_KEY) {
    return {
      provider: "ark",
      apiKey: process.env.ARK_API_KEY,
      baseURL: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
      model: process.env.ARK_MODEL || "ep-20260322184009-6xlbl"
    };
  }

  if (preferred === "openai" && process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini"
    };
  }

  return null;
}

export async function buildAiPlannerSummary(input: PlannerInput, result: PlannerResult) {
  const config = getAiConfig();
  if (!config) return null;

  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });

    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: "你是乡村旅游规划顾问。请基于规则引擎结果输出中文详细建议，禁止编造实时车次、实时价格和未提供的精确事实。可以给出合理的交通方式建议和预算拆分，但要明确是估算。"
        },
        {
          role: "user",
          content: `请根据以下信息，生成适合直接展示在前端的详细规划建议。\n\n用户输入：${JSON.stringify(input)}\n\n规则引擎结果：${JSON.stringify({
            summary: result.summary,
            budgetEstimate: result.budgetEstimate,
            itinerary: result.itinerary,
            notes: result.notes,
            packingList: result.packingList,
            routeChecklist: result.routeChecklist,
            topMatches: result.topMatches.slice(0, 3).map((item) => ({
              name: item.spot.name,
              province: item.spot.province,
              city: item.spot.city,
              avgCost: item.spot.avgCost,
              transportInfo: item.spot.transportInfo,
              suggestedDuration: item.spot.suggestedDuration,
              routeHighlights: item.spot.routeHighlights,
              reasons: item.reasons
            }))
          })}\n\n请按以下结构输出，使用自然中文，不要 Markdown 标题符号：\n总览\n详细线路\n交通建议\n花费估算\n必备物品\n打卡路线清单\n注意事项\n\n要求：\n1. 详细线路要按天拆分。\n2. 交通建议要区分自驾和公共交通的适配情况。\n3. 花费估算要拆成交通、住宿、餐饮、体验四类。\n4. 必备物品和打卡路线清单分别给出 4 到 6 条。\n5. 注意事项写 3 到 5 条。\n6. 总字数控制在 420 到 650 字。`
        }
      ]
    });

    return {
      provider: `${config.provider}:${config.model}`,
      text: response.choices[0]?.message?.content?.trim() || null
    };
  } catch {
    return null;
  }
}