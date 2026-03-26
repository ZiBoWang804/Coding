"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildXiAnTransitGuide } from "@/lib/transit-guide";
import type { PlannerRoutePlan } from "@/lib/planner/types";

type TransitAssistantTarget = {
  name: string;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  publicTransitFriendlyScore?: number | null;
  lastMileDifficulty?: number | null;
  nearestRailStation?: string | null;
};

function formatStepMeta(step: PlannerRoutePlan["steps"][number]) {
  const parts: string[] = [];
  if (step.durationMinutes != null) parts.push(`约 ${step.durationMinutes} 分钟`);
  if (step.distanceKm != null) parts.push(`约 ${step.distanceKm} 公里`);
  if (step.stops != null) parts.push(`约 ${step.stops} 站`);
  return parts.join(" | ");
}

function modeLabel(mode: PlannerRoutePlan["mode"]) {
  return mode === "public_transit" ? "公共交通" : "自驾";
}

export function TransitAssistant({
  defaultOrigin,
  target,
  routePlans,
  className = ""
}: {
  defaultOrigin: string;
  target: TransitAssistantTarget;
  routePlans?: PlannerRoutePlan[];
  className?: string;
}) {
  const [origin, setOrigin] = useState(defaultOrigin || "西安市区");
  const [expanded, setExpanded] = useState(false);
  const fallbackGuide = useMemo(() => buildXiAnTransitGuide(origin, target), [origin, target]);
  const plans = routePlans?.length ? routePlans : [];

  return (
    <div className={`rounded-[1.7rem] border border-brand-100/70 bg-brand-50/60 p-4 ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-brand-700">路线</span>
            <span className="text-xs text-slate-500">从 {origin} 出发</span>
          </div>
          <h4 className="text-base font-semibold text-brand-900">路线建议</h4>
          <p className="text-sm leading-6 text-slate-600">
            默认只展示关键到达信息，详细换乘步骤、方向和站数可按需展开查看。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-full bg-brand-700 px-4 py-2 text-xs font-medium text-white"
          >
            {expanded ? "收起路线细节" : "查看详细路线"}
          </button>
          <Link
            href={fallbackGuide.transitRouteUrl}
            target="_blank"
            className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-medium text-brand-700"
          >
            打开地图导航
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(plans.length
          ? plans
          : [
              {
                mode: "public_transit" as const,
                summary: fallbackGuide.summary,
                durationMinutes: 0,
                distanceKm: 0,
                walkingDistanceKm: null,
                cost: null,
                caution: fallbackGuide.caution,
                steps: []
              }
            ]).map((plan) => (
          <div key={plan.mode} className="rounded-2xl bg-white/95 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{modeLabel(plan.mode)}</div>
                <div className="mt-1 text-sm font-medium text-brand-900">{plan.summary}</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                {plan.durationMinutes > 0 ? <div>约 {plan.durationMinutes} 分钟</div> : null}
                {plan.distanceKm > 0 ? <div>{plan.distanceKm} 公里</div> : null}
                {plan.cost != null ? <div>约 {plan.cost} 元</div> : null}
              </div>
            </div>

            {plan.mode === "public_transit" ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-brand-50 px-3 py-1">换乘方向：{fallbackGuide.transferHub}</span>
                <span className="rounded-full bg-brand-50 px-3 py-1">末段提醒：{fallbackGuide.lastMileTip}</span>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-brand-50 px-3 py-1">到达片区：{fallbackGuide.destinationLabel}</span>
                <span className="rounded-full bg-brand-50 px-3 py-1">停车后建议预留步行时间</span>
              </div>
            )}

            {expanded ? (
              <ol className="mt-3 space-y-2 text-sm text-slate-700">
                {(plan.steps.length
                  ? plan.steps
                  : fallbackGuide.suggestedSteps.map((step) => ({
                      mode: "walk" as const,
                      title: "建议步骤",
                      detail: step,
                      durationMinutes: null,
                      distanceKm: null,
                      stops: null
                    }))).map((step, index) => (
                  <li key={`${plan.mode}-${step.title}-${index}`} className="rounded-xl bg-brand-50/70 px-4 py-3">
                    <div className="font-medium text-brand-800">{`第 ${index + 1} 步：${step.title}`}</div>
                    <div className="mt-1">{step.detail}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatStepMeta(step) || "以出发前地图查询结果为准"}</div>
                  </li>
                ))}
              </ol>
            ) : null}

            {plan.caution ? <p className="mt-3 text-xs leading-5 text-slate-500">{plan.caution}</p> : null}
          </div>
        ))}
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-brand-100/80 bg-white/80 p-4 md:grid-cols-[1.2fr,0.8fr]">
          <label className="space-y-2 text-sm text-slate-600">
            <span className="block">调整出发点</span>
            <input
              className="w-full rounded-2xl border border-brand-100 bg-white px-4 py-3"
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              placeholder="例如：钟楼、小寨、北客站"
            />
          </label>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="font-medium text-brand-800">补充提醒</div>
            <div>{fallbackGuide.caution}</div>
            <div className="text-xs text-slate-500">地图页面会提供更精确的实时导航结果。</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
