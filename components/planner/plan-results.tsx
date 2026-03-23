"use client";

import Link from "next/link";
import { TransitAssistant } from "@/components/transit-assistant";
import type { PlannerEngineOutput, RankedPlan } from "@/lib/planner/types";

const SCORE_LABELS: Record<string, string> = {
  timeFit: "时间匹配",
  transportFit: "交通匹配",
  companionFit: "同行匹配",
  weatherFit: "天气匹配",
  budgetFit: "预算匹配",
  seasonFit: "季节匹配",
  lodgingFit: "住宿匹配",
  diningFit: "餐饮匹配",
  tagFit: "偏好匹配"
};

function formatOpenStatus(status?: string) {
  if (status === "open") return "预计开放";
  if (status === "closed") return "疑似闭园";
  return "待核验";
}

function buildHighlightItems(plan: RankedPlan) {
  return [
    {
      label: "综合得分",
      value: `${plan.totalScore}`,
      note: "系统排序结果"
    },
    {
      label: "参考预算",
      value: `${plan.budgetEstimate.totalMin}-${plan.budgetEstimate.totalMax} 元`,
      note: "含交通、活动与餐饮"
    },
    {
      label: "到达耗时",
      value: plan.mappedDestination.liveTravelMinutes != null ? `约 ${plan.mappedDestination.liveTravelMinutes} 分钟` : "待估算",
      note: plan.mappedDestination.liveTrafficStatus || "按当前条件估算"
    }
  ];
}

function compactReasons(items: string[], fallback: string) {
  return items.length ? items : [fallback];
}

