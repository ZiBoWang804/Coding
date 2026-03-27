import Link from "next/link";
import { cn } from "@/lib/utils";
import { getSpotTravelResources, type TravelResourceSpotLike } from "@/lib/travel-resources";

export function TravelServicePanel({
  spot,
  className,
  compact = false
}: {
  spot: TravelResourceSpotLike;
  className?: string;
  compact?: boolean;
}) {
  const resources = getSpotTravelResources(spot);

  return (
    <section className={cn("rounded-2xl border border-brand-100 bg-white/90 p-4 md:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-brand-900">{"\u666f\u70b9\u9644\u8fd1\u9152\u5e97"}</div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] text-brand-700">{"\u65b0\u589e\u529f\u80fd"}</span>
          </div>
          <div className="mt-1 text-sm text-slate-500">{resources.lodgingReferenceText}</div>
        </div>
        <Link
          href={resources.hotelEntryUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-brand-200 px-4 py-2 text-sm text-brand-700"
        >
          {resources.hotelEntryLabel}
        </Link>
      </div>

      <div className="mt-4 rounded-2xl bg-brand-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-brand-800">{"\u95e8\u7968\u4e0e\u666f\u70b9\u4fe1\u606f"}</div>
            <div className="mt-1 text-sm leading-7 text-slate-600">{resources.ticket.note}</div>
          </div>
          <Link
            href={resources.ticket.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full bg-brand-700 px-4 py-2 text-sm text-white"
          >
            {resources.ticket.label}
          </Link>
        </div>
      </div>

      <div
        className={cn(
          "mt-4 grid gap-3",
          compact ? "grid-cols-[repeat(auto-fit,minmax(220px,1fr))]" : "grid-cols-[repeat(auto-fit,minmax(240px,1fr))]"
        )}
      >
        {resources.hotels.map((hotel) => (
          <article
            key={`${spot.name}-${hotel.platform}-${hotel.name}`}
            className="flex h-full min-h-[220px] flex-col rounded-2xl bg-sand p-4"
          >
            <div className="text-xs tracking-wide text-slate-500">
              {hotel.platform === "official"
                ? "\u5b98\u65b9\u76f4\u8fbe"
                : hotel.platform === "huazhu"
                  ? "\u534e\u4f4f\u4f1a"
                  : "\u5e73\u53f0\u67e5\u8be2"}
            </div>
            <div className="mt-2 text-base font-semibold leading-7 text-brand-900">{hotel.name}</div>
            <div className="mt-2 line-clamp-4 text-sm leading-7 text-slate-600">{hotel.description}</div>
            <div className="mt-3 text-sm font-medium text-brand-800">{hotel.priceText}</div>
            <div className="mt-1 line-clamp-3 text-xs leading-6 text-slate-500">{hotel.note}</div>
            <Link
              href={hotel.bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-auto inline-flex rounded-full border border-brand-200 px-4 py-2 text-sm text-brand-700"
            >
              {hotel.actionLabel}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
