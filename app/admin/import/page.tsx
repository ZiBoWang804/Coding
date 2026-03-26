import { requireAdmin } from "@/lib/auth";
import { ImportWorkbench } from "@/components/import-workbench";

export default async function AdminImportPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-brand-900">数据导入中心</h1>
        <p className="mt-2 text-sm text-slate-600">
          支持 CSV / XLSX，包含字段映射、导入预览、去重更新和失败提示。该页面仅管理员可见。
        </p>
      </div>
      <ImportWorkbench />
    </div>
  );
}
