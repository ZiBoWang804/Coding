import overrides from "@/data/spot-image-overrides.json";
import { isLikelyImageUrl, isRemoteHttpUrl } from "@/lib/utils";
import type { RuralSpotSeed } from "@/types";

export type SpotImageOverride = {
  key: string;
  name: string;
  province?: string | null;
  city?: string | null;
  imageUrl?: string;
  source: string;
  sourceUrl?: string | null;
  confidence?: "high" | "medium" | "low";
};

const overrideList = overrides as SpotImageOverride[];
const overrideMap = new Map(overrideList.map((item) => [item.key, item]));

export function buildSpotImageKey(input: Pick<RuralSpotSeed, "name" | "province" | "city">) {
  return [input.province || "", input.city || "", input.name || ""]
    .map((item) => item.trim().toLowerCase())
    .join("|");
}

export function getSpotImageOverride(spot?: Pick<RuralSpotSeed, "name" | "province" | "city"> | null) {
  if (!spot) return null;
  return overrideMap.get(buildSpotImageKey(spot)) ?? null;
}

function resolveOverrideImage(override?: SpotImageOverride | null) {
  if (!override) return "";
  if (override.sourceUrl && isLikelyImageUrl(override.sourceUrl)) return override.sourceUrl;
  if (override.imageUrl && isLikelyImageUrl(override.imageUrl)) return override.imageUrl;
  return "";
}

export function resolveSpotImage(spot?: RuralSpotSeed | null, fallbackImage = "") {
  if (!spot) return fallbackImage;

  const overrideImage = resolveOverrideImage(getSpotImageOverride(spot));
  if (overrideImage) return overrideImage;

  if (spot.imageUrl && isLikelyImageUrl(spot.imageUrl)) return spot.imageUrl;
  if (spot.photoUrls?.[0] && isLikelyImageUrl(spot.photoUrls[0])) return spot.photoUrls[0];
  return fallbackImage;
}

export function isStableSpotImage(spot?: RuralSpotSeed | null, fallbackImage = "") {
  if (!spot) return false;

  const overrideImage = resolveOverrideImage(getSpotImageOverride(spot));
  if (overrideImage) return true;

  const image = resolveSpotImage(spot, fallbackImage);
  if (!image || image === fallbackImage) return false;
  if (image.startsWith("/spot-assets/xian/")) return true;
  if (image.startsWith("/media/curated-spots/")) return true;
  if (image.includes("dimg04.c-ctrip.com")) return true;
  if (image.includes("images.unsplash.com")) return false;
  if (image.includes("sxhm.com")) return false;
  return !isRemoteHttpUrl(image) || image.startsWith("/");
}
