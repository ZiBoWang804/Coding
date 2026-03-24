"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { AdminReviewBoard } from "@/components/admin-review-board";
import { formatDateTime } from "@/lib/utils";
import type { AdminHotSpotItem, AdminWorkspaceData, RuralSpotSeed } from "@/types";

type TabKey = "monitor" | "data" | "review";

type SpotFormState = {
  name: string;
  province: string;
  city: string;
  district: string;
  address: string;
  description: string;
  tags: string;
  bestSeason: string;
  avgCost: string;
  rating: string;
  crowdLevel: string;
  suggestedDuration: string;
  transportInfo: string;
  latitude: string;
  longitude: string;
  imageUrl: string;
  ticketBookingUrl: string;
  hotelBookingUrl: string;
  gaodeNavigationUrl: string;
  source: string;
};

const TABS: Array<{ key: TabKey; label: string; description: string }> = [
  { key: "monitor", label: "平台监控", description: "查看数据健康、活跃度和重点景点。" },
  { key: "data", label: "景点管理", description: "新增、编辑、删除景点与运营资料。" },
  { key: "review", label: "投稿审核", description: "处理用户提交的新景点和补充信息。" }
];

const emptyForm: SpotFormState = {
  name: "",
  province: "",
  city: "",
  district: "",
  address: "",
  description: "",
  tags: "",
  bestSeason: "春 | 秋",
  avgCost: "",
  rating: "",
  crowdLevel: "",
  suggestedDuration: "1 天",
  transportInfo: "",
  latitude: "",
  longitude: "",
  imageUrl: "",
  ticketBookingUrl: "",
  hotelBookingUrl: "",
  gaodeNavigationUrl: "",
  source: "admin_import"
};

