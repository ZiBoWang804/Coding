import Link from "next/link";
import { AdminDashboard } from "@/components/admin-dashboard";
import { requireAdmin } from "@/lib/auth";
import { getAdminWorkspaceData } from "@/lib/repository";

export default async function AdminPage() {
  await requireAdmin();
  const workspace = await getAdminWorkspaceData();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm tracking-[0.22em] text-brand-600">ADMIN CONSOLE</div>
          <h1 className="mt-2 text-3xl font-semibold text-brand-900">管理员后台工作台</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            这里统一处理景点数据、用户投稿和平台监控，方便协同开发时快速确认新增功能是否已经接入后台并进入运营流程。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/import" className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700">
            数据导入中心
          </Link>
          <Link href="/spots" className="rounded-full bg-brand-700 px-5 py-3 text-sm text-white">
            返回用户端
          </Link>
        </div>
      </div>

      <AdminDashboard workspace={workspace} />
    </div>
  );
}
