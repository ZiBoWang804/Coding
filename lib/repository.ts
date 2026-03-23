import { PostType, SpotActionType, SpotSubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDatabaseEnabled } from "@/lib/database-mode";
import { loadSeedSpots } from "@/lib/demo-data";
import { buildAmapNavigationUrl, buildGenericHotelUrl, buildGenericTicketUrl } from "@/lib/utils";
import type {
  CheckInItem,
  CommunityPostItem,
  RuralSpotSeed,
  SearchHistoryItem,
  SpotSubmissionItem,
  UserSpotState,
  UserSummary
} from "@/types";

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

function filterSeedSpots(filters?: { province?: string; city?: string; tag?: string; q?: string }) {
  return loadSeedSpots().filter((spot) => {
    if (filters?.province && spot.province !== filters.province) return false;
    if (filters?.city && spot.city !== filters.city) return false;
    if (filters?.tag && !spot.tags.includes(filters.tag)) return false;
    if (filters?.q && !(spot.name.includes(filters.q) || spot.description.includes(filters.q))) return false;
    return true;
  });
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

export async function listSpots(filters?: { province?: string; city?: string; tag?: string; q?: string; ids?: string[] }) {
  if (!hasDatabase()) return filterSeedSpots(filters);

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
    return [];
  }
}

export async function getSpotById(id: string) {
  if (!hasDatabase()) return loadSeedSpots().find((spot) => spot.id === id) ?? null;

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
  const [spots, personalized, recentSearches] = await Promise.all([
    listSpots(),
    user ? getPersonalizedRecommendations(user.id, 6) : Promise.resolve([]),
    user ? listSearchHistory(user.id, 5) : Promise.resolve([])
  ]);

  return {
    featured: spots.slice(0, 6),
    popular: [...spots].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8),
    mapSpots: spots.filter((spot) => spot.latitude != null && spot.longitude != null).slice(0, 12),
    personalized,
    recentSearches
  };
}

export async function getFilterOptions() {
  const spots = await listSpots();
  return {
    provinces: [...new Set(spots.map((spot) => spot.province))],
    cities: [...new Set(spots.map((spot) => spot.city))],
    tags: [...new Set(spots.flatMap((spot) => spot.tags))]
  };
}

export async function createSpot(data: Record<string, unknown>) {
  return prisma.spot.create({ data: data as any });
}

export async function updateSpot(id: string, data: Record<string, unknown>) {
  return prisma.spot.update({ where: { id }, data: data as any });
}

export async function deleteSpot(id: string) {
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
    prisma.spot.findMany({ orderBy: [{ rating: "desc" }, { createdAt: "desc" }], take: 60 })
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

export async function getAdminOverview() {
  if (!hasDatabase()) {
    return { spotCount: 0, userCount: 0, postCount: 0, checkInCount: 0, pendingCount: 0 };
  }
  const [spotCount, userCount, postCount, checkInCount, pendingCount] = await Promise.all([
    prisma.spot.count(),
    prisma.user.count(),
    prisma.post.count(),
    prisma.checkIn.count(),
    prisma.spotSubmission.count({ where: { status: SpotSubmissionStatus.PENDING } })
  ]);

  return { spotCount, userCount, postCount, checkInCount, pendingCount };
}









