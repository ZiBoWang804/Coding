import { buildGenericHotelUrl, buildGenericTicketUrl } from "@/lib/utils";
import type { NearbyItem } from "@/types";

export interface TravelResourceSpotLike {
  name: string;
  city: string;
  district?: string | null;
  address?: string | null;
  description?: string | null;
  tags?: string[];
  accommodationTips?: NearbyItem[] | string[] | null;
  avgCost?: number | null;
  rating?: number | null;
  sourceUrl?: string | null;
  lodgingSummary?: string | null;
  lodgingPriceMin?: number | null;
  lodgingPriceMax?: number | null;
  hotelBookingUrl?: string | null;
  ticketBookingUrl?: string | null;
  transportLinks?: {
    hotelBookingUrl?: string | null;
    ticketBookingUrl?: string | null;
    gaodeNavigationUrl?: string | null;
  };
}

export interface HotelReference {
  name: string;
  platform: "official" | "ctrip" | "huazhu";
  description: string;
  bookingUrl: string;
  actionLabel: string;
  priceText: string;
  note: string;
}

export interface TicketReference {
  type: "official_ticket" | "official_site" | "platform_search";
  label: string;
  url: string;
  note: string;
}

export interface SpotTravelResources {
  hotels: HotelReference[];
  hotelEntryUrl: string;
  hotelEntryLabel: string;
  hotelEntryNote: string;
  lodgingReferenceText: string;
  ticket: TicketReference;
}

interface OfficialSpotOverride {
  matcher: RegExp;
  officialSiteUrl: string;
  officialSiteLabel?: string;
  ticketRequired?: boolean;
  ticket?: {
    url: string;
    label: string;
    note: string;
  };
  hotel?: {
    name: string;
    url: string;
    actionLabel: string;
    description: string;
    priceText?: string;
    note: string;
  };
}

