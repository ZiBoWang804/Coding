import type { PlannerRoutePlan } from "@/lib/planner/types";

type TransitTarget = {
  name: string;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  publicTransitFriendlyScore?: number | null;
  lastMileDifficulty?: number | null;
  nearestRailStation?: string | null;
};

export interface TransitGuide {
  originLabel: string;
  destinationLabel: string;
  transitRouteUrl: string;
  subwaySearchUrl: string;
  destinationSearchUrl: string;
  summary: string;
  lastMileTip: string;
  transferHub: string;
  suggestedSteps: string[];
  caution: string;
}

const XIAN_CENTER = { latitude: 34.3416, longitude: 108.9398 };

function encode(value: string) {
  return encodeURIComponent(value);
}

function compact(parts: Array<string | null | undefined>) {
  return parts.map((item) => item?.trim()).filter(Boolean) as string[];
}

function buildDestinationLabel(target: TransitTarget) {
  return compact([target.city, target.district, target.name]).join(" ");
}

function buildAmapSearchUrl(keyword: string, city?: string | null) {
  const cityQuery = city ? `&city=${encode(city)}` : "";
  return `https://uri.amap.com/search?keyword=${encode(keyword)}${cityQuery}`;
}

function buildAmapTransitRouteUrl(origin: string, target: TransitTarget) {
  if (target.longitude != null && target.latitude != null) {
    return `https://uri.amap.com/navigation?from=${encode(origin)}&to=${target.longitude},${target.latitude},${encode(target.name)}&mode=bus&src=youxiangji&coordinate=gaode&callnative=0`;
  }

  return buildAmapSearchUrl(`${origin} 到 ${buildDestinationLabel(target)} 公交地铁`, target.city);
}

function buildLastMileTip(target: TransitTarget) {
  if ((target.lastMileDifficulty ?? 0) >= 4) {
    return "末段接驳较弱，建议在最近换乘点后预留打车或步行时间。";
  }

  if ((target.lastMileDifficulty ?? 0) >= 3) {
    return "公共交通可以到达，但最后一段通常还需要再换乘一次。";
  }

  return "公共交通衔接相对顺畅，适合直接查询联程方案。";
}

function buildSummary(target: TransitTarget) {
  const score = target.publicTransitFriendlyScore ?? 0;

  if (score >= 3.8) {
    return "这个目的地比较适合从西安市区走“地铁 + 公交”的联程方案。";
  }

  if (score >= 2.8) {
    return "可以从西安市区走公共交通前往，但末段接驳需要多留一点时间。";
  }

  return "已经为你准备了公共交通查询入口，不过这个目的地整体仍偏依赖末段接驳。";
}

function inferTransferHub(target: TransitTarget) {
  const text = `${target.city ?? ""} ${target.district ?? ""} ${target.address ?? ""}`;

  if (/长安|航天|王曲|秦岭/.test(text)) return "城南换乘带";
  if (/鄠邑|户县/.test(text)) return "城西至鄠邑换乘带";
  if (/蓝田/.test(text)) return "纺织城至蓝田换乘带";
  if (/临潼/.test(text)) return "纺织城至临潼换乘带";
  if (/高陵/.test(text)) return "行政中心至高陵换乘带";
  if (/周至/.test(text)) return "城西客运至周至换乘带";
  if (/咸阳|礼泉/.test(text)) return "城西或北客站跨城换乘带";

  return "西安市区综合换乘带";
}

function buildSuggestedSteps(origin: string, target: TransitTarget, transferHub: string) {
  const destination = buildDestinationLabel(target);
  const stationHint = target.nearestRailStation
    ? `优先留意 ${target.nearestRailStation} 一带的接驳信息。`
    : "优先查看高德里的最近公交站、地铁站和末段换乘点。";
  const lastMile =
    (target.lastMileDifficulty ?? 0) >= 4
      ? "到达换乘点后，建议直接衔接出租车、网约车或景区接驳车。"
      : (target.lastMileDifficulty ?? 0) >= 3
        ? "到达换乘点后，再换乘一段本地公交或短途接驳即可。"
        : "到达换乘点后，通常可以继续联程直达或近距离步行到达。";

  return [
    `从“${origin}”先接入最近的西安地铁站或主公交站，优先进入市区换乘网络。`,
    `中段建议朝“${transferHub}”方向换乘，那里通常更容易衔接去往 ${destination} 的区域公交或跨城线路。`,
    `${lastMile}${stationHint}`
  ];
}

