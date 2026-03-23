export const APP_NAME = "游乡记";
export const SESSION_COOKIE = "yxj_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export const CATEGORY_TAGS = ["亲子", "摄影", "自驾", "低预算", "美食", "避暑", "非遗民俗", "安静", "人少", "文化体验", "自然风光"];

export const PLANNER_WEIGHTS = {
  distance: 0.2,
  preference: 0.28,
  budget: 0.16,
  rating: 0.14,
  crowd: 0.1,
  season: 0.12
};

export const RECOMMENDED_ROUTES = [
  {
    title: "秦岭脚下的一日慢游",
    summary: "适合自驾出发，上午在村落和古寨里走走，下午找一家山野咖啡馆或民宿院子慢慢坐下来。"
  },
  {
    title: "临潼亲子农园轻假期",
    summary: "更适合带孩子采摘、看动物、做农事体验，节奏轻松，预算也相对可控。"
  },
  {
    title: "周至竹海与山路风景线",
    summary: "适合喜欢山路、竹林和自然风光的人，最好预留一整天，不要把行程排得太满。"
  }
];

export const PACKING_SUGGESTIONS: Record<string, string[]> = {
  通用: ["身份证", "充电宝", "舒适步行鞋", "饮水", "简单药品"],
  亲子: ["儿童湿巾", "轻便推车", "备用零食"],
  摄影: ["备用电池", "防潮袋", "轻便三脚架"],
  自驾: ["ETC", "车载充电器", "晕车药"],
  避暑: ["防晒用品", "驱蚊喷雾"],
  美食: ["纸巾", "便携消毒用品"],
  非遗民俗: ["适合拍照和进村参观的得体服装"]
};

export const HERO_SLIDES = [
  {
    eyebrow: "周末灵感",
    title: "不用跑太远，也能换一段像样的风景",
    description: "从西安出发，一小时到两小时内就能遇见竹海、果园、古寨、温泉和能住一晚的小村子。"
  },
  {
    eyebrow: "路线节奏",
    title: "先定方向，再挑景点，周末会顺很多",
    description: "先看地图分布，再决定去北线、东线还是秦岭方向，比单独挑景点更像一趟完整行程。"
  },
  {
    eyebrow: "出行方式",
    title: "能当天往返的，和适合住一晚的，完全是两种玩法",
    description: "平台会把可一日往返和更适合住一晚的目的地拆开，让选择更清楚，行程也更轻松。"
  }
];
