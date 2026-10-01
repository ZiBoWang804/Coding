import type { AlternativeOption, ItineraryItem, PlannerDestination, PlannerRuntimeContext } from "@/lib/planner/types";

function formatOrigin(origin: string) {
  if (/^xi'?an urban area$/i.test(origin.trim())) return "西安市区";
  return origin;
}

function formatArrivalWindow(destination: PlannerDestination) {
  if (destination.liveTravelMinutes != null) {
    return `预计路程约 ${destination.liveTravelMinutes} 分钟，建议尽量提早出发。`;
  }
  return "建议尽量避开上午最晚一波出发高峰。";
}

function buildDayOne(destination: PlannerDestination, context: PlannerRuntimeContext): ItineraryItem[] {
  const origin = formatOrigin(context.user.origin);
  const hasOvernight = context.user.days >= 2;

  return [
    {
      day: 1,
      title: "上午 · 出发与抵达",
      startTime: context.user.days === 1 ? "08:00" : "09:00",
      endTime: "10:30",
      description: `建议从 ${origin} 尽早出发，在主要人流到来前抵达 ${destination.name}。${formatArrivalWindow(destination)}`,
      location: destination.address || `${destination.city}${destination.district ? `·${destination.district}` : ""}`,
      transportTip: destination.transportSummary || "出发前再确认导航路线、停车点或末段接驳。"
    },
    {
      day: 1,
      title: "中午 · 核心景点游览",
      startTime: "10:30",
      endTime: "13:30",
      description: `优先完成 ${destination.name} 最有代表性的核心看点，避免把黄金时段浪费在频繁换点上。`,
      mealTip: destination.diningSummary || "午餐尽量安排在核心游览区附近，减少往返折返。"
    },
    {
      day: 1,
      title: "下午 · 延展体验与拍照",
      startTime: "14:30",
      endTime: hasOvernight ? "18:00" : "17:30",
      description: destination.tags.includes("photography")
        ? "下午适合安排观景、拍照和慢节奏漫游，把出片点位放在光线更稳定的时段。"
        : "下午适合补充体验项目、慢逛周边或安排一段更轻松的在地休闲时间。",
      stayTip: hasOvernight
        ? destination.lodgingSummary || "建议傍晚前完成入住，把晚上时间留给休整或夜游。"
        : "如果包含山路或远郊返程，建议天黑前离开。"
    },
    ...(hasOvernight
      ? [
          {
            day: 1,
            title: "夜间 · 入住与夜游",
            startTime: "19:00",
            endTime: "21:00",
            description: destination.tags.includes("local_food")
              ? "晚上以入住、晚餐和夜间轻度活动为主，适合安排本地特色餐饮或夜市体验。"
              : "晚上以入住和休整为主，如目的地适合夜游，可安排短时夜景或演出体验。",
            mealTip: "晚餐优先选择离住宿近、评价稳定的餐厅。",
            stayTip: "夜间不建议再增加跨区移动，给第二天保留体力。"
          }
        ]
      : [])
  ];
}

function buildMiddleDay(day: number, destination: PlannerDestination, context: PlannerRuntimeContext): ItineraryItem[] {
  return [
    {
      day,
      title: "上午 · 深度游览",
      startTime: "09:00",
      endTime: "11:30",
      description: destination.tags.includes("family_interaction")
        ? "上午优先安排互动性更强、停留时间更稳定的体验项目，适合亲子或陪伴型出行。"
        : "上午继续完成前一天未覆盖的重点区域，安排更完整的深度游览。",
      transportTip: "当天尽量减少跨区域折返，把主要时间留给核心内容。"
    },
    {
      day,
      title: "中午 · 在地午餐与休整",
      startTime: "11:30",
      endTime: "13:30",
      description: "中午以就近午餐和短暂休整为主，控制节奏，避免下午体力明显下滑。",
      mealTip: destination.diningSummary || "优先选择本地口碑稳定、出餐效率高的餐厅。"
    },
    {
      day,
      title: "下午 · 周边延展或自由活动",
      startTime: "14:00",
      endTime: "17:30",
      description: destination.tags.includes("local_food")
        ? "下午适合安排周边街区慢逛、地方小吃和轻量级休闲项目，拉开和首日核心景点的节奏差异。"
        : "下午适合安排周边补充点位、轻徒步、拍照或自由活动，避免再加入过远景点。",
      stayTip: context.user.days > day ? "如果次日继续停留，建议提前确认下一晚住宿和天气变化。" : "如次日返程，晚上不建议再排高强度项目。"
    }
  ];
}

function buildLastDay(day: number, destination: PlannerDestination, context: PlannerRuntimeContext): ItineraryItem[] {
  return [
    {
      day,
      title: "上午 · 收尾体验",
      startTime: "09:00",
      endTime: "11:00",
      description: "最后一天以轻量级收尾内容为主，可补看遗漏点位、买特产或再完成一段短时体验。",
      transportTip: "返程日不建议再安排耗时长、不可控性高的远点位。"
    },
    {
      day,
      title: "中午 · 午餐与退房",
      startTime: "11:00",
      endTime: "13:00",
      description: "中午完成午餐、退房或返程前整理，预留弹性缓冲，避免卡点出发。",
      mealTip: "午餐尽量安排在返程路线上，减少多余绕路。",
      stayTip: context.user.days > 1 ? "如有住宿，建议午前完成退房并确认返程时间。" : undefined
    },
    {
      day,
      title: "下午 · 返程",
      startTime: "13:30",
      endTime: "17:30",
      description: `下午从 ${destination.name} 返程，尽量避开晚高峰和高拥堵路段，给回程保留足够缓冲。`,
      transportTip: "返程前再次确认路况、停车取车或换乘时间。"
    }
  ];
}

function buildSingleDay(destination: PlannerDestination, context: PlannerRuntimeContext) {
  return [
    {
      day: 1,
      title: "上午 · 抵达与核心游览",
      startTime: "08:00",
      endTime: "11:30",
      description: `从 ${formatOrigin(context.user.origin)} 出发后，优先完成 ${destination.name} 最值得看的核心部分。`,
      location: destination.address || destination.city,
      transportTip: destination.transportSummary || "尽量在上午完成主要移动。"
    },
    {
      day: 1,
      title: "中午 · 午餐与休整",
      startTime: "11:30",
      endTime: "13:30",
      description: "中午安排就近午餐和短暂休整，避免全天节奏过紧。",
      mealTip: destination.diningSummary || "优先选择景区周边评价稳定的餐厅。"
    },
    {
      day: 1,
      title: "下午 · 延展体验与返程准备",
      startTime: "13:30",
      endTime: "17:30",
      description: "下午安排补充点位、慢逛或拍照，随后提前准备返程，避免拖到夜间。",
      stayTip: "如遇天气变化或拥堵上升，优先提前返程。"
    }
  ];
}

export function generateItinerary(destination: PlannerDestination, context: PlannerRuntimeContext): ItineraryItem[] {
  const normalizedDays = Math.max(1, Math.min(7, Math.round(context.user.days || 1)));
  if (normalizedDays === 1) return buildSingleDay(destination, context);

  const items = [...buildDayOne(destination, context)];

  for (let day = 2; day <= normalizedDays; day += 1) {
    if (day === normalizedDays) {
      items.push(...buildLastDay(day, destination, context));
      continue;
    }

    items.push(...buildMiddleDay(day, destination, context));
  }

  return items;
}

export function buildAlternativeOptions(destinations: PlannerDestination[]): AlternativeOption[] {
  return destinations.slice(0, 2).map((destination) => ({
    destinationId: destination.id,
    destinationName: destination.name,
    reason: destination.tags.includes("family_interaction")
      ? "如果更看重亲子互动或陪伴型体验，这个备选更合适。"
      : destination.tags.includes("local_food")
        ? "如果更看重餐饮和成熟配套，这个备选会更稳妥。"
        : "如果更想要人少一点、节奏更轻一点，可以把它作为备选。"
  }));
}
