import type { Metadata } from "next";
import Link from "next/link";
import { AuthActions } from "@/components/auth-actions";
import { PwaRegister } from "@/components/pwa-register";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} | 西安周边乡野旅行平台`,
    template: `%s | ${APP_NAME}`
  },
  description: "用更成熟的旅游平台方式整理西安周边乡村景点、地图点位、周末路线和智能推荐。",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default"
  }
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="nav-link text-sm font-medium text-brand-950/78 hover:text-brand-700">
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
        <div className="page-shell min-h-screen">
          <header className="sticky top-0 z-40 border-b border-white/60 bg-[rgba(248,244,236,0.78)] backdrop-blur-2xl">
            <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <Link href="/" className="flex min-w-0 items-center gap-4">
                <div className="brand-mark flex h-12 w-12 items-center justify-center rounded-[1.45rem] text-sm font-semibold text-white shadow-[0_20px_40px_rgba(17,42,34,0.22)]">
                  游
                </div>
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold tracking-[0.02em] text-brand-950">{APP_NAME}</div>
                  <div className="text-[11px] uppercase tracking-[0.34em] text-brand-700/72">XI&apos;AN RURAL ESCAPES</div>
                </div>
              </Link>

              <nav className="hidden items-center gap-7 lg:flex">
                <NavLink href="/spots" label="目的地" />
                <NavLink href="/map" label="乡野地图" />
                <NavLink href="/planner" label="智能规划" />
                <NavLink href="/me" label="我的行程" />
              </nav>

              <AuthActions user={user} />
            </div>
          </header>

          <main className="relative">{children}</main>

          <footer className="mt-16 overflow-hidden border-t border-white/10 bg-[#0f241d] text-white">
            <div className="relative mx-auto max-w-[1480px] px-4 py-14 sm:px-6 lg:px-8">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(86,152,118,0.22),transparent_62%)]" />
              <div className="grid gap-10 lg:grid-cols-[1.1fr,0.95fr,0.95fr]">
                <div className="relative">
                  <div className="section-kicker text-white/55">Weekend Escape</div>
                  <h2 className="font-display mt-4 max-w-xl text-3xl font-semibold leading-tight text-white md:text-4xl">
                    把周末留给山野、村落、温泉和能真正慢下来的风景。
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-8 text-white/68">
                    {APP_NAME} 不是演示页式的信息拼接，而是一套更接近真实旅游平台的目的地浏览、地图发现与行程规划入口。
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link href="/planner" className="rounded-full bg-white px-5 py-3 text-sm font-medium text-brand-950">
                      开始规划周末
                    </Link>
                    <Link href="/map" className="rounded-full border border-white/16 px-5 py-3 text-sm font-medium text-white/88">
                      去地图里找方向
                    </Link>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-white/92">热门入口</div>
                  <div className="mt-4 grid gap-3 text-sm text-white/68">
                    <Link href="/spots" className="footer-link">浏览全部景点</Link>
                    <Link href="/map" className="footer-link">按区域查看地图点位</Link>
                    <Link href="/planner" className="footer-link">让 AI 帮你选路线</Link>
                    <Link href="/me" className="footer-link">查看自己的收藏与记录</Link>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-white/92">出发建议</div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-white/68">
                    <p>适合周末短途的方向包括古寨漫游、竹海轻徒步、亲子农园、温泉休闲和村落慢逛。</p>
                    <p>建议先看地图分布，再决定去北线、东线还是山地方向，整体体验会更顺。</p>
                    <p>遇到天气变化、拥堵或路线不合适时，智能规划会优先给出更稳妥的替代方案。</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 border-t border-white/10 pt-6 text-xs tracking-[0.18em] text-white/36">
                {APP_NAME} · XI&apos;AN RURAL WEEKEND PLATFORM
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
