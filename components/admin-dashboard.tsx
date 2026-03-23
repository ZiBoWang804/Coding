"use client";

import { useState } from "react";
import type { RuralSpotSeed, SpotSubmissionItem } from "@/types";
import { AdminReviewBoard } from "@/components/admin-review-board";

type AdminOverview = {
  spotCount: number;
  userCount: number;
  postCount: number;
  checkInCount: number;
  pendingCount: number;
};

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

export function AdminDashboard({ initialSpots, overview, submissions }: { initialSpots: RuralSpotSeed[]; overview: AdminOverview; submissions: SpotSubmissionItem[] }) {
  const [spots, setSpots] = useState(initialSpots);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  async function createSpot() {
    const response = await fetch("/api/spots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(/[|,，、]/).map((item) => item.trim()).filter(Boolean),
        avgCost: form.avgCost ? Number(form.avgCost) : null,
        rating: form.rating ? Number(form.rating) : null,
        crowdLevel: form.crowdLevel ? Number(form.crowdLevel) : null,
        source: "admin_import",
        bestSeason: ["春", "秋"]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "新增失败");
      return;
    }
    setMessage("新增成功");
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-brand-900">新增景点</h2>
          <div className="mt-5 grid gap-3">
            {[
              ["name", "名称"],
              ["province", "省份"],
              ["city", "城市"],
              ["district", "区县"],
              ["description", "简介"],
              ["tags", "标签 使用 | 分隔"],
              ["avgCost", "人均消费"],
              ["rating", "评分"],
              ["crowdLevel", "人流量等级 1-5"],
              ["ticketBookingUrl", "门票查询入口"],
              ["hotelBookingUrl", "酒店查询入口"],
              ["gaodeNavigationUrl", "高德导航入口"]
            ].map(([key, label]) => (
              <label key={key} className="space-y-2 text-sm">
                <span>{label}</span>
                <input className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => void createSpot()} className="mt-5 rounded-full bg-brand-700 px-5 py-3 text-sm text-white">保存景点</button>
          {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        </div>

        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-brand-900">景点列表</h2>
          <div className="mt-4 max-h-[720px] space-y-3 overflow-auto pr-1">
            {spots.map((spot) => (
              <div key={spot.id} className="flex items-center justify-between gap-4 rounded-2xl border border-brand-100 p-4">
                <div>
                  <div className="font-medium text-brand-900">{spot.name}</div>
                  <div className="text-sm text-slate-500">{spot.province} · {spot.city} · 评分 {spot.rating ?? "-"} · ￥{spot.avgCost ?? "-"}</div>
                  <div className="mt-1 text-xs text-slate-500">{spot.tags.join(" / ")}</div>
                </div>
                <button type="button" onClick={() => void removeSpot(spot.id!)} className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-600">删除</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-brand-900">用户投稿审核</h2>
            <p className="mt-1 text-sm text-slate-500">审核通过后自动写入景点库，可用于打卡点共创。</p>
          </div>
        </div>
        <AdminReviewBoard initialItems={submissions} />
      </section>
    </div>
  );
}