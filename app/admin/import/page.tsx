import Link from "next/link";
import { ImportWorkbench } from "@/components/import-workbench";
import { requireAdmin } from "@/lib/auth";

export default async function AdminImportPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-brand-900">数据导入中心</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            支持 CSV / XLSX 批量导入，包含字段映射、预览校验、增量更新和失败提示。这个页面只对管理员开放。
          </p>
        </div>
        <Link href="/admin" className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700">
          返回后台工作台
        </Link>
      </div>

      <ImportWorkbench />
    </div>
  );
}
