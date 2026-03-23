"use client";

import Link from "next/link";
import { TransitAssistant } from "@/components/transit-assistant";
import type { PlannerEngineOutput } from "@/lib/planner/types";

const SCORE_LABELS: Record<string, string> = {
  timeFit: "时间匹配",
  transportFit: "交通匹配",
  companionFit: "同行人群匹配",
  weatherFit: "天气匹配",
  budgetFit: "预算匹配",
  seasonFit: "季节匹配",
  lodgingFit: "住宿匹配",
  diningFit: "餐饮匹配",
  tagFit: "偏好标签匹配"
};

export function PlanResults({ result, origin }: { result: PlannerEngineOutput | null; origin: string }) {
  if (!result) {
    return <p className="mt-4 text-sm text-slate-500">填写出行条件后，这里会生成一份结构化的乡村出游方案。</p>;
  }

  const best = result.recommendedPlans[0];

  return (
    <div className="mt-4 space-y-5 text-sm text-slate-700">
      <div className="rounded-2xl bg-brand-50 p-4">
        <div className="font-medium text-brand-800">{result.readableSummary.headline}</div>
        <div className="mt-2 space-y-1">
          {result.readableSummary.recommendation.map((item) => <p key={item}>{item}</p>)}
        </div>
      </div>

      {best ? (
        <div className="rounded-2xl border border-brand-100 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-brand-900">{best.destinationName}</div>
              <div className="mt-1 text-xs text-slate-500">总分 {best.totalScore}</div>
            </div>
            <Link href={`/spots/${best.destinationId}`} className="rounded-full bg-brand-50 px-3 py-2 text-xs text-brand-700">查看目的地</Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {Object.entries(best.scoreBreakdown).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-sand p-3">
                <div className="text-xs tracking-wide text-slate-500">{SCORE_LABELS[key] ?? key}</div>
                <div className="mt-1 font-medium text-brand-900">{value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-sand p-4">
          <div className="font-medium text-brand-800">动态因素</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.readableSummary.dynamicImpact.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl bg-sand p-4">
          <div className="font-medium text-brand-800">注意事项</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.readableSummary.cautions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>

      <div>
        <div className="font-medium text-brand-800">推荐方案</div>
        <div className="mt-2 space-y-3">
          {result.recommendedPlans.map((plan) => (
            <div key={plan.destinationId} className="rounded-2xl border border-brand-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-brand-900">{plan.destinationName}</div>
                  <div className="mt-1 text-xs text-slate-500">得分 {plan.totalScore}</div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>预算 {plan.budgetEstimate.totalMin}-{plan.budgetEstimate.totalMax} 元</div>
                  <div>{plan.transportSummary}</div>
                </div>
              </div>
              <TransitAssistant
                className="mt-3"
                defaultOrigin={origin || "西安市区"}
                target={{
                  name: plan.destinationName,
                  city: plan.mappedDestination.city,
                  district: plan.mappedDestination.district,
                  address: plan.mappedDestination.address,
                  latitude: plan.mappedDestination.latitude,
                  longitude: plan.mappedDestination.longitude,
                  publicTransitFriendlyScore: plan.mappedDestination.publicTransitFriendlyScore,
                  lastMileDifficulty: plan.mappedDestination.lastMileDifficulty,
                  nearestRailStation: plan.mappedDestination.nearestRailStation
                }}
              />
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="font-medium text-brand-800">上榜原因</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {plan.rankingReason.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <div className="mt-3 font-medium text-brand-800">适合你的原因</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {plan.whyFitUser.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-brand-800">行程安排</div>
                  <ul className="mt-2 space-y-2">
                    {plan.itinerary.map((item) => (
                      <li key={`${plan.destinationId}-${item.day}-${item.title}`} className="rounded-xl bg-brand-50/60 p-3">
                        <div className="font-medium">第 {item.day} 天 · {item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.startTime} - {item.endTime}</div>
                        <div className="mt-1">{item.description}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
