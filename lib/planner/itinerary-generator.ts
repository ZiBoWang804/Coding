import type { AlternativeOption, ItineraryItem, PlannerDestination, PlannerRuntimeContext } from "@/lib/planner/types";

function formatOrigin(origin: string) {
  if (/^xi'?an urban area$/i.test(origin.trim())) return "西安市区";
  return origin;
}

function uniqueStrings(items: Array<string | null | undefined>) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function joinPlaceParts(items: Array<string | null | undefined>, separator = " · ") {
  return uniqueStrings(items).join(separator);
}

function getAreaLabel(destination: PlannerDestination) {
  return joinPlaceParts([destination.city, destination.district]) || destination.city || destination.province || destination.name;
}

function getPreciseLocation(destination: PlannerDestination) {
  return joinPlaceParts([destination.province, destination.city, destination.district, destination.address]);
}

function getRawSource(destination: PlannerDestination) {
  if (!destination.rawSource || typeof destination.rawSource !== "object") return null;
  return destination.rawSource as Record<string, unknown>;
}

function toNameList(value: unknown) {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "name" in item) return String((item as { name?: unknown }).name || "");
        return "";
      })
    );
  }

  if (typeof value === "string") {
    return uniqueStrings(value.split(/[、；，|/]/g));
  }

  return [];
}

function extractNearbyNames(destination: PlannerDestination, key: "accommodationTips" | "diningTips" | "routeHighlights") {
  const rawSource = getRawSource(destination);
  return toNameList(rawSource?.[key]).slice(0, 3);
}

function pickHighlights(destination: PlannerDestination, offset = 0, count = 2) {
  const pool = uniqueStrings([
    ...destination.scenicFeatures,
    ...extractNearbyNames(destination, "routeHighlights"),
    destination.name
  ]);

  if (pool.length <= count) return pool;

  const start = offset % pool.length;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  return rotated.slice(0, count);
}

function selectRoutePlan(destination: PlannerDestination, context: PlannerRuntimeContext) {
  if (!destination.routePlans?.length) return null;

  if (context.user.transportMode === "self_drive") {
    return destination.routePlans.find((plan) => plan.mode === "self_drive") || destination.routePlans[0];
  }

  if (context.user.transportMode === "public_transit") {
    return destination.routePlans.find((plan) => plan.mode === "public_transit") || destination.routePlans[0];
  }

  return [...destination.routePlans].sort((left, right) => left.durationMinutes - right.durationMinutes)[0];
}

export function buildTransportRecommendation(destination: PlannerDestination, context: PlannerRuntimeContext, fromLabel?: string) {
  const originLabel = fromLabel || formatOrigin(context.user.origin);
  const arrivalLabel = getPreciseLocation(destination);
  const routePlan = selectRoutePlan(destination, context);

  if (routePlan) {
    const cleanedSummary = routePlan.summary.replace(/[。；，\s]+$/g, "");
    const durationText = routePlan.durationMinutes > 0 ? `，全程约 ${routePlan.durationMinutes} 分钟` : "";
    const cautionText = routePlan.caution ? `；${routePlan.caution}` : "";
    return `${originLabel} 到 ${arrivalLabel} 建议${routePlan.mode === "self_drive" ? "自驾" : "公共交通"}前往，${cleanedSummary}${durationText}，先落到 ${getAreaLabel(destination)} 片区${cautionText}`;
  }

  if (destination.liveTravelMinutes != null) {
    return `${originLabel} 前往 ${arrivalLabel} 预计约 ${destination.liveTravelMinutes} 分钟，建议先确认 ${getAreaLabel(destination)} 的停车点或接驳入口。`;
  }

  if (destination.transportSummary?.trim()) {
    return `${originLabel} 前往 ${arrivalLabel} 可按这条路径执行：${destination.transportSummary}`;
  }

  return `${originLabel} 前往 ${arrivalLabel} 时，建议优先走 ${getAreaLabel(destination)} 主入口或游客中心方向，避免临近中午再跨区移动。`;
}

export function buildDiningRecommendation(destination: PlannerDestination) {
  const areaLabel = getAreaLabel(destination);
  const diningNames = extractNearbyNames(destination, "diningTips");

  if (diningNames.length >= 2) {
    return `午餐优先放在 ${areaLabel} 的 ${diningNames[0]} 或 ${diningNames[1]} 周边，建议 11:30 前后错峰入座。`;
  }

  if (diningNames.length === 1) {
    return `午餐优先安排在 ${areaLabel} 的 ${diningNames[0]} 周边，尽量避开 12:00-13:00 的排队高峰。`;
  }

  if (destination.diningSummary?.trim()) {
    return `${areaLabel} 周边餐饮可优先参考：${destination.diningSummary}，建议把用餐点控制在主游线步行可达范围内。`;
  }

  return `午餐建议放在 ${areaLabel} 景区主入口或步行可达的餐饮带，尽量不要为了吃饭临时绕到更远城区。`;
}

