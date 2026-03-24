"use client";

import { useMemo, useState } from "react";
import { PlanResults } from "@/components/planner/plan-results";
import type { CompanionType, CrowdPreference, PacePreference, TransportMode } from "@/lib/planner/enums";
import type { PlannerApiInput, PlannerEngineOutput } from "@/lib/planner/types";

const COMPANIONS: Array<{ label: string; value: CompanionType }> = [
  { label: "情侣", value: "couple" },
  { label: "亲子家庭", value: "family" },
  { label: "朋友结伴", value: "friends" },
  { label: "独自出行", value: "solo" },
  { label: "长辈同行", value: "elderly" }
];

const MODES: Array<{ label: string; value: TransportMode }> = [
  { label: "自驾", value: "self_drive" },
  { label: "公共交通", value: "public_transit" },
  { label: "都可以", value: "either" }
];

const CROWD_PREFS: Array<{ label: string; value: CrowdPreference }> = [
  { label: "尽量避开人流", value: "avoid_crowds" },
  { label: "无特别偏好", value: "neutral" },
  { label: "热闹一点", value: "lively" }
];

const PACE_PREFS: Array<{ label: string; value: PacePreference }> = [
  { label: "慢节奏", value: "slow" },
  { label: "适中", value: "moderate" },
  { label: "多点串联", value: "multi_stop" }
];

const TAGS = ["拍照", "安静", "特色民宿", "乡村风景", "自然", "互动体验", "餐饮方便", "文化体验", "少爬坡", "避暑", "亲子", "美食"];

function labelOf<T extends string>(list: Array<{ label: string; value: T }>, value: T) {
  return list.find((item) => item.value === value)?.label ?? value;
}

export function PlannerForm() {
  const [form, setForm] = useState<PlannerApiInput>({
    origin: "西安市区",
    travelDate: "2026-03-23",
    days: 1,
    budgetMin: 300,
    budgetMax: 500,
    transportMode: "self_drive",
    companions: "couple",
    preferenceTags: ["拍照", "安静", "特色民宿", "乡村风景"],
    crowdPreference: "avoid_crowds",
    pacePreference: "slow",
    lodgingPreference: "design homestay",
    diningPreference: "local_food",
    specialConstraints: []
  });
  const [result, setResult] = useState<PlannerEngineOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  const selectedTags = useMemo(() => new Set(form.preferenceTags), [form.preferenceTags]);

  function toggleTag(tag: string) {
    setForm((current) => ({
      ...current,
      preferenceTags: current.preferenceTags.includes(tag)
        ? current.preferenceTags.filter((item) => item !== tag)
        : [...current.preferenceTags, tag]
    }));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "规划请求失败");
      setResult(data);
      setShowFilters(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "规划请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full bg-brand-50 px-4 py-2 text-xs font-medium text-brand-700">Planner Input</div>
            <h2 className="mt-4 text-2xl font-semibold text-brand-900">
              {result && !showFilters ? "这次的出行条件已经帮你收好了" : "先设定这次周末怎么过"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {result && !showFilters
                ? "结果已经展开在下方。如果想换个方向、预算或同行人群，点“修改条件”就能继续调整。"
                : "先快速设定方向，生成后下方会完整展开推荐结果，不再把内容挤在右边。"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {result ? (
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="rounded-full border border-brand-200 bg-white px-5 py-3 text-sm font-medium text-brand-700"
              >
                {showFilters ? "收起条件" : "修改条件"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={loading}
              className="rounded-full bg-brand-700 px-6 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "生成推荐中..." : "生成推荐"}
            </button>
          </div>
        </div>

        {result && !showFilters ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-sand px-4 py-2 text-sm text-brand-800">出发地：{form.origin}</span>
            <span className="rounded-full bg-sand px-4 py-2 text-sm text-brand-800">{form.days} 天</span>
            <span className="rounded-full bg-sand px-4 py-2 text-sm text-brand-800">出行方式：{labelOf(MODES, form.transportMode)}</span>
            <span className="rounded-full bg-sand px-4 py-2 text-sm text-brand-800">同行人群：{labelOf(COMPANIONS, form.companions)}</span>
            <span className="rounded-full bg-sand px-4 py-2 text-sm text-brand-800">节奏：{labelOf(PACE_PREFS, form.pacePreference)}</span>
            <span className="rounded-full bg-sand px-4 py-2 text-sm text-brand-800">人流偏好：{labelOf(CROWD_PREFS, form.crowdPreference)}</span>
            <span className="rounded-full bg-sand px-4 py-2 text-sm text-brand-800">预算：{form.budgetMin ?? 0}-{form.budgetMax ?? "不限"} 元</span>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm">
                <span>出发地</span>
                <input
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  placeholder="例如：钟楼、小寨、北客站、曲江"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>出行日期</span>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={form.travelDate}
                  onChange={(e) => setForm({ ...form, travelDate: e.target.value })}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>天数</span>
                <select
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: Number(e.target.value) as PlannerApiInput["days"] })}
                >
                  {[1, 2, 3].map((day) => (
                    <option key={day} value={day}>
                      {day} 天
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>出行方式</span>
                <select
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={form.transportMode}
                  onChange={(e) => setForm({ ...form, transportMode: e.target.value as TransportMode })}
                >
                  {MODES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>同行人群</span>
                <select
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={form.companions}
                  onChange={(e) => setForm({ ...form, companions: e.target.value as CompanionType })}
                >
                  {COMPANIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>人流偏好</span>
                <select
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={form.crowdPreference}
                  onChange={(e) => setForm({ ...form, crowdPreference: e.target.value as CrowdPreference })}
                >
                  {CROWD_PREFS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>节奏偏好</span>
                <select
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={form.pacePreference}
                  onChange={(e) => setForm({ ...form, pacePreference: e.target.value as PacePreference })}
                >
                  {PACE_PREFS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>预算下限</span>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={form.budgetMin ?? ""}
                  onChange={(e) => setForm({ ...form, budgetMin: Number(e.target.value) || undefined })}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>预算上限</span>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                  value={form.budgetMax ?? ""}
                  onChange={(e) => setForm({ ...form, budgetMax: Number(e.target.value) || undefined })}
                />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              <div className="text-sm font-medium text-brand-900">偏好标签</div>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      selectedTags.has(tag) ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-brand-900">智能推荐结果</h3>
          {result ? <div className="text-sm text-slate-500">结果已整页展开显示</div> : null}
        </div>
        <PlanResults result={result} origin={form.origin} />
      </section>
    </div>
  );
}
