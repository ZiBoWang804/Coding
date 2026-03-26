import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type SpotFix = {
  name: string;
  province: string;
  city: string;
  district?: string | null;
  address: string;
};

type DeleteTarget = {
  name: string;
  province: string;
  city: string;
};

const prisma = new PrismaClient();
const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "data", "import-ready", "remaining-spots-final-refine.report.json");

const fixes: SpotFix[] = [
  { name: "中华麋鹿园", province: "江苏省", city: "盐城市", district: "大丰区", address: "江苏省盐城市大丰区川东镇中华麋鹿园景区" },
  { name: "乌孙古道", province: "新疆维吾尔自治区", city: "阿克苏地区", district: "拜城县", address: "新疆维吾尔自治区阿克苏地区拜城县黑英山乡乌孙古道南入口" },
  { name: "南北湖", province: "浙江省", city: "嘉兴市", district: "海盐县", address: "浙江省嘉兴市海盐县澉浦镇南北湖风景区" },
  { name: "南山竹海", province: "江苏省", city: "常州市", district: "溧阳市", address: "江苏省常州市溧阳市戴埠镇李家园村下场园10号" },
  { name: "唐模", province: "安徽省", city: "黄山市", district: "徽州区", address: "安徽省黄山市徽州区潜口镇唐模村" },
  { name: "天山天池", province: "新疆维吾尔自治区", city: "昌吉回族自治州", district: "阜康市", address: "新疆维吾尔自治区昌吉回族自治州阜康市天山天池风景区" },
  { name: "广仁寺", province: "陕西省", city: "西安市", district: "莲湖区", address: "陕西省西安市莲湖区西北一路152号" },
  { name: "新疆国际大巴扎", province: "新疆维吾尔自治区", city: "乌鲁木齐市", district: "天山区", address: "新疆维吾尔自治区乌鲁木齐市天山区解放南路518号" },
  { name: "明永冰川", province: "云南省", city: "迪庆藏族自治州", district: "德钦县", address: "云南省迪庆藏族自治州德钦县云岭乡明永村" },
  { name: "洱海", province: "云南省", city: "大理白族自治州", district: "大理市", address: "云南省大理白族自治州大理市环海东路" },
  { name: "湘子庙", province: "陕西省", city: "西安市", district: "碑林区", address: "陕西省西安市碑林区湘子庙街18号" },
  { name: "秦岭国家植物园", province: "陕西省", city: "西安市", district: "周至县", address: "陕西省西安市周至县集贤镇秦岭国家植物园" },
  { name: "西安环城公园", province: "陕西省", city: "西安市", district: "碑林区", address: "陕西省西安市碑林区环城南路东段" },
  { name: "西安钟楼", province: "陕西省", city: "西安市", district: "碑林区", address: "陕西省西安市碑林区东西南北四条大街交汇处" },
  { name: "赛里木湖", province: "新疆维吾尔自治区", city: "博尔塔拉蒙古自治州", district: "博乐市", address: "新疆维吾尔自治区博尔塔拉蒙古自治州博乐市赛里木湖景区" },
  { name: "那拉提空中草原", province: "新疆维吾尔自治区", city: "伊犁哈萨克自治州", district: "新源县", address: "新疆维吾尔自治区伊犁哈萨克自治州新源县那拉提镇那拉提景区" },
  { name: "那拉提草原", province: "新疆维吾尔自治区", city: "伊犁哈萨克自治州", district: "新源县", address: "新疆维吾尔自治区伊犁哈萨克自治州新源县那拉提镇那拉提景区" },
  { name: "长影世纪城", province: "吉林省", city: "长春市", district: "南关区", address: "吉林省长春市南关区永顺路北长影世纪城" },
  { name: "青秀山", province: "广西壮族自治区", city: "南宁市", district: "青秀区", address: "广西壮族自治区南宁市青秀区凤岭南路6-6号" },
  { name: "苍山", province: "云南省", city: "大理白族自治州", district: "大理市", address: "云南省大理白族自治州大理市苍山景区" },
  { name: "凤凰古城", province: "湖南省", city: "湘西土家族苗族自治州", district: "凤凰县", address: "湖南省湘西土家族苗族自治州凤凰县沱江镇凤凰古城景区" },
  { name: "香格里拉", province: "云南省", city: "迪庆藏族自治州", district: "香格里拉市", address: "云南省迪庆藏族自治州香格里拉市建塘镇" },
  { name: "长白山", province: "吉林省", city: "延边朝鲜族自治州", district: "安图县", address: "吉林省延边朝鲜族自治州安图县二道白河镇长白山景区" },
  { name: "普达措国家公园", province: "云南省", city: "迪庆藏族自治州", district: "香格里拉市", address: "云南省迪庆藏族自治州香格里拉市建塘镇普达措国家公园" },
  { name: "海螺沟", province: "四川省", city: "甘孜藏族自治州", district: "泸定县", address: "四川省甘孜藏族自治州泸定县磨西镇海螺沟景区" },
  { name: "大理古城", province: "云南省", city: "大理白族自治州", district: "大理市", address: "云南省大理白族自治州大理市大理古城" },
  { name: "黄龙", province: "四川省", city: "阿坝藏族羌族自治州", district: "松潘县", address: "四川省阿坝藏族羌族自治州松潘县黄龙乡黄龙景区" },
  { name: "元阳梯田", province: "云南省", city: "红河哈尼族彝族自治州", district: "元阳县", address: "云南省红河哈尼族彝族自治州元阳县新街镇多依树景区" },
  { name: "福州三山两塔", province: "福建省", city: "福州市", district: "鼓楼区", address: "福建省福州市鼓楼区乌山路" },
  { name: "六鼎山", province: "吉林省", city: "延边朝鲜族自治州", district: "敦化市", address: "吉林省延边朝鲜族自治州敦化市六鼎山文化旅游区" },
  { name: "四姑娘山", province: "四川省", city: "阿坝藏族羌族自治州", district: "小金县", address: "四川省阿坝藏族羌族自治州小金县四姑娘山镇四姑娘山景区" },
  { name: "延边朝鲜族民俗园", province: "吉林省", city: "延边朝鲜族自治州", district: "延吉市", address: "吉林省延边朝鲜族自治州延吉市延南路" },
  { name: "虎跳峡", province: "云南省", city: "迪庆藏族自治州", district: "香格里拉市", address: "云南省迪庆藏族自治州香格里拉市虎跳峡镇虎跳峡景区" },
  { name: "防川风景区", province: "吉林省", city: "延边朝鲜族自治州", district: "珲春市", address: "吉林省延边朝鲜族自治州珲春市敬信镇防川村" },
  { name: "稻城亚丁", province: "四川省", city: "甘孜藏族自治州", district: "稻城县", address: "四川省甘孜藏族自治州稻城县香格里拉镇亚丁景区" },
  { name: "芙蓉镇", province: "湖南省", city: "湘西土家族苗族自治州", district: "永顺县", address: "湖南省湘西土家族苗族自治州永顺县芙蓉镇" },
  { name: "西双版纳野象谷", province: "云南省", city: "西双版纳傣族自治州", district: "景洪市", address: "云南省西双版纳傣族自治州景洪市勐养镇野象谷景区" },
  { name: "建水古城", province: "云南省", city: "红河哈尼族彝族自治州", district: "建水县", address: "云南省红河哈尼族彝族自治州建水县临安镇" },
  { name: "德夯大峡谷", province: "湖南省", city: "湘西土家族苗族自治州", district: "吉首市", address: "湖南省湘西土家族苗族自治州吉首市矮寨镇德夯景区" },
  { name: "恩施大峡谷", province: "湖北省", city: "恩施土家族苗族自治州", district: "恩施市", address: "湖北省恩施土家族苗族自治州恩施市屯堡乡和板桥镇境内" },
  { name: "泸沽湖", province: "四川省", city: "凉山彝族自治州", district: "盐源县", address: "四川省凉山彝族自治州盐源县泸沽湖镇" },
  { name: "梅里雪山", province: "云南省", city: "迪庆藏族自治州", district: "德钦县", address: "云南省迪庆藏族自治州德钦县升平镇雾浓顶观景台" },
  { name: "西双版纳热带植物园", province: "云南省", city: "西双版纳傣族自治州", district: "勐腊县", address: "云南省西双版纳傣族自治州勐腊县勐仑镇中国科学院西双版纳热带植物园" },
  { name: "九寨沟", province: "四川省", city: "阿坝藏族羌族自治州", district: "九寨沟县", address: "四川省阿坝藏族羌族自治州九寨沟县漳扎镇" },
  { name: "崇圣寺三塔", province: "云南省", city: "大理白族自治州", district: "大理市", address: "云南省大理白族自治州大理市三塔路" },
  { name: "乾陵", province: "陕西省", city: "咸阳市", district: "乾县", address: "陕西省咸阳市乾县城关街道乾陵景区" },
  { name: "寿县古城", province: "安徽省", city: "淮南市", district: "寿县", address: "安徽省淮南市寿县寿春镇" },
  { name: "荆州古城", province: "湖北省", city: "荆州市", district: "荆州区", address: "湖北省荆州市荆州区张居正街2号" },
  { name: "东林寺", province: "江西省", city: "九江市", district: "庐山市", address: "江西省九江市庐山市温泉镇东林寺" },
  { name: "壶口瀑布", province: "山西省", city: "临汾市", district: "吉县", address: "山西省临汾市吉县壶口镇壶口瀑布景区" },
  { name: "槟榔谷", province: "海南省", city: "保亭县", district: "保亭黎族苗族自治县", address: "海南省保亭黎族苗族自治县三道镇甘什岭自然保护区槟榔谷景区" },
  { name: "碛口古镇", province: "山西省", city: "吕梁市", district: "临县", address: "山西省吕梁市临县碛口镇" },
  { name: "白云山", province: "辽宁省", city: "大连市", district: "西岗区", address: "辽宁省大连市西岗区滨海西路白云山风景区" },
  { name: "钟楼", province: "北京市", city: "北京市", district: "东城区", address: "北京市东城区钟楼湾临字9号" }
];

