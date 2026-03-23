import { Compass, MapPinned } from "lucide-react";
import { SpotsMap } from "@/components/spots-map";
import { getFilterOptions, listSpots } from "@/lib/repository";

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [spots, filters] = await Promise.all([
    listSpots({ province: params.province, city: params.city, tag: params.tag }),
    getFilterOptions()
  ]);
  const mapReadyCount = spots.filter((spot) => spot.latitude != null && spot.longitude != null).length;

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="soft-card rounded-[2.6rem] p-6 md:p-8 lg:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="section-kicker">Map View</div>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight text-brand-950 md:text-5xl">
              先从地图找方向，
              <br />
              再决定这周末往哪边走。
            </h1>
            <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
              适合还没完全想好去哪的时候使用。先看景点在地图上的分布、距离和聚集区域，再点开详情页继续看内容、交通和路线建议。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-900 px-4 py-2 text-sm text-white">
              <MapPinned className="h-4 w-4" />
              已展示 {mapReadyCount} 个点位
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800">
              <Compass className="h-4 w-4" />
              更适合先看分布再筛选
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
        <button type="submit" className="rounded-full bg-brand-800 px-4 py-3 text-sm font-medium text-white shadow-[0_18px_36px_rgba(23,57,46,0.18)]">
          刷新地图结果
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-[2rem] border border-brand-100 shadow-[0_24px_70px_rgba(30,48,39,0.12)]">
        <SpotsMap spots={spots} />
      </div>
    </div>
  );
}
