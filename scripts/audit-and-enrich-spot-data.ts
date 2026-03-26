import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type CuratedEnrichment = {
  name: string;
  province: string;
  city: string;
  district?: string | null;
  address?: string | null;
  description?: string | null;
  sourceUrls: string[];
  notes?: string;
};

const prisma = new PrismaClient();
const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "data", "import-ready", "spot-audit.report.json");

const curatedEnrichments: CuratedEnrichment[] = [
  {
    name: "黄山",
    province: "安徽省",
    city: "黄山市",
    district: "黄山区",
    address: "安徽省黄山市黄山区汤口镇",
    description: "黄山是中国最具代表性的山岳景区之一，以奇松、怪石、云海和温泉闻名，也是世界文化与自然双重遗产地。",
    sourceUrls: ["https://zh.wikipedia.org/wiki/%E9%BB%84%E5%B1%B1", "https://upload.wikimedia.org/wikipedia/commons/5/57/%E9%BB%84%E5%B1%B1%E9%A3%8E%E6%99%AF%E5%90%8D%E8%83%9C%E5%8C%BA%E7%AE%A1%E7%90%86%E6%9D%A1%E4%BE%8B.pdf"]
  },
  {
    name: "九寨沟",
    province: "四川省",
    city: "阿坝州",
    district: "九寨沟县",
    address: "四川省阿坝藏族羌族自治州九寨沟县漳扎镇",
    description: "九寨沟以高山海子、瀑布群和彩林景观闻名，是国家级风景名胜区和世界自然遗产地，适合安排完整一日以上深度游览。",
    sourceUrls: ["https://www.jiuzhai.com/", "https://en.wikipedia.org/wiki/Jiuzhaigou"]
  },
  {
    name: "大雁塔",
    province: "陕西省",
    city: "西安市",
    district: "雁塔区",
    address: "陕西省西安市雁塔区慈恩路1号",
    description: "大雁塔位于大慈恩寺内，是唐代佛塔与西安城市地标之一，适合与大唐不夜城、陕西历史博物馆联动安排行程。",
    sourceUrls: ["https://www.droitstock.com/image/detail/475236952"]
  },
  {
    name: "广州长隆旅游度假区",
    province: "广东省",
    city: "广州市",
    district: "番禺区",
    address: "广东省广州市番禺区汉溪大道东299号",
    description: "广州长隆旅游度假区是华南代表性的综合主题度假区，园区业态完整，适合亲子、情侣和多日休闲度假行程。",
    sourceUrls: ["https://www.panyu.gov.cn/ztzx/gjqylysfqzt/content/post_4506999.html", "https://ftp.qrcode.ltd/%E5%85%A8%E5%9B%BD%E6%97%85%E8%A1%8C%E6%94%BB%E7%95%A5/%E5%8D%8E%E5%8D%97%E5%9C%B0%E5%8C%BA/%E6%88%91%E6%98%AF%E9%A9%B4%E5%8F%8B-%E5%B9%BF%E5%B7%9E%E6%97%85%E6%B8%B8%E6%94%BB%E7%95%A5.pdf"]
  },
  {
    name: "太阳岛",
    province: "黑龙江省",
    city: "哈尔滨市",
    district: "松北区",
    address: "黑龙江省哈尔滨市松北区警备路3号",
    description: "太阳岛位于松花江北岸，是哈尔滨知名城市休闲景区，夏季适合绿地漫游，冬季雪雕和冰雪活动辨识度很高。",
    sourceUrls: ["https://you.ctrip.com/sight/harbin151/7700.html", "https://www.tuniu.com/menpiao/175"]
  },
  {
    name: "天目湖",
    province: "江苏省",
    city: "常州市",
    district: "溧阳市",
    address: "江苏省常州市溧阳市天目湖镇环湖西路1号",
    description: "天目湖是溧阳代表性的湖滨度假目的地，山水园、南山竹海与温泉度假资源组合度高，适合周末两日慢节奏出游。",
    sourceUrls: ["https://zh.wikipedia.org/wiki/%E5%A4%A9%E7%9B%AE%E6%B9%96%E5%9B%BD%E5%AE%B6%E6%B9%BF%E5%9C%B0%E5%85%AC%E5%9B%AD", "https://www.sohu.com/a/915189502_120104414"]
  },
  {
    name: "崂山",
    province: "山东省",
    city: "青岛市",
    district: "崂山区",
    address: "山东省青岛市崂山区崂山风景区",
    description: "崂山地处青岛东部海滨，是兼具山海景观与道教文化资源的国家重点风景名胜区，适合徒步、观海和文化体验结合游玩。",
    sourceUrls: ["https://qdlaoshan.cn/Index-laoshan.html"]
  },
  {
    name: "天堂寨",
    province: "安徽省",
    city: "六安市",
    district: "金寨县",
    address: "安徽省六安市金寨县天堂寨镇",
    description: "天堂寨位于大别山腹地，是华东地区辨识度很高的山岳型景区，瀑布、峡谷和森林景观完整，自驾和徒步体验都较突出。",
    sourceUrls: ["https://www.aiisen.com/p/2298045.html", "https://www.luan.gov.cn/zwzx/dtxx/10688183.html"]
  },
  {
    name: "涠洲岛",
    province: "广西壮族自治区",
    city: "北海市",
    district: "海城区",
    address: "广西壮族自治区北海市海城区涠洲镇",
    description: "涠洲岛是国内知名火山海岛目的地，兼具海岸地貌、海岛村落和慢节奏度假氛围，适合两天及以上安排。",
    sourceUrls: ["https://zh.wikipedia.org/wiki/%E6%B6%A0%E6%B4%B2%E5%B2%9B"]
  },
  {
    name: "桂林漓江",
    province: "广西壮族自治区",
    city: "桂林市",
    district: "灵川县",
    address: "广西壮族自治区桂林市灵川县磨盘山码头",
    description: "漓江是桂林山水的核心观赏带，适合安排竹筏或游船观景，重点体验山水长卷式的喀斯特河谷景观。",
    sourceUrls: ["https://ftp.qrcode.ltd/%E5%85%A8%E5%9B%BD%E6%97%85%E8%A1%8C%E6%94%BB%E7%95%A5/%E5%8D%8E%E5%8D%97%E5%9C%B0%E5%8C%BA/%E6%88%91%E6%98%AF%E9%A9%B4%E5%8F%8B-%E6%A1%82%E6%9E%97%E6%97%85%E6%B8%B8%E6%94%BB%E7%95%A5.pdf"],
    notes: "漓江景区跨度较大，这里写入常见游客集散点地址。"
  },
  {
    name: "深圳东部华侨城",
    province: "广东省",
    city: "深圳市",
    district: "盐田区",
    address: "广东省深圳市盐田区大梅沙东部华侨城",
    description: "深圳东部华侨城以山海资源和大型休闲娱乐项目结合见长，适合周末短假期的城市近郊度假与主题游玩。",
    sourceUrls: ["https://www.szsalt.com/article/10789.html"],
    notes: "地址为公开常用景区地址，建议后续再补官方游客中心坐标。"
  },
  {
    name: "太行山大峡谷",
    province: "山西省",
    city: "长治市",
    district: "壶关县",
    address: "山西省长治市壶关县桥上乡太行山大峡谷景区",
    description: "太行山大峡谷以峡谷、绝壁和太行山地景观见长，适合自驾环线和步道型观景体验。",
    sourceUrls: ["https://paper.people.com.cn/rmrb/images/2023-04/11/04/rmrb2023041104.pdf"]
  }
];

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanDescription(raw: string) {
  const normalized = normalizeText(raw);
  if (!normalized) return normalized;
  const withoutSource = normalized.replace(/图文来源：.*$/u, "").trim();
  return withoutSource
    .replace(/有问必答\s*[·•]\s*FAQ/gu, "")
    .replace(/攻略\s*概述/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function auditDatabase() {
  const [total, englishAddress, sourceTail, shortDescription, missingAddress] = await Promise.all([
    prisma.spot.count(),
    prisma.spot.count({
      where: {
        address: { contains: "China" }
      }
    }),
    prisma.spot.count({
      where: {
        description: { contains: "图文来源：" }
      }
    }),
    prisma.spot.count({
      where: {
        description: { contains: "图文来源：" }
      }
    }),
    prisma.spot.count({
      where: {
        OR: [{ address: null }, { address: "" }]
      }
    })
  ]);

  return {
    total,
    englishAddress,
    sourceTail,
    shortDescription,
    missingAddress
  };
}

async function cleanDescriptions() {
  const candidates = await prisma.spot.findMany({
    where: {
      description: { contains: "图文来源：" }
    },
    select: {
      id: true,
      description: true
    }
  });

  let updated = 0;
  for (const item of candidates) {
    const cleaned = cleanDescription(item.description);
    if (!cleaned || cleaned === item.description) continue;
    await prisma.spot.update({
      where: { id: item.id },
      data: { description: cleaned }
    });
    updated += 1;
  }

  return {
    candidates: candidates.length,
    updated
  };
}

async function applyCuratedEnrichments() {
  const results: Array<Record<string, unknown>> = [];

  for (const item of curatedEnrichments) {
    const existing = await prisma.spot.findFirst({
      where: {
        name: item.name,
        province: item.province,
        city: item.city
      },
      select: {
        id: true,
        name: true,
        district: true,
        address: true,
        description: true
      }
    });

    if (!existing) {
      results.push({
        name: item.name,
        status: "missing"
      });
      continue;
    }

    await prisma.spot.update({
      where: { id: existing.id },
      data: {
        district: item.district ?? existing.district,
        address: item.address ?? existing.address,
        description: item.description ?? cleanDescription(existing.description)
      }
    });

    results.push({
      name: item.name,
      id: existing.id,
      status: "updated",
      address: item.address ?? existing.address,
      district: item.district ?? existing.district,
      sourceUrls: item.sourceUrls,
      notes: item.notes ?? null
    });
  }

  return results;
}

async function main() {
  ensureDir(REPORT_PATH);

  const before = await auditDatabase();
  const descriptionCleanup = await cleanDescriptions();
  const curated = await applyCuratedEnrichments();
  const after = await auditDatabase();

  const report = {
    generatedAt: new Date().toISOString(),
    before,
    descriptionCleanup,
    curatedUpdated: curated.filter((item) => item.status === "updated").length,
    curatedMissing: curated.filter((item) => item.status === "missing").length,
    after,
    curated
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
