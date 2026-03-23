"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CheckInItem } from "@/types";
import { formatDateTime } from "@/lib/utils";

export function CheckInPanel({ spotId, initialItems, loggedIn }: { spotId: string; initialItems: CheckInItem[]; loggedIn: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [content, setContent] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    if (!loggedIn) {
      router.push(`/login?redirect=/spots/${spotId}`);
      return;
    }

    const response = await fetch(`/api/spots/${spotId}/checkins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, visitDate: visitDate || undefined })
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "打卡失败");
      return;
    }

    setItems((current) => [data.item, ...current]);
    setContent("");
    setVisitDate("");
    setMessage("打卡成功，已同步到你的个人记录");
    router.refresh();
  }

  return (
    <section className="rounded-[1.8rem] border border-brand-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-brand-900">景点打卡</h3>
          <p className="mt-1 text-sm text-slate-500">发布你的到访记录，为后续个性化推荐积累偏好。</p>
        </div>
        <div className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">{items.length} 条记录</div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr,180px,120px]">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="这一站最值得推荐什么？" className="min-h-24 rounded-2xl border border-brand-100 px-4 py-3 text-sm" />
        <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="rounded-2xl border border-brand-100 px-4 py-3 text-sm" />
        <button type="button" onClick={() => void submit()} className="rounded-2xl bg-brand-700 px-4 py-3 text-sm text-white">提交打卡</button>
      </div>
      {message ? <p className="mt-3 text-sm text-slate-500">{message}</p> : null}
      <div className="mt-5 space-y-3">
        {items.length === 0 ? <p className="text-sm text-slate-500">还没有人打卡，成为第一个留下记录的人。</p> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl bg-sand p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="font-medium text-brand-900">{item.author.nickname}</div>
              <div className="text-slate-500">{formatDateTime(item.visitDate || item.createdAt)}</div>
            </div>
            {item.content ? <p className="mt-2 text-sm leading-7 text-slate-600">{item.content}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}