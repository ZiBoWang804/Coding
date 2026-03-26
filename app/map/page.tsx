import { Compass, MapPinned } from "lucide-react";
import { SpotsMap } from "@/components/spots-map";
import { getFilterOptions, getMapPageData } from "@/lib/repository";

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [mapData, filters] = await Promise.all([
    getMapPageData({ province: params.province, city: params.city, tag: params.tag }),
    getFilterOptions()
  ]);
  const spots = mapData.spots;

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="soft-card rounded-[2.6rem] p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="section-kicker">地图浏览</div>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight text-brand-950 md:text-5xl">
              先从地图找方向，
              <br />
              再决定这周末往哪边出发。
            </h1>
            <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
              地图默认保留西安周边景点的完整展示；西安以外的地区，则只展示 5A 景点，避免点位过多影响判断。点开标记后可以先看地址和摘要，再进入详情页继续筛选。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-900 px-4 py-2 text-sm text-white">
              <MapPinned className="h-4 w-4" />
              已展示 {mapData.displayed} / {mapData.total} 个点位
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800">
              <Compass className="h-4 w-4" />
              西安外默认保留 5A 景点
            </div>
          </div>
        </div>
      </section>

      <form className="soft-card mt-6 grid gap-3 rounded-[2rem] p-5 md:grid-cols-4">
        <select name="province" defaultValue={params.province} className="rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm">
          <option value="">全部省份</option>
          {filters.provinces.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select name="city" defaultValue={params.city} className="rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm">
          <option value="">全部城市</option>
          {filters.cities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select name="tag" defaultValue={params.tag} className="rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm">
          <option value="">全部玩法</option>
          {filters.tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-brand-800 px-4 py-3 text-sm font-medium text-white shadow-[0_18px_36px_rgba(23,57,46,0.18)]"
        >
          刷新地图结果
        </button>
      </form>

      {mapData.truncated ? (
        <div className="mt-4 rounded-[1.4rem] border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm leading-7 text-brand-900">
          为了保证地图缩放和拖拽流畅，当前默认只加载前 {mapData.displayed} 个有效点位。继续缩小城市或玩法筛选，可以看到更完整也更准确的分布。
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-[2rem] border border-brand-100 shadow-[0_24px_70px_rgba(30,48,39,0.12)]">
        <SpotsMap spots={spots} />
      </div>
    </div>
  );
}