function buildCaution(target: TransitTarget) {
  if ((target.lastMileDifficulty ?? 0) >= 4) {
    return "建议尽量白天出发，返程不要压太晚，并提前确认末班车时间。";
  }

  if ((target.publicTransitFriendlyScore ?? 0) < 2.8) {
    return "如果遇到换乘时间过长，可以改成“地铁/公交 + 打车”的组合方案。";
  }

  return "以高德地图实时换乘结果为准，出发前再确认一次班次和步行距离。";
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(target: TransitTarget) {
  if (target.latitude == null || target.longitude == null) return null;
  const earthRadiusKm = 6371;
  const latDelta = toRadians(target.latitude - XIAN_CENTER.latitude);
  const lngDelta = toRadians(target.longitude - XIAN_CENTER.longitude);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(XIAN_CENTER.latitude)) * Math.cos(toRadians(target.latitude)) * Math.sin(lngDelta / 2) ** 2;
  return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

function estimateDistanceKm(target: TransitTarget) {
  const coordinateDistance = haversineDistanceKm(target);
  if (coordinateDistance != null) return Math.max(8, coordinateDistance * 1.25);

  const text = `${target.city ?? ""} ${target.district ?? ""} ${target.address ?? ""}`;
  if (/临潼/.test(text)) return 36;
  if (/蓝田/.test(text)) return 48;
  if (/鄠邑|户县/.test(text)) return 42;
  if (/长安|王曲|秦岭/.test(text)) return 28;
  if (/高陵/.test(text)) return 32;
  if (/周至/.test(text)) return 78;
  return 20;
}

function estimateTransitMinutes(distanceKm: number, target: TransitTarget) {
  const difficulty = target.lastMileDifficulty ?? 3;
  const transitScore = target.publicTransitFriendlyScore ?? 2.8;
  const estimate = distanceKm * 2.2 + 35 + difficulty * 8 + Math.max(0, 3.5 - transitScore) * 15;
  return Math.max(35, Math.round(estimate));
}

function estimateDriveMinutes(distanceKm: number, target: TransitTarget) {
  const difficulty = target.lastMileDifficulty ?? 3;
  const estimate = distanceKm * 1.15 + 20 + Math.max(0, difficulty - 2) * 6;
  return Math.max(25, Math.round(estimate));
}

function estimateTransitStops(distanceKm: number) {
  return Math.max(4, Math.min(18, Math.round(distanceKm / 3.5)));
}

function estimateDirection(target: TransitTarget) {
  const text = `${target.city ?? ""} ${target.district ?? ""} ${target.address ?? ""}`;
  if (/临潼|蓝田/.test(text)) return "东向";
  if (/鄠邑|户县|周至/.test(text)) return "西向";
  if (/长安|秦岭|王曲/.test(text)) return "南向";
  if (/高陵/.test(text)) return "北向";
  return "目的地方向";
}

export function buildXiAnTransitGuide(origin: string, target: TransitTarget): TransitGuide {
  const normalizedOrigin = origin.trim() || "西安市区";
  const destinationLabel = buildDestinationLabel(target);
  const transferHub = inferTransferHub(target);

  return {
    originLabel: normalizedOrigin,
    destinationLabel,
    transitRouteUrl: buildAmapTransitRouteUrl(normalizedOrigin, target),
    subwaySearchUrl: buildAmapSearchUrl(`${normalizedOrigin} 到 ${destinationLabel} 地铁换乘`, target.city),
    destinationSearchUrl: buildAmapSearchUrl(target.address || destinationLabel, target.city),
    summary: buildSummary(target),
    lastMileTip: buildLastMileTip(target),
    transferHub,
    suggestedSteps: buildSuggestedSteps(normalizedOrigin, target, transferHub),
    caution: buildCaution(target)
  };
}

export function buildFallbackRoutePlans(origin: string, target: TransitTarget): PlannerRoutePlan[] {
  const guide = buildXiAnTransitGuide(origin, target);
  const distanceKm = estimateDistanceKm(target);
  const transitMinutes = estimateTransitMinutes(distanceKm, target);
  const driveMinutes = estimateDriveMinutes(distanceKm, target);
  const direction = estimateDirection(target);
  const destinationLabel = guide.destinationLabel || target.name;
  const transferStops = estimateTransitStops(distanceKm);
  const localStops = Math.max(2, Math.round((target.lastMileDifficulty ?? 3) + 1));

  const transitPlan: PlannerRoutePlan = {
    mode: "public_transit",
    summary: `估算公共交通约 ${transitMinutes} 分钟，约 ${distanceKm} 公里。`,
    durationMinutes: transitMinutes,
    distanceKm,
    walkingDistanceKm: Number((Math.max(0.8, (target.lastMileDifficulty ?? 3) * 0.4)).toFixed(1)),
    cost: Math.max(6, Math.round(distanceKm * 0.25)),
    caution: `当前为规则估算路线。${guide.caution}`,
    steps: [
      {
        mode: "walk",
        title: "前往最近换乘站",
        detail: `从 ${guide.originLabel} 步行或短距离接驳到最近的地铁站或主公交站。`,
        durationMinutes: 10,
        distanceKm: 0.8,
        stops: null
      },
      {
        mode: "subway",
        title: "进入城市主干换乘线",
        detail: `优先往 ${guide.transferHub} 方向换乘，建议选择地铁或快速公交主线。`,
        durationMinutes: Math.max(18, Math.round(transitMinutes * 0.35)),
        distanceKm: null,
        stops: transferStops
      },
      {
        mode: "bus",
        title: `换乘前往 ${destinationLabel}`,
        detail: `从 ${guide.transferHub} 继续换乘前往 ${destinationLabel} 的区域公交，方向建议走 ${direction}。`,
        durationMinutes: Math.max(20, Math.round(transitMinutes * 0.4)),
        distanceKm: null,
        stops: localStops
      },
      {
        mode: (target.lastMileDifficulty ?? 0) >= 4 ? "taxi" : "walk",
        title: (target.lastMileDifficulty ?? 0) >= 4 ? "末段打车接驳" : "末段步行到达",
        detail: guide.lastMileTip,
        durationMinutes: Math.max(8, Math.round(transitMinutes * 0.15)),
        distanceKm: Number((Math.max(1, (target.lastMileDifficulty ?? 3) * 0.5)).toFixed(1)),
        stops: null
      }
    ]
  };

  const drivingPlan: PlannerRoutePlan = {
    mode: "self_drive",
    summary: `估算自驾约 ${driveMinutes} 分钟，约 ${distanceKm} 公里。`,
    durationMinutes: driveMinutes,
    distanceKm,
    walkingDistanceKm: 0.2,
    cost: null,
    caution: "当前为规则估算路线，建议出发前再用地图确认实时拥堵和停车情况。",
    steps: [
      {
        mode: "drive",
        title: "驶入城市快速路",
        detail: `从 ${guide.originLabel} 出发，先接入城区快速路或绕城高速。`,
        durationMinutes: 12,
        distanceKm: 6,
        stops: null
      },
      {
        mode: "drive",
        title: `沿 ${direction} 前往目的地片区`,
        detail: `按 ${direction} 行驶到 ${destinationLabel} 所在片区，中途优先走主干道或高速。`,
        durationMinutes: Math.max(18, Math.round(driveMinutes * 0.45)),
        distanceKm: Number((distanceKm * 0.6).toFixed(1)),
        stops: null
      },
      {
        mode: "drive",
        title: "进入景区周边道路",
        detail: `接近 ${destinationLabel} 后转入景区周边县道、乡道或村道，注意减速和会车。`,
        durationMinutes: Math.max(10, Math.round(driveMinutes * 0.25)),
        distanceKm: Number((distanceKm * 0.25).toFixed(1)),
        stops: null
      },
      {
        mode: "walk",
        title: "停车后步行入园",
        detail: "停车后按现场导视步行到景点入口，建议预留拍照和找车位时间。",
        durationMinutes: 6,
        distanceKm: 0.3,
        stops: null
      }
    ]
  };

  return [transitPlan, drivingPlan];
}
