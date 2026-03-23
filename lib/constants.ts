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
    title: "江南古村摄影线",
    summary: "婺源篁岭 + 宏村 + 西递，适合春秋两季自驾慢游。"
  },
  {
    title: "山野避暑周末线",
    summary: "安吉余村 + 莫干山庾村，适合江浙沪周边两日微度假。"
  },
  {
    title: "西南非遗体验线",
    summary: "肇兴侗寨 + 沙溪古镇，适合文化体验与高颜值打卡。"
  }
];

export const PACKING_SUGGESTIONS: Record<string, string[]> = {
  通用: ["身份证/学生证", "充电宝", "舒适步行鞋", "常备药品", "饮水杯"],
  亲子: ["儿童湿巾", "轻便推车", "保温水壶"],
  摄影: ["备用电池", "防潮袋", "轻便三脚架"],
  自驾: ["ETC/停车零钱", "车载充电器", "晕车药"],
  避暑: ["薄外套", "防蚊喷雾"],
  美食: ["纸巾", "便携消毒用品"],
  非遗民俗: ["尊重当地礼俗的得体服装"]
};

export const HERO_SLIDES = [
  {
    eyebrow: "周末两天就出发",
    title: "把乡村旅行做成更好看的个人计划",
    description: "从灵感收集、路线规划到社区攻略与打卡记录，游乡记把分散信息收束成一个可执行的行程。"
  },
  {
    eyebrow: "西安周边专题",
    title: "秦岭脚下的轻度假线路更适合展示 MVP",
    description: "专题页、攻略帖、打卡流和审核提报串起来后，这个产品就不再只是景点列表。"
  },
  {
    eyebrow: "AI + 社区协同",
    title: "规则引擎保底，AI 负责写得更细、更像真出行建议",
    description: "没有模型时照样可用，接上豆包后自动增强交通、预算、物品清单和打卡路线。"
  }
];
