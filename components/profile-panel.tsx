"use client";

import { useState } from "react";
import Link from "next/link";
import type { RuralSpotSeed, SearchHistoryItem, SpotSubmissionItem, UserSummary } from "@/types";
import { CATEGORY_TAGS } from "@/lib/constants";
import { SpotSubmissionForm } from "@/components/spot-submission-form";
import { formatDateTime } from "@/lib/utils";

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回"
};

export function ProfilePanel({
  user,
  history,
  submissions,
  recommendations
}: {
  user: UserSummary;
  history: SearchHistoryItem[];
  submissions: SpotSubmissionItem[];
  recommendations: RuralSpotSeed[];
}) {
  const [form, setForm] = useState({
    nickname: user.nickname,
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || "",
    homeCity: user.homeCity || "",
    preferences: user.preferences
  });
  const [message, setMessage] = useState("");

  async function save() {
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setMessage(response.ok ? "已保存你的偏好与资料" : (data.error || "保存失败"));
  }

  function togglePreference(tag: string) {
    setForm((current) => ({
      ...current,
      preferences: current.preferences.includes(tag)
        ? current.preferences.filter((item) => item !== tag)
        : [...current.preferences, tag]
    }));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-brand-900">我的游乡记</h1>
            <p className="mt-2 text-sm text-slate-600">管理登录资料、偏好标签、搜索历史和投稿记录。</p>
          </div>
          <div className="rounded-full bg-brand-50 px-4 py-2 text-sm text-brand-700">{user.email}</div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm"><span>昵称</span><input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="w-full rounded-2xl border border-brand-100 px-4 py-3" /></label>
          <label className="space-y-2 text-sm"><span>常住城市</span><input value={form.homeCity} onChange={(e) => setForm({ ...form, homeCity: e.target.value })} className="w-full rounded-2xl border border-brand-100 px-4 py-3" /></label>
          <label className="space-y-2 text-sm md:col-span-2"><span>头像链接</span><input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} className="w-full rounded-2xl border border-brand-100 px-4 py-3" /></label>
          <label className="space-y-2 text-sm md:col-span-2"><span>个人简介</span><textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="min-h-24 w-full rounded-2xl border border-brand-100 px-4 py-3" /></label>
        </div>
        <div className="mt-5">
          <div className="text-sm font-medium text-brand-900">偏好标签</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => togglePreference(tag)} className={`rounded-full px-4 py-2 text-sm ${form.preferences.includes(tag) ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-700"}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => void save()} className="mt-5 rounded-full bg-brand-700 px-5 py-3 text-sm text-white">保存资料</button>
        {message ? <p className="mt-3 text-sm text-slate-500">{message}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-brand-900">个性化推荐</h2>
            <Link href="/planner" className="text-sm text-brand-700">继续规划</Link>
          </div>
          <div className="mt-4 space-y-3">
            {recommendations.length === 0 ? <p className="text-sm text-slate-500">完善偏好后，这里会更准确。</p> : null}
            {recommendations.map((spot) => (
              <Link key={spot.id} href={`/spots/${spot.id}`} className="block rounded-2xl bg-sand p-4 transition hover:bg-brand-50">
                <div className="text-base font-medium text-brand-900">{spot.name}</div>
                <div className="mt-1 text-sm text-slate-500">{spot.province} · {spot.city} · {spot.tags.slice(0, 3).join(" / ")}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-brand-900">最近搜索历史</h2>
          <div className="mt-4 space-y-3">
            {history.length === 0 ? <p className="text-sm text-slate-500">你还没有搜索记录。</p> : null}
            {history.map((item) => (
              <div key={item.id} className="rounded-2xl bg-sand p-4 text-sm text-slate-600">
                <div className="font-medium text-brand-900">{item.query || [item.province, item.city, item.tag].filter(Boolean).join(" / ") || "综合浏览"}</div>
                <div className="mt-1">偏好：{item.preferences.join("、") || "未记录"}</div>
                <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-brand-900">我的打卡点投稿</h2>
          <div className="mt-4 space-y-3">
            {submissions.length === 0 ? <p className="text-sm text-slate-500">还没有提交过新的景点。</p> : null}
            {submissions.map((item) => (
              <div key={item.id} className="rounded-2xl bg-sand p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-brand-900">{item.name}</div>
                  <div className={`rounded-full px-3 py-1 text-xs ${item.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : item.status === "REJECTED" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>{SUBMISSION_STATUS_LABELS[item.status] ?? item.status}</div>
                </div>
                <div className="mt-2">{item.province} · {item.city} · {item.tags.join(" / ")}</div>
                {item.reviewerNotes ? <div className="mt-2 text-xs text-slate-500">审核备注：{item.reviewerNotes}</div> : null}
              </div>
            ))}
          </div>
        </div>

        <SpotSubmissionForm />
      </section>
    </div>
  );
}
