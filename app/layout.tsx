import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";
import { PwaRegister } from "@/components/pwa-register";
import { getCurrentUser } from "@/lib/auth";
import { AuthActions } from "@/components/auth-actions";

export const metadata: Metadata = {
  title: `${APP_NAME} | 乡村旅游智能规划平台`,
  description: "聚焦乡村旅游的智能规划、社区共创和后台审核平台",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default"
  }
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm text-brand-900/80 hover:text-brand-600">
      {label}
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="zh-CN">
      <body>
        <PwaRegister />
        <div className="min-h-screen bg-hero-glow">
          <header className="sticky top-0 z-20 border-b border-brand-100 bg-sand/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <Link href="/" className="text-xl font-semibold tracking-wide text-brand-900">
                游乡记
              </Link>
              <nav className="hidden gap-6 md:flex">
                <NavLink href="/spots" label="目的地" />
                <NavLink href="/map" label="乡旅地图" />
                <NavLink href="/planner" label="智能规划" />
                <NavLink href="/me" label="我的游乡记" />
              </nav>
              <AuthActions user={user} />
            </div>
          </header>
          <main>{children}</main>
          <footer className="border-t border-brand-100 bg-white/80">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-600 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
              <p>游乡记 MVP · 用户平台 + 管理后台双系统</p>
              <p>支持登录、个性化推荐、社区攻略、打卡共创和管理员审核</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}