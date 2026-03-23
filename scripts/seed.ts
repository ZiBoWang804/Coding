import bcrypt from "bcryptjs";
import { PrismaClient, PostType, SpotActionType, UserRole } from "@prisma/client";
import { buildImportPreview, commitImportRows, defaultFieldMapping, loadRowsFromFile } from "@/lib/importer";

const prisma = new PrismaClient();

async function upsertDemoUsers() {
  const adminPasswordHash = await bcrypt.hash("admin123456", 10);
  const demoPasswordHash = await bcrypt.hash("demo123456", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@youxiangji.local" },
    update: {
      nickname: "系统管理员",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      preferences: ["摄影", "文化体验", "自然风光"],
      homeCity: "西安"
    },
    create: {
      email: "admin@youxiangji.local",
      nickname: "系统管理员",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      preferences: ["摄影", "文化体验", "自然风光"],
      homeCity: "西安"
    }
  });

  const demo = await prisma.user.upsert({
    where: { email: "demo@youxiangji.local" },
    update: {
      nickname: "乡旅体验官",
      passwordHash: demoPasswordHash,
      preferences: ["亲子", "摄影", "安静"],
      homeCity: "西安"
    },
    create: {
      email: "demo@youxiangji.local",
      nickname: "乡旅体验官",
      passwordHash: demoPasswordHash,
      preferences: ["亲子", "摄影", "安静"],
      homeCity: "西安"
    }
  });

  return { admin, demo };
}

async function seedCommunity(demoUserId: string) {
  const firstSpot = await prisma.spot.findFirst({ orderBy: [{ rating: "desc" }, { createdAt: "asc" }] });
  if (!firstSpot) return;

  await prisma.userSpotAction.upsert({
    where: {
      userId_spotId_type: {
        userId: demoUserId,
        spotId: firstSpot.id,
        type: SpotActionType.WANT_TO_GO
      }
    },
    update: {},
    create: {
      userId: demoUserId,
      spotId: firstSpot.id,
      type: SpotActionType.WANT_TO_GO
    }
  });

  const post = await prisma.post.upsert({
    where: { id: "seed-guide-post" },
    update: {
      title: `${firstSpot.name} 周末两日路线建议`,
      content: "建议第一天中午前抵达，下午先完成核心打卡和拍照点位，晚上住在县城或村里民宿。第二天一早错峰游览，再安排一顿本地特色餐。",
      tags: ["摄影", "周末游", "路线建议"],
      type: PostType.GUIDE,
      spotId: firstSpot.id,
      userId: demoUserId
    },
    create: {
      id: "seed-guide-post",
      title: `${firstSpot.name} 周末两日路线建议`,
      content: "建议第一天中午前抵达，下午先完成核心打卡和拍照点位，晚上住在县城或村里民宿。第二天一早错峰游览，再安排一顿本地特色餐。",
      tags: ["摄影", "周末游", "路线建议"],
      type: PostType.GUIDE,
      spotId: firstSpot.id,
      userId: demoUserId
    }
  });

  await prisma.comment.upsert({
    where: { id: "seed-guide-comment" },
    update: {
      content: "建议自驾用户提前看好停车位置，旺季下午会更挤。",
      postId: post.id,
      userId: demoUserId,
      spotId: firstSpot.id
    },
    create: {
      id: "seed-guide-comment",
      content: "建议自驾用户提前看好停车位置，旺季下午会更挤。",
      postId: post.id,
      userId: demoUserId,
      spotId: firstSpot.id
    }
  });

  await prisma.checkIn.upsert({
    where: { id: "seed-checkin-1" },
    update: {
      content: "傍晚的光线很适合拍照，村里慢逛体验比赶景点更舒服。",
      userId: demoUserId,
      spotId: firstSpot.id,
      visitDate: new Date()
    },
    create: {
      id: "seed-checkin-1",
      content: "傍晚的光线很适合拍照，村里慢逛体验比赶景点更舒服。",
      userId: demoUserId,
      spotId: firstSpot.id,
      visitDate: new Date()
    }
  });
}

async function main() {
  const rows = loadRowsFromFile("data/rural-spots.seed.csv");
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const preview = buildImportPreview(rows, defaultFieldMapping(headers), {
    source: "manual_seed",
    batch: "seed-2026-q1"
  });

  if (preview.errors.length > 0) {
    console.error("Seed preview contains invalid rows", preview.errors);
    process.exit(1);
  }

  const result = await commitImportRows(prisma, preview.normalizedRows, {
    source: "manual_seed",
    batch: "seed-2026-q1"
  });

  const { admin, demo } = await upsertDemoUsers();
  await seedCommunity(demo.id);

  console.log(`Seed completed: created ${result.created}, updated ${result.updated}, failed ${result.failed.length}`);
  console.log(`Admin account: ${admin.email} / admin123456`);
  console.log(`Demo account: ${demo.email} / demo123456`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });