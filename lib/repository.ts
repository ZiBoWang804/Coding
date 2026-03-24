import { PostType, SpotActionType, SpotSubmissionStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import {
  createRuntimeDemoSpot,
  deleteRuntimeDemoSpot,
  getRuntimeDemoSpotById,
  listRuntimeDemoSpots,
  updateRuntimeDemoSpot
} from "@/lib/demo-spot-store";
import { loadSeedSpots } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import { isDatabaseEnabled } from "@/lib/database-mode";
import { buildAmapNavigationUrl, buildGenericHotelUrl, buildGenericTicketUrl } from "@/lib/utils";
import type {
  AdminWorkspaceData,
  AdminDistributionItem,
  AdminHotSpotItem,
  AdminMonitoringData,
  AdminOverview,
  AdminRecentActivity,
  AdminSpotHealth,
  CheckInItem,
  CommunityPostItem,
  RuralSpotSeed,
  SearchHistoryItem,
  SpotSubmissionItem,
  UserSpotState,
  UserSummary
} from "@/types";

const HOME_SPOT_SELECT = {
  id: true,
  name: true,
  province: true,
  city: true,
  district: true,
  address: true,
  description: true,
  tags: true,
  rating: true,
  crowdLevel: true,
  avgCost: true,
  suggestedDuration: true,
  bestSeason: true,
  transportInfo: true,
  latitude: true,
  longitude: true,
  imageUrl: true,
  ticketBookingUrl: true,
  hotelBookingUrl: true,
  gaodeNavigationUrl: true,
  isNationalKeyVillage: true,
  batch: true,
  source: true,
  accommodationTips: true,
  diningTips: true,
  routeHighlights: true
} as const;

function hasDatabase() {
  return isDatabaseEnabled();
}

function mapDbSpot(spot: any): RuralSpotSeed {
  return {
    id: spot.id,
    name: spot.name,
    province: spot.province,
    city: spot.city,
    district: spot.district,
    address: spot.address,
    description: spot.description,
    tags: spot.tags,
    rating: spot.rating,
    crowdLevel: spot.crowdLevel,
    avgCost: spot.avgCost,
    suggestedDuration: spot.suggestedDuration,
    bestSeason: spot.bestSeason,
    transportInfo: spot.transportInfo,
    latitude: spot.latitude,
    longitude: spot.longitude,
    imageUrl: spot.imageUrl,
    ticketBookingUrl: spot.ticketBookingUrl || buildGenericTicketUrl(spot.name, spot.city),
    hotelBookingUrl: spot.hotelBookingUrl || buildGenericHotelUrl(spot.name, spot.city),
    gaodeNavigationUrl: spot.gaodeNavigationUrl || buildAmapNavigationUrl(spot.name, spot.city, spot.address),
    isNationalKeyVillage: spot.isNationalKeyVillage,
    batch: spot.batch,
    source: spot.source,
    accommodationTips: Array.isArray(spot.accommodationTips) ? spot.accommodationTips : [],
    diningTips: Array.isArray(spot.diningTips) ? spot.diningTips : [],
    routeHighlights: Array.isArray(spot.routeHighlights) ? spot.routeHighlights : []
  };
}

const getCachedHomeTopSpots = unstable_cache(
  async () => {
    const spots = await prisma.spot.findMany({
      select: HOME_SPOT_SELECT,
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: 8
    });

    return spots.map(mapDbSpot);
  },
  ["home-top-spots"],
  { revalidate: 300 }
);

async function listDemoSpots(filters?: { province?: string; city?: string; tag?: string; q?: string; ids?: string[] }): Promise<RuralSpotSeed[]> {
  const demoSpots = await listRuntimeDemoSpots();
  if (!filters?.province && !filters?.city && !filters?.tag && !filters?.q && !filters?.ids?.length) {
    return demoSpots;
  }

  return demoSpots.filter((spot) => {
    if (filters?.ids?.length && !filters.ids.includes(spot.id || "")) return false;
    if (filters?.province && spot.province !== filters.province) return false;
    if (filters?.city && spot.city !== filters.city) return false;
    if (filters?.tag && !spot.tags.includes(filters.tag)) return false;
    if (filters?.q && !(spot.name.includes(filters.q) || spot.description.includes(filters.q))) return false;
    return true;
  });
}

async function getDemoFilterOptions() {
  const spots = await listRuntimeDemoSpots();
  return {
    provinces: [...new Set(spots.map((spot) => spot.province))],
    cities: [...new Set(spots.map((spot) => spot.city))],
    tags: [...new Set(spots.flatMap((spot) => spot.tags))]
  };
}

function mapPost(post: any, currentUserId?: string | null): CommunityPostItem {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    images: post.images,
    tags: post.tags,
    type: post.type,
    createdAt: post.createdAt.toISOString(),
    likeCount: post._count?.likes ?? post.likes?.length ?? 0,
    commentCount: post._count?.comments ?? post.comments?.length ?? 0,
    likedByCurrentUser: currentUserId ? post.likes?.some((like: any) => like.userId === currentUserId) : false,
    author: {
      id: post.user.id,
      nickname: post.user.nickname,
      avatarUrl: post.user.avatarUrl
    },
    comments: (post.comments || []).map((comment: any) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      author: {
        id: comment.user.id,
        nickname: comment.user.nickname
      }
    }))
  };
}

function mapCheckIn(checkIn: any): CheckInItem {
  return {
    id: checkIn.id,
    content: checkIn.content,
    imageUrls: checkIn.imageUrls,
    visitDate: checkIn.visitDate ? checkIn.visitDate.toISOString() : null,
    createdAt: checkIn.createdAt.toISOString(),
    author: {
      id: checkIn.user.id,
      nickname: checkIn.user.nickname
    }
  };
}

function mapSubmission(submission: any): SpotSubmissionItem {
  return {
    id: submission.id,
    name: submission.name,
    province: submission.province,
    city: submission.city,
    district: submission.district,
    description: submission.description,
    tags: submission.tags,
    status: submission.status,
    reviewerNotes: submission.reviewerNotes,
    createdAt: submission.createdAt.toISOString(),
    user: {
      id: submission.user.id,
      nickname: submission.user.nickname,
      email: submission.user.email
    }
  };
}

export async function listSpots(filters?: { province?: string; city?: string; tag?: string; q?: string; ids?: string[] }): Promise<RuralSpotSeed[]> {
  if (!hasDatabase()) return listDemoSpots(filters);

  try {
    const spots = await prisma.spot.findMany({
      where: {
        id: filters?.ids ? { in: filters.ids } : undefined,
        province: filters?.province || undefined,
        city: filters?.city || undefined,
        tags: filters?.tag ? { has: filters.tag } : undefined,
        OR: filters?.q
          ? [
              { name: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } },
              { city: { contains: filters.q, mode: "insensitive" } },
              { province: { contains: filters.q, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }]
    });
    return spots.map(mapDbSpot);
  } catch {
    return listDemoSpots(filters);
  }
}

export async function getSpotById(id: string) {
  if (!hasDatabase()) return getRuntimeDemoSpotById(id);

  try {
    const spot = await prisma.spot.findUnique({ where: { id } });
    return spot ? mapDbSpot(spot) : null;
  } catch {
    return getRuntimeDemoSpotById(id);
  }
}

export async function getSpotDetailData(id: string, currentUserId?: string | null) {
  const spot = await getSpotById(id);
  if (!spot) return null;
  if (!hasDatabase()) {
    return {
      spot,
      state: { wantToGo: false, visited: false, favorite: false },
      posts: [],
      checkIns: []
    };
  }

  const [state, posts, checkIns] = await Promise.all([
    currentUserId ? getSpotState(currentUserId, id) : Promise.resolve({ wantToGo: false, visited: false, favorite: false }),
    listSpotPosts(id, currentUserId),
    listSpotCheckIns(id)
  ]);

  return {
    spot,
    state,
    posts,
    checkIns
  };
}

export async function getHomeData(user?: UserSummary | null): Promise<{
  featured: RuralSpotSeed[];
  popular: RuralSpotSeed[];
  mapSpots: RuralSpotSeed[];
  personalized: RuralSpotSeed[];
  recentSearches: SearchHistoryItem[];
}> {
  if (hasDatabase()) {
    try {
      const [topSpots, personalized, recentSearches] = await Promise.all([
        getCachedHomeTopSpots(),
        user ? getPersonalizedRecommendations(user.id, 6) : Promise.resolve<RuralSpotSeed[]>([]),
        user ? listSearchHistory(user.id, 5) : Promise.resolve<SearchHistoryItem[]>([])
      ]);

      return {
        featured: topSpots.slice(0, 6),
        popular: topSpots,
        mapSpots: [],
        personalized,
        recentSearches
      };
    } catch {
      // Fall through to the generic loader when the database is temporarily unavailable.
    }
  }

  const [spots, personalized, recentSearches] = await Promise.all([
    listSpots(),
    user ? getPersonalizedRecommendations(user.id, 6) : Promise.resolve<RuralSpotSeed[]>([]),
    user ? listSearchHistory(user.id, 5) : Promise.resolve<SearchHistoryItem[]>([])
  ]);

  return {
    featured: spots.slice(0, 6),
    popular: [...spots]
      .sort((left: RuralSpotSeed, right: RuralSpotSeed) => (right.rating ?? 0) - (left.rating ?? 0))
      .slice(0, 8),
    mapSpots: spots
      .filter((spot: RuralSpotSeed) => spot.latitude != null && spot.longitude != null)
      .slice(0, 12),
    personalized,
    recentSearches
  };
}

export async function getFilterOptions() {
  if (!hasDatabase()) return getDemoFilterOptions();

  const spots = await listSpots();
  return {
    provinces: [...new Set(spots.map((spot) => spot.province))],
    cities: [...new Set(spots.map((spot) => spot.city))],
    tags: [...new Set(spots.flatMap((spot) => spot.tags))]
  };
}

export async function createSpot(data: Record<string, unknown>) {
  if (!hasDatabase()) return createRuntimeDemoSpot(data);
  return prisma.spot.create({ data: data as any });
}

export async function updateSpot(id: string, data: Record<string, unknown>) {
  if (!hasDatabase()) return updateRuntimeDemoSpot(id, data);
  return prisma.spot.update({ where: { id }, data: data as any });
}

export async function deleteSpot(id: string) {
  if (!hasDatabase()) return deleteRuntimeDemoSpot(id);
  return prisma.spot.delete({ where: { id } });
}

export async function getSpotState(userId: string, spotId: string): Promise<UserSpotState> {
  if (!hasDatabase()) {
    return { wantToGo: false, visited: false, favorite: false };
  }

  const actions = await prisma.userSpotAction.findMany({
    where: { userId, spotId }
  });

  return {
    wantToGo: actions.some((item) => item.type === SpotActionType.WANT_TO_GO),
    visited: actions.some((item) => item.type === SpotActionType.VISITED),
    favorite: actions.some((item) => item.type === SpotActionType.FAVORITE)
  };
}

export async function setSpotAction(userId: string, spotId: string, action: keyof UserSpotState, active: boolean) {
  const typeMap = {
    wantToGo: SpotActionType.WANT_TO_GO,
    visited: SpotActionType.VISITED,
    favorite: SpotActionType.FAVORITE
  } as const;

  const type = typeMap[action];

  if (active) {
    await prisma.userSpotAction.upsert({
      where: {
        userId_spotId_type: {
          userId,
          spotId,
          type
        }
      },
      update: {},
      create: { userId, spotId, type }
    });
  } else {
    await prisma.userSpotAction.deleteMany({ where: { userId, spotId, type } });
  }

  return getSpotState(userId, spotId);
}

export async function createSearchHistory(userId: string, payload: { query?: string; province?: string; city?: string; tag?: string; preferences?: string[]; resultIds?: string[] }) {
  if (!hasDatabase()) return null;

  try {
    return await prisma.searchHistory.create({
      data: {
        userId,
        query: payload.query,
        province: payload.province,
        city: payload.city,
        tag: payload.tag,
        preferences: payload.preferences ?? [],
        resultIds: payload.resultIds ?? []
      }
    });
  } catch {
    return null;
  }
}

export async function listSearchHistory(userId: string, take = 8): Promise<SearchHistoryItem[]> {
  if (!hasDatabase()) return [];

  try {
    const items = await prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take
    });

    return items.map((item) => ({
      id: item.id,
      query: item.query,
      province: item.province,
      city: item.city,
      tag: item.tag,
      preferences: item.preferences,
      resultIds: item.resultIds,
      createdAt: item.createdAt.toISOString()
    }));
  } catch {
    return [];
  }
}