const deleteTargets: DeleteTarget[] = [
  { name: "博物馆", province: "广西壮族自治区", city: "防城港市" },
  { name: "大草原", province: "重庆市", city: "重庆市" },
  { name: "大兴安岭", province: "内蒙古自治区", city: "呼伦贝尔市" },
  { name: "法门寺", province: "安徽省", city: "安庆市" },
  { name: "海洋馆", province: "福建省", city: "莆田市" },
  { name: "河谷草原", province: "新疆维吾尔自治区", city: "伊犁哈萨克自治州" },
  { name: "花海", province: "云南省", city: "丽江市" },
  { name: "冷水", province: "广西壮族自治区", city: "桂林市" },
  { name: "龙湖", province: "福建省", city: "三明市" },
  { name: "马鞍山", province: "广西壮族自治区", city: "柳州市" },
  { name: "瀑布", province: "广西壮族自治区", city: "桂林市" },
  { name: "石林", province: "新疆维吾尔自治区", city: "北疆地区" },
  { name: "天空之城", province: "台湾省", city: "新北市" },
  { name: "遗址", province: "湖北省", city: "咸宁市" },
  { name: "栈道", province: "四川省", city: "广元市" },
  { name: "植物园", province: "广东省", city: "珠海市" }
];

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function main() {
  ensureDir(REPORT_PATH);

  const updated: Array<Record<string, unknown>> = [];
  const updateMissing: Array<Record<string, unknown>> = [];
  const deleted: Array<Record<string, unknown>> = [];
  const deleteSkipped: Array<Record<string, unknown>> = [];

  for (const item of fixes) {
    const spot = await prisma.spot.findFirst({
      where: {
        name: item.name,
        province: item.province,
        city: item.city
      },
      select: {
        id: true,
        name: true,
        province: true,
        city: true,
        district: true,
        address: true
      }
    });

    if (!spot) {
      updateMissing.push(item);
      continue;
    }

    await prisma.spot.update({
      where: { id: spot.id },
      data: {
        district: item.district ?? spot.district,
        address: item.address
      }
    });

    updated.push({
      id: spot.id,
      name: spot.name,
      province: spot.province,
      city: spot.city,
      previousDistrict: spot.district,
      previousAddress: spot.address,
      nextAddress: item.address
    });
  }

  for (const item of deleteTargets) {
    const spot = await prisma.spot.findFirst({
      where: {
        name: item.name,
        province: item.province,
        city: item.city
      },
      select: {
        id: true,
        name: true,
        province: true,
        city: true,
        _count: {
          select: {
            observations: true,
            posts: true,
            comments: true,
            checkIns: true,
            submissionsApproved: true,
            actions: true
          }
        }
      }
    });

    if (!spot) {
      deleteSkipped.push({ ...item, reason: "not_found" });
      continue;
    }

    await prisma.spot.delete({
      where: { id: spot.id }
    });

    deleted.push({
      id: spot.id,
      name: spot.name,
      province: spot.province,
      city: spot.city,
      relatedCount: Object.values(spot._count).reduce((sum, value) => sum + value, 0)
    });
  }

  const [missingAddress, englishAddress, total] = await Promise.all([
    prisma.spot.count({
      where: {
        OR: [{ address: null }, { address: "" }]
      }
    }),
    prisma.spot.count({
      where: {
        address: {
          contains: "China"
        }
      }
    }),
    prisma.spot.count()
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    updatedCount: updated.length,
    deletedCount: deleted.length,
    updateMissingCount: updateMissing.length,
    deleteSkippedCount: deleteSkipped.length,
    remaining: {
      total,
      missingAddress,
      englishAddress
    },
    updated,
    deleted,
    updateMissing,
    deleteSkipped
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