export function buildLodgingRecommendation(
  destination: PlannerDestination,
  context: PlannerRuntimeContext,
  nextDestination?: PlannerDestination | null
) {
  const currentArea = getAreaLabel(destination);
  const nextArea = nextDestination ? getAreaLabel(nextDestination) : null;
  const stayNames = extractNearbyNames(destination, "accommodationTips");

  if (context.user.days <= 1) {
    return `当天返程更稳妥；如需临时休息，优先在 ${currentArea} 交通更顺的酒店或民宿落脚。`;
  }

  if (stayNames.length >= 2) {
    return `如需过夜，优先住在 ${currentArea} 的 ${stayNames[0]} 或 ${stayNames[1]} 周边，${nextArea ? `第二天转去 ${nextArea} 会更顺。` : "方便次日继续机动安排或返程。"}`;
  }

  if (stayNames.length === 1) {
    return `如需过夜，可优先看 ${currentArea} 的 ${stayNames[0]} 周边住宿，${nextArea ? `方便次日继续往 ${nextArea} 方向出发。` : "也方便次日继续机动安排或返程。"}`;
  }

  if (destination.lodgingSummary?.trim()) {
    return `如需过夜，可优先参考 ${currentArea} 周边的 ${destination.lodgingSummary}，${nextArea ? `尽量兼顾第二天去 ${nextArea} 的出发便利。` : "并优先选择第二天返程更顺手的片区。"}`;
  }

  return `如需过夜，优先选择 ${currentArea} 交通便利、${nextArea ? `第二天前往 ${nextArea} 更顺手` : "第二天返程或机动安排更顺手"} 的住宿片区。`;
}

function chooseDailyDestinations(primary: PlannerDestination, supporting: PlannerDestination[], days: number) {
  const selected: PlannerDestination[] = [primary];
  const seen = new Set([primary.id]);
  const nearby = supporting.filter((item) => !seen.has(item.id) && (item.city === primary.city || item.province === primary.province));
  const others = supporting.filter((item) => !seen.has(item.id) && !nearby.some((candidate) => candidate.id === item.id));

  for (const bucket of [nearby, others]) {
    for (const item of bucket) {
      if (selected.length >= days) break;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      selected.push(item);
    }
  }

  while (selected.length < days) {
    selected.push(primary);
  }

  return selected.slice(0, days);
}

function buildMorningSegment(
  day: number,
  destination: PlannerDestination,
  context: PlannerRuntimeContext,
  previousDestination: PlannerDestination | null,
  highlightItems: string[]
): ItineraryItem {
  const location = getPreciseLocation(destination);
  const areaLabel = getAreaLabel(destination);
  const fromLabel = previousDestination ? getAreaLabel(previousDestination) : formatOrigin(context.user.origin);
  const changedArea = previousDestination ? previousDestination.id !== destination.id : false;
  const morningFocus = highlightItems.join("、");

  return {
    day,
    title:
      day === 1
        ? `第${day}天上午路线：${areaLabel}抵达与核心景区`
        : changedArea
          ? `第${day}天上午路线：转入${areaLabel}周边景区`
          : `第${day}天上午路线：${areaLabel}不同片区深度游`,
    startTime: day === 1 ? "09:00" : "08:30",
    endTime: "11:00",
    description:
      day === 1
        ? `从${fromLabel}出发先到${location}，上午优先完成 ${morningFocus} 的主游线，尽量在 11:00 前进入核心区，避开第一波集中过线人流。`
        : changedArea
          ? `早餐后从${fromLabel}转到${location}，上午主走 ${morningFocus}，把跨区移动放在早段完成，避免把换场时间压到中午。`
          : `今天不重复前一天的主线，改走 ${location} 附近的 ${morningFocus}，把上午留给更安静或更适合慢逛的片区。`,
    location,
    transportTip: buildTransportRecommendation(destination, context, fromLabel)
  };
}

