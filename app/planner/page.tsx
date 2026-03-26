import { PlannerForm } from "@/components/planner-form";
import { PlannerHeroActions } from "@/components/planner/planner-hero-actions";

export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="hero-panel rounded-[2.6rem] px-6 py-8 text-white md:px-8 md:py-10 lg:px-10">
        <div className="max-w-4xl">
          <div className="hero-kicker">智能规划</div>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-tight md:text-5xl">
            说说你的这次周末偏好，
            <br />
            我来帮你把路线挑出来。
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-white/76 md:text-base">
            现在的规划不只是看数据库标签。它会把你填写的目的地、预算、住宿与预约偏好，再加上实时天气、路况和联网搜索到的开放时间、门票、酒店信息，一起交给 AI 做判断。
          </p>
          <PlannerHeroActions />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div id="planner-capability-live" className="scroll-mt-24 rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <div className="hero-kicker text-brand-600">实时参考</div>
          <h2 className="mt-3 text-xl font-semibold text-brand-900">天气、路况、开放时间和门票不再只是静态说明</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            开启实时参考后，系统会优先用联网搜索补充天气、路况、景点开放状态、门票与预约规则，以及附近酒店信息，再交给 AI 汇总成推荐结论。
          </p>
        </div>
        <div id="planner-capability-reason" className="scroll-mt-24 rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <div className="hero-kicker text-brand-600">推荐逻辑</div>
          <h2 className="mt-3 text-xl font-semibold text-brand-900">先告诉你为什么选它，再展开路线和执行细节</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            结果页会先展示 AI 推荐结论、动态因素和注意事项，再往下展开行程、交通、住宿和服务入口，阅读节奏更像真实旅游产品。
          </p>
        </div>
      </section>

      <div className="mt-6">
        <PlannerForm />
      </div>
    </div>
  );
}
