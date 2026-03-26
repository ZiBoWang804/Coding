import { Prisma, PostType, SpotActionType, SpotSubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDatabaseEnabled } from "@/lib/database-mode";
import { loadSeedSpots } from "@/lib/demo-data";
import {
  createRuntimeDemoSpot,
  deleteRuntimeDemoSpot,
  getRuntimeDemoSpotById,
  listRuntimeDemoSpots,
  updateRuntimeDemoSpot
} from "@/lib/demo-spot-store";
import { buildAmapNavigationUrl, buildGenericHotelUrl, buildGenericTicketUrl } from "@/lib/utils";
import type { PlannerApiInput } from "@/lib/planner/types";
import type {
  CheckInItem,
  CommunityPostItem,
  RuralSpotSeed,
  SearchHistoryItem,
  SpotSubmissionItem,
  UserSpotState,
  UserSummary
} from "@/types";

const HOME_FEATURED_LIMIT = 6;
const HOME_POPULAR_LIMIT = 8;
const HOME_MAP_LIMIT = 12;
const MAP_SPOT_LIMIT = 120;

type SpotFilters = {
  province?: string;
  city?: string;
  tag?: string;
  q?: string;
  ids?: string[];
  take?: number;
  skip?: number;
  mapReadyOnly?: boolean;
};

type PaginatedSpots = {
  items: RuralSpotSeed[];
  total: number;
  page: number;
  pageSize: number;
};

type HomePlatformStats = {
  spotCount: number;
  userCount: number;
  todayViewCount: number;
};

export type AdminBrowseTrendPoint = {
  dateKey: string;
  label: string;
  visitorCount: number;
  browseCount: number;
};

export type AdminHeatmapSpot = {
  id: string;
  name: string;
  province: string;
  city: string;
  district?: string | null;
  latitude: number;
  longitude: number;
  heatScore: number;
  actionCount: number;
  checkInCount: number;
  postCount: number;
  rating?: number | null;
};

function buildEmptyBrowseTrend(days: number): AdminBrowseTrendPoint[] {
  const safeDays = Math.max(3, Math.min(days, 30));
  const today = new Date();
  const items: AdminBrowseTrendPoint[] = [];

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    items.push({
      dateKey: formatChinaDayKey(date),
      label: formatChinaDayLabel(date),
      visitorCount: 0,
      browseCount: 0
    });
  }

  return items;
}

function isXiAnSpot(spot: Pick<RuralSpotSeed, "city" | "province" | "batch" | "source">) {
  return Boolean(
    spot.city?.includes("西安") ||
      spot.batch?.toLowerCase().includes("xian") ||
      spot.source?.toLowerCase().includes("xian")
  );
}

function isFiveASpot(spot: Pick<RuralSpotSeed, "tags" | "description">) {
  return (
    spot.tags.some((tag) => tag.includes("5A")) ||
    spot.description.includes("5A景区") ||
    spot.description.includes("5A级") ||
    spot.description.includes("常见评级为5A")
  );
}

function isAllowedMapSpot(spot: Pick<RuralSpotSeed, "city" | "province" | "batch" | "source" | "tags" | "description">) {
  return isXiAnSpot(spot) || isFiveASpot(spot);
}

function buildMapWhere(filters?: SpotFilters): Prisma.SpotWhereInput {
  return {
    AND: [
      buildSpotWhere(filters),
      {
        OR: [
          { city: { contains: "西安" } },
          { batch: { contains: "xian", mode: "insensitive" } },
          { source: { contains: "xian", mode: "insensitive" } },
          { tags: { has: "5A景区" } },
          { tags: { has: "5A级景区" } },
          { description: { contains: "5A景区", mode: "insensitive" } },
          { description: { contains: "5A级", mode: "insensitive" } },
          { description: { contains: "常见评级为5A", mode: "insensitive" } }
        ]
      }
    ]
  };
}

function hasDatabase() {
  return isDatabaseEnabled();
}

