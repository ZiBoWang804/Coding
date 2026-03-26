import Link from "next/link";
import { SearchRecorder } from "@/components/search-recorder";
import { SpotCard } from "@/components/spot-card";
import { getCurrentUser } from "@/lib/auth";
import { getFilterOptions, getPersonalizedRecommendations, listPagedSpots } from "@/lib/repository";

const PAGE_SIZE = 18;

function normalizePage(value?: string) {
  const page = Number(value);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

function buildPageHref(params: Record<string, string | undefined>, page: number) {
  const nextParams = new URLSearchParams();
  for (const key of ["q", "province", "city", "tag"] as const) {
    const value = params[key];
    if (value) nextParams.set(key, value);
  }
  if (page > 1) nextParams.set("page", String(page));
  const query = nextParams.toString();
  return query ? `/spots?${query}` : "/spots";
}

export default async function SpotsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const requestedPage = normalizePage(params.page);
  const [user, filters, spotPage] = await Promise.all([
    getCurrentUser(),
    getFilterOptions(),
    listPagedSpots({ province: params.province, city: params.city, tag: params.tag, q: params.q }, requestedPage, PAGE_SIZE)
  ]);
  const personalized = user ? await getPersonalizedRecommendations(user.id, 4) : [];
  const spots = spotPage.items;
  const totalPages = Math.max(1, Math.ceil(spotPage.total / spotPage.pageSize));

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
            <div className="section-kicker">目的地库</div>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight text-brand-950 md:text-5xl">
              挑个想去的地方，
              <br />
              让这次周末有个明确的方向。
            </h1>
            <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
              这一页更像你的周末灵感库。可以按区域、玩法和关键词慢慢挑，先看图、先找感觉，看到顺眼的再点进去看详情和路线。
            </p>
          </div>
          <div className="rounded-full bg-brand-900 px-4 py-2 text-sm text-white">
            共 {spotPage.total} 个结果 · 第 {spotPage.page} / {totalPages} 页
          </div>
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
              <p className="mt-1 text-sm text-slate-500">
                当前页展示 {spots.length} 条，分批加载后切页会更顺，点开卡片可以继续看详情、地图位置和路线建议。
              </p>
            </div>
          </div>

          {spots.length > 0 ? (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {spots.map((spot) => (
                  <SpotCard key={spot.id} spot={spot} />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[1.8rem] border border-brand-100 bg-white/90 px-5 py-4">
                  <div className="text-sm text-slate-500">
                    正在浏览第 {spotPage.page} 页，共 {totalPages} 页。
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={buildPageHref(params, spotPage.page - 1)}
                      aria-disabled={spotPage.page <= 1}
                      className={`rounded-full px-5 py-3 text-sm font-medium transition ${
                        spotPage.page <= 1
                          ? "pointer-events-none border border-slate-200 text-slate-300"
                          : "border border-brand-200 text-brand-900 hover:bg-brand-50"
                      }`}
                    >
                      上一页
                    </Link>
                    <Link
                      href={buildPageHref(params, spotPage.page + 1)}
                      aria-disabled={spotPage.page >= totalPages}
                      className={`rounded-full px-5 py-3 text-sm font-medium transition ${
                        spotPage.page >= totalPages
                          ? "pointer-events-none border border-slate-200 text-slate-300"
                          : "bg-brand-900 text-white hover:bg-brand-800"
                      }`}
                    >
                      下一页
                    </Link>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="soft-card rounded-[2rem] p-8 text-center">
              <div className="text-xl font-semibold text-brand-950">这一轮没有筛到合适的地方</div>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                可以把关键词放宽一点，或者先清掉城市和玩法筛选，再从更大的范围里慢慢挑。
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