export function PlanResults({ result, origin }: { result: PlannerEngineOutput | null; origin: string }) {
  if (!result) {
    return (
      <div className="mt-4 rounded-[2rem] border border-dashed border-brand-200 bg-white/75 p-8 text-sm text-slate-500">
        填写出行条件后，这里会优先展示 AI 推荐结论、推荐理由、动态因素和可执行路线。
      </div>
    );
  }

  const best = result.recommendedPlans[0];
  const alternatives = result.recommendedPlans.slice(1, 3);

  if (!best) {
    return (
      <div className="mt-4 rounded-[2rem] border border-dashed border-brand-200 bg-white/75 p-8 text-sm text-slate-500">
        当前没有命中合适路线，可以调整预算、天数、同行人群或偏好标签后重试。
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6 text-sm text-slate-700">
      <section className="overflow-hidden rounded-[2.2rem] border border-brand-100 bg-white shadow-card">
        <div className="bg-[linear-gradient(135deg,rgba(33,79,62,0.96),rgba(44,97,77,0.9))] px-6 py-6 text-white md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">AI Recommendation</div>
              <h3 className="mt-3 text-3xl font-semibold">{best.destinationName}</h3>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/84">{result.readableSummary.headline}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{formatOpenStatus(best.mappedDestination.openStatus)}</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{best.transportSummary}</span>
              </div>
            </div>

            <Link href={`/spots/${best.destinationId}`} className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-medium text-brand-800">
              查看景点详情
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {buildHighlightItems(best).map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                <div className="text-xs tracking-[0.18em] text-white/65">{item.label}</div>
                <div className="mt-2 text-xl font-semibold">{item.value}</div>
                <div className="mt-1 text-xs text-white/65">{item.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 px-6 py-6 md:grid-cols-[1.15fr,0.85fr] md:px-8">
          <div className="space-y-5">
            <div className="rounded-2xl bg-brand-50/70 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-600">AI 判断</div>
              <div className="mt-3 space-y-2 text-[15px] leading-7 text-slate-700">
                {result.readableSummary.recommendation.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-brand-100 bg-white p-5">
                <div className="font-medium text-brand-800">推荐理由</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {compactReasons(best.rankingReason, "当前筛选条件下综合适配度最高。").map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-brand-100 bg-white p-5">
                <div className="font-medium text-brand-800">更适合你的点</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {compactReasons(best.whyFitUser, "和当前偏好、预算与出行天数相对贴合。").map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-brand-100 bg-sand/80 p-5">
              <div className="font-medium text-brand-800">动态因素</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {compactReasons(result.readableSummary.dynamicImpact, "当前没有额外动态风险。").map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-white p-5">
              <div className="font-medium text-brand-800">开放与时效</div>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div>
                  <div className="text-xs tracking-[0.18em] text-slate-400">开放状态</div>
                  <div className="mt-1 font-medium text-brand-900">{formatOpenStatus(best.mappedDestination.openStatus)}</div>
                </div>
                <div>
                  <div className="text-xs tracking-[0.18em] text-slate-400">开放时间</div>
                  <div className="mt-1">{best.mappedDestination.openingHoursText || "暂无外部校验结果"}</div>
                </div>
                {best.mappedDestination.openingVerificationNote ? (
                  <div>
                    <div className="text-xs tracking-[0.18em] text-slate-400">外部校验</div>
                    <div className="mt-1">{best.mappedDestination.openingVerificationNote}</div>
                    {best.mappedDestination.openingSourceUrl ? (
                      <Link href={best.mappedDestination.openingSourceUrl} target="_blank" className="mt-2 inline-flex text-xs text-brand-700 underline">
                        查看来源
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.08fr,0.92fr]">
        <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Top Match</div>
              <h4 className="mt-2 text-xl font-semibold text-brand-900">首选方案拆解</h4>
            </div>
            <div className="rounded-full bg-brand-50 px-4 py-2 text-xs font-medium text-brand-700">{best.destinationName}</div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {Object.entries(best.scoreBreakdown).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-brand-50/55 p-4">
                <div className="text-xs font-medium tracking-[0.16em] text-slate-500">{SCORE_LABELS[key] ?? key}</div>
                <div className="mt-2 text-xl font-semibold text-brand-900">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="font-medium text-brand-800">建议行程</div>
            <ul className="mt-3 space-y-3">
              {best.itinerary.map((item) => (
                <li key={`${best.destinationId}-${item.day}-${item.title}`} className="rounded-2xl bg-sand/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-brand-900">{`第 ${item.day} 天 · ${item.title}`}</div>
                    <div className="text-xs text-slate-500">
                      {item.startTime} - {item.endTime}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <TransitAssistant
            defaultOrigin={origin || "西安市区"}
            routePlans={best.mappedDestination.routePlans}
            target={{
              name: best.destinationName,
              city: best.mappedDestination.city,
              district: best.mappedDestination.district,
              address: best.mappedDestination.address,
              latitude: best.mappedDestination.latitude,
              longitude: best.mappedDestination.longitude,
              publicTransitFriendlyScore: best.mappedDestination.publicTransitFriendlyScore,
              lastMileDifficulty: best.mappedDestination.lastMileDifficulty,
              nearestRailStation: best.mappedDestination.nearestRailStation
            }}
          />

          <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Alternatives</div>
            <h4 className="mt-2 text-lg font-semibold text-brand-900">其他可选方案</h4>
            <div className="mt-4 space-y-3">
              {alternatives.length ? (
                alternatives.map((plan) => (
                  <div key={plan.destinationId} className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-brand-900">{plan.destinationName}</div>
                        <div className="mt-1 text-xs text-slate-500">得分 {plan.totalScore}</div>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs text-brand-700">
                        {plan.budgetEstimate.totalMin}-{plan.budgetEstimate.totalMax} 元
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-slate-600">{plan.whyFitUser[0] || plan.rankingReason[0] || plan.transportSummary}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-100 p-4 text-sm text-slate-500">当前没有更多备选方案。</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Recommendation List</div>
            <h4 className="mt-2 text-lg font-semibold text-brand-900">全部推荐结果</h4>
          </div>
          <div className="text-sm text-slate-500">按综合适配度排序，便于快速横向比较。</div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {result.recommendedPlans.map((plan, index) => (
            <div key={plan.destinationId} className="rounded-[1.8rem] border border-brand-100 bg-[linear-gradient(180deg,#fffefb,#f8f2e8)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">No. {index + 1}</div>
                  <div className="mt-2 text-lg font-semibold text-brand-900">{plan.destinationName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold text-brand-900">{plan.totalScore}</div>
                  <div className="text-xs text-slate-500">综合得分</div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-slate-600">
                <div className="rounded-full bg-white px-3 py-2">预算：{plan.budgetEstimate.totalMin}-{plan.budgetEstimate.totalMax} 元</div>
                <div className="rounded-full bg-white px-3 py-2">开放：{formatOpenStatus(plan.mappedDestination.openStatus)}</div>
                <div className="rounded-full bg-white px-3 py-2">
                  到达：{plan.mappedDestination.liveTravelMinutes != null ? `约 ${plan.mappedDestination.liveTravelMinutes} 分钟` : "待估算"}
                </div>
              </div>

              <div className="mt-4 text-sm leading-6 text-slate-600">{plan.whyFitUser[0] || plan.rankingReason[0] || plan.transportSummary}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