const HUAZHU_HOME_URL = "https://m.huazhu.com/Hotel/Index";
const TRUSTED_TRAVEL_HOSTS = [
  "ctrip.com",
  "trip.com",
  "qunar.com",
  "ly.com",
  "elong.com",
  "tongcheng.com",
  "fliggy.com",
  "meituan.com",
  "huazhu.com",
  "booking.com",
  "hotels.com"
];
const UNRELIABLE_INFO_HOST_KEYWORDS = [
  "gov.cn",
  "gov",
  "news",
  "blog",
  "weixin",
  "wechat",
  "xhslink",
  "xiaohongshu",
  "zhihu",
  "toutiao",
  "qq.com",
  "163.com",
  "sohu.com",
  "sina.com",
  "bilibili.com",
  "douyin.com",
  "kuaishou.com",
  "baidu.com"
];
const ARTICLE_PATH_PATTERNS = [/\/(art|article|detail|details|content|news|show|info)\b/i, /\.s?html?$/i, /\/\d{6,}(?:\/|$)/];
const NON_BOOKING_TRAVEL_PATH_PATTERNS = [/travel-guide/i, /\/sight\//i, /\/attraction\//i, /\/guide\//i, /\/tourism\//i];
const TICKET_REQUIRED_KEYWORDS = [
  "\u666f\u533a",
  "\u53e4\u9547",
  "\u4e50\u56ed",
  "\u535a\u7269\u9986",
  "\u535a\u7269\u9662",
  "\u68ee\u6797\u516c\u56ed",
  "\u56fd\u5bb6\u516c\u56ed",
  "\u5ea6\u5047\u533a",
  "\u6e29\u6cc9",
  "\u5f71\u89c6\u57ce",
  "\u52a8\u7269\u56ed",
  "\u690d\u7269\u56ed",
  "\u9057\u5740"
];
const LIKELY_FREE_KEYWORDS = [
  "\u6751",
  "\u53e4\u8857",
  "\u8001\u8857",
  "\u8857\u533a",
  "\u4e61\u6751",
  "\u6162\u57ce",
  "\u53e4\u6751",
  "\u827a\u672f\u6751",
  "\u6587\u5316\u6751"
];
const ACCOMMODATION_NAME_PATTERNS = /(\u9152\u5e97|\u6c11\u5bbf|\u5ba2\u6808|\u5c71\u5c45|\u9662\u843d|\u5c0f\u9662|\u9a7f\u7ad9|\u5ea6\u5047\u6751|hotel|house)/i;

const OFFICIAL_SPOT_OVERRIDES: OfficialSpotOverride[] = [
  {
    matcher: /\u7bdd\u5cad/,
    officialSiteUrl: "https://www.wyhl.cc/",
    officialSiteLabel: "\u7bdd\u5cad\u666f\u533a\u5b98\u7f51",
    ticketRequired: true,
    ticket: {
      url: "https://www.wyhl.cc/site/wyhl/zxyy/pwyd/detail2024-07-05-2.html",
      label: "\u5b98\u65b9\u552e\u7968\u5165\u53e3",
      note: "\u5df2\u4f18\u5148\u63a5\u5165\u7bdd\u5cad\u666f\u533a\u5b98\u7f51\u7968\u52a1\u5165\u53e3\u3002"
    },
    hotel: {
      name: "\u7bdd\u5cad\u666f\u533a\u5b98\u65b9\u4f4f\u5bbf",
      url: "https://www.wyhl.cc/",
      actionLabel: "\u5b98\u7f51\u4f4f\u5bbf\u5165\u53e3",
      description: "\u666f\u533a\u5b98\u7f51\u63d0\u4f9b\u4f4f\u5bbf\u4e0e\u5ea6\u5047\u533a\u4fe1\u606f\uff0c\u9002\u5408\u4f18\u5148\u67e5\u770b\u56ed\u533a\u5185\u4f4f\u5bbf\u5b89\u6392\u3002",
      note: "\u8bf7\u4ee5\u5b98\u7f51\u5b9e\u65f6\u623f\u6001\u4e0e\u4ef7\u683c\u4e3a\u51c6\u3002"
    }
  },
  {
    matcher: /\u4e4c\u9547/,
    officialSiteUrl: "https://www.wuzhen.com.cn/",
    officialSiteLabel: "\u4e4c\u9547\u65c5\u6e38\u5b98\u7f51",
    ticketRequired: true,
    ticket: {
      url: "https://www.wuzhen.com.cn/web/traver/info",
      label: "\u5b98\u65b9\u552e\u7968\u5165\u53e3",
      note: "\u5df2\u4f18\u5148\u63a5\u5165\u4e4c\u9547\u65c5\u6e38\u5b98\u7f51\u7968\u52a1\u9875\u3002"
    },
    hotel: {
      name: "\u4e4c\u9547\u666f\u533a\u5b98\u65b9\u9152\u5e97",
      url: "https://www.wuzhen.com.cn/",
      actionLabel: "\u5b98\u7f51\u9152\u5e97\u5165\u53e3",
      description: "\u53ef\u76f4\u63a5\u67e5\u770b\u666f\u533a\u5b98\u65b9\u9152\u5e97\u3001\u5ea6\u5047\u4ea7\u54c1\u4e0e\u4f4f\u5bbf\u8bf4\u660e\u3002",
      priceText: "\u5b98\u7f51\u623f\u4ef7\u4ee5\u5b9e\u65f6\u9875\u9762\u4e3a\u51c6",
      note: "\u8bf7\u4ee5\u4e4c\u9547\u5b98\u7f51\u5c55\u793a\u7684\u5b9e\u65f6\u4ef7\u683c\u4e0e\u623f\u6001\u4e3a\u51c6\u3002"
    }
  },
  {
    matcher: /\u8881\u5bb6\u6751/,
    officialSiteUrl: "https://www.yuanjiacun.net/",
    officialSiteLabel: "\u8881\u5bb6\u6751\u5b98\u7f51",
    ticketRequired: false,
    ticket: {
      url: "https://www.yuanjiacun.net/",
      label: "\u666f\u70b9\u5b98\u7f51",
      note: "\u8881\u5bb6\u6751\u4ee5\u6751\u843d\u8d44\u8baf\u548c\u5230\u8bbf\u4fe1\u606f\u4e3a\u4e3b\uff0c\u901a\u5e38\u4e0d\u5355\u72ec\u7ef4\u62a4\u95e8\u7968\u5165\u53e3\u3002"
    }
  }
];

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function getCombinedText(spot: TravelResourceSpotLike) {
  return [
    spot.name,
    spot.city,
    spot.district,
    spot.address,
    spot.description,
    spot.tags?.join(" "),
    spot.lodgingSummary
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
}

function uniqueItems(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function getOverride(spotName: string) {
  return OFFICIAL_SPOT_OVERRIDES.find((item) => item.matcher.test(spotName));
}

function splitTextParts(value: string) {
  return normalizeText(value)
    .split(/[|｜、,，/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractAccommodationNames(spot: TravelResourceSpotLike) {
  const tips = Array.isArray(spot.accommodationTips)
    ? spot.accommodationTips.flatMap((item) => splitTextParts(typeof item === "string" ? item : item?.name || ""))
    : [];
  const summaries = splitTextParts(spot.lodgingSummary || "").filter((part) => ACCOMMODATION_NAME_PATTERNS.test(part));

  return uniqueItems([...tips, ...summaries]).filter((item) => item.length <= 24).slice(0, 2);
}

function safeParseUrl(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function matchesHost(hostname: string, fragments: string[]) {
  return fragments.some((fragment) => hostname === fragment || hostname.endsWith(`.${fragment}`));
}

function isTrustedTravelPlatformUrl(url?: string | null) {
  const parsed = safeParseUrl(url);
  if (!parsed) return false;
  return matchesHost(parsed.hostname.toLowerCase(), TRUSTED_TRAVEL_HOSTS);
}

function isLikelyOfficialSiteUrl(url?: string | null) {
  const parsed = safeParseUrl(url);
  if (!parsed) return false;

  const hostname = parsed.hostname.toLowerCase();
  if (isTrustedTravelPlatformUrl(url)) return false;
  if (!/^https?:$/i.test(parsed.protocol)) return false;
  if (UNRELIABLE_INFO_HOST_KEYWORDS.some((keyword) => hostname.includes(keyword))) return false;
  if (ARTICLE_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname))) return false;

  return true;
}

function isLikelyTicketBookingUrl(url?: string | null) {
  const parsed = safeParseUrl(url);
  if (!parsed || !isTrustedTravelPlatformUrl(url)) return false;

  const path = parsed.pathname.toLowerCase();
  if (ARTICLE_PATH_PATTERNS.some((pattern) => pattern.test(path))) return false;
  if (NON_BOOKING_TRAVEL_PATH_PATTERNS.some((pattern) => pattern.test(path))) return false;
  if (/hotel|hotels|inn|guesthouse/.test(path)) return false;

  return /ticket|tickets|menpiao/.test(path);
}

function isLikelyHotelBookingUrl(url?: string | null) {
  const parsed = safeParseUrl(url);
  if (!parsed || !isTrustedTravelPlatformUrl(url)) return false;

  const hostname = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  if (ARTICLE_PATH_PATTERNS.some((pattern) => pattern.test(path))) return false;
  if (NON_BOOKING_TRAVEL_PATH_PATTERNS.some((pattern) => pattern.test(path))) return false;
  if (/ticket|tickets|menpiao/.test(path)) return false;

  return hostname.includes("huazhu.com") || /hotel|hotels|inn|guesthouse/.test(path);
}

function inferTicketRequired(spot: TravelResourceSpotLike) {
  const override = getOverride(spot.name);
  if (typeof override?.ticketRequired === "boolean") return override.ticketRequired;

  const text = getCombinedText(spot);
  if (TICKET_REQUIRED_KEYWORDS.some((keyword) => text.includes(keyword))) return true;
  if (LIKELY_FREE_KEYWORDS.some((keyword) => text.includes(keyword))) return false;

  return false;
}

function estimateBasePriceRange(spot: TravelResourceSpotLike) {
  if (spot.lodgingPriceMin && spot.lodgingPriceMax) {
    return { min: spot.lodgingPriceMin, max: spot.lodgingPriceMax };
  }

  const text = getCombinedText(spot);
  let min = 220;
  let max = 420;

  if (/\u5546\u52a1\u9152\u5e97|\u5feb\u6377|\u8fde\u9501/.test(text)) {
    min = 180;
    max = 320;
  } else if (/\u6e29\u6cc9|\u5ea6\u5047|\u666f\u533a|\u89c2\u666f|\u5c71\u5c45|\u53e4\u9547/.test(text)) {
    min = 320;
    max = 720;
  } else if (/\u5ba2\u6808|\u6c11\u5bbf|\u9662\u843d|\u5c0f\u9662|\u53e4\u5b85|\u53e4\u5385/.test(text)) {
    min = 260;
    max = 520;
  }

  if ((spot.avgCost ?? 0) >= 300) {
    min += 40;
    max += 120;
  }

  if ((spot.rating ?? 0) >= 4.5) {
    max += 60;
  }

  return { min, max };
}

function estimatePlatformPriceText(spot: TravelResourceSpotLike, platform: HotelReference["platform"], explicitText?: string) {
  if (explicitText) return explicitText;

  const base = estimateBasePriceRange(spot);
  if (platform === "huazhu") {
    return `\u5e73\u53f0\u53c2\u8003\u4ef7\u7ea6 \u00a5${Math.max(160, base.min - 40)}-${Math.max(base.min, base.max - 80)}/\u665a`;
  }

  if (platform === "official") {
    return `\u4f4f\u5bbf\u53c2\u8003\u4ef7\u7ea6 \u00a5${base.min}-${base.max}/\u665a`;
  }

  return `\u5e73\u53f0\u53c2\u8003\u4ef7\u7ea6 \u00a5${base.min}-${base.max}/\u665a`;
}

function buildHotelSearchUrl(spot: TravelResourceSpotLike, keyword?: string) {
  const query = keyword ? `${spot.city} ${spot.district || ""} ${keyword}`.trim() : `${spot.city} ${spot.name} \u9152\u5e97`;
  return `https://m.ctrip.com/webapp/hotel/?keyword=${encodeURIComponent(query)}`;
}

function buildTicketSearchUrl(spot: TravelResourceSpotLike) {
  const directUrl = spot.transportLinks?.ticketBookingUrl || spot.ticketBookingUrl;
  if (isLikelyTicketBookingUrl(directUrl)) return directUrl!;
  return buildGenericTicketUrl(spot.name, spot.city);
}

function pickOfficialInfoUrl(spot: TravelResourceSpotLike) {
  const override = getOverride(spot.name);
  if (override?.officialSiteUrl) return override.officialSiteUrl;

  if (isLikelyOfficialSiteUrl(spot.sourceUrl)) return spot.sourceUrl!;

  const directTicketUrl = spot.transportLinks?.ticketBookingUrl || spot.ticketBookingUrl;
  if (isLikelyOfficialSiteUrl(directTicketUrl)) return directTicketUrl!;

  return null;
}

function buildDirectHotelReference(spot: TravelResourceSpotLike): HotelReference | null {
  const directUrl = spot.transportLinks?.hotelBookingUrl || spot.hotelBookingUrl;
  const parsed = safeParseUrl(directUrl);
  if (!parsed || !isLikelyHotelBookingUrl(directUrl)) return null;

  const isHuazhu = parsed.hostname.toLowerCase().includes("huazhu.com");
  const platform: HotelReference["platform"] = isHuazhu ? "huazhu" : "ctrip";

  return {
    name: `${spot.name}\u9644\u8fd1\u4f4f\u5bbf`,
    platform,
    description: `${spot.city}${spot.district ? `\u00b7${spot.district}` : ""}\u5df2\u5f55\u5165\u7684\u4f4f\u5bbf\u67e5\u8be2\u5165\u53e3\uff0c\u53ef\u7ee7\u7eed\u7b5b\u9009\u9644\u8fd1\u9152\u5e97\u3001\u6c11\u5bbf\u4e0e\u8fde\u9501\u4f4f\u5bbf\u3002`,
    bookingUrl: directUrl!,
    actionLabel: isHuazhu ? "\u534e\u4f4f\u4f1a\u67e5\u770b" : "\u5e73\u53f0\u67e5\u770b",
    priceText: estimatePlatformPriceText(spot, platform),
    note: "\u6700\u7ec8\u4ef7\u683c\u4ee5\u5e73\u53f0\u5b9e\u65f6\u5c55\u793a\u4e3a\u51c6\u3002"
  };
}

function buildHotelReferences(spot: TravelResourceSpotLike) {
  const override = getOverride(spot.name);
  const hotels: HotelReference[] = [];
  const nearbyNames = extractAccommodationNames(spot).slice(0, override?.hotel ? 1 : 2);
  const directHotel = buildDirectHotelReference(spot);

  if (override?.hotel) {
    hotels.push({
      name: override.hotel.name,
      platform: "official",
      description: override.hotel.description,
      bookingUrl: override.hotel.url,
      actionLabel: override.hotel.actionLabel,
      priceText: estimatePlatformPriceText(spot, "official", override.hotel.priceText),
      note: override.hotel.note
    });
  }

  if (directHotel) {
    hotels.push(directHotel);
  }

  for (const name of nearbyNames) {
    hotels.push({
      name,
      platform: "ctrip",
      description: `${spot.city}${spot.district ? `\u00b7${spot.district}` : ""}\u5468\u8fb9\u4f4f\u5bbf\u641c\u7d22\u7ed3\u679c\uff0c\u9002\u5408\u5148\u770b\u6c11\u5bbf\u3001\u5ba2\u6808\u548c\u8fde\u9501\u9152\u5e97\u3002`,
      bookingUrl: buildHotelSearchUrl(spot, name),
      actionLabel: "\u643a\u7a0b\u67e5\u770b",
      priceText: estimatePlatformPriceText(spot, "ctrip"),
      note: "\u4ef7\u683c\u4e3a\u9644\u8fd1\u4f4f\u5bbf\u53c2\u8003\uff0c\u6700\u7ec8\u4ee5\u4e0b\u5355\u9875\u5b9e\u65f6\u5c55\u793a\u4e3a\u51c6\u3002"
    });
  }

  if (!nearbyNames.length && !directHotel) {
    hotels.push({
      name: `${spot.name}\u9644\u8fd1\u9152\u5e97`,
      platform: "ctrip",
      description: `${spot.city}${spot.district ? `\u00b7${spot.district}` : ""}\u901a\u7528\u9644\u8fd1\u4f4f\u5bbf\u641c\u7d22\u5165\u53e3\uff0c\u53ef\u7528\u6765\u5feb\u901f\u5bf9\u6bd4\u9644\u8fd1\u9152\u5e97\u3001\u5ba2\u6808\u548c\u6c11\u5bbf\u3002`,
      bookingUrl: buildHotelSearchUrl(spot),
      actionLabel: "\u643a\u7a0b\u67e5\u770b",
      priceText: estimatePlatformPriceText(spot, "ctrip"),
      note: "\u53ef\u6253\u5f00\u540e\u518d\u6309\u5546\u5708\u3001\u8ddd\u79bb\u6216\u4ef7\u683c\u8fdb\u4e00\u6b65\u7b5b\u9009\u3002"
    });
  }

  hotels.push({
    name: `${spot.city}${spot.district ? `\u00b7${spot.district}` : ""}\u534e\u4f4f\u4f1a\u9152\u5e97`,
    platform: "huazhu",
    description: "\u9002\u5408\u4f18\u5148\u67e5\u770b\u6807\u51c6\u5316\u8fde\u9501\u9152\u5e97\uff0c\u53ef\u7ee7\u7eed\u5728\u534e\u4f4f\u4f1a\u9875\u9762\u641c\u7d22\u5168\u5b63\u3001\u6c49\u5ead\u3001\u6865\u5b50\u3001\u66fc\u5fc3\u7b49\u54c1\u724c\u3002",
    bookingUrl: HUAZHU_HOME_URL,
    actionLabel: "\u534e\u4f4f\u4f1a\u67e5\u770b",
    priceText: estimatePlatformPriceText(spot, "huazhu"),
    note: `\u6253\u5f00\u540e\u53ef\u7ee7\u7eed\u641c\u7d22\u201c${spot.city}${spot.district || ""}\u201d\u3002`
  });

  return uniqueBy(hotels, (hotel) => `${hotel.platform}::${hotel.bookingUrl}::${hotel.name}`).slice(0, 3);
}

function buildTicketReference(spot: TravelResourceSpotLike): TicketReference {
  const override = getOverride(spot.name);
  const ticketRequired = inferTicketRequired(spot);

  if (override?.ticket) {
    return {
      type: ticketRequired ? "official_ticket" : "official_site",
      label: override.ticket.label,
      url: override.ticket.url,
      note: override.ticket.note
    };
  }

  const officialInfoUrl = pickOfficialInfoUrl(spot);
  if (officialInfoUrl) {
    return {
      type: ticketRequired ? "official_ticket" : "official_site",
      label: ticketRequired ? "\u5b98\u7f51\u7968\u52a1\u4fe1\u606f" : "\u666f\u70b9\u5b98\u7f51",
      url: officialInfoUrl,
      note: ticketRequired
        ? "\u5df2\u4f18\u5148\u63a5\u5165\u666f\u533a\u5b98\u7f51\uff0c\u8bf7\u5728\u5b98\u7f51\u5185\u67e5\u770b\u95e8\u7968\u3001\u9884\u7ea6\u6216\u5165\u56ed\u8bf4\u660e\u3002"
        : "\u5df2\u4f18\u5148\u63a5\u5165\u6821\u9a8c\u901a\u8fc7\u7684\u666f\u70b9\u5b98\u7f51\u5165\u53e3\u3002"
    };
  }

  return {
    type: "platform_search",
    label: ticketRequired ? "\u95e8\u7968\u67e5\u8be2\u5165\u53e3" : "\u666f\u70b9\u4fe1\u606f\u67e5\u8be2",
    url: buildTicketSearchUrl(spot),
    note: ticketRequired
      ? "\u6682\u672a\u6821\u9a8c\u5230\u7a33\u5b9a\u7684\u5b98\u65b9\u7968\u52a1\u94fe\u63a5\uff0c\u5df2\u56de\u9000\u5230\u53ef\u4fe1\u5e73\u53f0\u67e5\u8be2\u5165\u53e3\u3002"
      : "\u6682\u672a\u6821\u9a8c\u5230\u7a33\u5b9a\u7684\u666f\u70b9\u5b98\u7f51\u94fe\u63a5\uff0c\u5df2\u56de\u9000\u5230\u516c\u5171\u4fe1\u606f\u67e5\u8be2\u5165\u53e3\u3002"
  };
}

export function getSpotTravelResources(spot: TravelResourceSpotLike): SpotTravelResources {
  const hotels = buildHotelReferences(spot);
  const ticket = buildTicketReference(spot);
  const firstHotel = hotels[0];

  return {
    hotels,
    hotelEntryUrl: firstHotel?.bookingUrl || buildGenericHotelUrl(spot.name, spot.city),
    hotelEntryLabel: firstHotel?.platform === "official" ? "\u9152\u5e97\u5165\u53e3" : "\u9644\u8fd1\u9152\u5e97\u5165\u53e3",
    hotelEntryNote: firstHotel?.note || "\u5df2\u63a5\u5165\u666f\u70b9\u5468\u8fb9\u4f4f\u5bbf\u67e5\u8be2\u5165\u53e3\u3002",
    lodgingReferenceText: estimatePlatformPriceText(spot, firstHotel?.platform || "ctrip"),
    ticket
  };
}

export function getSpotHotelSummary(spot: TravelResourceSpotLike) {
  const resources = getSpotTravelResources(spot);
  const firstHotel = resources.hotels[0];

  return {
    title: firstHotel?.name || `${spot.city}${spot.district ? `\u00b7${spot.district}` : ""}\u5468\u8fb9\u4f4f\u5bbf`,
    priceText: resources.lodgingReferenceText
  };
}
