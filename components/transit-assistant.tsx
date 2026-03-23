"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildXiAnTransitGuide } from "@/lib/transit-guide";

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

export function TransitAssistant({
  defaultOrigin,
  target,
  className = ""
}: {
  defaultOrigin: string;
  target: TransitAssistantTarget;
  className?: string;
}) {
  const [origin, setOrigin] = useState(defaultOrigin || "\u897f\u5b89\u5e02\u533a");
  const guide = useMemo(() => buildXiAnTransitGuide(origin, target), [origin, target]);

  return (
    <div className={`rounded-2xl bg-brand-50/70 p-4 ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-medium text-brand-800">{"\u897f\u5b89\u5730\u4e0b\u4ea4\u901a\u5230\u8fbe"}</div>
          <p className="mt-1 text-sm text-slate-600">{"\u8f93\u5165\u897f\u5b89\u4efb\u610f\u51fa\u53d1\u70b9\uff0c\u9875\u9762\u4f1a\u540c\u6b65\u5237\u65b0\u516c\u4ea4\u3001\u5730\u94c1\u548c\u672b\u6bb5\u63a5\u9a73\u5efa\u8bae\u3002"}</p>
        </div>
        <label className="block min-w-[240px] text-sm text-slate-600">
          <span className="mb-2 block">{"\u51fa\u53d1\u70b9"}</span>
          <input
            className="w-full rounded-2xl border border-brand-100 bg-white px-4 py-3"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            placeholder={"\u4f8b\u5982\uff1a\u949f\u697c\u3001\u5317\u5ba2\u7ad9\u3001\u5c0f\u5be8\u3001\u66f2\u6c5f"}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-white px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">{"\u5efa\u8bae\u6362\u4e58\u65b9\u5411"}</div>
          <div className="mt-1 font-medium text-brand-900">{guide.transferHub}</div>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">{"\u76ee\u7684\u5730"}</div>
          <div className="mt-1 font-medium text-brand-900">{guide.destinationLabel}</div>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">{"\u672b\u6bb5\u63d0\u9192"}</div>
          <div className="mt-1 font-medium text-brand-900">{guide.lastMileTip}</div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{guide.summary}</p>

      <div className="mt-4">
        <div className="font-medium text-brand-800">{"\u9875\u9762\u5185\u6362\u4e58\u5efa\u8bae"}</div>
        <ol className="mt-2 space-y-2 text-sm text-slate-700">
          {guide.suggestedSteps.map((step, index) => (
            <li key={step} className="rounded-xl bg-white px-4 py-3">
              <span className="font-medium text-brand-800">{`\u7b2c ${index + 1} \u6b65\uff1a`}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={guide.transitRouteUrl} target="_blank" className="rounded-full bg-brand-700 px-3 py-2 text-xs text-white">{"\u9ad8\u5fb7\u516c\u4ea4\u8def\u7ebf"}</Link>
        <Link href={guide.subwaySearchUrl} target="_blank" className="rounded-full border border-brand-200 px-3 py-2 text-xs text-brand-700">{"\u5730\u94c1\u6362\u4e58\u67e5\u8be2"}</Link>
        <Link href={guide.destinationSearchUrl} target="_blank" className="rounded-full border border-brand-200 px-3 py-2 text-xs text-brand-700">{"\u76ee\u7684\u5730\u5730\u56fe"}</Link>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">{guide.caution}</p>
    </div>
  );
}
