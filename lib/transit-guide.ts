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

  return buildAmapSearchUrl(`${origin} \u5230 ${buildDestinationLabel(target)} \u516c\u4ea4\u5730\u94c1`, target.city);
}

function buildLastMileTip(target: TransitTarget) {
  if ((target.lastMileDifficulty ?? 0) >= 4) {
    return "\u672b\u6bb5\u63a5\u9a73\u8f83\u5f31\uff0c\u5efa\u8bae\u5730\u94c1\u6216\u516c\u4ea4\u5230\u6700\u8fd1\u6362\u4e58\u70b9\u540e\uff0c\u9884\u7559\u6253\u8f66\u6216\u6b65\u884c\u65f6\u95f4\u3002";
  }

  if ((target.lastMileDifficulty ?? 0) >= 3) {
    return "\u516c\u5171\u4ea4\u901a\u53ef\u4ee5\u5230\u8fbe\uff0c\u4f46\u6700\u540e\u4e00\u6bb5\u901a\u5e38\u9700\u8981\u518d\u6362\u4e58\u4e00\u6b21\u516c\u4ea4\u3001\u73ed\u7ebf\u6216\u7f51\u7ea6\u8f66\u3002";
  }

  return "\u516c\u5171\u4ea4\u901a\u8854\u63a5\u76f8\u5bf9\u987a\u7545\uff0c\u9002\u5408\u76f4\u63a5\u67e5\u8be2\u5730\u94c1\u4e0e\u516c\u4ea4\u8054\u7a0b\u3002";
}

function buildSummary(target: TransitTarget) {
  const score = target.publicTransitFriendlyScore ?? 0;

  if (score >= 3.8) {
    return "\u8fd9\u4e2a\u76ee\u7684\u5730\u6bd4\u8f83\u9002\u5408\u4ece\u897f\u5b89\u5e02\u533a\u8d70\u201c\u5730\u94c1 + \u516c\u4ea4\u201d\u8054\u7a0b\u524d\u5f80\u3002";
  }

  if (score >= 2.8) {
    return "\u53ef\u4ee5\u4ece\u897f\u5b89\u5e02\u533a\u8d70\u516c\u5171\u4ea4\u901a\u524d\u5f80\uff0c\u4f46\u672b\u6bb5\u63a5\u9a73\u9700\u8981\u591a\u7559\u4e00\u70b9\u65f6\u95f4\u3002";
  }

  return "\u5df2\u7ecf\u4e3a\u4f60\u51c6\u5907\u4e86\u516c\u5171\u4ea4\u901a\u67e5\u8be2\u5165\u53e3\uff0c\u4e0d\u8fc7\u8fd9\u4e2a\u76ee\u7684\u5730\u6574\u4f53\u4ecd\u504f\u4f9d\u8d56\u672b\u6bb5\u63a5\u9a73\u3002";
}

function inferTransferHub(target: TransitTarget) {
  const text = `${target.city ?? ""} ${target.district ?? ""} ${target.address ?? ""}`;

  if (/\u957f\u5b89|\u822a\u5929|\u738b\u66f2|\u79e6\u5cad/.test(text)) return "\u57ce\u5357\u6362\u4e58\u5e26";
  if (/\u6237\u53bf|\u9120\u9091/.test(text)) return "\u57ce\u897f\u81f3\u9120\u9091\u6362\u4e58\u5e26";
  if (/\u84dd\u7530/.test(text)) return "\u7eba\u7ec7\u57ce\u81f3\u84dd\u7530\u6362\u4e58\u5e26";
  if (/\u4e34\u6f7c/.test(text)) return "\u7eba\u7ec7\u57ce\u81f3\u4e34\u6f7c\u6362\u4e58\u5e26";
  if (/\u9ad8\u9675/.test(text)) return "\u884c\u653f\u4e2d\u5fc3\u81f3\u9ad8\u9675\u6362\u4e58\u5e26";
  if (/\u5468\u81f3/.test(text)) return "\u57ce\u897f\u5ba2\u8fd0\u81f3\u5468\u81f3\u6362\u4e58\u5e26";
  if (/\u54b8\u9633|\u793c\u6cc9/.test(text)) return "\u57ce\u897f\u6216\u5317\u5ba2\u7ad9\u8de8\u57ce\u6362\u4e58\u5e26";

  return "\u897f\u5b89\u5e02\u533a\u7efc\u5408\u6362\u4e58\u5e26";
}

