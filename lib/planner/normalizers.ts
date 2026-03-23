import {
  DESTINATION_TAGS,
  SEASONS,
  SUITABLE_CROWD_TAGS,
  type DestinationTag,
  type Season,
  type SuggestedDuration,
  type SuitableCrowdTag
} from "@/lib/planner/enums";
import { SCENIC_KEYWORDS } from "@/lib/planner/config";

const TAG_SYNONYMS: Record<DestinationTag, string[]> = {
  ancient_village: ["古村", "古镇", "古寨", "村落", "老县城", "老街", "石头城", "传统村落"],
  mountain_view: ["山景", "秦岭", "终南山", "高山", "山谷", "环山路", "山村"],
  water_view: ["水景", "溪谷", "湖", "河", "湿地", "温泉"],
  forest: ["森林", "林地", "树林", "山林"],
  bamboo: ["竹", "竹海", "竹林"],
  flower_sea: ["花海", "花田", "赏花", "梅花", "樱花", "油菜花"],
  terrace: ["梯田"],
  pastoral: ["田园", "乡野", "农庄", "乡村风景", "乡间"],
  camping: ["露营", "营地", "天幕", "烧烤露营"],
  hot_spring: ["温泉", "汤院", "汤峪"],
  fruit_picking: ["采摘", "葡萄", "石榴", "果园", "草莓"],
  folk_custom: ["民俗", "侗寨", "苗寨", "关中", "土楼", "民族风情"],
  intangible_heritage: ["非遗", "手作", "工坊", "民艺", "文化遗产"],
  local_food: ["美食", "小吃", "农家菜", "地方菜", "长桌宴", "村咖"],
  photography: ["摄影", "拍照", "出片", "机位", "汉服摄影", "打卡"],
  hiking_light: ["徒步", "步道", "栈道", "步行", "轻徒步"],
  quiet_relax: ["安静", "放松", "康养", "慢游", "避世", "轻松"],
  weekend_short_trip: ["周末", "短途", "微度假", "一日游"],
  family_interaction: ["亲子", "互动", "研学", "农耕", "萌宠", "儿童游乐"],
  summer_retreat: ["避暑", "清凉", "夏日", "山间清凉"],
  autumn_view: ["秋景", "红叶", "晒秋", "秋色"],
  winter_scene: ["雪景", "冰雪", "冬景", "雾凇"]
};

const CROWD_SYNONYMS: Record<SuitableCrowdTag, string[]> = {
  couple: ["情侣", "约会", "浪漫"],
  family: ["家庭", "亲子", "带娃"],
  friends: ["朋友", "团建", "闺蜜", "伙伴"],
  solo: ["独自", "一个人", "独旅", "solo"],
  elderly: ["老人", "长辈", "康养"],
  photography: ["摄影", "拍照", "出片"],
  self_drive_users: ["自驾", "开车"],
  pet_friendly: ["宠物", "带狗", "宠物友好"]
};

const SEASON_SYNONYMS: Record<Season, string[]> = {
  spring: ["spring", "春", "春季", "春天"],
  summer: ["summer", "夏", "夏季", "夏天"],
  autumn: ["autumn", "fall", "秋", "秋季", "秋天"],
  winter: ["winter", "冬", "冬季", "冬天"]
};

export function splitTextList(input: unknown): string[] {
  if (Array.isArray(input)) return input.flatMap((item) => splitTextList(item));
  const text = String(input ?? "").trim();
  if (!text) return [];
  return text
    .split(/[|,，、;；/\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeTags(inputTags: unknown, extraText = "") {
  const originalTags = [...splitTextList(inputTags), ...splitTextList(extraText)];
  const haystack = originalTags.join(" |").toLowerCase();
  const normalizedTags = DESTINATION_TAGS.filter((tag) => {
    const keywords = [...TAG_SYNONYMS[tag], ...(SCENIC_KEYWORDS[tag] || [])];
    return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });

  return {
    originalTags: Array.from(new Set(originalTags)),
    normalizedTags: Array.from(new Set(normalizedTags))
  };
}

export function normalizeSuitableCrowds(input: unknown, extraText = ""): SuitableCrowdTag[] {
  const haystack = [...splitTextList(input), ...splitTextList(extraText)].join(" |").toLowerCase();
  return SUITABLE_CROWD_TAGS.filter((tag) => CROWD_SYNONYMS[tag].some((keyword) => haystack.includes(keyword.toLowerCase())));
}

export function normalizeSeasonList(input: unknown): Season[] {
  const items = splitTextList(input).join(" |").toLowerCase();
  const seasons = SEASONS.filter((season) => SEASON_SYNONYMS[season].some((keyword) => items.includes(keyword.toLowerCase())));
  return seasons.length > 0 ? seasons : ["spring", "autumn"];
}

export function normalizeSuggestedDuration(input: unknown): SuggestedDuration {
  const text = String(input ?? "").toLowerCase();
  if (!text) return "one_day";
  if (text.includes("0.5") || text.includes("半") || text.includes("half")) return "half_day";
  if (text.includes("2") || text.includes("两天") || text.includes("2天")) return "two_days";
  if (text.includes("flex") || text.includes("深度") || text.includes("多日")) return "flexible";
  return "one_day";
}

export function clampScore(value: number | null | undefined, fallback = 3, min = 1, max = 5) {
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "y", "是", "有"].includes(text);
}

export function toSlugId(name: string, city?: string) {
  return `${city || "dest"}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
