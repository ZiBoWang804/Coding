import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PlannerForm } from "@/components/planner-form";

export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="hero-panel rounded-[2.6rem] px-6 py-8 text-white md:px-8 md:py-10 lg:px-10">
        <div className="max-w-4xl">
          <div className="hero-kicker">Smart Planner</div>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-tight md:text-5xl">
            说说你的这次周末偏好，
            <br />
            我来帮你把路线挑出来。
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-white/76 md:text-base">
            不管你想轻松一点、出片一点，还是更适合亲子、自驾或住一晚，这里都会先给出重点推荐，再补充预算、路线和执行建议。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm text-white/82">动态天气与路况参考</div>
            <div className="rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm text-white/82">优先展示推荐理由</div>
            <Link href="/map" className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm text-white/82">
              <Sparkles className="h-4 w-4" />
              先去地图找感觉
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <PlannerForm />
      </div>
    </div>
  );
}
