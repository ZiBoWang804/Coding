import Link from "next/link";
import { AdminDashboard } from "@/components/admin-dashboard";
import { requireAdmin } from "@/lib/auth";
import {
  getAdminBrowseTrend,
  getAdminOverview,
  getAdminSpotHeatmap,
  listPendingSubmissions,
  listSpots
} from "@/lib/repository";

export default async function AdminPage() {
  await requireAdmin();

  const [overview, submissions, spots, browseTrend, heatmapSpots] = await Promise.all([
    getAdminOverview(),
    listPendingSubmissions(),
    listSpots({ take: 30 }),
    getAdminBrowseTrend(),
    getAdminSpotHeatmap()
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-brand-900">管理员后台</h1>
          <p className="mt-2 text-sm text-slate-600">
            在这里可以维护景点资料、审核用户投稿，并查看平台内容、浏览趋势和景点热度分布。
          </p>
        </div>
        <Link href="/admin/import" className="rounded-full bg-brand-700 px-5 py-3 text-sm text-white">
          前往导入中心
        </Link>
      </div>

      <AdminDashboard
        initialSpots={spots}
        overview={overview}
        submissions={submissions}
        browseTrend={browseTrend}
        heatmapSpots={heatmapSpots}
      />
    </div>
  );
}
