import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type RuntimeSpot = {
  id?: string;
  name: string;
  province: string;
  city: string;
  district?: string | null;
  address?: string | null;
  description: string;
  tags?: string[];
  rating?: number | null;
  crowdLevel?: number | null;
  avgCost?: number | null;
  suggestedDuration?: string | null;
  bestSeason?: string[];
  transportInfo?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  ticketBookingUrl?: string | null;
  hotelBookingUrl?: string | null;
  gaodeNavigationUrl?: string | null;
  isNationalKeyVillage?: boolean;
  batch?: string | null;
  source?: string;
  accommodationTips?: unknown;
  diningTips?: unknown;
  routeHighlights?: unknown;
};

type RuntimeState = {
  upserts?: RuntimeSpot[];
  deletedIds?: string[];
};

const prisma = new PrismaClient();
const RUNTIME_FILE = path.join(process.cwd(), "data", "demo-spots.runtime.json");

function buildUniqueKey(spot: Pick<RuntimeSpot, "name" | "province" | "city" | "district">) {
  return `${spot.name}@@${spot.province}@@${spot.city}@@${spot.district ?? ""}`;
}

function normalizeCreateInput(spot: RuntimeSpot) {
  return {
    id: spot.id,
    name: spot.name,
    province: spot.province,
    city: spot.city,
    district: spot.district ?? null,
    address: spot.address ?? null,
    description: spot.description,
    tags: Array.isArray(spot.tags) ? spot.tags : [],
    rating: spot.rating ?? null,
    crowdLevel: spot.crowdLevel ?? null,
    avgCost: spot.avgCost ?? null,
    suggestedDuration: spot.suggestedDuration ?? null,
    bestSeason: Array.isArray(spot.bestSeason) ? spot.bestSeason : [],
    transportInfo: spot.transportInfo ?? null,
    latitude: spot.latitude ?? null,
    longitude: spot.longitude ?? null,
    imageUrl: spot.imageUrl ?? null,
    ticketBookingUrl: spot.ticketBookingUrl ?? null,
    hotelBookingUrl: spot.hotelBookingUrl ?? null,
    gaodeNavigationUrl: spot.gaodeNavigationUrl ?? null,
    isNationalKeyVillage: Boolean(spot.isNationalKeyVillage),
    batch: spot.batch ?? null,
    source: spot.source ?? "runtime_sync",
    accommodationTips: spot.accommodationTips ?? null,
    diningTips: spot.diningTips ?? null,
    routeHighlights: spot.routeHighlights ?? null
  };
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  const raw = fs.readFileSync(RUNTIME_FILE, "utf8");
  const state = JSON.parse(raw) as RuntimeState;
  const runtimeSpots = Array.isArray(state.upserts) ? state.upserts.filter((spot) => spot?.name && spot?.province && spot?.city) : [];

  const existingSpots = await prisma.spot.findMany({
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      district: true
    }
  });

  const existingByUniqueKey = new Map(existingSpots.map((spot) => [buildUniqueKey(spot), spot.id]));
  const createRows: ReturnType<typeof normalizeCreateInput>[] = [];
  const updateRows: Array<{ id: string; data: Omit<ReturnType<typeof normalizeCreateInput>, "id" | "name" | "province" | "city" | "district"> & { name?: string; province?: string; city?: string; district?: string | null } }> = [];

  for (const spot of runtimeSpots) {
    const key = buildUniqueKey(spot);
    const existingId = existingByUniqueKey.get(key);
    const normalized = normalizeCreateInput(spot);

    if (existingId) {
      updateRows.push({
        id: existingId,
        data: {
          address: normalized.address,
          description: normalized.description,
          tags: normalized.tags,
          rating: normalized.rating,
          crowdLevel: normalized.crowdLevel,
          avgCost: normalized.avgCost,
          suggestedDuration: normalized.suggestedDuration,
          bestSeason: normalized.bestSeason,
          transportInfo: normalized.transportInfo,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          imageUrl: normalized.imageUrl,
          ticketBookingUrl: normalized.ticketBookingUrl,
          hotelBookingUrl: normalized.hotelBookingUrl,
          gaodeNavigationUrl: normalized.gaodeNavigationUrl,
          isNationalKeyVillage: normalized.isNationalKeyVillage,
          batch: normalized.batch,
          source: normalized.source,
          accommodationTips: normalized.accommodationTips,
          diningTips: normalized.diningTips,
          routeHighlights: normalized.routeHighlights
        }
      });
      continue;
    }

    createRows.push(normalized);
  }

  let created = 0;
  let updated = 0;

  for (const chunk of chunkItems(createRows, 500)) {
    const result = await prisma.spot.createMany({
      data: chunk as any,
      skipDuplicates: true
    });
    created += result.count;
  }

  for (const row of updateRows) {
    await prisma.spot.update({
      where: { id: row.id },
      data: row.data as any
    });
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        runtimeSpotCount: runtimeSpots.length,
        createCount: createRows.length,
        updateCount: updateRows.length,
        created,
        updated
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
