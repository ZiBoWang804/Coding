import { unstable_cache } from "next/cache";
import { isDatabaseEnabled } from "@/lib/database-mode";
import { prisma } from "@/lib/prisma";
import type { RuralSpotSeed } from "@/types";

const XIAN_TOPIC_SELECT = {
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
  isNationalKeyVillage: true,
  batch: true,
  source: true,
  accommodationTips: true,
  diningTips: true,
  routeHighlights: true
} as const;

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
    isNationalKeyVillage: spot.isNationalKeyVillage,
    batch: spot.batch,
    source: spot.source,
    accommodationTips: Array.isArray(spot.accommodationTips) ? spot.accommodationTips : [],
    diningTips: Array.isArray(spot.diningTips) ? spot.diningTips : [],
    routeHighlights: Array.isArray(spot.routeHighlights) ? spot.routeHighlights : []
  };
}

const getCachedXianFeaturedSpots = unstable_cache(
  async () => {
    const spots = await prisma.spot.findMany({
      select: XIAN_TOPIC_SELECT,
      where: { batch: "xian-rural-import-2026-03" },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      take: 6
    });

    return spots.map(mapDbSpot);
  },
  ["xian-topic-featured-spots"],
  { revalidate: 300 }
);

export async function getXianFeaturedSpots(): Promise<RuralSpotSeed[]> {
  if (!isDatabaseEnabled()) return [];

  try {
    return await getCachedXianFeaturedSpots();
  } catch {
    return [];
  }
}