function buildSpotWhere(filters?: SpotFilters): Prisma.SpotWhereInput {
  return {
    id: filters?.ids ? { in: filters.ids } : undefined,
    province: filters?.province || undefined,
    city: filters?.city || undefined,
    tags: filters?.tag ? { has: filters.tag } : undefined,
    latitude: filters?.mapReadyOnly ? { not: null } : undefined,
    longitude: filters?.mapReadyOnly ? { not: null } : undefined,
    OR: filters?.q
      ? [
          { name: { contains: filters.q, mode: "insensitive" } },
          { description: { contains: filters.q, mode: "insensitive" } },
          { city: { contains: filters.q, mode: "insensitive" } },
          { province: { contains: filters.q, mode: "insensitive" } }
        ]
      : undefined
  };
}

function getSpotOrderBy(): Prisma.SpotOrderByWithRelationInput[] {
  return [
    { imageUrl: { sort: "desc", nulls: "last" } },
    { rating: { sort: "desc", nulls: "last" } },
    { createdAt: "desc" }
  ];
}

function applySlice<T>(items: T[], skip = 0, take?: number) {
  if (take == null) return skip > 0 ? items.slice(skip) : items;
  return items.slice(skip, skip + take);
}

function textIncludes(text: string | null | undefined, keyword: string) {
  if (!text || !keyword) return false;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function matchesPlannerDestinationHard(spot: RuralSpotSeed, keyword: string) {
  return [
    spot.name,
    spot.province,
    spot.city,
    spot.district,
    spot.address
  ].some((field) => textIncludes(field, keyword));
}

function matchesPlannerDestinationSoft(spot: RuralSpotSeed, keyword: string) {
  return [
    spot.description,
    spot.transportInfo,
    ...(spot.tags || []),
    ...(spot.routeHighlights || [])
  ].some((field) => textIncludes(field, keyword));
}

function scorePlannerCandidateSpot(spot: RuralSpotSeed, input: Pick<PlannerApiInput, "origin" | "destinationQuery" | "preferenceTags" | "companions" | "transportMode">) {
  let score = 0;
  const destinationQuery = input.destinationQuery?.trim() || "";
  const origin = input.origin.trim();
  const joinedTags = spot.tags.join(" ");
  const locationText = [spot.province, spot.city, spot.district, spot.address].filter(Boolean).join(" ");
  const richText = `${spot.name} ${locationText} ${spot.description} ${joinedTags}`;

  if (destinationQuery) {
    if (spot.name === destinationQuery) score += 24;
    else if (textIncludes(spot.name, destinationQuery)) score += 18;
    if (textIncludes(locationText, destinationQuery)) score += 14;
    if (textIncludes(spot.description, destinationQuery)) score += 8;
  }

  if (origin) {
    if (textIncludes(locationText, origin)) score += 10;
    else if (textIncludes(spot.description, origin)) score += 4;
  }

  const tagHits = input.preferenceTags.filter((tag) => textIncludes(richText, tag)).length;
  score += tagHits * 3;

  if (input.transportMode === "self_drive" && /自驾|停车|环线/.test(`${spot.transportInfo || ""} ${richText}`)) {
    score += 4;
  }
  if (input.transportMode === "public_transit" && /公交|地铁|高铁|客运|接驳/.test(`${spot.transportInfo || ""} ${richText}`)) {
    score += 4;
  }
  if (input.companions === "family" && /亲子|研学|农事|乐园|家庭/.test(richText)) {
    score += 4;
  }
  if (input.companions === "couple" && /拍照|民宿|咖啡|夜景|温泉/.test(richText)) {
    score += 4;
  }
  if (input.companions === "elderly" && /温泉|康养|慢游|轻松/.test(richText)) {
    score += 4;
  }

  if (spot.imageUrl) score += 1.5;
  score += (spot.rating ?? 0) * 1.2;
  return score;
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

function filterSeedSpots(filters?: SpotFilters) {
  return loadSeedSpots().filter((spot) => {
    if (filters?.ids && (!spot.id || !filters.ids.includes(spot.id))) return false;
    if (filters?.province && spot.province !== filters.province) return false;
    if (filters?.city && spot.city !== filters.city) return false;
    if (filters?.tag && !spot.tags.includes(filters.tag)) return false;
    if (filters?.q && !(spot.name.includes(filters.q) || spot.description.includes(filters.q))) return false;
    if (filters?.mapReadyOnly && (spot.latitude == null || spot.longitude == null)) return false;
    return true;
  });
}

async function listDemoSpots(filters?: SpotFilters) {
  const spots = await listRuntimeDemoSpots();
  const filtered = spots.filter((spot) => {
    if (filters?.ids && (!spot.id || !filters.ids.includes(spot.id))) return false;
    if (filters?.province && spot.province !== filters.province) return false;
    if (filters?.city && spot.city !== filters.city) return false;
    if (filters?.tag && !spot.tags.includes(filters.tag)) return false;
    if (filters?.q && !(spot.name.includes(filters.q) || spot.description.includes(filters.q))) return false;
    if (filters?.mapReadyOnly && (spot.latitude == null || spot.longitude == null)) return false;
    return true;
  });

  return applySlice(filtered, filters?.skip, filters?.take);
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

export async function listSpots(filters?: SpotFilters) {
  if (!hasDatabase()) return listDemoSpots(filters);

  try {
    const spots = await prisma.spot.findMany({
      where: buildSpotWhere(filters),
      orderBy: getSpotOrderBy(),
      skip: filters?.skip,
      take: filters?.take
    });
    return spots.map(mapDbSpot);
  } catch {
    return [];
  }
}

export async function countSpots(filters?: SpotFilters) {
  if (!hasDatabase()) return filterSeedSpots(filters).length;

  try {
    return await prisma.spot.count({ where: buildSpotWhere(filters) });
  } catch {
    return 0;
  }
}

export async function listPagedSpots(filters?: SpotFilters, page = 1, pageSize = 18): Promise<PaginatedSpots> {
  const safePageSize = Math.max(1, Math.min(pageSize, 48));
  const total = await countSpots(filters);
  const maxPage = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, page), maxPage);
  const items = await listSpots({
    ...filters,
    skip: (safePage - 1) * safePageSize,
    take: safePageSize
  });

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize
  };
}