function parseTextList(value: string) {
  return value
    .split(/[|｜、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMissingFields(spot: RuralSpotSeed) {
  const missing: string[] = [];
  if (spot.latitude == null || spot.longitude == null) missing.push("坐标");
  if (!spot.imageUrl) missing.push("封面图");
  if (!spot.transportInfo) missing.push("交通");
  if (!spot.ticketBookingUrl) missing.push("门票");
  if (!spot.hotelBookingUrl) missing.push("酒店");
  return missing;
}

function buildDistribution(items: string[], take = 6) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = item?.trim() || "未标注";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, take)
    .map(([label, count]) => ({ label, count }));
}

function buildHotSpots(spots: RuralSpotSeed[], baseHotSpots: AdminHotSpotItem[]) {
  const metricsMap = new Map(baseHotSpots.map((item) => [item.id, item]));

  return spots
    .map((spot) => {
      const base = metricsMap.get(spot.id || "") ?? {
        id: spot.id || spot.name,
        name: spot.name,
        city: spot.city,
        rating: spot.rating,
        postCount: 0,
        checkInCount: 0,
        favoriteCount: 0,
        missingFields: []
      };

      return {
        ...base,
        id: spot.id || spot.name,
        name: spot.name,
        city: spot.city,
        rating: spot.rating,
        missingFields: getMissingFields(spot)
      };
    })
    .sort((left, right) => {
      const leftScore = left.postCount + left.checkInCount + left.favoriteCount;
      const rightScore = right.postCount + right.checkInCount + right.favoriteCount;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return (right.rating ?? 0) - (left.rating ?? 0);
    })
    .slice(0, 6);
}

function toFormState(spot: RuralSpotSeed): SpotFormState {
  return {
    name: spot.name,
    province: spot.province,
    city: spot.city,
    district: spot.district ?? "",
    address: spot.address ?? "",
    description: spot.description,
    tags: spot.tags.join(" | "),
    bestSeason: spot.bestSeason.join(" | "),
    avgCost: spot.avgCost != null ? String(spot.avgCost) : "",
    rating: spot.rating != null ? String(spot.rating) : "",
    crowdLevel: spot.crowdLevel != null ? String(spot.crowdLevel) : "",
    suggestedDuration: spot.suggestedDuration ?? "",
    transportInfo: spot.transportInfo ?? "",
    latitude: spot.latitude != null ? String(spot.latitude) : "",
    longitude: spot.longitude != null ? String(spot.longitude) : "",
    imageUrl: spot.imageUrl ?? "",
    ticketBookingUrl: spot.ticketBookingUrl ?? "",
    hotelBookingUrl: spot.hotelBookingUrl ?? "",
    gaodeNavigationUrl: spot.gaodeNavigationUrl ?? "",
    source: spot.source || "admin_import"
  };
}

function toSpotPayload(form: SpotFormState) {
  return {
    name: form.name.trim(),
    province: form.province.trim(),
    city: form.city.trim(),
    district: form.district.trim() || null,
    address: form.address.trim() || null,
    description: form.description.trim(),
    tags: parseTextList(form.tags),
    bestSeason: parseTextList(form.bestSeason),
    avgCost: toNumberOrNull(form.avgCost),
    rating: toNumberOrNull(form.rating),
    crowdLevel: toNumberOrNull(form.crowdLevel),
    suggestedDuration: form.suggestedDuration.trim() || null,
    transportInfo: form.transportInfo.trim() || null,
    latitude: toNumberOrNull(form.latitude),
    longitude: toNumberOrNull(form.longitude),
    imageUrl: form.imageUrl.trim() || null,
    ticketBookingUrl: form.ticketBookingUrl.trim() || null,
    hotelBookingUrl: form.hotelBookingUrl.trim() || null,
    gaodeNavigationUrl: form.gaodeNavigationUrl.trim() || null,
    source: form.source.trim() || "admin_import"
  };
}

function sortSpots(spots: RuralSpotSeed[]) {
  return [...spots].sort((left, right) => {
    const ratingGap = (right.rating ?? 0) - (left.rating ?? 0);
    if (ratingGap !== 0) return ratingGap;
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-brand-900">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-7 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function toneClass(tone?: "neutral" | "warning" | "good") {
  if (tone === "good") return "bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "bg-amber-50 text-amber-700";
  return "bg-brand-50 text-brand-700";
}

export function AdminDashboard({ workspace }: { workspace: AdminWorkspaceData }) {
  const [activeTab, setActiveTab] = useState<TabKey>("monitor");
  const [spots, setSpots] = useState(workspace.spots);
  const [submissions, setSubmissions] = useState(workspace.submissions);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  const [form, setForm] = useState<SpotFormState>(emptyForm);

  const filteredSpots = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return spots;
    return spots.filter((spot) => {
      const text = [spot.name, spot.province, spot.city, spot.district, spot.description, spot.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      return text.includes(keyword);
    });
  }, [query, spots]);

  const overview = useMemo(
    () => ({
      ...workspace.overview,
      spotCount: spots.length,
      pendingCount: submissions.filter((item) => item.status === "PENDING").length,
      approvedCount: workspace.overview.approvedCount + submissions.filter((item) => item.status === "APPROVED").length,
      rejectedCount: workspace.overview.rejectedCount + submissions.filter((item) => item.status === "REJECTED").length
    }),
    [spots.length, submissions, workspace.overview]
  );

  const health = useMemo(
    () => ({
      missingCoordinates: spots.filter((spot) => spot.latitude == null || spot.longitude == null).length,
      missingImages: spots.filter((spot) => !spot.imageUrl).length,
      missingTransportInfo: spots.filter((spot) => !spot.transportInfo).length,
      missingTicketLinks: spots.filter((spot) => !spot.ticketBookingUrl).length,
      missingHotelLinks: spots.filter((spot) => !spot.hotelBookingUrl).length
    }),
    [spots]
  );

  const sourceBreakdown = useMemo(() => buildDistribution(spots.map((spot) => spot.source || "admin_import")), [spots]);
  const cityBreakdown = useMemo(() => buildDistribution(spots.map((spot) => spot.city)), [spots]);
  const hotSpots = useMemo(() => buildHotSpots(spots, workspace.monitoring.hotSpots), [spots, workspace.monitoring.hotSpots]);

  const monitorCards = useMemo(() => {
    const baseCards = workspace.monitoring.cards.filter((item) => !["资料待补", "资料待补景点"].includes(item.label));
    return [
      ...baseCards,
      {
        label: "资料待补景点",
        value: spots.filter((spot) => getMissingFields(spot).length > 0).length,
        hint: "建议优先补齐图片、坐标、交通、酒店与门票入口。",
        tone: "warning" as const
      }
    ];
  }, [spots, workspace.monitoring.cards]);

  const monitorSummary = useMemo(
    () => [
      { label: "景点总数", value: overview.spotCount, hint: "当前已接入后台管理的景点。" },
      { label: "注册用户", value: overview.userCount, hint: "数据库模式下统计全部用户。" },
      { label: "社区帖子", value: overview.postCount, hint: "用于观察内容活跃度。" },
      { label: "打卡记录", value: overview.checkInCount, hint: "用于观察线下到访活跃度。" },
      { label: "待审投稿", value: overview.pendingCount, hint: "需要后台及时处理的用户投稿。" },
      { label: "搜索记录", value: overview.searchCount, hint: "可辅助判断热点需求。" }
    ],
    [overview]
  );

  function startCreate() {
    setEditingSpotId(null);
    setForm(emptyForm);
    setMessage("已切换到新建模式。");
  }

  function startEdit(spot: RuralSpotSeed) {
    setEditingSpotId(spot.id || null);
    setForm(toFormState(spot));
    setActiveTab("data");
    setMessage(`正在编辑：${spot.name}`);
  }

  async function saveSpot() {
    const payload = toSpotPayload(form);
    if (!payload.name || !payload.province || !payload.city || !payload.description || payload.tags.length === 0) {
      setMessage("名称、省份、城市、简介和标签为必填项。");
      return;
    }

    const isEditMode = Boolean(editingSpotId);

    try {
      const response = await fetch(isEditMode ? `/api/spots/${editingSpotId}` : "/api/spots", {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || (isEditMode ? "更新失败" : "创建失败"));
        return;
      }

      const savedSpot = (data.item ?? data) as RuralSpotSeed;
      setSpots((current) => sortSpots([...current.filter((spot) => spot.id !== savedSpot.id), savedSpot]));
      setEditingSpotId(savedSpot.id || null);
      setForm(toFormState(savedSpot));
      setMessage(isEditMode ? "景点信息已更新。" : "新景点已创建。");
    } catch {
      setMessage("保存失败，请稍后再试。");
    }
  }

  async function removeSpot(spot: RuralSpotSeed) {
    if (!spot.id) {
      setMessage("该景点没有可用 ID，无法删除。");
      return;
    }

    if (!window.confirm(`确认删除“${spot.name}”吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/spots/${spot.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "删除失败");
        return;
      }

      setSpots((current) => current.filter((item) => item.id !== spot.id));
      if (editingSpotId === spot.id) {
        setEditingSpotId(null);
        setForm(emptyForm);
      }
      setMessage(`已删除景点：${spot.name}`);
    } catch {
      setMessage("删除失败，请稍后再试。");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-brand-100 bg-white p-4 shadow-card">
          <div className="mb-4 text-sm text-slate-500">
            当前模式：
            <span className="ml-2 rounded-full bg-brand-50 px-3 py-1 text-brand-700">
              {workspace.monitoring.mode === "demo" ? "演示数据模式" : "数据库模式"}
            </span>
          </div>
          <div className="space-y-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                  activeTab === tab.key ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-800 hover:bg-brand-100"
                }`}
              >
                <div className="font-medium">{tab.label}</div>
                <div className={`mt-1 text-xs ${activeTab === tab.key ? "text-white/80" : "text-slate-500"}`}>{tab.description}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          {message ? <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div> : null}

          {activeTab === "monitor" ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {monitorSummary.map((item) => (
                  <div key={item.label} className="rounded-3xl border border-brand-100 bg-white p-5 shadow-card">
                    <div className="text-sm text-slate-500">{item.label}</div>
                    <div className="mt-3 text-3xl font-semibold text-brand-900">{item.value}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-500">{item.hint}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Panel title="监控卡片" description="用于快速判断平台近期数据健康和运营状态。">
                  <div className="grid gap-4 md:grid-cols-2">
                    {monitorCards.map((card) => (
                      <div key={card.label} className={`rounded-2xl px-4 py-4 ${toneClass(card.tone)}`}>
                        <div className="text-sm">{card.label}</div>
                        <div className="mt-2 text-2xl font-semibold">{card.value}</div>
                        <div className="mt-2 text-xs leading-6">{card.hint}</div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="数据健康" description="优先处理缺图、缺交通和缺入口的景点。">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span>缺少坐标</span>
                      <strong className="text-brand-900">{health.missingCoordinates}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span>缺少封面图</span>
                      <strong className="text-brand-900">{health.missingImages}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span>缺少交通信息</span>
                      <strong className="text-brand-900">{health.missingTransportInfo}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span>缺少门票入口</span>
                      <strong className="text-brand-900">{health.missingTicketLinks}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span>缺少酒店入口</span>
                      <strong className="text-brand-900">{health.missingHotelLinks}</strong>
                    </div>
                  </div>
                </Panel>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <Panel title="来源 / 城市分布">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-3 text-sm font-medium text-slate-700">来源分布</div>
                      <div className="space-y-3">
                        {sourceBreakdown.map((item) => (
                          <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                            <span>{item.label}</span>
                            <span className="font-medium text-brand-900">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 text-sm font-medium text-slate-700">城市分布</div>
                      <div className="space-y-3">
                        {cityBreakdown.map((item) => (
                          <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                            <span>{item.label}</span>
                            <span className="font-medium text-brand-900">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel title="近期活动" description="最近的搜索、发帖和打卡会汇总在这里。">
                  {workspace.monitoring.recentActivities.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-brand-200 px-4 py-8 text-center text-sm text-slate-500">
                      演示模式下暂无实时活动数据。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {workspace.monitoring.recentActivities.map((activity) => (
                        <div key={activity.id} className="rounded-2xl bg-slate-50 px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="font-medium text-brand-900">{activity.title}</div>
                            <div className="text-xs text-slate-500">{formatDateTime(activity.createdAt)}</div>
                          </div>
                          <div className="mt-1 text-sm text-slate-600">{activity.subtitle}</div>
                          {activity.metric ? <div className="mt-2 text-xs text-brand-700">{activity.metric}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <Panel title="重点景点" description="结合互动量、评分和资料完整度给出优先运营对象。">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {hotSpots.map((spot) => {
                    const target = spots.find((item) => (item.id || item.name) === spot.id);
                    return (
                      <article key={spot.id} className="rounded-2xl border border-brand-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-brand-900">{spot.name}</div>
                            <div className="mt-1 text-sm text-slate-500">{spot.city}</div>
                          </div>
                          <div className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                            {spot.rating != null ? `${spot.rating.toFixed(1)} 分` : "暂无评分"}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-2xl bg-slate-50 px-3 py-3">
                            <div className="text-slate-500">发帖</div>
                            <div className="mt-1 font-semibold text-brand-900">{spot.postCount}</div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-3 py-3">
                            <div className="text-slate-500">打卡</div>
                            <div className="mt-1 font-semibold text-brand-900">{spot.checkInCount}</div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-3 py-3">
                            <div className="text-slate-500">收藏</div>
                            <div className="mt-1 font-semibold text-brand-900">{spot.favoriteCount}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {spot.missingFields.length > 0 ? (
                            spot.missingFields.map((field) => (
                              <span key={field} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                                缺少{field}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">资料较完整</span>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (target) startEdit(target);
                            }}
                            className="rounded-full border border-brand-200 px-4 py-2 text-sm text-brand-700"
                          >
                            查看并编辑
                          </button>
                          <Link href={target?.id ? `/spots/${target.id}` : "/spots"} className="rounded-full bg-brand-700 px-4 py-2 text-sm text-white">
                            前台查看
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeTab === "data" ? (
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <Panel title={editingSpotId ? "编辑景点" : "新建景点"} description="保存后会同步到后台数据管理视图。">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { key: "name", label: "景点名称", placeholder: "例如：大唐不夜城" },
                    { key: "province", label: "省份", placeholder: "陕西省" },
                    { key: "city", label: "城市", placeholder: "西安市" },
                    { key: "district", label: "区县", placeholder: "雁塔区" },
                    { key: "address", label: "详细地址", placeholder: "填写完整地址方便导航", wide: true },
                    { key: "tags", label: "标签", placeholder: "历史 | 夜游 | 亲子" },
                    { key: "bestSeason", label: "最佳季节", placeholder: "春 | 秋" },
                    { key: "suggestedDuration", label: "建议时长", placeholder: "半天 / 1 天" },
                    { key: "source", label: "数据来源", placeholder: "admin_import / manual_seed" },
                    { key: "rating", label: "评分", placeholder: "0 - 5" },
                    { key: "crowdLevel", label: "人流等级", placeholder: "1 - 5" },
                    { key: "avgCost", label: "人均消费", placeholder: "例如：120" },
                    { key: "latitude", label: "纬度", placeholder: "34.259" },
                    { key: "longitude", label: "经度", placeholder: "108.947" },
                    { key: "imageUrl", label: "封面图", placeholder: "https://..." },
                    { key: "ticketBookingUrl", label: "官方门票入口", placeholder: "https://..." },
                    { key: "hotelBookingUrl", label: "酒店入口", placeholder: "https://..." },
                    { key: "gaodeNavigationUrl", label: "高德导航入口", placeholder: "https://...", wide: true }
                  ].map((field) => (
                    <label
                      key={field.key}
                      className={`space-y-2 text-sm ${field.wide ? "md:col-span-2" : ""}`}
                    >
                      <span className="font-medium text-slate-700">{field.label}</span>
                      <input
                        value={form[field.key as keyof SpotFormState]}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            [field.key]: event.target.value
                          }))
                        }
                        placeholder={field.placeholder}
                        className="w-full rounded-2xl border border-brand-100 px-4 py-3 outline-none transition focus:border-brand-400"
                      />
                    </label>
                  ))}

                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="font-medium text-slate-700">景点简介</span>
                    <textarea
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="填写景点特色、适合人群和体验亮点。"
                      className="min-h-32 w-full rounded-2xl border border-brand-100 px-4 py-3 outline-none transition focus:border-brand-400"
                    />
                  </label>

                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="font-medium text-slate-700">交通信息</span>
                    <textarea
                      value={form.transportInfo}
                      onChange={(event) => setForm((current) => ({ ...current, transportInfo: event.target.value }))}
                      placeholder="例如：地铁 4 号线某站下车后步行 600 米。"
                      className="min-h-28 w-full rounded-2xl border border-brand-100 px-4 py-3 outline-none transition focus:border-brand-400"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => void saveSpot()} className="rounded-full bg-brand-700 px-5 py-3 text-sm text-white">
                    {editingSpotId ? "保存修改" : "创建景点"}
                  </button>
                  <button type="button" onClick={startCreate} className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700">
                    新建空白表单
                  </button>
                  <Link href="/admin/import" className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700">
                    打开导入中心
                  </Link>
                </div>
              </Panel>

              <Panel title="景点列表" description="支持搜索、编辑和删除当前后台里的景点。">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索景点名称、城市、标签或简介"
                    className="min-w-0 flex-1 rounded-2xl border border-brand-100 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                  />
                  <span className="rounded-full bg-brand-50 px-4 py-2 text-xs text-brand-700">共 {filteredSpots.length} 条</span>
                </div>

                <div className="mt-4 max-h-[720px] space-y-3 overflow-y-auto pr-1">
                  {filteredSpots.map((spot) => (
                    <article key={spot.id || spot.name} className="rounded-2xl border border-brand-100 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-brand-900">{spot.name}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {spot.province} / {spot.city}
                            {spot.district ? ` / ${spot.district}` : ""}
                          </div>
                        </div>
                        <div className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                          {spot.source || "admin_import"}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {spot.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            {tag}
                          </span>
                        ))}
                        {getMissingFields(spot).map((field) => (
                          <span key={field} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                            缺少{field}
                          </span>
                        ))}
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm leading-7 text-slate-600">{spot.description}</p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(spot)}
                          className="rounded-full border border-brand-200 px-4 py-2 text-sm text-brand-700"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeSpot(spot)}
                          className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-600"
                        >
                          删除
                        </button>
                        {spot.id ? (
                          <Link href={`/spots/${spot.id}`} className="rounded-full bg-brand-700 px-4 py-2 text-sm text-white">
                            前台查看
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeTab === "review" ? (
            <Panel title="用户投稿审核" description="审核通过后会把景点写入后台数据；驳回时可补充审核备注。">
              <AdminReviewBoard items={submissions} onChange={setSubmissions} />
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
