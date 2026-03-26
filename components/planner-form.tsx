"use client";

import { useEffect, useMemo, useState } from "react";
import { PlanResults } from "@/components/planner/plan-results";
import { PLANNER_HERO_SETTING_EVENT, type PlannerHeroSettingEventDetail } from "@/components/planner/planner-hero-actions";
import type {
  BookingPreference,
  DepartureTimePreference,
  PlannerApiInput,
  PlannerEngineOutput,
  TicketPreference
} from "@/lib/planner/types";
import type { CompanionType, CrowdPreference, PacePreference, TransportMode } from "@/lib/planner/enums";

const DAY_OPTIONS = [
  { value: 1, label: "1 天 · 当天往返" },
  { value: 2, label: "2 天 · 周末短住" },
  { value: 3, label: "3 天 · 小长假" },
  { value: 4, label: "4 天 · 深度慢游" },
  { value: 5, label: "5 天 · 多点串联" },
  { value: 6, label: "6 天 · 旅居探索" },
  { value: 7, label: "7 天 · 一周安排" }
];

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

const LODGING_PREFS = [
  { label: "住宿不限", value: "flexible" },
  { label: "特色民宿", value: "design_homestay" },
  { label: "舒适酒店", value: "comfort_hotel" },
  { label: "温泉 / 度假酒店", value: "hot_spring_resort" },
  { label: "露营也可以", value: "camping_ok" }
];

const DINING_PREFS = [
  { label: "用餐不限", value: "flexible" },
  { label: "优先本地餐饮", value: "local_food" },
  { label: "咖啡和早午餐", value: "cafe_brunch" },
  { label: "适合家庭就餐", value: "family_restaurant" },
  { label: "找吃的方便最重要", value: "easy_to_find" }
];

const DEPARTURE_PREFS: Array<{ label: string; value: DepartureTimePreference }> = [
  { label: "越早越好", value: "early_morning" },
  { label: "上午出发", value: "morning" },
  { label: "中午前后", value: "noon" },
  { label: "下班后出发", value: "after_work" },
  { label: "时间灵活", value: "flexible" }
];

const BOOKING_PREFS: Array<{ label: string; value: BookingPreference }> = [
  { label: "尽量免预约", value: "avoid_reservations" },
  { label: "可以接受预约", value: "can_book" },
  { label: "必须可预订", value: "must_bookable" }
];

const TICKET_PREFS: Array<{ label: string; value: TicketPreference }> = [
  { label: "门票尽量低", value: "free_or_low_cost" },
  { label: "价格适中即可", value: "balanced" },
  { label: "高品质体验优先", value: "premium_ok" }
];

const TAGS = ["拍照", "安静", "特色民宿", "乡村风景", "自然", "互动体验", "餐饮方便", "文化体验", "少爬坡", "避暑", "亲子", "美食"];

const CONSTRAINTS = [
  { label: "避开盘山路", value: "avoid_mountain_road" },
  { label: "少爬坡少台阶", value: "avoid_steep_walk" },
  { label: "尽量免预约", value: "avoid_reservations" },
  { label: "门票别太贵", value: "low_ticket_cost" },
  { label: "适合住一晚", value: "need_hotel" },
  { label: "带娃友好", value: "child_friendly" },
  { label: "带长辈友好", value: "elderly_friendly" },
  { label: "停车方便优先", value: "free_parking_first" },
  { label: "想安排咖啡下午茶", value: "cafe_break" },
  { label: "想要温泉", value: "hot_spring_first" }
];

function labelOf<T extends string | number>(list: Array<{ label: string; value: T }>, value: T | string | number | null | undefined, fallback = "未指定") {
  if (!value) return fallback;
  return list.find((item) => String(item.value) === String(value))?.label ?? String(value);
}

function getTodayDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function clampBudget(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed);
}

function SummaryChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-sand px-4 py-2 text-sm text-brand-800">{children}</span>;
}