export async function updateUserProfile(userId: string, data: Partial<Pick<UserSummary, "nickname" | "bio" | "avatarUrl" | "preferences" | "homeCity">>) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      nickname: data.nickname,
      bio: data.bio,
      avatarUrl: data.avatarUrl,
      preferences: data.preferences,
      homeCity: data.homeCity
    },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      bio: true,
      role: true,
      preferences: true,
      homeCity: true
    }
  });

  return user;
}

export async function getPersonalizedRecommendations(userId: string, take = 6) {
  if (!hasDatabase()) {
    return loadSeedSpots().slice(0, take);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true, homeCity: true }
  });

  if (!user) return [];

  const [favoriteActions, searchedIds, spots] = await Promise.all([
    prisma.userSpotAction.findMany({ where: { userId }, select: { spotId: true } }),
    prisma.searchHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { resultIds: true } }),
    prisma.spot.findMany({
      select: HOME_SPOT_SELECT,
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: 60
    })
  ]);

  const preferredIds = new Set(favoriteActions.map((item) => item.spotId));
  const recentIds = new Set(searchedIds.flatMap((item) => item.resultIds));

  return spots
    .map((spot) => {
      const preferenceHit = user.preferences.filter((pref) => spot.tags.includes(pref)).length;
      const score =
        preferenceHit * 2 +
        (user.homeCity && (spot.city.includes(user.homeCity) || user.homeCity.includes(spot.city)) ? 1.8 : 0) +
        ((preferredIds.has(spot.id) || recentIds.has(spot.id)) ? 0.4 : 0) +
        ((spot.rating ?? 0) / 5) +
        ((spot.crowdLevel ?? 3) <= 3 ? 0.4 : 0);
      return { spot, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .map((item) => mapDbSpot(item.spot));
}

export async function createCheckIn(userId: string, spotId: string, data: { content?: string; imageUrls?: string[]; visitDate?: string }) {
  const checkIn = await prisma.checkIn.create({
    data: {
      userId,
      spotId,
      content: data.content,
      imageUrls: data.imageUrls ?? [],
      visitDate: data.visitDate ? new Date(data.visitDate) : undefined
    },
    include: {
      user: { select: { id: true, nickname: true } }
    }
  });

  await prisma.userSpotAction.upsert({
    where: {
      userId_spotId_type: {
        userId,
        spotId,
        type: SpotActionType.VISITED
      }
    },
    update: {},
    create: {
      userId,
      spotId,
      type: SpotActionType.VISITED
    }
  });

  return mapCheckIn(checkIn);
}

export async function listSpotCheckIns(spotId: string, take = 12): Promise<CheckInItem[]> {
  if (!hasDatabase()) return [];

  const items = await prisma.checkIn.findMany({
    where: { spotId },
    include: { user: { select: { id: true, nickname: true } } },
    orderBy: { createdAt: "desc" },
    take
  });
  return items.map(mapCheckIn);
}

export async function createPost(userId: string, spotId: string, data: { title: string; content: string; tags?: string[]; images?: string[]; type?: "STORY" | "GUIDE" }) {
  const post = await prisma.post.create({
    data: {
      userId,
      spotId,
      title: data.title,
      content: data.content,
      tags: data.tags ?? [],
      images: data.images ?? [],
      type: data.type === "GUIDE" ? PostType.GUIDE : PostType.STORY
    },
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true } },
      comments: { include: { user: { select: { id: true, nickname: true } } }, take: 5, orderBy: { createdAt: "asc" } },
      likes: true,
      _count: { select: { comments: true, likes: true } }
    }
  });

  return mapPost(post, userId);
}

