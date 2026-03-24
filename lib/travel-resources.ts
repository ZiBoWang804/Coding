import { buildGenericTicketUrl } from "@/lib/utils";
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
  officialSiteUrl: string;
  officialSiteLabel?: string;
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
  ticketRequired?: boolean;
}

const HUAZHU_HOME_URL = "https://m.huazhu.com/Hotel/Index";
const TICKET_REQUIRED_KEYWORDS = [
  "景区",
  "古镇",
  "篁岭",
  "宏村",
  "西递",
  "侗寨",
  "苗寨",
  "古寨",
  "土楼",
  "藏寨",
  "古民居",
  "镇北堡"
];
const LIKELY_FREE_KEYWORDS = [
  "村",
  "周边村落",
  "乡宿带",
  "乡旅带",
  "渔村",
  "慢城",
  "明月村",
  "华溪村"
];

const OFFICIAL_SPOT_OVERRIDES: Record<string, OfficialSpotOverride> = {
  "婺源篁岭": {
    officialSiteUrl: "https://www.wyhl.cc/",
    officialSiteLabel: "篁岭景区官网",
    ticketRequired: true,
    ticket: {
      url: "https://www.wyhl.cc/site/wyhl/zxyy/pwyd/detail2024-07-05-2.html",
      label: "官方售票入口",
      note: "已优先接入篁岭景区官网票务预订页。"
    },
    hotel: {
      name: "篁岭景区官方住宿",
      url: "https://www.wyhl.cc/",
      actionLabel: "官网住宿预订",
      description: "景区官网带住宿预订入口，适合想住进篁岭度假区时直接查看。",
      note: "官网首页提供酒店预订入口。"
    }
  },
  "乌镇西栅周边乡宿带": {
    officialSiteUrl: "https://www.wuzhen.com.cn/",
    officialSiteLabel: "乌镇旅游官网",
    ticketRequired: true,
    ticket: {
      url: "https://www.wuzhen.com.cn/web/traver/info",
      label: "官方售票入口",
      note: "已优先接入乌镇旅游官方网站票务政策与预订页。"
    },
    hotel: {
      name: "通安客栈",
      url: "https://www.wuzhen.com.cn/web/vacation/details?id=b2a8e1e27f5bdfd675f39b063db7c871",
      actionLabel: "官方酒店预订",
      description: "乌镇官方酒店，适合想住进西栅景区时直接查看房型与入住权益。",
      priceText: "官网示例价约 ¥880 起/间",
      note: "价格以乌镇官网实时页面为准。"
    }
  },
  "陕西袁家村": {
    officialSiteUrl: "https://www.yuanjiacun.net/",
    officialSiteLabel: "袁家村官网",
    ticketRequired: false,
    ticket: {
      url: "https://www.yuanjiacun.net/",
      label: "景点官网",
      note: "袁家村以官方村落资讯与到村消费体验为主，通常不单独维护门票入口。"
    }
  }
};

function getCombinedText(spot: TravelResourceSpotLike) {
  return [
    spot.name,
    spot.city,
    spot.district,
    spot.description,
    spot.tags?.join(" "),
    spot.lodgingSummary
  ]
    .filter(Boolean)
    .join(" ");
}

