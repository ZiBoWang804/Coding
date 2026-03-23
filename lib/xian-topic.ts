import { prisma } from "@/lib/prisma";
import { isDatabaseEnabled } from "@/lib/database-mode";
import type { RuralSpotSeed } from "@/types";

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

export async function getXianFeaturedSpots(): Promise<RuralSpotSeed[]> {
  if (!isDatabaseEnabled()) return [];
  try {
    const spots = await prisma.spot.findMany({
      where: { batch: "xian-rural-import-2026-03" },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      take: 6
    });
    return spots.map(mapDbSpot);
  } catch {
    return [];
  }
}


