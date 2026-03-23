import Link from "next/link";
import { CommunityBoard } from "@/components/community-board";
import { CheckInPanel } from "@/components/checkin-panel";
import { MapClient } from "@/components/map-client";
import { StatusActions } from "@/components/status-actions";
import { TagBadge } from "@/components/tag-badge";
import { getCurrentUser } from "@/lib/auth";
import { getSpotDetailData } from "@/lib/repository";
import { formatCrowdLevel, formatCurrency } from "@/lib/utils";

export default async function SpotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const data = await getSpotDetailData(id, user?.id);

  if (!data) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">未找到该目的地。</div>;
  }

  const { spot, state, posts, checkIns } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] bg-white p-6 shadow-card md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">{spot.province} · {spot.city}{spot.district ? ` · ${spot.district}` : ""}</div>
            <h1 className="mt-2 text-3xl font-semibold text-brand-900">{spot.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{spot.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={spot.ticketBookingUrl || "#"} target="_blank" className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700">门票入口</Link>
            <Link href={spot.hotelBookingUrl || "#"} target="_blank" className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700">酒店入口</Link>
            <Link href={spot.gaodeNavigationUrl || "#"} target="_blank" className="rounded-full bg-brand-700 px-5 py-3 text-sm text-white">高德导航</Link>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">{spot.tags.map((tag) => <TagBadge key={tag}>{tag}</TagBadge>)}</div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-sand p-4 text-sm">评分：{spot.rating ?? "待补充"}</div>
          <div className="rounded-2xl bg-sand p-4 text-sm">人流：{formatCrowdLevel(spot.crowdLevel)}</div>
          <div className="rounded-2xl bg-sand p-4 text-sm">价格：{formatCurrency(spot.avgCost)}</div>
          <div className="rounded-2xl bg-sand p-4 text-sm">建议时长：{spot.suggestedDuration ?? "1 天"}</div>
          <div className="rounded-2xl bg-sand p-4 text-sm">最佳季节：{spot.bestSeason.join("、") || "待补充"}</div>
          <div className="rounded-2xl bg-sand p-4 text-sm">地址：{spot.address || "待补充"}</div>
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[0.78fr,1.22fr]">
          <div className="space-y-6">
            <div>
              <div className="text-sm font-medium text-brand-800">出行状态</div>
              <div className="mt-3"><StatusActions spotId={spot.id || id} initialState={state} loggedIn={Boolean(user)} /></div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-brand-900">交通方式</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{spot.transportInfo || "待补充"}</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-brand-900">周边住宿推荐</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{(spot.accommodationTips || []).map((item) => <li key={item.name}>{item.name}</li>)}</ul>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-brand-900">周边餐饮推荐</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{(spot.diningTips || []).map((item) => <li key={item.name}>{item.name}</li>)}</ul>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-brand-900">打卡路线亮点</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{(spot.routeHighlights || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-brand-900">地图定位</h2>
            <div className="mt-3"><MapClient spots={[spot]} /></div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.88fr,1.12fr]">
        <CheckInPanel spotId={spot.id || id} initialItems={checkIns} loggedIn={Boolean(user)} />
        <CommunityBoard spotId={spot.id || id} initialPosts={posts} loggedIn={Boolean(user)} />
      </div>
    </div>
  );
}