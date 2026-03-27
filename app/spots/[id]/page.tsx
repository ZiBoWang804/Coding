import Link from "next/link";
import { CheckInPanel } from "@/components/checkin-panel";
import { CommunityBoard } from "@/components/community-board";
import { SpotDetailMap } from "@/components/spot-detail-map";
import { StatusActions } from "@/components/status-actions";
import { TagBadge } from "@/components/tag-badge";
import { TransitAssistant } from "@/components/transit-assistant";
import { TravelServicePanel } from "@/components/travel-service-panel";
import { getCurrentUser } from "@/lib/auth";
import { getSpotDetailData } from "@/lib/repository";
import { getSpotTravelResources } from "@/lib/travel-resources";
import { buildAmapNavigationUrl, formatCrowdLevel, formatCurrency } from "@/lib/utils";

function getGalleryImages(imageUrl?: string | null, photoUrls?: string[] | null) {
  return [...new Set([imageUrl, ...(photoUrls || [])].filter((item): item is string => Boolean(item?.trim())))]
    .slice(0, 4);
}

function getLinkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function SpotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const data = await getSpotDetailData(id, user?.id);

  if (!data) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">未找到该景点。</div>;
  }

  const { spot, state, posts, checkIns } = data;
  const travelResources = getSpotTravelResources(spot);
  const galleryImages = getGalleryImages(spot.imageUrl, spot.photoUrls);
  const officialEntry =
    travelResources.ticket.type === "official_site" || travelResources.ticket.type === "official_ticket"
      ? {
          label: travelResources.ticket.label,
          url: travelResources.ticket.url,
          note: travelResources.ticket.note
        }
      : spot.sourceUrl
        ? {
            label: "景点权威来源",
            url: spot.sourceUrl,
            note: "当前未接入单独官网时，先提供景点权威介绍页作为入口。"
          }
        : null;
  const officialHost = officialEntry ? getLinkHost(officialEntry.url) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] bg-white p-6 shadow-card md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">
              {spot.province} / {spot.city}
              {spot.district ? ` / ${spot.district}` : ""}
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-brand-900">{spot.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{spot.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={travelResources.ticket.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700"
            >
              {travelResources.ticket.label}
            </Link>
            <Link
              href={travelResources.hotelEntryUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700"
            >
              {travelResources.hotelEntryLabel}
            </Link>
            <Link
              href={spot.gaodeNavigationUrl || buildAmapNavigationUrl(spot.name, spot.city, spot.address)}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-brand-700 px-5 py-3 text-sm text-white"
            >
              高德导航
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {spot.tags.map((tag) => (
            <TagBadge key={tag}>{tag}</TagBadge>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-sand p-4 text-sm">评分：{spot.rating ?? "待补充"}</div>
          <div className="rounded-2xl bg-sand p-4 text-sm">人流：{formatCrowdLevel(spot.crowdLevel)}</div>
          <div className="rounded-2xl bg-sand p-4 text-sm">费用：{formatCurrency(spot.avgCost)}</div>
          <div className="rounded-2xl bg-sand p-4 text-sm">建议时长：{spot.suggestedDuration ?? "1 天"}</div>
          <div className="rounded-2xl bg-sand p-4 text-sm">
            推荐季节：{spot.bestSeason.length > 0 ? spot.bestSeason.join(" / ") : "待补充"}
          </div>
          <div className="rounded-2xl bg-sand p-4 text-sm">地址：{spot.address || "待补充"}</div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.78fr,1.22fr]">
          <div className="space-y-6">
            <div>
              <div className="text-sm font-medium text-brand-800">出行状态</div>
              <div className="mt-3">
                <StatusActions spotId={spot.id || id} initialState={state} loggedIn={Boolean(user)} />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-brand-900">交通方式</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{spot.transportInfo || "待补充"}</p>
              <TransitAssistant
                className="mt-4"
                defaultOrigin="西安市区"
                target={{
                  name: spot.name,
                  city: spot.city,
                  district: spot.district,
                  address: spot.address,
                  latitude: spot.latitude,
                  longitude: spot.longitude,
                  publicTransitFriendlyScore: spot.publicTransitFriendlyScore,
                  lastMileDifficulty: spot.lastMileDifficulty,
                  nearestRailStation: spot.nearestRailStation
                }}
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-brand-900">周边住宿推荐</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {(spot.accommodationTips || []).map((item) => {
                  const label = typeof item === "string" ? item : item.name;
                  return <li key={label}>{label}</li>;
                })}
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-brand-900">周边餐饮推荐</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {(spot.diningTips || []).map((item) => {
                  const label = typeof item === "string" ? item : item.name;
                  return <li key={label}>{label}</li>;
                })}
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-brand-900">玩法亮点</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {(spot.routeHighlights || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-brand-100 bg-[#f8faf6] p-5">
              <div>
                <h2 className="text-lg font-semibold text-brand-900">景点官网入口</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  原地图区域改为官网入口和照片，方便先看权威信息，再继续查看定位与导航。
                </p>
                {officialEntry ? (
                  <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-brand-800">{officialEntry.label}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                          {officialHost}
                        </div>
                      </div>
                      <Link
                        href={officialEntry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-brand-700 px-4 py-2 text-sm text-white"
                      >
                        打开入口
                      </Link>
                    </div>
                    <Link
                      href={officialEntry.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 block break-all text-sm leading-7 text-brand-700 underline-offset-4 hover:underline"
                    >
                      {officialEntry.url}
                    </Link>
                    <p className="mt-3 text-sm leading-7 text-slate-500">{officialEntry.note}</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-brand-200 bg-white p-5 text-sm leading-7 text-slate-500">
                    当前景点还没有可直接打开的官网或权威来源链接，后续补链后会优先展示在这里。
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-brand-900">景点照片</h2>
                  <span className="text-sm text-slate-500">
                    {galleryImages.length > 0 ? `${galleryImages.length} 张精选图` : "暂无图片"}
                  </span>
                </div>
                {galleryImages.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {galleryImages.map((imageUrl, index) => (
                      <div key={`${imageUrl}-${index}`} className={index === 0 ? "sm:col-span-2" : ""}>
                        <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm">
                          <img
                            src={imageUrl}
                            alt={`${spot.name} 照片 ${index + 1}`}
                            className={index === 0 ? "h-72 w-full object-cover" : "h-44 w-full object-cover"}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-3xl border border-dashed border-brand-200 bg-white p-5 text-sm leading-7 text-slate-500">
                    当前景点还没有可展示的照片，后续补图后会优先显示在这里。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-brand-100 bg-white p-5">
              <h2 className="text-lg font-semibold text-brand-900">地图定位</h2>
              <div className="mt-3">
                <SpotDetailMap spot={spot} />
              </div>
            </div>
          </div>
        </div>

        <TravelServicePanel className="mt-6" spot={spot} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.88fr,1.12fr]">
        <CheckInPanel spotId={spot.id || id} initialItems={checkIns} loggedIn={Boolean(user)} />
        <CommunityBoard spotId={spot.id || id} initialPosts={posts} loggedIn={Boolean(user)} />
      </div>
    </div>
  );
}
