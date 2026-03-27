import type { RuralSpotSeed } from "@/types";

type SpotPlayStyleDefinition = {
  label: string;
  aliases: string[];
  keywords: string[];
};

const SPOT_PLAY_STYLE_DEFINITIONS: SpotPlayStyleDefinition[] = [
  {
    label: "拍照出片",
    aliases: ["摄影", "拍照", "出片"],
    keywords: ["拍照", "摄影", "出片", "打卡", "花海", "夜景", "竹海", "艺术", "咖啡", "photo", "photography"]
  },
  {
    label: "亲子遛娃",
    aliases: ["亲子", "遛娃", "家庭出游"],
    keywords: ["亲子", "家庭", "遛娃", "研学", "农场", "乐园", "萌宠", "互动", "family", "children"]
  },
  {
    label: "古村古镇",
    aliases: ["古村", "古镇", "人文古迹"],
    keywords: ["古村", "古镇", "古堡", "古寨", "古道", "历史", "民俗", "非遗", "古风", "ancient", "history"]
  },
  {
    label: "山野徒步",
    aliases: ["徒步", "登山", "山野"],
    keywords: ["徒步", "登山", "步道", "山野", "山景", "峡谷", "竹林", "秦岭", "trail", "hiking", "mountain"]
  },
  {
    label: "温泉康养",
    aliases: ["温泉", "康养", "疗愈"],
    keywords: ["温泉", "康养", "疗愈", "养生", "泡汤", "hot spring", "wellness"]
  },
  {
    label: "田园采摘",
    aliases: ["采摘", "农趣", "田园"],
    keywords: ["田园", "乡村", "采摘", "果园", "农场", "农事", "垂钓", "果蔬", "fruit", "farm", "orchard"]
  },
  {
    label: "美食寻味",
    aliases: ["美食", "小吃", "寻味"],
    keywords: ["美食", "小吃", "夜市", "农家乐", "咖啡", "餐厅", "餐饮", "早午餐", "food", "snack", "restaurant"]
  },
  {
    label: "自驾兜风",
    aliases: ["自驾", "兜风", "环线"],
    keywords: ["自驾", "兜风", "环线", "公路", "停车", "road trip", "self drive", "self-drive"]
  },
  {
    label: "轻住度假",
    aliases: ["度假", "民宿", "住一晚"],
    keywords: ["民宿", "酒店", "度假", "住一晚", "短住", "resort", "homestay", "stay"]
  },
  {
    label: "安静放空",
    aliases: ["安静", "放空", "慢游"],
    keywords: ["安静", "放空", "慢游", "静谧", "清净", "轻松", "疗愈", "quiet", "relax"]
  }
];

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function buildSpotCorpus(spot: Pick<RuralSpotSeed, "name" | "description" | "transportInfo" | "tags" | "routeHighlights" | "accommodationTips" | "diningTips">) {
  return normalizeText(
    [
      spot.name,
      spot.description,
      spot.transportInfo,
      ...(spot.tags || []),
      ...(spot.routeHighlights || []),
      ...((spot.accommodationTips || []).map((item) => item.name)),
      ...((spot.diningTips || []).map((item) => item.name))
    ].join(" ")
  );
}

function resolveSpotPlayStyleDefinition(value?: string | null) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return null;
  return (
    SPOT_PLAY_STYLE_DEFINITIONS.find((definition) =>
      [definition.label, ...definition.aliases].some((alias) => normalizeText(alias) === normalizedValue)
    ) || null
  );
}

function matchesDefinition(definition: SpotPlayStyleDefinition, spot: Pick<RuralSpotSeed, "name" | "description" | "transportInfo" | "tags" | "routeHighlights" | "accommodationTips" | "diningTips">) {
  const corpus = buildSpotCorpus(spot);
  return definition.keywords.some((keyword) => corpus.includes(normalizeText(keyword)));
}

export function isSpotPlayStyleFilter(value?: string | null) {
  return Boolean(resolveSpotPlayStyleDefinition(value));
}

export function matchesSpotPlayStyle(
  spot: Pick<RuralSpotSeed, "name" | "description" | "transportInfo" | "tags" | "routeHighlights" | "accommodationTips" | "diningTips">,
  value?: string | null
) {
  if (!value) return true;
  const definition = resolveSpotPlayStyleDefinition(value);
  if (!definition) {
    return (spot.tags || []).includes(value);
  }
  return matchesDefinition(definition, spot);
}

export function listSpotPlayStyleOptions(
  spots: Array<Pick<RuralSpotSeed, "name" | "description" | "transportInfo" | "tags" | "routeHighlights" | "accommodationTips" | "diningTips">>
) {
  return SPOT_PLAY_STYLE_DEFINITIONS.filter((definition) => spots.some((spot) => matchesDefinition(definition, spot))).map(
    (definition) => definition.label
  );
}
