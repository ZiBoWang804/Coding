"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { AdminBrowseTrendPoint, AdminHeatmapSpot } from "@/lib/repository";
import type { RuralSpotSeed, SpotSubmissionItem } from "@/types";
import { AdminReviewBoard } from "@/components/admin-review-board";

type AdminOverview = {
  spotCount: number;
  userCount: number;
  postCount: number;
  checkInCount: number;
  pendingCount: number;
};

const AdminSpotHeatmap = dynamic(
  () => import("@/components/admin-spot-heatmap").then((mod) => mod.AdminSpotHeatmap),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[1.8rem] border border-dashed border-brand-200 bg-white p-6 text-sm text-slate-500">
        热力图加载中...
      </div>
    )
  }
);

const emptyForm = {
  name: "",
  province: "",
  city: "",
  district: "",
  description: "",
  tags: "",
  avgCost: "",
  rating: "",
  crowdLevel: "",
  ticketBookingUrl: "",
  hotelBookingUrl: "",
  gaodeNavigationUrl: ""
};

function BrowseTrendChart({ points }: { points: AdminBrowseTrendPoint[] }) {
  const width = 680;
  const height = 220;
  const paddingX = 20;
  const paddingY = 22;
  const maxValue = Math.max(...points.map((point) => point.visitorCount), 1);
  const stepX = points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => {
    const x = paddingX + stepX * index;
    const y = height - paddingY - (point.visitorCount / maxValue) * (height - paddingY * 2);
    return { ...point, x, y };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const areaPath = linePath
    ? `${linePath} L ${paddingX + stepX * (coordinates.length - 1)} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`
    : "";
  const latest = points[points.length - 1];
  const weeklyVisitors = points.reduce((sum, point) => sum + point.visitorCount, 0);
  const weeklyBrowses = points.reduce((sum, point) => sum + point.browseCount, 0);

  return (
    <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-[0.22em] text-brand-600">浏览趋势</div>
          <h2 className="mt-2 text-xl font-semibold text-brand-900">近 7 天浏览人数折线图</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">按每天产生浏览行为的去重用户数统计，同时展示每日浏览总次数。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.4rem] bg-brand-50 px-4 py-3">
            <div className="text-xs text-slate-500">今日浏览人数</div>
            <div className="mt-1 text-2xl font-semibold text-brand-900">{latest?.visitorCount ?? 0}</div>
          </div>
          <div className="rounded-[1.4rem] bg-[#f5efe3] px-4 py-3">
            <div className="text-xs text-slate-500">7 天累计浏览</div>
            <div className="mt-1 text-2xl font-semibold text-brand-900">{weeklyBrowses}</div>
          </div>
        </div>
      </div>

      {points.every((point) => point.visitorCount === 0 && point.browseCount === 0) ? (
        <div className="mt-6 rounded-[1.7rem] border border-dashed border-brand-200 bg-brand-50/40 p-6 text-sm text-slate-500">
          暂时还没有足够的浏览数据，后续有用户搜索和浏览后，这里会自动生成趋势曲线。
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-brand-100 bg-[linear-gradient(180deg,#fcfaf6,#f4efe5)] p-4">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-[240px] w-full">
              <defs>
                <linearGradient id="browseAreaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(35,91,71,0.34)" />
                  <stop offset="100%" stopColor="rgba(35,91,71,0.02)" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const y = height - paddingY - tick * (height - paddingY * 2);
                const value = Math.round(maxValue * tick);
                return (
                  <g key={tick}>
                    <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="rgba(25,50,40,0.08)" strokeDasharray="4 6" />
                    <text x={4} y={y + 4} fontSize="11" fill="rgba(72,93,82,0.65)">
                      {value}
                    </text>
                  </g>
                );
              })}

              {areaPath ? <path d={areaPath} fill="url(#browseAreaGradient)" /> : null}
              {linePath ? (
                <path d={linePath} fill="none" stroke="#224f3d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}

              {coordinates.map((point) => (
                <g key={point.dateKey}>
                  <circle cx={point.x} cy={point.y} r="5" fill="#224f3d" />
                  <circle cx={point.x} cy={point.y} r="10" fill="rgba(34,79,61,0.12)" />
                  <text x={point.x} y={height - 4} textAnchor="middle" fontSize="11" fill="rgba(72,93,82,0.72)">
                    {point.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {points.map((point) => (
              <div key={point.dateKey} className="rounded-[1.4rem] border border-brand-100 bg-white px-4 py-3">
                <div className="text-xs text-slate-400">{point.label}</div>
                <div className="mt-2 text-lg font-semibold text-brand-900">{point.visitorCount} 人</div>
                <div className="text-xs text-slate-500">浏览次数 {point.browseCount}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-400">近 7 天去重浏览人数合计 {weeklyVisitors}，浏览总次数 {weeklyBrowses}。</div>
        </>
      )}
    </div>
  );
}

export function AdminDashboard({
  initialSpots,
  overview,
  submissions,
  browseTrend,
  heatmapSpots
}: {
  initialSpots: RuralSpotSeed[];
  overview: AdminOverview;
  submissions: SpotSubmissionItem[];
  browseTrend: AdminBrowseTrendPoint[];
  heatmapSpots: AdminHeatmapSpot[];
}) {
  const [spots, setSpots] = useState(initialSpots);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  async function createSpot() {
    const response = await fetch("/api/spots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tags: form.tags
          .split(/[|,，、/]/)
          .map((item) => item.trim())
          .filter(Boolean),
        avgCost: form.avgCost ? Number(form.avgCost) : null,
        rating: form.rating ? Number(form.rating) : null,
        crowdLevel: form.crowdLevel ? Number(form.crowdLevel) : null,
        source: "admin_import",
        bestSeason: ["spring", "autumn"]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "新增失败");
      return;
    }

    setMessage("景点已新增");
    setForm(emptyForm);
    setSpots((current) => [data, ...current]);
  }

  async function removeSpot(id: string) {
    const response = await fetch(`/api/spots/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || "删除失败");
      return;
    }

    setMessage("景点已删除");
    setSpots((current) => current.filter((spot) => spot.id !== id));
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-5">
        {[
          ["景点总数", overview.spotCount],
          ["注册用户", overview.userCount],
          ["社区帖子", overview.postCount],
          ["打卡记录", overview.checkInCount],
          ["待审投稿", overview.pendingCount]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[1.6rem] border border-brand-100 bg-white p-5 shadow-card">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-3xl font-semibold text-brand-900">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <BrowseTrendChart points={browseTrend} />

        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-[0.22em] text-brand-600">景点热力</div>
              <h2 className="mt-2 text-xl font-semibold text-brand-900">景点热力图</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                基于收藏、打卡、帖子和评分综合计算热度，颜色越暖、圆点越大代表该景点当前越热。
              </p>
            </div>
            <div className="rounded-[1.4rem] bg-brand-50 px-4 py-3 text-sm text-brand-900">
              已分析 {heatmapSpots.length} 个带坐标景点
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.8rem] border border-brand-100">
            <AdminSpotHeatmap spots={heatmapSpots} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {heatmapSpots.slice(0, 6).map((spot, index) => (
              <div key={spot.id} className="rounded-[1.5rem] border border-brand-100 bg-[#fcfaf6] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400">热度排名 #{index + 1}</div>
                    <div className="mt-1 text-base font-semibold text-brand-900">{spot.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{[spot.city, spot.district].filter(Boolean).join(" / ") || spot.province}</div>
                  </div>
                  <div className="rounded-full bg-brand-900 px-3 py-1 text-xs font-medium text-white">{spot.heatScore}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-white px-3 py-1">收藏/状态 {spot.actionCount}</span>
                  <span className="rounded-full bg-white px-3 py-1">打卡 {spot.checkInCount}</span>
                  <span className="rounded-full bg-white px-3 py-1">帖子 {spot.postCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-brand-900">新增景点</h2>
          <div className="mt-5 grid gap-3">
            {[
              ["name", "景点名称"],
              ["province", "省份"],
              ["city", "城市"],
              ["district", "区县"],
              ["description", "简介"],
              ["tags", "标签，使用 | 或 ， 分隔"],
              ["avgCost", "人均消费"],
              ["rating", "评分"],
              ["crowdLevel", "人流等级 1-5"],
              ["ticketBookingUrl", "门票入口链接"],
              ["hotelBookingUrl", "酒店入口链接"],
              ["gaodeNavigationUrl", "高德导航链接"]
            ].map(([key, label]) => (
              <label key={key} className="space-y-2 text-sm">
                <span>{label}</span>
                <input
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={(form as Record<string, string>)[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => void createSpot()} className="mt-5 rounded-full bg-brand-700 px-5 py-3 text-sm text-white">
            保存景点
          </button>
          {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        </div>

        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-brand-900">最近景点</h2>
          <div className="mt-4 max-h-[720px] space-y-3 overflow-auto pr-1">
            {spots.map((spot) => (
              <div key={spot.id} className="flex items-center justify-between gap-4 rounded-2xl border border-brand-100 p-4">
                <div>
                  <div className="font-medium text-brand-900">{spot.name}</div>
                  <div className="text-sm text-slate-500">
                    {[spot.province, spot.city, spot.district].filter(Boolean).join(" / ")} / 评分 {spot.rating ?? "-"} / 人均{" "}
                    {spot.avgCost ?? "-"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{spot.tags.join(" / ")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeSpot(spot.id!)}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-600"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-brand-900">用户投稿审核</h2>
            <p className="mt-1 text-sm text-slate-500">审核通过后会自动写入景点库，适合处理用户共创和补充资料。</p>
          </div>
        </div>
        <AdminReviewBoard initialItems={submissions} />
      </section>
    </div>
  );
}
