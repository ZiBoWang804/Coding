import Image from "next/image";
import Link from "next/link";
import type { RuralSpotSeed } from "@/types";
import { formatCrowdLevel, formatCurrency, isLikelyImageUrl } from "@/lib/utils";
import { TagBadge } from "@/components/tag-badge";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";

function resolveImageSrc(url?: string | null) {
  if (!url) return FALLBACK_IMAGE;
  return isLikelyImageUrl(url) ? url : FALLBACK_IMAGE;
}

export function SpotCard({ spot }: { spot: RuralSpotSeed }) {
  const imageSrc = resolveImageSrc(spot.imageUrl);

  return (
    <Link href={`/spots/${spot.id}`} className="group overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-card transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl">
      <div className="relative h-52 overflow-hidden">
        <Image src={imageSrc} alt={spot.name} fill className="object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 text-white">
          <div className="text-lg font-semibold">{spot.name}</div>
          <div className="text-sm opacity-90">{spot.province} · {spot.city}</div>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {spot.tags.slice(0, 4).map((tag) => <TagBadge key={tag}>{tag}</TagBadge>)}
        </div>
        <p className="line-clamp-2 text-sm text-slate-600">{spot.description}</p>
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
          <div>评分：{spot.rating ?? "待补充"}</div>
          <div>人流：{formatCrowdLevel(spot.crowdLevel)}</div>
          <div>{formatCurrency(spot.avgCost)}</div>
          <div>{spot.suggestedDuration ?? "建议 1 天"}</div>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>适合 {spot.tags.slice(0, 2).join(" / ") || "周末短途"}</span>
          <span className="text-brand-700">进入详情</span>
        </div>
      </div>
    </Link>
  );
}