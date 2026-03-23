import { PlannerForm } from "@/components/planner-form";

export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-brand-900">智能行程规划</h1>
        <p className="mt-2 text-sm text-slate-600">支持规则引擎保底输出；若已配置火山方舟豆包接入点，会自动追加详细线路、交通、预算、物品和打卡路线清单。</p>
      </div>
      <PlannerForm />
    </div>
  );
}