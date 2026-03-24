"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserSummary } from "@/types";

export function AuthActions({ user }: { user: UserSummary | null }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    const nextTarget = pathname.startsWith("/admin") ? "/" : "/";
    window.location.assign(nextTarget);
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="rounded-full border border-brand-200 px-4 py-2 text-sm text-brand-800">
          用户登录
        </Link>
        <Link href="/login?entry=admin" className="rounded-full border border-brand-200 px-4 py-2 text-sm text-brand-800">
          管理员登录
        </Link>
        <Link href="/register" className="rounded-full bg-brand-700 px-4 py-2 text-sm text-white">
          注册
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user.role === "ADMIN" ? (
        <Link href="/admin" className="rounded-full border border-brand-200 px-4 py-2 text-sm text-brand-800">
          管理后台
        </Link>
      ) : null}
      <Link href="/me" className="rounded-full border border-brand-200 px-4 py-2 text-sm text-brand-800">
        {user.nickname}
      </Link>
      <button type="button" onClick={logout} className="rounded-full bg-brand-700 px-4 py-2 text-sm text-white">
        退出登录
      </button>
    </div>
  );
}