function buildSuggestedSteps(origin: string, target: TransitTarget, transferHub: string) {
  const destination = buildDestinationLabel(target);
  const stationHint = target.nearestRailStation
    ? `\u4f18\u5148\u7559\u610f ${target.nearestRailStation} \u4e00\u5e26\u7684\u63a5\u9a73\u4fe1\u606f\u3002`
    : "\u4f18\u5148\u67e5\u770b\u9ad8\u5fb7\u4e2d\u7684\u6700\u8fd1\u516c\u4ea4\u7ad9\u3001\u5730\u94c1\u7ad9\u548c\u672b\u6bb5\u6362\u4e58\u70b9\u3002";
  const lastMile = (target.lastMileDifficulty ?? 0) >= 4
    ? "\u5230\u8fbe\u67a2\u7ebd\u540e\uff0c\u5efa\u8bae\u76f4\u63a5\u8854\u63a5\u51fa\u79df\u8f66\u3001\u7f51\u7ea6\u8f66\u6216\u666f\u533a\u63a5\u9a73\u3002"
    : (target.lastMileDifficulty ?? 0) >= 3
      ? "\u5230\u8fbe\u67a2\u7ebd\u540e\uff0c\u518d\u6362\u4e58\u4e00\u6bb5\u672c\u5730\u516c\u4ea4\u6216\u77ed\u9014\u63a5\u9a73\u5373\u53ef\u3002"
      : "\u5230\u8fbe\u67a2\u7ebd\u540e\uff0c\u901a\u5e38\u53ef\u4ee5\u7ee7\u7eed\u516c\u4ea4\u8054\u7a0b\u76f4\u8fbe\u6216\u8fd1\u8ddd\u79bb\u6b65\u884c\u5230\u8fbe\u3002";

  return [
    `\u4ece\u201c${origin}\u201d\u5148\u63a5\u5165\u6700\u8fd1\u7684\u897f\u5b89\u5730\u94c1\u7ad9\u6216\u4e3b\u516c\u4ea4\u7ad9\uff0c\u4f18\u5148\u8d70\u5730\u94c1\u4e3b\u5e72\u7ebf\u8fdb\u5165\u5e02\u533a\u6362\u4e58\u7f51\u7edc\u3002`,
    `\u4e2d\u6bb5\u5efa\u8bae\u671d\u201c${transferHub}\u201d\u65b9\u5411\u6362\u4e58\uff0c\u90a3\u91cc\u901a\u5e38\u66f4\u5bb9\u6613\u8854\u63a5\u53bb\u5f80 ${destination} \u7684\u57ce\u9645\u516c\u4ea4\u3001\u73ed\u7ebf\u6216\u533a\u57df\u516c\u4ea4\u3002`,
    `${lastMile}${stationHint}`
  ];
}

function buildCaution(target: TransitTarget) {
  if ((target.lastMileDifficulty ?? 0) >= 4) {
    return "\u5efa\u8bae\u5c3d\u91cf\u767d\u5929\u51fa\u53d1\uff0c\u8fd4\u7a0b\u4e0d\u8981\u538b\u592a\u665a\uff0c\u5e76\u63d0\u524d\u786e\u8ba4\u672b\u73ed\u8f66\u65f6\u95f4\u3002";
  }

  if ((target.publicTransitFriendlyScore ?? 0) < 2.8) {
    return "\u5982\u679c\u9047\u5230\u6362\u4e58\u65f6\u95f4\u8fc7\u957f\uff0c\u53ef\u4ee5\u6539\u4e3a\u201c\u5730\u94c1/\u516c\u4ea4 + \u6253\u8f66\u201d\u7684\u7ec4\u5408\u65b9\u6848\u3002";
  }

  return "\u4ee5\u9ad8\u5fb7\u5730\u56fe\u5b9e\u65f6\u6362\u4e58\u7ed3\u679c\u4e3a\u51c6\uff0c\u51fa\u53d1\u524d\u518d\u786e\u8ba4\u4e00\u6b21\u73ed\u6b21\u548c\u6b65\u884c\u8ddd\u79bb\u3002";
}

export function buildXiAnTransitGuide(origin: string, target: TransitTarget): TransitGuide {
  const normalizedOrigin = origin.trim() || "\u897f\u5b89\u5e02\u533a";
  const destinationLabel = buildDestinationLabel(target);
  const transferHub = inferTransferHub(target);

  return {
    originLabel: normalizedOrigin,
    destinationLabel,
    transitRouteUrl: buildAmapTransitRouteUrl(normalizedOrigin, target),
    subwaySearchUrl: buildAmapSearchUrl(`${normalizedOrigin} \u5230 ${destinationLabel} \u5730\u94c1\u6362\u4e58`, target.city),
    destinationSearchUrl: buildAmapSearchUrl(target.address || destinationLabel, target.city),
    summary: buildSummary(target),
    lastMileTip: buildLastMileTip(target),
    transferHub,
    suggestedSteps: buildSuggestedSteps(normalizedOrigin, target, transferHub),
    caution: buildCaution(target)
  };
}