function buildMiddaySegment(day: number, destination: PlannerDestination, highlightItems: string[]): ItineraryItem {
  const areaLabel = getAreaLabel(destination);
  const middayFocus = highlightItems[0] || destination.name;

  return {
    day,
    title: `第${day}天午间路线：${areaLabel}景区周边午餐`,
    startTime: "11:30",
    endTime: "13:00",
    description: `中午回到 ${areaLabel} 主游线周边用餐并短休，下午再衔接 ${middayFocus} 一带的次级点位，尽量把步行和折返控制在一个片区内。`,
    location: `${areaLabel} 核心游览区周边`,
    mealTip: buildDiningRecommendation(destination)
  };
}

function buildAfternoonSegment(
  day: number,
  destination: PlannerDestination,
  context: PlannerRuntimeContext,
  nextDestination: PlannerDestination | null,
  highlightItems: string[]
): ItineraryItem {
  const areaLabel = getAreaLabel(destination);
  const isLastDay = day === context.user.days;
  const secondaryFocus = highlightItems[1] || highlightItems[0] || destination.name;
  const nextArea = nextDestination ? getAreaLabel(nextDestination) : areaLabel;

  return {
    day,
    title: isLastDay ? `第${day}天下午路线：${areaLabel}返程前收尾` : `第${day}天下午路线：${areaLabel}周边补景与慢游`,
    startTime: "13:30",
    endTime: isLastDay ? "16:30" : "17:30",
    description: isLastDay
      ? `下午补完 ${secondaryFocus} 附近更轻松的点位，16:30 前结束主游线，给取车、返程和临时堵车预留缓冲。`
      : nextDestination && nextDestination.id !== destination.id
        ? `下午把 ${secondaryFocus} 和城区慢游串起来，不再走回头路；今晚住在 ${nextArea} 方向，会更方便第二天继续往周边景区推进。`
        : `下午安排 ${secondaryFocus} 或街区慢游，把节奏明显放慢，不再重复上午已经走过的核心区。`,
    location: `${areaLabel} 周边补景片区`,
    transportTip: isLastDay
      ? `返程前先确认从 ${areaLabel} 回 ${formatOrigin(context.user.origin)} 的主干道通行情况，尽量避开 18:00 左右的出城高峰。`
      : nextDestination && nextDestination.id !== destination.id
        ? `傍晚转去 ${nextArea} 方向入住更顺，建议在 17:30 前完成跨区移动。`
        : `下午区间尽量步行或短距接驳，不建议临时再加一个远距离点位。`,
    stayTip: buildLodgingRecommendation(destination, context, nextDestination)
  };
}

export function shouldRegenerateItinerary(items: ItineraryItem[], expectedDays: number) {
  if (!items.length) return true;

  const groupedDays = new Map<number, ItineraryItem[]>();
  for (const item of items) {
    const bucket = groupedDays.get(item.day) || [];
    bucket.push(item);
    groupedDays.set(item.day, bucket);
  }

  if (groupedDays.size < expectedDays) return true;

  const oldTemplateTitleCount = items.filter((item) => /抵达与首段游览|午餐与休整|延展游览|轻松延展|缓冲与机动日|自由安排/.test(item.title)).length;
  const oldTemplateDescriptionCount = items.filter((item) => /建议在景区周边选择评价稳定|优先本地口碑餐厅|如果需要继续停留|根据返程安排灵活调整/.test(item.description)).length;
  const uniqueLocations = new Set(items.map((item) => String(item.location || "").trim()).filter(Boolean)).size;

  return oldTemplateTitleCount >= Math.max(3, expectedDays) || oldTemplateDescriptionCount >= Math.max(2, expectedDays) || (expectedDays > 1 && uniqueLocations <= 1);
}

export function generateItinerary(
  destination: PlannerDestination,
  context: PlannerRuntimeContext,
  supportingDestinations: PlannerDestination[] = []
): ItineraryItem[] {
  const normalizedDays = Math.max(1, Math.min(7, Math.round(context.user.days || 1)));
  const dailyDestinations = chooseDailyDestinations(destination, supportingDestinations, normalizedDays);
  const items: ItineraryItem[] = [];

  for (let index = 0; index < dailyDestinations.length; index += 1) {
    const day = index + 1;
    const dayDestination = dailyDestinations[index];
    const previousDestination = index > 0 ? dailyDestinations[index - 1] : null;
    const nextDestination = index + 1 < dailyDestinations.length ? dailyDestinations[index + 1] : null;
    const highlightItems = pickHighlights(dayDestination, index, 2);

    items.push(buildMorningSegment(day, dayDestination, context, previousDestination, highlightItems));
    items.push(buildMiddaySegment(day, dayDestination, highlightItems));
    items.push(buildAfternoonSegment(day, dayDestination, context, nextDestination, highlightItems));
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
