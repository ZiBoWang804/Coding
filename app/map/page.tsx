import { LazyMapClient } from "@/components/lazy-map-client";
import { getFilterOptions, listSpots } from "@/lib/repository";

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [spots, filters] = await Promise.all([
    listSpots({ province: params.province, city: params.city, tag: params.tag }),
    getFilterOptions()
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-brand-900">乡旅地图</h1>
          <p className="mt-2 text-sm text-slate-600">仅展示已补充经纬度的乡村旅游点位，缺失坐标的数据会保留在列表和详情页中。</p>
        </div>
      </div>
      <form className="mb-6 grid gap-3 rounded-3xl border border-brand-100 bg-white p-5 shadow-card md:grid-cols-4">
        <select name="province" defaultValue={params.province} className="rounded-2xl border border-brand-100 px-4 py-3 text-sm">
          <option value="">全部省份</option>
          {filters.provinces.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select name="city" defaultValue={params.city} className="rounded-2xl border border-brand-100 px-4 py-3 text-sm">
          <option value="">全部城市</option>
          {filters.cities.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select name="tag" defaultValue={params.tag} className="rounded-2xl border border-brand-100 px-4 py-3 text-sm">
          <option value="">全部标签</option>
          {filters.tags.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="submit" className="rounded-full bg-brand-700 px-4 py-3 text-sm text-white">更新地图</button>
      </form>
      <LazyMapClient spots={spots} />
    </div>
  );
}