function uniqueItems(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function extractAccommodationNames(spot: TravelResourceSpotLike) {
  const tips = Array.isArray(spot.accommodationTips)
    ? spot.accommodationTips.flatMap((item) => {
        const value = typeof item === "string" ? item : item?.name || "";
        return String(value)
          .split(/[|｜、,，；;\/]/)
          .map((part) => part.trim());
      })
    : [];

  const summaryNames = (spot.lodgingSummary || "")
    .split(/[|｜、,，；;\/]/)
    .map((part) => part.trim())
    .filter((part) => /(酒店|民宿|客栈|山居|院落|小院|驿站|宿|house|HOTEL)/i.test(part));

  return uniqueItems([...tips, ...summaryNames]).slice(0, 2);
}

function isGenericCtripUrl(url?: string | null) {
  return Boolean(url?.includes("m.ctrip.com/webapp"));
}

function buildCtripHotelKeywordUrl(keyword: string) {
  return `https://m.ctrip.com/webapp/hotel/?keyword=${encodeURIComponent(keyword)}`;
}

function getHotelSearchUrl(spot: TravelResourceSpotLike, keyword?: string) {
  const directUrl = spot.transportLinks?.hotelBookingUrl || spot.hotelBookingUrl;
  if (directUrl && !isGenericCtripUrl(directUrl)) return directUrl;

  const query = keyword ? `${spot.city} ${spot.district || ""} ${keyword}`.trim() : `${spot.city} ${spot.name} 酒店`;
  return buildCtripHotelKeywordUrl(query);
}

function getTicketSearchUrl(spot: TravelResourceSpotLike) {
  const directUrl = spot.transportLinks?.ticketBookingUrl || spot.ticketBookingUrl;
  if (directUrl && !isGenericCtripUrl(directUrl)) return directUrl;
  return buildGenericTicketUrl(spot.name, spot.city);
}

function inferTicketRequired(spot: TravelResourceSpotLike) {
  const override = OFFICIAL_SPOT_OVERRIDES[spot.name];
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

  if (/商务酒店|快捷|连锁/.test(text)) {
    min = 180;
    max = 320;
  } else if (/温泉|度假|篁岭|乌镇|莫干山|海景|梯田|观景/.test(text)) {
    min = 320;
    max = 720;
  } else if (/客栈|民宿|山居|院落|古宅|古厝|藏式|小院/.test(text)) {
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
    return `平台参考价约 ¥${Math.max(160, base.min - 40)}-${Math.max(base.min, base.max - 80)}/晚`;
  }

  if (platform === "official") {
    return `住宿参考价约 ¥${base.min}-${base.max}/晚`;
  }

  return `平台参考价约 ¥${base.min}-${base.max}/晚`;
}

function buildHotelReferences(spot: TravelResourceSpotLike) {
  const override = OFFICIAL_SPOT_OVERRIDES[spot.name];
  const hotels: HotelReference[] = [];
  const nearbyNames = extractAccommodationNames(spot).slice(0, override?.hotel ? 1 : 2);

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

  for (const name of nearbyNames) {
    hotels.push({
      name,
      platform: "ctrip",
      description: `${spot.city}${spot.district ? `·${spot.district}` : ""}周边住宿搜索结果，适合先看民宿/客栈聚合页。`,
      bookingUrl: getHotelSearchUrl(spot, name),
      actionLabel: "携程查看",
      priceText: estimatePlatformPriceText(spot, "ctrip"),
      note: "价格展示为附近住宿平台参考，最终以下单页为准。"
    });
  }

  hotels.push({
    name: `${spot.city}${spot.district ? `·${spot.district}` : ""}华住会连锁酒店`,
    platform: "huazhu",
    description: "适合优先住标准化连锁酒店时查看，同城搜索更容易筛到全季、汉庭、桔子、漫心等品牌。",
    bookingUrl: HUAZHU_HOME_URL,
    actionLabel: "华住会查看",
    priceText: estimatePlatformPriceText(spot, "huazhu"),
    note: `打开后可直接搜索“${spot.city}${spot.district ? spot.district : ""}”。`
  });

  return hotels.slice(0, 3);
}

function buildTicketReference(spot: TravelResourceSpotLike): TicketReference {
  const override = OFFICIAL_SPOT_OVERRIDES[spot.name];
  if (override?.ticket) {
    return {
      type: override.ticketRequired ? "official_ticket" : "official_site",
      label: override.ticket.label,
      url: override.ticket.url,
      note: override.ticket.note
    };
  }

  if (!inferTicketRequired(spot) && (spot.sourceUrl || override?.officialSiteUrl)) {
    return {
      type: "official_site",
      label: "景点官网",
      url: spot.sourceUrl || override!.officialSiteUrl,
      note: "当前更适合跳转到景点官方介绍页查看开放说明、活动资讯和入园提醒。"
    };
  }

  return {
    type: "platform_search",
    label: inferTicketRequired(spot) ? "门票查询入口" : "景点信息入口",
    url: getTicketSearchUrl(spot),
    note: inferTicketRequired(spot)
      ? "已优先尝试官方票务；未维护到官方链接的景点会先跳转到门票查询页。"
      : "若景点未维护独立官网链接，会先跳转到信息查询入口。"
  };
}

export function getSpotTravelResources(spot: TravelResourceSpotLike): SpotTravelResources {
  const hotels = buildHotelReferences(spot);
  const ticket = buildTicketReference(spot);

  return {
    hotels,
    hotelEntryUrl: hotels[0]?.bookingUrl || getHotelSearchUrl(spot),
    hotelEntryLabel: hotels[0]?.platform === "official" ? "酒店入口" : "附近酒店入口",
    hotelEntryNote: hotels[0]?.note || "已接入景点周边住宿搜索入口。",
    lodgingReferenceText: estimatePlatformPriceText(spot, hotels[0]?.platform || "ctrip"),
    ticket
  };
}

export function getSpotHotelSummary(spot: TravelResourceSpotLike) {
  const resources = getSpotTravelResources(spot);
  const firstHotel = resources.hotels[0];

  return {
    title: firstHotel?.name || `${spot.city}${spot.district ? `·${spot.district}` : ""}周边住宿`,
    priceText: resources.lodgingReferenceText
  };
}
