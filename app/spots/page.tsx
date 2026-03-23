import { SpotCard } from "@/components/spot-card";
import { SearchRecorder } from "@/components/search-recorder";
import { getCurrentUser } from "@/lib/auth";
import { getFilterOptions, getPersonalizedRecommendations, listSpots } from "@/lib/repository";

export default async function SpotsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const filters = await getFilterOptions();
  const spots = await listSpots({ province: params.province, city: params.city, tag: params.tag, q: params.q });
  const personalized = user ? await getPersonalizedRecommendations(user.id, 4) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {user ? <SearchRecorder payload={{ query: params.q, province: params.province, city: params.city, tag: params.tag, resultIds: spots.slice(0, 10).map((spot) => spot.id || "").filter(Boolean) }} /> : null}
      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="h-fit rounded-3xl border border-brand-100 bg-white p-5 shadow-card">
          <h1 className="text-xl font-semibold text-brand-900">目的地筛选</h1>
          <form className="mt-4 space-y-4">
            <input name="q" defaultValue={params.q} placeholder="搜索名称、城市或简介" className="w-full rounded-2xl border border-brand-100 px-4 py-3 text-sm" />
            <select name="province" defaultValue={params.province} className="w-full rounded-2xl border border-brand-100 px-4 py-3 text-sm">
              <option value="">全部省份</option>
              {filters.provinces.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select name="city" defaultValue={params.city} className="w-full rounded-2xl border border-brand-100 px-4 py-3 text-sm">
              <option value="">全部城市</option>
              {filters.cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select name="tag" defaultValue={params.tag} className="w-full rounded-2xl border border-brand-100 px-4 py-3 text-sm">
              <option value="">全部标签</option>
              {filters.tags.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="submit" className="w-full rounded-full bg-brand-700 px-4 py-3 text-sm text-white">应用筛选</button>
          </form>
          {user && personalized.length > 0 ? (
            <div className="mt-6 rounded-2xl bg-sand p-4">
              <div className="text-sm font-medium text-brand-900">猜你想去</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {personalized.slice(0, 3).map((spot) => <div key={spot.id}>{spot.name}</div>)}
              </div>
            </div>
          ) : null}
        </aside>
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-brand-900">共找到 {spots.length} 个目的地</h2>
              <p className="mt-1 text-sm text-slate-500">点击任一景点可进入详情、社区、打卡和导航入口。</p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {spots.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
          </div>
        </section>
      </div>
    </div>
  );
}