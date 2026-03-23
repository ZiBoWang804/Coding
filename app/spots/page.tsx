import { SearchRecorder } from "@/components/search-recorder";
import { SpotCard } from "@/components/spot-card";
import { getCurrentUser } from "@/lib/auth";
import { getFilterOptions, getPersonalizedRecommendations, listSpots } from "@/lib/repository";

export default async function SpotsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [user, filters, spots] = await Promise.all([
    getCurrentUser(),
    getFilterOptions(),
    listSpots({ province: params.province, city: params.city, tag: params.tag, q: params.q })
  ]);
  const personalized = user ? await getPersonalizedRecommendations(user.id, 4) : [];

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
      {user ? (
        <SearchRecorder
          payload={{
            query: params.q,
            province: params.province,
            city: params.city,
            tag: params.tag,
            resultIds: spots.slice(0, 10).map((spot) => spot.id || "").filter(Boolean)
          }}
        />
      ) : null}

      <section className="soft-card rounded-[2.6rem] p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="section-kicker">Destination Library</div>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight text-brand-950 md:text-5xl">
              挑个想去的地方，
              <br />
              让这次周末有个明确的方向。
            </h1>
            <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
              这一页更像你的周末灵感库。可以按区域、玩法和关键词慢慢挑，先看图、先找感觉，看到顺眼的再点进去看详情和路线。
            </p>
          </div>
          <div className="rounded-full bg-brand-900 px-4 py-2 text-sm text-white">这次找到 {spots.length} 个结果</div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="soft-card h-fit rounded-[2rem] p-5">
          <div className="text-lg font-semibold text-brand-950">先筛一轮，再慢慢看</div>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            还没想好去哪也没关系。先选城市、玩法或直接输入关键词，很快就能把适合自驾、亲子、采摘、拍照的地方缩小出来。
          </p>

          <form className="mt-5 space-y-4">
            <input
              name="q"
              defaultValue={params.q}
              placeholder="搜景点名、区域，或者你想玩的感觉"
              className="w-full rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm"
            />
            <select name="province" defaultValue={params.province} className="w-full rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm">
              <option value="">全部省份</option>
              {filters.provinces.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select name="city" defaultValue={params.city} className="w-full rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm">
              <option value="">全部城市</option>
              {filters.cities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select name="tag" defaultValue={params.tag} className="w-full rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm">
              <option value="">全部玩法</option>
              {filters.tags.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full rounded-full bg-brand-800 px-4 py-3 text-sm font-medium text-white shadow-[0_18px_36px_rgba(23,57,46,0.18)]"
            >
              更新筛选结果
            </button>
          </form>

          {user && personalized.length > 0 ? (
            <div className="mt-6 rounded-[1.6rem] bg-[#f6efe2] p-4">
              <div className="text-sm font-medium text-brand-950">你可能也会喜欢</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {personalized.slice(0, 3).map((spot) => (
                  <div key={spot.id}>{spot.name}</div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-brand-950">看看这次有哪些地方值得出发</h2>
              <p className="mt-1 text-sm text-slate-500">点开卡片可以继续看景点详情、地图位置、交通建议和社区内容。</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {spots.map((spot) => (
              <SpotCard key={spot.id} spot={spot} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