export async function listSpotPosts(spotId: string, currentUserId?: string | null, take = 20): Promise<CommunityPostItem[]> {
  if (!hasDatabase()) return [];

  const posts = await prisma.post.findMany({
    where: { spotId },
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true } },
      comments: {
        include: { user: { select: { id: true, nickname: true } } },
        orderBy: { createdAt: "asc" },
        take: 6
      },
      likes: currentUserId ? { where: { userId: currentUserId } } : true,
      _count: { select: { comments: true, likes: true } }
    },
    orderBy: [{ type: "desc" }, { createdAt: "desc" }],
    take
  });

  return posts.map((post) => mapPost(post, currentUserId));
}

export async function addComment(userId: string, postId: string, content: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { spotId: true } });
  if (!post) throw new Error("Post not found");

  const comment = await prisma.comment.create({
    data: {
      userId,
      postId,
      spotId: post.spotId,
      content
    },
    include: { user: { select: { id: true, nickname: true } } }
  });

  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.user.id,
      nickname: comment.user.nickname
    }
  };
}

export async function togglePostLike(userId: string, postId: string) {
  const existing = await prisma.postLike.findUnique({
    where: {
      postId_userId: {
        postId,
        userId
      }
    }
  });

  if (existing) {
    await prisma.postLike.delete({ where: { postId_userId: { postId, userId } } });
  } else {
    await prisma.postLike.create({ data: { postId, userId } });
  }

  const count = await prisma.postLike.count({ where: { postId } });
  return { liked: !existing, count };
}

