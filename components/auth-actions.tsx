"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserSummary } from "@/types";

export function AuthActions({ user }: { user: UserSummary | null }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/");
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-full border border-brand-200 bg-white/72 px-4 py-2 text-sm font-medium text-brand-900 shadow-[0_12px_28px_rgba(19,36,29,0.06)] backdrop-blur"
        >
          登录
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
      {user.role === "ADMIN" ? (
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
        {user.nickname}
      </Link>
      <button
        type="button"
        onClick={logout}
        className="rounded-full bg-brand-800 px-4 py-2 text-sm font-medium text-white shadow-[0_18px_35px_rgba(23,57,46,0.18)] hover:bg-brand-900"
      >
        退出
      </button>
    </div>
  );
}
