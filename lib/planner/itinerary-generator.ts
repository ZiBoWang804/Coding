import type { AlternativeOption, ItineraryItem, PlannerDestination, PlannerRuntimeContext } from "@/lib/planner/types";

function buildDayOne(destination: PlannerDestination, context: PlannerRuntimeContext): ItineraryItem[] {
  return [
    {
      day: 1,
      title: "出发与抵达",
      startTime: context.user.days === 1 ? "08:00" : "09:00",
      endTime: "10:00",
      description: `建议从 ${context.user.origin} 尽早出发，在主要人流到来前抵达 ${destination.name}。`,
      location: destination.address || `${destination.city}, ${destination.province}`,
      transportTip: destination.transportSummary || "建议优先走主干道，并提前确认最后一段导航路线。"
    },
    {
      day: 1,
      title: "核心游览时段",
      startTime: "10:00",
      endTime: "13:00",
      description: `以适中节奏游览 ${destination.scenicFeatures.slice(0, 2).join("、") || destination.name} 等核心亮点。`,
      mealTip: destination.diningSummary || "午餐建议安排在村落核心区域附近，减少来回折返。"
    },
    {
      day: 1,
      title: "下午弹性时段",
      startTime: "14:00",
      endTime: context.user.days === 1 ? "17:00" : "18:00",
      description: destination.tags.includes("photography")
        ? "建议把黄金时段留给适合出片的街巷、田野或高点观景位。"
        : "下午可以安排慢逛、文化体验或亲子互动项目。",
      stayTip: context.user.days >= 2 ? destination.lodgingSummary || "如需过夜，建议傍晚前完成入住。" : "如果包含山路或环山路线，建议天黑前返程。"
    }
  ];
}

export function generateItinerary(destination: PlannerDestination, context: PlannerRuntimeContext): ItineraryItem[] {
  const items = buildDayOne(destination, context);

  if (context.user.days >= 2) {
    items.push({
      day: 2,
      title: "第二天轻松延展",
      startTime: "09:30",
      endTime: "15:30",
      description: destination.tags.includes("family_interaction")
        ? "第二天建议走轻松节奏：睡到自然醒，安排一个互动项目，午餐后尽早返程。"
        : "第二天适合补充第二个景观片区、逛本地市集，再以更轻松的节奏返回。",
      mealTip: destination.diningSummary || "离开目的地前，优先选择口碑稳定的本地餐饮点。",
      stayTip: "建议早餐后退房，尽量避开返程高峰。"
    });
  }

  if (context.user.days === 3) {
    items.push({
      day: 3,
      title: "缓冲与机动日",
      startTime: "10:00",
      endTime: "14:00",
      description: "第三天可以作为机动时间，用于补看漏掉的亮点、应对天气变化，或顺路停留附近市集与村咖后返程。",
      transportTip: "建议中午前后出发返程，减少高速拥堵概率。"
    });
  }

  return items;
}

export function buildAlternativeOptions(destinations: PlannerDestination[]): AlternativeOption[] {
  return destinations.slice(0, 2).map((destination) => ({
    destinationId: destination.id,
    destinationName: destination.name,
    reason: destination.tags.includes("family_interaction")
      ? "如果更想要结构化的亲子互动体验，这个备选会更合适。"
      : destination.tags.includes("local_food")
        ? "如果你更看重餐饮和成熟服务配套，这个备选更稳妥。"
        : "如果你更希望人少一些、节奏更轻一点，可以把它作为备选。"
  }));
}
