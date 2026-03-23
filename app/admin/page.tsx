import Link from "next/link";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getAdminOverview, listPendingSubmissions, listSpots } from "@/lib/repository";

export default async function AdminPage() {
  const [overview, submissions, spots] = await Promise.all([
    getAdminOverview(),
    listPendingSubmissions(),
    listSpots()
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-brand-900">后台管理员系统</h1>
          <p className="mt-2 text-sm text-slate-600">管理员可以管理景点、审核用户投稿、查看社区和打卡活跃度。</p>
        </div>
        <Link href="/admin/import" className="rounded-full bg-brand-700 px-5 py-3 text-sm text-white">前往导入中心</Link>
      </div>
      <AdminDashboard initialSpots={spots.slice(0, 30)} overview={overview} submissions={submissions} />
    </div>
  );
}