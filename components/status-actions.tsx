"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserSpotState } from "@/types";

const STATES = [
  { key: "wantToGo", label: "想去" },
  { key: "visited", label: "去过" },
  { key: "favorite", label: "收藏" }
] as const;

export function StatusActions({ spotId, initialState, loggedIn }: { spotId: string; initialState: UserSpotState; loggedIn: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<UserSpotState>(initialState);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStatus(initialState);
  }, [initialState]);

  async function toggle(key: keyof UserSpotState) {
    if (!loggedIn) {
      router.push(`/login?redirect=/spots/${spotId}`);
      return;
    }

    const nextValue = !status[key];
    setStatus((current) => ({ ...current, [key]: nextValue }));
    const response = await fetch(`/api/spots/${spotId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: key, active: nextValue })
    });

    if (!response.ok) {
      setStatus(initialState);
      setMessage("保存失败，请稍后重试");
      return;
    }

    setStatus(await response.json());
    setMessage(nextValue ? "已记录到你的行程状态" : "已取消该状态");
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => void toggle(item.key)}
            className={`rounded-full border px-4 py-2 text-sm transition ${status[item.key] ? "border-brand-600 bg-brand-600 text-white shadow-md" : "border-brand-200 bg-white text-brand-700 hover:border-brand-400"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {message ? <p className="mt-3 text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}