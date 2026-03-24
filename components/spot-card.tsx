import Image from "next/image";
import Link from "next/link";
import { TagBadge } from "@/components/tag-badge";
import { getSpotHotelSummary } from "@/lib/travel-resources";
import { formatCrowdLevel, formatCurrency, isLikelyImageUrl, isRemoteHttpUrl } from "@/lib/utils";
import type { RuralSpotSeed } from "@/types";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";

function resolveImageSrc(spot: RuralSpotSeed) {
  if (spot.imageUrl && isLikelyImageUrl(spot.imageUrl)) return spot.imageUrl;
  if (spot.photoUrls?.[0] && isLikelyImageUrl(spot.photoUrls[0])) return spot.photoUrls[0];
  return FALLBACK_IMAGE;
}

export function SpotCard({ spot }: { spot: RuralSpotSeed }) {
  const imageSrc = resolveImageSrc(spot);
  const hotelSummary = getSpotHotelSummary(spot);
  const location = [spot.city, spot.district].filter(Boolean).join(" / ");
  const isRemoteImage = isRemoteHttpUrl(imageSrc);

  return (
    <Link
      href={`/spots/${spot.id}`}
      className="group soft-card overflow-hidden rounded-[2rem] transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_80px_rgba(22,42,34,0.12)]"
    >
      <div className="relative h-64 overflow-hidden">
        <Image
          src={imageSrc}
          alt={spot.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          unoptimized={isRemoteImage}
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/12 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-full border border-white/16 bg-black/26 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
            {spot.province}
          </span>
          <span className="rounded-full bg-white/92 px-3 py-1 text-[11px] font-medium text-brand-950">
            {spot.isNationalKeyVillage ? "重点乡村" : "周末目的地"}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="font-display text-[1.7rem] font-semibold leading-tight">{spot.name}</div>
          <div className="mt-1 text-sm text-white/80">{location || spot.province}</div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {spot.tags.slice(0, 4).map((tag) => (
            <TagBadge key={tag}>{tag}</TagBadge>
          ))}
        </div>

        <p className="line-clamp-2 text-sm leading-7 text-slate-600">{spot.description}</p>

        <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
          <div className="rounded-[1.35rem] bg-[#f5efe3] px-3 py-3">评分：{spot.rating ?? "待补充"}</div>
          <div className="rounded-[1.35rem] bg-[#f5efe3] px-3 py-3">人流：{formatCrowdLevel(spot.crowdLevel)}</div>
          <div className="rounded-[1.35rem] bg-[#f5efe3] px-3 py-3">{formatCurrency(spot.avgCost)}</div>
          <div className="rounded-[1.35rem] bg-[#f5efe3] px-3 py-3">{spot.suggestedDuration ?? "建议 1 天"}</div>
        </div>

        <div className="rounded-[1.35rem] bg-brand-50/70 px-4 py-3">
          <div className="text-[11px] font-medium tracking-[0.2em] text-brand-700">住宿参考</div>
          <div className="mt-2 line-clamp-1 text-sm font-medium text-brand-900">{hotelSummary.title}</div>
          <div className="mt-1 text-xs text-slate-500">{hotelSummary.priceText}</div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>适合 {spot.tags.slice(0, 2).join(" / ") || "周末短途"}</span>
          <span className="font-medium text-brand-700">查看详情</span>
        </div>
      </div>
    </Link>
  );
}
