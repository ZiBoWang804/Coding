"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SESSION_COOKIE } from "@/lib/constants";
import type { UserSummary } from "@/types";

export function AuthActions({ user }: { user: UserSummary | null }) {
  const [currentUser, setCurrentUser] = useState(user);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setCurrentUser(user);
    setIsLoggingOut(false);
  }, [user]);

  async function logout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setCurrentUser(null);
    document.cookie = `${SESSION_COOKIE}=; Max-Age=0; path=/`;

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store"
      });
    } finally {
      window.location.assign("/");
    }
  }

  if (!currentUser) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-full border border-brand-200 bg-white/72 px-4 py-2 text-sm font-medium text-brand-900 shadow-[0_12px_28px_rgba(19,36,29,0.06)] backdrop-blur"
        >
          用户登录
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-brand-800 px-4 py-2 text-sm font-medium text-white shadow-[0_18px_35px_rgba(23,57,46,0.18)] hover:bg-brand-900"
        >
          注册
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {currentUser.role === "ADMIN" ? (
        <Link
          href="/admin"
          className="rounded-full border border-brand-200 bg-white/72 px-4 py-2 text-sm font-medium text-brand-900 shadow-[0_12px_28px_rgba(19,36,29,0.06)] backdrop-blur"
        >
          管理后台
        </Link>
      ) : null}
      <Link
        href="/me"
        className="rounded-full border border-brand-200 bg-white/72 px-4 py-2 text-sm font-medium text-brand-900 shadow-[0_12px_28px_rgba(19,36,29,0.06)] backdrop-blur"
      >
        {currentUser.nickname}
      </Link>
      <button
        type="button"
        onClick={logout}
        disabled={isLoggingOut}
        className="rounded-full bg-brand-800 px-4 py-2 text-sm font-medium text-white shadow-[0_18px_35px_rgba(23,57,46,0.18)] hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoggingOut ? "退出中..." : "退出"}
      </button>
    </div>
  );
}
