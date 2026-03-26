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

  return [
    {
      day: 1,
      title: "出发与抵达",
      startTime: context.user.days === 1 ? "08:00" : "09:00",
      endTime: "10:30",
      description: `建议从 ${origin} 尽早出发，在主要人流到来前抵达 ${destination.name}。${formatArrivalWindow(destination)}`,
      location: destination.address || `${destination.city} ${destination.province}`,
      transportTip: destination.transportSummary || "出发前再确认导航路线、停车点或末段接驳。"
    },
    {
      day: 1,
      title: "核心游览时段",
      startTime: "10:30",
      endTime: "13:30",
      description: `优先游览 ${destination.scenicFeatures.slice(0, 2).join("、") || destination.name} 等主要亮点。`,
      mealTip: destination.diningSummary || "午餐建议尽量安排在核心游览区附近，减少来回折返。"
    },
    {
      day: 1,
      title: "下午弹性安排",
      startTime: "14:30",
      endTime: context.user.days === 1 ? "17:30" : "18:30",
      description: destination.tags.includes("photography")
        ? "下午优先留给适合拍照的街区、田野或观景点，避免把黄金时段浪费在长距离移动上。"
        : "下午适合慢逛、补体验项目，或者安排一段更轻松的在地休闲时间。",
      stayTip:
        context.user.days >= 2
          ? destination.lodgingSummary || "如果需要过夜，建议傍晚前完成入住。"
          : "如果包含山路或远郊返程，建议天黑前离开。"
    }
  ];
}

function buildExtendedDay(day: number, destination: PlannerDestination, context: PlannerRuntimeContext): ItineraryItem {
  if (day === 2) {
    return {
      day,
      title: "第二天轻松延展",
      startTime: "09:30",
      endTime: "16:00",
      description: destination.tags.includes("family_interaction")
        ? "第二天建议走轻松节奏：睡到自然醒，安排一个互动项目，午餐后再返程。"
        : "第二天适合补看周边片区、地方集市或留白休息，再以更轻松的节奏返程。",
      mealTip: destination.diningSummary || "离开前优先选择评价稳定的本地餐饮点。",
      stayTip: "建议早餐后退房，尽量避开返程高峰。"
    };
  }

  if (day === 3) {
    return {
      day,
      title: "缓冲与机动日",
      startTime: "10:00",
      endTime: "15:00",
      description: "第三天可作为缓冲时间，用于应对天气变化、补看遗漏亮点，或顺路安排一个更轻松的在地体验。",
      transportTip: "建议中午前后返程，减少高速和城区拥堵概率。"
    };
  }

  return {
    day,
    title: `第 ${day} 天自由安排`,
    startTime: "10:00",
    endTime: "17:00",
    description: destination.tags.includes("local_food")
      ? "这一天适合放慢节奏，把更多时间留给本地餐饮、慢逛村落和周边休闲项目。"
      : "这一天更适合做松弛型安排：减少换点频率，把时间留给补景、散步和休息。",
    stayTip: context.user.days > day ? "如果还会继续停留，建议提前确认下一晚住宿和天气变化。" : "若当天返程，建议提前确认返程路况。"
  };
}

export function generateItinerary(destination: PlannerDestination, context: PlannerRuntimeContext): ItineraryItem[] {
  const normalizedDays = Math.max(1, Math.min(7, Math.round(context.user.days || 1)));
  const items = buildDayOne(destination, context);

  for (let day = 2; day <= normalizedDays; day += 1) {
    items.push(buildExtendedDay(day, destination, context));
  }

  return items;
}

export function buildAlternativeOptions(destinations: PlannerDestination[]): AlternativeOption[] {
  return destinations.slice(0, 2).map((destination) => ({
    destinationId: destination.id,
    destinationName: destination.name,
    reason: destination.tags.includes("family_interaction")
      ? "如果更看重亲子互动体验，这个备选会更合适。"
      : destination.tags.includes("local_food")
        ? "如果更看重餐饮和成熟配套，这个备选更稳妥。"
        : "如果更想要人少一点、节奏更轻一点，可以把它作为备选。"
  }));
}