export async function createSpotSubmission(userId: string, data: {
  name: string;
  province: string;
  city: string;
  district?: string;
  address?: string;
  description: string;
  tags: string[];
  suggestedDuration?: string;
  transportInfo?: string;
  imageUrl?: string;
  contactName?: string;
  contactPhone?: string;
  reason?: string;
}) {
  return prisma.spotSubmission.create({
    data: {
      userId,
      ...data
    }
  });
}

export async function listUserSubmissions(userId: string): Promise<SpotSubmissionItem[]> {
  if (!hasDatabase()) return [];

  const items = await prisma.spotSubmission.findMany({
    where: { userId },
    include: { user: { select: { id: true, nickname: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });
  return items.map(mapSubmission);
}

export async function listPendingSubmissions(status?: SpotSubmissionStatus): Promise<SpotSubmissionItem[]> {
  if (!hasDatabase()) return [];
  const items = await prisma.spotSubmission.findMany({
    where: { status: status ?? undefined },
    include: { user: { select: { id: true, nickname: true, email: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
  return items.map(mapSubmission);
}

export async function reviewSubmission(submissionId: string, decision: "APPROVED" | "REJECTED", reviewerNotes?: string) {
  const submission = await prisma.spotSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new Error("Submission not found");

  if (decision === "REJECTED") {
    return prisma.spotSubmission.update({
      where: { id: submissionId },
      data: {
        status: SpotSubmissionStatus.REJECTED,
        reviewerNotes,
        reviewedAt: new Date()
      }
    });
  }

  const existingSpot = await prisma.spot.findFirst({
    where: {
      name: submission.name,
      province: submission.province,
      city: submission.city,
      district: submission.district ?? null
    }
  });

  const spot = existingSpot
    ? await prisma.spot.update({
        where: { id: existingSpot.id },
        data: {
          address: submission.address,
          description: submission.description,
          tags: submission.tags,
          suggestedDuration: submission.suggestedDuration,
          transportInfo: submission.transportInfo,
          imageUrl: submission.imageUrl,
          source: submission.source,
          batch: "user-approved-submissions"
        }
      })
    : await prisma.spot.create({
        data: {
          name: submission.name,
          province: submission.province,
          city: submission.city,
          district: submission.district,
          address: submission.address,
          description: submission.description,
          tags: submission.tags,
          suggestedDuration: submission.suggestedDuration,
          bestSeason: ["spring", "autumn"],
          transportInfo: submission.transportInfo,
          imageUrl: submission.imageUrl,
          source: submission.source,
          batch: "user-approved-submissions"
        }
      });

  return prisma.spotSubmission.update({
    where: { id: submissionId },
    data: {
      status: SpotSubmissionStatus.APPROVED,
      reviewerNotes,
      reviewedAt: new Date(),
      approvedSpotId: spot.id
    }
  });
}

function buildDistribution(items: string[], take = 6): AdminDistributionItem[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = item?.trim() || "未标注";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, take)
    .map(([label, count]) => ({ label, count }));
}

function buildSpotHealth(spots: RuralSpotSeed[]): AdminSpotHealth {
  return {
    missingCoordinates: spots.filter((spot) => spot.latitude == null || spot.longitude == null).length,
    missingImages: spots.filter((spot) => !spot.imageUrl).length,
    missingTransportInfo: spots.filter((spot) => !spot.transportInfo).length,
    missingTicketLinks: spots.filter((spot) => !spot.ticketBookingUrl).length,
    missingHotelLinks: spots.filter((spot) => !spot.hotelBookingUrl).length
  };
}

function buildMissingFieldLabels(spot: RuralSpotSeed) {
  const missing: string[] = [];
  if (spot.latitude == null || spot.longitude == null) missing.push("坐标");
  if (!spot.imageUrl) missing.push("封面图");
  if (!spot.transportInfo) missing.push("交通");
  if (!spot.ticketBookingUrl) missing.push("门票");
  if (!spot.hotelBookingUrl) missing.push("酒店");
  return missing;
}

function buildHotSpotItems(
  spots: RuralSpotSeed[],
  counts?: Map<string, { postCount: number; checkInCount: number; favoriteCount: number }>
): AdminHotSpotItem[] {
  return spots
    .map((spot: RuralSpotSeed) => {
      const metrics = counts?.get(spot.id || "") ?? {
        postCount: 0,
        checkInCount: 0,
        favoriteCount: 0
      };

      return {
        id: spot.id || spot.name,
        name: spot.name,
        city: spot.city,
        rating: spot.rating,
        postCount: metrics.postCount,
        checkInCount: metrics.checkInCount,
        favoriteCount: metrics.favoriteCount,
        missingFields: buildMissingFieldLabels(spot)
      };
    })
    .sort((left, right) => {
      const leftScore = left.postCount + left.checkInCount + left.favoriteCount;
      const rightScore = right.postCount + right.checkInCount + right.favoriteCount;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return (right.rating ?? 0) - (left.rating ?? 0);
    })
    .slice(0, 6);
}

function buildDemoMonitoring(spots: RuralSpotSeed[]): AdminMonitoringData {
  const health = buildSpotHealth(spots);
  return {
    mode: "demo",
    health,
    cards: [
      {
        label: "已接入景点",
        value: spots.length,
        hint: "演示模式下可以直接管理本地景点数据。",
        tone: "neutral"
      },
      {
        label: "资料待补",
        value: spots.filter((spot) => buildMissingFieldLabels(spot).length > 0).length,
        hint: "建议优先补齐图片、坐标、交通和门票入口。",
        tone: "warning"
      },
      {
        label: "高评分景点",
        value: spots.filter((spot) => (spot.rating ?? 0) >= 4.5).length,
        hint: "适合作为首页推荐和活动宣发资源。",
        tone: "good"
      },
      {
        label: "西安相关景点",
        value: spots.filter((spot) => `${spot.province}${spot.city}${spot.district ?? ""}`.includes("西安")).length,
        hint: "便于聚焦当前西安专题运营。",
        tone: "neutral"
      }
    ],
    sourceBreakdown: buildDistribution(spots.map((spot) => spot.source || "manual_seed")),
    cityBreakdown: buildDistribution(spots.map((spot) => spot.city)),
    hotSpots: buildHotSpotItems(spots),
    recentActivities: []
  };
}

function toIsoString(value?: Date | string | null) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

export async function getAdminWorkspaceData(): Promise<AdminWorkspaceData> {
  const spots = await listSpots();

  if (!hasDatabase()) {
    return {
      overview: {
        spotCount: spots.length,
        userCount: 1,
        postCount: 0,
        checkInCount: 0,
        pendingCount: 0,
        searchCount: 0,
        approvedCount: 0,
        rejectedCount: 0
      },
      monitoring: buildDemoMonitoring(spots),
      spots,
      submissions: []
    };
  }

  const recentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    spotCount,
    userCount,
    postCount,
    checkInCount,
    pendingCount,
    searchCount,
    approvedCount,
    rejectedCount,
    submissions,
    recentSearches,
    recentPosts,
    recentCheckIns,
    recentPostCount,
    recentCheckInCount,
    recentSearchCount,
    favoriteGroups,
    spotCounts
  ] = await Promise.all([
    prisma.spot.count(),
    prisma.user.count(),
    prisma.post.count(),
    prisma.checkIn.count(),
    prisma.spotSubmission.count({ where: { status: SpotSubmissionStatus.PENDING } }),
    prisma.searchHistory.count(),
    prisma.spotSubmission.count({ where: { status: SpotSubmissionStatus.APPROVED } }),
    prisma.spotSubmission.count({ where: { status: SpotSubmissionStatus.REJECTED } }),
    listPendingSubmissions(),
    prisma.searchHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { nickname: true } } }
    }),
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        user: { select: { nickname: true } },
        spot: { select: { name: true } },
        _count: { select: { likes: true, comments: true } }
      }
    }),
    prisma.checkIn.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        user: { select: { nickname: true } },
        spot: { select: { name: true } }
      }
    }),
    prisma.post.count({ where: { createdAt: { gte: recentSince } } }),
    prisma.checkIn.count({ where: { createdAt: { gte: recentSince } } }),
    prisma.searchHistory.count({ where: { createdAt: { gte: recentSince } } }),
    prisma.userSpotAction.groupBy({
      by: ["spotId"],
      where: { type: SpotActionType.FAVORITE },
      _count: { _all: true }
    }),
    prisma.spot.findMany({
      select: {
        id: true,
        _count: { select: { posts: true, checkIns: true } }
      }
    })
  ]);

  const hotSpotCounts = new Map<string, { postCount: number; checkInCount: number; favoriteCount: number }>();
  for (const item of spotCounts) {
    hotSpotCounts.set(item.id, {
      postCount: item._count.posts,
      checkInCount: item._count.checkIns,
      favoriteCount: 0
    });
  }

  for (const item of favoriteGroups) {
    const current = hotSpotCounts.get(item.spotId) ?? {
      postCount: 0,
      checkInCount: 0,
      favoriteCount: 0
    };
    hotSpotCounts.set(item.spotId, {
      ...current,
      favoriteCount: item._count._all
    });
  }

  const health = buildSpotHealth(spots);
  const monitoring: AdminMonitoringData = {
    mode: "database",
    health,
    cards: [
      {
        label: "近 7 天搜索",
        value: recentSearchCount,
        hint: "反映用户查找目的地和攻略的热度变化。",
        tone: "neutral"
      },
      {
        label: "近 7 天发帖",
        value: recentPostCount,
        hint: "衡量社区内容生产情况。",
        tone: recentPostCount > 0 ? "good" : "warning"
      },
      {
        label: "近 7 天打卡",
        value: recentCheckInCount,
        hint: "反映实际到访和线下活跃度。",
        tone: recentCheckInCount > 0 ? "good" : "warning"
      },
      {
        label: "资料待补景点",
        value: spots.filter((spot) => buildMissingFieldLabels(spot).length > 0).length,
        hint: "建议优先清理缺图、缺坐标、缺交通和缺入口的景点。",
        tone: "warning"
      }
    ],
    sourceBreakdown: buildDistribution(spots.map((spot) => spot.source || "admin_import")),
    cityBreakdown: buildDistribution(spots.map((spot) => spot.city)),
    hotSpots: buildHotSpotItems(spots, hotSpotCounts),
    recentActivities: [
      ...recentSearches.map<AdminRecentActivity>((item) => ({
        id: `search-${item.id}`,
        type: "search",
        title: item.query || [item.province, item.city, item.tag].filter(Boolean).join(" / ") || "综合浏览",
        subtitle: `搜索用户：${item.user.nickname}`,
        createdAt: toIsoString(item.createdAt),
        metric: `${item.resultIds.length} 个结果`
      })),
      ...recentPosts.map<AdminRecentActivity>((item) => ({
        id: `post-${item.id}`,
        type: "post",
        title: item.title,
        subtitle: `${item.user.nickname} 发布于 ${item.spot?.name || "未知景点"}`,
        createdAt: toIsoString(item.createdAt),
        metric: `${item._count.likes} 赞 · ${item._count.comments} 评论`
      })),
      ...recentCheckIns.map<AdminRecentActivity>((item) => ({
        id: `checkin-${item.id}`,
        type: "checkin",
        title: item.spot?.name || "未知景点打卡",
        subtitle: `${item.user.nickname} 提交了新的到访记录`,
        createdAt: toIsoString(item.createdAt),
        metric: item.visitDate ? `到访日期 ${item.visitDate.toISOString().slice(0, 10)}` : "未填写到访日期"
      }))
    ]
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
      .slice(0, 10)
  };

  const overview: AdminOverview = {
    spotCount,
    userCount,
    postCount,
    checkInCount,
    pendingCount,
    searchCount,
    approvedCount,
    rejectedCount
  };

  return {
    overview,
    monitoring,
    spots,
    submissions
  };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const data = await getAdminWorkspaceData();
  return data.overview;
}
