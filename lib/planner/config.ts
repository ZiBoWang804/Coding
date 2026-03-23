import type { PlannerProfileKey } from "@/lib/planner/enums";
import type { ScoreWeights } from "@/lib/planner/types";

export const BASE_SCORE_WEIGHTS: ScoreWeights = {
  timeFit: 20,
  transportFit: 18,
  companionFit: 15,
  weatherFit: 15,
  budgetFit: 10,
  seasonFit: 8,
  lodgingFit: 6,
  diningFit: 4,
  tagFit: 4
};

export const PROFILE_WEIGHT_OVERRIDES: Record<PlannerProfileKey, Partial<ScoreWeights>> = {
  default: {},
  family: { companionFit: 18, diningFit: 5, lodgingFit: 7, tagFit: 3 },
  couple: { tagFit: 6, weatherFit: 14, lodgingFit: 7 },
  elderly: { transportFit: 21, weatherFit: 16, companionFit: 17, tagFit: 2 },
  self_drive_users: { transportFit: 20, timeFit: 18 },
  budget_sensitive: { budgetFit: 16, lodgingFit: 5, diningFit: 5, tagFit: 2 },
  photography: { weatherFit: 16, seasonFit: 10, tagFit: 8, budgetFit: 6 },
  friends_group: { companionFit: 14, tagFit: 6, diningFit: 5 }
};

export const HARD_FILTER_LIMITS = {
  oneDayMaxDistanceKm: 160,
  oneDayPublicTransitMaxDistanceKm: 110,
  twoDayMaxDistanceKm: 280,
  severeWeatherRoadRiskThreshold: 3,
  publicTransitLastMileThreshold: 4,
  elderlyRoadRiskThreshold: 3,
  familyRoadRiskThreshold: 4,
  lodgingRequiredMinLevel: "basic"
} as const;

export const COST_DEFAULTS = {
  transportSelfDrivePerDay: 120,
  transportPublicTransitPerDay: 80,
  diningPerPersonLow: 60,
  diningPerPersonHigh: 120,
  lodgingLow: 220,
  lodgingHigh: 480,
  activitiesPerPersonLow: 40,
  activitiesPerPersonHigh: 120
} as const;

export const SCENIC_KEYWORDS = {
  ancient_village: ["古村", "古镇", "古寨", "村落", "老街", "古道"],
  mountain_view: ["山", "秦岭", "终南", "山景", "高山", "云海"],
  water_view: ["湖", "溪", "河", "湿地", "泉", "瀑", "水景"],
  forest: ["森林", "林", "树海"],
  bamboo: ["竹", "竹海", "竹林"],
  flower_sea: ["花海", "花田", "赏花", "油菜花", "梅花", "樱花"],
  terrace: ["梯田"],
  pastoral: ["田园", "乡野", "农庄", "乡村"],
  camping: ["露营", "营地", "烧烤"],
  hot_spring: ["温泉", "汤峪"],
  fruit_picking: ["采摘", "葡萄", "石榴", "草莓", "果园"],
  folk_custom: ["民俗", "非遗", "侗寨", "苗寨", "土楼"],
  intangible_heritage: ["非遗", "手作", "工坊", "民艺"],
  local_food: ["美食", "小吃", "农家菜", "长桌宴"],
  photography: ["摄影", "出片", "机位", "打卡"],
  hiking_light: ["步道", "徒步", "步行", "栈道"],
  quiet_relax: ["安静", "避世", "放松", "慢游", "康养"],
  weekend_short_trip: ["周末", "短途", "微度假"],
  family_interaction: ["亲子", "互动", "研学", "农耕", "萌宠"],
  summer_retreat: ["避暑", "清凉", "山谷"],
  autumn_view: ["秋景", "红叶", "晒秋"],
  winter_scene: ["雪景", "冬景", "雾凇"]
} as const;

export const XIAN_CITY_CENTER = {
  name: "Xi'an",
  latitude: 34.3416,
  longitude: 108.9398
} as const;

export const SAMPLE_TEST_CASE_IDS = ["sample-1", "sample-2", "sample-3"] as const;


