"use client";

import { useState } from "react";
import type { SpotSubmissionItem } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回"
};

export function AdminReviewBoard({ initialItems }: { initialItems: SpotSubmissionItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    const response = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reviewerNotes: notes[id] || "" })
    });
    if (!response.ok) return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, status: decision, reviewerNotes: notes[id] || item.reviewerNotes } : item));
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? <p className="text-sm text-slate-500">没有待处理投稿。</p> : null}
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-brand-100 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-brand-900">{item.name}</div>
              <div className="mt-1 text-sm text-slate-500">{item.province} · {item.city} · 提交人 {item.user.nickname}</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              <div className="mt-2 text-xs text-slate-500">{item.tags.join(" / ")}</div>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs ${item.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : item.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{STATUS_LABELS[item.status] ?? item.status}</div>
          </div>
          <textarea value={notes[item.id] ?? item.reviewerNotes ?? ""} onChange={(e) => setNotes((current) => ({ ...current, [item.id]: e.target.value }))} placeholder="审核备注，例如：建议补充停车信息" className="mt-3 min-h-24 w-full rounded-2xl border border-brand-100 px-4 py-3 text-sm" />
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={() => void review(item.id, "APPROVED")} className="rounded-full bg-brand-700 px-4 py-2 text-sm text-white">通过并入库</button>
            <button type="button" onClick={() => void review(item.id, "REJECTED")} className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-600">驳回</button>
          </div>
        </div>
      ))}
    </div>
  );
}
