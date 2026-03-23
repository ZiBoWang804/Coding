"use client";

import { useMemo, useState } from "react";
import type { PlannerApiInput, PlannerEngineOutput } from "@/lib/planner/types";
import type { CompanionType, CrowdPreference, PacePreference, TransportMode } from "@/lib/planner/enums";
import { PlanResults } from "@/components/planner/plan-results";

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
  { label: "热闹一些", value: "lively" }
];

const PACE_PREFS: Array<{ label: string; value: PacePreference }> = [
  { label: "慢节奏", value: "slow" },
  { label: "适中", value: "moderate" },
  { label: "多点串联", value: "multi_stop" }
];

const TAGS = ["拍照", "安静", "特色民宿", "乡村风景", "自然", "互动体验", "餐饮方便", "文化体验", "少爬坡", "避暑", "亲子", "美食"];

export function PlannerForm() {
  const [form, setForm] = useState<PlannerApiInput>({
    origin: "西安市区",
    travelDate: "2026-03-22",
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "规划请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
      <section className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-brand-900">AI 乡村行程规划</h2>
        <p className="mt-2 text-sm text-slate-600">系统会先做规则过滤，再做评分排序、行程生成和原因解释。即使没有实时天气或路况接口，也能依赖内置 mock 数据完成规划。</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span>出发地</span>
            <input className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
          </label>
          <label className="space-y-2 text-sm">
            <span>出行日期</span>
            <input type="date" className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} />
          </label>
          <label className="space-y-2 text-sm">
            <span>天数</span>
            <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) as PlannerApiInput["days"] })}>
              {[1, 2, 3].map((day) => <option key={day} value={day}>{day} 天</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>出行方式</span>
            <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.transportMode} onChange={(e) => setForm({ ...form, transportMode: e.target.value as TransportMode })}>
              {MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>同行人群</span>
            <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.companions} onChange={(e) => setForm({ ...form, companions: e.target.value as CompanionType })}>
              {COMPANIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>人流偏好</span>
            <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.crowdPreference} onChange={(e) => setForm({ ...form, crowdPreference: e.target.value as CrowdPreference })}>
              {CROWD_PREFS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>节奏偏好</span>
            <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.pacePreference} onChange={(e) => setForm({ ...form, pacePreference: e.target.value as PacePreference })}>
              {PACE_PREFS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>预算下限</span>
            <input type="number" className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.budgetMin ?? ""} onChange={(e) => setForm({ ...form, budgetMin: Number(e.target.value) || undefined })} />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span>预算上限</span>
            <input type="number" className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.budgetMax ?? ""} onChange={(e) => setForm({ ...form, budgetMax: Number(e.target.value) || undefined })} />
          </label>
        </div>

        <div className="mt-5 space-y-3">
          <div className="text-sm font-medium">偏好标签</div>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`rounded-full px-4 py-2 text-sm transition ${selectedTags.has(tag) ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100"}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={() => void submit()} disabled={loading} className="mt-6 rounded-full bg-brand-700 px-6 py-3 text-sm font-medium text-white disabled:opacity-60">
          {loading ? "规划生成中..." : "生成方案"}
        </button>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-brand-900">规划结果</h3>
        <PlanResults result={result} />
      </section>
    </div>
  );
}


