import Link from "next/link";
import { CATEGORY_TAGS, HERO_SLIDES, RECOMMENDED_ROUTES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { getHomeData } from "@/lib/repository";
import { getXianFeaturedSpots } from "@/lib/xian-topic";
import { SpotCard } from "@/components/spot-card";
import { HomeCarousel } from "@/components/home-carousel";

export default async function HomePage() {
  const user = await getCurrentUser();
  const { featured, popular, personalized, recentSearches } = await getHomeData(user);
  const heroSpot = featured[0];
  const xianTopic = await getXianFeaturedSpots();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="hero-noise paper-grid relative overflow-hidden rounded-[2.25rem] bg-brand-900 px-6 py-8 text-white shadow-card md:px-10 md:py-12">
        <div className="absolute inset-y-0 right-0 hidden w-[42%] bg-gradient-to-l from-white/10 to-transparent lg:block" />
        <div className="relative grid gap-8 lg:grid-cols-[1.02fr,0.98fr] lg:items-end">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm backdrop-blur">用户平台 / 管理后台 / 社区共创</div>
            <div className="mt-6 max-w-3xl">
              <p className="text-sm tracking-[0.2em] text-white/55">游乡记</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-6xl">把乡村旅行做成一套<br />能决策、能共创、能复用的系统</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/78 md:text-lg">从目的地检索、AI 行程规划、门票酒店入口，到打卡、攻略社区和用户投稿审核，游乡记已经从单页演示升级为完整 MVP。</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/planner" className="rounded-full bg-amberleaf px-6 py-3 text-sm font-medium text-ink shadow-lg shadow-amberleaf/20">立即规划行程</Link>
              <Link href="/spots" className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur">进入用户平台</Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur"><div className="text-2xl font-semibold">{featured.length}+</div><div className="mt-1 text-sm text-white/65">热门目的地</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur"><div className="text-2xl font-semibold">社区</div><div className="mt-1 text-sm text-white/65">攻略 / 评论 / 点赞 / 打卡</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur"><div className="text-2xl font-semibold">AI + 审核</div><div className="mt-1 text-sm text-white/65">规划增强与用户投稿入库</div></div>
            </div>
          </div>

          <div className="space-y-4">
            <HomeCarousel slides={HERO_SLIDES} />
            <div className="rounded-[1.75rem] border border-white/12 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-white/65">演示推荐卡</div>
                  <div className="mt-2 text-2xl font-semibold">{heroSpot?.name ?? "婺源篁岭"}</div>
                  <div className="mt-1 text-sm text-white/68">{heroSpot ? `${heroSpot.province} · ${heroSpot.city}` : "江西省 · 上饶市"}</div>
                </div>
                <div className="rounded-full bg-amberleaf px-3 py-1 text-xs font-medium text-ink">首页精选</div>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/78">{heroSpot?.description ?? "适合摄影、家庭短途和节假日微度假的经典样板点。"}</p>
              <div className="mt-4 flex flex-wrap gap-2">{(heroSpot?.tags ?? CATEGORY_TAGS.slice(0, 4)).slice(0, 4).map((tag) => <span key={tag} className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-white/90">{tag}</span>)}</div>
            </div>
          </div>
        </div>
      </section>

      {user ? (
        <section className="mt-10 grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm tracking-[0.2em] text-brand-600">为你推荐</div>
                <h2 className="mt-2 text-2xl font-semibold text-brand-900">个性化推荐</h2>
              </div>
              <Link href="/me" className="text-sm text-brand-700">管理偏好</Link>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {(personalized.length > 0 ? personalized : featured.slice(0, 3)).map((spot) => <SpotCard key={spot.id} spot={spot} />)}
            </div>
          </div>
          <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-brand-900">最近搜索轨迹</h2>
              <Link href="/planner" className="text-sm text-brand-700">继续规划</Link>
            </div>
            <div className="mt-5 space-y-3">
              {recentSearches.length === 0 ? <p className="text-sm text-slate-500">你还没有搜索记录，去试一次智能规划或目的地筛选。</p> : null}
              {recentSearches.map((item) => (
                <div key={item.id} className="rounded-[1.4rem] bg-sand p-4">
                  <div className="font-medium text-brand-900">{item.query || [item.province, item.city, item.tag].filter(Boolean).join(" / ") || "综合浏览"}</div>
                  <div className="mt-1 text-sm text-slate-500">偏好：{item.preferences.join("、") || "未记录"}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-10 rounded-[2rem] border border-brand-100 bg-[#fffaf1] p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm tracking-[0.2em] text-brand-600">西安专题</div>
            <h2 className="mt-2 text-3xl font-semibold text-brand-900">西安附近乡村景点专题</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">专题数据来自你导入的《西安附近乡村景点数据采集表》，现在已经和社区、打卡、智能规划一起组成可演示的完整主题模块。</p>
          </div>
          <div className="rounded-full bg-brand-700 px-4 py-2 text-sm text-white">已整理 12 条</div>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {xianTopic.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold text-brand-900">热门乡村目的地</h2><Link href="/spots" className="text-sm text-brand-700">查看全部</Link></div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">{featured.slice(0, 4).map((spot) => <SpotCard key={spot.id} spot={spot} />)}</div>
        </div>
        <div className="rounded-[2rem] border border-brand-100 bg-[#f8f4ea] p-6 shadow-card">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold text-brand-900">推荐路线模块</h2><Link href="/planner" className="text-sm text-brand-700">去做规划</Link></div>
          <div className="mt-5 space-y-4">{RECOMMENDED_ROUTES.map((route, index) => <div key={route.title} className="rounded-[1.5rem] border border-brand-100 bg-white p-5"><div className="flex items-center justify-between gap-4"><div className="text-sm text-slate-500">路线 0{index + 1}</div><div className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">适合路演展示</div></div><div className="mt-3 text-lg font-semibold text-brand-900">{route.title}</div><p className="mt-2 text-sm leading-7 text-slate-600">{route.summary}</p></div>)}</div>
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between"><h3 className="text-xl font-semibold text-brand-900">分类入口</h3><div className="text-sm text-slate-500">按场景快速进入</div></div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{CATEGORY_TAGS.map((tag, index) => <Link key={tag} href={`/spots?tag=${encodeURIComponent(tag)}`} className={`rounded-[1.35rem] px-4 py-5 text-center text-sm font-medium ${index % 3 === 0 ? "bg-brand-700 text-white" : index % 3 === 1 ? "bg-brand-50 text-brand-800" : "bg-[#f4ead2] text-brand-900"}`}>{tag}</Link>)}</div>
        </div>
        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between"><h3 className="text-xl font-semibold text-brand-900">系统亮点</h3><div className="text-sm text-slate-500">适合大学生创业答辩版本</div></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] bg-brand-50 p-5"><div className="text-sm text-brand-700">01</div><div className="mt-2 text-lg font-semibold text-brand-900">用户系统完整</div><p className="mt-2 text-sm leading-7 text-slate-600">注册登录、偏好保存、搜索历史、个性化推荐已经串起来。</p></div>
            <div className="rounded-[1.4rem] bg-[#f8f1dd] p-5"><div className="text-sm text-brand-700">02</div><div className="mt-2 text-lg font-semibold text-brand-900">社区与打卡沉淀内容</div><p className="mt-2 text-sm leading-7 text-slate-600">每个景点下可发攻略、评论、点赞和打卡，形成内容资产。</p></div>
            <div className="rounded-[1.4rem] bg-[#f1f6f2] p-5"><div className="text-sm text-brand-700">03</div><div className="mt-2 text-lg font-semibold text-brand-900">管理员审核共创</div><p className="mt-2 text-sm leading-7 text-slate-600">用户可提交新打卡点，经审核通过后自动写入景点库。</p></div>
            <div className="rounded-[1.4rem] bg-[#f7efe8] p-5"><div className="text-sm text-brand-700">04</div><div className="mt-2 text-lg font-semibold text-brand-900">出行闭环更完整</div><p className="mt-2 text-sm leading-7 text-slate-600">提供门票/酒店入口、高德导航、物品清单和打卡路线清单。</p></div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold text-brand-900">更多灵感</h2><div className="text-sm text-slate-500">适合继续扩充的热门目的地</div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{popular.slice(0, 4).map((spot) => <SpotCard key={spot.id} spot={spot} />)}</div>
      </section>
    </div>
  );
}
