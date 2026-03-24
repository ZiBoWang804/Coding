"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/utils";
import type { SpotSubmissionItem } from "@/types";

const STATUS_LABELS: Record<SpotSubmissionItem["status"], string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回"
};

export function AdminReviewBoard({
  items,
  onChange
}: {
  items: SpotSubmissionItem[];
  onChange?: (items: SpotSubmissionItem[]) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const orderedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        if (left.status === right.status) {
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }
        if (left.status === "PENDING") return -1;
        if (right.status === "PENDING") return 1;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }),
    [items]
  );

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    try {
      const response = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reviewerNotes: notes[id] || ""
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "审核失败");
        return;
      }

      const nextItems = items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: decision,
              reviewerNotes: notes[id] || item.reviewerNotes
            }
          : item
      );

      onChange?.(nextItems);
      setMessage(decision === "APPROVED" ? "投稿已通过并写入景点库。" : "投稿已驳回。");
    } catch {
      setMessage("审核请求失败，请稍后再试。");
    }
  }

  return (
    <div className="space-y-4">
      {orderedItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brand-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          当前没有待处理投稿。
        </div>
      ) : null}

      {message ? <p className="text-sm text-slate-500">{message}</p> : null}

      {orderedItems.map((item) => (
        <article key={item.id} className="rounded-3xl border border-brand-100 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-brand-900">{item.name}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    item.status === "APPROVED"
                      ? "bg-emerald-100 text-emerald-700"
                      : item.status === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {item.province} / {item.city}
                {item.district ? ` / ${item.district}` : ""} / 投稿人：{item.user.nickname}
              </p>
              <p className="text-sm text-slate-500">提交时间：{formatDateTime(item.createdAt)}</p>
            </div>
            <div className="rounded-2xl bg-brand-50 px-4 py-3 text-xs leading-6 text-brand-700">
              <div>标签：{item.tags.join(" / ")}</div>
              <div>邮箱：{item.user.email}</div>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-700">{item.description}</p>

          <textarea
            value={notes[item.id] ?? item.reviewerNotes ?? ""}
            onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
            placeholder="审核备注，例如：建议补充更准确的交通方式、坐标或官方门票入口。"
            className="mt-4 min-h-28 w-full rounded-2xl border border-brand-100 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void review(item.id, "APPROVED")}
              className="rounded-full bg-brand-700 px-5 py-2.5 text-sm text-white"
            >
              通过并入库
            </button>
            <button
              type="button"
              onClick={() => void review(item.id, "REJECTED")}
              className="rounded-full border border-red-200 px-5 py-2.5 text-sm text-red-600"
            >
              驳回投稿
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
