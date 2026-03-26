"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPinned, SearchCheck, Sparkles } from "lucide-react";

export const PLANNER_HERO_SETTING_EVENT = "planner:hero-setting";

export type PlannerHeroSettingEventDetail = {
  key: "includeLiveSignals" | "preferReasonFirst";
  value: boolean;
};

function emitPlannerSetting(detail: PlannerHeroSettingEventDetail) {
  window.dispatchEvent(new CustomEvent<PlannerHeroSettingEventDetail>(PLANNER_HERO_SETTING_EVENT, { detail }));
}

export function PlannerHeroActions() {
  const [includeLiveSignals, setIncludeLiveSignals] = useState(true);
  const [preferReasonFirst, setPreferReasonFirst] = useState(true);

  function toggleLiveSignals() {
    setIncludeLiveSignals((current) => {
      const next = !current;
      emitPlannerSetting({ key: "includeLiveSignals", value: next });
      return next;
    });
  }

  function toggleReasonFirst() {
    setPreferReasonFirst((current) => {
      const next = !current;
      emitPlannerSetting({ key: "preferReasonFirst", value: next });
      return next;
    });
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={toggleLiveSignals}
        aria-pressed={includeLiveSignals}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
          includeLiveSignals ? "border-white/16 bg-white/12 text-white" : "border-white/12 bg-white/5 text-white/70"
        }`}
      >
        <SearchCheck className="h-4 w-4" />
        动态天气、路况与联网搜索
      </button>

      <button
        type="button"
        onClick={toggleReasonFirst}
        aria-pressed={preferReasonFirst}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
          preferReasonFirst ? "border-white/16 bg-white/12 text-white" : "border-white/12 bg-white/5 text-white/70"
        }`}
      >
        <Sparkles className="h-4 w-4" />
        优先展示推荐理由
      </button>

      <Link href="/map" className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm text-white/82">
        <MapPinned className="h-4 w-4" />
        先去地图找感觉
      </Link>
    </div>
  );
}