export async function listPlannerCandidateSpots(
  input: Pick<PlannerApiInput, "origin" | "destinationQuery" | "preferenceTags" | "companions" | "transportMode">,
  limit = 220
) {
  const destinationQuery = input.destinationQuery?.trim() || "";
  const originQuery = input.origin.trim();
  const tagSlice = input.preferenceTags.slice(0, 6);

  if (!hasDatabase()) {
    const items = filterSeedSpots();
    if (destinationQuery) {
      const hardMatches = items.filter((spot) => matchesPlannerDestinationHard(spot, destinationQuery));
      if (hardMatches.length > 0) {
        return hardMatches
          .map((spot) => ({ spot, score: scorePlannerCandidateSpot(spot, input) }))
          .sort((left, right) => right.score - left.score)
          .slice(0, limit)
          .map((item) => item.spot);
      }

      const softMatches = items.filter((spot) => matchesPlannerDestinationSoft(spot, destinationQuery));
      if (softMatches.length > 0) {
        return softMatches
          .map((spot) => ({ spot, score: scorePlannerCandidateSpot(spot, input) }))
          .sort((left, right) => right.score - left.score)
          .slice(0, limit)
          .map((item) => item.spot);
      }

      return [];
    }
    return items
      .map((spot) => ({ spot, score: scorePlannerCandidateSpot(spot, input) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((item) => item.spot);
  }

  try {
    if (destinationQuery) {
      const strictRows = await prisma.spot.findMany({
        where: {
          OR: [
            { name: { contains: destinationQuery, mode: "insensitive" } },
            { province: { contains: destinationQuery, mode: "insensitive" } },
            { city: { contains: destinationQuery, mode: "insensitive" } },
            { district: { contains: destinationQuery, mode: "insensitive" } },
            { address: { contains: destinationQuery, mode: "insensitive" } }
          ]
        },
        orderBy: getSpotOrderBy(),
        take: Math.min(limit * 3, 180)
      });

      if (strictRows.length > 0) {
        return strictRows
          .map(mapDbSpot)
          .map((spot) => ({ spot, score: scorePlannerCandidateSpot(spot, input) }))
          .sort((left, right) => right.score - left.score)
          .slice(0, limit)
          .map((item) => item.spot);
      }

      const softRows = await prisma.spot.findMany({
        where: {
          OR: [{ description: { contains: destinationQuery, mode: "insensitive" } }]
        },
        orderBy: getSpotOrderBy(),
        take: Math.min(limit * 2, 120)
      });

      const softMatches = softRows.map(mapDbSpot).filter((spot) => matchesPlannerDestinationSoft(spot, destinationQuery));
      if (softMatches.length > 0) {
        return softMatches
          .map((spot) => ({ spot, score: scorePlannerCandidateSpot(spot, input) }))
          .sort((left, right) => right.score - left.score)
          .slice(0, limit)
          .map((item) => item.spot);
      }

      return [];
    }

    const queries: Array<Promise<any[]>> = [];

    if (originQuery) {
      queries.push(
        prisma.spot.findMany({
          where: {
            OR: [
              { province: { contains: originQuery, mode: "insensitive" } },
              { city: { contains: originQuery, mode: "insensitive" } },
              { district: { contains: originQuery, mode: "insensitive" } },
              { address: { contains: originQuery, mode: "insensitive" } },
              { description: { contains: originQuery, mode: "insensitive" } }
            ]
          },
          orderBy: getSpotOrderBy(),
          take: 120
        })
      );
    }

    if (tagSlice.length > 0) {
      queries.push(
        prisma.spot.findMany({
          where: {
            tags: { hasSome: tagSlice }
          },
          orderBy: getSpotOrderBy(),
          take: 120
        })
      );
    }

    queries.push(
      prisma.spot.findMany({
        orderBy: getSpotOrderBy(),
        take: 160
      })
    );

    const buckets = await Promise.all(queries);
    const merged = new Map<string, RuralSpotSeed>();

    for (const bucket of buckets) {
      for (const row of bucket) {
        const spot = mapDbSpot(row);
        if (!merged.has(spot.id!)) {
          merged.set(spot.id!, spot);
        }
      }
    }

    return Array.from(merged.values())
      .map((spot) => ({ spot, score: scorePlannerCandidateSpot(spot, input) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((item) => item.spot);
  } catch {
    return [];
  }
}

export async function getMapPageData(filters?: SpotFilters, take = MAP_SPOT_LIMIT) {
  const mapFilters: SpotFilters = { ...filters, mapReadyOnly: true };

  if (!hasDatabase()) {
    const items = (await listDemoSpots(mapFilters)).filter(isAllowedMapSpot);
    const spots = applySlice(items, 0, take);
    return {
      spots,
      total: items.length,
      displayed: spots.length,
      truncated: items.length > take
    };
  }

  const [rows, total] = await Promise.all([
    prisma.spot.findMany({
      where: buildMapWhere(mapFilters),
      orderBy: getSpotOrderBy(),
      take
    }),
    prisma.spot.count({ where: buildMapWhere(mapFilters) })
  ]);

  const spots = rows.map(mapDbSpot);

  return {
    spots,
    total,
    displayed: spots.length,
    truncated: total > take
  };
}

export async function getHomePlatformStats(): Promise<HomePlatformStats> {
  if (!hasDatabase()) {
    return {
      spotCount: filterSeedSpots().length,
      userCount: 0,
      todayViewCount: 0
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  try {
    const [spotCount, userCount, todayViewCount] = await Promise.all([
      prisma.spot.count(),
      prisma.user.count(),
      prisma.searchHistory.count({
        where: {
          createdAt: {
            gte: startOfToday,
            lt: startOfTomorrow
          }
        }
      })
    ]);

    return {
      spotCount,
      userCount,
      todayViewCount
    };
  } catch {
    return {
      spotCount: 0,
      userCount: 0,
      todayViewCount: 0
    };
  }
}

export async function getSpotById(id: string) {
  if (!hasDatabase()) return getRuntimeDemoSpotById(id);

  try {
    const spot = await prisma.spot.findUnique({ where: { id } });
    return spot ? mapDbSpot(spot) : null;
  } catch {
    return null;
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

export async function getHomeData(user?: UserSummary | null) {
  const [featured, popular, mapSpots, personalized, recentSearches, platformStats] = await Promise.all([
    listSpots({ take: HOME_FEATURED_LIMIT }),
    listSpots({ take: HOME_POPULAR_LIMIT }),
    listSpots({ mapReadyOnly: true, take: HOME_MAP_LIMIT }),
    user ? getPersonalizedRecommendations(user.id, 6) : Promise.resolve([]),
    user ? listSearchHistory(user.id, 5) : Promise.resolve([]),
    getHomePlatformStats()
  ]);

  return {
    featured,
    popular,
    mapSpots,
    personalized,
    recentSearches,
    platformStats
  };
}

export async function getFilterOptions() {
  if (!hasDatabase()) {
    const spots = await listSpots();
    return {
      provinces: [...new Set(spots.map((spot) => spot.province))],
      cities: [...new Set(spots.map((spot) => spot.city))],
      tags: [...new Set(spots.flatMap((spot) => spot.tags))]
    };
  }

  try {
    const [provinces, cities, tags] = await Promise.all([
      prisma.spot.findMany({
        distinct: ["province"],
        select: { province: true },
        orderBy: { province: "asc" }
      }),
      prisma.spot.findMany({
        distinct: ["city"],
        select: { city: true },
        orderBy: { city: "asc" }
      }),
      prisma.$queryRaw<Array<{ tag: string | null }>>(Prisma.sql`
        SELECT DISTINCT tag
        FROM (
          SELECT unnest("tags") AS tag
          FROM "Spot"
        ) AS expanded_tags
        WHERE tag IS NOT NULL AND tag <> ''
        ORDER BY tag ASC
      `)
    ]);

    return {
      provinces: provinces.map((item) => item.province).filter(Boolean),
      cities: cities.map((item) => item.city).filter(Boolean),
      tags: tags.map((item) => item.tag).filter((item): item is string => Boolean(item))
    };
  } catch {
    return {
      provinces: [],
      cities: [],
      tags: []
    };
  }
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
  if (!hasDatabase()) return { wantToGo: false, visited: false, favorite: false };

  try {
    const actions = await prisma.userSpotAction.findMany({
      where: { userId, spotId }
    });

    return {
      wantToGo: actions.some((item) => item.type === SpotActionType.WANT_TO_GO),
      visited: actions.some((item) => item.type === SpotActionType.VISITED),
      favorite: actions.some((item) => item.type === SpotActionType.FAVORITE)
    };
  } catch {
    return { wantToGo: false, visited: false, favorite: false };
  }
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
    return [];
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true, homeCity: true }
  });

  if (!user) return [];

  const [favoriteActions, searchedIds, spots] = await Promise.all([
    prisma.userSpotAction.findMany({ where: { userId }, select: { spotId: true } }),
    prisma.searchHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { resultIds: true } }),
    prisma.spot.findMany({ orderBy: getSpotOrderBy(), take: 60 })
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

  try {
    const items = await prisma.checkIn.findMany({
      where: { spotId },
      include: { user: { select: { id: true, nickname: true } } },
      orderBy: { createdAt: "desc" },
      take
    });
    return items.map(mapCheckIn);
  } catch {
    return [];
  }
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

  try {
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
  } catch {
    return [];
  }
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
  try {
    const items = await prisma.spotSubmission.findMany({
      where: { status: status ?? undefined },
      include: { user: { select: { id: true, nickname: true, email: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    });
    return items.map(mapSubmission);
  } catch {
    return [];
  }
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

export async function getAdminOverview() {
  if (!hasDatabase()) {
    return { spotCount: 0, userCount: 0, postCount: 0, checkInCount: 0, pendingCount: 0 };
  }
  try {
    const [spotCount, userCount, postCount, checkInCount, pendingCount] = await Promise.all([
      prisma.spot.count(),
      prisma.user.count(),
      prisma.post.count(),
      prisma.checkIn.count(),
      prisma.spotSubmission.count({ where: { status: SpotSubmissionStatus.PENDING } })
    ]);

    return { spotCount, userCount, postCount, checkInCount, pendingCount };
  } catch {
    return { spotCount: 0, userCount: 0, postCount: 0, checkInCount: 0, pendingCount: 0 };
  }
}

function formatChinaDayKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function formatChinaDayLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric"
  }).format(date);
}

export async function getAdminBrowseTrend(days = 7): Promise<AdminBrowseTrendPoint[]> {
  const safeDays = Math.max(3, Math.min(days, 30));
  const today = new Date();
  const buckets = new Map<string, { label: string; users: Set<string>; browseCount: number }>();

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = formatChinaDayKey(date);
    buckets.set(key, {
      label: formatChinaDayLabel(date),
      users: new Set<string>(),
      browseCount: 0
    });
  }

  if (!hasDatabase()) return buildEmptyBrowseTrend(safeDays);

  const start = new Date(today);
  start.setDate(today.getDate() - (safeDays - 1));
  start.setHours(0, 0, 0, 0);

  try {
    const rows = await prisma.searchHistory.findMany({
      where: {
        createdAt: { gte: start }
      },
      select: {
        createdAt: true,
        userId: true
      },
      orderBy: { createdAt: "asc" }
    });

    for (const row of rows) {
      const key = formatChinaDayKey(row.createdAt);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.browseCount += 1;
      bucket.users.add(row.userId);
    }

    return Array.from(buckets.entries()).map(([dateKey, bucket]) => ({
      dateKey,
      label: bucket.label,
      visitorCount: bucket.users.size,
      browseCount: bucket.browseCount
    }));
  } catch {
    return buildEmptyBrowseTrend(safeDays);
  }
}

export async function getAdminSpotHeatmap(limit = 60): Promise<AdminHeatmapSpot[]> {
  if (!hasDatabase()) return [];

  try {
    const rows = await prisma.spot.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null }
      },
      select: {
        id: true,
        name: true,
        province: true,
        city: true,
        district: true,
        latitude: true,
        longitude: true,
        rating: true,
        _count: {
          select: {
            actions: true,
            checkIns: true,
            posts: true
          }
        }
      },
      take: 240
    });

    return rows
      .map((spot) => {
        const actionCount = spot._count.actions;
        const checkInCount = spot._count.checkIns;
        const postCount = spot._count.posts;
        const ratingWeight = Math.round((spot.rating ?? 0) * 2);
        const heatScore = actionCount * 3 + checkInCount * 5 + postCount * 4 + ratingWeight;

        return {
          id: spot.id,
          name: spot.name,
          province: spot.province,
          city: spot.city,
          district: spot.district,
          latitude: spot.latitude!,
          longitude: spot.longitude!,
          heatScore,
          actionCount,
          checkInCount,
          postCount,
          rating: spot.rating
        };
      })
      .sort((left, right) => {
        if (right.heatScore !== left.heatScore) return right.heatScore - left.heatScore;
        return (right.rating ?? 0) - (left.rating ?? 0);
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}