export function PlannerForm() {
  const [form, setForm] = useState<PlannerApiInput>({
    origin: "西安市区",
    destinationQuery: "",
    includeLiveSignals: true,
    travelDate: getTodayDateValue(),
    days: 2,
    budgetMin: 300,
    budgetMax: 800,
    transportMode: "self_drive",
    companions: "couple",
    preferenceTags: ["拍照", "安静", "特色民宿", "乡村风景"],
    crowdPreference: "avoid_crowds",
    pacePreference: "slow",
    lodgingPreference: "design_homestay",
    diningPreference: "local_food",
    departureTimePreference: "morning",
    bookingPreference: "can_book",
    ticketPreference: "balanced",
    specialConstraints: ["free_parking_first"]
  });
  const [result, setResult] = useState<PlannerEngineOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [preferReasonFirst, setPreferReasonFirst] = useState(true);

  const selectedTags = useMemo(() => new Set(form.preferenceTags), [form.preferenceTags]);
  const selectedConstraints = useMemo(() => new Set(form.specialConstraints || []), [form.specialConstraints]);

  useEffect(() => {
    function handlePlannerHeroSetting(event: Event) {
      const detail = (event as CustomEvent<PlannerHeroSettingEventDetail>).detail;
      if (!detail) return;

      if (detail.key === "includeLiveSignals") {
        setForm((current) => ({ ...current, includeLiveSignals: detail.value }));
        return;
      }

      if (detail.key === "preferReasonFirst") {
        setPreferReasonFirst(detail.value);
      }
    }

    window.addEventListener(PLANNER_HERO_SETTING_EVENT, handlePlannerHeroSetting);
    return () => window.removeEventListener(PLANNER_HERO_SETTING_EVENT, handlePlannerHeroSetting);
  }, []);

  function updateForm<K extends keyof PlannerApiInput>(key: K, value: PlannerApiInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleTag(tag: string) {
    setForm((current) => ({
      ...current,
      preferenceTags: current.preferenceTags.includes(tag)
        ? current.preferenceTags.filter((item) => item !== tag)
        : [...current.preferenceTags, tag]
    }));
  }

  function toggleConstraint(value: string) {
    setForm((current) => ({
      ...current,
      specialConstraints: current.specialConstraints?.includes(value)
        ? current.specialConstraints.filter((item) => item !== value)
        : [...(current.specialConstraints || []), value]
    }));
  }

  async function submit() {
    setLoading(true);
    setError(null);

    const budgetMin = form.budgetMin ?? 0;
    const budgetMax = form.budgetMax ?? 0;
    const normalizedBudgetMin = budgetMax && budgetMin > budgetMax ? budgetMax : form.budgetMin;
    const normalizedBudgetMax = budgetMax && budgetMin > budgetMax ? budgetMin : form.budgetMax;

    try {
      const response = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          budgetMin: normalizedBudgetMin,
          budgetMax: normalizedBudgetMax,
          destinationQuery: form.destinationQuery?.trim() || undefined
        })
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
      <section id="planner-form" className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full bg-brand-50 px-4 py-2 text-xs font-medium text-brand-700">出行条件</div>
            <h2 className="mt-4 text-2xl font-semibold text-brand-900">{result && !showFilters ? "这次的出行条件已经整理好了" : "先把这次旅行的大方向定下来"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {result && !showFilters
                ? "结果已经展开在下方。想改目的地、预算、住宿偏好或额外约束时，直接点“修改条件”继续调整。"
                : "系统会结合你的出发地、目的地、预算、住宿和预约偏好，再叠加实时天气、路况和开放信息，给出更可执行的方案。"}
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
              {loading ? "正在生成推荐..." : "生成推荐"}
            </button>
          </div>
        </div>

        {result && !showFilters ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <SummaryChip>出发地：{form.origin}</SummaryChip>
            {form.destinationQuery ? <SummaryChip>目的地：{form.destinationQuery}</SummaryChip> : null}
            <SummaryChip>{labelOf(DAY_OPTIONS, form.days, `${form.days} 天`)}</SummaryChip>
            <SummaryChip>交通：{labelOf(MODES, form.transportMode)}</SummaryChip>
            <SummaryChip>同行：{labelOf(COMPANIONS, form.companions)}</SummaryChip>
            <SummaryChip>节奏：{labelOf(PACE_PREFS, form.pacePreference)}</SummaryChip>
            <SummaryChip>人流：{labelOf(CROWD_PREFS, form.crowdPreference)}</SummaryChip>
            <SummaryChip>住宿：{labelOf(LODGING_PREFS, form.lodgingPreference || "flexible")}</SummaryChip>
            <SummaryChip>预约：{labelOf(BOOKING_PREFS, form.bookingPreference || "can_book")}</SummaryChip>
            <SummaryChip>预算：¥{form.budgetMin ?? 0} - {form.budgetMax ?? "不限"}</SummaryChip>
            <SummaryChip>实时参考：{form.includeLiveSignals === false ? "关闭" : "开启"}</SummaryChip>
            <SummaryChip>推荐理由：{preferReasonFirst ? "优先展示" : "常规顺序"}</SummaryChip>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr,1.1fr,0.8fr]">
              <div className="space-y-4 rounded-[1.6rem] border border-brand-100 bg-sand/30 p-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">基础信息</div>
                  <h3 className="mt-2 text-lg font-semibold text-brand-900">确定出发点、目的地和行程时长</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span>出发地</span>
                    <input
                      className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                      value={form.origin}
                      onChange={(e) => updateForm("origin", e.target.value)}
                      placeholder="例如：西安市区、北客站、小寨"
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>目的地或想去的区域</span>
                    <input
                      className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                      value={form.destinationQuery ?? ""}
                      onChange={(e) => updateForm("destinationQuery", e.target.value)}
                      placeholder="例如：临潼、秦岭、竹海、温泉"
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>出行日期</span>
                    <input
                      type="date"
                      className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                      value={form.travelDate}
                      onChange={(e) => updateForm("travelDate", e.target.value)}
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>出行天数</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.days} onChange={(e) => updateForm("days", Number(e.target.value))}>
                      {DAY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="space-y-4 rounded-[1.6rem] border border-brand-100 bg-white p-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">偏好与节奏</div>
                  <h3 className="mt-2 text-lg font-semibold text-brand-900">这些条件会直接影响 AI 如何选点</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span>出行方式</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.transportMode} onChange={(e) => updateForm("transportMode", e.target.value as TransportMode)}>
                      {MODES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>同行人群</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.companions} onChange={(e) => updateForm("companions", e.target.value as CompanionType)}>
                      {COMPANIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>人流偏好</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.crowdPreference} onChange={(e) => updateForm("crowdPreference", e.target.value as CrowdPreference)}>
                      {CROWD_PREFS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>节奏偏好</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.pacePreference} onChange={(e) => updateForm("pacePreference", e.target.value as PacePreference)}>
                      {PACE_PREFS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-dashed border-brand-100 bg-brand-50/40 p-5 text-sm text-slate-600">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">填写建议</div>
                <div className="mt-3 space-y-3 leading-6">
                  <p>先填一个大致目的地区域，系统会先缩小候选范围，再交给 AI 总结，速度更稳定。</p>
                  <p>条件越清晰，实时搜索补充的信息越少偏差，尤其是门票、开放时间、停车和预约要求。</p>
                  <p>如果只想当天往返，优先选 1-2 天，并勾选“门票别太贵”“停车方便优先”这类约束。</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-4 rounded-[1.6rem] border border-brand-100 bg-white p-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">住宿、餐饮与预订</div>
                  <h3 className="mt-2 text-lg font-semibold text-brand-900">把真正影响落地体验的条件补充完整</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2 text-sm">
                    <span>住宿偏好</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.lodgingPreference || "flexible"} onChange={(e) => updateForm("lodgingPreference", e.target.value)}>
                      {LODGING_PREFS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>餐饮偏好</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.diningPreference || "flexible"} onChange={(e) => updateForm("diningPreference", e.target.value)}>
                      {DINING_PREFS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>出发时段</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.departureTimePreference || "flexible"} onChange={(e) => updateForm("departureTimePreference", e.target.value as DepartureTimePreference)}>
                      {DEPARTURE_PREFS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>预约偏好</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.bookingPreference || "can_book"} onChange={(e) => updateForm("bookingPreference", e.target.value as BookingPreference)}>
                      {BOOKING_PREFS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>门票偏好</span>
                    <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={form.ticketPreference || "balanced"} onChange={(e) => updateForm("ticketPreference", e.target.value as TicketPreference)}>
                      {TICKET_PREFS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span>预算上限</span>
                    <input
                      type="number"
                      className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                      value={form.budgetMax ?? ""}
                      onChange={(e) => updateForm("budgetMax", clampBudget(e.target.value))}
                      placeholder="例如：800"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-4 rounded-[1.6rem] border border-brand-100 bg-brand-50/40 p-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">预算与实时能力</div>
                  <h3 className="mt-2 text-lg font-semibold text-brand-900">控制成本，也把实时信息利用起来</h3>
                </div>

                <label className="space-y-2 text-sm">
                  <span>预算下限</span>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-brand-100 px-4 py-3"
                    value={form.budgetMin ?? ""}
                    onChange={(e) => updateForm("budgetMin", clampBudget(e.target.value))}
                    placeholder="例如：300"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => updateForm("includeLiveSignals", form.includeLiveSignals === false)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    form.includeLiveSignals === false ? "border-brand-100 bg-white text-slate-600" : "border-brand-200 bg-brand-50/70 text-brand-900"
                  }`}
                >
                  <div className="text-sm font-medium">实时天气、路况与联网搜索</div>
                  <div className="mt-2 text-sm leading-6">
                    {form.includeLiveSignals === false
                      ? "当前已关闭实时链路，只按数据库与规则生成，速度更快，但会少掉天气、门票、预约和酒店等实时补充。"
                      : "当前已开启实时参考，会结合联网搜索补充天气、开放时间、门票、酒店和交通信息。"}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPreferReasonFirst((current) => !current)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    preferReasonFirst ? "border-brand-200 bg-brand-50/70 text-brand-900" : "border-brand-100 bg-white text-slate-600"
                  }`}
                >
                  <div className="text-sm font-medium">优先展示推荐理由</div>
                  <div className="mt-2 text-sm leading-6">
                    {preferReasonFirst
                      ? "结果会优先展示 AI 总结、推荐理由和动态因素，再展示路线与服务信息。"
                      : "结果会按更均衡的顺序展示，路线和动态参考会更靠前。"}
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-[1.6rem] border border-brand-100 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">偏好标签</div>
              <div className="mt-4 flex flex-wrap gap-2">
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

            <div className="mt-6 rounded-[1.6rem] border border-brand-100 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">额外要求</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {CONSTRAINTS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => toggleConstraint(item.value)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      selectedConstraints.has(item.value) ? "bg-brand-700 text-white" : "bg-white text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50"
                    }`}
                  >
                    {item.label}
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
          {result ? <div className="text-sm text-slate-500">结果已展开显示</div> : null}
        </div>
        <PlanResults result={result} origin={form.origin} preferReasonFirst={preferReasonFirst} includeLiveSignals={form.includeLiveSignals !== false} />
      </section>
    </div>
  );
}
